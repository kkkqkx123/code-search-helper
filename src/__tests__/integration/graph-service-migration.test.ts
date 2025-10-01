import { GraphDataService } from '../../service/graph/core-new/GraphDataService';
import { GraphAnalysisService } from '../../service/graph/core-new/GraphAnalysisService';
import { GraphTransactionService } from '../../service/graph/core-new/GraphTransactionService';
import { GraphDatabaseService } from '../../database/graph/GraphDatabaseService';
import { GraphPersistenceService } from '../../service/graph/core/GraphPersistenceService';

describe('Graph Service Migration Integration Tests', () => {
  let graphDataService: GraphDataService;
  let graphAnalysisService: GraphAnalysisService;
  let graphTransactionService: GraphTransactionService;
  let graphDatabaseService: GraphDatabaseService;
  let originalGraphPersistenceService: GraphPersistenceService;


  const mockTransactionManager = {
    executeTransaction: jest.fn(),
    beginTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn()
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
    getConfig: jest.fn()
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
      { buildInsertNodeQuery: jest.fn(), batchInsertVertices: jest.fn() } as any, // GraphQueryBuilder
      mockBatchOptimizer as any,
      mockCacheService as any,
      mockPerformanceMonitor as any
    );

    graphDataService = new GraphDataService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {} as any, // GraphQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any
    );

    graphAnalysisService = new GraphAnalysisService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {} as any, // GraphQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any
    );

    graphTransactionService = new GraphTransactionService(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      graphDatabaseService,
      {} as any, // GraphQueryBuilder
      mockBatchOptimizer as any,
      mockCacheService as any,
      mockPerformanceMonitor as any,
      mockTransactionManager as any
    );

    // Create original service for comparison
    originalGraphPersistenceService = new GraphPersistenceService(
      {} as any, // NebulaService
      {} as any, // NebulaSpaceManager
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      {} as any, // NebulaQueryBuilder
      mockCacheService as any,
      mockPerformanceMonitor as any,
      mockBatchOptimizer as any,
      {} as any, // GraphQueryBuilder
      {} as any  // GraphPersistenceUtils
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
      jest.spyOn(graphDatabaseService, 'batchInsertNodes').mockResolvedValue({ success: true, nodesCreated: 2 });
      jest.spyOn(graphDatabaseService, 'batchInsertRelationships').mockResolvedValue({ success: true, relationshipsCreated: 2 });

      const result = await graphDataService.storeParsedFiles(sampleFiles, { projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(2);
      expect(result.relationshipsCreated).toBe(2);
      expect(graphDatabaseService.batchInsertNodes).toHaveBeenCalled();
      expect(graphDatabaseService.batchInsertRelationships).toHaveBeenCalled();
    });

    it('should store chunks using new service', async () => {
      const chunks = sampleFiles[0].chunks;

      jest.spyOn(graphDatabaseService, 'batchInsertNodes').mockResolvedValue({ success: true, nodesCreated: 1 });
      jest.spyOn(graphDatabaseService, 'batchInsertRelationships').mockResolvedValue({ success: true, relationshipsCreated: 1 });

      const result = await graphDataService.storeChunks(chunks, { projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(result.relationshipsCreated).toBe(1);
    });

    it('should update chunks using new service', async () => {
      const updatedChunks = [
        {
          id: 'chunk-1',
          type: 'function',
          functionName: 'updatedFunction',
          content: 'function updated() {}',
          startLine: 1,
          endLine: 5
        }
      ];

      jest.spyOn(graphDatabaseService, 'updateNode').mockResolvedValue({ success: true });

      // Mock the private method
      (graphDataService as any).getExistingNodeIds = jest.fn().mockResolvedValue(['chunk-1']);

      const result = await graphDataService.updateChunks(updatedChunks, { projectId: 'project-1' });

      expect(result.success).toBe(true);
      expect(result.nodesUpdated).toBe(1);
    });
  });

  describe('Graph Analysis Operations', () => {
    it('should find related nodes using new service', async () => {
      const mockRelatedNodes = [
        { id: 'file-1', properties: { name: 'testFile.js' } },
        { id: 'func-456', properties: { name: 'anotherFunction' } }
      ];

      jest.spyOn(graphDatabaseService, 'findRelatedNodes').mockResolvedValue(mockRelatedNodes);

      const result = await graphAnalysisService.findRelatedNodes('func-123', ['CONTAINS', 'CALLS'], 2);

      expect(result).toEqual(mockRelatedNodes);
      expect(graphDatabaseService.findRelatedNodes).toHaveBeenCalledWith('func-123', ['CONTAINS', 'CALLS'], 2);
    });

    it('should find path between nodes using new service', async () => {
      const mockPath = [
        { source: 'node-1', target: 'node-3', relationship: 'CONTAINS' },
        { source: 'node-3', target: 'node-2', relationship: 'CALLS' }
      ];

      jest.spyOn(graphDatabaseService, 'findPath').mockResolvedValue(mockPath);

      const result = await graphAnalysisService.findPath('node-1', 'node-2', 3);

      expect(result).toEqual(mockPath);
      expect(graphDatabaseService.findPath).toHaveBeenCalledWith('node-1', 'node-2', 3);
    });

    it('should analyze code structure using new service', async () => {
      const mockStats = {
        nodeCount: 100,
        relationshipCount: 200,
        nodeTypes: { Function: 50, Class: 30, File: 20 },
        relationshipTypes: { CONTAINS: 100, CALLS: 80, IMPORTS: 20 }
      };

      jest.spyOn(graphDatabaseService, 'getGraphStatistics').mockResolvedValue(mockStats);

      const result = await graphAnalysisService.analyzeCodeStructure('project-1');

      expect(result.projectId).toBe('project-1');
      expect(result.stats).toEqual(mockStats);
      expect(result.analysis.totalFiles).toBe(20);
      expect(result.analysis.totalFunctions).toBe(50);
      expect(result.analysis.totalClasses).toBe(30);
    });
  });

  describe('Transaction Operations', () => {
    it('should execute transaction using new service', async () => {
      const queries = [
        { nGQL: 'CREATE (n:Node {name: "test1"})', parameters: {} },
        { nGQL: 'CREATE (n:Node {name: "test2"})', parameters: {} }
      ];

      const mockResult = { success: true, affectedNodes: 2 };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      const result = await graphTransactionService.executeTransaction(queries);

      expect(result).toEqual(mockResult);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(queries);
    });

    it('should execute batch transaction using new service', async () => {
      const operations = [
        { type: 'CREATE_NODE', data: { tag: 'Function', id: 'func-1', properties: { name: 'func1' } } },
        { type: 'CREATE_NODE', data: { tag: 'Function', id: 'func-2', properties: { name: 'func2' } } }
      ];

      mockTransactionManager.executeTransaction.mockResolvedValue({ success: true });

      const result = await graphTransactionService.executeBatchTransaction(operations);

      expect(result.success).toBe(true);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalled();
    });

    it('should handle transaction with retry logic', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ success: true });

      mockBatchOptimizer.shouldRetry.mockReturnValue(true);

      const result = await graphTransactionService.executeWithRetry(operation);

      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Comparison', () => {
    it('should demonstrate improved modularity in new services', () => {
      // Each service should have its own specific methods
      expect(typeof graphDataService.storeParsedFiles).toBe('function');
      expect(typeof graphAnalysisService.findRelatedNodes).toBe('function');
      expect(typeof graphTransactionService.executeTransaction).toBe('function');
    });

    it('should show separation of concerns between services', () => {
      // Data service should focus on storage operations
      expect(Object.keys(graphDataService)).toContain('storeParsedFiles');
      expect(Object.keys(graphDataService)).toContain('storeChunks');
      expect(Object.keys(graphDataService)).toContain('updateChunks');

      // Analysis service should focus on analysis operations
      expect(Object.keys(graphAnalysisService)).toContain('findRelatedNodes');
      expect(Object.keys(graphAnalysisService)).toContain('findPath');
      expect(Object.keys(graphAnalysisService)).toContain('analyzeCodeStructure');

      // Transaction service should focus on transaction operations
      expect(Object.keys(graphTransactionService)).toContain('executeTransaction');
      expect(Object.keys(graphTransactionService)).toContain('executeBatchTransaction');
      expect(Object.keys(graphTransactionService)).toContain('begin');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in data service', async () => {
      jest.spyOn(graphDatabaseService, 'batchInsertNodes').mockRejectedValue(new Error('Database error'));

      const result = await graphDataService.storeParsedFiles([], { projectId: 'project-1' });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors gracefully in analysis service', async () => {
      jest.spyOn(graphDatabaseService, 'findRelatedNodes').mockRejectedValue(new Error('Query error'));

      const result = await graphAnalysisService.findRelatedNodes('node-1');

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors gracefully in transaction service', async () => {
      jest.spyOn(graphDatabaseService, 'executeTransaction').mockRejectedValue(new Error('Transaction error'));

      const result = await graphTransactionService.executeTransaction([]);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Transaction error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});