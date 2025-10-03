import { GraphDataService } from '../../service/graph/core/GraphDataService';
import { GraphAnalysisService } from '../../service/graph/core/GraphAnalysisService';
import { GraphTransactionService } from '../../service/graph/core/GraphTransactionService';
import { GraphDatabaseService } from '../../database/graph/GraphDatabaseService';

describe('Graph Service Migration Integration Tests', () => {
  let graphDataService: GraphDataService;
  let graphAnalysisService: GraphAnalysisService;
  let graphTransactionService: GraphTransactionService;
  let graphDatabaseService: GraphDatabaseService;
  let originalGraphDataService: GraphDataService;


  const mockTransactionManager = {
    executeTransaction: jest.fn(),
    beginTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    addOperation: jest.fn(),
    getTransactionStats: jest.fn()
  };

  const mockCacheService = {
    setCache: jest.fn(),
    getFromCache: jest.fn(),
    hasKey: jest.fn(),
    deleteFromCache: jest.fn(),
    clearAllCache: jest.fn(),
    cleanupExpiredEntries: jest.fn(),
    startPeriodicCleanup: jest.fn(),
    stopPeriodicCleanup: jest.fn(),
    getCacheStats: jest.fn()
  };

  const mockBatchOptimizer = {
    calculateOptimalBatchSize: jest.fn().mockReturnValue(50),
    shouldRetry: jest.fn(),
    updateConfig: jest.fn(),
    getConfig: jest.fn(),
    executeWithOptimalBatching: jest.fn(async (items, operation) => {
      // Simple mock implementation that executes the operation on all items
      return await operation(items);
    })
  };

  const mockPerformanceMonitor = {
    recordQueryExecution: jest.fn(),
    updateCacheHitRate: jest.fn(),
    updateBatchSize: jest.fn(),
    recordMemoryUsage: jest.fn(),
    recordError: jest.fn(),
    startPeriodicMonitoring: jest.fn(),
    stopPeriodicMonitoring: jest.fn(),
    resetMetrics: jest.fn(),
    getMetrics: jest.fn()
  };

  const mockLoggerService = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockErrorHandlerService = {
    handleError: jest.fn()
  };

  const mockConfigService = {
    get: jest.fn()
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instances with mocked dependencies
    graphDatabaseService = new GraphDatabaseService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      {} as any, // NebulaService
      {} as any, // NebulaSpaceManager
      {
        buildInsertNodeQuery: jest.fn(),
        batchInsertVertices: jest.fn(),
        buildCodeAnalysisQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildDependencyQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildNodeCountQuery: jest.fn().mockReturnValue({ nGQL: 'LOOKUP ON File YIELD count(*) AS total', parameters: {} }),
        buildPathQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildImportQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCallQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildComplexTraversal: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCommunityDetectionQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildPageRankQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCodeStructureQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildInsertRelationshipQuery: jest.fn(),
        buildUpdateNodeQuery: jest.fn(),
        buildDeleteNodeQuery: jest.fn(),
        buildFindRelatedNodesQuery: jest.fn(),
        buildFindPathQuery: jest.fn(),
        buildRelationshipCountQuery: jest.fn(),
        buildNodeSearchQuery: jest.fn(),
        buildRelationshipSearchQuery: jest.fn()
      } as any, // GraphQueryBuilder
      mockBatchOptimizer as any,
      mockCacheService as any,
      mockPerformanceMonitor as any,
      {
        executeWithRetry: jest.fn(async (operation, operationName, options) => {
          return await operation();
        }),
        executeWithMonitoring: jest.fn(async (operation, operationName) => {
          return await operation();
        }),
        processBatches: jest.fn(),
        getCurrentBatchSize: jest.fn().mockReturnValue(50),
        resetBatchSize: jest.fn(),
        updateRetryOptions: jest.fn(),
        updateBatchOptions: jest.fn(),
        getPerformanceStats: jest.fn(),
        getMemoryStats: jest.fn(),
        optimizeMemory: jest.fn()
      } as any // PerformanceOptimizerService
    );

    graphDataService = new GraphDataService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {
        buildInsertNodeQuery: jest.fn(),
        batchInsertVertices: jest.fn(),
        buildCodeAnalysisQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildDependencyQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildNodeCountQuery: jest.fn().mockReturnValue({ nGQL: 'LOOKUP ON File YIELD count(*) AS total', parameters: {} }),
        buildPathQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildImportQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCallQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildComplexTraversal: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCommunityDetectionQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildPageRankQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCodeStructureQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildInsertRelationshipQuery: jest.fn(),
        buildUpdateNodeQuery: jest.fn(),
        buildDeleteNodeQuery: jest.fn(),
        buildFindRelatedNodesQuery: jest.fn(),
        buildFindPathQuery: jest.fn(),
        buildRelationshipCountQuery: jest.fn(),
        buildNodeSearchQuery: jest.fn(),
        buildRelationshipSearchQuery: jest.fn()
      } as any, // GraphQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any
    );

    graphAnalysisService = new GraphAnalysisService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {
        buildInsertNodeQuery: jest.fn(),
        batchInsertVertices: jest.fn(),
        buildCodeAnalysisQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildDependencyQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildNodeCountQuery: jest.fn().mockReturnValue({ nGQL: 'LOOKUP ON File YIELD count(*) AS total', parameters: {} }),
        buildPathQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildImportQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCallQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildComplexTraversal: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCommunityDetectionQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildPageRankQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCodeStructureQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildInsertRelationshipQuery: jest.fn(),
        buildUpdateNodeQuery: jest.fn(),
        buildDeleteNodeQuery: jest.fn(),
        buildFindRelatedNodesQuery: jest.fn(),
        buildFindPathQuery: jest.fn(),
        buildRelationshipCountQuery: jest.fn(),
        buildNodeSearchQuery: jest.fn(),
        buildRelationshipSearchQuery: jest.fn()
      } as any, // GraphQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any
    );

    graphTransactionService = new GraphTransactionService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {
        buildInsertNodeQuery: jest.fn(),
        batchInsertVertices: jest.fn(),
        buildCodeAnalysisQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildDependencyQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildNodeCountQuery: jest.fn().mockReturnValue({ nGQL: 'LOOKUP ON File YIELD count(*) AS total', parameters: {} }),
        buildPathQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildImportQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCallQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildComplexTraversal: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCommunityDetectionQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildPageRankQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildCodeStructureQuery: jest.fn().mockReturnValue({ nGQL: '', parameters: {} }),
        buildInsertRelationshipQuery: jest.fn(),
        buildUpdateNodeQuery: jest.fn(),
        buildDeleteNodeQuery: jest.fn(),
        buildFindRelatedNodesQuery: jest.fn(),
        buildFindPathQuery: jest.fn(),
        buildRelationshipCountQuery: jest.fn(),
        buildNodeSearchQuery: jest.fn(),
        buildRelationshipSearchQuery: jest.fn()
      } as any, // GraphQueryBuilder
      mockBatchOptimizer as any,
      mockCacheService as any,
      mockPerformanceMonitor as any,
      mockTransactionManager as any
    );

    // Create original service for comparison
    originalGraphDataService = new GraphDataService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {} as any, // GraphQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any
    );
  });

  describe('Service Initialization', () => {
    it('should initialize all new services successfully', async () => {
      jest.spyOn(graphDatabaseService, 'initialize').mockResolvedValue(true);

      const dataServiceInitialized = await graphDataService.initialize();
      const analysisServiceInitialized = await graphAnalysisService.initialize();
      const transactionServiceInitialized = await graphTransactionService.initialize();

      expect(dataServiceInitialized).toBe(true);
      expect(analysisServiceInitialized).toBe(true);
      expect(transactionServiceInitialized).toBe(true);
      expect(graphDatabaseService.initialize).toHaveBeenCalledTimes(3);
    });

    it('should handle initialization failure gracefully', async () => {
      jest.spyOn(graphDatabaseService, 'initialize').mockResolvedValue(false);

      const dataServiceInitialized = await graphDataService.initialize();
      const analysisServiceInitialized = await graphAnalysisService.initialize();
      const transactionServiceInitialized = await graphTransactionService.initialize();

      expect(dataServiceInitialized).toBe(false);
      expect(analysisServiceInitialized).toBe(false);
      expect(transactionServiceInitialized).toBe(false);
    });
  });

  describe('Data Storage Operations', () => {
    const sampleFiles = [
      {
        id: 'file-1',
        filePath: '/path/to/file1.js',
        relativePath: 'file1.js',
        language: 'javascript',
        size: 1024,
        hash: 'hash1',
        metadata: {
          linesOfCode: 50,
          functions: 2,
          classes: 1
        },
        chunks: [
          {
            id: 'chunk-1',
            type: 'function',
            functionName: 'testFunction',
            content: 'function test() {}',
            startLine: 1,
            endLine: 5,
            metadata: {
              complexity: 1,
              parameters: [],
              returnType: 'void'
            }
          }
        ]
      }
    ];

    it('should store parsed files using new service', async () => {
      jest.spyOn(graphDatabaseService, 'executeBatch').mockResolvedValue({
        success: true,
        results: [{ success: true, data: { inserted: true } }, { success: true, data: { inserted: true } }],
        executionTime: 100
      });

      const result = await graphDataService.storeParsedFiles(sampleFiles, { projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBeGreaterThan(0);
      expect(result.relationshipsCreated).toBeGreaterThan(0);
      expect(graphDatabaseService.executeBatch).toHaveBeenCalled();
    });

    it('should store chunks using new service', async () => {
      const chunks = sampleFiles[0].chunks;

      jest.spyOn(graphDatabaseService, 'executeBatch').mockResolvedValue({
        success: true,
        results: [{ success: true, data: { inserted: true } }],
        executionTime: 50
      });

      const result = await graphDataService.storeChunks(chunks, { projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBeGreaterThan(0);
      expect(result.relationshipsCreated).toBeGreaterThan(0);
    });

    it('should delete nodes using new service', async () => {
      const nodeIds = ['chunk-1', 'chunk-2'];

      jest.spyOn(graphDatabaseService, 'executeBatch').mockResolvedValue({
        success: true,
        results: [{ success: true }],
        executionTime: 50
      });

      const result = await graphDataService.deleteNodes(nodeIds);

      expect(result).toBe(true);
      expect(graphDatabaseService.executeBatch).toHaveBeenCalled();
    });
  });

  describe('Graph Analysis Operations', () => {
    it('should analyze codebase using new service', async () => {
      const mockAnalysisResult = {
        result: {
          nodes: [],
          edges: [],
          metrics: { totalNodes: 0, totalEdges: 0, averageDegree: 0, maxDepth: 3, componentCount: 0 },
          summary: { projectFiles: 0, functions: 0, classes: 0, imports: 0, externalDependencies: 0 }
        },
        formattedResult: {}
      };

      jest.spyOn(graphDatabaseService, 'executeReadQuery').mockResolvedValue({ data: [] });

      const result = await graphAnalysisService.analyzeCodebase('/test/path');

      expect(result).toBeDefined();
      expect(graphDatabaseService.executeReadQuery).toHaveBeenCalled();
    });

    it('should find dependencies using new service', async () => {
      jest.spyOn(graphDatabaseService, 'executeReadQuery').mockResolvedValue({ data: [] });

      const result = await graphAnalysisService.findDependencies('/test/file.js');

      expect(result).toBeDefined();
      expect(graphDatabaseService.executeReadQuery).toHaveBeenCalled();
    });

    it('should get graph statistics using new service', async () => {
      jest.spyOn(graphDatabaseService, 'executeReadQuery').mockResolvedValue({ data: [{ total: 10 }] });

      const result = await graphAnalysisService.getGraphStats('/test/path');

      expect(result).toBeDefined();
      expect(result.totalFiles).toBeDefined();
      expect(result.totalFunctions).toBeDefined();
      expect(result.totalClasses).toBeDefined();
    });
  });

  describe('Transaction Operations', () => {
    it('should execute in transaction using new service', async () => {
      const operations = [
        { nGQL: 'CREATE (n:Node {name: "test1"})', parameters: {} },
        { nGQL: 'CREATE (n:Node {name: "test2"})', parameters: {} }
      ];

      const mockResult = { success: true, results: [{}, {}], executionTime: 100 };

      mockTransactionManager.commitTransaction.mockResolvedValue(mockResult);

      const result = await graphTransactionService.executeInTransaction(operations, async (results) => results);

      expect(result).toEqual(mockResult.results);
      expect(mockTransactionManager.commitTransaction).toHaveBeenCalled();
    });

    it('should execute batch in transaction using new service', async () => {
      const operations = [
        { nGQL: 'CREATE (n:Node {name: "test1"})', parameters: {} },
        { nGQL: 'CREATE (n:Node {name: "test2"})', parameters: {} }
      ];

      mockBatchOptimizer.executeWithOptimalBatching.mockImplementation(async (items, operation) => {
        return await operation(items);
      });

      const result = await graphTransactionService.executeBatchInTransaction(operations, async (results) => ({ success: true }));

      expect(result.success).toBe(true);
      expect(mockBatchOptimizer.executeWithOptimalBatching).toHaveBeenCalled();
    });

    it('should create project space using new service', async () => {
      jest.spyOn(graphDatabaseService, 'useSpace').mockResolvedValue();
      jest.spyOn(graphDatabaseService, 'createSpace').mockResolvedValue(true);
      jest.spyOn(graphDatabaseService, 'deleteSpace').mockResolvedValue(true);
      jest.spyOn(graphDatabaseService, 'spaceExists').mockResolvedValue(true);

      mockTransactionManager.commitTransaction.mockResolvedValue({
        success: true,
        results: [],
        executionTime: 100
      });

      const result = await graphTransactionService.createProjectSpace('project-1');

      expect(result).toBe(true);
      expect(graphDatabaseService.useSpace).toHaveBeenCalledWith('project-1');
    });
  });

  describe('Performance Comparison', () => {
    it('should demonstrate improved modularity in new services', () => {
      // Each service should have its own specific methods
      expect(typeof graphDataService.storeParsedFiles).toBe('function');
      expect(typeof graphAnalysisService.analyzeCodebase).toBe('function');
      expect(typeof graphTransactionService.executeInTransaction).toBe('function');
    });

    it('should show separation of concerns between services', () => {
      // Data service should focus on storage operations
      expect(typeof graphDataService.storeParsedFiles).toBe('function');
      expect(typeof graphDataService.storeChunks).toBe('function');
      expect(typeof graphDataService.deleteNodes).toBe('function');

      // Analysis service should focus on analysis operations
      expect(typeof graphAnalysisService.analyzeCodebase).toBe('function');
      expect(typeof graphAnalysisService.findDependencies).toBe('function');
      expect(typeof graphAnalysisService.getGraphStats).toBe('function');

      // Transaction service should focus on transaction operations
      expect(typeof graphTransactionService.executeInTransaction).toBe('function');
      expect(typeof graphTransactionService.executeBatchInTransaction).toBe('function');
      expect(typeof graphTransactionService.createProjectSpace).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in data service', async () => {
      jest.spyOn(graphDatabaseService, 'executeBatch').mockRejectedValue(new Error('Database error'));
      mockErrorHandlerService.handleError.mockReturnValue({ id: 'error-id' });

      const result = await graphDataService.storeParsedFiles([], { projectId: 'project-1' });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors gracefully in analysis service', async () => {
      jest.spyOn(graphDatabaseService, 'executeReadQuery').mockRejectedValue(new Error('Query error'));
      mockErrorHandlerService.handleError.mockReturnValue({ id: 'error-id' });

      try {
        await graphAnalysisService.analyzeCodebase('/test/path');
      } catch (error) {
        expect(error).toBeDefined();
      }
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors gracefully in transaction service', async () => {
      mockTransactionManager.executeTransaction.mockRejectedValue(new Error('Transaction error'));
      mockErrorHandlerService.handleError.mockReturnValue({ id: 'error-id' });

      try {
        await graphTransactionService.executeInTransaction([], async () => ({ success: false }));
      } catch (error) {
        expect(error).toBeDefined();
      }
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});