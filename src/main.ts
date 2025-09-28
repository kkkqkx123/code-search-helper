import { MCPServer } from './mcp/MCPServer';
import { ApiServer } from './api/ApiServer';
import { Logger } from './utils/logger';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { QdrantService } from './database/QdrantService';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { IndexSyncService } from './service/index/IndexSyncService';
import { ConfigService } from './config/ConfigService';
import { diContainer } from './core/DIContainer';
import { TYPES } from './types';

class Application {
  private mcpServer: MCPServer;
  private apiServer: ApiServer;
  private logger: Logger;
  private qdrantService: QdrantService;
  private embeddingCacheService: EmbeddingCacheService;
  private embedderFactory: EmbedderFactory;
  private loggerService: LoggerService;
  private indexSyncService: IndexSyncService;

  constructor() {
    // 从依赖注入容器获取服务
    const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    this.loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);
    const errorHandler = diContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    this.qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);
    this.indexSyncService = diContainer.get<IndexSyncService>(TYPES.IndexSyncService);

    // 创建一个 Logger 实例，用于整个应用，确保所有组件使用同一个日志文件
    const loggerInstance = new Logger('code-search-helper');
    this.logger = loggerInstance;

    // 初始化嵌入器服务
    this.embeddingCacheService = new EmbeddingCacheService(this.loggerService, errorHandler);
    this.embedderFactory = new EmbedderFactory(this.loggerService, errorHandler, this.embeddingCacheService);

    // 初始化服务器
    this.mcpServer = new MCPServer(this.logger);
    this.apiServer = new ApiServer(this.logger, this.indexSyncService);
  }

  async start(): Promise<void> {
    try {
      await this.logger.info('Starting application...');

      // 检查环境变量配置
      await this.loggerService.info('Checking environment configuration...');
      this.validateEmbeddingProviderConfig();

      // 初始化数据库服务
      await this.loggerService.info('Initializing database services...');
      const dbConnected = await this.qdrantService.initialize();
      if (dbConnected) {
        await this.loggerService.info('Qdrant database service initialized successfully');
      } else {
        await this.loggerService.warn('Qdrant database service initialization failed, will continue without database');
      }

      // 初始化嵌入器服务
      await this.loggerService.info('Initializing embedder services...');
      const availableProviders = await this.embedderFactory.getAvailableProviders();
      if (availableProviders.length > 0) {
        await this.loggerService.info('Embedder services initialized successfully', { availableProviders });
      } else {
        await this.loggerService.warn('No embedder providers available, will continue without embedding functionality');
      }

      // 启动MCP服务器
      await this.mcpServer.start();
      await this.logger.info('MCP Server started successfully');

      // 启动API服务器
      this.apiServer.start();
      await this.logger.info('API Server started successfully');

      await this.logger.info('Application started successfully');
      await this.logger.info('MCP Server: Ready for MCP connections');
      await this.logger.info('API Server: http://localhost:3010');

    } catch (error) {
      await this.logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * 验证嵌入提供者的环境变量配置
   * 仅检查 EMBEDDING_PROVIDER 设置的提供者相关字段是否非空
   */
  private validateEmbeddingProviderConfig(): void {
    const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
    const loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);

    const config = configService.get('embedding');
    const selectedProvider = config.provider || 'openai';

    let missingEnvVars: string[] = [];

    switch (selectedProvider.toLowerCase()) {
      case 'openai':
        if (!config.openai.apiKey) {
          missingEnvVars.push('OPENAI_API_KEY');
        }
        break;
      case 'ollama':
        if (!config.ollama.baseUrl) {
          missingEnvVars.push('OLLAMA_BASE_URL');
        }
        break;
      case 'gemini':
        if (!config.gemini.apiKey) {
          missingEnvVars.push('GEMINI_API_KEY');
        }
        break;
      case 'mistral':
        if (!config.mistral.apiKey) {
          missingEnvVars.push('MISTRAL_API_KEY');
        }
        break;
      case 'siliconflow':
        if (!config.siliconflow.apiKey) {
          missingEnvVars.push('SILICONFLOW_API_KEY');
        }
        break;
      case 'custom1':
        if (!config.custom?.custom1?.apiKey) {
          missingEnvVars.push('CUSTOM_CUSTOM1_API_KEY');
        }
        if (!config.custom?.custom1?.baseUrl) {
          missingEnvVars.push('CUSTOM_CUSTOM1_BASE_URL');
        }
        break;
      case 'custom2':
        if (!config.custom?.custom2?.apiKey) {
          missingEnvVars.push('CUSTOM_CUSTOM2_API_KEY');
        }
        if (!config.custom?.custom2?.baseUrl) {
          missingEnvVars.push('CUSTOM_CUSTOM2_BASE_URL');
        }
        break;
      case 'custom3':
        if (!config.custom?.custom3?.apiKey) {
          missingEnvVars.push('CUSTOM_CUSTOM3_API_KEY');
        }
        if (!config.custom?.custom3?.baseUrl) {
          missingEnvVars.push('CUSTOM_CUSTOM3_BASE_URL');
        }
        break;
      default:
        // 如果提供者不支持，记录警告
        loggerService.warn(`Unsupported embedding provider: ${selectedProvider}`);
        break;
    }

    if (missingEnvVars.length > 0) {
      loggerService.warn(`Missing environment variables for provider '${selectedProvider}':`, { missingEnvVars });
    } else {
      loggerService.info(`Environment configuration validated for provider: ${selectedProvider}`);
    }
  }

  async stop(): Promise<void> {
    await this.logger.info('Stopping application...');

    // 从依赖注入容器获取服务
    const loggerService = diContainer.get<LoggerService>(TYPES.LoggerService);
    const qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);

    // 关闭数据库服务
    try {
      await qdrantService.close();
      await loggerService.info('Database service closed');
    } catch (error) {
      await loggerService.error('Error closing database service:', error);
    }

    // 关闭MCP服务器
    await this.mcpServer.stop();

    await this.logger.info('Application stopped');

    // 通知Logger这是一个正常退出，应该删除日志文件
    if ('markAsNormalExit' in this.logger) {
      await (this.logger as any).markAsNormalExit();
    }

    // 通知LoggerService这是一个正常退出
    await loggerService.markAsNormalExit();
  }
}

// 启动应用
const app = new Application();
app.start().catch(console.error);

// 优雅关闭
process.on('SIGINT', async () => {
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});