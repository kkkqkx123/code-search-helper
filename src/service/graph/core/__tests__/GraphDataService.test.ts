import { Container } from 'inversify';
import { GraphDataService } from '../GraphDataService';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { IGraphService } from '../IGraphService';
import { GraphQueryBuilder } from '../../../../database/nebula/query/GraphQueryBuilder';

describe('GraphDataService', () => {
  let container: Container;
  let graphDataService: GraphDataService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockGraphService: jest.Mocked<IGraphService>;
  let mockQueryBuilder: jest.Mocked<GraphQueryBuilder>;

  beforeEach(() => {
    container = new Container();

    // 创建模拟服务
    mockConfigService = {
      get: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      validate: jest.fn(),
      initialize: jest.fn(),
      isInitialized: jest.fn(),
      reset: jest.fn(),
    } as any;

    // 创建模拟的GraphService
    mockGraphService = {
      initialize: jest.fn().mockResolvedValue(true),
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
      executeReadQuery: jest.fn().mockResolvedValue({ data: [] }),
      executeWriteQuery: jest.fn().mockResolvedValue({ data: [] }),
      executeBatch: jest.fn().mockResolvedValue({ success: true, results: [] }),
      useSpace: jest.fn().mockResolvedValue(undefined),
      createSpace: jest.fn().mockResolvedValue(true),
      deleteSpace: jest.fn().mockResolvedValue(true),
      spaceExists: jest.fn().mockResolvedValue(true),
      getCurrentSpace: jest.fn().mockReturnValue('test_space'),
      batchInsertNodes: jest.fn().mockResolvedValue({ success: true, insertedCount: 0 }),
      batchInsertEdges: jest.fn().mockResolvedValue({ success: true, insertedCount: 0 }),
      batchDeleteNodes: jest.fn().mockResolvedValue(true),
      clearSpace: jest.fn().mockResolvedValue(true),
      getSpaceInfo: jest.fn().mockResolvedValue({}),
      getDatabaseStats: jest.fn().mockResolvedValue({})
    } as jest.Mocked<IGraphService>;

    mockQueryBuilder = {
      buildPathQuery: jest.fn().mockReturnValue({ nGQL: 'QUERY', parameters: {} }),
      buildNodeQuery: jest.fn().mockReturnValue({ nGQL: 'QUERY', parameters: {} }),
      buildEdgeQuery: jest.fn().mockReturnValue({ nGQL: 'QUERY', parameters: {} }),
      validateQuery: jest.fn().mockReturnValue(true),
      optimizeQuery: jest.fn().mockReturnValue({ nGQL: 'OPTIMIZED_QUERY', parameters: {} }),
      buildNodeCountQuery: jest.fn(),
      buildRelationshipCountQuery: jest.fn(),
      buildNodeSearchQuery: jest.fn(),
      buildRelationshipSearchQuery: jest.fn(),
      buildPathSearchQuery: jest.fn(),
      buildTraversalQuery: jest.fn(),
      buildAnalysisQuery: jest.fn(),
      buildStatsQuery: jest.fn(),
      buildSpaceManagementQuery: jest.fn(),
      buildBatchInsertQuery: jest.fn(),
      buildBatchUpdateQuery: jest.fn(),
      buildBatchDeleteQuery: jest.fn(),
      batchInsertNodes: jest.fn(),
      batchInsertEdges: jest.fn(),
      batchUpdateNodes: jest.fn(),
      batchUpdateEdges: jest.fn(),
      batchDeleteNodes: jest.fn(),
      batchDeleteEdges: jest.fn()
    } as any;

    // 绑定依赖
    container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind<IGraphService>(TYPES.IGraphService).toConstantValue(mockGraphService);
    container.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).toConstantValue(mockQueryBuilder);

    graphDataService = container.get(GraphDataService);
  });

  describe('initialize', () => {
    it('should initialize successfully when nebula is enabled', async () => {
      process.env.NEBULA_ENABLED = 'true';
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(true);
      expect(mockGraphService.isDatabaseConnected).toHaveBeenCalled();
    });

    it('should return false when nebula is disabled', async () => {
      process.env.NEBULA_ENABLED = 'false';
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(false);
    });

    it('should handle initialization failure', async () => {
      mockGraphService.initialize.mockResolvedValue(false);
      
      const result = await graphDataService.initialize();
      
      expect(result).toBe(false);
    });
  });

  describe('storeParsedFiles', () => {
    beforeEach(async () => {
      await graphDataService.initialize();
    });

    it('should store files successfully', async () => {
      const files = [
        {
          id: 'file1',
          filePath: '/path/to/file1.js',
          relativePath: 'file1.js',
          language: 'javascript',
          size: 1000,
          hash: 'hash1',
          metadata: {
            linesOfCode: 50,
            functions: 2,
            classes: 1,
            imports: ['import1']
          },
          chunks: []
        }
      ];

      const options = { projectId: 'project1' };

      mockGraphService.executeBatch.mockResolvedValue({ 
        success: true, 
        results: [{ success: true, data: { inserted: true } }] 
      });

      const result = await graphDataService.storeParsedFiles(files, options);

      expect(result.success).toBe(true);
      expect(mockGraphService.spaceExists).toHaveBeenCalledWith('project1');
      expect(mockGraphService.useSpace).toHaveBeenCalledWith('project1');
      expect(mockGraphService.executeBatch).toHaveBeenCalled();
    });

    it('should handle space creation failure', async () => {
      const files = [{ id: 'file1', filePath: '/path/to/file1.js' }];
      const options = { projectId: 'project1' };

      mockGraphService.createSpace.mockResolvedValue(false);

      const result = await graphDataService.storeParsedFiles(files, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Storage failed:');
    });
  });

  describe('findRelatedNodes', () => {
    beforeEach(async () => {
      await graphDataService.initialize();
    });

    it('should find related nodes successfully', async () => {
      const mockResult = {
        data: [
          { id: 'node1', type: 'Function', name: 'testFunc' }
        ]
      };

      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphDataService.findRelatedNodes('node1', ['CALLS'], 2);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node1');
      expect(mockGraphService.executeReadQuery).toHaveBeenCalled();
    });

    it('should handle query failure', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphDataService.findRelatedNodes('node1');

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteNodes', () => {
    beforeEach(async () => {
      await graphDataService.initialize();
    });

    it('should delete nodes successfully', async () => {
      const nodeIds = ['node1', 'node2'];

      mockGraphService.executeBatch.mockResolvedValue({ 
        success: true, 
        results: [] 
      });

      const result = await graphDataService.deleteNodes(nodeIds);

      expect(result).toBe(true);
      expect(mockGraphService.executeBatch).toHaveBeenCalled();
    });

    it('should handle deletion failure', async () => {
      const nodeIds = ['node1'];

      mockGraphService.executeBatch.mockResolvedValue({ 
        success: false, 
        error: 'Deletion failed' 
      });

      const result = await graphDataService.deleteNodes(nodeIds);

      expect(result).toBe(false);
    });
  });

  describe('clearGraph', () => {
    beforeEach(async () => {
      await graphDataService.initialize();
    });

    it('should clear graph successfully', async () => {
      mockGraphService.getCurrentSpace.mockReturnValue('test_space');
      mockGraphService.deleteSpace.mockResolvedValue(true);
      mockGraphService.createSpace.mockResolvedValue(true);

      const result = await graphDataService.clearGraph();

      expect(result).toBe(true);
      expect(mockGraphService.deleteSpace).toHaveBeenCalledWith('test_space');
      expect(mockGraphService.createSpace).toHaveBeenCalledWith('test_space');
      expect(mockGraphService.useSpace).toHaveBeenCalledWith('test_space');
    });

    it('should handle no active space', async () => {
      mockGraphService.getCurrentSpace.mockReturnValue(null);

      const result = await graphDataService.clearGraph();

      expect(result).toBe(false);
    });
  });

  describe('executeRawQuery', () => {
    beforeEach(async () => {
      await graphDataService.initialize();
    });

    it('should execute raw query successfully', async () => {
      const query = 'SHOW TAGS';
      const mockResult = { data: [{ name: 'Tag1' }] };

      mockGraphService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphDataService.executeRawQuery(query);

      expect(result).toEqual(mockResult);
      expect(mockGraphService.executeReadQuery).toHaveBeenCalledWith(query, {});
    });

    it('should handle query failure', async () => {
      const query = 'INVALID QUERY';

      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      await expect(graphDataService.executeRawQuery(query)).rejects.toThrow('Query failed');
    });
  });

  describe('close', () => {
    it('should close service successfully', async () => {
      await graphDataService.close();

      expect(mockGraphService.close).toHaveBeenCalled();
    });

    it('should handle close failure', async () => {
      mockGraphService.close.mockRejectedValue(new Error('Close failed'));

      await expect(graphDataService.close()).rejects.toThrow('Close failed');
    });
  });
});