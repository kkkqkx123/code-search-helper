import { GraphRepository } from '../GraphRepository';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { INebulaDataOperations } from '../../../../database/nebula/operation/NebulaDataOperations';
import { INebulaGraphOperations } from '../../../../database/nebula/operation/NebulaGraphOperations';
import { INebulaQueryService } from '../../../../database/nebula/query/NebulaQueryService';

describe('GraphRepository', () => {
  let repository: GraphRepository;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockDataOps: jest.Mocked<INebulaDataOperations>;
  let mockGraphOps: jest.Mocked<INebulaGraphOperations>;
  let mockQueryService: jest.Mocked<INebulaQueryService>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    mockDataOps = {} as any;

    mockGraphOps = {
      insertVertex: jest.fn().mockResolvedValue(true),
      batchInsertVertices: jest.fn().mockResolvedValue(true),
      insertEdge: jest.fn().mockResolvedValue(true),
      batchInsertEdges: jest.fn().mockResolvedValue(true),
      updateVertex: jest.fn().mockResolvedValue(true),
      updateEdge: jest.fn().mockResolvedValue(true),
      deleteVertex: jest.fn().mockResolvedValue(true),
      deleteEdge: jest.fn().mockResolvedValue(true),
      findRelatedNodes: jest.fn().mockResolvedValue([]),
      findPath: jest.fn().mockResolvedValue([]),
      findShortestPath: jest.fn().mockResolvedValue([]),
      executeComplexTraversal: jest.fn().mockResolvedValue([]),
      getGraphStats: jest.fn().mockResolvedValue({ nodeCount: 0, relationshipCount: 0 })
    } as any;

    mockQueryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [] })
    } as any;

    repository = new GraphRepository(
      mockLogger,
      mockErrorHandler,
      mockDataOps,
      mockGraphOps,
      mockQueryService
    );
  });

  describe('createNode', () => {
    it('should create a node successfully', async () => {
      const node = { id: 'node1', label: 'File', properties: { name: 'test.ts' } };
      const result = await repository.createNode(node);

      expect(result).toBe('node1');
      expect(mockGraphOps.insertVertex).toHaveBeenCalledWith('File', 'node1', { name: 'test.ts' });
    });

    it('should handle errors when creating a node', async () => {
      const error = new Error('Insert failed');
      mockGraphOps.insertVertex = jest.fn().mockRejectedValue(error);

      const node = { id: 'node1', label: 'File', properties: {} };
      await expect(repository.createNode(node)).rejects.toThrow(error);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('createNodes', () => {
    it('should create multiple nodes successfully', async () => {
      const nodes = [
        { id: 'node1', label: 'File', properties: { name: 'test1.ts' } },
        { id: 'node2', label: 'File', properties: { name: 'test2.ts' } }
      ];

      const result = await repository.createNodes(nodes);

      expect(result).toEqual(['node1', 'node2']);
      expect(mockGraphOps.batchInsertVertices).toHaveBeenCalled();
    });
  });

  describe('getNodeById', () => {
    it('should get a node by ID', async () => {
      const mockNode = { id: 'node1', label: 'File', properties: {} };
      mockQueryService.executeQuery = jest.fn().mockResolvedValue({ data: [mockNode] });

      const result = await repository.getNodeById('node1');

      expect(result).toEqual(mockNode);
      expect(mockQueryService.executeQuery).toHaveBeenCalled();
    });

    it('should return null when node not found', async () => {
      mockQueryService.executeQuery = jest.fn().mockResolvedValue({ data: [] });

      const result = await repository.getNodeById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createRelationship', () => {
    it('should create a relationship successfully', async () => {
      const relationship = {
        type: 'IMPORTS',
        sourceId: 'node1',
        targetId: 'node2',
        properties: {}
      };

      await repository.createRelationship(relationship);

      expect(mockGraphOps.insertEdge).toHaveBeenCalledWith('IMPORTS', 'node1', 'node2', {});
    });
  });

  describe('findRelatedNodes', () => {
    it('should find related nodes', async () => {
      const mockNodes = [{ id: 'node2' }, { id: 'node3' }];
      mockGraphOps.findRelatedNodes = jest.fn().mockResolvedValue(mockNodes);

      const result = await repository.findRelatedNodes('node1', { maxDepth: 2 });

      expect(result).toEqual(mockNodes);
      expect(mockGraphOps.findRelatedNodes).toHaveBeenCalledWith('node1', [], 2);
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest path between nodes', async () => {
      const mockPath = [{ id: 'node1' }, { id: 'node2' }];
      mockGraphOps.findShortestPath = jest.fn().mockResolvedValue(mockPath);

      const result = await repository.findShortestPath('node1', 'node2');

      expect(result).toEqual(mockPath);
      expect(mockGraphOps.findShortestPath).toHaveBeenCalled();
    });
  });

  describe('getGraphStats', () => {
    it('should get graph statistics', async () => {
      const mockStats = { nodeCount: 100, relationshipCount: 200 };
      mockGraphOps.getGraphStats = jest.fn().mockResolvedValue(mockStats);

      const result = await repository.getGraphStats();

      expect(result).toEqual(mockStats);
      expect(mockGraphOps.getGraphStats).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('should execute a raw query', async () => {
      const query = 'MATCH (n) RETURN n';
      const mockResult = { data: [{ n: { id: 'node1' } }] };
      mockQueryService.executeQuery = jest.fn().mockResolvedValue(mockResult);

      const result = await repository.executeQuery(query);

      expect(result).toEqual(mockResult);
      expect(mockQueryService.executeQuery).toHaveBeenCalledWith(query, undefined);
    });
  });
});