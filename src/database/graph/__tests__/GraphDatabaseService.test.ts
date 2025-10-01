import { GraphDatabaseService } from '../GraphDatabaseService';
import { DatabaseService } from '../../core/DatabaseService';
import { TransactionManager } from '../../core/TransactionManager';
import { GraphQueryBuilder } from '../../query/GraphQueryBuilder';
import { IGraphDatabaseService } from '../types';

// Mock dependencies
jest.mock('../../core/DatabaseService');
jest.mock('../../core/TransactionManager');
jest.mock('../../query/GraphQueryBuilder');

describe('GraphDatabaseService', () => {
  let graphDatabaseService: IGraphDatabaseService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockTransactionManager: jest.Mocked<TransactionManager>;
  let mockQueryBuilder: jest.Mocked<GraphQueryBuilder>;

  beforeEach(() => {
    // Create mock instances
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockTransactionManager = new TransactionManager() as jest.Mocked<TransactionManager>;
    mockQueryBuilder = new GraphQueryBuilder() as jest.Mocked<GraphQueryBuilder>;

    // Create service instance with mocks
    graphDatabaseService = new GraphDatabaseService(
      mockDatabaseService,
      mockTransactionManager,
      mockQueryBuilder
    );
  });

  describe('initialize', () => {
    it('should initialize the database service', async () => {
      mockDatabaseService.initialize.mockResolvedValue(true);
      
      const result = await graphDatabaseService.initialize();
      
      expect(result).toBe(true);
      expect(mockDatabaseService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      mockDatabaseService.initialize.mockResolvedValue(false);
      
      const result = await graphDatabaseService.initialize();
      
      expect(result).toBe(false);
      expect(mockDatabaseService.initialize).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the database service', async () => {
      await graphDatabaseService.close();
      
      expect(mockDatabaseService.close).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return connection status', () => {
      mockDatabaseService.isConnected.mockReturnValue(true);
      
      const result = graphDatabaseService.isConnected();
      
      expect(result).toBe(true);
      expect(mockDatabaseService.isConnected).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('should execute a query and return results', async () => {
      const mockQuery = 'MATCH (n) RETURN n';
      const mockParams = { param1: 'value1' };
      const mockResult = [{ id: '1', properties: { name: 'test' } }];
      
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.executeQuery(mockQuery, mockParams);
      
      expect(result).toBe(mockResult);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
    });
  });

  describe('executeTransaction', () => {
    it('should execute a transaction and return results', async () => {
      const mockQueries = [
        { nGQL: 'CREATE (n:Node {name: "test1"})', parameters: {} },
        { nGQL: 'CREATE (n:Node {name: "test2"})', parameters: {} }
      ];
      const mockResult = [{ success: true }];
      
      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.executeTransaction(mockQueries);
      
      expect(result).toBe(mockResult);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(mockQueries);
    });
  });

  describe('createNode', () => {
    it('should create a node using the query builder', async () => {
      const nodeData = {
        tag: 'Function',
        id: 'func-123',
        properties: { name: 'testFunction' }
      };
      
      const mockQuery = { nGQL: 'INSERT VERTEX `Function` VALUES "func-123":(name:"testFunction")', parameters: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.buildInsertNodeQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.createNode(nodeData);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildInsertNodeQuery).toHaveBeenCalledWith(nodeData);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('createRelationship', () => {
    it('should create a relationship using the query builder', async () => {
      const relationshipData = {
        type: 'CONTAINS',
        sourceId: 'file-123',
        targetId: 'func-123',
        properties: {}
      };
      
      const mockQuery = { nGQL: 'INSERT EDGE `CONTAINS` VALUES "file-123"->"func-123":()', parameters: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.buildInsertRelationshipQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.createRelationship(relationshipData);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildInsertRelationshipQuery).toHaveBeenCalledWith(relationshipData);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('updateNode', () => {
    it('should update a node using the query builder', async () => {
      const updateData = {
        tag: 'Function',
        id: 'func-123',
        properties: { name: 'updatedFunction' }
      };
      
      const mockQuery = { nGQL: 'UPDATE VERTEX ON `Function` "func-123" SET name:"updatedFunction"', parameters: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.buildUpdateNodeQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.updateNode(updateData);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildUpdateNodeQuery).toHaveBeenCalledWith(updateData);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('deleteNode', () => {
    it('should delete a node using the query builder', async () => {
      const nodeId = 'func-123';
      const mockQuery = { nGQL: 'DELETE VERTEX "func-123" WITH EDGE', parameters: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.buildDeleteNodeQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.deleteNode(nodeId);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildDeleteNodeQuery).toHaveBeenCalledWith(nodeId);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('findRelatedNodes', () => {
    it('should find related nodes using the query builder', async () => {
      const nodeId = 'func-123';
      const relationshipTypes = ['CONTAINS', 'CALLS'];
      const maxDepth = 2;
      const mockQuery = { nGQL: 'GO FROM "func-123" OVER CONTAINS,CALLS YIELD dst(edge) AS destination', parameters: {} };
      const mockResult = [{ id: 'related-1', properties: { name: 'relatedNode' } }];
      
      mockQueryBuilder.buildFindRelatedNodesQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.findRelatedNodes(nodeId, relationshipTypes, maxDepth);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildFindRelatedNodesQuery).toHaveBeenCalledWith(nodeId, relationshipTypes, maxDepth);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('findPath', () => {
    it('should find path between nodes using the query builder', async () => {
      const sourceId = 'node-1';
      const targetId = 'node-2';
      const maxDepth = 3;
      const mockQuery = { nGQL: 'FIND SHORTEST PATH FROM "node-1" TO "node-2" OVER * UPTO 3 STEPS', parameters: {} };
      const mockResult = [{ path: 'node-1 -> node-2' }];
      
      mockQueryBuilder.buildFindPathQuery.mockReturnValue(mockQuery);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.findPath(sourceId, targetId, maxDepth);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.buildFindPathQuery).toHaveBeenCalledWith(sourceId, targetId, maxDepth);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockQuery.nGQL, mockQuery.parameters);
    });
  });

  describe('batchInsertNodes', () => {
    it('should batch insert nodes using the query builder', async () => {
      const nodes = [
        { tag: 'Function', id: 'func-1', properties: { name: 'func1' } },
        { tag: 'Function', id: 'func-2', properties: { name: 'func2' } }
      ];
      
      const mockBatchResult = { query: 'INSERT VERTEX `Function` VALUES "func-1":(name:"func1"),"func-2":(name:"func2")', params: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.batchInsertVertices.mockReturnValue(mockBatchResult);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.batchInsertNodes(nodes);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.batchInsertVertices).toHaveBeenCalledWith(nodes);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockBatchResult.query, mockBatchResult.params);
    });
  });

  describe('batchInsertRelationships', () => {
    it('should batch insert relationships using the query builder', async () => {
      const relationships = [
        { type: 'CONTAINS', srcId: 'file-1', dstId: 'func-1', properties: {} },
        { type: 'CONTAINS', srcId: 'file-1', dstId: 'func-2', properties: {} }
      ];
      
      const mockBatchResult = { query: 'INSERT EDGE `CONTAINS` VALUES "file-1"->"func-1":(),"file-1"->"func-2":()', params: {} };
      const mockResult = { success: true };
      
      mockQueryBuilder.batchInsertEdges.mockReturnValue(mockBatchResult);
      mockDatabaseService.executeQuery.mockResolvedValue(mockResult);
      
      const result = await graphDatabaseService.batchInsertRelationships(relationships);
      
      expect(result).toBe(mockResult);
      expect(mockQueryBuilder.batchInsertEdges).toHaveBeenCalledWith(relationships);
      expect(mockDatabaseService.executeQuery).toHaveBeenCalledWith(mockBatchResult.query, mockBatchResult.params);
    });
  });

  describe('getGraphStatistics', () => {
    it('should get graph statistics', async () => {
      const mockNodeCount = 100;
      const mockRelationshipCount = 200;
      const mockNodeTypes = { Function: 50, Class: 30, File: 20 };
      const mockRelationshipTypes = { CONTAINS: 100, CALLS: 80, IMPORTS: 20 };
      
      // Mock the individual method calls
      jest.spyOn(graphDatabaseService, 'getNodeCount' as any).mockResolvedValue(mockNodeCount);
      jest.spyOn(graphDatabaseService, 'getRelationshipCount' as any).mockResolvedValue(mockRelationshipCount);
      jest.spyOn(graphDatabaseService, 'getNodeTypes' as any).mockResolvedValue(mockNodeTypes);
      jest.spyOn(graphDatabaseService, 'getRelationshipTypes' as any).mockResolvedValue(mockRelationshipTypes);
      
      const result = await graphDatabaseService.getGraphStatistics();
      
      expect(result).toEqual({
        nodeCount: mockNodeCount,
        relationshipCount: mockRelationshipCount,
        nodeTypes: mockNodeTypes,
        relationshipTypes: mockRelationshipTypes
      });
    });
  });
});