import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { ProjectRoutes } from './routes/ProjectRoutes';
import { IndexingRoutes } from './routes/IndexingRoutes';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { ProjectLookupService } from '../database/ProjectLookupService';
import { IndexSyncService } from '../service/index/IndexSyncService';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { QdrantService } from '../database/QdrantService';
import { ProjectStateManager } from '../service/project/ProjectStateManager';
import { diContainer } from '../core/DIContainer';
import { TYPES } from '../types';

export class ApiServer {
  private app: express.Application;
  private port: number;
  private logger: Logger;
  private projectIdManager: ProjectIdManager;
  private projectLookupService: ProjectLookupService;
  private projectRoutes: ProjectRoutes;
  private indexingRoutes: IndexingRoutes;
  private indexSyncService: IndexSyncService;
  private embedderFactory: EmbedderFactory;
  private qdrantService: QdrantService;
  private projectStateManager: ProjectStateManager;

  constructor(logger: Logger, indexSyncService: IndexSyncService, embedderFactory: EmbedderFactory, qdrantService: QdrantService, port: number = 3010) {
    this.logger = logger;
    this.indexSyncService = indexSyncService;
    this.embedderFactory = embedderFactory;
    this.qdrantService = qdrantService;
    this.app = express();
    this.port = port;

    // Initialize project management services
    this.projectIdManager = new ProjectIdManager(diContainer.get(TYPES.ConfigService));
    // 创建一个简单的错误处理器实例
    const errorHandler = new (require('../utils/ErrorHandlerService').ErrorHandlerService)();
    this.projectLookupService = new ProjectLookupService(this.projectIdManager, errorHandler, this.indexSyncService);
    // 从依赖注入容器获取ProjectStateManager
    this.projectStateManager = diContainer.get<ProjectStateManager>(TYPES.ProjectStateManager);
    this.projectRoutes = new ProjectRoutes(this.projectIdManager, this.projectLookupService, logger, this.projectStateManager, this.indexSyncService);
    this.indexingRoutes = new IndexingRoutes(this.indexSyncService, this.projectIdManager, this.embedderFactory, logger, this.projectStateManager);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // 配置CORS以允许前端从3011端口访问3010端口的API
    this.app.use(cors({
      origin: ['http://localhost:3011'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    this.app.use(express.json());
    
    // 添加请求日志中间件
    this.app.use((req, res, next) => {
      // 存储原始响应方法
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);
      const originalEnd = res.end.bind(res);

      // 存储请求开始时间
      const startTime = Date.now();

      // 重写响应方法以捕获响应数据
      res.send = (body: any): any => {
        // 处理Buffer数据，转换为字符串
        if (Buffer.isBuffer(body)) {
          res.locals.responseBody = body.toString('utf8');
        } else {
          res.locals.responseBody = body;
        }
        return originalSend(body);
      };

      res.json = (body: any): any => {
        res.locals.responseBody = body;
        return originalJson(body);
      };

      res.end = (body?: any): any => {
        if (body) {
          // 处理Buffer数据，转换为字符串
          if (Buffer.isBuffer(body)) {
            res.locals.responseBody = body.toString('utf8');
          } else {
            res.locals.responseBody = body;
          }
        }
        return originalEnd(body);
      };

      // 请求完成时记录响应
      res.on('finish', () => {
        try {
          const responseTime = Date.now() - startTime;
          const logData: any = {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            origin: req.get('Origin'),
            body: req.body
          };

          // 如果状态码表示错误，添加错误信息
          if (res.statusCode >= 400) {
            logData.error = res.statusMessage || 'Unknown error';
            if (res.locals.responseBody && typeof res.locals.responseBody === 'object') {
              logData.responseError = res.locals.responseBody.error || res.locals.responseBody.message;
            }
          }

          // 为调试添加响应体（可选，生产环境可以移除）
          if (process.env.NODE_ENV === 'development' && res.locals.responseBody) {
            logData.responseBody = res.locals.responseBody;
          }

          this.logger.info(`API ${req.method} ${req.path} - ${res.statusCode}`, logData);
        } catch (error) {
          console.error('Error in response logging middleware:', error);
        }
      });

      next();
    });
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
        mockMode: process.env.SEARCH_MOCK_MODE === 'true'
      });
    });

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
    // 项目路由
    this.app.use('/api/v1/projects', this.projectRoutes.getRouter());
    
