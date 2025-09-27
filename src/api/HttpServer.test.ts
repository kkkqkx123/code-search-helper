import { Container, ContainerModule } from 'inversify';
import request from 'supertest';
import { HttpServer } from './HttpServer';
import { SnippetController } from '../controllers/SnippetController';
import { MonitoringController } from '../controllers/MonitoringController';
import { LoggerService } from '../core/LoggerService';
import { ConfigService } from '../config/ConfigService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { DIContainer } from '../core/DIContainer';
import { LazyServiceLoader } from '../core/LazyServiceLoader';
import { TYPES } from '../types';
import { Router, Request, Response } from 'express';

// Mock StaticAnalysisRoutes to avoid dependency issues
jest.mock('./routes/StaticAnalysisRoutes', () => {
  return {
    StaticAnalysisRoutes: jest.fn().mockImplementation(() => {
      return {
        getRouter: () => {
          const router = require('express').Router();
          // Add minimal routes for testing if needed
          router.get('/test', (req: Request, res: Response) => res.status(200).send('test'));
          return router;
        },
      };
    }),
  };
});

// Mock ProjectRoutes to avoid dependency issues
jest.mock('./routes/ProjectRoutes', () => {
  return {
    ProjectRoutes: jest.fn().mockImplementation(() => {
      return {
        getRouter: () => {
          const router = require('express').Router();
          // Add minimal routes for testing if needed
          router.get('/test', (req: Request, res: Response) => res.status(200).send('test'));
          return router;
        },
      };
    }),
  };
});

