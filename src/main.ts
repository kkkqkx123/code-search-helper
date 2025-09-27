import { MCPServer } from './mcp/MCPServer.js';
import { ApiServer } from './api/ApiServer.js';

class Application {
  private mcpServer: MCPServer;
  private apiServer: ApiServer;

  constructor() {
    this.mcpServer = new MCPServer();
    this.apiServer = new ApiServer();
  }

  async start(): Promise<void> {
    try {
      // 启动MCP服务器
      await this.mcpServer.start();
      
      // 启动API服务器
      this.apiServer.start();

      console.log('Application started successfully');
      console.log('MCP Server: Ready for MCP connections');
      console.log('API Server: http://localhost:3000');
      
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.mcpServer.stop();
    console.log('Application stopped');
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