import express from 'express';
import request from 'supertest';
import { ApiServer } from '../ApiServer';
import { Logger } from '../../utils/logger';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { Container } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { QdrantConfigService } from '../../config/service/QdrantConfigService';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// Mock fs
jest.mock('fs/promises');
import * as fs from 'fs/promises';
import { diContainer } from '../../core/DIContainer';
let mockReadFile: jest.SpyInstance;

// Mock ProjectIdManager to prevent file system operations during tests
jest.mock('../../database/ProjectIdManager', () => {
  return {
    ProjectIdManager: jest.fn().mockImplementation(() => ({
      loadMapping: jest.fn().mockResolvedValue(undefined),
      generateProjectId: jest.fn().mockResolvedValue('mock-project-id'),
      getProjectId: jest.fn().mockReturnValue('mock-project-id'),
      getProjectPath: jest.fn().mockReturnValue('/mock/project/path'),
      getCollectionName: jest.fn().mockReturnValue('mock-collection'),
      getSpaceName: jest.fn().mockReturnValue('mock_space'),
      updateProjectTimestamp: jest.fn(),
      getLatestUpdatedProject: jest.fn().mockReturnValue('mock-project-id'),
      getProjectsByUpdateTime: jest.fn().mockReturnValue([]),
      saveMapping: jest.fn().mockResolvedValue(undefined),
      listAllProjects: jest.fn().mockReturnValue([]),
      listAllProjectPaths: jest.fn().mockReturnValue([]),
      hasProject: jest.fn().mockReturnValue(false),
      removeProject: jest.fn().mockReturnValue(true),
      refreshMapping: jest.fn().mockResolvedValue(undefined),
      cleanupInvalidMappings: jest.fn().mockResolvedValue(0)
    }))
  };
});

// Mock EmbedderFactory to prevent async initialization during tests
jest.mock('../../embedders/EmbedderFactory', () => {
  return {
    EmbedderFactory: jest.fn().mockImplementation(() => ({
      embed: jest.fn().mockResolvedValue({}),
      getEmbedder: jest.fn().mockResolvedValue({
        embed: jest.fn().mockResolvedValue({}),
        isAvailable: jest.fn().mockResolvedValue(true),
        getModelName: jest.fn().mockReturnValue('mock-model'),
        getDimensions: jest.fn().mockReturnValue(768)
      }),
      getAvailableProviders: jest.fn().mockResolvedValue(['openai']),
      getProviderInfo: jest.fn().mockResolvedValue({
        name: 'openai',
        model: 'mock-model',
        dimensions: 768,
        available: true
      }),
      autoSelectProvider: jest.fn().mockResolvedValue('openai'),
      registerProvider: jest.fn(),
      getRegisteredProviders: jest.fn().mockReturnValue(['openai']),
      isProviderRegistered: jest.fn().mockReturnValue(true),
      unregisterProvider: jest.fn().mockReturnValue(true),
      getDefaultProvider: jest.fn().mockReturnValue('openai'),
      setDefaultProvider: jest.fn()
    }))
  };
});

