import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
// import { NebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';

// Mock the Nebula client
jest.mock('@nebula-contrib/nebula-nodejs', () => ({
  createClient: jest.fn(),
}));

// Mock dependencies
jest.mock('../../../../src/core/LoggerService');
jest.mock('../../../../src/core/ErrorHandlerService');
jest.mock('../../../../src/config/ConfigService');
jest.mock('../../../../src/database/nebula/NebulaQueryBuilder', () => {
  return {
    NebulaQueryBuilder: jest.fn().mockImplementation(() => {
      return {
        insertVertex: jest.fn(),
        insertEdge: jest.fn(),
        match: jest.fn(),
        go: jest.fn(),
        parameterize: jest.fn(),
      };
    }),
  };
});

describe('NebulaConnectionManager', () => {
  let nebulaConnectionManager: NebulaConnectionManager;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // 使用假定时器以更好地控制异步操作
    jest.useFakeTimers();

    // Create mock instances
    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockConfigService = {
      getAll: jest.fn().mockReturnValue({
        nebula: {
          host: 'localhost',
          port: 9669,
          username: 'root',
          password: 'nebula',
          space: 'test_space',
        },
      }),
    } as any;

    // Create mock client
    mockClient = {
      on: jest.fn((event, callback) => {
        if (event === 'ready') {
          // 使用fake timers，立即调用callback
          callback();
        }
        return mockClient;
      }),
      removeListener: jest.fn(function (event, callback) {
        // 简单实现，实际测试中不需要真正移除监听器
        return this;
      }),
      removeAllListeners: jest.fn(function () {
        // 简单实现，实际测试中不需要真正移除所有监听器
        return this;
      }),
      execute: jest.fn(),
      close: jest.fn(),
    };

    // Mock createClient
    const { createClient } = require('@nebula-contrib/nebula-nodejs');
    (createClient as jest.Mock).mockReturnValue(mockClient);

    // Create NebulaConnectionManager instance
    nebulaConnectionManager = new NebulaConnectionManager(
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService
    );

    // Get the mock query builder instance
    // const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
    // const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;
  });

  describe('connect', () => {
    it('should connect to NebulaGraph successfully', async () => {
      const result = await nebulaConnectionManager.connect();

      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Connected to NebulaGraph successfully (connection pool initialized)');
      // 由于连接池初始化，mockClient.on可能被调用多次，所以我们不检查具体次数
      expect(mockClient.on).toHaveBeenCalled();
    });

    it('should handle connection timeout', async () => {
      // 模拟createClient抛出超时错误
      const { createClient } = require('@nebula-contrib/nebula-nodejs');
      (createClient as jest.Mock).mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      // 由于连接池实现，即使连接创建失败也会成功初始化池
      const resultPromise = nebulaConnectionManager.connect();
      
      // 推进所有定时器
      jest.runAllTimers();
      
      const result = await resultPromise;
      expect(result).toBe(true);
      // 但应该记录警告
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      // 模拟createClient抛出连接错误
      const { createClient } = require('@nebula-contrib/nebula-nodejs');
      (createClient as jest.Mock).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // 由于连接池实现，即使连接创建失败也会成功初始化池
      const resultPromise = nebulaConnectionManager.connect();
      
      // 推进所有定时器
      jest.runAllTimers();
      
      const result = await resultPromise;
      expect(result).toBe(true);
      // 但应该记录警告
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    afterEach(async () => {
      // 确保每个测试后都断开连接，清理定时器
      try {
        await nebulaConnectionManager.disconnect();
      } catch (error) {
        // 忽略断开连接错误
      }
    });

    it('should disconnect from NebulaGraph', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      // Then disconnect
      await nebulaConnectionManager.disconnect();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Disconnected from NebulaGraph successfully'
      );
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(false);
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      const query = 'MATCH (n) RETURN n LIMIT 1';
      const mockResult = { data: [{ id: 1, name: 'test' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.executeQuery(query);

      expect(result).toEqual(mockResult);
      expect(mockClient.execute).toHaveBeenCalledWith(query, false, undefined);
    });

    it('should throw error when not connected', async () => {
      const query = 'MATCH (n) RETURN n LIMIT 1';

      await expect(nebulaConnectionManager.executeQuery(query)).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });

    it('should handle query execution error', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      const query = 'INVALID QUERY';
      const error = new Error('Syntax error');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.executeQuery(query)).rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('isConnectedToDatabase', () => {
    it('should return false when not connected', () => {
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(false);
    });

    it('should return true when connected', async () => {
      await nebulaConnectionManager.connect();
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(true);
    });
  });

  describe('getReadSession', () => {
    it('should return client when connected', async () => {
      await nebulaConnectionManager.connect();
      const session = await nebulaConnectionManager.getReadSession();
      expect(session).toBe(mockClient);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getReadSession()).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('getWriteSession', () => {
    it('should return client when connected', async () => {
      await nebulaConnectionManager.connect();
      const session = await nebulaConnectionManager.getWriteSession();
      expect(session).toBe(mockClient);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getWriteSession()).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      await nebulaConnectionManager.connect();

      const queries = [
        { query: 'INSERT VERTEX person(name) VALUES 1:("Alice")' },
        { query: 'INSERT VERTEX person(name) VALUES 2:("Bob")' },
      ];

      const mockResults = [{}, {}];
      mockClient.execute.mockResolvedValueOnce(mockResults[0]);
      mockClient.execute.mockResolvedValueOnce(mockResults[1]);

      const results = await nebulaConnectionManager.executeTransaction(queries);

      expect(results).toEqual(mockResults);
      expect(mockClient.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw error when not connected', async () => {
      const queries = [{ query: 'INSERT VERTEX person(name) VALUES 1:("Alice")' }];

      await expect(nebulaConnectionManager.executeTransaction(queries)).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });

    it('should handle transaction execution error', async () => {
      await nebulaConnectionManager.connect();

      const queries = [{ query: 'INVALID QUERY' }];
      const error = new Error('Syntax error');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.executeTransaction(queries)).rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  describe('beginTransaction', () => {
    it('should begin transaction successfully', async () => {
      await nebulaConnectionManager.connect();
      
      mockClient.execute.mockResolvedValueOnce({}); // BEGIN TRANSACTION
      mockClient.execute.mockResolvedValueOnce({}); // Some operation
      
      const transaction = await nebulaConnectionManager.beginTransaction();
      await transaction.execute('INSERT VERTEX person(name) VALUES "1":("Alice")');
      
      expect(mockClient.execute).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(2, 'INSERT VERTEX person(name) VALUES "1":("Alice")', false, undefined);
    });
    
    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.beginTransaction()).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
    
    it('should handle begin transaction error', async () => {
      await nebulaConnectionManager.connect();
      
      const error = new Error('Transaction begin failed');
      mockClient.execute.mockRejectedValue(error);
      
      await expect(nebulaConnectionManager.beginTransaction()).rejects.toThrow(error);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('TransactionContext', () => {
    it('should commit transaction successfully', async () => {
      await nebulaConnectionManager.connect();
      
      mockClient.execute.mockResolvedValueOnce({}); // BEGIN TRANSACTION
      mockClient.execute.mockResolvedValueOnce({}); // COMMIT
      
      const transaction = await nebulaConnectionManager.beginTransaction();
      await transaction.commit();
      
      expect(mockClient.execute).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(2, 'COMMIT', false);
    });
    
    it('should rollback transaction successfully', async () => {
      await nebulaConnectionManager.connect();
      
      mockClient.execute.mockResolvedValueOnce({}); // BEGIN TRANSACTION
      mockClient.execute.mockResolvedValueOnce({}); // ROLLBACK
      
      const transaction = await nebulaConnectionManager.beginTransaction();
      await transaction.rollback();
      
      expect(mockClient.execute).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(2, 'ROLLBACK', false);
    });
    
    it('should prevent operations after commit', async () => {
      await nebulaConnectionManager.connect();
      
      mockClient.execute.mockResolvedValueOnce({}); // BEGIN TRANSACTION
      mockClient.execute.mockResolvedValueOnce({}); // COMMIT
      
      const transaction = await nebulaConnectionManager.beginTransaction();
      await transaction.commit();
      
      await expect(transaction.execute('INSERT VERTEX person(name) VALUES "1":("Alice")'))
        .rejects.toThrow('Transaction has already been committed or rolled back');
    });
    
    it('should prevent operations after rollback', async () => {
      await nebulaConnectionManager.connect();
      
      mockClient.execute.mockResolvedValueOnce({}); // BEGIN TRANSACTION
      mockClient.execute.mockResolvedValueOnce({}); // ROLLBACK
      
      const transaction = await nebulaConnectionManager.beginTransaction();
      await transaction.rollback();
      
      await expect(transaction.execute('INSERT VERTEX person(name) VALUES "1":("Alice")'))
        .rejects.toThrow('Transaction has already been committed or rolled back');
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should track query execution time', async () => {
      await nebulaConnectionManager.connect();
      
      const query = 'MATCH (n) RETURN n LIMIT 1';
      const mockResult = { data: [{ id: 1, name: 'test' }] };
      
      // Mock the execute function to simulate some delay
      const originalExecute = mockClient.execute;
      mockClient.execute.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockResult;
      });
      
      // Use real timers for this test to properly measure time
      jest.useRealTimers();
      
      const result = await nebulaConnectionManager.executeQuery(query);
      
      const perfStats = nebulaConnectionManager.getPerformanceStats();
      expect(perfStats.totalQueriesExecuted).toBe(1);
      expect(perfStats.totalQueryExecutionTime).toBeGreaterThan(0);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
    
    it('should track connection acquisition time', async () => {
      await nebulaConnectionManager.connect();
      
      // Empty the connection pool to force a new connection creation
      (nebulaConnectionManager as any).connectionPool = [];
      
      // Mock the createNewConnection method to simulate some delay
      const originalCreateNewConnection = (nebulaConnectionManager as any).createNewConnection;
      jest.spyOn(nebulaConnectionManager as any, 'createNewConnection').mockImplementation(async () => {
        // Simulate some connection creation time
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockClient;
      });
      
      // Use real timers for this test to properly measure time
      jest.useRealTimers();
      
      // Get a session to track acquisition time
      const session = await nebulaConnectionManager.getReadSession();
      nebulaConnectionManager.releaseConnection(session);
      
      const perfStats = nebulaConnectionManager.getPerformanceStats();
      expect(perfStats.totalConnectionsAcquired).toBe(1);
      expect(perfStats.totalConnectionAcquisitionTime).toBeGreaterThan(0);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
      
      // Restore original method
      ((nebulaConnectionManager as any).createNewConnection as jest.Mock).mockRestore();
    });
    
    it('should reset performance stats', async () => {
      await nebulaConnectionManager.connect();
      
      const query = 'MATCH (n) RETURN n LIMIT 1';
      const mockResult = { data: [{ id: 1, name: 'test' }] };
      mockClient.execute.mockResolvedValue(mockResult);
      
      await nebulaConnectionManager.executeQuery(query);
      
      // Check stats are not zero
      const perfStatsBefore = nebulaConnectionManager.getPerformanceStats();
      expect(perfStatsBefore.totalQueriesExecuted).toBe(1);
      
      // Reset stats
      nebulaConnectionManager.resetPerformanceStats();
      
      // Check stats are reset
      const perfStatsAfter = nebulaConnectionManager.getPerformanceStats();
      expect(perfStatsAfter.totalQueriesExecuted).toBe(0);
      expect(perfStatsAfter.totalQueryExecutionTime).toBe(0);
    });
  });
  });

  describe('createNode', () => {
    it('should create node successfully', async () => {
      await nebulaConnectionManager.connect();

      const node = {
        label: 'person',
        id: '1',
        properties: { name: 'Alice', age: 30 },
      };

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.insertVertex.mockReturnValue({
        query: 'INSERT VERTEX person(name, age) VALUES 1:($param0, $param1)',
        params: { param0: 'Alice', param1: 30 },
      });

      mockClient.execute.mockResolvedValue({});

      const result = await nebulaConnectionManager.createNode(node);

      expect(result).toBe('1');
      expect(mockQueryBuilderInstance.insertVertex).toHaveBeenCalledWith('person', '1', {
        name: 'Alice',
        age: 30,
      });
      expect(mockClient.execute).toHaveBeenCalledWith(
        'INSERT VERTEX person(name, age) VALUES 1:($param0, $param1)',
        false,
        { param0: 'Alice', param1: 30 }
      );
    });

    it('should throw error when not connected', async () => {
      const node = {
        label: 'person',
        id: '1',
        properties: { name: 'Alice' },
      };

      await expect(nebulaConnectionManager.createNode(node)).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('createRelationship', () => {
    it('should create relationship successfully', async () => {
      await nebulaConnectionManager.connect();

      const relationship = {
        type: 'knows',
        srcId: '1',
        dstId: '2',
        properties: { since: 2020 },
      };

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.insertEdge.mockReturnValue({
        query: 'INSERT EDGE knows(since) VALUES 1->2:($param0)',
        params: { param0: 2020 },
      });

      mockClient.execute.mockResolvedValue({});

      const result = await nebulaConnectionManager.createRelationship(relationship);

      expect(result).toBe('1->2');
      expect(mockQueryBuilderInstance.insertEdge).toHaveBeenCalledWith('knows', '1', '2', {
        since: 2020,
      });
      expect(mockClient.execute).toHaveBeenCalledWith(
        'INSERT EDGE knows(since) VALUES 1->2:($param0)',
        false,
        { param0: 2020 }
      );
    });

    it('should throw error when not connected', async () => {
      const relationship = {
        type: 'knows',
        srcId: '1',
        dstId: '2',
        properties: {},
      };

      await expect(nebulaConnectionManager.createRelationship(relationship)).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('findNodesByLabel', () => {
    it('should find nodes by label successfully', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n:person) RETURN n');

      const mockResult = { data: [{ id: 1, name: 'Alice' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findNodesByLabel('person');

      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith('(n:person)', 'n', undefined);
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n:person) RETURN n',
        false,
        undefined
      );
    });

    it('should find nodes by label with properties', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue(
        'MATCH (n:person) WHERE n.name = $name RETURN n'
      );

      const mockResult = { data: [{ id: 1, name: 'Alice' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findNodesByLabel('person', { name: 'Alice' });

      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n:person)',
        'n',
        'n.name = $name'
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n:person) WHERE n.name = $name RETURN n',
        false,
        { name: 'Alice' }
      );
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.findNodesByLabel('person')).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('findRelationships', () => {
    it('should find relationships successfully', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n1)-[r]->(n2) RETURN r, n1, n2');

      const mockResult = { data: [{ src: 1, dst: 2, type: 'knows' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findRelationships();

      expect(result).toEqual([{ src: 1, dst: 2, type: 'knows' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n1)-[r]->(n2)',
        'r, n1, n2',
        undefined
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n1)-[r]->(n2) RETURN r, n1, n2',
        false,
        undefined
      );
    });

    it('should find relationships with type filter', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n1)-[r:knows]->(n2) RETURN r, n1, n2');

      const mockResult = { data: [{ src: 1, dst: 2, type: 'knows' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findRelationships('knows');

      expect(result).toEqual([{ src: 1, dst: 2, type: 'knows' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n1)-[r:knows]->(n2)',
        'r, n1, n2',
        undefined
      );
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.findRelationships()).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });
  });

  describe('getDatabaseStats', () => {
    it('should get database stats successfully', async () => {
      await nebulaConnectionManager.connect();

      const mockSpacesResult = { data: [{ name: 'test_space' }] };
      const mockHostsResult = { data: [{ host: 'localhost', port: 9669 }] };
      const mockPartsResult = { data: [{ part_id: 1, leader: 'localhost:9669' }] };

      mockClient.execute
        .mockResolvedValueOnce(mockSpacesResult)
        .mockResolvedValueOnce(mockHostsResult)
        .mockResolvedValueOnce(mockPartsResult);

      const result = await nebulaConnectionManager.getDatabaseStats();

      expect(result).toEqual({
        spaces: [{ name: 'test_space' }],
        hosts: [{ host: 'localhost', port: 9669 }],
        parts: [{ part_id: 1, leader: 'localhost:9669' }],
      });

      expect(mockClient.execute).toHaveBeenCalledTimes(3);
      expect(mockClient.execute).toHaveBeenNthCalledWith(1, 'SHOW SPACES', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(2, 'SHOW HOSTS', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(3, 'SHOW PARTS', false);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getDatabaseStats()).rejects.toThrow(
        'Not connected to NebulaGraph'
      );
    });

    it('should handle stats retrieval error', async () => {
      await nebulaConnectionManager.connect();

      const error = new Error('Stats retrieval failed');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.getDatabaseStats()).rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});
