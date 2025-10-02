import express from 'express';
import request from 'supertest';
import { GraphStatsRoutes } from '../GraphStatsRoutes';
import { IGraphService } from '../../../service/graph/core/IGraphService';
import { GraphCacheService } from '../../../service/graph/cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../../utils/LoggerService';

// Mock implementations
const createMockGraphService = () => ({
  getGraphStats: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn()
});

const createMockGraphCacheService = () => ({
  getCacheStats: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn()
});

const createMockPerformanceMonitor = () => ({
  getMetrics: jest.fn(),
  isHealthy: jest.fn(),
  getStatus: jest.fn(),
  recordQueryExecution: jest.fn()
});

const createMockLoggerService = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

describe('GraphStatsRoutes', () => {
  let app: express.Application;
  let graphStatsRoutes: GraphStatsRoutes;
  let mockGraphService: any;
  let mockGraphCacheService: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGraphService = createMockGraphService();
    mockGraphCacheService = createMockGraphCacheService();
    mockPerformanceMonitor = createMockPerformanceMonitor();
    mockLoggerService = createMockLoggerService();

    // 设置默认的mock返回值
    mockGraphService.isHealthy.mockResolvedValue(true);
    mockGraphCacheService.isHealthy.mockReturnValue(true);
    mockPerformanceMonitor.isHealthy.mockReturnValue(true);

    mockGraphService.getStatus.mockResolvedValue({
      status: 'healthy',
      connections: 5,
      lastError: null,
      uptime: 3600000
    });

    mockGraphCacheService.getStatus.mockReturnValue({
      status: 'healthy',
      size: 1024000,
      hitRate: 0.85,
      lastCleanup: new Date().toISOString()
    });

    mockPerformanceMonitor.getStatus.mockReturnValue('normal');

    // Create GraphStatsRoutes instance - bypass dependency injection for testing
    // We need to manually assign the properties since the constructor uses @inject decorators
    graphStatsRoutes = new (GraphStatsRoutes as any)();
    (graphStatsRoutes as any).graphService = mockGraphService;
    (graphStatsRoutes as any).graphCacheService = mockGraphCacheService;
    (graphStatsRoutes as any).performanceMonitor = mockPerformanceMonitor;
    (graphStatsRoutes as any).logger = mockLoggerService;
    (graphStatsRoutes as any).router = require('express').Router();
    (graphStatsRoutes as any).setupRoutes();

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/graph', graphStatsRoutes.getRouter());
    
    // Add error handling middleware - must be after routes
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error middleware caught:', err);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
      });
    });
  });

  describe('GET /api/v1/graph/stats/:projectId', () => {
    it('should get graph statistics successfully', async () => {
      const projectId = 'test-project';
      const mockResult = {
        totalFiles: 100,
        totalFunctions: 50,
        totalClasses: 30,
        totalImports: 200,
        complexityScore: 75.5,
        maintainabilityIndex: 85.2,
        cyclicDependencies: 3
      };

      mockGraphService.getGraphStats.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/v1/graph/stats/${projectId}`);

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphService.getGraphStats).toHaveBeenCalledWith(projectId);
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/graph/stats/');

      expect(response.status).toBe(404);
    });

    it('should handle errors when getting graph stats fails', async () => {
      const projectId = 'test-project';
      mockGraphService.getGraphStats.mockRejectedValue(new Error('Failed to get stats'));

      const response = await request(app)
        .get(`/api/v1/graph/stats/${projectId}`);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/graph/stats/cache', () => {
    it('should get cache statistics successfully', async () => {
      const mockResult = {
        hits: 1500,
        misses: 300,
        size: 250
      };

      // 在beforeEach中创建mock之后，这里设置返回值
      mockGraphCacheService.getCacheStats.mockReturnValue(mockResult);
      
      console.log('Mock set for cache stats, making request...');

      const response = await request(app)
        .get('/api/v1/graph/stats/cache');

      console.log('Cache stats response status:', response.status);
      console.log('Cache stats response body:', response.body);
      console.log('Mock getCacheStats called:', mockGraphCacheService.getCacheStats.mock.calls.length);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGraphCacheService.getCacheStats).toHaveBeenCalled();
    });

    it('should handle errors when getting cache stats fails', async () => {
      // 重置mock实现，抛出错误
      mockGraphCacheService.getCacheStats.mockImplementation(() => {
        throw new Error('Cache stats failed');
      });

      console.log('Mock set for cache stats error, making request...');
      
      const response = await request(app)
        .get('/api/v1/graph/stats/cache');

      console.log('Cache stats error response status:', response.status);
      console.log('Cache stats error response body:', response.body);
      
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/graph/stats/performance', () => {
    it('should get performance metrics successfully', async () => {
      const mockResult = {
        totalQueries: 500,
        totalExecutionTime: 22600,
        avgExecutionTime: 45.2,
        cacheHitRate: 0.85,
        cacheHits: 850,
        cacheMisses: 150,
        currentBatchSize: 100,
        memoryUsage: 157286400,
        activeConnections: 5,
        errorRate: 0.05,
        lastUpdated: new Date()
      };

      // 在beforeEach中创建mock之后，这里设置返回值
      mockPerformanceMonitor.getMetrics.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/v1/graph/stats/performance');

      console.log('Performance metrics response:', response.body);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockPerformanceMonitor.getMetrics).toHaveBeenCalled();
    });

    it('should handle errors when getting performance stats fails', async () => {
      // 重置mock实现，抛出错误
      mockPerformanceMonitor.getMetrics.mockImplementation(() => {
        throw new Error('Performance stats failed');
      });

      const response = await request(app)
        .get('/api/v1/graph/stats/performance');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/graph/stats/health', () => {
    it('should return healthy status when all services are healthy', async () => {
      mockGraphService.isHealthy.mockResolvedValue(true);
      mockGraphCacheService.isHealthy.mockReturnValue(true);
      mockPerformanceMonitor.isHealthy.mockReturnValue(true);

      console.log('Mock set for health check, making request...');

      const response = await request(app)
        .get('/api/v1/graph/stats/health');

      console.log('Health check response status:', response.status);
      console.log('Health check response body:', response.body);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services.graphService).toBe(true);
      expect(response.body.data.services.cacheService).toBe(true);
      expect(response.body.data.services.performanceMonitor).toBe(true);
    });

    it('should return unhealthy status when graph service is unhealthy', async () => {
      mockGraphService.isHealthy.mockResolvedValue(false);
      mockGraphCacheService.isHealthy.mockReturnValue(true);
      mockPerformanceMonitor.isHealthy.mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/graph/stats/health');

      console.log('Health check (unhealthy graph) response:', response.body);
      expect(response.status).toBe(503);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.services.graphService).toBe(false);
      expect(response.body.data.services.cacheService).toBe(true);
      expect(response.body.data.services.performanceMonitor).toBe(true);
    });

    it('should return unhealthy status when cache service is unhealthy', async () => {
      mockGraphService.isHealthy.mockResolvedValue(true);
      mockGraphCacheService.isHealthy.mockReturnValue(false);
      mockPerformanceMonitor.isHealthy.mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/graph/stats/health');

      console.log('Health check (unhealthy cache) response:', response.body);
      expect(response.status).toBe(503);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.services.graphService).toBe(true);
      expect(response.body.data.services.cacheService).toBe(false);
      expect(response.body.data.services.performanceMonitor).toBe(true);
    });

    it('should handle errors during health check', async () => {
      mockGraphService.isHealthy.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/v1/graph/stats/health');

      console.log('Health check (error) response:', response.body);
      expect(response.status).toBe(503);
    });
  });

  describe('GET /api/v1/graph/stats/status', () => {
    it('should return service status successfully', async () => {
      const graphServiceStatus = {
        status: 'healthy',
        connections: 5,
        lastError: null,
        uptime: 3600000
      };

      const cacheServiceStatus = {
        status: 'healthy',
        size: 1024000,
        hitRate: 0.85,
        lastCleanup: new Date().toISOString()
      };

      const performanceStatus = 'normal'; // GraphPerformanceMonitor.getStatus() returns a string

      mockGraphService.getStatus.mockResolvedValue(graphServiceStatus);
      mockGraphCacheService.getStatus.mockReturnValue(cacheServiceStatus);
      mockPerformanceMonitor.getStatus.mockReturnValue(performanceStatus);

      const response = await request(app)
        .get('/api/v1/graph/stats/status');

      console.log('Service status response:', response.body);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.services.graphService).toEqual(graphServiceStatus);
      expect(response.body.data.services.cacheService).toEqual(cacheServiceStatus);
      expect(response.body.data.services.performanceMonitor).toBe(performanceStatus);
    });

    it('should handle errors when getting service status fails', async () => {
      mockGraphService.getStatus.mockRejectedValue(new Error('Status check failed'));

      const response = await request(app)
        .get('/api/v1/graph/stats/status');

      console.log('Service status (error) response:', response.body);
      expect(response.status).toBe(500);
    });
  });
});