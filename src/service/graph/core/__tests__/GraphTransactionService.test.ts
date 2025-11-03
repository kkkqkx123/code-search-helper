import { GraphTransactionService, GraphTransactionConfig } from '../GraphTransactionService';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { GraphDatabaseService } from '../../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../../database/nebula/query/GraphQueryBuilder';
import { IBatchOptimizer } from '../../../../infrastructure/batching/types';
import { ICacheService } from '../../../../infrastructure/caching/types';
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
  get: jest.fn().mockReturnValue({ defaultTTL: 30 }),
};

const mockGraphDatabase = {
  isDatabaseConnected: jest.fn().mockReturnValue(true),
  initialize: jest.fn().mockResolvedValue(true),
  executeReadQuery: jest.fn(),
  executeWriteQuery: jest.fn().mockResolvedValue({}),
  close: jest.fn(),
  useSpace: jest.fn(),
  deleteSpace: jest.fn().mockResolvedValue(true),
  spaceExists: jest.fn().mockResolvedValue(true),
  getCurrentSpace: jest.fn().mockReturnValue('test_space'),
};

const mockQueryBuilder = {};

const mockBatchOptimizer = {
  executeWithOptimalBatching: jest.fn().mockResolvedValue([]),
};

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
    batchProcessingStats: { totalBatches: 10, successRate: 0.95 },
  }),
};

