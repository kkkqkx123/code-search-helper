import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger.js';
import { ProjectRoutes } from './routes/ProjectRoutes';
import { IndexingRoutes } from './routes/IndexingRoutes';
import { FileSearchRoutes } from './routes/FileSearchRoutes';
import { GraphRoutes } from './routes/GraphRoutes';
import { GraphQueryRoutes } from './routes/GraphQueryRoutes';
import { GraphAnalysisRoutes } from './routes/GraphAnalysisRoutes';
import { HotReloadRoutes } from './routes/HotReloadRoutes';
import { HotReloadConfigService } from '../service/filesystem/HotReloadConfigService';
import { GraphStatsRoutes } from './routes/GraphStatsRoutes';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { ProjectLookupService } from '../database/ProjectLookupService';
import { VectorIndexService } from '../service/index/VectorIndexService.js';
import { HybridIndexService } from '../service/index/HybridIndexService';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { QdrantService } from '../database/qdrant/QdrantService.js';
import { ProjectStateManager } from '../service/project/ProjectStateManager';
import { diContainer } from '../core/DIContainer';
import { TYPES } from '../types';
import { NebulaClient } from '../database/nebula/client/NebulaClient';
import { QdrantCollectionViewRoutes } from './routes/QdrantCollectionViewRoutes';
import { createProjectMappingRouter } from './routes/ProjectMappingRoutes';

export class ApiServer {
  private app: express.Application;
  private port: number;
  private logger: Logger;
  private projectIdManager: ProjectIdManager;
  private projectLookupService: ProjectLookupService;
  private projectRoutes: ProjectRoutes;
  private indexingRoutes: IndexingRoutes;
  private fileSearchRoutes: FileSearchRoutes;
  private graphRoutes: GraphRoutes;
  private graphQueryRoutes: GraphQueryRoutes;
  private graphAnalysisRoutes: GraphAnalysisRoutes;
  private hotReloadRoutes: HotReloadRoutes;
  private graphStatsRoutes: GraphStatsRoutes;
  private hybridIndexService: HybridIndexService;
  private embedderFactory: EmbedderFactory;
  private qdrantService: QdrantService;
  private nebulaClient: NebulaClient;
  private projectStateManager: ProjectStateManager;
  private qdrantCollectionViewRoutes: QdrantCollectionViewRoutes;

