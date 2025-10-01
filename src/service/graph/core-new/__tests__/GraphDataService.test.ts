import { GraphDataService } from '../GraphDataService';
import { IGraphDataService } from '../types';

// Mock dependencies
jest.mock('../../../database/graph/GraphDatabaseService');
jest.mock('../../../infrastructure/caching/CacheService');
jest.mock('../../../infrastructure/batching/BatchOptimizer');
jest.mock('../../../infrastructure/monitoring/PerformanceMonitor');
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../../config/ConfigService');

describe('GraphDataService', () => {
  let graphDataService: IGraphDataService;
  let mockGraphDatabaseService: any;
  let mockCacheService: any;
  let mockBatchOptimizer: any;
  let mockPerformanceMonitor: any;
  let mockLoggerService: any;
  let mockErrorHandlerService: any;
  let mockConfigService: any;

  beforeEach(() => {
    // Import mocked modules
    const GraphDatabaseService = require('../../../database/graph/GraphDatabaseService').GraphDatabaseService;
    const CacheService = require('../../../infrastructure/caching/CacheService').CacheService;
    const BatchOptimizer = require('../../../infrastructure/batching/BatchOptimizer').BatchOptimizer;
    const PerformanceMonitor = require('../../../infrastructure/monitoring/PerformanceMonitor').PerformanceMonitor;
    const LoggerService = require('../../../utils/LoggerService').LoggerService;
    const ErrorHandlerService = require('../../../utils/ErrorHandlerService').ErrorHandlerService;
    const ConfigService = require('../../../config/ConfigService').ConfigService;

    // Create mock instances
    mockGraphDatabaseService = new GraphDatabaseService();
    mockCacheService = new CacheService();
    mockBatchOptimizer = new BatchOptimizer();
    mockPerformanceMonitor = new PerformanceMonitor();
    mockLoggerService = new LoggerService();
    mockErrorHandlerService = new ErrorHandlerService();
    mockConfigService = new ConfigService();

    // Create service instance with mocks
    graphDataService = new GraphDataService(
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService,
      mockGraphDatabaseService,
      mockCacheService,
      mockBatchOptimizer,
      mockPerformanceMonitor
    );
  });

  describe('initialize', () => {
    it('should initialize the graph database service', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(true);

      const result = await graphDataService.initialize();

      expect(result).toBe(true);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      mockGraphDatabaseService.initialize.mockResolvedValue(false);

      const result = await graphDataService.initialize();

      expect(result).toBe(false);
      expect(mockGraphDatabaseService.initialize).toHaveBeenCalled();
    });
  });

  describe('storeParsedFiles', () => {
    it('should store parsed files in the graph', async () => {
      const files = [
        {
          id: 'file-1',
          filePath: '/path/to/file1.js',
          relativePath: 'file1.js',
          language: 'javascript',
          size: 1024,
          hash: 'hash1',
          metadata: {
            linesOfCode: 50,
            functions: 2,
            classes: 1
          },
          chunks: [
            {
              id: 'chunk-1',
              type: 'function',
              functionName: 'testFunction',
              content: 'function test() {}',
              startLine: 1,
              endLine: 5,
              metadata: {
                complexity: 1,
                parameters: [],
                returnType: 'void'
              }
            }
          ]
        }
      ];

      const options = { projectId: 'project-1' };

      mockGraphDatabaseService.batchInsertNodes.mockResolvedValue({ success: true, nodesCreated: 2 });
      mockGraphDatabaseService.batchInsertRelationships.mockResolvedValue({ success: true, relationshipsCreated: 2 });

      const result = await graphDataService.storeParsedFiles(files, options);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(2);
      expect(result.relationshipsCreated).toBe(2);
      expect(mockGraphDatabaseService.batchInsertNodes).toHaveBeenCalled();
      expect(mockGraphDatabaseService.batchInsertRelationships).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const files = [
        {
          id: 'file-1',
          filePath: '/path/to/file1.js',
          relativePath: 'file1.js',
          language: 'javascript',
          size: 1024,
          hash: 'hash1'
        }
      ];

      const options = { projectId: 'project-1' };

      mockGraphDatabaseService.batchInsertNodes.mockRejectedValue(new Error('Database error'));

      const result = await graphDataService.storeParsedFiles(files, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('storeChunks', () => {
    it('should store chunks in the graph', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          type: 'function',
          functionName: 'testFunction',
          content: 'function test() {}',
          startLine: 1,
          endLine: 5,
          metadata: {
            complexity: 1,
            parameters: [],
            returnType: 'void'
          }
        }
      ];

      const options = { projectId: 'project-1' };

      mockGraphDatabaseService.batchInsertNodes.mockResolvedValue({ success: true, nodesCreated: 1 });
      mockGraphDatabaseService.batchInsertRelationships.mockResolvedValue({ success: true, relationshipsCreated: 1 });

      const result = await graphDataService.storeChunks(chunks, options);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(result.relationshipsCreated).toBe(1);
      expect(mockGraphDatabaseService.batchInsertNodes).toHaveBeenCalled();
      expect(mockGraphDatabaseService.batchInsertRelationships).toHaveBeenCalled();
    });
  });

  describe('updateChunks', () => {
    it('should update existing chunks and create new ones', async () => {
      const chunks = [
        {
          id: 'existing-chunk',
          type: 'function',
          functionName: 'updatedFunction',
          content: 'function updated() {}',
          startLine: 1,
          endLine: 5
        },
        {
          id: 'new-chunk',
          type: 'function',
          functionName: 'newFunction',
          content: 'function new() {}',
          startLine: 6,
          endLine: 10
        }
      ];

      const options = { projectId: 'project-1' };

      // Mock existing node IDs
      const existingNodeIds = ['existing-chunk'];

      // Mock the private method
      (graphDataService as any).getExistingNodeIds = jest.fn().mockResolvedValue(existingNodeIds);

      mockGraphDatabaseService.updateNode.mockResolvedValue({ success: true });
      mockGraphDatabaseService.batchInsertNodes.mockResolvedValue({ success: true, nodesCreated: 1 });

      const result = await graphDataService.updateChunks(chunks, options);

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(result.nodesUpdated).toBe(1);
      expect(mockGraphDatabaseService.updateNode).toHaveBeenCalled();
      expect(mockGraphDatabaseService.batchInsertNodes).toHaveBeenCalled();
    });
  });

  describe('deleteNodesByFiles', () => {
    it('should delete nodes associated with files', async () => {
      const filePaths = ['/path/to/file1.js', '/path/to/file2.js'];

      // Mock the private method
      (graphDataService as any).getNodeIdsByFiles = jest.fn().mockResolvedValue(['node-1', 'node-2', 'node-3']);

      mockGraphDatabaseService.deleteNode.mockResolvedValue({ success: true });

      const result = await graphDataService.deleteNodesByFiles(filePaths);

      expect(result).toBe(true);
      expect(mockGraphDatabaseService.deleteNode).toHaveBeenCalledTimes(3);
    });

    it('should handle case with no nodes to delete', async () => {
      const filePaths = ['/path/to/file1.js'];

      // Mock the private method
      (graphDataService as any).getNodeIdsByFiles = jest.fn().mockResolvedValue([]);

      const result = await graphDataService.deleteNodesByFiles(filePaths);

      expect(result).toBe(true);
      expect(mockGraphDatabaseService.deleteNode).not.toHaveBeenCalled();
    });
  });

  describe('clearGraph', () => {
    it('should clear the graph for a project', async () => {
      const projectId = 'project-1';

      mockGraphDatabaseService.clearGraph.mockResolvedValue(true);

      const result = await graphDataService.clearGraph(projectId);

      expect(result).toBe(true);
      expect(mockGraphDatabaseService.clearGraph).toHaveBeenCalledWith(projectId);
    });
  });

  describe('getGraphStats', () => {
    it('should get graph statistics', async () => {
      const mockStats = {
        nodeCount: 100,
        relationshipCount: 200,
        nodeTypes: { Function: 50, Class: 30, File: 20 },
        relationshipTypes: { CONTAINS: 100, CALLS: 80, IMPORTS: 20 }
      };

      mockGraphDatabaseService.getGraphStatistics.mockResolvedValue(mockStats);

      const result = await graphDataService.getGraphStats();

      expect(result).toEqual(mockStats);
      expect(mockGraphDatabaseService.getGraphStatistics).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the graph database service', async () => {
      await graphDataService.close();

      expect(mockGraphDatabaseService.close).toHaveBeenCalled();
    });
  });
});