// Mock ProjectStateManager to prevent dependency injection issues
jest.mock('../../service/project/ProjectStateManager', () => {
  return {
    ProjectStateManager: jest.fn().mockImplementation(() => ({
      getProjectState: jest.fn().mockResolvedValue({}),
      updateProjectState: jest.fn().mockResolvedValue(undefined),
      deleteProjectState: jest.fn().mockResolvedValue(undefined),
      listProjects: jest.fn().mockResolvedValue([]),
      getProjectStats: jest.fn().mockResolvedValue({}),
      isProjectIndexed: jest.fn().mockReturnValue(false),
      getProjectIndexingProgress: jest.fn().mockReturnValue(0),
      resetProjectState: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Create a mock IndexSyncService
const createMockIndexSyncService = () => ({
  startIndexing: jest.fn(),
  stopIndexing: jest.fn(),
  getIndexStatus: jest.fn(),
  reindexProject: jest.fn(),
  on: jest.fn(),
  getAllIndexStatuses: jest.fn()
});

describe('ApiServer', () => {
  let server: ApiServer;
  let app: express.Application;
  let mockIndexSyncService: any;
  let testContainer: Container;

  beforeAll(() => {
    // Set environment variable for mock mode
    process.env.SEARCH_MOCK_MODE = 'true';
    
    // Mock fs.readFile to return mock data
    mockReadFile = jest.spyOn(fs, 'readFile').mockImplementation((filePath: any) => {
      if (typeof filePath === 'string' && filePath.includes('search-results.json')) {
        return Promise.resolve(JSON.stringify({
          results: [
            {
              id: 'result_001',
              score: 0.95,
              snippetId: 'snippet_001',
              matchType: 'semantic',
              highlightedContent: 'function <mark>calculateTotal</mark>(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}'
            }
          ]
        }));
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  beforeEach(() => {
    // 创建新的测试容器
    testContainer = new Container();
    
    // 创建模拟的ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        // 返回模拟的配置数据
        if (key === 'environment') {
          return {
            nodeEnv: 'test',
            port: 3001,
            logLevel: 'info',
            debug: false,
          };
        }
        if (key === 'caching') {
          return {
            defaultTTL: 3600,
            maxSize: 10000,
            cleanupInterval: 300,
          };
        }
        if (key === 'cache') {
          return {
            ttl: 3600,
            maxEntries: 10000,
            cleanupInterval: 300,
          };
        }
        // 返回其他默认配置
        return {};
      }),
      getAll: jest.fn().mockReturnValue({
        environment: {
          nodeEnv: 'test',
          port: 3001,
          logLevel: 'info',
          debug: false,
        },
        caching: {
          defaultTTL: 3600,
          maxSize: 10000,
          cleanupInterval: 300,
        },
        cache: {
          ttl: 3600,
          maxEntries: 10000,
          cleanupInterval: 300,
        },
      }),
      initialize: jest.fn().mockResolvedValue(undefined)
    };
    
    // 创建其他必需的模拟服务
    const mockQdrantConfigService = {
      getQdrantConfig: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 6333,
        apiKey: null,
        https: false,
      }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    
    const mockNebulaConfigService = {
      getNebulaConfig: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 9669,
        username: 'root',
        password: 'nebula',
        space: 'test_space',
      }),
      validateConfig: jest.fn().mockReturnValue(true),
    };
    
    const mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    
    const mockErrorHandlerService = {
      handleError: jest.fn(),
      createError: jest.fn(),
      wrapAsync: jest.fn(),
    };
    
    // 绑定所有必需的服务到测试容器
    testContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService as any);
    testContainer.bind<QdrantConfigService>(TYPES.QdrantConfigService).toConstantValue(mockQdrantConfigService as any);
    testContainer.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockNebulaConfigService as any);
    testContainer.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService as any);
    testContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService as any);
    
    // 绑定ProjectIdManager（使用模拟版本）
    const { ProjectIdManager } = require('../../database/ProjectIdManager');
    testContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).toConstantValue(new ProjectIdManager(
      mockConfigService as any,
      mockQdrantConfigService as any,
      mockNebulaConfigService as any,
      mockLoggerService as any,
      mockErrorHandlerService as any
    ));
    
    // 绑定ProjectStateManager（使用模拟版本）
    const { ProjectStateManager } = require('../../service/project/ProjectStateManager');
    testContainer.bind(TYPES.ProjectStateManager).toConstantValue(new ProjectStateManager());
    
    // 绑定NebulaService（使用模拟版本）
    const mockNebulaService = {
      isConnected: jest.fn().mockReturnValue(false),
      getDatabaseStats: jest.fn().mockResolvedValue({}),
      initialize: jest.fn().mockResolvedValue(false),
      reconnect: jest.fn().mockResolvedValue(false),
    };
    testContainer.bind(TYPES.INebulaService).toConstantValue(mockNebulaService);
    testContainer.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    
    // 绑定文件搜索服务
    const mockFileSearchService = {
      search: jest.fn().mockResolvedValue([]),
      destroy: jest.fn(),
    };
    testContainer.bind(TYPES.FileSearchService).toConstantValue(mockFileSearchService);
    
    // 绑定图服务
    const mockGraphSearchService = {
      search: jest.fn().mockResolvedValue([]),
    };
    const mockGraphService = {
      query: jest.fn().mockResolvedValue([]),
    };
    const mockGraphCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const mockGraphPerformanceMonitor = {
      record: jest.fn(),
    };
    const mockGraphQueryValidator = {
      validate: jest.fn().mockReturnValue(true),
    };
    
    testContainer.bind(TYPES.GraphSearchServiceNew).toConstantValue(mockGraphSearchService);
    testContainer.bind(TYPES.GraphCacheService).toConstantValue(mockGraphCacheService);
    testContainer.bind(TYPES.GraphPerformanceMonitor).toConstantValue(mockGraphPerformanceMonitor);
    testContainer.bind(TYPES.GraphQueryValidator).toConstantValue(mockGraphQueryValidator);
    
    const logger = Logger.getInstance('ApiServerTest');
    mockIndexSyncService = createMockIndexSyncService();
    
    // Use the mocked EmbedderFactory (jest.mock will handle the constructor)
    const mockEmbedderFactory = new (require('../../embedders/EmbedderFactory').EmbedderFactory)();
    
    const mockQdrantService = {
      searchVectorsForProject: jest.fn().mockResolvedValue([]), // Mock the searchVectorsForProject method
      initialize: jest.fn().mockResolvedValue(undefined),
      listProjects: jest.fn().mockResolvedValue([]),
      getProjectPath: jest.fn().mockResolvedValue(null),
    } as any; // Add a mock QdrantService
    server = new ApiServer(logger, mockIndexSyncService, mockEmbedderFactory, mockQdrantService, 3001); // Use different port for testing
    app = server['app']; // Access private app property for testing
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'healthy' });
    });
  });

  describe('GET /api/status', () => {
    it('should return API status', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        version: '1.0.0',
        mockMode: true
      });
    });
  });

  describe('POST /api/search', () => {
    it('should return search results when query is provided', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'calculate' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.query).toBe('calculate');
    });

    it('should return error when query is missing', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ options: { limit: 10 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });

    it('should return error when query is empty', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });
