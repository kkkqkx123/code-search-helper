import { MCPServer } from './mcp/MCPServer.js';
import { ApiServer } from './api/ApiServer.js';
import { Logger } from './utils/logger.js';

class Application {
  private mcpServer: MCPServer;
  private apiServer: ApiServer;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('codebase-index-mcp');
    this.mcpServer = new MCPServer(this.logger);
    this.apiServer = new ApiServer(this.logger);
  }

  async start(): Promise<void> {
    try {
      await this.logger.info('Starting application...');
      
      // 启动MCP服务器
      await this.mcpServer.start();
      await this.logger.info('MCP Server started successfully');
      
      // 启动API服务器
      this.apiServer.start();
      await this.logger.info('API Server started successfully');

      await this.logger.info('Application started successfully');
      await this.logger.info('MCP Server: Ready for MCP connections');
      await this.logger.info('API Server: http://localhost:3010');
      await this.logger.info('Frontend available at http://localhost:3011');
      
    } catch (error) {
      await this.logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.logger.info('Stopping application...');
    await this.mcpServer.stop();
    await this.logger.info('Application stopped');
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