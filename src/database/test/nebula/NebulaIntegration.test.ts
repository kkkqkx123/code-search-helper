import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { NebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';

// Mock the logger and error handler to reduce noise in tests
jest.mock('../../../core/LoggerService');
jest.mock('../../../core/ErrorHandlerService');

describe('Nebula Database Integration Tests', () => {
  let nebulaConnectionManager: NebulaConnectionManager;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;

  describe('NebulaConnectionManager Integration', () => {
    beforeAll(async () => {
      // Create real instances
      loggerService = new LoggerService();
      errorHandlerService = new ErrorHandlerService(loggerService);
      configService = ConfigService.getInstance();

      // Create NebulaConnectionManager instance
      nebulaConnectionManager = new NebulaConnectionManager(
        loggerService,
        errorHandlerService,
        configService
      );

      // Ensure we start with a clean connection
      if (nebulaConnectionManager.isConnectedToDatabase()) {
        await nebulaConnectionManager.disconnect();
      }
    });

    it('should connect to NebulaGraph', async () => {
      const result = await nebulaConnectionManager.connect();
      expect(result).toBe(true);
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(true);
    });

    it('should execute a simple query', async () => {
      // This test requires a connection
      if (!nebulaConnectionManager.isConnectedToDatabase()) {
        const connected = await nebulaConnectionManager.connect();
        expect(connected).toBe(true);
      }

      const result = await nebulaConnectionManager.executeQuery('SHOW HOSTS');
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should get read session', async () => {
      if (!nebulaConnectionManager.isConnectedToDatabase()) {
        const connected = await nebulaConnectionManager.connect();
        expect(connected).toBe(true);
      }

      const session = await nebulaConnectionManager.getReadSession();
      expect(session).toBeDefined();
    });

    it('should get write session', async () => {
      if (!nebulaConnectionManager.isConnectedToDatabase()) {
        const connected = await nebulaConnectionManager.connect();
        expect(connected).toBe(true);
      }

      const session = await nebulaConnectionManager.getWriteSession();
      expect(session).toBeDefined();
    });

    it('should get database stats', async () => {
      if (!nebulaConnectionManager.isConnectedToDatabase()) {
        const connected = await nebulaConnectionManager.connect();
        expect(connected).toBe(true);
      }

      const stats = await nebulaConnectionManager.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats.spaces).toBeDefined();
      expect(stats.hosts).toBeDefined();
      expect(stats.parts).toBeDefined();
    });

    afterAll(async () => {
      try {
        if (nebulaConnectionManager.isConnectedToDatabase()) {
          await nebulaConnectionManager.disconnect();
        }
      } catch (error) {
        // Ignore disconnect errors in cleanup
      }
      // 清理所有挂起的定时器
      jest.useRealTimers();

      // 确保所有异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('NebulaQueryBuilder Integration', () => {
    let queryBuilder: NebulaQueryBuilder;

    beforeAll(() => {
      queryBuilder = new NebulaQueryBuilder();
    });

    it('should build and validate INSERT VERTEX query', () => {
      const tag = 'person';
      const vertexId = '1';
      const properties = { name: 'Alice', age: 30 };

      const result = queryBuilder.insertVertex(tag, vertexId, properties);

      expect(result.query).toContain('INSERT VERTEX');
      expect(result.query).toContain('person');
      expect(result.query).toContain('name');
      expect(result.query).toContain('age');
      expect(result.params).toEqual({ param0: 'Alice', param1: 30 });
    });

    it('should build and validate INSERT EDGE query', () => {
      const edgeType = 'knows';
      const srcId = '1';
      const dstId = '2';
      const properties = { since: 2020 };

      const result = queryBuilder.insertEdge(edgeType, srcId, dstId, properties);

      expect(result.query).toContain('INSERT EDGE');
      expect(result.query).toContain('knows');
      expect(result.query).toContain('since');
      expect(result.params).toEqual({ param0: 2020 });
    });

    it('should build and validate GO query', () => {
      const result = queryBuilder.go(2, '1', 'id(vertex) as id', 'knows');

      expect(result).toContain('GO 2 STEPS FROM 1 OVER knows YIELD id(vertex) as id');
    });

    it('should build and validate MATCH query', () => {
      const result = queryBuilder.match('(n:person)', 'n', 'n.name = "Alice"');

      expect(result).toContain('MATCH (n:person) WHERE n.name = "Alice" RETURN n');
    });
  });

  describe('Nebula CRUD Operations Integration', () => {
    beforeAll(async () => {
      // Create real instances
      loggerService = new LoggerService();
      errorHandlerService = new ErrorHandlerService(loggerService);
      configService = ConfigService.getInstance();

      // Create NebulaConnectionManager instance
      nebulaConnectionManager = new NebulaConnectionManager(
        loggerService,
        errorHandlerService,
        configService
      );

      // Ensure we start with a clean connection
      if (nebulaConnectionManager.isConnectedToDatabase()) {
        await nebulaConnectionManager.disconnect();
      }

      // Connect to NebulaGraph
      const isConnected = await nebulaConnectionManager.connect();
      expect(isConnected).toBe(true);
    });

    it('should create and find nodes', async () => {
      // Create a test node
      const node = {
        label: 'test_person',
        id: 'test_1',
        properties: { name: 'Test User', created: new Date().toISOString() },
      };

      const nodeId = await nebulaConnectionManager.createNode(node);
      expect(nodeId).toBe('test_1');

      // Find the node
      const nodes = await nebulaConnectionManager.findNodesByLabel('test_person', {
        name: 'Test User',
      });
      expect(nodes).toBeDefined();
      expect(Array.isArray(nodes)).toBe(true);
    });

    it('should create and find relationships', async () => {
      // Create test nodes first
      const node1 = {
        label: 'test_person',
        id: 'test_2',
        properties: { name: 'Test User 2', created: new Date().toISOString() },
      };

      const node2 = {
        label: 'test_person',
        id: 'test_3',
        properties: { name: 'Test User 3', created: new Date().toISOString() },
      };

      await nebulaConnectionManager.createNode(node1);
      await nebulaConnectionManager.createNode(node2);

      // Create a relationship
      const relationship = {
        type: 'test_knows',
        srcId: 'test_2',
        dstId: 'test_3',
        properties: { since: 2020 },
      };

      const relationshipId = await nebulaConnectionManager.createRelationship(relationship);
      expect(relationshipId).toBe('test_2->test_3');

      // Find the relationship
      const relationships = await nebulaConnectionManager.findRelationships('test_knows');
      expect(relationships).toBeDefined();
      expect(Array.isArray(relationships)).toBe(true);
    });

    it('should execute transactions', async () => {
      const queries = [
        { query: 'INSERT VERTEX test_person(name) VALUES "test_4":("Test User 4")' },
        { query: 'INSERT VERTEX test_person(name) VALUES "test_5":("Test User 5")' },
      ];

      const results = await nebulaConnectionManager.executeTransaction(queries);
      expect(results).toHaveLength(2);
    });

    afterAll(async () => {
      try {
        if (nebulaConnectionManager.isConnectedToDatabase()) {
          // Clean up test data
          try {
            await nebulaConnectionManager.executeQuery('DELETE VERTEX "test_1"');
            await nebulaConnectionManager.executeQuery('DELETE VERTEX "test_2"');
            await nebulaConnectionManager.executeQuery('DELETE VERTEX "test_3"');
            await nebulaConnectionManager.executeQuery('DELETE VERTEX "test_4"');
            await nebulaConnectionManager.executeQuery('DELETE VERTEX "test_5"');
          } catch (error) {
            // Ignore cleanup errors
          }

          await nebulaConnectionManager.disconnect();
        }
      } catch (error) {
        // Ignore disconnect errors in cleanup
      }
      // 清理所有挂起的定时器
      jest.useRealTimers();

      // 确保所有异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});
