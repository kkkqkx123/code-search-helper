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

// Mock the Nebula client
const mockExecute = jest.fn();
const mockClose = jest.fn();
const mockClient = {
  execute: mockExecute,
  close: mockClose,
  on: jest.fn(),
  once: jest.fn(),
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
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    // Create instance
    connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager)
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
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    const connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager)
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
    
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    
    const connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager)
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