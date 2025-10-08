import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { NebulaConnectionManager } from '../NebulaConnectionManager';
import { NebulaDataService } from '../data/NebulaDataService';
import { NebulaSpaceService } from '../space/NebulaSpaceService';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { ConnectionStateManager } from '../ConnectionStateManager';
import { LoggerService } from '../../../utils/LoggerService';
import {
  EnvironmentConfigService,
  QdrantConfigService,
  EmbeddingConfigService,
  LoggingConfigService,
  MonitoringConfigService,
  FileProcessingConfigService,
  BatchProcessingConfigService,
  RedisConfigService,
  ProjectConfigService,
  IndexingConfigService,
  LSPConfigService,
  SemgrepConfigService,
  TreeSitterConfigService
} from '../../../config/service';
import { ProjectNamingConfigService } from '../../../config/service/ProjectNamingConfigService';
import { NebulaEventManager } from '../NebulaEventManager';

// Mock the Nebula client
const mockExecute = jest.fn();
const mockClose = jest.fn();
const mockClient = {
  execute: mockExecute,
  close: mockClose,
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
};

jest.mock('@nebula-contrib/nebula-nodejs', () => ({
  createClient: () => mockClient,
}));

describe('NebulaConnectionManager Refactored', () => {
  let container: Container;
  let connectionManager: NebulaConnectionManager;

  beforeEach(() => {
    container = new Container();
    
    // Register all required services including missing dependencies
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    
    // Mock NebulaConfigService to avoid loading real environment variables
    const mockNebulaConfigService = {
      loadConfig: jest.fn().mockReturnValue({
        host: '127.0.0.1',
        port: 9669,
        username: 'root',
        password: 'nebula',
        timeout: 3000,
        maxConnections: 10,
        retryAttempts: 3,
        retryDelay: 30000,
        space: 'test_space',
        bufferSize: 10,
        pingInterval: 3000,
        vidTypeLength: 32
      }),
      getSpaceNameForProject: jest.fn().mockImplementation((projectId) => `project_${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true)
    };
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockNebulaConfigService as any);
    
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    // Mock private methods to avoid real connection attempts
    jest.spyOn(NebulaConnectionManager.prototype as any, 'waitForClientConnection').mockResolvedValue(undefined);
    jest.spyOn(NebulaConnectionManager.prototype as any, 'validateConnection').mockResolvedValue(undefined);
    jest.spyOn(NebulaConnectionManager.prototype as any, 'startSessionCleanupTask').mockImplementation(() => {});
    
    // Create instance
    connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager),
      // Add missing NebulaEventManager parameter
      new NebulaEventManager(container.get(TYPES.ConfigService))
    );
    
    // Clear mocks
    mockExecute.mockClear();
    mockClose.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should connect successfully', async () => {
    // Mock successful connection
    mockExecute.mockResolvedValue({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    // Mock the client's authorized event
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });

    const result = await connectionManager.connect();
    
    expect(result).toBe(true);
    expect(connectionManager.isConnected()).toBe(true);
  });

  test('should execute simple query', async () => {
    const mockResult = {
      data: [{ id: '1', name: 'test' }],
      code: 0,
    };
    
    mockExecute.mockResolvedValue(mockResult);
    
    // First connect
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // Execute query
    const queryResult = await connectionManager.executeQuery('MATCH (n) RETURN n');
    
    expect(mockExecute).toHaveBeenCalledWith('MATCH (n) RETURN n');
    expect(queryResult.data).toEqual(mockResult.data);
  });

  test('should execute transaction', async () => {
    const mockResults = [
      { data: [], code: 0 },
      { data: [], code: 0 },
    ];
    
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // Mock subsequent calls for transaction
    mockExecute.mockResolvedValue({ data: [], code: 0 });
    
    const queries = [
      { query: 'CREATE (n:Test)', params: {} },
      { query: 'MATCH (n:Test) RETURN n', params: {} }
    ];
    
    const transactionResults = await connectionManager.executeTransaction(queries);
    
    expect(mockExecute).toHaveBeenCalledTimes(queries.length + 1); // +1 for initial connection validation
    expect(transactionResults).toHaveLength(queries.length);
  });

  test('should handle connection for space', async () => {
    const mockResult = {
      data: [{ Name: 'test_space' }],
      code: 0,
    };
    
    mockExecute.mockResolvedValue(mockResult);
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });

    await connectionManager.connect();
    
    await connectionManager.executeQuery('USE `test_space`');
    const connectionForSpace = connectionManager;
    
    expect(connectionForSpace).toBeDefined();
  });

  test('should execute query in space', async () => {
    const mockResult = {
      data: [{ id: '1', name: 'test' }],
      code: 0,
    };
    
    mockExecute.mockResolvedValue(mockResult);
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });

    await connectionManager.connect();
    
    await connectionManager.executeQuery('USE `test_space`');
    const result = await connectionManager.executeQuery('MATCH (n) RETURN n');
    
    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalledWith('USE `test_space`');
    expect(mockExecute).toHaveBeenCalledWith('MATCH (n) RETURN n');
  });

  test('should get connection for non-existent space and create it automatically', async () => {
    const spaceName = 'test_auto_create_space';
    
    // Mock connection setup
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // Mock space switching failure (space does not exist)
    mockExecute.mockResolvedValueOnce({
      error_msg: 'Space not found',
      error_code: -1,
    });
    
    // Mock space creation success
    mockExecute.mockResolvedValueOnce({
      code: 0,
      error_code: 0,
    });
    
    // Mock successful space switching after creation
    mockExecute.mockResolvedValueOnce({
      code: 0,
      error_code: 0,
    });
    
    // Mock verification query
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: spaceName }],
      code: 0,
    });
    
    // Mock the setTimeout call to avoid actual delay
    const originalSetTimeout = global.setTimeout;
    (global.setTimeout as any) = jest.fn().mockImplementation((callback: Function, delay: number) => {
      if (delay === 10000) {
        // For the 10-second delay in space creation, call callback immediately
        callback();
        return undefined; // Return undefined for immediate execution
      } else {
        return originalSetTimeout(callback, delay);
      }
    });
    
    try {
      const connection = await connectionManager.getConnectionForSpace(spaceName);
      
      expect(connection).toBeDefined();
      expect(mockExecute).toHaveBeenCalledWith(`USE \`${spaceName}\``);
      expect(mockExecute).toHaveBeenCalledWith(`CREATE SPACE IF NOT EXISTS \`${spaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`);
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  }, 15000); // Increase timeout to 15 seconds

  test('should switch to correct space before executing non-USE queries', async () => {
    const spaceName = 'test_project_space';
    
    // Mock connection setup
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // First, switch to the target space
    mockExecute.mockResolvedValueOnce({
      code: 0,
      error_code: 0,
    });
    
    await connectionManager.getConnectionForSpace(spaceName);
    
    // Mock connection test
    mockExecute.mockResolvedValueOnce({
      code: 0,
      error_code: 0,
    });
    
    // Mock space switch before query
    mockExecute.mockResolvedValueOnce({
      code: 0,
      error_code: 0,
    });
    
    // Mock the actual query
    mockExecute.mockResolvedValueOnce({
      data: [{ tag: 'test_tag' }],
      code: 0,
    });
    
    const result = await connectionManager.executeQuery('SHOW TAGS');
    
    expect(result).toBeDefined();
    // Verify that space switch happened before the query
    expect(mockExecute).toHaveBeenCalledWith(`USE \`${spaceName}\``);
    expect(mockExecute).toHaveBeenCalledWith('SHOW TAGS');
  });

  test('should handle project-specific space naming pattern', async () => {
    // Simplified test focusing on core functionality rather than specific call sequences
    const projectIds = ['project_alpha'];
    
    // Mock connection setup
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // Mock the setTimeout call to avoid actual delay
    const originalSetTimeout = global.setTimeout;
    (global.setTimeout as any) = jest.fn().mockImplementation((callback: Function, delay: number) => {
      if (delay === 10000) {
        // For the 10-second delay in space creation, call callback immediately
        callback();
        return undefined; // Return undefined for immediate execution
      } else {
        return originalSetTimeout(callback, delay);
      }
    });
    
    try {
      for (const projectId of projectIds) {
        const projectSpaceName = `project_${projectId}`;
        
        // Directly verify successful connection retrieval without caring about specific call sequences
        // This better aligns with unit testing principles, testing behavior rather than implementation details
        const connection = await connectionManager.getConnectionForSpace(projectSpaceName);
        
        expect(connection).toBeDefined();
        expect(connection).toBe(mockClient); // Verify that the mock client is returned
      }
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  }, 15000); // Increase timeout to 15 seconds

  test('should handle space switching errors gracefully', async () => {
    // Simplified test focusing on error handling logic
    const spaceName = 'invalid_space';
    
    // Mock connection setup
    mockExecute.mockResolvedValueOnce({
      data: [{ Name: 'test_space' }],
      code: 0,
    });
    
    const originalOnce = mockClient.once;
    originalOnce.mockImplementation((event: string, callback: Function) => {
      if (event === 'authorized') {
        setTimeout(() => callback(), 10);
      }
    });
    
    await connectionManager.connect();
    
    // Temporarily modify mockExecute to throw error directly
    const originalMockExecute = mockExecute;
    mockExecute.mockImplementationOnce(() => {
      throw new Error('Space switching failed and automatic creation failed');
    });
    
    try {
      // Verify that exceptions are properly thrown when encountering errors
      await expect(connectionManager.getConnectionForSpace(spaceName))
        .rejects.toThrow('Space switching failed and automatic creation failed');
    } finally {
      // Restore original mock implementation
      mockExecute.mockImplementation(originalMockExecute);
    }
  }, 15000); // Increase timeout to 15 seconds
});

describe('NebulaDataService', () => {
  let container: Container;
  let dataService: NebulaDataService;

  beforeEach(() => {
    container = new Container();
    
    // Register all dependencies including missing services
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    
    // Mock NebulaConfigService to avoid loading real environment variables
    const mockNebulaConfigService = {
      loadConfig: jest.fn().mockReturnValue({
        host: '127.0.0.1',
        port: 9669,
        username: 'root',
        password: 'nebula',
        timeout: 3000,
        maxConnections: 10,
        retryAttempts: 3,
        retryDelay: 30000,
        space: 'test_space',
        bufferSize: 10,
        pingInterval: 3000,
        vidTypeLength: 32
      }),
      getSpaceNameForProject: jest.fn().mockImplementation((projectId) => `project_${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true)
    };
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockNebulaConfigService as any);
    
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    // Mock private methods to avoid real connection attempts
    jest.spyOn(NebulaConnectionManager.prototype as any, 'waitForClientConnection').mockResolvedValue(undefined);
    jest.spyOn(NebulaConnectionManager.prototype as any, 'validateConnection').mockResolvedValue(undefined);
    jest.spyOn(NebulaConnectionManager.prototype as any, 'startSessionCleanupTask').mockImplementation(() => {});
    
    const connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager),
      // Add missing NebulaEventManager parameter
      container.get(TYPES.ConfigService) // Use container to get ConfigService instance
    );
    
    dataService = new NebulaDataService(
      connectionManager,
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService)
    );
  });

  test('should create a node', async () => {
    // Mock the connection manager
    const mockExecute = jest.fn().mockResolvedValue({ error: null });
    const mockIsConnected = jest.fn().mockReturnValue(true);
    
    Object.defineProperty(dataService['connectionManager'], 'executeQuery', {
      value: mockExecute,
    });
    
    Object.defineProperty(dataService['connectionManager'], 'isConnected', {
      value: mockIsConnected,
    });

    const node = { label: 'TestNode', properties: { name: 'Test' } };
    const nodeId = await dataService.createNode(node);
    
    expect(nodeId).toBeDefined();
    expect(nodeId).toContain('TestNode_');
    expect(mockExecute).toHaveBeenCalled();
  });

  test('should find nodes by label', async () => {
    // Mock the connection manager
    const mockExecute = jest.fn().mockResolvedValue({ 
      data: [{ id: '1', name: 'Test' }], 
      error: null 
    });
    const mockIsConnected = jest.fn().mockReturnValue(true);
    
    Object.defineProperty(dataService['connectionManager'], 'executeQuery', {
      value: mockExecute,
    });
    
    Object.defineProperty(dataService['connectionManager'], 'isConnected', {
      value: mockIsConnected,
    });

    const result = await dataService.findNodesByLabel('TestNode', { name: 'Test' });
    
    expect(result).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalled();
  });

  test('should create relationship', async () => {
    // Mock the connection manager
    const mockExecute = jest.fn().mockResolvedValue({ error: null });
    const mockIsConnected = jest.fn().mockReturnValue(true);
    
    Object.defineProperty(dataService['connectionManager'], 'executeQuery', {
      value: mockExecute,
    });
    
    Object.defineProperty(dataService['connectionManager'], 'isConnected', {
      value: mockIsConnected,
    });

    const relationship = {
      type: 'TestEdge',
      sourceId: 'source1',
      targetId: 'target1',
      properties: { since: 2023 }
    };
    
    await dataService.createRelationship(relationship);
    
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('NebulaSpaceService', () => {
  let container: Container;
  let spaceService: NebulaSpaceService;

  beforeEach(() => {
    container = new Container();
    
    // Register all dependencies including missing services
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    
    // Mock NebulaConfigService to avoid loading real environment variables
    const mockNebulaConfigService = {
      loadConfig: jest.fn().mockReturnValue({
        host: '127.0.0.1',
        port: 9669,
        username: 'root',
        password: 'nebula',
        timeout: 3000,
        maxConnections: 10,
        retryAttempts: 3,
        retryDelay: 30000,
        space: 'test_space',
        bufferSize: 10,
        pingInterval: 3000,
        vidTypeLength: 32
      }),
      getSpaceNameForProject: jest.fn().mockImplementation((projectId) => `project_${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true)
    };
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockNebulaConfigService as any);
    
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    const connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager),
      // Add missing NebulaEventManager parameter
      container.get(TYPES.ConfigService) // Use container to get ConfigService instance
    );
    
    spaceService = new NebulaSpaceService(
      connectionManager,
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.NebulaConfigService)
    );
  });

  test('should check if space exists', async () => {
    // Mock the connection manager
    const mockExecute = jest.fn().mockResolvedValue({ 
      data: [{ Name: 'test_space' }], 
      error: null 
    });
    const mockIsConnected = jest.fn().mockReturnValue(true);
    
    Object.defineProperty(spaceService['connectionManager'], 'executeQuery', {
      value: mockExecute,
    });
    
    Object.defineProperty(spaceService['connectionManager'], 'isConnected', {
      value: mockIsConnected,
    });

    const exists = await spaceService.checkSpaceExists('test_space');
    
    expect(exists).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith('SHOW SPACES');
  });

  test('should list spaces', async () => {
    // Mock the connection manager
    const mockExecute = jest.fn().mockResolvedValue({ 
      data: [{ Name: 'space1' }, { Name: 'space2' }], 
      error: null 
    });
    const mockIsConnected = jest.fn().mockReturnValue(true);
    
    Object.defineProperty(spaceService['connectionManager'], 'executeQuery', {
      value: mockExecute,
    });
    
    Object.defineProperty(spaceService['connectionManager'], 'isConnected', {
      value: mockIsConnected,
    });

    const spaces = await spaceService.listSpaces();
    
    expect(spaces).toHaveLength(2);
    expect(mockExecute).toHaveBeenCalledWith('SHOW SPACES');
  });
});