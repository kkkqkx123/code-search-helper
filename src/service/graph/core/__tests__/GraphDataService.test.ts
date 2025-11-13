import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import { GraphDataService } from '../GraphDataService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { GraphDatabaseService } from '../../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../../database/nebula/query/GraphQueryBuilder';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../infrastructure/monitoring/types';
import { GraphPersistenceOptions, GraphPersistenceResult, CodeGraphNode, CodeGraphRelationship } from '../types';

describe('GraphDataService', () => {
  let container: Container;
  let graphDataService: GraphDataService;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockGraphDatabase: jest.Mocked<GraphDatabaseService>;
  let mockQueryBuilder: jest.Mocked<GraphQueryBuilder>;
  let mockCacheService: jest.Mocked<ICacheService>;
  let mockPerformanceMonitor: jest.Mocked<IPerformanceMonitor>;

  beforeEach(() => {
    // 重置环境变量
    delete process.env.NEBULA_ENABLED;
    
    container = new Container();
    
    // 创建模拟的LoggerService
    mockLoggerService = {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockReturnValue('./logs/app.log'),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn().mockResolvedValue(undefined)
    } as any;

    // 创建模拟的ErrorHandlerService
    mockErrorHandlerService = {
      handleError: jest.fn().mockReturnValue({
        id: 'error-123',
        timestamp: new Date(),
        component: 'TestComponent',
        operation: 'testOperation',
        message: 'Test error',
        context: {}
      }),
      getErrorReport: jest.fn(),
      getAllErrorReports: jest.fn(),
      clearErrorReport: jest.fn(),
      clearAllErrorReports: jest.fn(),
      getErrorStats: jest.fn(),
      handleHotReloadError: jest.fn()
    } as any;

    // 创建模拟的ConfigService
    mockConfigService = {
      get: jest.fn(),
      getAll: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      reset: jest.fn()
    } as any;

    // 创建模拟的GraphDatabaseService
    mockGraphDatabase = {
      initialize: jest.fn().mockResolvedValue(true),
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      executeReadQuery: jest.fn().mockResolvedValue({ data: [] }),
      executeWriteQuery: jest.fn().mockResolvedValue({ success: true }),
      executeBatch: jest.fn().mockResolvedValue({ success: true, results: [] }),
      spaceExists: jest.fn().mockResolvedValue(false),
      createSpace: jest.fn().mockResolvedValue(true),
      useSpace: jest.fn().mockResolvedValue(undefined),
      deleteSpace: jest.fn().mockResolvedValue(true),
      getCurrentSpace: jest.fn().mockReturnValue('test_space'),
      getDatabaseStats: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined),
      updateConfig: jest.fn(),
      getConfig: jest.fn().mockReturnValue({}),
      getNebulaClient: jest.fn()
    } as any;

    // 创建模拟的GraphQueryBuilder
    mockQueryBuilder = {
      buildPathQuery: jest.fn().mockReturnValue({
        nGQL: 'MATCH path',
        parameters: { sourceId: 'source', targetId: 'target' }
      })
    } as any;

    // 创建模拟的CacheService
    mockCacheService = {
      getFromCache: jest.fn().mockReturnValue(undefined),
      setCache: jest.fn(),
      deleteFromCache: jest.fn().mockReturnValue(true),
      clearAllCache: jest.fn(),
      getCacheStats: jest.fn().mockReturnValue({
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      }),
      cleanupExpiredEntries: jest.fn(),
      getDatabaseSpecificCache: jest.fn().mockResolvedValue(null),
      setDatabaseSpecificCache: jest.fn().mockResolvedValue(undefined),
      invalidateDatabaseCache: jest.fn().mockResolvedValue(undefined)
    } as any;

    // 创建模拟的PerformanceMonitor
    mockPerformanceMonitor = {
      startPeriodicMonitoring: jest.fn(),
      stopPeriodicMonitoring: jest.fn(),
      recordQueryExecution: jest.fn(),
      updateCacheHitRate: jest.fn(),
      updateBatchSize: jest.fn(),
      updateSystemHealthStatus: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        queryExecutionTimes: [],
        averageQueryTime: 0,
        cacheHitRate: 0,
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          percentage: 0
        },
        systemHealthStatus: 'healthy' as const,
        batchProcessingStats: {
          totalBatches: 0,
          averageBatchSize: 0,
          successRate: 0
        },
        timestamp: Date.now()
      }),
      resetMetrics: jest.fn(),
      startOperation: jest.fn().mockReturnValue('op-123'),
      endOperation: jest.fn(),
      recordOperation: jest.fn(),
      recordCacheOperation: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      recordCacheEviction: jest.fn(),
      getCacheStats: jest.fn().mockReturnValue({
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        memoryUsage: 0,
        hitRateTrend: 'stable' as const,
        timestamp: Date.now()
      })
    } as any;

    // 绑定依赖
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind<GraphDatabaseService>(TYPES.GraphDatabaseService).toConstantValue(mockGraphDatabase);
    container.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).toConstantValue(mockQueryBuilder);
    container.bind<ICacheService>(TYPES.GraphCacheService).toConstantValue(mockCacheService);
    container.bind<IPerformanceMonitor>(TYPES.GraphPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind<GraphDataService>(TYPES.GraphDataService).to(GraphDataService);

    graphDataService = container.get<GraphDataService>(TYPES.GraphDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    test('should initialize successfully when NEBULA_ENABLED is true', async () => {
      process.env.NEBULA_ENABLED = 'true';
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(true);
      expect(graphDataService.isServiceInitialized()).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Initializing graph data service');
      expect(mockLoggerService.info).toHaveBeenCalledWith('Graph data service initialized successfully');
    });

    test('should return false when NEBULA_ENABLED is false', async () => {
      process.env.NEBULA_ENABLED = 'false';
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(false);
      expect(graphDataService.isServiceInitialized()).toBe(false);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Graph data service is disabled via NEBULA_ENABLED environment variable, skipping initialization'
      );
    });

    test('should handle initialization failure', async () => {
      mockGraphDatabase.initialize.mockResolvedValue(false);
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        { component: 'GraphDataService', operation: 'initialize' }
      );
    });

    test('should handle database connection failure', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockResolvedValue(false);
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('storeParsedFiles', () => {
    const mockFiles = [
      {
        id: 'file1',
        filePath: '/path/to/file1.ts',
        relativePath: 'file1.ts',
        language: 'typescript',
        size: 1000,
        hash: 'hash1',
        metadata: {
          linesOfCode: 50,
          functions: 2,
          classes: 1,
          imports: ['import1', 'import2']
        },
        chunks: [
          {
            id: 'chunk1',
            type: 'function',
            functionName: 'testFunction',
            content: 'function test() {}',
            startLine: 1,
            endLine: 10,
            metadata: {
              complexity: 1,
              parameters: [],
              returnType: 'void',
              language: 'typescript'
            }
          }
        ]
      }
    ];

    test('should store parsed files successfully', async () => {
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: true,
        results: [
          { success: true, data: { inserted_vertex: 1 } },
          { success: true, data: { inserted_edge: 1 } }
        ]
      });

      const options: GraphPersistenceOptions = { projectId: 'project1' };
      const result = await graphDataService.storeParsedFiles(mockFiles, options);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(result.relationshipsCreated).toBe(1);
      expect(mockGraphDatabase.spaceExists).toHaveBeenCalledWith('project1');
      expect(mockGraphDatabase.createSpace).toHaveBeenCalledWith('project1');
      expect(mockGraphDatabase.useSpace).toHaveBeenCalledWith('project1');
      expect(mockGraphDatabase.executeBatch).toHaveBeenCalled();
    });

    test('should handle batch execution failure', async () => {
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: false,
        error: 'Batch execution failed'
      });

      const result = await graphDataService.storeParsedFiles(mockFiles);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Batch execution failed');
    });

    test('should handle space creation failure', async () => {
      mockGraphDatabase.createSpace.mockResolvedValue(false);

      const options: GraphPersistenceOptions = { projectId: 'project1' };
      const result = await graphDataService.storeParsedFiles(mockFiles, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Storage failed: error-123');
    });

    test('should auto-initialize if not initialized', async () => {
      // Reset the mock to track calls
      mockGraphDatabase.initialize.mockClear();
      
      // Mock isDatabaseConnected to return false to trigger initialization
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockResolvedValue(true);
      
      // Create a new instance that hasn't been initialized
      const newContainer = new Container();
      newContainer.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
      newContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
      newContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService);
      newContainer.bind<GraphDatabaseService>(TYPES.GraphDatabaseService).toConstantValue(mockGraphDatabase);
      newContainer.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).toConstantValue(mockQueryBuilder);
      newContainer.bind<ICacheService>(TYPES.GraphCacheService).toConstantValue(mockCacheService);
      newContainer.bind<IPerformanceMonitor>(TYPES.GraphPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
      newContainer.bind<GraphDataService>(TYPES.GraphDataService).to(GraphDataService);
      
      const newGraphDataService = newContainer.get<GraphDataService>(TYPES.GraphDataService);
      
      // Ensure the service is not initialized
      expect(newGraphDataService.isServiceInitialized()).toBe(false);
      
      // Mock the batch execution to return success
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: true,
        results: []
      });
      
      const result = await newGraphDataService.storeParsedFiles(mockFiles);
      
      expect(mockGraphDatabase.initialize).toHaveBeenCalled();
    });
  });

  describe('storeChunks', () => {
    const mockChunks = [
      {
        id: 'chunk1',
        type: 'function',
        functionName: 'testFunction',
        content: 'function test() {}',
        startLine: 1,
        endLine: 10,
        metadata: {
          complexity: 1,
          parameters: [],
          returnType: 'void',
          language: 'typescript'
        }
      }
    ];

    test('should store chunks successfully', async () => {
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: true,
        results: [
          { success: true, data: { inserted_vertex: 1 } }
        ]
      });

      const result = await graphDataService.storeChunks(mockChunks);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(mockGraphDatabase.executeBatch).toHaveBeenCalled();
    });

    test('should handle chunks with class type', async () => {
      const classChunks = [
        {
          id: 'class1',
          type: 'class',
          className: 'TestClass',
          content: 'class TestClass {}',
          startLine: 1,
          endLine: 10,
          metadata: {
            methods: 2,
            properties: 1,
            inheritance: [],
            language: 'typescript'
          }
        }
      ];

      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: true,
        results: [
          { success: true, data: { inserted_vertex: 1 } }
        ]
      });

      const result = await graphDataService.storeChunks(classChunks);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
    });
  });

  describe('findRelatedNodes', () => {
    test('should find related nodes successfully', async () => {
      const mockResult = {
        data: [
          {
            id: 'node1',
            type: 'Function',
            name: 'testFunction',
            properties: { complexity: 1 }
          }
        ]
      };

      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphDataService.findRelatedNodes('sourceNode', ['CALLS'], 2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'node1',
        type: 'Function',
        name: 'testFunction',
        properties: { complexity: 1 }
      });
      expect(mockGraphDatabase.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining('GO 2 STEPS FROM "sourceNode" OVER CALLS')
      );
    });

    test('should handle empty results', async () => {
      mockGraphDatabase.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphDataService.findRelatedNodes('sourceNode');

      expect(result).toHaveLength(0);
    });

    test('should handle query errors', async () => {
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphDataService.findRelatedNodes('sourceNode');

      expect(result).toHaveLength(0);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findPath', () => {
    test('should find path between nodes successfully', async () => {
      const mockResult = {
        data: [
          {
            id: 'edge1',
            type: 'CALLS',
            properties: { weight: 1 }
          }
        ]
      };

      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);
      mockQueryBuilder.buildPathQuery.mockReturnValue({
        nGQL: 'MATCH path',
        parameters: { sourceId: 'source', targetId: 'target' }
      });

      const result = await graphDataService.findPath('sourceNode', 'targetNode', 3);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'edge1',
        type: 'CALLS',
        sourceId: 'sourceNode',
        targetId: 'targetNode',
        properties: { weight: 1 }
      });
      expect(mockQueryBuilder.buildPathQuery).toHaveBeenCalledWith('sourceNode', 'targetNode', 3);
    });

    test('should handle empty path results', async () => {
      mockGraphDatabase.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphDataService.findPath('sourceNode', 'targetNode');

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteNodes', () => {
    test('should delete nodes successfully', async () => {
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: true,
        results: []
      });

      const result = await graphDataService.deleteNodes(['node1', 'node2']);

      expect(result).toBe(true);
      expect(mockGraphDatabase.executeBatch).toHaveBeenCalledWith([
        { nGQL: 'DELETE VERTEX "node1"', parameters: {} },
        { nGQL: 'DELETE VERTEX "node2"', parameters: {} }
      ]);
    });

    test('should handle delete failure', async () => {
      mockGraphDatabase.executeBatch.mockResolvedValue({
        success: false,
        error: 'Delete failed'
      });

      const result = await graphDataService.deleteNodes(['node1']);

      expect(result).toBe(false);
    });
  });

  describe('clearGraph', () => {
    test('should clear graph successfully', async () => {
      mockGraphDatabase.getCurrentSpace.mockReturnValue('test_space');
      mockGraphDatabase.deleteSpace.mockResolvedValue(true);
      mockGraphDatabase.createSpace.mockResolvedValue(true);

      const result = await graphDataService.clearGraph();

      expect(result).toBe(true);
      expect(mockGraphDatabase.deleteSpace).toHaveBeenCalledWith('test_space');
      expect(mockGraphDatabase.createSpace).toHaveBeenCalledWith('test_space');
      expect(mockGraphDatabase.useSpace).toHaveBeenCalledWith('test_space');
    });

    test('should handle no active space', async () => {
      mockGraphDatabase.getCurrentSpace.mockReturnValue(null);

      const result = await graphDataService.clearGraph();

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    test('should handle space deletion failure', async () => {
      mockGraphDatabase.getCurrentSpace.mockReturnValue('test_space');
      mockGraphDatabase.deleteSpace.mockResolvedValue(false);

      const result = await graphDataService.clearGraph();

      expect(result).toBe(false);
    });
  });

  describe('executeRawQuery', () => {
    test('should execute raw query successfully', async () => {
      const mockResult = { data: 'test data' };
      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphDataService.executeRawQuery('SHOW TAGS', { limit: 10 });

      expect(result).toEqual(mockResult);
      expect(mockGraphDatabase.executeReadQuery).toHaveBeenCalledWith('SHOW TAGS', { limit: 10 });
    });

    test('should handle query errors', async () => {
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      await expect(graphDataService.executeRawQuery('INVALID QUERY')).rejects.toThrow('Query failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    test('should close service successfully', async () => {
      await graphDataService.close();

      expect(mockGraphDatabase.close).toHaveBeenCalled();
      expect(graphDataService.isServiceInitialized()).toBe(false);
    });

    test('should handle close errors', async () => {
      mockGraphDatabase.close.mockRejectedValue(new Error('Close failed'));

      await expect(graphDataService.close()).rejects.toThrow('Close failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('isServiceInitialized', () => {
    test('should return initialization status', async () => {
      expect(graphDataService.isServiceInitialized()).toBe(false);
      
      await graphDataService.initialize();
      expect(graphDataService.isServiceInitialized()).toBe(true);
    });
  });

  describe('private helper methods', () => {
    test('should count created nodes correctly', () => {
      const results = [
        { success: true, data: { inserted_vertex: 1 } },
        { success: true, data: { inserted: 1 } },
        { success: false, data: {} },
        { success: true, data: { inserted_edge: 1 } }
      ];

      // Access private method through prototype
      const countCreatedNodes = (graphDataService as any).countCreatedNodes.bind(graphDataService);
      const count = countCreatedNodes(results);

      expect(count).toBe(2);
    });

    test('should count created relationships correctly', () => {
      const results = [
        { success: true, data: { inserted_edge: 1 } },
        { success: true, data: { inserted: 1 } },
        { success: false, data: {} },
        { success: true, data: { inserted_vertex: 1 } }
      ];

      const countCreatedRelationships = (graphDataService as any).countCreatedRelationships.bind(graphDataService);
      const count = countCreatedRelationships(results);

      expect(count).toBe(2);
    });

    test('should convert record to graph node correctly', () => {
      const record = {
        id: 'node1',
        type: 'Function',
        name: 'testFunction',
        properties: { complexity: 1 }
      };

      const recordToGraphNode = (graphDataService as any).recordToGraphNode.bind(graphDataService);
      const node = recordToGraphNode(record);

      expect(node).toEqual({
        id: 'node1',
        type: 'Function',
        name: 'testFunction',
        properties: { complexity: 1 }
      });
    });

    test('should convert record to graph relationship correctly', () => {
      const record = {
        id: 'edge1',
        type: 'CALLS',
        properties: { weight: 1 }
      };

      const recordToGraphRelationship = (graphDataService as any).recordToGraphRelationship.bind(graphDataService);
      const relationship = recordToGraphRelationship(record, 'source1', 'target1');

      expect(relationship).toEqual({
        id: 'edge1',
        type: 'CALLS',
        sourceId: 'source1',
        targetId: 'target1',
        properties: { weight: 1 }
      });
    });
  });
});