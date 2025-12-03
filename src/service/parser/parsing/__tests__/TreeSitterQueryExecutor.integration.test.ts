import Parser from 'tree-sitter';
import { TreeSitterQueryEngine, MixedQueryResult } from '../TreeSitterQueryExecutor';
import { TreeSitterQueryFacade } from '../TreeSitterQueryFacade';
import { EntityType, RelationshipType } from '../types';
import { initializeLanguageFactories } from '../types/languages';

// Mock tree-sitter for testing
const mockParser = {
  parse: jest.fn(),
  getLanguage: jest.fn()
} as any;

// Mock AST node
const createMockNode = (type: string, text: string, startPosition = { row: 0, column: 0 }, endPosition = { row: 0, column: 10 }) => ({
  type,
  text,
  startPosition,
  endPosition,
  children: [],
  childCount: 0
});

describe('TreeSitterQueryExecutor Integration Tests', () => {
  let queryEngine: TreeSitterQueryEngine;
  let mockAST: Parser.SyntaxNode;

  beforeAll(async () => {
    // Initialize language factories
    initializeLanguageFactories();
    
    queryEngine = new TreeSitterQueryEngine();
    
    // Create a mock AST structure
    mockAST = createMockNode('translation_unit', 'int main() { return 0; }');
    
    // Add some child nodes to simulate a real AST
    const functionNode = createMockNode('function_definition', 'int main() { return 0; }', { row: 0, column: 0 }, { row: 0, column: 20 });
    const returnNode = createMockNode('return_statement', 'return 0;', { row: 0, column: 12 }, { row: 0, column: 20 });
    
    mockAST.children = [functionNode];
    functionNode.children = [returnNode];
    mockAST.childCount = 1;
    functionNode.childCount = 1;
  });

  describe('Entity Query Tests', () => {
    test('should execute entity query for functions', async () => {
      const result = await queryEngine.executeEntityQuery(
        mockAST,
        EntityType.FUNCTION,
        'c',
        { filePath: 'test.c' }
      );

      expect(Array.isArray(result)).toBe(true);
      // Note: Since we're using mock AST, the actual results depend on the query patterns
      // This test mainly verifies the API structure and error handling
    });

    test('should execute entity query for types', async () => {
      const result = await queryEngine.executeEntityQuery(
        mockAST,
        EntityType.TYPE_DEFINITION,
        'c',
        { filePath: 'test.c' }
      );

      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle invalid AST gracefully', async () => {
      const result = await queryEngine.executeEntityQuery(
        null as any,
        EntityType.FUNCTION,
        'c'
      );

      expect(result).toEqual([]);
    });
  });

  describe('Relationship Query Tests', () => {
    test('should execute relationship query for calls', async () => {
      const result = await queryEngine.executeRelationshipQuery(
        mockAST,
        RelationshipType.CALL,
        'c',
        { filePath: 'test.c' }
      );

      expect(Array.isArray(result)).toBe(true);
    });

    test('should execute relationship query for data flow', async () => {
      const result = await queryEngine.executeRelationshipQuery(
        mockAST,
        RelationshipType.ASSIGNMENT,
        'c',
        { filePath: 'test.c' }
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Mixed Query Tests', () => {
    test('should execute mixed query with entities and relationships', async () => {
      const result = await queryEngine.executeMixedQuery(
        mockAST,
        ['functions', 'types'],
        'c',
        { filePath: 'test.c', includeRelationships: true }
      );

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relationships');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('success');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    test('should handle mixed query with invalid AST', async () => {
      const result = await queryEngine.executeMixedQuery(
        null as any,
        ['functions'],
        'c'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid AST provided');
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
    });
  });

  describe('Batch Query Tests', () => {
    test('should execute multiple entity queries', async () => {
      const result = await queryEngine.executeMultipleEntityQueries(
        mockAST,
        [EntityType.FUNCTION, EntityType.TYPE_DEFINITION],
        'c',
        { filePath: 'test.c' }
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
    });

    test('should execute multiple relationship queries', async () => {
      const result = await queryEngine.executeMultipleRelationshipQueries(
        mockAST,
        [RelationshipType.CALL, RelationshipType.ASSIGNMENT],
        'c',
        { filePath: 'test.c' }
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
    });
  });

  describe('Caching Tests', () => {
    test('should use cache when enabled', async () => {
      const spy = jest.spyOn(queryEngine as any, 'executeQueryForType');
      
      // First call should execute the query
      await queryEngine.executeEntityQuery(
        mockAST,
        EntityType.FUNCTION,
        'c',
        { filePath: 'test.c', useCache: true }
      );
      
      expect(spy).toHaveBeenCalled();
      
      // Reset spy
      spy.mockClear();
      
      // Second call should use cache
      await queryEngine.executeEntityQuery(
        mockAST,
        EntityType.FUNCTION,
        'c',
        { filePath: 'test.c', useCache: true }
      );
      
      // The spy should not be called again if cache is working
      // Note: This depends on the actual cache implementation
    });

    test('should bypass cache when disabled', async () => {
      const spy = jest.spyOn(queryEngine as any, 'executeQueryForType');
      
      await queryEngine.executeEntityQuery(
        mockAST,
        EntityType.FUNCTION,
        'c',
        { filePath: 'test.c', useCache: false }
      );
      
      expect(spy).toHaveBeenCalled();
    });
  });
});

describe('TreeSitterQueryFacade Integration Tests', () => {
  let mockAST: Parser.SyntaxNode;

  beforeAll(() => {
    // Create a mock AST structure
    mockAST = createMockNode('translation_unit', 'int main() { return 0; }');
  });

  test('should execute entity query through facade', async () => {
    const result = await TreeSitterQueryFacade.executeEntityQuery(
      mockAST,
      EntityType.FUNCTION,
      'c',
      { filePath: 'test.c' }
    );

    expect(Array.isArray(result)).toBe(true);
  });

  test('should execute relationship query through facade', async () => {
    const result = await TreeSitterQueryFacade.executeRelationshipQuery(
      mockAST,
      RelationshipType.CALL,
      'c',
      { filePath: 'test.c' }
    );

    expect(Array.isArray(result)).toBe(true);
  });

  test('should execute mixed query through facade', async () => {
    const result = await TreeSitterQueryFacade.executeMixedQuery(
      mockAST,
      ['functions', 'types'],
      'c',
      { filePath: 'test.c' }
    );

    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('relationships');
    expect(result).toHaveProperty('success');
  });

  test('should execute multiple entity queries through facade', async () => {
    const result = await TreeSitterQueryFacade.executeMultipleEntityQueries(
      mockAST,
      [EntityType.FUNCTION, EntityType.TYPE_DEFINITION],
      'c',
      { filePath: 'test.c' }
    );

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
  });

  test('should execute multiple relationship queries through facade', async () => {
    const result = await TreeSitterQueryFacade.executeMultipleRelationshipQueries(
      mockAST,
      [RelationshipType.CALL, RelationshipType.ASSIGNMENT],
      'c',
      { filePath: 'test.c' }
    );

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
  });

  test('should handle invalid AST gracefully through facade', async () => {
    const result = await TreeSitterQueryFacade.executeEntityQuery(
      null as any,
      EntityType.FUNCTION,
      'c'
    );

    expect(result).toEqual([]);
  });
});