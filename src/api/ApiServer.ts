import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger.js';

export class ApiServer {
  private app: express.Application;
  private port: number;
  private logger: Logger;

  constructor(logger: Logger, port: number = 3010) {
    this.logger = logger;
    this.app = express();
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'frontend')));
  }

  private setupRoutes(): void {
    // 搜索端点
    this.app.post('/api/search', async (req, res) => {
      try {
        const { query, options } = req.body;
        
        if (!query) {
          await this.logger.warn('Search request missing query parameter');
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required'
          });
        }

        await this.logger.debug('Received search request:', { query, options });
        // 模拟MCP工具调用
        const results = await this.performSearch(query, options);
        
        await this.logger.debug('Search request completed successfully');
        res.json({ success: true, data: results });
      } catch (error) {
        await this.logger.error('Search request failed:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 状态端点
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'ready',
        version: '1.0.0',
        mockMode: true
      });
    });

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    // Serve frontend index.html for all other routes (SPA support)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'frontend', 'index.html'));
    });
  }

  private async performSearch(query: string, options?: any): Promise<any> {
    try {
      await this.logger.debug('Performing search for query:', query);
      // 尝试从模拟数据文件读取结果
      const dataPath = path.join(process.cwd(), 'data', 'mock', 'search-results.json');
      await this.logger.debug('Loading search results from:', dataPath);
      const data = await fs.readFile(dataPath, 'utf-8');
      const mockResults = JSON.parse(data);
      
      // 过滤结果以匹配查询
      const filteredResults = mockResults.results.filter((result: any) =>
        result.highlightedContent.toLowerCase().includes(query.toLowerCase())
      );
      
      await this.logger.debug('Search completed, found', filteredResults.length, 'results');
      return {
        results: filteredResults,
        total: filteredResults.length,
        query
      };
    } catch (error) {
      await this.logger.warn('Failed to load search results, using defaults:', error);
      // 如果无法读取文件，返回默认模拟结果
      return {
        results: [
          {
            id: 'mock_result_1',
            score: 0.95,
            snippet: {
              content: `// Mock result for: ${query}`,
              filePath: 'src/mock/file.js',
              language: 'javascript'
            },
            matchType: 'keyword'
          }
        ],
        total: 1,
        query
      };
    }
  }

  start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(`API Server running on port ${this.port}`);
      this.logger.info(`Frontend available at http://localhost:3011`);
    });
  }
}