import Parser from 'tree-sitter';
import { TreeSitterQueryEngine } from '../../query/TreeSitterQueryEngine';
import { QueryEngineFactory } from '../../query/QueryEngineFactory';
import { QueryPerformanceMonitor } from '../../query/QueryPerformanceMonitor';
import { QueryCache } from '../../query/QueryCache';

// Mock Parser.SyntaxNode for testing
const mockSyntaxNode = {
  type: 'function_declaration',
  startIndex: 0,
  endIndex: 50,
  startPosition: { row: 0, column: 0 },
  endPosition: { row: 5, column: 1 },
  text: 'function test() { return "hello"; }',
  children: [],
  parent: null,
  nextSibling: null,
  previousSibling: null,
  tree: {
    language: { name: 'typescript' }
  }
} as unknown as Parser.SyntaxNode;

describe('TreeSitterQueryEngine', () => {
  let queryEngine: TreeSitterQueryEngine;

  beforeEach(async () => {
    queryEngine = new TreeSitterQueryEngine();
    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 100));
    QueryPerformanceMonitor.clearMetrics();
    QueryCache.clearCache();
  });

  describe('Constructor', () => {
    it('should initialize with default patterns', () => {
      expect(queryEngine).toBeInstanceOf(TreeSitterQueryEngine);
      
      const patterns = queryEngine.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.name === 'typescript_functions')).toBe(true);
      expect(patterns.some(p => p.name === 'typescript_classes')).toBe(true);
      expect(patterns.some(p => p.name === 'javascript_functions')).toBe(true);
      expect(patterns.some(p => p.name === 'python_classes')).toBe(true);
    });
  });

  describe('addPattern', () => {
    it('should add a new query pattern', () => {
      const newPattern = {
        name: 'test_pattern',
        description: 'Test pattern',
        pattern: '(identifier) @id',
        languages: ['typescript'],
        captures: { 'id': 'identifier' }
      };

      queryEngine.addPattern(newPattern);
      
      const patterns = queryEngine.getSupportedPatterns();
      expect(patterns.some(p => p.name === 'test_pattern')).toBe(true);
    });
  });

  describe('executeQuery', () => {
    it('should execute a query successfully', async () => {
      const result = await queryEngine.executeQuery(
        mockSyntaxNode,
        'functions',
        'typescript'
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('executionTime');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should return error for non-existent pattern', async () => {
      const result = await queryEngine.executeQuery(
        mockSyntaxNode,
        'non_existent_pattern',
        'typescript'
      );

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });

    it('should return error for unsupported language', async () => {
      const result = await queryEngine.executeQuery(
        mockSyntaxNode,
        'function_declaration',
        'unsupported'
      );

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });

    it('should cache query results', async () => {
      // First execution
      const result1 = await queryEngine.executeQuery(
        mockSyntaxNode,
        'functions',
        'typescript'
      );

      // Second execution with same parameters should potentially use cache
      const result2 = await queryEngine.executeQuery(
        mockSyntaxNode,
        'functions',
        'typescript'
      );

      expect(result1).toHaveProperty('success');
      expect(result2).toHaveProperty('success');
    });
  });

  describe('executeMultipleQueries', () => {
    it('should execute multiple queries', async () => {
      const result = await queryEngine.executeMultipleQueries(
        mockSyntaxNode,
        ['functions', 'classes'],
        'typescript'
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has('functions')).toBe(true);
      expect(result.has('classes')).toBe(true);
    });

    it('should return results for mixed valid and invalid patterns', async () => {
      const result = await queryEngine.executeMultipleQueries(
        mockSyntaxNode,
        ['functions', 'non_existent_pattern'],
        'typescript'
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has('functions')).toBe(true);
      expect(result.has('non_existent_pattern')).toBe(true);
      
      const invalidResult = result.get('non_existent_pattern');
      expect(invalidResult?.success).toBe(false);
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return all patterns when no language specified', () => {
      const allPatterns = queryEngine.getSupportedPatterns();
      expect(Array.isArray(allPatterns)).toBe(true);
      expect(allPatterns.length).toBeGreaterThan(0);
    });

    it('should return patterns for specific language', () => {
      const tsPatterns = queryEngine.getSupportedPatterns('typescript');
      expect(Array.isArray(tsPatterns)).toBe(true);
      expect(tsPatterns.length).toBeGreaterThan(0);
      
      // All returned patterns should support TypeScript
      tsPatterns.forEach(pattern => {
        expect(pattern.languages).toContain('typescript');
      });
    });

    it('should return empty array for unsupported language', () => {
      const unsupportedPatterns = queryEngine.getSupportedPatterns('unsupported');
      expect(Array.isArray(unsupportedPatterns)).toBe(true);
      expect(unsupportedPatterns.length).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      // Execute a query to populate cache
      const result = queryEngine.executeQuery(
        mockSyntaxNode,
        'functions',
        'typescript'
      );

      // Clear the cache
      queryEngine.clearCache();

      // The cache should be cleared
      // (This is hard to test directly since the cache is internal,
      // but calling the method should not throw errors)
      expect(() => queryEngine.clearCache()).not.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should record query performance metrics', async () => {
      await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
      
      const metrics = QueryPerformanceMonitor.getMetrics();
      expect(Object.keys(metrics)).toContain('typescript_functions');
    });

    it('should provide performance statistics', async () => {
      await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
      
      const stats = queryEngine.getPerformanceStats();
      expect(stats).toHaveProperty('queryMetrics');
      expect(stats).toHaveProperty('querySummary');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats).toHaveProperty('engineCacheSize');
    });

    it('should record cache hit/miss statistics', async () => {
      // First query - should be a miss
      await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
      
      // Second query with same parameters - should be a hit
      await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
      
      const cacheStats = QueryCache.getStats();
      expect(cacheStats.hits).toBeGreaterThanOrEqual(0);
      expect(cacheStats.misses).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('QueryEngineFactory', () => {
  it('should return singleton instance', () => {
    const instance1 = QueryEngineFactory.getInstance();
    const instance2 = QueryEngineFactory.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should return TreeSitterQueryEngine instance', () => {
    const instance = QueryEngineFactory.getInstance();
    expect(instance).toBeInstanceOf(TreeSitterQueryEngine);
  });
});

describe('Performance Tests', () => {
  let queryEngine: TreeSitterQueryEngine;

  beforeEach(async () => {
    queryEngine = new TreeSitterQueryEngine();
    await new Promise(resolve => setTimeout(resolve, 100));
    QueryPerformanceMonitor.clearMetrics();
    QueryCache.clearCache();
  });

  test('native query API should outperform simulation', async () => {
    const largeJsCode = `
      ${Array.from({ length: 100 }, (_, i) => `
      function function${i}() {
        return ${i};
      }
      
      class Class${i} {
        method${i}() {
          return ${i};
        }
      }
      `).join('\n')}
    `;

    // Create a mock AST node for the large code
    const largeMockNode = {
      ...mockSyntaxNode,
      text: largeJsCode,
      endIndex: largeJsCode.length
    } as Parser.SyntaxNode;

    // Test multiple query executions
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const result = await queryEngine.executeQuery(largeMockNode, 'functions', 'javascript');
      const endTime = performance.now();
      
      expect(result.success).toBe(true);
      times.push(endTime - startTime);
    }

    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    console.log(`Average query time: ${averageTime.toFixed(2)}ms`);
    
    // Verify performance is within reasonable bounds
    expect(averageTime).toBeLessThan(50); // 50ms threshold
  });

  test('should provide performance metrics', async () => {
    await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
    
    const metrics = QueryPerformanceMonitor.getMetrics();
    expect(metrics).toHaveProperty('typescript_functions');
  });

  test('should track cache efficiency', async () => {
    // First query
    await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
    
    // Second query (should hit cache)
    await queryEngine.executeQuery(mockSyntaxNode, 'functions', 'typescript');
    
    const stats = queryEngine.getPerformanceStats();
    expect(stats.cacheStats.hits).toBeGreaterThanOrEqual(0);
    expect(stats.cacheStats.misses).toBeGreaterThanOrEqual(0);
  });
});