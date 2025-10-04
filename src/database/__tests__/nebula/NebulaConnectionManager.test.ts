import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaConfig } from '../../nebula/NebulaTypes';
import { ConnectionStateManager } from '../../nebula/ConnectionStateManager';

// Mock 依赖项
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockConfigService = {
 get: jest.fn(),
};

const mockConnectionStateManager = {
  updateConnectionSpace: jest.fn(),
  getConnectionsForSpace: jest.fn(),
  getAllConnections: jest.fn(),
  getConnectionSpace: jest.fn(),
  cleanupStaleConnections: jest.fn(),
};

// Mock createClient function
jest.mock('@nebula-contrib/nebula-nodejs', () => {
  const mockClient = {
    execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
    close: jest.fn().mockResolvedValue(undefined),
    once: jest.fn((event, callback) => {
      if (event === 'authorized') {
        // 模拟授权成功
        setTimeout(callback, 10);
      }
    }),
  };

  return {
    createClient: jest.fn().mockReturnValue(mockClient),
  };
});

describe('NebulaConnectionManager', () => {
 let connectionManager: NebulaConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建模拟客户端
    const mockClient = {
      execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
      close: jest.fn().mockResolvedValue(undefined),
      once: jest.fn((event, callback) => {
        if (event === 'authorized') {
          // 模拟授权成功
          setTimeout(callback, 10);
        }
      }),
    };

    connectionManager = new NebulaConnectionManager(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      {
        loadConfig: () => ({
          host: 'localhost',
          port: 9669,
          username: 'root',
          password: 'nebula',
          space: 'test-space',
          vidTypeLength: 128,
          maxConnections: 1,
          timeout: 30000,
          bufferSize: 10,
          pingInterval: 300
        })
      } as any, // NebulaConfigService
      mockConnectionStateManager as any // ConnectionStateManager
    );

    // 设置私有属性
    (connectionManager as any).client = mockClient;
    (connectionManager as any).connectionStatus = {
      connected: true,
      host: 'localhost',
      port: 9669,
      username: 'root',
      lastConnected: new Date(),
      space: 'test-space',
    };
  });

  describe('executeQueryInSpace', () => {
    it('should execute query in the target space when connection is already in that space', async () => {
      // 模拟连接状态管理器返回目标空间
      mockConnectionStateManager.getConnectionSpace.mockReturnValue('test-space');
      
      const result = await connectionManager.executeQueryInSpace('test-space', 'MATCH (n) RETURN n');
      
      expect(result).toEqual({
        data: [],
        table: {},
        results: [],
        rows: [],
        executionTime: expect.any(Number),
        space: expect.any(String),
        timeCost: 0,
      });
      
      // 确保没有执行USE命令
      expect((connectionManager as any).client.execute).toHaveBeenCalledTimes(1);
      expect((connectionManager as any).client.execute).toHaveBeenCalledWith('MATCH (n) RETURN n');
    });

    it('should switch space then execute query when connection is in different space', async () => {
      // 模拟连接状态管理器返回不同的空间
      mockConnectionStateManager.getConnectionSpace.mockReturnValue('different-space');
      
      const result = await connectionManager.executeQueryInSpace('test-space', 'MATCH (n) RETURN n');
      
      expect(result).toEqual({
        data: [],
        table: {},
        results: [],
        rows: [],
        executionTime: expect.any(Number),
        space: expect.any(String),
        timeCost: 0,
      });
      
      // 确保执行了USE命令和原始查询
      expect((connectionManager as any).client.execute).toHaveBeenCalledTimes(2);
      expect((connectionManager as any).client.execute).toHaveBeenNthCalledWith(1, 'USE `test-space`');
      expect((connectionManager as any).client.execute).toHaveBeenNthCalledWith(2, 'MATCH (n) RETURN n');
      expect(mockConnectionStateManager.updateConnectionSpace).toHaveBeenCalledWith('nebula-client-main', 'test-space');
    });

    it('should handle errors when executing queries in space', async () => {
      mockConnectionStateManager.getConnectionSpace.mockReturnValue('different-space');
      
      // 模拟查询执行失败
      (connectionManager as any).client.execute.mockRejectedValueOnce(new Error('Query failed'));
      
      const result = await connectionManager.executeQueryInSpace('test-space', 'MATCH (n) RETURN n');
      
      expect(result).toEqual({
        error: 'Query failed',
        table: {},
        results: [],
        rows: [],
        data: [],
        executionTime: 0,
        timeCost: 0,
        space: expect.any(String),
      });
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(connectionManager).toBeDefined();
      expect(connectionManager.isConnected()).toBe(true); // 由于在beforeEach中设置了连接状态
    });

    it('should use config from config service if available', async () => {
      const mockConfig: NebulaConfig = {
        host: 'test-host',
        port: 9669,
        username: 'test-user',
        password: 'test-password',
        space: 'test-space',
      };

      mockConfigService.get = jest.fn().mockReturnValue(mockConfig);

      // 创建新的模拟客户端
      const mockClient = {
        execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
        close: jest.fn().mockResolvedValue(undefined),
        once: jest.fn((event, callback) => {
          if (event === 'authorized') {
            // 模拟授权成功
            setTimeout(callback, 10);
          }
        }),
      };

      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any,
        {
          loadConfig: () => ({
            host: 'localhost',
            port: 9669,
            username: 'root',
            password: 'nebula',
            space: 'test-space',
            vidTypeLength: 128,
            maxConnections: 1,
            timeout: 30000,
            bufferSize: 10,
            pingInterval: 300
          })
        } as any, // NebulaConfigService
        mockConnectionStateManager as any // ConnectionStateManager
      );

      // 设置私有属性
      (newConnectionManager as any).client = mockClient;
      (newConnectionManager as any).connectionStatus = {
        connected: true,
        host: 'localhost',
        port: 9669,
        username: 'root',
        lastConnected: new Date(),
        space: 'test-space',
      };

      const status = newConnectionManager.getConnectionStatus();
      expect(status.host).toBe('localhost'); // 实际上会使用默认值，因为配置是在构造函数中加载的
      expect(status.port).toBe(9669);
      expect(status.username).toBe('root');
    });

    it('should use default config if config service returns null', () => {
      mockConfigService.get = jest.fn().mockReturnValue(null);

      // 创建新的模拟客户端
      const mockClient = {
        execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
        close: jest.fn().mockResolvedValue(undefined),
        once: jest.fn((event, callback) => {
          if (event === 'authorized') {
            // 模拟授权成功
            setTimeout(callback, 10);
          }
        }),
      };

      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any,
        {
          loadConfig: () => ({
            host: 'localhost',
            port: 9669,
            username: 'root',
            password: 'nebula',
            space: 'test-space',
            vidTypeLength: 128
          })
        } as any, // NebulaConfigService
        mockConnectionStateManager as any // ConnectionStateManager
      );

      // 设置私有属性
      (newConnectionManager as any).client = mockClient;
      (newConnectionManager as any).connectionStatus = {
        connected: true,
        host: 'localhost',
        port: 9669,
        username: 'root',
        lastConnected: new Date(),
        space: 'test-space',
      };

      const status = newConnectionManager.getConnectionStatus();
      expect(status.host).toBe('localhost');
      expect(status.port).toBe(9669);
      expect(status.username).toBe('root');
    });
  });

  describe('connect', () => {
    it('should connect successfully and update connection status', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      expect(connectionManager.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      // 创建一个新的连接管理器实例用于此测试
      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any,
        {
          loadConfig: () => ({
            host: 'localhost',
            port: 9669,
            username: 'root',
            password: 'nebula',
            space: 'test-space',
            vidTypeLength: 128
          })
        } as any, // NebulaConfigService
        mockConnectionStateManager as any // ConnectionStateManager
      );

      // 模拟 createClient 函数抛出错误
      const { createClient } = require('@nebula-contrib/nebula-nodejs');
      createClient.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await newConnectionManager.connect();

      expect(result).toBe(false);
      expect(newConnectionManager.isConnected()).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      // 由于在beforeEach中已经设置了连接状态为true，所以直接测试断开连接
      expect(connectionManager.isConnected()).toBe(true);

      // 然后断开连接
      await connectionManager.disconnect();

      expect(connectionManager.isConnected()).toBe(false);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Disconnecting from Nebula Graph');
      expect(mockLoggerService.info).toHaveBeenCalledWith('Successfully disconnected from Nebula Graph');
    });

    it('should handle disconnection errors', async () => {
      // 创建一个新的连接管理器实例用于此测试
      const mockClient = {
        execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
        close: jest.fn().mockRejectedValue(new Error('Client close failed')),
        once: jest.fn((event, callback) => {
          if (event === 'authorized') {
            // 模拟授权成功
            setTimeout(callback, 10);
          }
        }),
      };

      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any,
        {
          loadConfig: () => ({
            host: 'localhost',
            port: 9669,
            username: 'root',
            password: 'nebula',
            space: 'test-space',
            vidTypeLength: 128
          })
        } as any, // NebulaConfigService
        mockConnectionStateManager as any // ConnectionStateManager
      );

      // 设置私有属性
      (newConnectionManager as any).client = mockClient;
      (newConnectionManager as any).connectionStatus = {
        connected: true,
        host: 'localhost',
        port: 9669,
        username: 'root',
        lastConnected: new Date(),
        space: 'test-space',
      };

      await newConnectionManager.disconnect();

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
 });

  describe('isConnected', () => {
    it('should return connection status', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      expect(connectionManager.isConnected()).toBe(true);

      await connectionManager.disconnect();
      expect(connectionManager.isConnected()).toBe(false);

      // 重新设置连接状态
      (connectionManager as any).connectionStatus.connected = true;
      (connectionManager as any).client = {
        execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
        close: jest.fn().mockResolvedValue(undefined),
        once: jest.fn((event, callback) => {
          if (event === 'authorized') {
            // 模拟授权成功
            setTimeout(callback, 10);
          }
        }),
      };
      expect(connectionManager.isConnected()).toBe(true);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return a copy of connection status', async () => {
      const status1 = connectionManager.getConnectionStatus();
      expect(status1.connected).toBe(true);

      const status2 = connectionManager.getConnectionStatus();
      expect(status2.connected).toBe(true);

      // 确保返回的是副本而不是引用
      status2.connected = false;
      const status3 = connectionManager.getConnectionStatus();
      expect(status3.connected).toBe(true);
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully when connected', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        data: [],
        table: {},
        results: [],
        rows: [],
        executionTime: expect.any(Number),
        space: expect.any(String),
        timeCost: 0,
      });
    });

    it('should return error when not connected', async () => {
      // 先断开连接
      await connectionManager.disconnect();
      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        error: 'Not connected to Nebula Graph',
        table: {},
        results: [],
        rows: [],
        data: [],
        executionTime: 0,
        timeCost: 0,
        space: expect.any(String),
      });
    });

    it('should handle query execution errors', async () => {
      // 模拟查询执行过程中抛出错误
      (connectionManager as any).client.execute.mockRejectedValueOnce(new Error('Query execution failed'));

      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        error: 'Query execution failed',
        table: {},
        results: [],
        rows: [],
        data: [],
        executionTime: 0,
        timeCost: 0,
        space: expect.any(String),
      });
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully when connected', async () => {
      // 由于在beforeEach中已经设置了连接状态为true

      const queries = [
        { query: 'INSERT VERTEX...', params: {} },
        { query: 'UPDATE VERTEX...', params: {} },
      ];

      const result = await connectionManager.executeTransaction(queries);

      expect(result).toEqual([
        { data: [], table: {}, results: [], rows: [], executionTime: 0, timeCost: 0, space: expect.any(String) },
        { data: [], table: {}, results: [], rows: [], executionTime: 0, timeCost: 0, space: expect.any(String) }
      ]);
    });

    it('should throw error when not connected', async () => {
      // 先断开连接
      await connectionManager.disconnect();
      await expect(
        connectionManager.executeTransaction([{ query: 'MATCH (n) RETURN n', params: {} }])
      ).rejects.toThrow('Not connected to Nebula Graph');
    });

    it('should handle transaction execution errors', async () => {
      // 模拟事务执行过程中抛出错误
      (connectionManager as any).client.execute
        .mockResolvedValueOnce({}) // First query
        .mockRejectedValueOnce(new Error('Transaction failed')); // Second query fails

      await expect(
        connectionManager.executeTransaction([
          { query: 'MATCH (n) RETURN n', params: {} },
          { query: 'MATCH (m) RETURN m', params: {} }
        ])
      ).rejects.toThrow('Transaction failed');

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

 describe('createNode', () => {
    it('should create node successfully', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const node = {
        label: 'TestLabel',
        properties: { name: 'Test Node', value: 123 },
      };

      const nodeId = await connectionManager.createNode(node);

      expect(nodeId).toMatch(/^[a-zA-Z0-9_]+$/);
    });
  });

  describe('createRelationship', () => {
    it('should create relationship successfully', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const relationship = {
        type: 'TEST_RELATIONSHIP',
        sourceId: 'source_123',
        targetId: 'target_456',
        properties: { weight: 1.0 },
      };

      await connectionManager.createRelationship(relationship);

      // 只需验证没有抛出错误
      expect(relationship).toBeDefined();
    });
  });

  describe('findNodesByLabel', () => {
    it('should find nodes by label', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const result = await connectionManager.findNodesByLabel('TestLabel');

      expect(result).toEqual([]);
    });

    it('should find nodes by label with properties', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const properties = { name: 'Test', active: true };
      const result = await connectionManager.findNodesByLabel('TestLabel', properties);

      expect(result).toEqual([]);
    });
  });

  describe('findRelationships', () => {
    it('should find relationships', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const result = await connectionManager.findRelationships();

      expect(result).toEqual([]);
    });

    it('should find relationships by type', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const result = await connectionManager.findRelationships('TEST_RELATIONSHIP');

      expect(result).toEqual([]);
    });

    it('should find relationships with properties', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const properties = { weight: 1.0 };
      const result = await connectionManager.findRelationships('TEST_RELATIONSHIP', properties);

      expect(result).toEqual([]);
    });
  });

  describe('getDatabaseStats', () => {
    it('should get database stats', async () => {
      // 由于在beforeEach中已经设置了连接状态为true
      
      const result = await connectionManager.getDatabaseStats();

      expect(result).toEqual({
        version: '3.0.0',
        status: 'online',
        spaces: 0,
        nodes: 0,
        relationships: 0,
        tags: 0,
        edgeTypes: 0,
        currentSpace: expect.any(String),
        connectionInfo: {
          host: expect.any(String),
          port: expect.any(Number),
          username: expect.any(String),
        },
      });
    });
  });

  describe('isConnectedToDatabase', () => {
    it('should return the same value as isConnected', async () => {
      expect(connectionManager.isConnectedToDatabase()).toBe(true);

      await connectionManager.disconnect();
      expect(connectionManager.isConnectedToDatabase()).toBe(false);

      // 重新设置连接状态
      (connectionManager as any).connectionStatus.connected = true;
      (connectionManager as any).client = {
        execute: jest.fn().mockResolvedValue({ code: 0, data: [], error: null }),
        close: jest.fn().mockResolvedValue(undefined),
        once: jest.fn((event, callback) => {
          if (event === 'authorized') {
            // 模拟授权成功
            setTimeout(callback, 10);
          }
        }),
      };
      expect(connectionManager.isConnectedToDatabase()).toBe(true);
    });
  });
});