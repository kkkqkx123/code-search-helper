import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger.js';

export class MCPServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    // 初始化MCP服务器
    this.server = new McpServer({
      name: 'codebase-index-mcp',
      version: '1.0.0',
      description: 'Intelligent codebase indexing and analysis service',
    });

    // 初始化传输层
    this.transport = new StdioServerTransport();

    // 注册工具
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // 搜索工具
    this.server.tool(
      'codebase.search',
      {
        query: z.string().describe('Search query'),
        options: z.object({
          limit: z.number().optional().default(10),
          type: z.enum(['semantic', 'keyword', 'hybrid']).optional().default('semantic')
        }).optional()
      },
      async (args) => {
        const results = await this.handleSearch(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(results) }]
        };
      }
    );

    // 状态检查工具
    this.server.tool(
      'codebase.status',
      {},
      async () => {
        const status = await this.getStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(status) }]
        };
      }
    );
  }

  private async handleSearch(args: any): Promise<any> {
    // 第一阶段使用模拟数据
    try {
      await this.logger.debug('Handling search request:', args);
      const mockData = await this.loadMockData();
      const query = args.query.toLowerCase();
      
      const results = mockData.snippets.filter((snippet: any) =>
        snippet.content.toLowerCase().includes(query) ||
        snippet.name?.toLowerCase().includes(query) ||
        snippet.metadata?.description?.toLowerCase().includes(query)
      ).slice(0, args.options?.limit || 10);

      await this.logger.debug('Search completed, found', results.length, 'results');
      return {
        results: results.map((result: any, index: number) => ({
          id: `result_${index + 1}`,
          score: 0.9 - (index * 0.1),
          snippet: result,
          matchType: 'keyword'
        })),
        total: results.length,
        query: args.query
      };
    } catch (error) {
      await this.logger.error('Search failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        results: [],
        total: 0,
        query: args.query
      };
    }
  }

  private async loadMockData(): Promise<any> {
    try {
      // 在实际实现中会从文件系统读取
      const dataPath = path.join(process.cwd(), 'data', 'mock', 'code-snippets.json');
      await this.logger.debug('Loading mock data from:', dataPath);
      const data = await fs.readFile(dataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      await this.logger.warn('Failed to load mock data, using defaults:', error);
      // 如果无法读取文件，返回默认模拟数据
      return {
        snippets: [
          {
            id: "snippet_001",
            content: "function calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}",
            filePath: "src/utils/math.js",
            language: "javascript",
            type: "function",
            name: "calculateTotal"
          }
        ]
      };
    }
  }

  private async getStatus(): Promise<any> {
    return {
      status: 'ready',
      version: '1.0.0',
      features: ['search'],
      mockMode: true
    };
  }

  async start(): Promise<void> {
    try {
      await this.server.connect(this.transport);
      await this.logger.info('MCP Server started successfully');
    } catch (error) {
      await this.logger.error('Failed to start MCP Server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.server.close();
      await this.logger.info('MCP Server stopped');
    } catch (error) {
      await this.logger.error('Failed to stop MCP Server:', error);
      throw error;
    }
  }
}