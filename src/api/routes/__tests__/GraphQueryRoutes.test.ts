import express from 'express';
import request from 'supertest';
import { GraphQueryRoutes } from '../GraphQueryRoutes';
import { GraphServiceNewAdapter } from '../../../service/graph/core/GraphServiceNewAdapter';
import { GraphQueryValidator } from '../../../service/graph/query/GraphQueryValidator';
import { GraphPerformanceMonitor } from '../../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../../utils/LoggerService';

// Mock implementations
const createMockGraphService = () => ({
  graphDataService: {
    executeRawQuery: jest.fn()
  },
  findRelatedNodes: jest.fn(),
  findPath: jest.fn(),
  search: jest.fn(),
  getSearchSuggestions: jest.fn()
});

const createMockGraphQueryValidator = () => ({
  validateQuery: jest.fn()
});

const createMockPerformanceMonitor = () => ({
  recordQueryExecution: jest.fn(),
  getMetrics: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn()
});

const createMockLoggerService = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

describe('GraphQueryRoutes', () => {
  let app: express.Application;
  let graphQueryRoutes: GraphQueryRoutes;
  let mockGraphService: any;
  let mockQueryValidator: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGraphService = createMockGraphService();
    mockQueryValidator = createMockGraphQueryValidator();
    mockPerformanceMonitor = createMockPerformanceMonitor();
    mockLoggerService = createMockLoggerService();

    // Create GraphQueryRoutes instance
    graphQueryRoutes = new GraphQueryRoutes(
      mockGraphService as GraphServiceNewAdapter,
      mockQueryValidator as GraphQueryValidator,
      mockPerformanceMonitor as GraphPerformanceMonitor,
      mockLoggerService as LoggerService
    );

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/graph', graphQueryRoutes.getRouter());
  });

  describe('POST /api/v1/graph/query', () => {
    it('should execute custom query successfully', async () => {
      const requestBody = {
        query: 'MATCH (n) RETURN n LIMIT 10',
        projectId: 'test-project',
        parameters: {}
      };

      const mockResult = {
        data: [
          { id: 'node1', type: 'File', name: 'file1.ts' },
          { id: 'node2', type: 'Function', name: 'main' }
        ]
      };

      mockQueryValidator.validateQuery.mockReturnValue({ valid: true });
      mockGraphService.graphDataService.executeRawQuery.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/query')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockQueryValidator.validateQuery).toHaveBeenCalledWith(requestBody.query);
      expect(mockGraphService.graphDataService.executeRawQuery).toHaveBeenCalledWith(
        requestBody.query,
        requestBody.parameters
      );
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/query')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Query is required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/query')
        .send({
          query: 'MATCH (n) RETURN n'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });

    it('should return 400 when query is invalid', async () => {
      mockQueryValidator.validateQuery.mockReturnValue({
        valid: false,
        error: 'Invalid query syntax'
      });

      const response = await request(app)
        .post('/api/v1/graph/query')
        .send({
          query: 'INVALID QUERY',
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid Query');
    });

    it('should handle query execution errors', async () => {
      mockQueryValidator.validateQuery.mockReturnValue({ valid: true });
      mockGraphService.graphDataService.executeRawQuery.mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .post('/api/v1/graph/query')
        .send({
          query: 'MATCH (n) RETURN n',
          projectId: 'test-project'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/graph/related', () => {
    it('should find related nodes successfully', async () => {
      const requestBody = {
        nodeId: 'node1',
        projectId: 'test-project',
        relationshipTypes: ['DEPENDS_ON', 'CALLS'],
        maxDepth: 2,
        limit: 10
      };

      const mockResult = [
        { id: 'node2', type: 'Function', name: 'functionA' },
        { id: 'node3', type: 'Class', name: 'ClassB' }
      ];

      mockGraphService.findRelatedNodes.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/related')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.nodes).toEqual(mockResult);
      expect(response.body.relationships).toEqual([]);
      expect(mockGraphService.findRelatedNodes).toHaveBeenCalledWith(
        requestBody.nodeId,
        requestBody.relationshipTypes,
        requestBody.maxDepth
      );
    });

    it('should return 400 when nodeId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/related')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Node ID is required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/related')
        .send({
          nodeId: 'node1'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });

  describe('POST /api/v1/graph/path/shortest', () => {
    it('should find shortest path successfully', async () => {
      const requestBody = {
        sourceId: 'node1',
        targetId: 'node2',
        projectId: 'test-project',
        edgeTypes: ['CALLS', 'DEPENDS_ON'],
        maxDepth: 5
      };

      const mockResult = {
        path: ['node1', 'node3', 'node2'],
        length: 2,
        edges: [
          { from: 'node1', to: 'node3', type: 'CALLS' },
          { from: 'node3', to: 'node2', type: 'DEPENDS_ON' }
        ]
      };

      mockGraphService.findPath.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/path/shortest')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.findPath).toHaveBeenCalledWith(
        requestBody.sourceId,
        requestBody.targetId,
        requestBody.maxDepth
      );
    });

    it('should return 400 when sourceId or targetId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/path/shortest')
        .send({
          sourceId: 'node1',
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Source ID and Target ID are required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/path/shortest')
        .send({
          sourceId: 'node1',
          targetId: 'node2'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });

  describe('POST /api/v1/graph/path/all', () => {
    it('should find all paths successfully', async () => {
      const requestBody = {
        sourceId: 'node1',
        targetId: 'node2',
        projectId: 'test-project',
        maxDepth: 3
      };

      const mockResult = {
        paths: [
          { path: ['node1', 'node3', 'node2'], length: 2 },
          { path: ['node1', 'node4', 'node5', 'node2'], length: 3 }
        ]
      };

      mockGraphService.graphDataService.executeRawQuery.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/path/all')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should return 400 when sourceId or targetId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/path/all')
        .send({
          sourceId: 'node1',
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Source ID and Target ID are required');
    });
  });

  describe('POST /api/v1/graph/traversal', () => {
    it('should traverse graph successfully using BFS', async () => {
      const requestBody = {
        startNode: 'node1',
        projectId: 'test-project',
        traversalType: 'BFS',
        depth: 2,
        filters: {
          edgeTypes: ['CALLS', 'DEPENDS_ON'],
          limit: 50
        }
      };

      const mockResult = {
        nodes: [
          { id: 'node1', type: 'Function' },
          { id: 'node2', type: 'Class' }
        ],
        relationships: [
          { from: 'node1', to: 'node2', type: 'CALLS' }
        ]
      };

      mockGraphService.graphDataService.executeRawQuery.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/traversal')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should traverse graph successfully using DFS', async () => {
      const requestBody = {
        startNode: 'node1',
        projectId: 'test-project',
        traversalType: 'DFS',
        depth: 3
      };

      const mockResult = {
        nodes: [
          { id: 'node1', type: 'Function' },
          { id: 'node3', type: 'Class' }
        ],
        relationships: [
          { from: 'node1', to: 'node3', type: 'DEPENDS_ON' }
        ]
      };

      mockGraphService.graphDataService.executeRawQuery.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/traversal')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should return 400 when startNode is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/traversal')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Start node is required');
    });
  });

  describe('POST /api/v1/graph/search', () => {
    it('should perform graph search successfully', async () => {
      const requestBody = {
        query: 'function main',
        projectId: 'test-project',
        limit: 20,
        filters: {
          nodeTypes: ['Function', 'Class'],
          relationshipTypes: ['CALLS']
        }
      };

      const mockResult = {
        nodes: [
          { id: 'func1', type: 'Function', name: 'main', score: 0.95 },
          { id: 'class1', type: 'Class', name: 'MainClass', score: 0.85 }
        ],
        total: 2
      };

      mockGraphService.search.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/search')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.search).toHaveBeenCalledWith(requestBody.query, {
        limit: 20,
        nodeTypes: ['Function', 'Class'],
        relationshipTypes: ['CALLS']
      });
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/search')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Search query is required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/search')
        .send({
          query: 'test query'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });

  describe('GET /api/v1/graph/search/suggestions', () => {
    it('should get search suggestions successfully', async () => {
      const projectId = 'test-project';
      const queryPrefix = 'func';

      const mockResult = [
        'function1',
        'function2',
        'functionMain'
      ];

      mockGraphService.getSearchSuggestions.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/v1/graph/search/suggestions')
        .query({ projectId, queryPrefix });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.getSearchSuggestions).toHaveBeenCalledWith(queryPrefix);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/search/suggestions')
        .query({ queryPrefix: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });
});