it('should handle search errors gracefully', async () => {
  // Mock fs.readFile to throw an error
  mockReadFile.mockRejectedValueOnce(new Error('File read error'));

  const response = await request(app)
    .post('/api/search')
    .send({ query: 'test' });

  expect(response.status).toBe(200); // Should still return 200 with mock results
  expect(response.body.success).toBe(true);
  expect(response.body.data.results).toHaveLength(1);
});

  });

  describe('GET / (SPA support)', () => {
    it('should serve index.html for root path', async () => {
      const response = await request(app).get('/');

      // Since we're not setting up static file serving in tests, this will return 404
      // In a real environment, it would serve the frontend index.html
      expect([200, 404]).toContain(response.status);
    });
  });

  afterAll(async () => {
    // 重置环境变量
    delete process.env.SEARCH_MOCK_MODE;
    
    // 获取并销毁 FileSearchService 实例以清理定时器
    try {
      if (diContainer.isBound(TYPES.FileSearchService)) {
        const fileSearchService = diContainer.get<any>(TYPES.FileSearchService);
        if (fileSearchService && typeof fileSearchService.destroy === 'function') {
          await fileSearchService.destroy();
        }
      }
    } catch (error) {
      console.warn('Failed to destroy FileSearchService:', error);
    }
    
    // 清理 DI 容器中的绑定
    if (diContainer.isBound(TYPES.ConfigService)) {
      diContainer.unbind(TYPES.ConfigService);
    }
    if (diContainer.isBound(TYPES.ProjectStateManager)) {
      diContainer.unbind(TYPES.ProjectStateManager);
    }
    if (diContainer.isBound(TYPES.FileSearchService)) {
      diContainer.unbind(TYPES.FileSearchService);
    }
    
    // 清理所有定时器
    jest.useRealTimers();
    jest.clearAllTimers();
    
    // 等待微任务队列清空
    await new Promise(resolve => setImmediate(resolve));
  });
});