import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { TypeScriptLanguageAdapter } from '../adapters/TypeScriptLanguageAdapter';
import { PythonLanguageAdapter } from '../adapters/PythonLanguageAdapter';
import { DefaultLanguageAdapter } from '../adapters/DefaultLanguageAdapter';
import { StandardizedQueryResult } from '../types';

// Mock tree-sitter node
const createMockNode = (text: string, startRow: number, endRow: number, type: string) => ({
  text,
  startPosition: { row: startRow - 1, column: 0 },
  endPosition: { row: endRow - 1, column: text.length },
  type,
  childForFieldName: (field: string) => null,
  children: []
});

// Mock query result
const createMockQueryResult = (name: string, node: any) => ({
  captures: [
    {
      name: `name.definition.function`,
      node
    }
  ]
});

describe('QueryResultNormalizer', () => {
  let normalizer: QueryResultNormalizer;

  beforeEach(() => {
    normalizer = new QueryResultNormalizer({
      enableCache: false, // 禁用缓存以便测试
      debug: true
    });
  });

  afterEach(() => {
    normalizer.clearCache();
  });

  describe('TypeScript Language Adapter', () => {
    let adapter: TypeScriptLanguageAdapter;

    beforeEach(() => {
      adapter = new TypeScriptLanguageAdapter();
    });

    test('should normalize TypeScript function query results', () => {
      const mockNode = createMockNode('function test() { return 42; }', 1, 1, 'function_declaration');
      const mockResults = [createMockQueryResult('test', mockNode)];

      const results = adapter.normalize(mockResults, 'functions', 'typescript');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('test');
      expect(results[0].startLine).toBe(1);
      expect(results[0].endLine).toBe(1);
      expect(results[0].metadata.language).toBe('typescript');
    });

    test('should handle class definitions', () => {
      const mockNode = createMockNode('class MyClass { }', 1, 1, 'class_declaration');
      const mockResults = [createMockQueryResult('MyClass', mockNode)];

      const results = adapter.normalize(mockResults, 'classes', 'typescript');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('MyClass');
    });

    test('should calculate complexity correctly', () => {
      const complexNode = createMockNode(`
        class ComplexClass {
          constructor() {
            if (true) {
              for (let i = 0; i < 10; i++) {
                console.log(i);
              }
            }
          }
        }
      `, 1, 8, 'class_declaration');
      
      const mockResults = [createMockQueryResult('ComplexClass', complexNode)];
      const results = adapter.normalize(mockResults, 'classes', 'typescript');

      expect(results[0].metadata.complexity).toBeGreaterThan(1);
    });

    test('should extract dependencies', () => {
      const nodeWithDeps = createMockNode(`
        import { Component } from 'react';
        class MyComponent extends Component {
          render() { return <div>Hello</div>; }
        }
      `, 1, 4, 'class_declaration');
      
      const mockResults = [createMockQueryResult('MyComponent', nodeWithDeps)];
      const results = adapter.normalize(mockResults, 'classes', 'typescript');

      expect(results[0].metadata.dependencies).toContain('Component');
    });
  });

  describe('Python Language Adapter', () => {
    let adapter: PythonLanguageAdapter;

    beforeEach(() => {
      adapter = new PythonLanguageAdapter();
    });

    test('should normalize Python function query results', () => {
      const mockNode = createMockNode('def test_function():\n    return 42', 1, 2, 'function_definition');
      const mockResults = [createMockQueryResult('test_function', mockNode)];

      const results = adapter.normalize(mockResults, 'functions', 'python');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('test_function');
      expect(results[0].startLine).toBe(1);
      expect(results[0].endLine).toBe(2);
    });

    test('should handle async functions', () => {
      const mockNode = createMockNode('async def async_function():\n    await something()', 1, 2, 'async_function_definition');
      const mockResults = [createMockQueryResult('async_function', mockNode)];

      const results = adapter.normalize(mockResults, 'functions', 'python');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.modifiers).toContain('async');
    });

    test('should handle decorated functions', () => {
      const mockNode = createMockNode(`
@decorator
def decorated_function():
    pass
      `, 1, 3, 'decorated_definition');
      
      const mockResults = [createMockQueryResult('decorated_function', mockNode)];
      const results = adapter.normalize(mockResults, 'functions', 'python');

      expect(results[0].metadata.modifiers).toContain('decorated');
      expect(results[0].metadata.extra?.decorators).toContain('@decorator');
    });
  });

  describe('Default Language Adapter', () => {
    let adapter: DefaultLanguageAdapter;

    beforeEach(() => {
      adapter = new DefaultLanguageAdapter();
    });

    test('should handle generic function definitions', () => {
      const mockNode = createMockNode('function generic_func() { }', 1, 1, 'function_definition');
      const mockResults = [createMockQueryResult('generic_func', mockNode)];

      const results = adapter.normalize(mockResults, 'functions', 'generic');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('generic_func');
    });

    test('should handle unnamed structures', () => {
      const mockNode = createMockNode('export default () => { }', 1, 1, 'arrow_function');
      const mockResults = [createMockQueryResult('', mockNode)];

      const results = adapter.normalize(mockResults, 'functions', 'javascript');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('unnamed');
    });
  });

  describe('QueryResultNormalizer Integration', () => {
    test('should get supported query types for TypeScript', async () => {
      // Mock QueryLoader.discoverQueryTypes
      const mockDiscoverTypes = jest.fn().mockResolvedValue(['functions', 'classes', 'methods']);
      
      // 这里需要mock QueryLoader，在实际测试中需要适当的依赖注入
      const types = await normalizer.getSupportedQueryTypes('typescript');
      
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    test('should map node types correctly', () => {
      const functionType = normalizer.mapNodeType('function_declaration', 'typescript');
      expect(functionType).toBe('function');

      const classType = normalizer.mapNodeType('class_declaration', 'typescript');
      expect(classType).toBe('class');
    });

    test('should handle normalization statistics', () => {
      const initialStats = normalizer.getStats();
      expect(initialStats.totalNodes).toBe(0);
      expect(initialStats.successfulNormalizations).toBe(0);

      normalizer.resetStats();
      const resetStats = normalizer.getStats();
      expect(resetStats.totalNodes).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed query results gracefully', () => {
      const adapter = new TypeScriptLanguageAdapter();
      const malformedResults = [
        { captures: null },
        { captures: [] },
        { captures: [{ name: 'invalid', node: null }] }
      ];

      const results = adapter.normalize(malformedResults, 'functions', 'typescript');
      expect(results).toHaveLength(0);
    });

    test('should handle missing node information', () => {
      const adapter = new DefaultLanguageAdapter();
      const resultWithoutNode = { captures: [{ name: 'test', node: null }] };

      const results = adapter.normalize([resultWithoutNode], 'functions', 'generic');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('unnamed');
      expect(results[0].startLine).toBe(1);
    });
  });
});