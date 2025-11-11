import { Container } from 'inversify';
import { NebulaClient, INebulaClient } from '../NebulaClient';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../../config/service/NebulaConfigService';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { NebulaConfig } from '../../NebulaTypes';
import { IQueryRunner } from '../../query/QueryRunner';
import { INebulaProjectManager } from '../../NebulaProjectManager';
import { ProjectIdManager } from '../../../ProjectIdManager';

// Mock dependencies
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockConfigService = {
  loadConfig: jest.fn().mockReturnValue({
    host: 'localhost',
    port: 9669,
    username: 'root',
    password: 'nebula',
    space: 'test_space',
    timeout: 30000,
    maxConnections: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    bufferSize: 1024,
    pingInterval: 30000,
    vidTypeLength: 32,
  }),
};

const mockPerformanceMonitor = {
  startOperation: jest.fn().mockReturnValue('operation-id'),
  endOperation: jest.fn(),
};

const mockQueryRunner = {
  execute: jest.fn(),
  executeBatch: jest.fn(),
  getStats: jest.fn().mockReturnValue({}),
};

const mockProjectManager = {
  createSpaceForProject: jest.fn().mockResolvedValue(true),
  deleteSpaceForProject: jest.fn().mockResolvedValue(true),
  insertNodesForProject: jest.fn().mockResolvedValue(true),
  insertRelationshipsForProject: jest.fn().mockResolvedValue(true),
  findNodesForProject: jest.fn().mockResolvedValue([]),
  findRelationshipsForProject: jest.fn().mockResolvedValue([]),
};

const mockProjectIdManager = {
  listAllProjectPaths: jest.fn().mockReturnValue(['/test/project']),
  getSpaceName: jest.fn().mockReturnValue('test_space'),
};

const mockConnectionPool = {
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockReturnValue({}),
};

const mockSessionManager = {
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockReturnValue({}),
};

