import { NebulaGraphOperations } from '../../nebula/NebulaGraphOperations';
import { NebulaService } from '../../nebula/NebulaService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';
import { BatchVertex, BatchEdge } from '../../nebula/NebulaTypes';

// Mock 依赖项
const mockNebulaService = {
  executeWriteQuery: jest.fn(),
  executeReadQuery: jest.fn(),
  executeQuery: jest.fn(),
};

const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockQueryBuilder = {
  insertVertex: jest.fn(),
  insertEdge: jest.fn(),
  batchInsertVertices: jest.fn(),
  batchInsertEdges: jest.fn(),
  updateVertex: jest.fn(),
  updateEdge: jest.fn(),
  buildComplexTraversal: jest.fn(),
};

describe('NebulaGraphOperations', () => {
  let graphOperations: NebulaGraphOperations;

  beforeEach(() => {
    jest.clearAllMocks();

    graphOperations = new NebulaGraphOperations(
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any,
      mockQueryBuilder as any,
      mockNebulaService as any
    );
  });

  describe('insertVertex', () => {
    it('should insert vertex successfully', async () => {
      const mockQueryResult = { query: 'INSERT VERTEX `TestTag` (name) VALUES "vertex123":(name:"Test")', params: { name: 'Test' } };
      mockQueryBuilder.insertVertex.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.insertVertex('TestTag', 'vertex123', { name: 'Test' });

      expect(result).toBe(true);
      expect(mockQueryBuilder.insertVertex).toHaveBeenCalledWith('TestTag', 'vertex123', { name: 'Test' });
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
    });

    it('should return false when vertex insertion fails', async () => {
      const mockQueryResult = { query: 'INSERT VERTEX `TestTag` (name) VALUES "vertex123":(name:"Test")', params: { name: 'Test' } };
      mockQueryBuilder.insertVertex.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Insertion failed'));

      const result = await graphOperations.insertVertex('TestTag', 'vertex123', { name: 'Test' });

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to insert vertex vertex123 in tag TestTag',
        { error: 'Insertion failed' }
      );
    });
  });

  describe('insertEdge', () => {
    it('should insert edge successfully', async () => {
      const mockQueryResult = { query: 'INSERT EDGE `TestEdge` (weight) VALUES "source123" -> "target456":(weight:1)', params: { weight: 1.0 } };
      mockQueryBuilder.insertEdge.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.insertEdge(
        'TestEdge',
        'source123',
        'target456',
        { weight: 1.0 }
      );

      expect(result).toBe(true);
      expect(mockQueryBuilder.insertEdge).toHaveBeenCalledWith(
        'TestEdge',
        'source123',
        'target456',
        { weight: 1.0 }
      );
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
    });

    it('should return false when edge insertion fails', async () => {
      const mockQueryResult = { query: 'INSERT EDGE `TestEdge` (weight) VALUES "source123" -> "target456":(weight:1)', params: { weight: 1.0 } };
      mockQueryBuilder.insertEdge.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Insertion failed'));

      const result = await graphOperations.insertEdge(
        'TestEdge',
        'source123',
        'target456',
        { weight: 1.0 }
      );

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to insert edge TestEdge from source123 to target456',
        { error: 'Insertion failed' }
      );
    });
  });

  describe('batchInsertVertices', () => {
    it('should batch insert vertices successfully', async () => {
      const vertices: BatchVertex[] = [
        { id: 'vertex1', tag: 'TestTag', properties: { name: 'Test1' } },
        { id: 'vertex2', tag: 'TestTag', properties: { name: 'Test2' } },
      ];

      const mockQueryResult = { query: 'INSERT VERTEX `TestTag` (name) VALUES "vertex1":(name:"Test1"),"vertex2":(name:"Test2")', params: {} };
      mockQueryBuilder.batchInsertVertices.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.batchInsertVertices(vertices);

      expect(result).toBe(true);
      expect(mockQueryBuilder.batchInsertVertices).toHaveBeenCalledWith(vertices);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
    });

    it('should handle empty vertices array', async () => {
      const mockQueryResult = { query: '', params: {} };
      mockQueryBuilder.batchInsertVertices.mockReturnValue(mockQueryResult);
      const result = await graphOperations.batchInsertVertices([]);

      expect(result).toBe(true);
      expect(mockQueryBuilder.batchInsertVertices).toHaveBeenCalledWith([]);
      expect(mockNebulaService.executeWriteQuery).not.toHaveBeenCalled();
    });

    it('should return false when batch insert fails', async () => {
      const mockQueryResult = { query: 'INSERT VERTEX `TestTag` (name) VALUES "vertex1":(name:"Test1")', params: {} };
      mockQueryBuilder.batchInsertVertices.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Batch insert failed'));

      const result = await graphOperations.batchInsertVertices([
        { id: 'vertex1', tag: 'TestTag', properties: { name: 'Test1' } },
      ]);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to batch insert vertices',
        { error: 'Batch insert failed' }
      );
    });
  });

  describe('batchInsertEdges', () => {
    it('should batch insert edges successfully', async () => {
      const edges: BatchEdge[] = [
        { srcId: 'src1', dstId: 'dst1', type: 'TestEdge', properties: { weight: 1.0 } },
        { srcId: 'src2', dstId: 'dst2', type: 'TestEdge', properties: { weight: 2.0 } },
      ];

      const mockQueryResult = { query: 'INSERT EDGE `TestEdge` (weight) VALUES "src1"->"dst1":(weight:1),"src2"->"dst2":(weight:2)', params: {} };
      mockQueryBuilder.batchInsertEdges.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.batchInsertEdges(edges);

      expect(result).toBe(true);
      expect(mockQueryBuilder.batchInsertEdges).toHaveBeenCalledWith(edges);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
    });

    it('should handle empty edges array', async () => {
      const mockQueryResult = { query: '', params: {} };
      mockQueryBuilder.batchInsertEdges.mockReturnValue(mockQueryResult);
      const result = await graphOperations.batchInsertEdges([]);

      expect(result).toBe(true);
      expect(mockQueryBuilder.batchInsertEdges).toHaveBeenCalledWith([]);
      expect(mockNebulaService.executeWriteQuery).not.toHaveBeenCalled();
    });

    it('should return false when batch insert fails', async () => {
      const mockQueryResult = { query: 'INSERT EDGE `TestEdge` (weight) VALUES "src1"->"dst1":(weight:1)', params: {} };
      mockQueryBuilder.batchInsertEdges.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Batch insert failed'));

      const result = await graphOperations.batchInsertEdges([
        { srcId: 'src1', dstId: 'dst1', type: 'TestEdge', properties: { weight: 1.0 } },
      ]);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to batch insert edges',
        { error: 'Batch insert failed' }
      );
    });
  });

  describe('findRelatedNodes', () => {
    it('should find related nodes successfully', async () => {
      const mockResult = {
        data: [
          { relatedNode: { id: 'node1', name: 'RelatedNode1' } },
          { relatedNode: { id: 'node2', name: 'RelatedNode2' } },
        ]
      };

      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphOperations.findRelatedNodes('node123', ['REL_TYPE'], 3);

      expect(result).toEqual([
        { id: 'node1', name: 'RelatedNode1' },
        { id: 'node2', name: 'RelatedNode2' },
      ]);
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(expect.stringContaining('GO 3 STEPS'));
    });

    it('should handle empty result', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: null });

      const result = await graphOperations.findRelatedNodes('node123');

      expect(result).toEqual([]);
    });

    it('should handle non-array result', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: 'invalid result' });

      const result = await graphOperations.findRelatedNodes('node123');

      expect(result).toEqual([]);
    });

    it('should use default depth when not provided', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphOperations.findRelatedNodes('node123');

      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(expect.stringContaining('GO 2 STEPS'));
    });

    it('should handle find related nodes error', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphOperations.findRelatedNodes('node123');

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to find related nodes',
        { error: 'Query failed' }
      );
    });
  });

  describe('findPath', () => {
    it('should find path successfully', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphOperations.findPath('source123', 'target456', 5);

      expect(result).toEqual([]);
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining('FIND ALL PATH FROM "source123" TO "target456"')
      );
    });

    it('should handle find path error', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphOperations.findPath('source123', 'target456');

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to find path',
        { error: 'Query failed' }
      );
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest path successfully', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphOperations.findShortestPath('source123', 'target456', ['EDGE_TYPE'], 10);

      expect(result).toEqual([]);
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining('FIND SHORTEST PATH FROM "source123" TO "target456"')
      );
    });

    it('should use default edge types when not provided', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await graphOperations.findShortestPath('source123', 'target456');

      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining('OVER *')
      );
    });

    it('should handle find shortest path error', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await graphOperations.findShortestPath('source123', 'target456');

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to find shortest path',
        { error: 'Query failed' }
      );
    });
  });

  describe('updateVertex', () => {
    it('should update vertex successfully', async () => {
      const mockQueryResult = { query: 'UPDATE VERTEX ON TestTag "vertex123" SET name = $set_param0', params: { set_param0: 'Updated' } };
      mockQueryBuilder.updateVertex.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.updateVertex('vertex123', 'TestTag', { name: 'Updated' });

      expect(result).toBe(true);
      expect(mockQueryBuilder.updateVertex).toHaveBeenCalledWith('vertex123', 'TestTag', { name: 'Updated' });
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Updated vertex', { vertexId: 'vertex123', tag: 'TestTag' });
    });

    it('should handle empty properties', async () => {
      const result = await graphOperations.updateVertex('vertex123', 'TestTag', {});

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).not.toHaveBeenCalled();
    });

    it('should return false when update fails', async () => {
      const mockQueryResult = { query: 'UPDATE VERTEX ON TestTag "vertex123" SET name = $set_param0', params: { set_param0: 'Updated' } };
      mockQueryBuilder.updateVertex.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Update failed'));

      const result = await graphOperations.updateVertex('vertex123', 'TestTag', { name: 'Updated' });

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to update vertex',
        { error: 'Update failed', vertexId: 'vertex123', tag: 'TestTag' }
      );
    });
  });

  describe('updateEdge', () => {
    it('should update edge successfully', async () => {
      const mockQueryResult = { query: 'UPDATE EDGE ON TestEdge "src123" -> "dst456" SET weight = $set_param0', params: { set_param0: 2.0 } };
      mockQueryBuilder.updateEdge.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.updateEdge(
        'src123',
        'dst456',
        'TestEdge',
        { weight: 2.0 }
      );

      expect(result).toBe(true);
      expect(mockQueryBuilder.updateEdge).toHaveBeenCalledWith(
        'src123',
        'dst456',
        'TestEdge',
        { weight: 2.0 }
      );
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Updated edge', { srcId: 'src123', dstId: 'dst456', edgeType: 'TestEdge' }
      );
    });

    it('should handle empty properties', async () => {
      const result = await graphOperations.updateEdge('src123', 'dst456', 'TestEdge', {});

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).not.toHaveBeenCalled();
    });

    it('should return false when update fails', async () => {
      const mockQueryResult = { query: 'UPDATE EDGE ON TestEdge "src123" -> "dst456" SET weight = $set_param0', params: { set_param0: 2.0 } };
      mockQueryBuilder.updateEdge.mockReturnValue(mockQueryResult);
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Update failed'));

      const result = await graphOperations.updateEdge(
        'src123',
        'dst456',
        'TestEdge',
        { weight: 2.0 }
      );

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to update edge',
        { error: 'Update failed', srcId: 'src123', dstId: 'dst456', edgeType: 'TestEdge' }
      );
    });
  });

  describe('deleteVertex', () => {
    it('should delete vertex successfully with tag', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.deleteVertex('vertex123', 'TestTag');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DELETE VERTEX "vertex123" TAG `TestTag`'
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Deleted vertex: vertex123'
      );
    });

    it('should delete vertex successfully without tag', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.deleteVertex('vertex123');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DELETE VERTEX "vertex123" WITH EDGE'
      );
    });

    it('should return false when delete fails', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Delete failed'));

      const result = await graphOperations.deleteVertex('vertex123');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to delete vertex: vertex123',
        expect.any(Error)
      );
    });
  });

  describe('deleteEdge', () => {
    it('should delete edge successfully with type', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.deleteEdge('src123', 'dst456', 'TestEdge');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DELETE EDGE `TestEdge` "src123" -> "dst456"'
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Deleted edge: src123 -> dst456'
      );
    });

    it('should delete edge successfully without type', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await graphOperations.deleteEdge('src123', 'dst456');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DELETE EDGE "src123" -> "dst456"'
      );
    });

    it('should return false when delete fails', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Delete failed'));

      const result = await graphOperations.deleteEdge('src123', 'dst456');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to delete edge: src123 -> dst456',
        expect.any(Error)
      );
    });
  });

  describe('executeComplexTraversal', () => {
    it('should execute complex traversal successfully', async () => {
      const mockResult = [{ id: 'node1', name: 'Node1' }];
      const mockQueryResult = { query: 'GO 3 STEPS FROM "start123" OVER EDGE_TYPE YIELD dst(edge) AS destination | FETCH PROP ON * $-.destination YIELD vertex AS node LIMIT 10', params: { startId: 'start123' } };

      mockQueryBuilder.buildComplexTraversal.mockReturnValue(mockQueryResult);
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: mockResult });

      const result = await graphOperations.executeComplexTraversal('start123', ['EDGE_TYPE'], { limit: 10 });

      expect(result).toEqual(mockResult);
      expect(mockQueryBuilder.buildComplexTraversal).toHaveBeenCalledWith(
        'start123',
        ['EDGE_TYPE'],
        { limit: 10 }
      );
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(
        mockQueryResult.query,
        mockQueryResult.params
      );
    });

    it('should handle empty result', async () => {
      const mockQueryResult = { query: 'GO...', params: {} };

      mockQueryBuilder.buildComplexTraversal.mockReturnValue(mockQueryResult);
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: null });

      const result = await graphOperations.executeComplexTraversal('start123', ['EDGE_TYPE']);

      expect(result).toEqual([]);
    });

    it('should handle non-array result', async () => {
      const mockQueryResult = { query: 'GO...', params: {} };

      mockQueryBuilder.buildComplexTraversal.mockReturnValue(mockQueryResult);
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: 'invalid result' });

      const result = await graphOperations.executeComplexTraversal('start123', ['EDGE_TYPE']);

      expect(result).toEqual([]);
    });

    it('should handle traversal error', async () => {
      const mockQueryResult = { query: 'GO...', params: {} };

      mockQueryBuilder.buildComplexTraversal.mockReturnValue(mockQueryResult);
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Traversal failed'));

      const result = await graphOperations.executeComplexTraversal('start123', ['EDGE_TYPE']);

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to execute complex traversal from start123',
        expect.any(Error)
      );
    });
  });

  describe('getGraphStats', () => {
    it('should get graph stats successfully', async () => {
      // 模拟延迟
      jest.useFakeTimers();
      const statsPromise = graphOperations.getGraphStats();
      jest.runAllTimers();
      const result = await statsPromise;
      jest.useRealTimers();

      expect(result).toEqual({
        nodeCount: 0,
        relationshipCount: 0
      });
    });

    it('should handle get graph stats error', async () => {
      // 模拟延迟
      jest.useFakeTimers();
      const originalSetTimeout = setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 0 as any;
      }) as any;

      const originalError = mockLoggerService.error;
      mockLoggerService.error = jest.fn();

      // 模拟抛出错误
      const statsPromise = graphOperations.getGraphStats();
      const result = await statsPromise;

      expect(result).toEqual({
        nodeCount: 0,
        relationshipCount: 0
      });
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to get graph stats',
        expect.any(Error)
      );

      // 恢复
      global.setTimeout = originalSetTimeout;
      mockLoggerService.error = originalError;
    });
  });
});