import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { MCPServer } from './mcp/MCPServer';
import { ApiServer } from './api/ApiServer';
import { Logger } from './utils/logger';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { QdrantService } from './database/qdrant/QdrantService';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { IndexService } from './service/index/IndexService';
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { ConfigService } from './config/ConfigService';
import { ConfigFactory } from './config/ConfigFactory';
import { diContainer } from './core/DIContainer';
import { TYPES } from './types';
import { EmbeddingConfigService } from './config/service/EmbeddingConfigService';
import { ProjectIdManager } from './database/ProjectIdManager';
import { NebulaService } from './database/nebula/NebulaService';
import { NebulaConnectionMonitor } from './service/graph/monitoring/NebulaConnectionMonitor';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { HotReloadRestartService } from './service/filesystem/HotReloadRestartService';
import { SqliteDatabaseService } from './database/splite/SqliteDatabaseService';
import { ProcessEventManager } from './utils/ProcessEventManager';
import { registerDefaultStrategyProviders } from './service/parser/processing/strategies/factory';

// 获取事件管理器实例，用于统一管理所有事件监听器
const eventManager = ProcessEventManager.getInstance();

// 使用事件管理器注册全局错误处理，避免重复注册
const uncaughtExceptionHandler = async (error: Error) => {
  console.error('Uncaught Exception:', error);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Error type:', typeof error);
  if (error && typeof error === 'object' && 'kind' in error) {
    console.error('Error kind:', (error as any).kind);
  }
  // 尝试获取更多错误信息
  if (error && typeof error === 'object') {
    Object.getOwnPropertyNames(error).forEach(key => {
      if (!['name', 'message', 'stack', 'kind'].includes(key)) {
        console.error(`Error ${key}:`, (error as any)[key]);
      }
    });
  }
  process.exit(1);
};

const unhandledRejectionHandler = async (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  if (reason && typeof reason === 'object' && 'kind' in reason) {
    console.error('Reason kind:', (reason as any).kind);
  }
  // 尝试获取更多原因信息
  if (reason && typeof reason === 'object') {
    Object.getOwnPropertyNames(reason).forEach(key => {
      if (!['name', 'message', 'stack', 'kind'].includes(key)) {
        console.error(`Reason ${key}:`, (reason as any)[key]);
      }
    });
  }
  process.exit(1);
};

eventManager.addListener('uncaughtException', uncaughtExceptionHandler);
eventManager.addListener('unhandledRejection', unhandledRejectionHandler);

/**
 * 应用生命周期阶段枚举
 */
enum ApplicationLifecyclePhase {
  INITIALIZING = 'initializing',
  CONFIG_LOADING = 'config_loading',
  SERVICES_INITIALIZING = 'services_initializing',
  SERVICES_STARTED = 'services_started',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
  STOPPED = 'stopped'
}

/**
 * 应用主类 - 使用构造函数注入和生命周期管理
 */