    // 索引路由
    this.app.use('/api/v1/indexing', this.indexingRoutes.getRouter());

    // 404处理
    this.app.get('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
      });
    });
  }

  private async performSearch(query: string, options?: any): Promise<any> {
    try {
      const useMockMode = process.env.SEARCH_MOCK_MODE === 'true';
      
      if (useMockMode) {
        // 使用mock数据模式
        await this.logger.debug('Performing search in mock mode for query:', query);
        
        // 读取搜索结果和代码片段数据
        const searchResultsPath = path.join(process.cwd(), 'data', 'mock', 'search-results.json');
        const codeSnippetsPath = path.join(process.cwd(), 'data', 'mock', 'code-snippets.json');
        
        await this.logger.debug('Loading search results from:', searchResultsPath);
        const searchData = await fs.readFile(searchResultsPath, 'utf-8');
        const mockResults = JSON.parse(searchData);
        
        await this.logger.debug('Loading code snippets from:', codeSnippetsPath);
        const snippetsData = await fs.readFile(codeSnippetsPath, 'utf-8');
        const codeSnippets = JSON.parse(snippetsData);
        
        // 创建snippetId到snippet的映射
        const snippetMap = new Map();
        codeSnippets.snippets.forEach((snippet: any) => {
          snippetMap.set(snippet.id, snippet);
        });
        
        // 过滤结果以匹配查询并转换为前端期望的格式
        const filteredResults = mockResults.results
          .filter((result: any) =>
            result.highlightedContent.toLowerCase().includes(query.toLowerCase())
          )
          .map((result: any) => {
            const snippet = snippetMap.get(result.snippetId);
            return {
              id: result.id,
              score: result.score,
              snippet: {
                content: snippet ? snippet.content : `// Content not found for snippet: ${result.snippetId}`,
                filePath: snippet ? snippet.filePath : 'unknown/file.js',
                language: snippet ? snippet.language : 'javascript'
              },
              matchType: result.matchType
            };
          });
        
        await this.logger.debug('Mock search completed, found', filteredResults.length, 'results');
        return {
          results: filteredResults,
          total: filteredResults.length,
          query
        };
      } else {
        // 使用真实数据库查询模式
        await this.logger.debug('Performing search in real mode for query:', query);
        const projectId = options?.projectId || 'default-project'; // 使用选项中的项目ID，或默认项目ID
        const limit = options?.limit || 10; // 默认限制10个结果

        // 使用嵌入器将查询文本转换为向量
        const embedder = await this.embedderFactory.getEmbedder();
        const embeddingResult = await embedder.embed({ text: query });
        const queryVector = Array.isArray(embeddingResult) ? embeddingResult[0].vector : embeddingResult.vector;
        const searchResults = await this.qdrantService.searchVectorsForProject(projectId, queryVector, { limit });

        // 将Qdrant结果转换为前端期望的格式
        const formattedResults = searchResults.map((result: any) => {
          return {
            id: result.id,
            score: result.score,
            snippet: {
              content: result.payload?.content || '',
              filePath: result.payload?.filePath || '',
              language: result.payload?.language || 'javascript'
            },
            matchType: 'semantic' // 真实搜索使用语义匹配
          };
        });

        await this.logger.debug('Real search completed, found', formattedResults.length, 'results');
        return {
          results: formattedResults,
          total: formattedResults.length,
          query,
          projectId
        };
      }
    } catch (error) {
      await this.logger.error('Search request failed:', error);
      const useMockMode = process.env.SEARCH_MOCK_MODE === 'true';
      
      if (useMockMode) {
        // 如果是mock模式且出错，返回默认模拟结果
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
      } else {
        // 如果是真实模式且出错，返回错误信息
        return {
          results: [],
          total: 0,
          query,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  }

  start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(`API Server running on port ${this.port}`);
      this.logger.info(`API endpoints available at http://localhost:${this.port}/api`);
    });
  }
}