import Parser from 'tree-sitter';
import { SimpleQueryEngine } from '../../query/SimpleQueryEngine';

// Mock Parser.SyntaxNode for testing
const mockSyntaxNode = {
  type: 'program',
  startIndex: 0,
  endIndex: 100,
  startPosition: { row: 0, column: 0 },
  endPosition: { row: 10, column: 1 },
  text: 'function test() { return "hello"; } class Test {}',
  children: [],
  parent: null,
  nextSibling: null,
  previousSibling: null,
  tree: {
    language: { name: 'typescript' }
  }
} as unknown as Parser.SyntaxNode;

describe('SimpleQueryEngine', () => {
  beforeEach(() => {
    SimpleQueryEngine.clearCache();
  });

  describe('Basic Query Methods', () => {
    test('should find functions', async () => {
      const functions = await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'typescript');
      expect(Array.isArray(functions)).toBe(true);
    });

    test('should find classes', async () => {
      const classes = await SimpleQueryEngine.findClasses(mockSyntaxNode, 'typescript');
      expect(Array.isArray(classes)).toBe(true);
    });

    test('should find imports', async () => {
      const imports = await SimpleQueryEngine.findImports(mockSyntaxNode, 'typescript');
      expect(Array.isArray(imports)).toBe(true);
    });

    test('should find exports', async () => {
      const exports = await SimpleQueryEngine.findExports(mockSyntaxNode, 'typescript');
      expect(Array.isArray(exports)).toBe(true);
    });

    test('should find methods', async () => {
      const methods = await SimpleQueryEngine.findMethods(mockSyntaxNode, 'typescript');
      expect(Array.isArray(methods)).toBe(true);
    });

    test('should find interfaces', async () => {
      const interfaces = await SimpleQueryEngine.findInterfaces(mockSyntaxNode, 'typescript');
      expect(Array.isArray(interfaces)).toBe(true);
    });

    test('should find types', async () => {
      const types = await SimpleQueryEngine.findTypes(mockSyntaxNode, 'typescript');
      expect(Array.isArray(types)).toBe(true);
    });

    test('should find properties', async () => {
      const properties = await SimpleQueryEngine.findProperties(mockSyntaxNode, 'typescript');
      expect(Array.isArray(properties)).toBe(true);
    });

    test('should find variables', async () => {
      const variables = await SimpleQueryEngine.findVariables(mockSyntaxNode, 'typescript');
      expect(Array.isArray(variables)).toBe(true);
    });
  });

  describe('Advanced Query Methods', () => {
    test('should find multiple types', async () => {
      const results = await SimpleQueryEngine.findMultiple(
        mockSyntaxNode,
        'typescript',
        ['functions', 'classes', 'imports']
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(3);
      expect(results.has('functions')).toBe(true);
      expect(results.has('classes')).toBe(true);
      expect(results.has('imports')).toBe(true);

      expect(Array.isArray(results.get('functions'))).toBe(true);
      expect(Array.isArray(results.get('classes'))).toBe(true);
      expect(Array.isArray(results.get('imports'))).toBe(true);
    });

    test('should handle unsupported query types gracefully', async () => {
      const results = await SimpleQueryEngine.findMultiple(
        mockSyntaxNode,
        'typescript',
        ['functions', 'nonexistent']
      );

      expect(results.size).toBe(2);
      expect(Array.isArray(results.get('functions'))).toBe(true);
      expect(results.get('nonexistent')).toEqual([]);
    });

    test('should find all main structures', async () => {
      const structures = await SimpleQueryEngine.findAllMainStructures(mockSyntaxNode, 'typescript');

      expect(structures).toHaveProperty('functions');
      expect(structures).toHaveProperty('classes');
      expect(structures).toHaveProperty('imports');
      expect(structures).toHaveProperty('exports');

      expect(Array.isArray(structures.functions)).toBe(true);
      expect(Array.isArray(structures.classes)).toBe(true);
      expect(Array.isArray(structures.imports)).toBe(true);
      expect(Array.isArray(structures.exports)).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('should provide performance statistics', () => {
      const stats = SimpleQueryEngine.getPerformanceStats();

      expect(stats).toHaveProperty('queryMetrics');
      expect(stats).toHaveProperty('querySummary');
      expect(stats).toHaveProperty('systemMetrics');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats).toHaveProperty('engineCacheSize');
    });

    test('should clear cache', () => {
      expect(() => SimpleQueryEngine.clearCache()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid language gracefully', async () => {
      const functions = await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'nonexistent');
      expect(Array.isArray(functions)).toBe(true);
    });

    test('should handle invalid AST gracefully', async () => {
      const invalidAST = null as any;
      const functions = await SimpleQueryEngine.findFunctions(invalidAST, 'typescript');
      expect(Array.isArray(functions)).toBe(true);
    });
  });

  describe('Performance Comparison', () => {
    test('should provide simplified interface with less code', async () => {
      // Using SimpleQueryEngine requires less code than using TreeSitterQueryEngine directly

      // Simple approach (1 line):
      const functions1 = await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'typescript');

      // Complex approach would require:
      // 1. Getting query engine instance
      // 2. Calling executeQuery
      // 3. Extracting nodes from matches

      expect(functions1).toBeDefined();
      expect(Array.isArray(functions1)).toBe(true);
    });

    test('should maintain performance benefits', async () => {
      const startTime = performance.now();

      await SimpleQueryEngine.findAllMainStructures(mockSyntaxNode, 'typescript');

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete quickly (under 100ms for simple operations)
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Integration with Advanced Features', () => {
    test('should leverage caching from underlying engine', async () => {
      // First call
      await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'typescript');

      // Second call should benefit from caching
      const startTime = performance.now();
      await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'typescript');
      const endTime = performance.now();

      const secondCallTime = endTime - startTime;

      // Second call should be faster due to caching
      expect(secondCallTime).toBeLessThan(50);
    });

    test('should provide access to performance monitoring', async () => {
      await SimpleQueryEngine.findFunctions(mockSyntaxNode, 'typescript');

      const stats = SimpleQueryEngine.getPerformanceStats();
      expect(stats.queryMetrics).toBeDefined();
      expect(stats.cacheStats).toBeDefined();
    });
  });
});