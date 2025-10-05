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

// Mock the Nebula client for testing
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

describe('Integration Test: Nebula Module After Refactoring', () => {
  let container: Container;
  let connectionManager: NebulaConnectionManager;
  let dataService: NebulaDataService;
  let spaceService: NebulaSpaceService;

  beforeAll(() => {
    container = new Container();
    
    // Register all necessary services including missing dependencies
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
    
    // Create and register the connection manager
    connectionManager = new NebulaConnectionManager(
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.ConfigService),
      container.get(TYPES.NebulaConfigService),
      container.get(TYPES.ConnectionStateManager)
    );
    
    // Create services that depend on the connection manager
    dataService = new NebulaDataService(
      connectionManager,
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService)
    );
    
    spaceService = new NebulaSpaceService(
      connectionManager,
      container.get(TYPES.DatabaseLoggerService),
      container.get(TYPES.ErrorHandlerService),
      container.get(TYPES.NebulaConfigService)
    );
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockExecute.mockClear();
    mockClose.mockClear();
  });

  test('should connect to database via connection manager', async () => {
    // Setup mocks for successful connection
    mockExecute.mockResolvedValueOnce({
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

    // Attempt to connect
    const connected = await connectionManager.connect();
    
    // Assertions
    expect(connected).toBe(true);
    expect(connectionManager.isConnected()).toBe(true);
  });

  test('should execute queries via connection manager', async () => {
    // Setup connection first
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
    
    // Now test query execution
    const mockQueryResult = {
      data: [{ id: '1', name: 'test_node' }],
      code: 0,
    };
    
    mockExecute.mockResolvedValueOnce(mockQueryResult);

    const result = await connectionManager.executeQuery('MATCH (n) RETURN n LIMIT 1');
    
    expect(result).toBeDefined();
    expect(result.data).toEqual(mockQueryResult.data);
  });

  test('should create nodes via data service', async () => {
    // Setup connection first
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
    
    // Mock the query result for node creation
    mockExecute.mockResolvedValue({ error: null });
    
    const nodeData = {
      label: 'TestLabel',
      properties: {
        name: 'Test Node',
        created: Date.now()
      }
    };
    
    const nodeId = await dataService.createNode(nodeData);
    
    expect(nodeId).toBeDefined();
    expect(nodeId).toContain('TestLabel_');
  });

  test('should find nodes by label via data service', async () => {
    // Setup connection first
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
    
    // Mock the query result for node search
    const mockNodes = [
      { id: '1', name: 'Test Node 1' },
      { id: '2', name: 'Test Node 2' }
    ];
    
    mockExecute.mockResolvedValue({ 
      data: mockNodes,
      error: null 
    });
    
    const label = 'TestLabel';
    const properties = { name: 'Test Node' };
    
    const foundNodes = await dataService.findNodesByLabel(label, properties);
    
    expect(foundNodes).toEqual(mockNodes);
  });

  test('should create relationships via data service', async () => {
    // Setup connection first
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
    
    // Mock the query result for relationship creation
    mockExecute.mockResolvedValue({ error: null });
    
    const relationship = {
      type: 'TEST_RELATIONSHIP',
      sourceId: 'node1',
      targetId: 'node2',
      properties: { since: 2023 }
    };
    
    await expect(dataService.createRelationship(relationship)).resolves.not.toThrow();
  });

  test('should manage spaces via space service', async () => {
    // Setup connection first
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
    
    // Mock the query result for space listing
    const mockSpaces = [
      { Name: 'space1' },
      { Name: 'space2' }
    ];
    
    mockExecute.mockResolvedValue({ 
      data: mockSpaces,
      error: null 
    });
    
    const spaces = await spaceService.listSpaces();
    
    expect(spaces).toEqual(mockSpaces);
  });

  test('should create space via space service', async () => {
    // Setup connection first
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
    
    // Mock the query result for space creation
    mockExecute.mockResolvedValue({ error: null });
    
    const created = await spaceService.createSpace('new_test_space');
    
    expect(created).toBe(true);
  });

  test('should execute queries in specific space via space service', async () => {
    // Setup connection first
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
    
    // Mock the query results
    mockExecute.mockResolvedValueOnce({ error: null }); // for USE space
    mockExecute.mockResolvedValueOnce({ 
      data: [{ id: '1', name: 'test' }], 
      error: null 
    }); // for actual query
    
    const result = await spaceService.executeQueryInSpace('test_space', 'MATCH (n) RETURN n');
    
    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalledWith('USE `test_space`');
  });

  test('should validate space via space service', async () => {
    // Setup connection first
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
    
    // Mock the query results for space validation
    mockExecute
      .mockResolvedValueOnce({ data: [{ Name: 'existing_space' }], error: null }) // SHOW SPACES
      .mockResolvedValueOnce({ error: null }) // USE space
      .mockResolvedValueOnce({ data: [], error: null }); // SHOW TAGS
    
    const isValid = await spaceService.validateSpace('existing_space');
    
    expect(isValid).toBe(true);
  });
});