  constructor(logger: Logger, hybridIndexService: HybridIndexService | VectorIndexService, embedderFactory: EmbedderFactory, qdrantService: QdrantService, port: number = 3010) {
    this.logger = logger;
    // Type guard: ensure hybridIndexService is HybridIndexService
    if (!this.isHybridIndexService(hybridIndexService)) {
      throw new Error('hybridIndexService must be an instance of HybridIndexService');
    }
    this.hybridIndexService = hybridIndexService;
    this.embedderFactory = embedderFactory;
    this.qdrantService = qdrantService;
    // 从依赖注入容器获取Nebula客户端(包含服务功能)
    this.nebulaClient = diContainer.get<NebulaClient>(TYPES.NebulaClient);
    this.app = express();
    this.port = port;

    // Initialize project management services
    this.projectIdManager = new ProjectIdManager(
      diContainer.get(TYPES.ConfigService),
      diContainer.get(TYPES.QdrantConfigService),
      diContainer.get(TYPES.NebulaConfigService),
      diContainer.get(TYPES.LoggerService),
      diContainer.get(TYPES.ErrorHandlerService),
      diContainer.get(TYPES.SqliteProjectManager)
    );
    // 创建一个简单的错误处理器实例
    const errorHandler = new (require('../utils/ErrorHandlerService').ErrorHandlerService)();
    this.projectLookupService = new ProjectLookupService(this.projectIdManager, errorHandler, this.hybridIndexService);
    // 从依赖注入容器获取ProjectStateManager和混合索引服务
    this.projectStateManager = diContainer.get<ProjectStateManager>(TYPES.ProjectStateManager);

    // 初始化热更新配置服务
    const hotReloadConfigService = diContainer.get<HotReloadConfigService>(TYPES.HotReloadConfigService);
    // 初始化统一映射服务
    const unifiedMappingService = diContainer.get<any>(TYPES.UnifiedMappingService);

    this.projectRoutes = new ProjectRoutes(this.projectIdManager, this.projectLookupService, logger, this.projectStateManager, this.hybridIndexService, hotReloadConfigService, unifiedMappingService);
    this.indexingRoutes = new IndexingRoutes(this.hybridIndexService, this.projectIdManager, this.embedderFactory, logger, this.projectStateManager);

    // 从依赖注入容器获取文件搜索服务
    const fileSearchService = diContainer.get<any>(TYPES.FileSearchService);
    // 创建一个LoggerService实例包装现有的Logger
    const loggerService = new (require('../utils/LoggerService').LoggerService)(diContainer.get(TYPES.ConfigService));
    this.fileSearchRoutes = new FileSearchRoutes(fileSearchService, loggerService);

    // 从依赖注入容器获取Graph服务
    const graphSearchService = diContainer.get<any>(TYPES.GraphSearchServiceNew);
    const graphService = diContainer.get<any>(TYPES.GraphService);
    const graphCacheService = diContainer.get<any>(TYPES.GraphCacheService);
    const graphPerformanceMonitor = diContainer.get<any>(TYPES.GraphPerformanceMonitor);
    const graphQueryValidator = diContainer.get<any>(TYPES.GraphQueryValidator);
    const graphLoggerService = new (require('../utils/LoggerService').LoggerService)(diContainer.get(TYPES.ConfigService));

    this.graphRoutes = new GraphRoutes(graphService, this.projectLookupService, graphQueryValidator, graphPerformanceMonitor, graphLoggerService);
    this.graphQueryRoutes = new GraphQueryRoutes(graphService, graphQueryValidator, graphPerformanceMonitor, graphLoggerService);
    this.graphAnalysisRoutes = new GraphAnalysisRoutes(graphService, graphSearchService, graphPerformanceMonitor, graphLoggerService);
    // 初始化热更新路由
    this.hotReloadRoutes = new HotReloadRoutes(hotReloadConfigService, logger);
    this.graphStatsRoutes = new GraphStatsRoutes(graphService, graphCacheService, graphPerformanceMonitor, graphLoggerService);
    // 初始化Qdrant Collection视图路由
    this.qdrantCollectionViewRoutes = new QdrantCollectionViewRoutes();

    this.setupMiddleware();
    this.setupRoutes(unifiedMappingService);
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

  private setupRoutes(unifiedMappingService: any): void {
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

    // Nebula数据库状态检查端点
    this.app.get('/api/v1/nebula/status', async (req, res) => {
      try {
        const isConnected = this.nebulaClient.isConnected();
        const stats = isConnected ? await this.nebulaClient.getDatabaseStats() : null;

        res.json({
          connected: isConnected,
          stats: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Nebula数据库连接测试端点
    this.app.post('/api/v1/nebula/test-connection', async (req, res) => {
      try {
        // 尝试连接到Nebula数据库
        const connected = await this.nebulaClient.initialize();

        if (connected) {
          const stats = await this.nebulaClient.getDatabaseStats();
          res.json({
            success: true,
            message: 'Successfully connected to Nebula database',
            connected: true,
            stats: stats,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to connect to Nebula database',
            connected: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error connecting to Nebula database',
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Nebula数据库重连测试端点
    this.app.post('/api/v1/nebula/test-reconnect', async (req, res) => {
      try {
        // 尝试重新连接到Nebula数据库
        const reconnected = await this.nebulaClient.reconnect();

        if (reconnected) {
          const stats = await this.nebulaClient.getDatabaseStats();
          res.json({
            success: true,
            message: 'Successfully reconnected to Nebula database',
            connected: true,
            stats: stats,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to reconnect to Nebula database',
            connected: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error reconnecting to Nebula database',
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // 项目路由
    this.app.use('/api/v1/projects', this.projectRoutes.getRouter());

    // 索引路由
    this.app.use('/api/v1/indexing', this.indexingRoutes.getRouter());

    // 文件搜索路由
    this.app.use('/api/v1/filesearch', this.fileSearchRoutes.getRouter());

    // 图路由
    this.app.use('/api/v1/graph', this.graphRoutes.getRouter());
    this.app.use('/api/v1/graph', this.graphQueryRoutes.getRouter());
    this.app.use('/api/v1/graph', this.graphAnalysisRoutes.getRouter());
    // 热更新路由
    this.app.use('/api/v1/hot-reload', this.hotReloadRoutes.getRouter());
    this.app.use('/api/v1/graph', this.graphStatsRoutes.getRouter());
    // Qdrant Collection视图路由
    this.app.use('/api/v1/qdrant', this.qdrantCollectionViewRoutes.getRouter());
    // 项目映射路由
    this.app.use('/api/v1/project-mappings', createProjectMappingRouter(unifiedMappingService));

    // 404处理
    this.app.use((req, res) => {
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
        const searchResults = JSON.parse(searchData);

        await this.logger.debug('Loading code snippets from:', codeSnippetsPath);
        const snippetsData = await fs.readFile(codeSnippetsPath, 'utf-8');
        const codeSnippets = JSON.parse(snippetsData);

        // 创建snippetId到snippet的映射
        const snippetMap = new Map();
        codeSnippets.snippets.forEach((snippet: any) => {
          snippetMap.set(snippet.id, snippet);
        });

        // 过滤结果以匹配查询并转换为前端期望的格式
        let filteredResults = searchResults.results
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

        // 应用匹配度阈值过滤
        if (options?.minScore !== undefined && options.minScore >= 0 && options.minScore <= 1) {
          filteredResults = filteredResults.filter((result: any) =>
            result.score >= options.minScore
          );
          await this.logger.debug(`Applied minScore filter: ${options.minScore}, remaining results: ${filteredResults.length}`);
        }

        // 应用最大数量限制
        if (options?.maxResults !== undefined && options.maxResults > 0) {
          filteredResults = filteredResults.slice(0, options.maxResults);
          await this.logger.debug(`Applied maxResults limit: ${options.maxResults}, final results: ${filteredResults.length}`);
        }

        await this.logger.debug('Mock search completed, found', filteredResults.length, 'results');
        return {
          results: filteredResults,
          total: filteredResults.length,
          query,
          filters: {
            maxResults: options?.maxResults,
            minScore: options?.minScore
          }
        };
      } else {
        // 使用真实数据库查询模式
        console.log('=== DEBUG: Starting performSearch ===');
        console.log('Query:', query);
        console.log('Options:', options);

        await this.logger.debug('Performing search in real mode for query:', query);
        await this.logger.debug('Search options received:', options);

        let projectId = options?.projectId;
        console.log('Initial projectId from options:', projectId);
        await this.logger.debug('Initial projectId from options:', projectId);

        // 如果没有提供projectId，尝试获取最新的项目
        if (!projectId) {
          console.log('No projectId provided, trying to get the latest project');
          await this.logger.debug('No projectId provided, trying to get the latest project');
          try {
            // 获取项目列表
            console.log('=== DEBUG: About to call qdrantService.initialize() ===');
            await this.qdrantService.initialize();

            console.log('=== DEBUG: About to call qdrantService.listProjects() ===');

            // 直接调用listProjects方法
            const projects = await this.qdrantService.listProjects();
            console.log('Available projects from qdrantService.listProjects():', projects);
            console.log('Number of projects found:', projects?.length || 0);
            if (projects && projects.length > 0) {
              console.log('First project details:', projects[0]);
              console.log('First project ID:', projects[0].id);
              console.log('First project path:', projects[0].path);
            }
            await this.logger.debug('Available projects:', projects);
            if (projects && projects.length > 0) {
              // 使用最新的项目（按更新时间排序的第一个）
              projectId = projects[0].id;
              console.log('Using latest project:', projectId);
              await this.logger.debug(`Using latest project: ${projectId}`);
            } else {
              // 如果没有已索引的项目，使用默认项目
              projectId = 'default-project';
              console.log('No indexed projects found, using default project');
              await this.logger.debug('No indexed projects found, using default project');
            }
          } catch (listError) {
            console.log('Failed to list projects, error:', listError);
            await this.logger.error('Failed to list projects, using default:', listError);
            projectId = 'default-project';
          }
        }

        console.log('Final projectId for search:', projectId);
        await this.logger.debug('Final projectId for search:', projectId);

        // 获取项目路径
        let projectPath = projectId;
        if (projectId !== 'default-project') {
          // 如果不是默认项目，尝试获取项目路径
          const foundProjectPath = await this.qdrantService.getProjectPath(projectId);
          if (foundProjectPath) {
            projectPath = foundProjectPath;
            console.log('Found project path for projectId:', projectId, '->', projectPath);
          } else {
            console.log('Could not find project path for projectId:', projectId, ', using projectId as path');
          }
        }

        const limit = options?.maxResults || options?.limit || 10; // 优先使用maxResults，回退到limit，默认10个结果

        // 使用嵌入器将查询文本转换为向量
        const embedder = await this.embedderFactory.getEmbedder();
        const embeddingResult = await embedder.embed({ text: query });
        const queryVector = Array.isArray(embeddingResult) ? embeddingResult[0].vector : embeddingResult.vector;

        // 构建搜索参数，包含分数阈值
        const searchParams: any = { limit };
        if (options?.minScore !== undefined && options.minScore >= 0 && options.minScore <= 1) {
          searchParams.scoreThreshold = options.minScore;
          await this.logger.debug(`Applying minScore filter: ${options.minScore}`);
        }

        const searchResults = await this.qdrantService.searchVectorsForProject(projectPath, queryVector, searchParams);

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
          projectId,
          filters: {
            maxResults: options?.maxResults,
            minScore: options?.minScore
          }
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

  private isHybridIndexService(service: HybridIndexService | VectorIndexService): service is HybridIndexService {
    return 'indexService' in service && 'graphIndexService' in service;
  }

  start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(`API Server running on port ${this.port}`);
      this.logger.info(`API endpoints available at http://localhost:${this.port}/api`);
    });
  }
}