@injectable()
class Application {
  private mcpServer: MCPServer;
  private apiServer: ApiServer;
  private logger: Logger;
  private currentPhase: ApplicationLifecyclePhase = ApplicationLifecyclePhase.INITIALIZING;
  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.LoggerService) private loggerService: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.EmbeddingCacheService) private embeddingCacheService: EmbeddingCacheService,
    @inject(TYPES.EmbeddingConfigService) private embeddingConfigService: EmbeddingConfigService,
    @inject(TYPES.INebulaService) private nebulaService: NebulaService,
    @inject(TYPES.NebulaConnectionMonitor) private nebulaConnectionMonitor: NebulaConnectionMonitor,
    @inject(TYPES.ChangeDetectionService) private changeDetectionService: ChangeDetectionService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.HotReloadRestartService) private hotReloadRestartService: HotReloadRestartService,
    @inject(TYPES.SqliteDatabaseService) private sqliteService: SqliteDatabaseService
  ) {
    // 使用 Logger 单例，避免重复创建实例
    this.logger = Logger.getInstance('code-search-helper');

    // 创建 MCP 服务器实例
    this.mcpServer = new MCPServer(this.logger);

    // API端口配置
    const apiPort = parseInt(process.env.PORT || '3010', 10);
    this.apiServer = new ApiServer(
      this.logger,
      this.indexService,
      this.embedderFactory,
      this.qdrantService,
      apiPort
    );
  }

  /**
   * 启动应用程序 - 使用生命周期阶段管理
   */
  async start(): Promise<void> {
    try {
      await this.logger.info('Starting application...');
      this.currentPhase = ApplicationLifecyclePhase.CONFIG_LOADING;

      // 初始化配置服务
      await this.loggerService.info('Initializing configuration service...');
      await this.configService.initialize();
      await this.loggerService.info('Configuration service initialized successfully');

      // 更新日志级别为配置中的级别
      const loggingConfig = this.configService.get('logging');
      if (loggingConfig?.level) {
        this.loggerService.updateLogLevel(loggingConfig.level);
      }

      // 验证嵌入提供者配置（通过配置服务）
      await this.loggerService.info('Validating embedding provider configuration...');
      await this.validateEmbeddingConfiguration();

      this.currentPhase = ApplicationLifecyclePhase.SERVICES_INITIALIZING;

      // 初始化数据库服务
      // 初始化SQLite数据库服务
      await this.loggerService.info('Initializing SQLite database service...');
      await this.sqliteService.initialize();
      await this.loggerService.info('SQLite database service initialized successfully');

      // 在数据库初始化完成后，手动加载项目映射
      await this.projectIdManager.loadMappingAfterDatabaseInitialization();

      // 初始化项目状态管理器
      await this.loggerService.info('Initializing project state manager...');
      await this.projectStateManager.initialize();

      await this.loggerService.info('Initializing database services...');
      const dbConnected = await this.qdrantService.initialize();
      if (dbConnected) {
        await this.loggerService.info('Qdrant database service initialized successfully');
      } else {
        await this.loggerService.warn('Qdrant database service initialization failed, will continue without database');
      }

      // 初始化嵌入入器服务
      await this.loggerService.info('Initializing embedder services...');
      const availableProviders = await this.embedderFactory.getAvailableProviders();
      if (availableProviders.length > 0) {
        await this.loggerService.info('Embedder services initialized successfully', { availableProviders });
      } else {
        await this.loggerService.warn('No embedder providers available, will continue without embedding functionality');
      }

      // 检查是否启用Nebula图数据库服务
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (nebulaEnabled) {
        await this.loggerService.info('Initializing Nebula graph database service...');
        const nebulaConnected = await this.nebulaService.initialize();
        if (nebulaConnected) {
          await this.loggerService.info('Nebula graph database service initialized successfully');

          // 启动Nebula连接监控
          await this.loggerService.info('Starting Nebula connection monitoring...');
          this.nebulaConnectionMonitor.startMonitoring(30000); // 每30秒检查一次
          await this.loggerService.info('Nebula connection monitoring started');
        } else {
          await this.loggerService.warn('Nebula graph database service initialization failed, will continue without graph database');
        }
      } else {
        await this.loggerService.info('Nebula graph database service is disabled via NEBULA_ENABLED environment variable, skipping initialization');
      }

      this.currentPhase = ApplicationLifecyclePhase.SERVICES_STARTED;

      // 启动服务器
      await this.loggerService.info('Starting MCP server...');
      await this.mcpServer.start();
      await this.logger.info('MCP Server started successfully');

      await this.logger.info('Starting API server...');
      this.apiServer.start();
      await this.logger.info('API Server started successfully');

      // Initialize hot reload services with restart recovery
      await this.loggerService.info('Initializing hot reload services with restart recovery...');

      // 首先处理重启恢复逻辑
      try {
        await this.hotReloadRestartService.handleApplicationRestart();
        await this.loggerService.info('Hot reload restart recovery completed');
      } catch (error) {
        await this.loggerService.error('Failed to handle hot reload restart recovery:', error);
        // 继续执行，因为这不应该阻止应用启动
      }

      // Check if hot reload is enabled via configuration
      // 直接启用热重载，因为目前没有专门的配置项
      const hotReloadEnabled = true;
      if (hotReloadEnabled) {
        try {
          // 获取项目根路径（使用当前工作目录作为项目路径）
          const projectPath = process.cwd();

          // 检查项目是否已索引，如果未索引则启动索引
          const projectId = this.projectIdManager.getProjectId(projectPath);
          if (!projectId) {
            await this.loggerService.info('Project not indexed, starting indexing process...');

            // 初始化变更检测服务
            await this.changeDetectionService.initialize([projectPath]);
            await this.loggerService.info('Change Detection Service initialized successfully');

            // 开始索引项目（这将自动启用热更新，如果配置了enableHotReload）
            await this.indexService.startIndexing(projectPath, { enableHotReload: true });
            await this.loggerService.info('Project indexing started with hot reload enabled');
          } else {
            // 项目已存在，但可能没有激活热更新，检查是否需要激活
            await this.loggerService.info('Project already indexed, checking hot reload status...');

            // 尝试为已索引的项目启用热更新
            await this.indexService.startProjectWatching(projectPath);
            await this.loggerService.info('Project watching started for hot reload');
          }
        } catch (error) {
          await this.loggerService.error('Failed to initialize hot reload services:', error);
          // Graceful degradation - continue without hot reload
          await this.loggerService.warn('Hot reload disabled due to initialization error');
        }
      } else {
        await this.loggerService.info('Hot reload is disabled via configuration');
      }

      this.currentPhase = ApplicationLifecyclePhase.RUNNING;

      await this.logger.info('Application started successfully');
      await this.logger.info('MCP Server: Ready for MCP connections');
      const apiPort = this.configService.get('environment')?.port || 3010;
      await this.logger.info(`API Server: http://localhost:${apiPort}`);

    } catch (error) {
      await this.loggerService.error('Failed to start application:', error);
      await this.logger.error('Failed to start application:', error);
      console.error('Detailed error:', error);
      console.error('Error stack:', (error as Error).stack);
      process.exit(1);
    }
  }

  /**
   * 验证嵌入配置 - 通过嵌入配置服务进行验证
   */
  private async validateEmbeddingConfiguration(): Promise<void> {
    try {
      const embeddingConfig = this.configService.get('embedding');
      const selectedProvider = embeddingConfig.provider || 'openai';

      // 使用嵌入配置服务的验证方法
      const missingEnvVars = this.embeddingConfigService.validateCurrentProvider();
      if (missingEnvVars.length > 0) {
        await this.loggerService.warn(`Missing environment variables for provider '${selectedProvider}':`, { missingEnvVars });
      } else {
        await this.loggerService.info(`Environment configuration validated for provider: ${selectedProvider}`);
      }
    } catch (error) {
      await this.loggerService.error('Error validating embedding configuration:', error);
    }
  }

  // 已移除旧的 validateEmbeddingProviderConfig 方法 - 现在使用配置服务进行验证

  /**
   * 优雅关闭应用程序
   */
  async stop(): Promise<void> {
    try {
      this.currentPhase = ApplicationLifecyclePhase.SHUTTING_DOWN;
      await this.logger.info('Stopping application...');

      // 关闭数据库服务
      try {
        await this.qdrantService.close();
        await this.loggerService.info('Qdrant database service closed');
      } catch (error) {
        await this.loggerService.error('Error closing Qdrant database service:', error);
      }

      // 检查是否启用了Nebula图数据库服务，只有在启用的情况下才需要关闭
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (nebulaEnabled) {
        // 关闭Nebula图数据库服务
        try {
          // 停止Nebula连接监控
          this.nebulaConnectionMonitor.stopMonitoring();
          await this.loggerService.info('Nebula connection monitoring stopped');

          await this.nebulaService.close();
          await this.loggerService.info('Nebula graph database service closed');
        } catch (error) {
          await this.loggerService.error('Error closing Nebula graph database service:', error);
        }
      } else {
        await this.loggerService.info('Nebula graph database service is disabled via NEBULA_ENABLED environment variable, skipping shutdown');
      }

      // 关闭MCP服务器
      await this.mcpServer.stop();
      // 保存热更新重启状态
      try {
        await this.hotReloadRestartService.saveCurrentState();
        await this.loggerService.info('Hot reload restart state saved');
      } catch (error) {
        await this.loggerService.error('Error saving hot reload restart state:', error);
      }

      // 关闭变更检测服务
      try {
        if (this.changeDetectionService.isServiceRunning()) {
          await this.loggerService.info('Stopping Change Detection Service...');
          await this.changeDetectionService.stop();
          await this.loggerService.info('Change Detection Service stopped');
        }
      } catch (error) {
        await this.loggerService.error('Error stopping Change Detection Service:', error);
      }


      this.currentPhase = ApplicationLifecyclePhase.STOPPED;
      await this.logger.info('Application stopped');

      // 通知Logger这是一个正常退出，应该删除日志文件
      if ('markAsNormalExit' in this.logger) {
        await (this.logger as any).markAsNormalExit();
      }

      // 通知LoggerService这是一个正常退出
      await this.loggerService.markAsNormalExit();
    } catch (error) {
      await this.loggerService.error('Error during application shutdown:', error);
      throw error;
    }
  }

  /**
   * 获取当前应用生命周期阶段
   */
  getCurrentPhase(): ApplicationLifecyclePhase {
    return this.currentPhase;
  }
}

