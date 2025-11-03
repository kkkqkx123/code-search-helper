import { GraphSearchServiceNew } from '../GraphSearchService';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { GraphDatabaseService } from '../../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../../database/nebula/query/GraphQueryBuilder';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../infrastructure/monitoring/types';
import { GraphSearchResult } from '../types';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandler = {
  handleError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({ defaultTTL: 300 }),
};

const mockGraphDatabase = {
  isDatabaseConnected: jest.fn().mockReturnValue(true),
  initialize: jest.fn().mockResolvedValue(true),
  executeReadQuery: jest.fn().mockResolvedValue({ nodes: [], relationships: [] }),
  executeWriteQuery: jest.fn(),
  close: jest.fn(),
  useSpace: jest.fn(),
  deleteSpace: jest.fn(),
  spaceExists: jest.fn(),
  getCurrentSpace: jest.fn(),
};

const mockQueryBuilder = {};

const mockCacheService = {
  getFromCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
};

const mockPerformanceMonitor = {
  updateCacheHitRate: jest.fn(),
  recordQueryExecution: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({
    queryExecutionTimes: [],
    averageQueryTime: 0,
    cacheHitRate: 0,
    batchProcessingStats: { totalBatches: 0, successRate: 0 },
  }),
};

describe('GraphSearchServiceNew', () => {
  let graphSearchService: GraphSearchServiceNew;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    graphSearchService = new GraphSearchServiceNew(
      mockLogger as unknown as LoggerService,
      mockErrorHandler as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService,
      mockGraphDatabase as unknown as GraphDatabaseService,
      mockQueryBuilder as unknown as GraphQueryBuilder,
      mockCacheService as unknown as ICacheService,
      mockPerformanceMonitor as unknown as IPerformanceMonitor
    );
  });

  describe('initialize', () => {
    it('should initialize successfully when database is connected', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(true);

      const result = await graphSearchService.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph search service');
      expect(mockLogger.info).toHaveBeenCalledWith('Graph search service initialized successfully');
    });

    it('should initialize successfully when database is not connected', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);

      const result = await graphSearchService.initialize();

      expect(result).toBe(true);
      expect(mockGraphDatabase.initialize).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockRejectedValue(new Error('Connection failed'));

      const result = await graphSearchService.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search and return results', async () => {
      const mockResult = {
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts' }],
        relationships: [],
      };
      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);
      mockCacheService.getFromCache.mockReturnValue(null);

      const result = await graphSearchService.search('test query');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: expect.any(Number),
      });
      expect(mockCacheService.setCache).toHaveBeenCalled();
    });

    it('should return cached results if available', async () => {
      const cachedResult: GraphSearchResult = {
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: 0,
      };
      mockCacheService.getFromCache.mockReturnValue(cachedResult);

      const result = await graphSearchService.search('test query');

      expect(result).toEqual(cachedResult);
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(true);
      expect(mockGraphDatabase.executeReadQuery).not.toHaveBeenCalled();
    });

    it('should handle search error', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphSearchService.search('test query');

      expect(result).toEqual({
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: expect.any(Number),
      });
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('searchByNodeType', () => {
    it('should search by node type', async () => {
      const mockResult = [{ id: 'node1', type: 'file', name: 'test.ts' }];
      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);
      mockCacheService.getFromCache.mockReturnValue(null);

      const result = await graphSearchService.searchByNodeType('File');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: expect.any(Number),
      });
    });

    it('should return cached results for node type search', async () => {
      const cachedResult: GraphSearchResult = {
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: 0,
      };
      mockCacheService.getFromCache.mockReturnValue(cachedResult);

      const result = await graphSearchService.searchByNodeType('File');

      expect(result).toEqual(cachedResult);
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(true);
    });

    it('should handle node type search error', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphSearchService.searchByNodeType('File');

      expect(result).toEqual({
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: expect.any(Number),
      });
    });
  });

  describe('searchByRelationshipType', () => {
    it('should search by relationship type', async () => {
      const mockResult = [{ id: 'rel1', type: 'CALLS', src: 'node1', dst: 'node2', properties: {} }];
      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);
      mockCacheService.getFromCache.mockReturnValue(null);

      const result = await graphSearchService.searchByRelationshipType('CALLS');

      expect(result).toEqual({
        nodes: [],
        relationships: [{ id: 'rel1', type: 'CALLS', sourceId: 'node1', targetId: 'node2', properties: {} }],
        total: 1,
        executionTime: expect.any(Number),
      });
    });

    it('should handle relationship type search error', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphSearchService.searchByRelationshipType('CALLS');

      expect(result).toEqual({
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: expect.any(Number),
      });
    });
  });

  describe('searchByPath', () => {
    it('should search by path', async () => {
      const mockResult = {
        path: {
          nodes: [{ id: 'node1', type: 'file', name: 'test.ts' }],
          relationships: [{ id: 'rel1', type: 'CALLS', src: 'node1', dst: 'node2', properties: {} }],
        },
      };
      mockGraphDatabase.executeReadQuery.mockResolvedValue(mockResult);
      mockCacheService.getFromCache.mockReturnValue(null);

      const result = await graphSearchService.searchByPath('node1', 'node2');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [{ id: 'rel1', type: 'CALLS', sourceId: 'node1', targetId: 'node2', properties: {} }],
        total: 2,
        executionTime: expect.any(Number),
      });
    });

    it('should handle path search error', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphSearchService.searchByPath('node1', 'node2');

      expect(result).toEqual({
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: expect.any(Number),
      });
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return function-related suggestions', async () => {
      const result = await graphSearchService.getSearchSuggestions('function');

      expect(result).toEqual(['function name', 'function call', 'function definition']);
    });

    it('should return class-related suggestions', async () => {
      const result = await graphSearchService.getSearchSuggestions('class');

      expect(result).toEqual(['class inheritance', 'class methods', 'class properties']);
    });

    it('should return import-related suggestions', async () => {
      const result = await graphSearchService.getSearchSuggestions('import');

      expect(result).toEqual(['import path', 'import module', 'import dependency']);
    });

    it('should return file-related suggestions', async () => {
      const result = await graphSearchService.getSearchSuggestions('file');

      expect(result).toEqual(['file path', 'file content', 'file dependency']);
    });

    it('should return empty array when no matches', async () => {
      const result = await graphSearchService.getSearchSuggestions('unknown');

      expect(result).toEqual([]);
    });

    it('should handle suggestion error', async () => {
      // Force an error in the suggestion logic
      jest.spyOn(mockLogger, 'error').mockImplementation(() => { });

      const result = await graphSearchService.getSearchSuggestions('test');

      expect(result).toEqual([]);
    });
  });

  describe('getSearchStats', () => {
    it('should return search statistics', async () => {
      const stats = await graphSearchService.getSearchStats();

      expect(stats).toEqual({
        totalSearches: 0,
        avgExecutionTime: 0,
        cacheHitRate: 0,
      });
    });
  });

  describe('close', () => {
    it('should close the service', async () => {
      await graphSearchService.close();

      expect(mockLogger.info).toHaveBeenCalledWith('Closing graph search service');
      expect(mockLogger.info).toHaveBeenCalledWith('Graph search service closed successfully');
    });

    it('should handle close error', async () => {
      const originalError = new Error('Close failed');
      mockLogger.info.mockImplementation(() => { throw originalError; });

      await graphSearchService.close();

      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('isServiceInitialized', () => {
    it('should return initialization status', () => {
      expect(graphSearchService.isServiceInitialized()).toBe(false);
    });
  });

  describe('private methods', () => {
    it('should generate cache key correctly', () => {
      // Access private method using any type
      const generateCacheKey = (graphSearchService as any).generateCacheKey;
      const key = generateCacheKey('test query', { limit: 10 });

      expect(key).toBe('graph_search_test query_{"limit":10}');
    });
  });
});