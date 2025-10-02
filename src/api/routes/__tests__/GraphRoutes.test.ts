import express from 'express';
import request from 'supertest';
import { GraphRoutes } from '../GraphRoutes';
import { IGraphService } from '../../../service/graph/core/IGraphService';
import { ProjectLookupService } from '../../../database/ProjectLookupService';
import { GraphQueryValidator } from '../../../service/graph/validation/GraphQueryValidator';
import { GraphPerformanceMonitor } from '../../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../../utils/LoggerService';

// Mock implementations
const createMockGraphService = () => ({
  createSpace: jest.fn(),
  dropSpace: jest.fn(),
  clearSpace: jest.fn(),
  getSpaceInfo: jest.fn(),
  batchInsertNodes: jest.fn(),
  batchInsertEdges: jest.fn(),
  batchDeleteNodes: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn()
});

const createMockProjectLookupService = () => ({
  indexSyncService: {
    startIndexing: jest.fn(),
    stopIndexing: jest.fn(),
    getIndexStatus: jest.fn(),
    reindexProject: jest.fn()
  }
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

describe('GraphRoutes', () => {
  let app: express.Application;
  let graphRoutes: GraphRoutes;
  let mockGraphService: any;
  let mockProjectLookupService: any;
  let mockQueryValidator: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGraphService = createMockGraphService();
    mockProjectLookupService = createMockProjectLookupService();
    mockQueryValidator = createMockGraphQueryValidator();
    mockPerformanceMonitor = createMockPerformanceMonitor();
    mockLoggerService = createMockLoggerService();

    // Create GraphRoutes instance
    graphRoutes = new GraphRoutes(
      mockGraphService as IGraphService,
      mockProjectLookupService as ProjectLookupService,
      mockQueryValidator as GraphQueryValidator,
      mockPerformanceMonitor as GraphPerformanceMonitor,
      mockLoggerService as LoggerService
    );

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/graph', graphRoutes.getRouter());
  });

  describe('POST /api/v1/graph/space/:projectId/create', () => {
    it('should create space successfully', async () => {
      const projectId = 'test-project';
      const requestBody = {
        partitionNum: 10,
        replicaFactor: 3,
        vidType: 'FIXED_STRING(32)'
      };

      const mockResult = {
        spaceName: projectId,
        status: 'CREATED',
        partitionNum: 10,
        replicaFactor: 3
      };

      mockGraphService.createSpace.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/v1/graph/space/${projectId}/create`)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.createSpace).toHaveBeenCalledWith(projectId, requestBody);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/space//create')
        .send({
          partitionNum: 10,
          replicaFactor: 3
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/graph/space/:projectId/delete', () => {
    it('should delete space successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        spaceName: projectId,
        status: 'DROPPED'
      };

      mockGraphService.dropSpace.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/v1/graph/space/${projectId}/delete`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.dropSpace).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/space//delete');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/graph/space/:projectId/clear', () => {
    it('should clear space successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        spaceName: projectId,
        clearedNodes: 100,
        clearedEdges: 150
      };

      mockGraphService.clearSpace.mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/v1/graph/space/${projectId}/clear`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.clearSpace).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/space//clear');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/graph/space/:projectId/info', () => {
    it('should get space info successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        spaceName: projectId,
        partitionNum: 10,
        replicaFactor: 3,
        vidType: 'FIXED_STRING(32)',
        status: 'ONLINE',
        nodeCount: 100,
        edgeCount: 150
      };

      mockGraphService.getSpaceInfo.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/v1/graph/space/${projectId}/info`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.getSpaceInfo).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/space//info');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/graph/nodes', () => {
    it('should batch insert nodes successfully', async () => {
      const requestBody = {
        nodes: [
          {
            id: 'node1',
            type: 'Function',
            name: 'main',
            properties: {
              filePath: '/path/to/file.ts',
              lineNumber: 10
            }
          },
          {
            id: 'node2',
            type: 'Class',
            name: 'MainClass',
            properties: {
              filePath: '/path/to/class.ts',
              methods: 5
            }
          }
        ],
        projectId: 'test-project'
      };

      const mockResult = {
        inserted: 2,
        failed: 0,
        errors: []
      };

      mockGraphService.batchInsertNodes.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/nodes')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.batchInsertNodes).toHaveBeenCalledWith(
        requestBody.nodes,
        requestBody.projectId
      );
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/nodes')
        .send({
          nodes: [{ id: 'node1', type: 'Function' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });

    it('should return 400 when nodes array is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/graph/nodes')
        .send({
          nodes: [],
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Nodes array is required and cannot be empty');
    });

    it('should handle insertion errors', async () => {
      mockGraphService.batchInsertNodes.mockRejectedValue(new Error('Insertion failed'));

      const response = await request(app)
        .post('/api/v1/graph/nodes')
        .send({
          nodes: [{ id: 'node1', type: 'Function' }],
          projectId: 'test-project'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/graph/edges', () => {
    it('should batch insert edges successfully', async () => {
      const requestBody = {
        edges: [
          {
            from: 'node1',
            to: 'node2',
            type: 'CALLS',
            properties: {
              lineNumber: 15,
              frequency: 10
            }
          },
          {
            from: 'node2',
            to: 'node3',
            type: 'DEPENDS_ON',
            properties: {
              strength: 0.8
            }
          }
        ],
        projectId: 'test-project'
      };

      const mockResult = {
        inserted: 2,
        failed: 0,
        errors: []
      };

      mockGraphService.batchInsertEdges.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/edges')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.batchInsertEdges).toHaveBeenCalledWith(
        requestBody.edges,
        requestBody.projectId
      );
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/edges')
        .send({
          edges: [{ from: 'node1', to: 'node2', type: 'CALLS' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });

    it('should return 400 when edges array is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/graph/edges')
        .send({
          edges: [],
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Edges array is required and cannot be empty');
    });
  });

  describe('DELETE /api/v1/graph/nodes', () => {
    it('should batch delete nodes successfully', async () => {
      const requestBody = {
        nodeIds: ['node1', 'node2', 'node3'],
        projectId: 'test-project'
      };

      const mockResult = {
        deleted: 3,
        failed: 0,
        errors: []
      };

      mockGraphService.batchDeleteNodes.mockResolvedValue(mockResult);

      const response = await request(app)
        .delete('/api/v1/graph/nodes')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.batchDeleteNodes).toHaveBeenCalledWith(
        requestBody.nodeIds,
        requestBody.projectId
      );
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .delete('/api/v1/graph/nodes')
        .send({
          nodeIds: ['node1', 'node2']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });

    it('should return 400 when nodeIds array is invalid', async () => {
      const response = await request(app)
        .delete('/api/v1/graph/nodes')
        .send({
          nodeIds: [],
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Node IDs array is required and cannot be empty');
    });

    it('should handle deletion errors', async () => {
      mockGraphService.batchDeleteNodes.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete('/api/v1/graph/nodes')
        .send({
          nodeIds: ['node1', 'node2'],
          projectId: 'test-project'
        });

      expect(response.status).toBe(500);
    });
  });
});