/**
 * 应用程序工厂 - 负责创建和配置Application实例
 */
class ApplicationFactory {
  static createApplication(): Application {
    // 从DI容器获取所有必要的服务
    const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    const loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);
    const errorHandler = diContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    const qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);
    const embedderFactory = diContainer.get<EmbedderFactory>(TYPES.EmbedderFactory);
    const indexService = diContainer.get<IndexService>(TYPES.IndexService);
    const projectStateManager = diContainer.get<ProjectStateManager>(TYPES.ProjectStateManager);
    const embeddingCacheService = diContainer.get<EmbeddingCacheService>(TYPES.EmbeddingCacheService);
    const embeddingConfigService = diContainer.get<EmbeddingConfigService>(TYPES.EmbeddingConfigService);
    const nebulaService = diContainer.get<NebulaService>(TYPES.INebulaService);
    const nebulaConnectionMonitor = diContainer.get<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor);
    const changeDetectionService = diContainer.get<ChangeDetectionService>(TYPES.ChangeDetectionService);
    const projectIdManager = diContainer.get<ProjectIdManager>(TYPES.ProjectIdManager);
    const hotReloadRestartService = diContainer.get<HotReloadRestartService>(TYPES.HotReloadRestartService);
    const sqliteService = diContainer.get<SqliteDatabaseService>(TYPES.SqliteDatabaseService);

    return new Application(
      configService,
      loggerService,
      errorHandler,
      qdrantService,
      embedderFactory,
      indexService,
      projectStateManager,
      embeddingCacheService,
      embeddingConfigService,
      nebulaService,
      nebulaConnectionMonitor,
      changeDetectionService,
      projectIdManager,
      hotReloadRestartService,
      sqliteService
    );
  }
}

