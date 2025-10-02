import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaConfig } from '../../nebula/NebulaTypes';

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

describe('NebulaConnectionManager', () => {
  let connectionManager: NebulaConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();

    connectionManager = new NebulaConnectionManager(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any
    );
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(connectionManager).toBeDefined();
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should use config from config service if available', () => {
      const mockConfig: NebulaConfig = {
        host: 'test-host',
        port: 9669,
        username: 'test-user',
        password: 'test-password',
        space: 'test-space',
      };

      mockConfigService.get = jest.fn().mockReturnValue(mockConfig);

      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any
      );

      const status = newConnectionManager.getConnectionStatus();
      expect(status.host).toBe('test-host');
      expect(status.port).toBe(9669);
      expect(status.username).toBe('test-user');
    });

    it('should use default config if config service returns null', () => {
      mockConfigService.get = jest.fn().mockReturnValue(null);

      const newConnectionManager = new NebulaConnectionManager(
        mockLoggerService as any,
        mockErrorHandlerService as any,
        mockConfigService as any
      );

      const status = newConnectionManager.getConnectionStatus();
      expect(status.host).toBe(process.env.NEBULA_HOST || 'localhost');
      expect(status.port).toBe(parseInt(process.env.NEBULA_PORT || '9669'));
      expect(status.username).toBe(process.env.NEBULA_USERNAME || 'root');
    });
  });

  describe('connect', () => {
    it('should connect successfully and update connection status', async () => {
      const result = await connectionManager.connect();

      expect(result).toBe(true);
      expect(connectionManager.isConnected()).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Connecting to Nebula Graph',
        expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number),
          username: expect.any(String),
        })
      );
      expect(mockLoggerService.info).toHaveBeenCalledWith('Successfully connected to Nebula Graph');
    });

    it('should handle connection errors', async () => {
      // 模拟连接过程中抛出错误
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementationOnce((_: any, __: any) => {
        throw new Error('Connection failed');
      });

      const result = await connectionManager.connect();

      expect(result).toBe(false);
      expect(connectionManager.isConnected()).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // 恢复原始实现
      setTimeoutSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      // 首先连接
      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);

      // 然后断开连接
      await connectionManager.disconnect();

      expect(connectionManager.isConnected()).toBe(false);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Disconnecting from Nebula Graph');
      expect(mockLoggerService.info).toHaveBeenCalledWith('Successfully disconnected from Nebula Graph');
    });

    it('should handle disconnection errors', async () => {
      // 先连接
      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);

      // 模拟断开连接过程中抛出错误
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementationOnce((_: any, __: any) => {
        throw new Error('Disconnection failed');
      });

      await connectionManager.disconnect();

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // 恢复原始实现
      setTimeoutSpy.mockRestore();
    });
  });

  describe('isConnected', () => {
    it('should return connection status', async () => {
      expect(connectionManager.isConnected()).toBe(false);

      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);

      await connectionManager.disconnect();
      expect(connectionManager.isConnected()).toBe(false);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return a copy of connection status', async () => {
      const status1 = connectionManager.getConnectionStatus();
      expect(status1.connected).toBe(false);

      await connectionManager.connect();
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
      await connectionManager.connect();

      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        data: [],
        executionTime: expect.any(Number),
      });
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Executing Nebula query',
        expect.objectContaining({
          nGQL: 'MATCH (n) RETURN n',
          parameters: undefined,
        })
      );
    });

    it('should return error when not connected', async () => {
      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        error: 'Not connected to Nebula Graph',
      });
    });

    it('should handle query execution errors', async () => {
      // 先连接
      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);

      // 模拟查询执行过程中抛出错误
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementationOnce((_: any, __: any) => {
        throw new Error('Query execution failed');
      });

      const result = await connectionManager.executeQuery('MATCH (n) RETURN n');

      expect(result).toEqual({
        error: 'Query execution failed',
      });
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // 恢复原始实现
      setTimeoutSpy.mockRestore();
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully when connected', async () => {
      await connectionManager.connect();

      const queries = [
        { query: 'INSERT VERTEX...', params: {} },
        { query: 'UPDATE VERTEX...', params: {} },
      ];

      const result = await connectionManager.executeTransaction(queries);

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Executing Nebula transaction',
        expect.objectContaining({
          queryCount: 2,
        })
      );
    });

    it('should throw error when not connected', async () => {
      await expect(
        connectionManager.executeTransaction([{ query: 'MATCH (n) RETURN n', params: {} }])
      ).rejects.toThrow('Not connected to Nebula Graph');
    });

    it('should handle transaction execution errors', async () => {
      // 先连接
      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);

      // 模拟事务执行过程中抛出错误
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementationOnce((_: any, __: any) => {
        throw new Error('Transaction failed');
      });

      await expect(
        connectionManager.executeTransaction([{ query: 'MATCH (n) RETURN n', params: {} }])
      ).rejects.toThrow('Transaction failed');

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // 恢复原始实现
      setTimeoutSpy.mockRestore();
    });
  });

  describe('createNode', () => {
    it('should create node successfully', async () => {
      const node = {
        label: 'TestLabel',
        properties: { name: 'Test Node', value: 123 },
      };

      const nodeId = await connectionManager.createNode(node);

      expect(nodeId).toMatch(/^node_\d+$/);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Creating node',
        expect.objectContaining({
          label: 'TestLabel',
          properties: { name: 'Test Node', value: 123 },
        })
      );
    });
  });

  describe('createRelationship', () => {
    it('should create relationship successfully', async () => {
      const relationship = {
        type: 'TEST_RELATIONSHIP',
        sourceId: 'source_123',
        targetId: 'target_456',
        properties: { weight: 1.0 },
      };

      await connectionManager.createRelationship(relationship);

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Creating relationship',
        expect.objectContaining({
          type: 'TEST_RELATIONSHIP',
          sourceId: 'source_123',
          targetId: 'target_456',
          properties: { weight: 1.0 },
        })
      );
    });
  });

  describe('findNodesByLabel', () => {
    it('should find nodes by label', async () => {
      const result = await connectionManager.findNodesByLabel('TestLabel');

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Finding nodes by label',
        expect.objectContaining({
          label: 'TestLabel',
          properties: undefined,
        })
      );
    });

    it('should find nodes by label with properties', async () => {
      const properties = { name: 'Test', active: true };
      const result = await connectionManager.findNodesByLabel('TestLabel', properties);

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Finding nodes by label',
        expect.objectContaining({
          label: 'TestLabel',
          properties,
        })
      );
    });
  });

  describe('findRelationships', () => {
    it('should find relationships', async () => {
      const result = await connectionManager.findRelationships();

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Finding relationships',
        expect.objectContaining({
          type: undefined,
          properties: undefined,
        })
      );
    });

    it('should find relationships by type', async () => {
      const result = await connectionManager.findRelationships('TEST_RELATIONSHIP');

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Finding relationships',
        expect.objectContaining({
          type: 'TEST_RELATIONSHIP',
          properties: undefined,
        })
      );
    });

    it('should find relationships with properties', async () => {
      const properties = { weight: 1.0 };
      const result = await connectionManager.findRelationships('TEST_RELATIONSHIP', properties);

      expect(result).toEqual([]);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Finding relationships',
        expect.objectContaining({
          type: 'TEST_RELATIONSHIP',
          properties,
        })
      );
    });
  });

  describe('getDatabaseStats', () => {
    it('should get database stats', async () => {
      const result = await connectionManager.getDatabaseStats();

      expect(result).toEqual({
        version: '3.0.0',
        status: 'online',
        spaces: 0,
        nodes: 0,
        relationships: 0,
      });
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Getting database stats');
    });
  });

  describe('isConnectedToDatabase', () => {
    it('should return the same value as isConnected', async () => {
      expect(connectionManager.isConnectedToDatabase()).toBe(false);

      await connectionManager.connect();
      expect(connectionManager.isConnectedToDatabase()).toBe(true);

      await connectionManager.disconnect();
      expect(connectionManager.isConnectedToDatabase()).toBe(false);
    });
  });
});