describe('NebulaClient', () => {
  let container: Container;
  let nebulaClient: INebulaClient;

  beforeEach(() => {
    container = new Container();

    // Bind mocks
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    container.bind(TYPES.NebulaConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.IQueryRunner).toConstantValue(mockQueryRunner);
    container.bind(TYPES.INebulaProjectManager).toConstantValue(mockProjectManager);
    container.bind(TYPES.ProjectIdManager).toConstantValue(mockProjectIdManager);
    container.bind(TYPES.IConnectionPool).toConstantValue(mockConnectionPool);
    container.bind(TYPES.ISessionManager).toConstantValue(mockSessionManager);

    // Bind NebulaClient
    container.bind<INebulaClient>(TYPES.INebulaClient).to(NebulaClient).inSingletonScope();

    nebulaClient = container.get<INebulaClient>(TYPES.INebulaClient);
  });

  describe('Interface Compliance', () => {
    it('should implement all INebulaService methods', () => {
      const requiredMethods: (keyof INebulaClient)[] = [
        'initialize', 'isConnected', 'isInitialized', 'close', 'reconnect',
        'createSpaceForProject', 'deleteSpaceForProject',
        'insertNodes', 'insertRelationships',
        'findNodesByLabel', 'findRelationships',
        'executeReadQuery', 'executeWriteQuery', 'useSpace',
        'createNode', 'createRelationship', 'findNodes', 'getDatabaseStats',
        'subscribe', 'healthCheck'
      ];

      requiredMethods.forEach(method => {
        expect(typeof nebulaClient[method]).toBe('function');
      });
    });

    it('should implement all INebulaClient specific methods', () => {
      const clientSpecificMethods: (keyof INebulaClient)[] = [
        'connect', 'disconnect', 'execute', 'executeQuery', 'executeBatch',
        'getStats', 'updateConfig', 'getConfig', 'on', 'off', 'emit',
        'deleteDataForFile'
      ];

      clientSpecificMethods.forEach(method => {
        expect(typeof nebulaClient[method]).toBe('function');
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with config', async () => {
      const config: NebulaConfig = {
        host: 'localhost',
        port: 9669,
        username: 'root',
        password: 'nebula',
        space: 'test_space'
      };

      const result = await nebulaClient.initialize(config);
      expect(result).toBe(true);
      expect(mockConnectionPool.initialize).toHaveBeenCalledWith(config);
      expect(mockSessionManager.initialize).toHaveBeenCalledWith(config);
    });

    it('should initialize successfully without config (use existing)', async () => {
      const result = await nebulaClient.initialize();
      expect(result).toBe(true);
      expect(mockConnectionPool.initialize).toHaveBeenCalled();
      expect(mockSessionManager.initialize).toHaveBeenCalled();
    });

    it('should return false on initialization failure', async () => {
      mockConnectionPool.initialize.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await nebulaClient.initialize();
      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should check initialization status', () => {
      expect(nebulaClient.isInitialized()).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      await nebulaClient.connect();
      expect(nebulaClient.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await nebulaClient.connect();
      await nebulaClient.disconnect();
      expect(nebulaClient.isConnected()).toBe(false);
    });

    it('should reconnect successfully', async () => {
      await nebulaClient.connect();
      const result = await nebulaClient.reconnect();
      expect(result).toBe(true);
      expect(nebulaClient.isConnected()).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when connected', async () => {
      await nebulaClient.connect();
      const health = await nebulaClient.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
      expect(health.details.connected).toBe(true);
    });

    it('should return unhealthy status when not connected', async () => {
      const health = await nebulaClient.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.connected).toBe(false);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to events and return subscription', () => {
      const listener = jest.fn();
      const subscription = nebulaClient.subscribe('test-event', listener);
      
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.eventType).toBe('test-event');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should unsubscribe correctly', () => {
      const listener = jest.fn();
      const subscription = nebulaClient.subscribe('test-event', listener);
      
      subscription.unsubscribe();
      
      // Emit event and verify listener is not called
      nebulaClient.emit('test-event', 'test-data');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Project Space Management', () => {
    it('should create space for project', async () => {
      await nebulaClient.connect();
      const result = await nebulaClient.createSpaceForProject('/test/project');
      
      expect(result).toBe(true);
      expect(mockProjectManager.createSpaceForProject).toHaveBeenCalledWith('/test/project');
    });

    it('should delete space for project', async () => {
      await nebulaClient.connect();
      const result = await nebulaClient.deleteSpaceForProject('/test/project');
      
      expect(result).toBe(true);
      expect(mockProjectManager.deleteSpaceForProject).toHaveBeenCalledWith('/test/project');
    });
  });

  describe('Data Operations', () => {
    it('should insert nodes', async () => {
      await nebulaClient.connect();
      const nodes = [{
        id: 'test-node-1',
        label: 'Test',
        properties: { name: 'test' }
      }];
      
      const result = await nebulaClient.insertNodes(nodes);
      expect(result).toBe(true);
    });

    it('should insert relationships', async () => {
      await nebulaClient.connect();
      const relationships = [{
        id: 'test-rel-1',
        type: 'TEST_REL',
        sourceId: 'node1',
        targetId: 'node2',
        properties: {}
      }];
      
      const result = await nebulaClient.insertRelationships(relationships);
      expect(result).toBe(true);
    });

    it('should delete data for file', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      await nebulaClient.deleteDataForFile('/test/file.ts');
      expect(mockQueryRunner.execute).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (v:File)'),
        { filePath: '/test/file.ts' },
        undefined
      );
    });
  });

  describe('Query Operations', () => {
    it('should find nodes by label', async () => {
      await nebulaClient.connect();
      const result = await nebulaClient.findNodesByLabel('TestLabel');
      
      expect(Array.isArray(result)).toBe(true);
      expect(mockProjectManager.findNodesForProject).toHaveBeenCalled();
    });

    it('should find relationships', async () => {
      await nebulaClient.connect();
      const result = await nebulaClient.findRelationships('TestType');
      
      expect(Array.isArray(result)).toBe(true);
      expect(mockProjectManager.findRelationshipsForProject).toHaveBeenCalled();
    });

    it('should get database stats', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockResolvedValue({ data: [{ Name: 'test_space' }] });
      
      const stats = await nebulaClient.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats.spaces).toBe(1);
    });
  });

  describe('Compatibility Methods', () => {
    it('should execute read query', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      const result = await nebulaClient.executeReadQuery('MATCH (n) RETURN n');
      expect(mockQueryRunner.execute).toHaveBeenCalledWith('MATCH (n) RETURN n', undefined, undefined);
    });

    it('should execute write query', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      const result = await nebulaClient.executeWriteQuery('CREATE (n:Test)');
      expect(mockQueryRunner.execute).toHaveBeenCalledWith('CREATE (n:Test)', undefined, undefined);
    });

    it('should use space', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      await nebulaClient.useSpace('test_space');
      expect(mockQueryRunner.execute).toHaveBeenCalledWith('USE `test_space`', undefined, undefined);
    });

    it('should create node', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      const nodeId = await nebulaClient.createNode('Test', { name: 'test' });
      expect(nodeId).toBeDefined();
      expect(nodeId).toMatch(/^Test_\d+_[a-z0-9]+$/);
    });

    it('should create relationship', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      await nebulaClient.createRelationship('TEST_REL', 'node1', 'node2');
      expect(mockQueryRunner.execute).toHaveBeenCalled();
    });

    it('should find nodes', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockClear().mockResolvedValue({ data: [] });
      
      const result = await nebulaClient.findNodes('Test', { name: 'test' });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get config', () => {
      const config = nebulaClient.getConfig();
      expect(config).toBeDefined();
      expect(config.host).toBe('localhost');
    });

    it('should update config', () => {
      const newConfig = { host: 'new-host' };
      nebulaClient.updateConfig(newConfig);
      
      const updatedConfig = nebulaClient.getConfig();
      expect(updatedConfig.host).toBe('new-host');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      // Mock connection failure
      const originalConnect = nebulaClient.connect;
      nebulaClient.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(nebulaClient.connect()).rejects.toThrow('Connection failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
      
      // Restore original method
      nebulaClient.connect = originalConnect;
    });

    it('should handle query errors', async () => {
      await nebulaClient.connect();
      mockQueryRunner.execute.mockRejectedValue(new Error('Query failed'));
      
      await expect(nebulaClient.execute('INVALID QUERY')).rejects.toThrow('Query failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});