// 启动应用
async function bootstrap(): Promise<void> {
  console.log('Starting bootstrap process...');
  try {
    // 首先注册策略提供者（必须在任何使用ASTCodeSplitter的服务之前）
    console.log('Registering strategy providers...');
    try {
      registerDefaultStrategyProviders();
      console.log('Strategy providers registered successfully');
    } catch (error) {
      console.warn('Failed to register strategy providers:', error);
    }

    console.log('Getting ConfigService from DI container...');
    // 在创建应用实例之前，先初始化配置服务
    const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    console.log('ConfigService retrieved, initializing...');
    await configService.initialize();
    console.log('ConfigService initialized successfully');

    console.log('Creating application instance...');
    const app = ApplicationFactory.createApplication();
    console.log('Application instance created, starting...');
    await app.start();
    console.log('Application started successfully');

    // 优雅关闭处理 - 使用事件管理器统一管理
    const sigintHandler = async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      try {
        await app.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    const sigtermHandler = async () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      try {
        await app.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    eventManager.addListener('SIGINT', sigintHandler);
    eventManager.addListener('SIGTERM', sigtermHandler);

  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    if (error && typeof error === 'object' && 'kind' in error) {
      console.error('Error kind:', (error as any).kind);
    }
    console.error('Error stack:', (error as Error).stack);
    process.exit(1);
  }
}

// 启动应用
bootstrap();