describe('GraphTransactionService', () => {
  let graphTransactionService: GraphTransactionService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    graphTransactionService = new GraphTransactionService(
      mockLogger as unknown as LoggerService,
      mockErrorHandler as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService,
      mockGraphDatabase as unknown as GraphDatabaseService,
      mockQueryBuilder as unknown as GraphQueryBuilder,
      mockBatchOptimizer as unknown as IBatchOptimizer,
      mockCacheService as unknown as ICacheService,
      mockPerformanceMonitor as unknown as IPerformanceMonitor
    );
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = graphTransactionService.getConfig();

      expect(config).toEqual({
        enableTransactions: false,
        maxBatchSize: 100,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully when database is connected', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(true);

      const result = await graphTransactionService.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph transaction service');
      expect(mockLogger.info).toHaveBeenCalledWith('Graph transaction service initialized successfully');
    });

    it('should initialize successfully when database is not connected', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);

      const result = await graphTransactionService.initialize();

      expect(result).toBe(true);
      expect(mockGraphDatabase.initialize).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockRejectedValue(new Error('Connection failed'));

      const result = await graphTransactionService.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('executeInTransaction', () => {
    it('should execute operations in transaction', async () => {
      const mockOperations = [
        { nGQL: 'INSERT VERTEX Test(id) VALUES "1":("1")', parameters: {} },
        { nGQL: 'INSERT VERTEX Test(id) VALUES "2":("2")', parameters: {} },
      ];
      const mockCallback = jest.fn().mockResolvedValue('callback result');

      const result = await graphTransactionService.executeInTransaction(mockOperations, mockCallback);

      expect(result).toBe('callback result');
      expect(mockGraphDatabase.executeWriteQuery).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenCalledWith([{}, {}]);
    });

    it('should initialize service if not initialized', async () => {
      const mockOperations = [
        { nGQL: 'INSERT VERTEX Test(id) VALUES "1":("1")', parameters: {} },
      ];
      const mockCallback = jest.fn().mockResolvedValue('result');

      // Initially not initialized
      const uninitService = new GraphTransactionService(
        mockLogger as unknown as LoggerService,
        mockErrorHandler as unknown as ErrorHandlerService,
        mockConfigService as unknown as ConfigService,
        mockGraphDatabase as unknown as GraphDatabaseService,
        mockQueryBuilder as unknown as GraphQueryBuilder,
        mockBatchOptimizer as unknown as IBatchOptimizer,
        mockCacheService as unknown as ICacheService,
        mockPerformanceMonitor as unknown as IPerformanceMonitor
      );

      await uninitService.executeInTransaction(mockOperations, mockCallback);

      expect(mockGraphDatabase.initialize).toHaveBeenCalled();
    });
  });

  describe('executeBatchInTransaction', () => {
    it('should execute batch operations', async () => {
      const mockOperations = [
        { nGQL: 'INSERT VERTEX Test(id) VALUES "1":("1")', parameters: {} },
        { nGQL: 'INSERT VERTEX Test(id) VALUES "2":("2")', parameters: {} },
      ];
      const mockCallback = jest.fn().mockResolvedValue('batch result');

      const result = await graphTransactionService.executeBatchInTransaction(mockOperations, mockCallback);

      expect(result).toBe('batch result');
      expect(mockBatchOptimizer.executeWithOptimalBatching).toHaveBeenCalled();
    });

    it('should handle batch execution error', async () => {
      const mockOperations = [
        { nGQL: 'INSERT VERTEX Test(id) VALUES "1":("1")', parameters: {} },
      ];
      const mockCallback = jest.fn().mockResolvedValue('batch result');

      mockBatchOptimizer.executeWithOptimalBatching.mockRejectedValue(new Error('Batch failed'));

      await expect(
        graphTransactionService.executeBatchInTransaction(mockOperations, mockCallback)
      ).rejects.toThrow('Batch failed');

      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('createProjectSpace', () => {
    it('should create project space successfully', async () => {
      const result = await graphTransactionService.createProjectSpace('test-project');

      expect(result).toBe(true);
      expect(mockGraphDatabase.executeWriteQuery).toHaveBeenCalled();
      expect(mockGraphDatabase.useSpace).toHaveBeenCalledWith('test-project');
    });

    it('should handle project space creation error', async () => {
      mockGraphDatabase.executeWriteQuery.mockRejectedValue(new Error('Creation failed'));

      const result = await graphTransactionService.createProjectSpace('test-project');

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('deleteProjectSpace', () => {
    it('should delete project space successfully', async () => {
      const result = await graphTransactionService.deleteProjectSpace('test-project');

      expect(result).toBe(true);
      expect(mockGraphDatabase.deleteSpace).toHaveBeenCalledWith('test-project');
    });

    it('should handle project space deletion error', async () => {
      mockGraphDatabase.deleteSpace.mockRejectedValue(new Error('Deletion failed'));

      const result = await graphTransactionService.deleteProjectSpace('test-project');

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('projectSpaceExists', () => {
    it('should return true if project space exists', async () => {
      const result = await graphTransactionService.projectSpaceExists('test-project');

      expect(result).toBe(true);
      expect(mockGraphDatabase.spaceExists).toHaveBeenCalledWith('test-project');
    });

    it('should return false if project space does not exist', async () => {
      mockGraphDatabase.spaceExists.mockResolvedValue(false);

      const result = await graphTransactionService.projectSpaceExists('test-project');

      expect(result).toBe(false);
    });

    it('should handle space existence check error', async () => {
      mockGraphDatabase.spaceExists.mockRejectedValue(new Error('Check failed'));

      const result = await graphTransactionService.projectSpaceExists('test-project');

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics', async () => {
      const stats = await graphTransactionService.getTransactionStats();

      expect(stats).toEqual({
        activeTransactions: 0,
        averageOperationCount: 0,
        averageDuration: 0,
        successRate: 0.95,
      });
    });

    it('should handle stats retrieval error', async () => {
      mockPerformanceMonitor.getMetrics.mockImplementation(() => {
        throw new Error('Metrics error');
      });

      const stats = await graphTransactionService.getTransactionStats();

      expect(stats).toEqual({
        activeTransactions: 0,
        averageOperationCount: 0,
        averageDuration: 0,
        successRate: 0,
      });
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('isServiceInitialized', () => {
    it('should return initialization status', () => {
      expect(graphTransactionService.isServiceInitialized()).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig: Partial<GraphTransactionConfig> = {
        maxBatchSize: 200,
        maxRetries: 5,
      };

      graphTransactionService.updateConfig(newConfig);

      const config = graphTransactionService.getConfig();
      expect(config.maxBatchSize).toBe(200);
      expect(config.maxRetries).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith('Graph transaction configuration updated', { config: expect.any(Object) });
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const config = graphTransactionService.getConfig();
      const originalConfig = { ...config };

      // Modify the returned config
      (config as any).maxBatchSize = 99;

      // Get config again to make sure it's not affected by the modification
      const config2 = graphTransactionService.getConfig();

      expect(config2.maxBatchSize).toBe(originalConfig.maxBatchSize);
    });
  });

  describe('close', () => {
    it('should close the service', async () => {
      await graphTransactionService.close();

      expect(mockLogger.info).toHaveBeenCalledWith('Closing graph transaction service');
      expect(mockLogger.info).toHaveBeenCalledWith('Graph transaction service closed successfully');
      expect(mockGraphDatabase.close).toHaveBeenCalled();
    });

    it('should handle close error', async () => {
      mockGraphDatabase.close.mockRejectedValue(new Error('Close failed'));

      await expect(graphTransactionService.close()).rejects.toThrow('Close failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });
});