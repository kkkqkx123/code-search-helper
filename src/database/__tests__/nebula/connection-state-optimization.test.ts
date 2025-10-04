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

describe('Connection State Optimization Tests', () => {
  let connectionManager: NebulaConnectionManager;
  let mockDatabaseLogger: any;
  let mockErrorHandler: any;
  let mockNebulaConfigService: any;
  let mockConnectionStateManager: ConnectionStateManager;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabaseLogger = {
      logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockErrorHandler = {
      handleError: jest.fn(),
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

    // 使用真实的 ConnectionStateManager
    mockConnectionStateManager = new ConnectionStateManager();

    connectionManager = new NebulaConnectionManager(
      mockDatabaseLogger as DatabaseLoggerService,
      mockErrorHandler as ErrorHandlerService,
      {} as ConfigService,
      mockNebulaConfigService as NebulaConfigService,
      mockConnectionStateManager
    );
    
    // 模拟连接已建立
    (connectionManager as any).connectionStatus = { connected: true };
    (connectionManager as any).client = mockNebulaClient;
  });

  afterEach(() => {
    mockConnectionStateManager.stopPeriodicCleanup();
    jest.clearAllMocks();
  });

  it('should reduce USE command execution with connection state tracking', async () => {
    // Mock the execute method to track calls
    const executeSpy = jest.spyOn(mockNebulaClient, 'execute');
    
    // Mock responses
    executeSpy
      .mockResolvedValueOnce({ code: 0 }) // For first USE command
      .mockResolvedValueOnce({ code: 0, data: [{ id: 'node1' }] }) // For first query
      .mockResolvedValue({ code: 0, data: [{ id: 'node2' }] }); // For subsequent queries

    // First call: should execute USE command and then the query
    await connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n LIMIT 1');
    
    // Second call: should skip USE command since already in the same space
    await connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n LIMIT 2');
    
    // Third call: should also skip USE command
    await connectionManager.executeQueryInSpace('test_space', 'MATCH (n) RETURN n LIMIT 3');

    // Verify that USE command was called only once (for the first query)
    const useCommands = executeSpy.mock.calls.filter(call => call[0].startsWith('USE '));
    expect(useCommands).toHaveLength(1);
    expect(useCommands[0][0]).toBe('USE `test_space`');
    
    // Verify that the actual queries were called 3 times
    const queryCommands = executeSpy.mock.calls.filter(call => !call[0].startsWith('USE '));
    expect(queryCommands).toHaveLength(3);
  });

  it('should execute USE command when switching between different spaces', async () => {
    const executeSpy = jest.spyOn(mockNebulaClient, 'execute');
    
    // Mock responses
    executeSpy
      .mockResolvedValueOnce({ code: 0 }) // USE space1
      .mockResolvedValueOnce({ code: 0, data: [] }) // Query in space1
      .mockResolvedValueOnce({ code: 0 }) // USE space2 (switching)
      .mockResolvedValueOnce({ code: 0, data: [] }) // Query in space2
      .mockResolvedValueOnce({ code: 0 }) // USE space1 (switching back)
      .mockResolvedValueOnce({ code: 0, data: [] }); // Query in space1

    // Query in space1
    await connectionManager.executeQueryInSpace('space1', 'MATCH (n) RETURN n');
    
    // Query in space2 (should trigger USE)
    await connectionManager.executeQueryInSpace('space2', 'MATCH (n) RETURN n');
    
    // Query in space1 again (should trigger USE)
    await connectionManager.executeQueryInSpace('space1', 'MATCH (n) RETURN n');

    // Verify USE commands were called 3 times (initial + 2 switches)
    const useCommands = executeSpy.mock.calls.filter(call => call[0].startsWith('USE '));
    expect(useCommands).toHaveLength(3);
    
    // Verify queries were called 3 times
    const queryCommands = executeSpy.mock.calls.filter(call => !call[0].startsWith('USE '));
    expect(queryCommands).toHaveLength(3);
  });

  it('should use getConnectionForSpace properly', async () => {
    const executeSpy = jest.spyOn(mockNebulaClient, 'execute');
    executeSpy.mockResolvedValue({ code: 0 });

    // First call - switch to space1
    await connectionManager.getConnectionForSpace('space1');
    expect(executeSpy).toHaveBeenCalledWith('USE `space1`');
    
    // Second call to same space - should not execute USE
    executeSpy.mockClear();
    await connectionManager.getConnectionForSpace('space1');
    expect(executeSpy).not.toHaveBeenCalledWith('USE `space1`');
    
    // Third call to different space - should execute USE
    await connectionManager.getConnectionForSpace('space2');
    expect(executeSpy).toHaveBeenCalledWith('USE `space2`');
  });

  it('should handle invalid space names properly', async () => {
    await expect(connectionManager.executeQueryInSpace('', 'MATCH (n) RETURN n'))
      .rejects.toThrow('Cannot execute query in invalid space:');
    
    await expect(connectionManager.executeQueryInSpace('undefined', 'MATCH (n) RETURN n'))
      .rejects.toThrow('Cannot execute query in invalid space:');
    
    await expect(connectionManager.getConnectionForSpace(''))
      .rejects.toThrow('Cannot get connection for invalid space:');
    
    await expect(connectionManager.getConnectionForSpace('undefined'))
      .rejects.toThrow('Cannot get connection for invalid space:');
  });

  it('should track connection states correctly', () => {
    // Initially no connections
    expect(mockConnectionStateManager.getConnectionsCount()).toBe(0);
    
    // Update a connection space
    mockConnectionStateManager.updateConnectionSpace('conn1', 'space1');
    
    // Should have one connection
    expect(mockConnectionStateManager.getConnectionsCount()).toBe(1);
    expect(mockConnectionStateManager.getConnectionSpace('conn1')).toBe('space1');
    
    // Get connections for space1
    const connectionsInSpace1 = mockConnectionStateManager.getConnectionsForSpace('space1');
    expect(connectionsInSpace1).toContain('conn1');
    
    // Remove connection
    mockConnectionStateManager.removeConnection('conn1');
    expect(mockConnectionStateManager.getConnectionsCount()).toBe(0);
    expect(mockConnectionStateManager.hasConnection('conn1')).toBe(false);
  });
});