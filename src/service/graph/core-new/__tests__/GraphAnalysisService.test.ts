import { GraphAnalysisService } from '../GraphAnalysisService';
import { IGraphAnalysisService } from '../types';

// Mock dependencies
jest.mock('../../../database/graph/GraphDatabaseService');
jest.mock('../../../infrastructure/caching/CacheService');
jest.mock('../../../infrastructure/monitoring/PerformanceMonitor');
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');

describe('GraphAnalysisService', () => {
  let graphAnalysisService: IGraphAnalysisService;
  let mockGraphDatabaseService: any;
  let mockCacheService: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;
  let mockErrorHandlerService: any;

  beforeEach(() => {
    // Import mocked modules
    const GraphDatabaseService = require('../../../database/graph/GraphDatabaseService').GraphDatabaseService;
    const CacheService = require('../../../infrastructure/caching/CacheService').CacheService;
    const PerformanceMonitor = require('../../../infrastructure/monitoring/PerformanceMonitor').PerformanceMonitor;
    const LoggerService = require('../../../utils/LoggerService').LoggerService;
    const ErrorHandlerService = require('../../../utils/ErrorHandlerService').ErrorHandlerService;

    // Create mock instances
    mockGraphDatabaseService = new GraphDatabaseService();
    mockCacheService = new CacheService();
    mockPerformanceMonitor = new PerformanceMonitor();
    mockLoggerService = new LoggerService();
    mockErrorHandlerService = new ErrorHandlerService();

    // Create service instance with mocks
    graphAnalysisService = new GraphAnalysisService(
      mockGraphDatabaseService,
      mockCacheService,
      mockPerformanceMonitor,
      mockLoggerService,
      mockErrorHandlerService
    );
  });

  describe('initialize', () => {
    it('should initialize the service', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(true);

      const result = await graphAnalysisService.initialize();

      expect(result).toBe(true);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(false);

      const result = await graphAnalysisService.initialize();

      expect(result).toBe(false);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });
  });

  describe('findRelatedNodes', () => {
    it('should find related nodes with specified relationship types', async () => {
      const nodeId = 'func-123';
      const relationshipTypes = ['CONTAINS', 'CALLS'];
      const maxDepth = 2;

      const mockRelatedNodes = [
        { id: 'file-1', properties: { name: 'testFile.js' } },
        { id: 'func-456', properties: { name: 'anotherFunction' } }
      ];

      mockGraphDatabaseService.findRelatedNodes.mockResolvedValue(mockRelatedNodes);

      const result = await graphAnalysisService.findRelatedNodes(nodeId, relationshipTypes, maxDepth);

      expect(result).toEqual(mockRelatedNodes);
      expect(mockGraphDatabaseService.findRelatedNodes).toHaveBeenCalledWith(nodeId, relationshipTypes, maxDepth);
    });

    it('should find related nodes with default parameters', async () => {
      const nodeId = 'func-123';

      const mockRelatedNodes = [
        { id: 'file-1', properties: { name: 'testFile.js' } }
      ];

      mockGraphDatabaseService.findRelatedNodes.mockResolvedValue(mockRelatedNodes);

      const result = await graphAnalysisService.findRelatedNodes(nodeId);

      expect(result).toEqual(mockRelatedNodes);
      expect(mockGraphDatabaseService.findRelatedNodes).toHaveBeenCalledWith(nodeId, undefined, 2);
    });

    it('should handle errors when finding related nodes', async () => {
      const nodeId = 'func-123';

      mockGraphDatabaseService.findRelatedNodes.mockRejectedValue(new Error('Database error'));

      const result = await graphAnalysisService.findRelatedNodes(nodeId);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findPath', () => {
    it('should find path between nodes', async () => {
      const sourceId = 'node-1';
      const targetId = 'node-2';
      const maxDepth = 3;

      const mockPath = [
        { source: 'node-1', target: 'node-3', relationship: 'CONTAINS' },
        { source: 'node-3', target: 'node-2', relationship: 'CALLS' }
      ];

      mockGraphDatabaseService.findPath.mockResolvedValue(mockPath);

      const result = await graphAnalysisService.findPath(sourceId, targetId, maxDepth);

      expect(result).toEqual(mockPath);
      expect(mockGraphDatabaseService.findPath).toHaveBeenCalledWith(sourceId, targetId, maxDepth);
    });

    it('should handle errors when finding path', async () => {
      const sourceId = 'node-1';
      const targetId = 'node-2';

      mockGraphDatabaseService.findPath.mockRejectedValue(new Error('Database error'));

      const result = await graphAnalysisService.findPath(sourceId, targetId);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('analyzeCodeStructure', () => {
    it('should analyze code structure for a project', async () => {
      const projectId = 'project-1';

      const mockStats = {
        nodeCount: 100,
        relationshipCount: 200,
        nodeTypes: { Function: 50, Class: 30, File: 20 },
        relationshipTypes: { CONTAINS: 100, CALLS: 80, IMPORTS: 20 }
      };

      mockGraphDatabaseService.getGraphStatistics.mockResolvedValue(mockStats);

      const result = await graphAnalysisService.analyzeCodeStructure(projectId);

      expect(result).toEqual({
        projectId,
        stats: mockStats,
        analysis: {
          totalFiles: 20,
          totalFunctions: 50,
          totalClasses: 30,
          averageFunctionsPerFile: 2.5,
          averageClassesPerFile: 1.5,
          complexityMetrics: {
            totalRelationships: 200,
            averageRelationshipsPerNode: 2
          }
        }
      });
      expect(mockGraphDatabaseService.getGraphStatistics).toHaveBeenCalled();
    });

    it('should use cached analysis when available', async () => {
      const projectId = 'project-1';
      const cacheKey = `code_structure_${projectId}`;

      const cachedAnalysis = {
        projectId,
        stats: {
          nodeCount: 100,
          relationshipCount: 200,
          nodeTypes: { Function: 50, Class: 30, File: 20 },
          relationshipTypes: { CONTAINS: 100, CALLS: 80, IMPORTS: 20 }
        },
        analysis: {
          totalFiles: 20,
          totalFunctions: 50,
          totalClasses: 30,
          averageFunctionsPerFile: 2.5,
          averageClassesPerFile: 1.5,
          complexityMetrics: {
            totalRelationships: 200,
            averageRelationshipsPerNode: 2
          }
        }
      };

      mockCacheService.getFromCache.mockReturnValue(cachedAnalysis);

      const result = await graphAnalysisService.analyzeCodeStructure(projectId);

      expect(result).toEqual(cachedAnalysis);
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(cacheKey);
      expect(mockGraphDatabaseService.getGraphStatistics).not.toHaveBeenCalled();
    });
  });

  describe('findCodeDependencies', () => {
    it('should find code dependencies for a node', async () => {
      const nodeId = 'func-123';

      const mockDependencies = [
        { id: 'func-456', type: 'function', relationship: 'CALLS' },
        { id: 'class-789', type: 'class', relationship: 'IMPORTS' }
      ];

      mockGraphDatabaseService.findRelatedNodes.mockResolvedValue([
        { id: 'func-456', properties: { type: 'function' } },
        { id: 'class-789', properties: { type: 'class' } }
      ]);

      const result = await graphAnalysisService.findCodeDependencies(nodeId);

      expect(result).toEqual(mockDependencies);
      expect(mockGraphDatabaseService.findRelatedNodes).toHaveBeenCalledWith(nodeId, ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS'], 3);
    });
  });

  describe('findCodeUsage', () => {
    it('should find code usage for a node', async () => {
      const nodeId = 'func-123';

      const mockUsage = [
        { id: 'func-456', type: 'function', relationship: 'CALLED_BY' },
        { id: 'class-789', type: 'class', relationship: 'IMPORTED_BY' }
      ];

      // Mock reverse relationship lookup
      mockGraphDatabaseService.executeQuery.mockResolvedValue([
        { source: 'func-456', target: 'func-123', relationship: 'CALLS' },
        { source: 'class-789', target: 'func-123', relationship: 'IMPORTS' }
      ]);

      const result = await graphAnalysisService.findCodeUsage(nodeId);

      expect(result).toEqual(mockUsage);
      expect(mockGraphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n)-[r]->(m)'),
        { nodeId }
      );
    });
  });

  describe('calculateComplexityMetrics', () => {
    it('should calculate complexity metrics for a project', async () => {
      const projectId = 'project-1';

      const mockStats = {
        nodeCount: 100,
        relationshipCount: 200,
        nodeTypes: { Function: 50, Class: 30, File: 20 },
        relationshipTypes: { CONTAINS: 100, CALLS: 80, IMPORTS: 20 }
      };

      mockGraphDatabaseService.getGraphStatistics.mockResolvedValue(mockStats);

      const result = await graphAnalysisService.calculateComplexityMetrics(projectId);

      expect(result).toEqual({
        projectId,
        metrics: {
          cyclomaticComplexity: 200, // Total relationships
          coupling: 2, // Average relationships per node
          cohesion: 0.67, // Internal relationships / Total relationships
          depth: 3, // Estimated from node types
          breadth: 20 // Number of files
        }
      });
      expect(mockGraphDatabaseService.getGraphStatistics).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the graph database service', async () => {
      await graphAnalysisService.close();

      expect(mockGraphDatabaseService.close).toHaveBeenCalled();
    });
  });
});