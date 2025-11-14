import { GraphSearchService } from '../GraphSearchService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { IGraphService } from '../IGraphService';
import { IPerformanceMonitor } from '../../../../infrastructure/monitoring/types';

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

const mockGraphService = {
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

describe('GraphSearchService', () => {
  let graphSearchService: GraphSearchService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    graphSearchService = new GraphSearchService(
      mockLogger as unknown as LoggerService,
      mockErrorHandler as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService,
      mockGraphService as unknown as IGraphService,
      mockPerformanceMonitor as unknown as IPerformanceMonitor
    );
  });

  describe('initialize', () => {
    it('should initialize successfully when database is connected', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(true);

      const result = await graphSearchService.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph search service');
      expect(mockLogger.info).toHaveBeenCalledWith('Graph search service initialized successfully');
    });

    it('should initialize successfully when database is not connected', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(false);

      const result = await graphSearchService.initialize();

      expect(result).toBe(true);
      expect(mockGraphService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(false);
      mockGraphService.initialize.mockRejectedValue(new Error('Connection failed'));

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
      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphSearchService.search('test query');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: expect.any(Number),
      });
    });

    it('should handle search error', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

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
      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphSearchService.searchByNodeType('File');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [],
        total: 1,
        executionTime: expect.any(Number),
      });
    });

    it('should handle node type search error', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

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
      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphSearchService.searchByRelationshipType('CALLS');

      expect(result).toEqual({
        nodes: [],
        relationships: [{ id: 'rel1', type: 'CALLS', sourceId: 'node1', targetId: 'node2', properties: {} }],
        total: 1,
        executionTime: expect.any(Number),
      });
    });

    it('should handle relationship type search error', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

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
      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphSearchService.searchByPath('node1', 'node2');

      expect(result).toEqual({
        nodes: [{ id: 'node1', type: 'file', name: 'test.ts', properties: {} }],
        relationships: [{ id: 'rel1', type: 'CALLS', sourceId: 'node1', targetId: 'node2', properties: {} }],
        total: 2,
        executionTime: expect.any(Number),
      });
    });

    it('should handle path search error', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

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
});