import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { ConnectionStateManager } from '../../nebula/ConnectionStateManager';

// Mock the Nebula Graph client
const mockNebulaClient = {
  execute: jest.fn(),
  close: jest.fn(),
  once: jest.fn(),
};

jest.mock('@nebula-contrib/nebula-nodejs', () => ({
  createClient: jest.fn(() => mockNebulaClient),
}));

describe('NebulaConnectionManager', () => {
  let connectionManager: NebulaConnectionManager;
  let mockDatabaseLogger: any;
  let mockErrorHandler: any;
  let mockConfigService: any;
  let mockNebulaConfigService: any;
  let mockConnectionStateManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabaseLogger = {
      logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockErrorHandler = {
      handleError: jest.fn(),
    };

    mockConfigService = {
      getNebulaConfig: jest.fn(),
    };

    mockNebulaConfigService = {
      loadConfig: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 9669,
        username: 'root',
        password: 'password',
        space: 'test_space',
        timeout: 30000,
        maxConnections: 10,
        retryAttempts: 3,
        retryDelay: 1000,
        vidTypeLength: 128,
        bufferSize: 10,
        pingInterval: 3000
      }),
    };

    mockConnectionStateManager = {
      updateConnectionSpace: jest.fn(),
      getConnectionSpace: jest.fn().mockReturnValue(undefined),
      getConnectionsForSpace: jest.fn().mockReturnValue([]),
      getAllConnections: jest.fn().mockReturnValue([]),
      cleanupStaleConnections: jest.fn(),
      startPeriodicCleanup: jest.fn(),
      stopPeriodicCleanup: jest.fn(),
      removeConnection: jest.fn(),
      hasConnection: jest.fn().mockReturnValue(false),
      getConnectionsCount: jest.fn().mockReturnValue(0),
    };

    connectionManager = new NebulaConnectionManager(
      mockDatabaseLogger as DatabaseLoggerService,
      mockErrorHandler as ErrorHandlerService,
      mockConfigService as ConfigService,
      mockNebulaConfigService as NebulaConfigService,
      mockConnectionStateManager as ConnectionStateManager
    );
    
    // 模拟连接已建立的状态
    (connectionManager as any).connectionStatus = { connected: true };
    (connectionManager as any).client = mockNebulaClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnectionForSpace', () => {
    it('should throw error for invalid space name', async () => {
      await expect(connectionManager.getConnectionForSpace('')).rejects.toThrow('Cannot get connection for invalid space:');
      await expect(connectionManager.getConnectionForSpace('undefined')).rejects.toThrow('Cannot get connection for invalid space:');
    });

    it('should return current client if already in target space', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('test_space');
      
      const result = await connectionManager.getConnectionForSpace('test_space');
      
      expect(result).toBe(mockNebulaClient);
      expect(mockNebulaClient.execute).not.toHaveBeenCalled();
    });

    it('should switch space if current connection is in different space', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('other_space');
      
      mockNebulaClient.execute.mockResolvedValue({ code: 0 });

      const result = await connectionManager.getConnectionForSpace('test_space');
      
      expect(result).toBe(mockNebulaClient);
      expect(mockNebulaClient.execute).toHaveBeenCalledWith('USE `test_space`');
      expect(mockConnectionStateManager.updateConnectionSpace).toHaveBeenCalledWith('nebula-client-main', 'test_space');
    });

    it('should throw error if USE command fails', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('other_space');
      
      mockNebulaClient.execute.mockResolvedValueOnce({ error: 'Space does not exist' });

      await expect(connectionManager.getConnectionForSpace('test_space')).rejects.toThrow('Failed to switch to space test_space: Space does not exist');
    });
  });

  describe('executeQueryInSpace', () => {
    it('should throw error for invalid space name', async () => {
      await expect(connectionManager.executeQueryInSpace('', 'MATCH (n) RETURN n')).rejects.toThrow('Cannot execute query in invalid space:');
      await expect(connectionManager.executeQueryInSpace('undefined', 'MATCH (n) RETURN n')).rejects.toThrow('Cannot execute query in invalid space:');
    });

    it('should execute query directly if already in target space', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('test_space');
      
      mockNebulaClient.execute.mockResolvedValue({ code: 0, data: [] });

      const result = await connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n');
      
      expect(mockNebulaClient.execute).toHaveBeenCalledTimes(1);
      expect(mockNebulaClient.execute).toHaveBeenCalledWith('MATCH (n) RETURN n');
      expect(mockConnectionStateManager.updateConnectionSpace).toHaveBeenCalledTimes(0);
    });

    it('should switch space and then execute query if not in target space', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('other_space');
      
      mockNebulaClient.execute
        .mockResolvedValueOnce({ code: 0 }) // For USE command
        .mockResolvedValueOnce({ code: 0, data: [] }); // For actual query

      const result = await connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n');
      
      expect(mockNebulaClient.execute).toHaveBeenCalledTimes(2);
      expect(mockNebulaClient.execute).toHaveBeenNthCalledWith(1, 'USE `test_space`');
      expect(mockNebulaClient.execute).toHaveBeenNthCalledWith(2, 'MATCH (n) RETURN n');
      expect(mockConnectionStateManager.updateConnectionSpace).toHaveBeenCalledWith('nebula-client-main', 'test_space');
    });

    it('should throw error if switch to space fails', async () => {
      (mockConnectionStateManager.getConnectionSpace as jest.Mock).mockReturnValue('other_space');
      
      mockNebulaClient.execute.mockResolvedValueOnce({ error: 'Space does not exist' });

      await expect(connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n')).rejects.toThrow('Failed to switch to space test_space: Space does not exist');
    });
  });

  describe('connect and disconnect', () => {
    it('should start periodic cleanup on construction', () => {
      expect(mockConnectionStateManager.startPeriodicCleanup).toHaveBeenCalled();
    });

    it('should stop periodic cleanup and remove connection state on disconnect', async () => {
      // 首先确保连接状态管理器的模拟方法被调用
      expect(mockConnectionStateManager.startPeriodicCleanup).toHaveBeenCalled();
      
      await connectionManager.disconnect();
      
      expect(mockConnectionStateManager.stopPeriodicCleanup).toHaveBeenCalled();
      expect(mockConnectionStateManager.removeConnection).toHaveBeenCalledWith('nebula-client-main');
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      (connectionManager as any).connectionStatus = { connected: false };
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should return false when no client', () => {
      (connectionManager as any).connectionStatus = { connected: true };
      (connectionManager as any).client = null;
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should return true when connected and client exists', () => {
      (connectionManager as any).connectionStatus = { connected: true };
      (connectionManager as any).client = mockNebulaClient;
      expect(connectionManager.isConnected()).toBe(true);
    });
  });
});