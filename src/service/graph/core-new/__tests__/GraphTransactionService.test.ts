import { GraphTransactionService } from '../GraphTransactionService';
import { IGraphTransactionService } from '../types';

// Mock dependencies
jest.mock('../../../database/graph/GraphDatabaseService');
jest.mock('../../../database/core/TransactionManager');
jest.mock('../../../infrastructure/batching/BatchOptimizer');
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');

describe('GraphTransactionService', () => {
  let graphTransactionService: IGraphTransactionService;
  let mockGraphDatabaseService: any;
  let mockTransactionManager: any;
  let mockBatchOptimizer: any;
  let mockLoggerService: any;
  let mockErrorHandlerService: any;

  beforeEach(() => {
    // Import mocked modules
    const GraphDatabaseService = require('../../../database/graph/GraphDatabaseService').GraphDatabaseService;
    const BatchOptimizer = require('../../../infrastructure/batching/BatchOptimizer').BatchOptimizer;
    const LoggerService = require('../../../utils/LoggerService').LoggerService;
    const ErrorHandlerService = require('../../../utils/ErrorHandlerService').ErrorHandlerService;
  
    // Create mock instances
    mockGraphDatabaseService = new GraphDatabaseService();
    mockBatchOptimizer = new BatchOptimizer();
    mockLoggerService = new LoggerService();
    mockErrorHandlerService = new ErrorHandlerService();
    
    // Create a mock transaction manager
    mockTransactionManager = {
      executeTransaction: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn()
    };

    // Create service instance with mocks
    graphTransactionService = new GraphTransactionService(
      mockLoggerService,
      mockErrorHandlerService,
      {} as any, // ConfigService
      mockGraphDatabaseService,
      {} as any, // GraphQueryBuilder
      mockBatchOptimizer,
      {} as any, // CacheService
      {} as any, // PerformanceMonitor
      mockTransactionManager
    );
  });

  describe('initialize', () => {
    it('should initialize the service', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(true);
      
      const result = await graphTransactionService.initialize();
      
      expect(result).toBe(true);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(false);
      
      const result = await graphTransactionService.initialize();
      
      expect(result).toBe(false);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });
  });

  describe('executeTransaction', () => {
    it('should execute a transaction successfully', async () => {
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

    it('should handle transaction execution failure', async () => {
      const queries = [
        { nGQL: 'CREATE (n:Node {name: "test1"})', parameters: {} }
      ];
      
      mockTransactionManager.executeTransaction.mockRejectedValue(new Error('Transaction failed'));
      
      const result = await graphTransactionService.executeTransaction(queries);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Transaction failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('executeBatchTransaction', () => {
    it('should execute a batch transaction with optimal batch size', async () => {
      const operations = [
        { type: 'CREATE_NODE', data: { tag: 'Function', id: 'func-1', properties: { name: 'func1' } } },
        { type: 'CREATE_NODE', data: { tag: 'Function', id: 'func-2', properties: { name: 'func2' } } },
        { type: 'CREATE_RELATIONSHIP', data: { type: 'CALLS', sourceId: 'func-1', targetId: 'func-2', properties: {} } }
      ];
      
      const options = { batchSize: 2 };
      
      mockBatchOptimizer.calculateOptimalBatchSize.mockReturnValue(2);
      mockTransactionManager.executeTransaction.mockResolvedValue({ success: true });
      
      const result = await graphTransactionService.executeBatchTransaction(operations, options);
      
      expect(result.success).toBe(true);
      expect(mockBatchOptimizer.calculateOptimalBatchSize).toHaveBeenCalledWith(3);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledTimes(2);
    });

    it('should handle batch transaction with mixed operation types', async () => {
      const operations = [
        { type: 'CREATE_NODE', data: { tag: 'Function', id: 'func-1', properties: { name: 'func1' } } },
        { type: 'UPDATE_NODE', data: { tag: 'Function', id: 'func-2', properties: { name: 'updatedFunc' } } },
        { type: 'DELETE_NODE', data: { id: 'func-3' } }
      ];
      
      mockBatchOptimizer.calculateOptimalBatchSize.mockReturnValue(3);
      mockTransactionManager.executeTransaction.mockResolvedValue({ success: true });
      
      const result = await graphTransactionService.executeBatchTransaction(operations);
      
      expect(result.success).toBe(true);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalled();
      
      // Verify the queries passed to transaction manager
      const transactionCalls = mockTransactionManager.executeTransaction.mock.calls;
      expect(transactionCalls.length).toBe(1);
      
      const queries = transactionCalls[0][0];
      expect(queries[0].nGQL).toContain('INSERT VERTEX');
      expect(queries[1].nGQL).toContain('UPDATE VERTEX');
      expect(queries[2].nGQL).toContain('DELETE VERTEX');
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });
      
      const result = await graphTransactionService.executeWithRetry(operation);
      
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry operation on failure', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ success: true });
      
      mockBatchOptimizer.shouldRetry.mockReturnValue(true);
      
      const result = await graphTransactionService.executeWithRetry(operation);
      
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockBatchOptimizer.shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should stop retrying after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      mockBatchOptimizer.shouldRetry
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      const result = await graphTransactionService.executeWithRetry(operation);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Persistent error');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockBatchOptimizer.shouldRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe('executeWithTimeout', () => {
    it('should execute operation within timeout', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });
      
      const result = await graphTransactionService.executeWithTimeout(operation, 1000);
      
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should timeout if operation takes too long', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 200);
        });
      });
      
      const result = await graphTransactionService.executeWithTimeout(operation, 100);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Operation timed out');
    });
  });

  describe('begin', () => {
    it('should begin a new transaction', async () => {
      mockTransactionManager.beginTransaction.mockResolvedValue('tx-123');
      
      const result = await graphTransactionService.begin();
      
      expect(result).toBe('tx-123');
      expect(mockTransactionManager.beginTransaction).toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    it('should commit a transaction', async () => {
      const transactionId = 'tx-123';
      
      mockTransactionManager.commitTransaction.mockResolvedValue(true);
      
      const result = await graphTransactionService.commit(transactionId);
      
      expect(result).toBe(true);
      expect(mockTransactionManager.commitTransaction).toHaveBeenCalledWith(transactionId);
    });
  });

  describe('rollback', () => {
    it('should rollback a transaction', async () => {
      const transactionId = 'tx-123';
      
      mockTransactionManager.rollbackTransaction.mockResolvedValue(true);
      
      const result = await graphTransactionService.rollback(transactionId);
      
      expect(result).toBe(true);
      expect(mockTransactionManager.rollbackTransaction).toHaveBeenCalledWith(transactionId);
    });
  });

  describe('close', () => {
    it('should close the graph database service', async () => {
      await graphTransactionService.close();
      
      expect(mockGraphDatabaseService.close).toHaveBeenCalled();
    });
  });
});