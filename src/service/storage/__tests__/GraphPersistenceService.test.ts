import {
  GraphPersistenceService,
  GraphPersistenceOptions,
  GraphPersistenceResult,
  CodeGraphNode,
  CodeGraphRelationship,
} from '../graph/GraphPersistenceService';
import { NebulaService } from '../../../database/NebulaService';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { BatchProcessingMetrics } from '../../monitoring/BatchProcessingMetrics';
import { NebulaQueryBuilder } from '../../../database/nebula/NebulaQueryBuilder';
import { GraphDatabaseErrorHandler } from '../../../core/GraphDatabaseErrorHandler';
import { NebulaSpaceManager } from '../../../database/nebula/NebulaSpaceManager';
import { GraphPersistenceUtils } from '../graph/GraphPersistenceUtils';
import { TYPES } from '../../../core/DIContainer';
import { GraphCacheService } from '../graph/GraphCacheService';
import { GraphPerformanceMonitor } from '../graph/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../graph/GraphBatchOptimizer';
import { GraphQueryBuilder } from '../graph/GraphQueryBuilder';
import { GraphSearchService } from '../graph/GraphSearchService';

describe('GraphPersistenceService', () => {
  let graphPersistenceService: GraphPersistenceService;
  let mockNebulaService: any;
  let mockLoggerService: any;
  let mockConfigService: any;
  let mockErrorHandlerService: any;
  let mockQueryBuilder: any;
  let mockGraphErrorHandler: any;
  let mockNebulaSpaceManager: any;
  let mockGraphPersistenceUtils: any;
  let mockGraphCacheService: any;
  let mockGraphPerformanceMonitor: any;
  let mockGraphBatchOptimizer: any;
  let mockGraphQueryBuilder: any;
  let mockGraphSearchService: any;

  beforeEach(() => {
    // Use fake timers to control async operations
    jest.useFakeTimers();

    // Mock services
    mockNebulaService = {
      isConnected: jest.fn().mockReturnValue(true),
      initialize: jest.fn().mockResolvedValue(true),
      executeReadQuery: jest.fn(),
      executeWriteQuery: jest.fn(),
      executeTransaction: jest.fn(),
      close: jest.fn(),
    };

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'batchProcessing') {
          return {
            maxConcurrentOperations: 5,
            defaultBatchSize: 50,
            maxBatchSize: 500,
            memoryThreshold: 80,
            processingTimeout: 300000,
            retryAttempts: 3,
            retryDelay: 1000,
            adaptiveBatching: {
              enabled: true,
              initialBatchSize: 50,
              adjustmentStep: 10,
              minBatchSize: 10,
              maxBatchSize: 500,
            },
            monitoring: {
              metricsInterval: 60000,
            },
          };
        }
        if (key === 'cache') {
          return {
            defaultTTL: 300000,
            maxSize: 1000,
            enabled: true,
          };
        }
        return null;
      }),
      getGraphConfig: jest.fn().mockReturnValue({
        spaceName: 'codebase_graph',
        batchSize: 100,
        maxRetries: 3,
      }),
    };

    mockErrorHandlerService = {
      handleError: jest.fn().mockReturnValue({ id: 'error-123' }),
    };

    mockQueryBuilder = {
      buildCreateNodeQuery: jest.fn(),
      buildCreateRelationshipQuery: jest.fn(),
      buildFindQuery: jest.fn(),
    };

    mockGraphErrorHandler = {
      handleError: jest.fn().mockResolvedValue({
        action: 'retry',
        suggestions: ['Check connection', 'Retry operation'],
      }),
    };

    mockNebulaSpaceManager = {
      checkSpaceExists: jest.fn().mockResolvedValue(true),
      createSpace: jest.fn().mockResolvedValue(true),
      getSpaceInfo: jest.fn().mockResolvedValue({
        partition_num: 10,
        replica_factor: 1,
        vid_type: 'FIXED_STRING(32)',
      }),
      deleteSpace: jest.fn().mockResolvedValue(true),
    };

    mockGraphPersistenceUtils = {
      calculateOptimalBatchSize: jest.fn().mockReturnValue(50),
      waitForSpaceDeletion: jest.fn().mockResolvedValue(undefined),
      initializeConnectionPoolMonitoring: jest.fn().mockResolvedValue(undefined),
      generateSpaceName: jest.fn().mockReturnValue('test_space'),
      extractProjectIdFromCurrentSpace: jest.fn().mockReturnValue('test-project'),
      ensureConstraints: jest.fn().mockResolvedValue(undefined),
      recordToGraphNode: jest.fn().mockReturnValue({
        id: 'test-node',
        type: 'Function',
        name: 'testFunction',
        properties: {},
      }),
      recordToGraphRelationship: jest.fn().mockReturnValue({
        id: 'test-rel',
        type: 'CALLS',
        sourceId: 'source',
        targetId: 'target',
        properties: {},
      }),
      processWithTimeout: jest.fn().mockImplementation((operation) => operation()),
      getEnhancedGraphStats: jest.fn().mockResolvedValue({
        nodeCount: 100,
        relationshipCount: 200,
        nodeTypes: { Function: 50, Class: 30 },
        relationshipTypes: { CALLS: 100, EXTENDS: 50 },
      }),
    };

    mockGraphCacheService = {
      getFromCache: jest.fn(),
      setCache: jest.fn(),
      getGraphStatsCache: jest.fn(),
      setGraphStatsCache: jest.fn(),
      clearAllCache: jest.fn(),
    };

    mockGraphPerformanceMonitor = {
      updateCacheHitRate: jest.fn(),
      recordQueryExecution: jest.fn(),
      getMetrics: jest.fn(),
      startPeriodicMonitoring: jest.fn(),
    };

    mockGraphBatchOptimizer = {
      getConfig: jest.fn().mockReturnValue({
        processingTimeout: 300000,
      }),
      updateConfig: jest.fn(),
    };

    mockGraphQueryBuilder = {
      buildNodeCountQuery: jest.fn(),
      buildRelationshipCountQuery: jest.fn(),
    };

    mockGraphSearchService = {
      search: jest.fn(),
    };

    // Create service instance directly
    graphPersistenceService = new GraphPersistenceService(
      mockNebulaService,
      mockNebulaSpaceManager,
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService,
      new BatchProcessingMetrics(mockConfigService, mockLoggerService, mockErrorHandlerService),
      mockQueryBuilder,
      mockGraphErrorHandler,
      mockGraphPersistenceUtils,
      mockGraphCacheService,
      mockGraphPerformanceMonitor,
      mockGraphBatchOptimizer,
      mockGraphQueryBuilder,
      mockGraphSearchService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Ensure all intervals are cleared
    jest.useRealTimers();
  });

  describe('storeParsedFiles', () => {
    it('should store parsed files successfully', async () => {
      const mockFiles = [
        {
          id: 'file_1',
          filePath: '/src/utils/math.ts',
          relativePath: 'src/utils/math.ts',
          content: 'function calculateSum(a: number, b: number): number { return a + b; }',
          language: 'typescript',
          chunks: [],
          hash: 'abc123',
          size: 100,
          parseTime: 50,
          metadata: {
            functions: 1,
            classes: 0,
            imports: [],
            exports: [],
            linesOfCode: 1,
            snippets: 0,
          },
        },
      ];

      // Mock the executeBatch method to return success
      mockNebulaService.executeWriteQuery.mockResolvedValue({
        success: true,
        data: { rows: [], rowCount: 1 },
      });
      mockNebulaService.executeTransaction.mockResolvedValue([
        { success: true, data: { rows: [], rowCount: 1 } },
      ]);

      const result = await graphPersistenceService.storeParsedFiles(mockFiles);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.nodesCreated).toBe('number');
    });

    it('should handle empty file list', async () => {
      const result = await graphPersistenceService.storeParsedFiles([]);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.nodesCreated).toBe('number');
    });
  });

  describe('storeChunks', () => {
    it('should store code chunks successfully', async () => {
      const mockChunks = [
        {
          id: 'chunk_1',
          type: 'function',
          content: 'function calculateSum(a: number, b: number): number { return a + b; }',
          startLine: 10,
          endLine: 20,
          startByte: 100,
          endByte: 200,
          imports: [],
          exports: [],
          metadata: {
            name: 'calculateSum',
            filePath: '/src/utils/math.ts',
            signature: 'calculateSum(a: number, b: number): number',
            complexity: 2,
            parameters: ['a', 'b'],
            returnType: 'number',
          },
        },
      ];

      // Mock the executeBatch method to return success
      mockNebulaService.executeWriteQuery.mockResolvedValue({
        success: true,
        data: { rows: [], rowCount: 1 },
      });
      mockNebulaService.executeTransaction.mockResolvedValue([
        { success: true, data: { rows: [], rowCount: 1 } },
      ]);

      const result = await graphPersistenceService.storeChunks(mockChunks);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.nodesCreated).toBe('number');
    });
  });

  describe('findRelatedNodes', () => {
    it('should find nodes related to a given node ID', async () => {
      const nodeId = 'func_123';
      const relationshipTypes = ['CALLS', 'EXTENDS'];
      const maxDepth = 2;

      const mockRelatedNodes: CodeGraphNode[] = [
        {
          id: 'func_456',
          type: 'Function',
          name: 'validateUser',
          properties: {
            filePath: '/src/validation.ts',
            signature: 'validateUser(user: User): boolean',
          },
        },
        {
          id: 'class_789',
          type: 'Class',
          name: 'UserValidator',
          properties: {
            filePath: '/src/validators/UserValidator.ts',
            methods: ['validate', 'sanitize'],
          },
        },
      ];

      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: { rows: mockRelatedNodes, rowCount: mockRelatedNodes.length },
      });

      const result = await graphPersistenceService.findRelatedNodes(
        nodeId,
        relationshipTypes,
        maxDepth
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty result', async () => {
      const nodeId = 'non_existent';

      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: { rows: [], rowCount: 0 },
      });

      const result = await graphPersistenceService.findRelatedNodes(nodeId);

      expect(result).toHaveLength(0);
    });
  });

  describe('findPath', () => {
    it('should find path between two nodes', async () => {
      const sourceId = 'func_123';
      const targetId = 'func_456';
      const maxDepth = 3;

      const mockRelationships: CodeGraphRelationship[] = [
        {
          id: 'rel_1',
          type: 'CALLS',
          sourceId: sourceId,
          targetId: targetId,
          properties: {
            callCount: 5,
            lineNumber: 15,
          },
        },
      ];

      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: { rows: mockRelationships, rowCount: mockRelationships.length },
      });

      const result = await graphPersistenceService.findPath(sourceId, targetId, maxDepth);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getGraphStats', () => {
    it('should return graph statistics', async () => {
      const mockStats = {
        nodeCount: 1000,
        relationshipCount: 2500,
        nodeTypes: {
          Function: 400,
          Class: 150,
          File: 50,
          Interface: 100,
        },
        relationshipTypes: {
          CALLS: 1000,
          EXTENDS: 300,
          IMPLEMENTS: 200,
          IMPORTS: 1000,
        },
      };

      // Mock the SHOW TAGS and SHOW EDGES queries
      mockNebulaService.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes('SHOW TAGS')) {
          return {
            success: true,
            data: [
              { Name: 'Function' },
              { Name: 'Class' },
              { Name: 'File' },
              { Name: 'Interface' },
            ],
          };
        }
        if (query.includes('SHOW EDGES')) {
          return {
            success: true,
            data: [
              { Name: 'CALLS' },
              { Name: 'EXTENDS' },
              { Name: 'IMPLEMENTS' },
              { Name: 'IMPORTS' },
            ],
          };
        }
        if (query.includes('COUNT')) {
          return {
            success: true,
            data: [{ total: 250 }],
          };
        }
        return { success: true, data: [] };
      });

      const result = await graphPersistenceService.getGraphStats();

      expect(result).toBeDefined();
      expect(typeof result.nodeCount).toBe('number');
      expect(typeof result.relationshipCount).toBe('number');
      expect(result.nodeTypes).toBeDefined();
      expect(result.relationshipTypes).toBeDefined();
    });

    it('should handle empty graph', async () => {
      const mockStats = {
        nodeCount: 0,
        relationshipCount: 0,
        nodeTypes: {},
        relationshipTypes: {},
      };

      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const result = await graphPersistenceService.getGraphStats();

      expect(result.nodeCount).toBe(0);
      expect(result.relationshipCount).toBe(0);
      expect(Object.keys(result.nodeTypes)).toHaveLength(0);
    });
  });

  describe('deleteNodes', () => {
    it('should delete nodes successfully', async () => {
      const nodeIds = ['func_123', 'func_456'];

      // Mock executeBatch to return success
      mockNebulaService.executeWriteQuery.mockResolvedValue({
        success: true,
        data: { rows: [], rowCount: 2 },
      });
      mockNebulaService.executeTransaction.mockResolvedValue([
        { success: true, data: { rows: [], rowCount: 2 } },
      ]);

      const result = await graphPersistenceService.deleteNodes(nodeIds);

      expect(typeof result).toBe('boolean');
      expect(mockLoggerService.info).toHaveBeenCalled();
    });

    it('should handle deletion failure', async () => {
      const nodeIds = ['func_123'];

      // Mock executeBatch to return failure and throw error
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Deletion failed'));
      mockNebulaService.executeTransaction.mockRejectedValue(new Error('Deletion failed'));

      const result = await graphPersistenceService.deleteNodes(nodeIds);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('clearGraph', () => {
    it('should clear the entire graph', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue({ success: true });
      mockNebulaSpaceManager.getSpaceInfo.mockResolvedValue({
        partition_num: 10,
        replica_factor: 1,
        vid_type: 'FIXED_STRING(32)',
      });
      mockNebulaSpaceManager.deleteSpace.mockResolvedValue(true);
      mockNebulaSpaceManager.createSpace.mockResolvedValue(true);
      mockGraphCacheService.clearAllCache.mockReturnValue(undefined);

      // Mock the space name extraction and project ID extraction
      graphPersistenceService['currentSpace'] = 'test_space';
      graphPersistenceService['extractProjectIdFromCurrentSpace'] = jest
        .fn()
        .mockReturnValue('test-project');
      graphPersistenceService['generateSpaceName'] = jest.fn().mockReturnValue('test_space');
      graphPersistenceService['waitForSpaceDeletion'] = jest.fn().mockResolvedValue(undefined);

      const result = await graphPersistenceService.clearGraph();

      expect(result).toBe(true);
    });
  });
});
