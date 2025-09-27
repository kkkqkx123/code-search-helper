import { MCPServer } from './mcp/MCPServer';
import { ApiServer } from './api/ApiServer';
import { Logger } from './utils/logger';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { QdrantService } from './database/QdrantService';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { EmbedderFactory } from './embedders/EmbedderFactory';

class Application {
  private mcpServer: MCPServer;
  private apiServer: ApiServer;
  private logger: Logger;
  private loggerService: LoggerService;
  private errorHandler: ErrorHandlerService;
  private qdrantService: QdrantService;
  private embeddingCacheService: EmbeddingCacheService;
  private embedderFactory: EmbedderFactory;

  constructor() {
    this.logger = new Logger('codebase-index-mcp');

    // 初始化核心服务
    this.loggerService = new LoggerService();
    this.errorHandler = new ErrorHandlerService(this.loggerService);

    // 初始化数据库服务
    this.qdrantService = new QdrantService(this.loggerService, this.errorHandler);

    // 初始化嵌入器服务
    this.embeddingCacheService = new EmbeddingCacheService(this.logger, this.errorHandler);
    this.embedderFactory = new EmbedderFactory(this.logger, this.errorHandler, this.embeddingCacheService);

    // 初始化服务器
    this.mcpServer = new MCPServer(this.logger);
    this.apiServer = new ApiServer(this.logger);
  }

  async start(): Promise<void> {
    try {
      await this.logger.info('Starting application...');

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

  async stop(): Promise<void> {
    await this.logger.info('Stopping application...');

    // 关闭数据库服务
    try {
      await this.qdrantService.close();
      await this.loggerService.info('Database service closed');
    } catch (error) {
      await this.loggerService.error('Error closing database service:', error);
    }

    // 关闭MCP服务器
    await this.mcpServer.stop();

    await this.logger.info('Application stopped');

    // 通知Logger这是一个正常退出，应该删除日志文件
    if ('markAsNormalExit' in this.logger) {
      await (this.logger as any).markAsNormalExit();
    }

    // 通知LoggerService这是一个正常退出
    await this.loggerService.markAsNormalExit();
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