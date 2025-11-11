import { Container } from 'inversify';
import { NebulaClient } from '../NebulaClient';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../../config/service/NebulaConfigService';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { IConnectionPool } from '../../connection/ConnectionPool';
import { ISessionManager } from '../../session/SessionManager';
import { IQueryRunner } from '../../query/QueryRunner';
import { NebulaConfig, NebulaNode, NebulaRelationship } from '../../NebulaTypes';
import { INebulaProjectManager } from '../../NebulaProjectManager';
import { ProjectIdManager } from '../../../ProjectIdManager';

// Mock implementations
class MockLoggerService extends LoggerService {
  debug = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}

class MockErrorHandlerService extends ErrorHandlerService {
  handleError = jest.fn();
}

class MockNebulaConfigService extends NebulaConfigService {
  getConfig = jest.fn().mockReturnValue({
    host: 'localhost',
    port: 9669,
    username: 'root',
    password: 'nebula',
    space: 'test_space'
  });
}

class MockPerformanceMonitor extends PerformanceMonitor {
  startOperation = jest.fn().mockReturnValue('operation-id');
  endOperation = jest.fn();
}

class MockConnectionPool implements IConnectionPool {
  initialize = jest.fn().mockResolvedValue(undefined);
  getConnection = jest.fn().mockResolvedValue({});
  releaseConnection = jest.fn();
  close = jest.fn().mockResolvedValue(undefined);
  startHealthCheck = jest.fn();
  stopHealthCheck = jest.fn();
  getPoolStats = jest.fn().mockReturnValue({
    totalConnections: 1,
    activeConnections: 0,
    idleConnections: 1,
    pendingRequests: 0,
    totalAcquires: 0,
    totalReleases: 0,
    totalErrors: 0,
    averageAcquireTime: 0,
    averageConnectionAge: 0
  });
}

class MockSessionManager implements ISessionManager {
  initialize = jest.fn().mockResolvedValue(undefined);
  getSession = jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
    switchSpace: jest.fn().mockResolvedValue(undefined)
  });
  releaseSession = jest.fn();
  invalidateSession = jest.fn();
  startSessionCleanup = jest.fn();
  stopSessionCleanup = jest.fn();
  switchSpace = jest.fn().mockResolvedValue(undefined);
  getSessionStats = jest.fn().mockReturnValue({
    totalSessions: 1,
    activeSessions: 0,
    idleSessions: 1,
    spaceCount: 0,
    totalAcquires: 0,
    totalReleases: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageSessionAge: 0,
    connectionPoolStats: {} as any,
    sessionPoolStats: []
  });
  close = jest.fn().mockResolvedValue(undefined);
}

class MockQueryRunner implements IQueryRunner {
  execute = jest.fn().mockResolvedValue({
    table: {},
    results: [],
    rows: [],
    data: []
  });
  executeBatch = jest.fn().mockResolvedValue([]);
  getCachedResult = jest.fn().mockResolvedValue(null);
  setCachedResult = jest.fn().mockResolvedValue(undefined);
  recordQueryMetrics = jest.fn();
  getStats = jest.fn().mockReturnValue({
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0,
    queriesByType: {}
  });
}

class MockProjectManager implements INebulaProjectManager {
  createSpaceForProject = jest.fn().mockResolvedValue(true);
  deleteSpaceForProject = jest.fn().mockResolvedValue(true);
  getSpaceInfoForProject = jest.fn();
  clearSpaceForProject = jest.fn().mockResolvedValue(true);
  listProjectSpaces = jest.fn().mockResolvedValue([]);
  insertNodesForProject = jest.fn().mockResolvedValue(true);
  insertRelationshipsForProject = jest.fn().mockResolvedValue(true);
  findNodesForProject = jest.fn().mockResolvedValue([]);
  findRelationshipsForProject = jest.fn().mockResolvedValue([]);
  createProjectSpace = jest.fn().mockResolvedValue(true);
  deleteProjectSpace = jest.fn().mockResolvedValue(true);
  getProjectSpaceInfo = jest.fn();
  insertProjectData = jest.fn().mockResolvedValue(true);
  updateProjectData = jest.fn().mockResolvedValue(true);
  deleteProjectData = jest.fn().mockResolvedValue(true);
  searchProjectData = jest.fn().mockResolvedValue([]);
  getProjectDataById = jest.fn();
  clearProjectSpace = jest.fn().mockResolvedValue(true);
  subscribe = jest.fn().mockReturnValue({
    id: 'test-subscription',
    eventType: 'test',
    handler: () => {},
    unsubscribe: jest.fn()
  });
}

class MockProjectIdManager extends ProjectIdManager {
  listAllProjectPaths = jest.fn().mockReturnValue(['/test/project']);
  getProjectId = jest.fn().mockReturnValue('test-project-id');
  getSpaceName = jest.fn().mockReturnValue('test_space');
}


