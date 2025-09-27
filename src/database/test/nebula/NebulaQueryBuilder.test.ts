import { NebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';

describe('NebulaQueryBuilder', () => {
  let queryBuilder: NebulaQueryBuilder;

  beforeEach(() => {
    queryBuilder = new NebulaQueryBuilder();
  });

  describe('insertVertex', () => {
    it('should build INSERT VERTEX query with properties', () => {
      const tag = 'person';
      const vertexId = '1';
      const properties = { name: 'Alice', age: 30 };

      const result = queryBuilder.insertVertex(tag, vertexId, properties);

      expect(result).toEqual({
        query: 'INSERT VERTEX person(name, age) VALUES 1:($param0, $param1)',
        params: { param0: 'Alice', param1: 30 },
      });
    });

    it('should build INSERT VERTEX query without properties', () => {
      const tag = 'person';
      const vertexId = '1';
      const properties = {};

      const result = queryBuilder.insertVertex(tag, vertexId, properties);

      expect(result).toEqual({
        query: 'INSERT VERTEX person() VALUES 1:()',
        params: {},
      });
    });
  });

  describe('insertEdge', () => {
    it('should build INSERT EDGE query with properties', () => {
      const edgeType = 'knows';
      const srcId = '1';
      const dstId = '2';
      const properties = { since: 2020 };

      const result = queryBuilder.insertEdge(edgeType, srcId, dstId, properties);

      expect(result).toEqual({
        query: 'INSERT EDGE knows(since) VALUES 1->2:($param0)',
        params: { param0: 2020 },
      });
    });

    it('should build INSERT EDGE query without properties', () => {
      const edgeType = 'knows';
      const srcId = '1';
      const dstId = '2';
      const properties = {};

      const result = queryBuilder.insertEdge(edgeType, srcId, dstId, properties);

      expect(result).toEqual({
        query: 'INSERT EDGE knows() VALUES 1->2:()',
        params: {},
      });
    });
  });

  describe('go', () => {
    it('should build GO query without edge type', () => {
      const steps = 2;
      const vertexId = '1';
      const yieldFields = 'id(vertex) as id';

      const result = queryBuilder.go(steps, vertexId, yieldFields);

      expect(result).toBe('GO 2 STEPS FROM 1 YIELD id(vertex) as id');
    });

    it('should build GO query with edge type', () => {
      const steps = 2;
      const vertexId = '1';
      const yieldFields = 'id(vertex) as id';
      const edgeType = 'knows';

      const result = queryBuilder.go(steps, vertexId, yieldFields, edgeType);

      expect(result).toBe('GO 2 STEPS FROM 1 OVER knows YIELD id(vertex) as id');
    });
  });

  describe('match', () => {
    it('should build MATCH query without WHERE clause', () => {
      const pattern = '(n:person)';
      const returnClause = 'n';

      const result = queryBuilder.match(pattern, returnClause);

      expect(result).toBe('MATCH (n:person) RETURN n');
    });

    it('should build MATCH query with WHERE clause', () => {
      const pattern = '(n:person)';
      const returnClause = 'n';
      const whereClause = 'n.name = "Alice"';

      const result = queryBuilder.match(pattern, returnClause, whereClause);

      expect(result).toBe('MATCH (n:person) WHERE n.name = "Alice" RETURN n');
    });
  });

  describe('parameterize', () => {
    it('should return query and params unchanged', () => {
      const query = 'MATCH (n:person) WHERE n.name = $name RETURN n';
      const params = { name: 'Alice' };

      const result = queryBuilder.parameterize(query, params);

      expect(result).toEqual({ query, params });
    });
  });
  describe('batchMixedOperations', () => {
    it('should build mixed batch operations query with vertices and edges', () => {
      const operations = [
        { 
          type: 'vertex' as const, 
          data: { tag: 'person', id: '1', properties: { name: 'Alice', age: 30 } } 
        },
        { 
          type: 'vertex' as const, 
          data: { tag: 'person', id: '2', properties: { name: 'Bob', age: 25 } } 
        },
        { 
          type: 'edge' as const, 
          data: { type: 'knows', srcId: '1', dstId: '2', properties: { since: 2020 } } 
        }
      ];

      const result = queryBuilder.batchMixedOperations(operations);

      expect(result.query).toContain('INSERT VERTEX');
      expect(result.query).toContain('INSERT EDGE');
      expect(result.params).toHaveProperty('person_1_param0', 'Alice');
      expect(result.params).toHaveProperty('person_2_param0', 'Bob');
      expect(result.params).toHaveProperty('knows_1_2_param0', 2020);
    });

    it('should build batch operations query with only vertices', () => {
      const operations = [
        { 
          type: 'vertex' as const, 
          data: { tag: 'person', id: '1', properties: { name: 'Alice' } } 
        },
        { 
          type: 'vertex' as const, 
          data: { tag: 'person', id: '2', properties: { name: 'Bob' } } 
        }
      ];

      const result = queryBuilder.batchMixedOperations(operations);

      expect(result.query).toContain('INSERT VERTEX');
      expect(result.query).not.toContain('INSERT EDGE');
      expect(result.params).toHaveProperty('person_1_param0', 'Alice');
      expect(result.params).toHaveProperty('person_2_param0', 'Bob');
    });

    it('should build batch operations query with only edges', () => {
      const operations = [
        { 
          type: 'edge' as const, 
          data: { type: 'knows', srcId: '1', dstId: '2', properties: { since: 2020 } } 
        }
      ];

      const result = queryBuilder.batchMixedOperations(operations);

      expect(result.query).not.toContain('INSERT VERTEX');
      expect(result.query).toContain('INSERT EDGE');
      expect(result.params).toHaveProperty('knows_1_2_param0', 2020);
    });

    it('should return empty query and params for empty operations', () => {
      const operations: any[] = [];

      const result = queryBuilder.batchMixedOperations(operations);

      expect(result).toEqual({ query: '', params: {} });
    });
  });
});
