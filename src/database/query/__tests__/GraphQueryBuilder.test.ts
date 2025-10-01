import { GraphQueryBuilder } from '../GraphQueryBuilder';
import { IGraphQueryBuilder } from '../types';

describe('GraphQueryBuilder', () => {
  let queryBuilder: IGraphQueryBuilder;

  beforeEach(() => {
    queryBuilder = new GraphQueryBuilder();
  });

  describe('buildNodeCountQuery', () => {
    it('should build a query to count nodes by tag', () => {
      const query = queryBuilder.buildNodeCountQuery('Function');
      
      expect(query.nGQL).toContain('LOOKUP ON `Function`');
      expect(query.nGQL).toContain('YIELD count(*) AS total');
      expect(query.parameters).toEqual({});
    });

    it('should handle special characters in tag name', () => {
      const query = queryBuilder.buildNodeCountQuery('Special-Tag');
      
      expect(query.nGQL).toContain('LOOKUP ON `Special-Tag`');
      expect(query.nGQL).toContain('YIELD count(*) AS total');
    });
  });

  describe('buildRelationshipCountQuery', () => {
    it('should build a query to count relationships by edge type', () => {
      const query = queryBuilder.buildRelationshipCountQuery('CONTAINS');
      
      expect(query.nGQL).toContain('MATCH () -[r:`CONTAINS`]-> ()');
      expect(query.nGQL).toContain('RETURN count(r) AS total');
      expect(query.parameters).toEqual({});
    });

    it('should handle special characters in edge type', () => {
      const query = queryBuilder.buildRelationshipCountQuery('SPECIAL_EDGE');
      
      expect(query.nGQL).toContain('MATCH () -[r:`SPECIAL_EDGE`]-> ()');
      expect(query.nGQL).toContain('RETURN count(r) AS total');
    });
  });

  describe('buildInsertNodeQuery', () => {
    it('should build a query to insert a node', () => {
      const nodeData = {
        tag: 'Function',
        id: 'func-123',
        properties: {
          name: 'testFunction',
          content: 'function test() {}',
          startLine: 1,
          endLine: 5
        }
      };
      
      const query = queryBuilder.buildInsertNodeQuery(nodeData);
      
      expect(query.nGQL).toContain('INSERT VERTEX `Function`');
      expect(query.nGQL).toContain('VALUES "func-123"');
      expect(query.nGQL).toContain('name:"testFunction"');
      expect(query.nGQL).toContain('content:"function test() {}"');
      expect(query.nGQL).toContain('startLine:1');
      expect(query.nGQL).toContain('endLine:5');
    });

    it('should handle empty properties', () => {
      const nodeData = {
        tag: 'Function',
        id: 'func-123',
        properties: {}
      };
      
      const query = queryBuilder.buildInsertNodeQuery(nodeData);
      
      expect(query.nGQL).toContain('INSERT VERTEX `Function`');
      expect(query.nGQL).toContain('VALUES "func-123"');
    });
  });

  describe('buildInsertRelationshipQuery', () => {
    it('should build a query to insert a relationship', () => {
      const relationshipData = {
        type: 'CONTAINS',
        sourceId: 'file-123',
        targetId: 'func-123',
        properties: {
          strength: 0.8
        }
      };
      
      const query = queryBuilder.buildInsertRelationshipQuery(relationshipData);
      
      expect(query.nGQL).toContain('INSERT EDGE `CONTAINS`');
      expect(query.nGQL).toContain('VALUES "file-123" -> "func-123"');
      expect(query.nGQL).toContain('strength:0.8');
    });

    it('should handle empty properties', () => {
      const relationshipData = {
        type: 'CONTAINS',
        sourceId: 'file-123',
        targetId: 'func-123',
        properties: {}
      };
      
      const query = queryBuilder.buildInsertRelationshipQuery(relationshipData);
      
      expect(query.nGQL).toContain('INSERT EDGE `CONTAINS`');
      expect(query.nGQL).toContain('VALUES "file-123" -> "func-123"');
    });
  });

  describe('buildUpdateNodeQuery', () => {
    it('should build a query to update a node', () => {
      const updateData = {
        tag: 'Function',
        id: 'func-123',
        properties: {
          name: 'updatedFunction',
          content: 'function updated() {}'
        }
      };
      
      const query = queryBuilder.buildUpdateNodeQuery(updateData);
      
      expect(query.nGQL).toContain('UPDATE VERTEX ON `Function` "func-123"');
      expect(query.nGQL).toContain('SET name:"updatedFunction"');
      expect(query.nGQL).toContain('content:"function updated() {}"');
    });
  });

  describe('buildDeleteNodeQuery', () => {
    it('should build a query to delete a node', () => {
      const query = queryBuilder.buildDeleteNodeQuery('func-123');
      
      expect(query.nGQL).toContain('DELETE VERTEX "func-123" WITH EDGE');
      expect(query.parameters).toEqual({});
    });
  });

  describe('buildFindRelatedNodesQuery', () => {
    it('should build a query to find related nodes', () => {
      const query = queryBuilder.buildFindRelatedNodesQuery('func-123', ['CONTAINS', 'CALLS'], 2);
      
      expect(query.nGQL).toContain('GO FROM "func-123" OVER CONTAINS,CALLS');
      expect(query.nGQL).toContain('YIELD dst(edge) AS destination');
      expect(query.nGQL).toContain('FETCH PROP ON * $-.destination YIELD vertex AS related');
      expect(query.parameters).toEqual({});
    });

    it('should handle all relationship types', () => {
      const query = queryBuilder.buildFindRelatedNodesQuery('func-123', undefined, 2);
      
      expect(query.nGQL).toContain('GO FROM "func-123" OVER *');
    });
  });

  describe('buildFindPathQuery', () => {
    it('should build a query to find path between nodes', () => {
      const query = queryBuilder.buildFindPathQuery('node-1', 'node-2', 3);
      
      expect(query.nGQL).toContain('FIND SHORTEST PATH FROM "node-1" TO "node-2" OVER * UPTO 3 STEPS');
      expect(query.nGQL).toContain('YIELD path as p');
      expect(query.parameters).toEqual({});
    });
  });

  describe('batchInsertVertices', () => {
    it('should build a batch insert query for vertices', () => {
      const vertices = [
        {
          tag: 'Function',
          id: 'func-1',
          properties: { name: 'func1' }
        },
        {
          tag: 'Function',
          id: 'func-2',
          properties: { name: 'func2' }
        }
      ];
      
      const result = queryBuilder.batchInsertVertices(vertices);
      
      expect(result.query).toContain('INSERT VERTEX `Function`');
      expect(result.query).toContain('VALUES "func-1":(`Function`{name:"func1"}),"func-2":(`Function`{name:"func2"})');
      expect(result.params).toEqual({});
    });

    it('should handle different vertex types', () => {
      const vertices = [
        {
          tag: 'Function',
          id: 'func-1',
          properties: { name: 'func1' }
        },
        {
          tag: 'Class',
          id: 'class-1',
          properties: { name: 'class1' }
        }
      ];
      
      const result = queryBuilder.batchInsertVertices(vertices);
      
      expect(result.query).toContain('INSERT VERTEX `Function`,`Class`');
    });
  });

  describe('batchInsertEdges', () => {
    it('should build a batch insert query for edges', () => {
      const edges = [
        {
          type: 'CONTAINS',
          srcId: 'file-1',
          dstId: 'func-1',
          properties: {}
        },
        {
          type: 'CALLS',
          srcId: 'func-1',
          dstId: 'func-2',
          properties: {}
        }
      ];
      
      const result = queryBuilder.batchInsertEdges(edges);
      
      expect(result.query).toContain('INSERT EDGE `CONTAINS`,`CALLS`');
      expect(result.query).toContain('VALUES "file-1"->"func-1":(`CONTAINS`{}),"func-1"->"func-2":(`CALLS`{})');
      expect(result.params).toEqual({});
    });

    it('should handle edge properties', () => {
      const edges = [
        {
          type: 'CONTAINS',
          srcId: 'file-1',
          dstId: 'func-1',
          properties: { strength: 0.8 }
        }
      ];
      
      const result = queryBuilder.batchInsertEdges(edges);
      
      expect(result.query).toContain('strength:0.8');
    });
  });
});