describe('NebulaClient', () => {
  let container: Container;
  let nebulaClient: NebulaClient;
  let mockLogger: MockLoggerService;
  let mockErrorHandler: MockErrorHandlerService;
  let mockConfigService: MockNebulaConfigService;
  let mockPerformanceMonitor: MockPerformanceMonitor;
  let mockConnectionPool: MockConnectionPool;
  let mockSessionManager: MockSessionManager;
  let mockQueryRunner: MockQueryRunner;

  beforeEach(() => {
    container = new Container();

    // Setup mocks
    mockLogger = new MockLoggerService();
    mockErrorHandler = new MockErrorHandlerService(mockLogger);
    mockConfigService = new MockNebulaConfigService(mockLogger, mockErrorHandler);
    mockPerformanceMonitor = new MockPerformanceMonitor(mockLogger);
    mockConnectionPool = new MockConnectionPool();
    mockSessionManager = new MockSessionManager();
    mockQueryRunner = new MockQueryRunner();
    // Bind mocks
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockConfigService);
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind<IConnectionPool>(TYPES.IConnectionPool).toConstantValue(mockConnectionPool);
    container.bind<ISessionManager>(TYPES.ISessionManager).toConstantValue(mockSessionManager);
    container.bind<IQueryRunner>(TYPES.IQueryRunner).toConstantValue(mockQueryRunner);
    container.bind<NebulaClient>(TYPES.NebulaClient).to(NebulaClient);

    // Create NebulaClient instance
    nebulaClient = container.get<NebulaClient>(TYPES.NebulaClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the client successfully', async () => {
      const config: NebulaConfig = {
        host: 'localhost',
        port: 9669,
        username: 'root',
        password: 'nebula',
        space: 'test_space'
      };

      await nebulaClient.initialize(config);

      expect(mockConnectionPool.initialize).toHaveBeenCalledWith(config);
      expect(mockSessionManager.initialize).toHaveBeenCalledWith(config);
      expect(mockLogger.info).toHaveBeenCalledWith('NebulaClient initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const config: NebulaConfig = {
        host: 'localhost',
        port: 9669,
        username: 'root',
        password: 'nebula',
        space: 'test_space'
      };

      const error = new Error('Initialization failed');
      mockConnectionPool.initialize.mockRejectedValueOnce(error);

      await expect(nebulaClient.initialize(config)).rejects.toThrow('Initialization failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, { component: 'NebulaClient', operation: 'initialize' });
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      // Connect the client before each query test
      await nebulaClient.connect();
    });

    it('should execute a query successfully', async () => {
      const query = 'SHOW SPACES';
      const result = await nebulaClient.executeQuery(query);

      expect(mockQueryRunner.execute).toHaveBeenCalledWith(query, undefined, undefined);
      expect(result).toEqual({
        table: {},
        results: [],
        rows: [],
        data: []
      });
    });

    it('should execute a query with parameters', async () => {
      const query = 'INSERT VERTEX person(name) VALUES "1":("Alice")';
      const params = { name: 'Alice' };
      const options = { useCache: false };

      const result = await nebulaClient.executeQuery(query, params, options);

      expect(mockQueryRunner.execute).toHaveBeenCalledWith(query, params, options);
      expect(result).toEqual({
        table: {},
        results: [],
        rows: [],
        data: []
      });
    });

    it('should handle query execution errors', async () => {
      const query = 'INVALID QUERY';
      const error = new Error('Query execution failed');
      mockQueryRunner.execute.mockRejectedValueOnce(error);

      await expect(nebulaClient.executeQuery(query)).rejects.toThrow('Query execution failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(new Error('Failed to execute query: Query execution failed'), { component: 'NebulaClient', operation: 'execute', query, params: undefined });
    });
  });

  describe('executeBatch', () => {
    beforeEach(async () => {
      // Connect the client before each batch test
      await nebulaClient.connect();
    });

    it('should execute a batch of queries successfully', async () => {
      const queries = [
        { query: 'SHOW SPACES' },
        { query: 'SHOW HOSTS' }
      ];
      const results = await nebulaClient.executeBatch(queries);

      expect(mockQueryRunner.executeBatch).toHaveBeenCalledWith(queries);
      expect(results).toEqual([]);
    });

    it('should handle batch execution errors', async () => {
      const queries = [
        { query: 'SHOW SPACES' },
        { query: 'SHOW HOSTS' }
      ];
      const error = new Error('Batch execution failed');
      mockQueryRunner.executeBatch.mockRejectedValueOnce(error);

      await expect(nebulaClient.executeBatch(queries)).rejects.toThrow('Batch execution failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(new Error('Failed to execute batch queries: Batch execution failed'), { component: 'NebulaClient', operation: 'executeBatch', queries });
    });
  });

  describe('getStats', () => {
    it('should return client statistics', () => {
      const stats = nebulaClient.getStats();

      expect(stats).toHaveProperty('connectionPool');
      expect(stats).toHaveProperty('sessionManager');
      expect(stats).toHaveProperty('queryRunner');
    });
  });

  describe('close', () => {
    it('should close the client successfully', async () => {
      await nebulaClient.close();

      expect(mockSessionManager.close).toHaveBeenCalled();
      expect(mockConnectionPool.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('NebulaClient closed successfully');
    });

    it('should handle close errors', async () => {
      const error = new Error('Close failed');
      mockConnectionPool.close.mockRejectedValueOnce(error);

      await expect(nebulaClient.close()).rejects.toThrow('Close failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, { component: 'NebulaClient', operation: 'close' });
    });
  });
});