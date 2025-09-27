import { QueryCoordinationService } from './QueryCoordinationService';
import { VectorStorageService } from '../storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../storage/graph/GraphPersistenceService';
import { GraphSearchService } from '../storage/graph/GraphSearchService';
import { ResultFusionEngine } from './ResultFusionEngine';
import { QueryOptimizer } from './QueryOptimizer';
import { QueryCache } from './QueryCache';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ResultFormatter } from './ResultFormatter';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';

describe('QueryCoordinationService', () => {
  let queryCoordinationService: QueryCoordinationService;
  let mockVectorStorageService: jest.Mocked<VectorStorageService>;
  let mockGraphPersistenceService: jest.Mocked<GraphPersistenceService>;
  let mockGraphSearchService: jest.Mocked<GraphSearchService>;
  let mockResultFusionEngine: jest.Mocked<ResultFusionEngine>;
  let mockQueryOptimizer: jest.Mocked<QueryOptimizer>;
  let mockQueryCache: jest.Mocked<QueryCache>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockResultFormatter: jest.Mocked<ResultFormatter>;

  beforeEach(() => {
    // Create mocks
    mockVectorStorageService = {
      searchVectors: jest.fn(),
      search: jest.fn(),
    } as any;

    mockGraphPersistenceService = {
      search: jest.fn().mockResolvedValue([]),
    } as any;

    mockGraphSearchService = {
      semanticSearch: jest.fn().mockResolvedValue([]),
      relationshipSearch: jest.fn().mockResolvedValue([]),
      pathSearch: jest.fn().mockResolvedValue([]),
      fuzzySearch: jest.fn().mockResolvedValue([]),
    } as any;

    mockResultFusionEngine = {
      fuse: jest.fn(),
    } as any;

    mockQueryOptimizer = {
      optimize: jest.fn(),
    } as any;

    mockQueryCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockEmbedderFactory = {
      getEmbedder: jest.fn().mockResolvedValue({
        embed: jest.fn().mockResolvedValue([{ vector: [0.1, 0.2, 0.3] }]),
        isAvailable: jest.fn().mockResolvedValue(true),
        getModelName: jest.fn().mockReturnValue('test-model'),
        getDimensions: jest.fn().mockReturnValue(3),
      }),
      embed: jest.fn(),
      getAvailableProviders: jest.fn(),
      getProviderInfo: jest.fn(),
      autoSelectProvider: jest.fn(),
      registerProvider: jest.fn(),
      getRegisteredProviders: jest.fn(),
    } as any;

    mockPerformanceMonitor = {
      recordQuery: jest.fn(),
      getStats: jest.fn(),
      getRealTimeStats: jest.fn(),
      getQueryPerformanceReport: jest.fn(),
      exportMetrics: jest.fn(),
      stopCleanupTask: jest.fn(),
    } as any;

    mockResultFormatter = {
      formatForLLM: jest.fn(),
      checkHealth: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    // Create service instance manually
    queryCoordinationService = new QueryCoordinationService(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockVectorStorageService,
      mockGraphPersistenceService,
      mockGraphSearchService,
      mockEmbedderFactory,
      mockResultFusionEngine,
      mockQueryOptimizer,
      mockQueryCache,
      mockPerformanceMonitor,
      mockResultFormatter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should execute a query and return results', async () => {
      const queryRequest = {
        query: 'test query',
        projectId: 'test-project',
        options: {
          limit: 10,
          includeGraph: true,
        },
      };

      const optimizedQuery = {
        originalQuery: 'test query',
        optimizedQuery: 'test query',
        queryExpansion: [],
        filters: {
          language: [],
          fileType: [],
          path: [],
          custom: [],
        },
        searchStrategy: {
          type: 'semantic' as const,
          parallel: true,
          cacheStrategy: 'moderate' as const,
        },
        performance: {
          estimatedLatency: 100,
          complexity: 'low' as const,
          resourceUsage: 'low' as const,
        },
      };

      const vectorResults = [
        {
          id: '1',
          score: 0.9,
          payload: {
            content: 'function test() {}',
            filePath: '/path/to/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 3,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      const graphResults = [
        {
          id: '2',
          score: 0.8,
          filePath: '/path/to/file.ts',
          content: 'class Test {}',
          startLine: 5,
          endLine: 7,
          language: 'typescript',
          chunkType: 'class',
          metadata: {},
        },
      ];

      const fusedResults = [
        {
          id: '1',
          score: 0.95,
          filePath: '/path/to/file.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          fusionMetrics: {
            vectorScore: 0.9,
            graphScore: 0,
            contextualScore: 0.95,
            finalScore: 0.95,
            confidence: 0.9,
          },
        },
      ];

      // The embedder factory is already mocked to return a mock embedder
      mockQueryOptimizer.optimize.mockResolvedValue(optimizedQuery);
      mockVectorStorageService.searchVectors.mockResolvedValue(vectorResults);
      mockGraphPersistenceService.search.mockResolvedValue(graphResults);
      mockResultFusionEngine.fuse.mockResolvedValue(fusedResults);
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.set.mockResolvedValue();
      mockPerformanceMonitor.recordQuery.mockResolvedValue();

      const result = await queryCoordinationService.executeQuery(queryRequest);

      expect(result.results).toEqual(fusedResults);
      expect(result.metrics.executionTime).toBeDefined();
      expect(mockQueryOptimizer.optimize).toHaveBeenCalledWith(queryRequest);
      expect(mockVectorStorageService.searchVectors).toHaveBeenCalled();
      expect(mockResultFusionEngine.fuse).toHaveBeenCalled();
      expect(mockQueryCache.get).toHaveBeenCalledWith(queryRequest);
      expect(mockQueryCache.set).toHaveBeenCalledWith(queryRequest, fusedResults);
      expect(mockPerformanceMonitor.recordQuery).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const queryRequest = {
        query: 'test query',
        projectId: 'test-project',
      };

      const cachedResults = [
        {
          id: '1',
          score: 0.9,
          filePath: '/path/to/file.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const cachedMetrics = {
        queryId: 'query_123',
        executionTime: 5,
        vectorSearchTime: 0,
        graphSearchTime: 0,
        fusionTime: 0,
        totalResults: 1,
        cacheHit: true,
        performance: {
          throughput: 200,
          latency: 5,
          successRate: 1,
        },
      };

      mockQueryCache.get.mockResolvedValue(cachedResults);

      const result = await queryCoordinationService.executeQuery(queryRequest);

      expect(result.results).toEqual(cachedResults);
      expect(result.metrics.cacheHit).toBe(true);
      expect(result.metrics.totalResults).toBe(cachedResults.length);
      expect(mockQueryCache.get).toHaveBeenCalledWith(queryRequest);
      expect(mockQueryOptimizer.optimize).not.toHaveBeenCalled();
    });
  });

  describe('executeBatchQueries', () => {
    it('should execute multiple queries and return results', async () => {
      const queryRequests = [
        {
          query: 'test query 1',
          projectId: 'test-project',
        },
        {
          query: 'test query 2',
          projectId: 'test-project',
        },
      ];

      const mockResults = [
        {
          results: [
            {
              id: '1',
              score: 0.9,
              filePath: '/path/to/file.ts',
              content: 'function test1() {}',
              startLine: 1,
              endLine: 3,
              language: 'typescript',
              chunkType: 'function',
              metadata: {},
            },
          ],
          metrics: {
            queryId: 'query_1',
            executionTime: 100,
            vectorSearchTime: 50,
            graphSearchTime: 30,
            fusionTime: 20,
            totalResults: 1,
            cacheHit: false,
            performance: {
              throughput: 10,
              latency: 100,
              successRate: 1,
            },
          },
        },
        {
          results: [
            {
              id: '2',
              score: 0.8,
              filePath: '/path/to/file.ts',
              content: 'function test2() {}',
              startLine: 5,
              endLine: 7,
              language: 'typescript',
              chunkType: 'function',
              metadata: {},
            },
          ],
          metrics: {
            queryId: 'query_2',
            executionTime: 120,
            vectorSearchTime: 60,
            graphSearchTime: 40,
            fusionTime: 20,
            totalResults: 1,
            cacheHit: false,
            performance: {
              throughput: 8.33,
              latency: 120,
              successRate: 1,
            },
          },
        },
      ];

      // Mock the executeQuery method to return the mock results
      const executeQuerySpy = jest
        .spyOn(queryCoordinationService, 'executeQuery')
        .mockImplementation(async request => {
          const index = queryRequests.indexOf(request);
          return mockResults[index];
        });

      const result = await queryCoordinationService.executeBatchQueries(queryRequests);

      // The actual result structure includes the query string, so adjust expectations
      expect(result.results.length).toBe(2);
      expect(result.results[0].query).toBe(queryRequests[0].query);
      expect(result.results[1].query).toBe(queryRequests[1].query);
      expect(result.results[0].results).toEqual(mockResults[0].results);
      expect(result.results[1].results).toEqual(mockResults[1].results);
      expect(result.totalMetrics.totalQueries).toBe(2);
      expect(executeQuerySpy).toHaveBeenCalledTimes(2);

      // Restore the original implementation
      executeQuerySpy.mockRestore();
    });
  });

  describe('getQueryPerformanceStats', () => {
    it('should return performance statistics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date(),
      };

      const mockStats = {
        totalQueries: 100,
        averageLatency: 150,
        cacheHitRate: 0.8,
        throughput: 50,
        errorRate: 0.02,
        topQueries: [
          {
            query: 'test query',
            count: 10,
            avgLatency: 120,
          },
        ],
      };

      // Mock the performance monitor to return expected stats
      const performanceStats = {
        totalQueries: 100,
        averageLatency: 150,
        cacheHitRate: 0.8,
        throughput: 50,
        errorRate: 0.02,
        topQueries: [
          {
            query: 'test query',
            count: 10,
            avgLatency: 120,
          },
        ],
      };

      mockPerformanceMonitor.getStats.mockResolvedValue(performanceStats as any);

      const result = await queryCoordinationService.getQueryPerformanceStats(timeRange);

      expect(result).toEqual(performanceStats);
      expect(mockPerformanceMonitor.getStats).toHaveBeenCalledWith(timeRange);
    });
  });
});
