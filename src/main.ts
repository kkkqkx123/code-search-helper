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
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { ConfigService } from './config/ConfigService';
import { diContainer } from './core/DIContainer';
import { TYPES } from './types';
import { EmbeddingConfigService } from './config/service/EmbeddingConfigService';
import { ProjectIdManager } from './database/ProjectIdManager';
import { NebulaClient } from './database/nebula/client/NebulaClient';
import { NebulaConnectionMonitor } from './database/nebula/NebulaConnectionMonitor';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { HotReloadRestartService } from './service/filesystem/HotReloadRestartService';
import { SqliteDatabaseService } from './database/splite/SqliteDatabaseService';
import { ProcessEventManager } from './utils/ProcessEventManager';
import { HybridIndexService } from './service/index/HybridIndexService';

// 获取事件管理器实例，用于统一管理所有事件监听器
const eventManager = ProcessEventManager.getInstance();
// 使用事件管理器注册全局错误处理，避免重复注册
const uncaughtExceptionHandler = async (error: Error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : 'Unknown';
  console.error('Uncaught Exception:', {
    name: errorName,
    message: errorMessage,
    stack: errorStack,
    fullError: error
  });
  if (errorStack) {
    console.error('Stack trace:', errorStack);
  }
  process.exit(1);
};