describe('HttpServer', () => {
  let container: Container;
  let httpServer: HttpServer;
  let mockSnippetController: jest.Mocked<SnippetController>;
  let mockMonitoringController: jest.Mocked<MonitoringController>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let app: any;

  beforeEach(async () => {
    // Reset the singleton container
    DIContainer.reset();

    // 初始化LazyServiceLoader
    const mockIndexService = {
      createIndex: jest.fn(),
      getStatus: jest.fn(),
      deleteIndex: jest.fn(),
      search: jest.fn()
    };
    
    const mockIndexCoordinator = {
      createIndex: jest.fn()
    };

    const mockLazyLoader = {
      loadVectorStorageService: jest.fn(),
      loadGraphPersistenceService: jest.fn(),
      loadQdrantService: jest.fn(),
      loadNebulaService: jest.fn(),
      loadHttpServer: jest.fn(),
      loadMCPServer: jest.fn(),
      loadIndexService: jest.fn().mockReturnValue(mockIndexService),
      loadIndexCoordinator: jest.fn().mockReturnValue(mockIndexCoordinator),
      setLogger: jest.fn(),
      recordServiceLoad: jest.fn(),
      isGroupLoaded: jest.fn().mockReturnValue(true),
      getServiceGroup: jest.fn(),
      getServiceDependencies: jest.fn().mockReturnValue([]),
      checkServiceDependencies: jest.fn().mockReturnValue(true),
      getLoadedGroups: jest.fn().mockReturnValue([]),
      getServiceLoadTimes: jest.fn().mockReturnValue(new Map()),
      getLoadedServices: jest.fn().mockReturnValue([]),
      isServiceLoaded: jest.fn().mockReturnValue(true),
    } as any;

    DIContainer.setLazyLoader(mockLazyLoader);

    // Create a new container for testing
    container = new Container();
    // Bind IndexService and IndexCoordinator mocks to container
    container.bind(TYPES.IndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.IndexCoordinator).toConstantValue(mockIndexCoordinator);
    // Create mocks
    mockSnippetController = {
      searchSnippets: jest.fn(),
      getSnippetById: jest.fn(),
      getSnippetProcessingStatus: jest.fn(),
      checkForDuplicates: jest.fn(),
      detectCrossReferences: jest.fn(),
      analyzeDependencies: jest.fn(),
      detectOverlaps: jest.fn(),
    } as any;

    mockMonitoringController = {
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getPerformanceReport: jest.fn(),
      getBottlenecks: jest.fn(),
      getCapacityPlan: jest.fn(),
      getDependencies: jest.fn(),
      getBenchmark: jest.fn(),
      getProjectStats: jest.fn(),
      getMetricsEndpoint: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    // Mocks for StaticAnalysisRoutes dependencies
    const mockStaticAnalysisCoordinator = {
      queueScanTask: jest.fn(),
      getTaskStatus: jest.fn(),
      getProjectScanHistory: jest.fn(),
      getSystemStatus: jest.fn(),
      cleanupOldData: jest.fn(),
    };

    const mockSemgrepScanService = {
      getAvailableRules: jest.fn(),
      validateRule: jest.fn(),
      addCustomRule: jest.fn(),
    };

    const mockSemgrepRuleAdapter = {
      createSecurityRuleTemplates: jest.fn(),
    };

    const mockStaticAnalysisService = {
      queueScanTask: jest.fn(),
      getTaskStatus: jest.fn(),
      getProjectScanHistory: jest.fn(),
      getSystemStatus: jest.fn(),
      cleanupOldData: jest.fn(),
    };

    const mockSemgrepIntegrationService = {
      getAvailableRules: jest.fn(),
      validateRule: jest.fn(),
      addCustomRule: jest.fn(),
    };

    const mockAnalysisCoordinatorService = {
      createSecurityRuleTemplates: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'port':
            return 3000;
          case 'host':
            return 'localhost';
          case 'nodeEnv':
            return 'test';
          default:
            return undefined;
        }
      }),
      getServerConfig: jest.fn().mockReturnValue({
        port: 3000,
        host: 'localhost',
        cors: {
          enabled: true,
          origins: ['http://localhost:3000'],
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 100,
        },
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.SnippetController).toConstantValue(mockSnippetController);
    container.bind(TYPES.MonitoringController).toConstantValue(mockMonitoringController);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    
    // Mock StaticAnalysisRoutes dependencies
    container.bind(TYPES.StaticAnalysisService).toConstantValue(mockStaticAnalysisCoordinator);
    container.bind(TYPES.SemgrepIntegrationService).toConstantValue(mockSemgrepScanService);
    container.bind(TYPES.AnalysisCoordinatorService).toConstantValue(mockSemgrepRuleAdapter);

    // Mock services for SearchRoutes
    const mockHybridSearchService = {
      search: jest.fn()
    };
    const mockSemanticSearchService = {
      // Add any methods if needed
    };
    const mockSearchCoordinator = {
      performSemanticSearch: jest.fn(),
      search: jest.fn(),
      getRealTimeSuggestions: jest.fn()
    };

    container.bind(TYPES.HybridSearchService).toConstantValue(mockHybridSearchService);
    container.bind(TYPES.SemanticSearchService).toConstantValue(mockSemanticSearchService);
    container.bind(TYPES.SearchCoordinator).toConstantValue(mockSearchCoordinator);

    // Mock services for GraphAnalysisRoutes
    const mockGraphService = {
      analyzeCodebase: jest.fn(),
      queryGraph: jest.fn(),
      findDependencies: jest.fn(),
      findCallGraph: jest.fn(),
      getProjectOverview: jest.fn(),
      findCircularDependencies: jest.fn(),
      getGraphMetrics: jest.fn(),
      findImpactedNodes: jest.fn()
    };
    const mockProjectLookupService = {
      getProjectPathByProjectId: jest.fn()
    };

    container.bind(TYPES.GraphService).toConstantValue(mockGraphService);
    container.bind(TYPES.ProjectLookupService).toConstantValue(mockProjectLookupService);

    // Mock services for FileSystemRoutes
    const mockFileSystemTraversal = {
      traverseDirectory: jest.fn()
    };
    const mockFileWatcherService = {
      startWatching: jest.fn(),
      stopWatching: jest.fn()
    };

    container.bind(TYPES.FileSystemTraversal).toConstantValue(mockFileSystemTraversal);
    container.bind(TYPES.FileWatcherService).toConstantValue(mockFileWatcherService);
    // LoggerService mock已经定义过了，不需要重复绑定

    // Mock services for CacheRoutes
    const mockCacheController = {
      getStats: jest.fn(),
      getHealth: jest.fn(),
      listCaches: jest.fn(),
      clearCache: jest.fn(),
      clearAllCaches: jest.fn(),
      getValue: jest.fn(),
      setValue: jest.fn(),
      deleteKey: jest.fn(),
      keyExists: jest.fn()
    };

    container.bind(TYPES.CacheController).toConstantValue(mockCacheController);

    // Mock services for ParserRoutes
    const mockParserController = {
      parseFile: jest.fn(),
      parseFiles: jest.fn(),
      extractFunctions: jest.fn(),
      extractClasses: jest.fn(),
      extractImports: jest.fn(),
      validateSyntax: jest.fn(),
      queryAST: jest.fn(),
      getASTSummary: jest.fn(),
      compareASTs: jest.fn(),
      searchInAST: jest.fn(),
      getLanguageStats: jest.fn(),
      getSupportedLanguages: jest.fn(),
      detectLanguage: jest.fn()
    };

    container.bind(TYPES.ParserController).toConstantValue(mockParserController);

    // Mock services for ProjectRoutes
    const mockProjectIdManager = {
      generateProjectId: jest.fn(),
      getProjectId: jest.fn(),
      getProjectPath: jest.fn(),
      getCollectionName: jest.fn(),
      getSpaceName: jest.fn(),
      saveMapping: jest.fn(),
      loadMapping: jest.fn(),
      listAllProjects: jest.fn(),
      hasProject: jest.fn(),
      removeProject: jest.fn()
    };

    // Extend the existing mockProjectLookupService with additional methods needed for ProjectRoutes
    (mockProjectLookupService as any).getProjectIdByCollection = jest.fn();
    (mockProjectLookupService as any).getProjectIdBySpace = jest.fn();
    (mockProjectLookupService as any).getProjectPathByCollection = jest.fn();
    (mockProjectLookupService as any).getProjectPathBySpace = jest.fn();

    container.bind(TYPES.ProjectIdManager).toConstantValue(mockProjectIdManager);
    // container.bind(TYPES.ProjectLookupService).toConstantValue(mockProjectLookupService);

    // Override the singleton instance with our mock container
    (DIContainer as any).instance = container;

    httpServer = new HttpServer(
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService
    );
    await httpServer.initialize(); // 初始化HttpServer实例
    app = httpServer.getApp();
  });

  afterEach(async () => {
    // Close the server if it was started
    if (httpServer) {
      try {
        await httpServer.close();
      } catch (error) {
        // Ignore errors when closing the server
      }
    }
    jest.clearAllMocks();
  });

  describe('Server Setup', () => {
    it('should initialize express app with middleware', () => {
      expect(app).toBeDefined();
    });

    it('should check for duplicates', async () => {
      const duplicateCheckData = {
        content: 'const x = 1;',
        projectId: 'project-123',
      };

      const duplicateResult = {
        success: true,
        data: {
          isDuplicate: false,
          contentHash: 'hash123',
        },
      };

      mockSnippetController.checkForDuplicates = jest.fn().mockResolvedValue(duplicateResult);

      const response = await request(app)
        .post('/api/v1/snippets/check-duplicates')
        .send(duplicateCheckData)
        .expect(200);

      expect(response.body).toEqual(duplicateResult);
      expect(mockSnippetController.checkForDuplicates).toHaveBeenCalledWith(
        duplicateCheckData.content,
        duplicateCheckData.projectId
      );
    });
  });

  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const healthData = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            qdrant: { status: 'healthy' },
            nebula: { status: 'healthy' },
          },
        },
      };

      mockMonitoringController.getHealthStatus.mockResolvedValue(healthData);

      const response = await request(app).get('/api/v1/monitoring/health').expect(200);

      expect(response.body).toEqual(healthData);
      expect(mockMonitoringController.getHealthStatus).toHaveBeenCalled();
    });

    it('should return health status with unhealthy services', async () => {
      const healthData = {
        success: true,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            qdrant: { status: 'unhealthy', error: 'Connection failed' },
            nebula: { status: 'healthy' },
          },
        },
      };

      mockMonitoringController.getHealthStatus.mockResolvedValue(healthData);

      const response = await request(app).get('/api/v1/monitoring/health').expect(200);
      
      // 验证返回的数据包含不健康的服务信息
      expect(response.body).toEqual(healthData);
    });
  });

  describe('Metrics Endpoints', () => {
    it('should return prometheus metrics', async () => {
      const metricsData = {
        success: true,
        data: `# HELP codebase_index_requests_total Total number of requests
# TYPE codebase_index_requests_total counter
codebase_index_requests_total{method="GET",route="/search"} 100`
      };

      mockMonitoringController.getMetrics.mockResolvedValue(metricsData);

      const response = await request(app).get('/api/v1/monitoring/metrics').expect(200);

      expect(response.body).toEqual(metricsData);
    });
  });

  describe('Search Endpoints', () => {
    it('should search code snippets', async () => {
      const searchResults = {
        success: true,
        data: {
          results: [
            {
              id: '1',
              score: 0.95,
              content:
                'function authenticate(user, password) { return bcrypt.compare(password, user.hash); }',
              metadata: {
                filePath: '/src/auth.ts',
                language: 'typescript',
                functionName: 'authenticate',
              },
            },
          ],
          totalCount: 1,
          searchTime: 45,
        }
      };

      mockSnippetController.searchSnippets.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/v1/snippets/search')
        .query({
          query: 'authentication function',
          limit: 10,
        })
        .expect(200);

      expect(response.body).toEqual(searchResults);
      expect(mockSnippetController.searchSnippets).toHaveBeenCalledWith('authentication function', {
        limit: 10,
      });
    });

    it('should validate search request parameters', async () => {
      await request(app)
        .get('/api/v1/snippets/search')
        .query({
          // Missing required query parameter
          limit: 10,
        })
        .expect(400);
    });

    it('should handle search errors gracefully', async () => {
      mockSnippetController.searchSnippets.mockRejectedValue(
        new Error('Search service unavailable')
      );

      await request(app)
        .get('/api/v1/snippets/search')
        .query({
          query: 'test query',
        })
        .expect(500);
    });
  });

  describe('Snippet Management Endpoints', () => {
    it('should get snippet by ID', async () => {
      const snippet = {
        success: true,
        data: {
          id: 'snippet-123',
          content: 'function test() { return true; }',
          language: 'javascript',
          filePath: '/src/test.js',
          functionName: 'test',
          embedding: [0.1, 0.2, 0.3],
          metadata: {
            size: 45,
            complexity: 1,
            dependencies: [],
          },
        }
      };

      mockSnippetController.getSnippetById.mockResolvedValue(snippet);

      const response = await request(app)
        .get('/api/v1/snippets/snippet-123')
        .query({ projectId: 'project-123' })
        .expect(200);

      expect(response.body).toEqual(snippet);
      expect(mockSnippetController.getSnippetById).toHaveBeenCalledWith('snippet-123', 'project-123');
    });

    it('should return 404 for non-existent snippet', async () => {
      mockSnippetController.getSnippetById.mockResolvedValue(null);

      await request(app)
        .get('/api/v1/snippets/non-existent')
        .query({ projectId: 'project-123' })
        .expect(404);
    });

    it('should return snippet processing status', async () => {
      const status = {
        success: true,
        data: {
          id: 'snippet-123',
          status: 'completed',
          progress: 100,
          processedAt: new Date().toISOString(),
        }
      };

      mockSnippetController.getSnippetProcessingStatus.mockResolvedValue(status);

      const response = await request(app)
        .get('/api/v1/snippets/status/project-123')
        .expect(200);

      expect(response.body).toEqual(status);
      expect(mockSnippetController.getSnippetProcessingStatus).toHaveBeenCalledWith('project-123');
    });

    it('should index new snippet', async () => {
      const newSnippet = {
        content: 'function hello() { console.log("Hello World"); }',
        language: 'javascript',
        filePath: '/src/hello.js',
        functionName: 'hello',
        projectId: 'project-123',
      };

      const response = await request(app)
        .post('/api/v1/snippets')
        .send(newSnippet)
        .expect(200);

      // 路由实现是硬编码的，返回固定响应
      expect(response.body).toEqual({
        id: 'snippet_456',
        success: true,
        message: 'Snippet indexed successfully',
      });
    });

    it('should update existing snippet', async () => {
      const updateData = {
        content: 'const x = 2;',
        language: 'javascript',
        projectId: 'project-123',
      };

      const response = await request(app)
        .put('/api/v1/snippets/snippet-123')
        .send(updateData)
        .expect(200);

      // 路由实现是硬编码的，返回固定响应
      expect(response.body).toEqual({
        id: 'snippet-123',
        success: true,
        message: 'Snippet updated successfully',
      });
    });

    it('should delete snippet', async () => {
      const response = await request(app).delete('/api/v1/snippets/snippet-123').expect(200);

      // 路由实现是硬编码的，返回固定响应
      expect(response.body).toEqual({
        id: 'snippet-123',
        success: true,
        message: 'Snippet deleted successfully',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      await request(app).get('/api/v1/unknown-endpoint').expect(404);
    });

    it('should handle malformed JSON requests', async () => {
      await request(app)
        .get('/api/v1/search')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should apply rate limiting', async () => {
      // Mock rate limit exceeded - 发送足够多的请求来触发速率限制
      const requests = Array.from({ length: 1005 }, (_, i) => request(app).get('/api/v1/monitoring/health'));

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter((r: any) => r.status === 429);

      // 由于开发环境限制放宽到1000，我们期望至少有一些429响应
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000); // 增加超时时间
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/api/v1/snippets/search')
        .set('Origin', 'http://localhost:3011')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    });

    it('should not set CORS headers for unauthorized origins', async () => {
      // Mock the search endpoint to return a proper response
      const searchResults = {
        success: true,
        data: {
          results: [],
          totalCount: 0,
          searchTime: 0,
        }
      };

      mockSnippetController.searchSnippets.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/v1/snippets/search')
        .set('Origin', 'http://malicious-site.com')
        .query({ query: 'test' })
        .expect(200); // 请求仍然成功，但不会设置CORS头

      // 验证没有设置CORS头
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      const healthData = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            qdrant: { status: 'healthy' },
            nebula: { status: 'healthy' },
          },
        }
      };

      mockMonitoringController.getHealthStatus.mockResolvedValue(healthData);

      await request(app).get('/api/v1/monitoring/health').expect(200);

      // 由于logger可能在middleware中被调用，我们只需要验证它被调用了
      expect(mockLoggerService.info).toHaveBeenCalled();
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server on specified port', async () => {
      // Create a new HttpServer instance for this test to avoid port conflicts
      const testServer = new HttpServer(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      await testServer.initialize();
      
      const server = await testServer.start();

      expect(server).toBeDefined();
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'HTTP server started',
        expect.objectContaining({
          port: 3000,
          host: 'localhost',
        })
      );

      // Close the server after the test
      await testServer.close();
    });

    it('should gracefully stop server', async () => {
      // Use a different port to avoid conflicts
      const originalPort = process.env.PORT;
      process.env.PORT = '3002';
      
      const testServer = new HttpServer(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      await testServer.initialize(); // Initialize first
      const server = await testServer.start();
      expect(server).toBeDefined();
      
      // Close the server to test graceful shutdown
      await testServer.close();

      // Restore original port
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }

      // If we reach this point without error, the server closed gracefully
      expect(true).toBe(true);
    }, 30000); // 增加超时时间

    it('should handle server start errors', async () => {
      // Create a new HttpServer instance for this test
      const testServer = new HttpServer(
        mockLoggerService,
        mockErrorHandlerService,
        mockConfigService
      );
      await testServer.initialize(); // Initialize first
      
      // Mock server start failure - 避免循环引用，使用外部变量存储error handler
      let errorHandler: Function | null = null;
      const mockOn = jest.fn().mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
          // 立即触发error事件
          setTimeout(() => {
            if (errorHandler) {
              errorHandler(new Error('Server start failed'));
            }
          }, 0);
        }
      });
      
      const mockListen = jest.fn().mockImplementation((port, callback) => {
        // 返回一个server对象，不引用自身
        return {
          on: mockOn,
          close: jest.fn()
        };
      });
      
      const testApp = testServer.getApp();
      const originalListen = testApp.listen;
      testApp.listen = mockListen;

      await expect(testServer.start()).rejects.toThrow('Server start failed');
      
      testApp.listen = originalListen;
    }, 30000); // 增加超时时间
  });
});
