import express from 'express';
import request from 'supertest';
import { GraphAnalysisRoutes } from '../GraphAnalysisRoutes';
import { IGraphService } from '../../../service/graph/core/IGraphService';
import { GraphSearchServiceNew } from '../../../service/graph/core/GraphSearchServiceNew';
import { GraphPerformanceMonitor } from '../../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../../utils/LoggerService';

// Mock implementations
const createMockGraphService = () => ({
  analyzeDependencies: jest.fn(),
  detectCircularDependencies: jest.fn(),
  analyzeCallGraph: jest.fn(),
  analyzeImpact: jest.fn(),
  getProjectOverview: jest.fn(),
  getStructureMetrics: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn()
});

const createMockGraphSearchService = () => ({
  search: jest.fn(),
  getSearchSuggestions: jest.fn()
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

describe('GraphAnalysisRoutes', () => {
  let app: express.Application;
  let graphAnalysisRoutes: GraphAnalysisRoutes;
  let mockGraphService: any;
  let mockGraphSearchService: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGraphService = createMockGraphService();
    mockGraphSearchService = createMockGraphSearchService();
    mockPerformanceMonitor = createMockPerformanceMonitor();
    mockLoggerService = createMockLoggerService();

    // Create GraphAnalysisRoutes instance
    graphAnalysisRoutes = new GraphAnalysisRoutes(
      mockGraphService as IGraphService,
      mockGraphSearchService as GraphSearchServiceNew,
      mockPerformanceMonitor as GraphPerformanceMonitor,
      mockLoggerService as LoggerService
    );

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/graph', graphAnalysisRoutes.getRouter());
  });

  describe('POST /api/v1/graph/analysis/dependencies', () => {
    it('should analyze dependencies successfully', async () => {
      const requestBody = {
        filePath: '/path/to/file.ts',
        projectId: 'test-project',
        includeTransitive: true,
        includeCircular: false
      };

      const mockResult = {
        filePath: '/path/to/file.ts',
        dependencies: ['/path/to/dep1.ts', '/path/to/dep2.ts'],
        dependents: ['/path/to/dep3.ts'],
        circularDependencies: []
      };

      mockGraphService.analyzeDependencies.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/analysis/dependencies')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.analyzeDependencies).toHaveBeenCalledWith(
        requestBody.filePath,
        requestBody.projectId,
        {
          includeTransitive: true,
          includeCircular: false
        }
      );
    });

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/dependencies')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('File path is required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/dependencies')
        .send({
          filePath: '/path/to/file.ts'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });

    it('should handle analysis errors', async () => {
      mockGraphService.analyzeDependencies.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/api/v1/graph/analysis/dependencies')
        .send({
          filePath: '/path/to/file.ts',
          projectId: 'test-project'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/graph/analysis/circular/:projectId', () => {
    it('should detect circular dependencies successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        circularDependencies: [
          {
            cycle: ['file1.ts', 'file2.ts', 'file3.ts'],
            length: 3
          }
        ],
        projectId
      };

      mockGraphService.detectCircularDependencies.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/v1/graph/analysis/circular/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.detectCircularDependencies).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/analysis/circular/');

      expect(response.status).toBe(404); // Express handles this as route not found
    });

    it('should handle detection errors', async () => {
      const projectId = 'test-project';
      mockGraphService.detectCircularDependencies.mockRejectedValue(new Error('Detection failed'));

      const response = await request(app)
        .get(`/api/v1/graph/analysis/circular/${projectId}`);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/graph/analysis/callgraph', () => {
    it('should analyze call graph successfully', async () => {
      const requestBody = {
        functionName: 'testFunction',
        projectId: 'test-project',
        depth: 2,
        direction: 'both'
      };

      const mockResult = {
        functionName: 'testFunction',
        callers: ['functionA', 'functionB'],
        callees: ['functionC', 'functionD'],
        depth: 2
      };

      mockGraphService.analyzeCallGraph.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/analysis/callgraph')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.analyzeCallGraph).toHaveBeenCalledWith(
        requestBody.functionName,
        requestBody.projectId,
        {
          depth: 2,
          direction: 'both'
        }
      );
    });

    it('should return 400 when functionName is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/callgraph')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Function name is required');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/callgraph')
        .send({
          functionName: 'testFunction'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });

  describe('POST /api/v1/graph/analysis/impact', () => {
    it('should analyze impact successfully', async () => {
      const requestBody = {
        nodeIds: ['node1', 'node2', 'node3'],
        projectId: 'test-project',
        depth: 3
      };

      const mockResult = {
        impactedNodes: ['node4', 'node5', 'node6'],
        impactLevel: 'high',
        depth: 3
      };

      mockGraphService.analyzeImpact.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/graph/analysis/impact')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.analyzeImpact).toHaveBeenCalledWith(
        requestBody.nodeIds,
        requestBody.projectId,
        { depth: 3 }
      );
    });

    it('should return 400 when nodeIds is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/impact')
        .send({
          nodeIds: [],
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Node IDs array is required and cannot be empty');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/graph/analysis/impact')
        .send({
          nodeIds: ['node1', 'node2']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID is required');
    });
  });

  describe('GET /api/v1/graph/analysis/overview/:projectId', () => {
    it('should get project overview successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        projectId,
        totalNodes: 100,
        totalEdges: 150,
        fileCount: 50,
        functionCount: 200,
        classCount: 30
      };

      mockGraphService.getProjectOverview.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/v1/graph/analysis/overview/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.getProjectOverview).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/analysis/overview/');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/graph/analysis/metrics/:projectId', () => {
    it('should get structure metrics successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        projectId,
        complexity: {
          cyclomatic: 45,
          cognitive: 32
        },
        coupling: {
          afferent: 15,
          efferent: 20
        },
        cohesion: 0.78
      };

      mockGraphService.getStructureMetrics.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/v1/graph/analysis/metrics/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.getStructureMetrics).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/analysis/metrics/');

      expect(response.status).toBe(404);
    });
  });
});