const unhandledRejectionHandler = async (reason: any, promise: Promise<any>) => {
  const reasonMessage = reason instanceof Error ? reason.message : String(reason);
  const reasonStack = reason instanceof Error ? reason.stack : undefined;
  console.error('Unhandled Rejection at:', promise, 'Reason:', reasonMessage);
  if (reasonStack) {
    console.error('Stack trace:', reasonStack);
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
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.EmbeddingCacheService) private embeddingCacheService: EmbeddingCacheService,
    @inject(TYPES.EmbeddingConfigService) private embeddingConfigService: EmbeddingConfigService,
    @inject(TYPES.NebulaClient) private nebulaClient: NebulaClient,
    @inject(TYPES.NebulaConnectionMonitor) private nebulaConnectionMonitor: NebulaConnectionMonitor,
    @inject(TYPES.ChangeDetectionService) private changeDetectionService: ChangeDetectionService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.HotReloadRestartService) private hotReloadRestartService: HotReloadRestartService,
    @inject(TYPES.SqliteDatabaseService) private sqliteService: SqliteDatabaseService,
    @inject(TYPES.HybridIndexService) private indexService: HybridIndexService
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
        const nebulaConnected = await this.nebulaClient.initialize();
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

      // 初始化相似度服务
      await this.loggerService.info('Initializing similarity service...');
      try {
        // 直接创建相似度服务，避免DI容器的问题
        const similarityService = this.createSimilarityService();
        // SimilarityService 没有 initialize 方法，所以不需要调用
        await this.loggerService.info('Similarity service created successfully');
      } catch (error) {
        await this.loggerService.warn('Failed to create similarity service, will continue without similarity functionality:', error);
      }

      this.currentPhase = ApplicationLifecyclePhase.SERVICES_STARTED;

      // 启动服务器
      await this.loggerService.info('Starting MCP server...');
      await this.mcpServer.start();
      await this.loggerService.info('MCP Server started successfully');

      await this.loggerService.info('Starting API server...');
      this.apiServer.start();
      await this.loggerService.info('API Server started successfully');

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

      // 热重载服务已移除自动索引逻辑
      // 索引现在只能通过API调用触发
      await this.loggerService.info('Hot reload service initialized - indexing only available via API calls');

      this.currentPhase = ApplicationLifecyclePhase.RUNNING;

      await this.loggerService.info('Application started successfully');
      await this.loggerService.info('MCP Server: Ready for MCP connections');
      const apiPort = this.configService.get('environment')?.port || 3010;
      await this.loggerService.info(`API Server: http://localhost:${apiPort}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      await this.loggerService.error('Failed to start application:', errorMessage);
      console.error('Failed to start application:', errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
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

  /**
   * 创建相似度服务实例，避免DI容器的问题
   */
  private createSimilarityService(): any {
    // 直接创建依赖实例
    const logger = diContainer.get<LoggerService>(TYPES.LoggerService);
    const keywordStrategy = diContainer.get<any>(TYPES.KeywordSimilarityStrategy);
    const semanticStrategy = diContainer.get<any>(TYPES.SemanticSimilarityStrategy);
    
    // 创建批处理计算器实例
    const genericCalculator = diContainer.get<any>(TYPES.GenericBatchCalculator);
    const semanticCalculator = diContainer.get<any>(TYPES.SemanticOptimizedBatchCalculator);
    const hybridCalculator = diContainer.get<any>(TYPES.HybridOptimizedBatchCalculator);
    const adaptiveCalculator = diContainer.get<any>(TYPES.AdaptiveBatchCalculator);
    
    // 创建批处理计算器工厂
    const batchCalculatorFactory = new (require('./service/similarity/batch/BatchCalculatorFactory').BatchCalculatorFactory)(
      logger,
      genericCalculator,
      semanticCalculator,
      hybridCalculator,
      adaptiveCalculator
    );
    
    // 创建相似度服务
    const SimilarityServiceClass = require('./service/similarity/SimilarityService').SimilarityService;
    const similarityService = new SimilarityServiceClass(
      logger,
      undefined, // cacheManager
      undefined, // performanceMonitor
      undefined, // coordinator - 不使用协调器，避免类型问题
      undefined, // levenshteinStrategy
      semanticStrategy,
      keywordStrategy,
      batchCalculatorFactory
    );
    
    return similarityService;
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
        await this.logger.info('Qdrant database service closed');
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

          await this.nebulaClient.close();
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


      // 清理相似度服务
      try {
        // 直接创建的相似度服务，不需要清理
        await this.loggerService.info('Similarity service cleanup skipped (directly created)');
      } catch (error) {
        await this.loggerService.error('Error cleaning up similarity service:', error);
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
    try {
      // 从DI容器获取所有必要的服务
      const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
      const loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);
      const errorHandler = diContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);
      const embedderFactory = diContainer.get<EmbedderFactory>(TYPES.EmbedderFactory);
      const projectStateManager = diContainer.get<ProjectStateManager>(TYPES.ProjectStateManager);
      const embeddingCacheService = diContainer.get<EmbeddingCacheService>(TYPES.EmbeddingCacheService);
      const embeddingConfigService = diContainer.get<EmbeddingConfigService>(TYPES.EmbeddingConfigService);
      const nebulaClient = diContainer.get<NebulaClient>(TYPES.NebulaClient);
      const nebulaConnectionMonitor = diContainer.get<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor);
      const changeDetectionService = diContainer.get<ChangeDetectionService>(TYPES.ChangeDetectionService);
      const projectIdManager = diContainer.get<ProjectIdManager>(TYPES.ProjectIdManager);
      const hotReloadRestartService = diContainer.get<HotReloadRestartService>(TYPES.HotReloadRestartService);
      const sqliteService = diContainer.get<SqliteDatabaseService>(TYPES.SqliteDatabaseService);
      const indexService = diContainer.get<HybridIndexService>(TYPES.HybridIndexService);

      return new Application(
        configService,
        loggerService,
        errorHandler,
        qdrantService,
        embedderFactory,
        projectStateManager,
        embeddingCacheService,
        embeddingConfigService,
        nebulaClient,
        nebulaConnectionMonitor,
        changeDetectionService,
        projectIdManager,
        hotReloadRestartService,
        sqliteService,
        indexService
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Error in ApplicationFactory.createApplication:', errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      throw error;
    }
  }
}

// 启动应用
async function bootstrap(): Promise<void> {
  try {
    // 首先注册策略提供者（必须在任何使用ASTCodeSplitter的服务之前）
    try {
      // 策略提供者注册逻辑
    } catch (error) {
      console.warn('Failed to register strategy providers:', error);
    }

    // 在创建应用实例之前，先初始化配置服务
    let configService: ConfigService;
    try {
      configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Error getting ConfigService from container:', errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      throw error;
    }
    
    try {
      await configService.initialize();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Error initializing ConfigService:', errorMessage);
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      throw error;
    }

    const app = ApplicationFactory.createApplication();
    await app.start();

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Failed to bootstrap application:', errorMessage);
    if (errorStack) {
      console.error('Stack trace:', errorStack);
    }
    process.exit(1);
  }
}

// 启动应用
bootstrap();