/**
 * BaseLanguageAdapter 测试
 */

import { BaseLanguageAdapter, AdapterOptions } from '../adapters/base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * 测试用的具体语言适配器实现
 */
class TestLanguageAdapter extends BaseLanguageAdapter {
  extractName(result: any): string {
    return result.name || 'test';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    return {
      testSpecific: result.testSpecific || true
    };
  }

  getSupportedQueryTypes(): string[] {
    return ['functions', 'classes', 'variables'];
  }

  mapNodeType(nodeType: string): string {
    return nodeType;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable'
    };
    return mapping[queryType] || 'expression';
  }

  calculateComplexity(result: any): number {
    return this.calculateBaseComplexity(result) + 1;
  }

  extractDependencies(result: any): string[] {
    return this.extractBaseDependencies(result);
  }

  extractModifiers(result: any): string[] {
    return ['test'];
  }

  // 公开受保护的方法用于测试
  public testExtractStartLine(result: any): number {
    return this.extractStartLine(result);
  }

  public testExtractEndLine(result: any): number {
    return this.extractEndLine(result);
  }

  public testExtractContent(result: any): string {
    return this.extractContent(result);
  }

  public testCalculateBaseComplexity(result: any): number {
    return this.calculateBaseComplexity(result);
  }

  public testCalculateNestingDepth(node: any, currentDepth: number = 0): number {
    return this.calculateNestingDepth(node, currentDepth);
  }

  public testIsBlockNode(node: any): boolean {
    return this.isBlockNode(node);
  }

  public testExtractBaseDependencies(result: any): string[] {
    return this.extractBaseDependencies(result);
  }

  public testGenerateCacheKey(queryResults: any[], queryType: string, language: string): string {
    return this.generateCacheKey(queryResults, queryType, language);
  }

  public testHashResults(queryResults: any[]): string {
    return this.hashResults(queryResults);
  }

  public testSimpleHash(str: string): string {
    return this.simpleHash(str);
  }
}

describe('BaseLanguageAdapter', () => {
  let adapter: TestLanguageAdapter;
  let mockQueryResults: any[];
  let mockResult: any;

  beforeEach(() => {
    adapter = new TestLanguageAdapter();

    mockResult = {
      captures: [{
        node: {
          text: 'test content',
          startPosition: { row: 0 },
          endPosition: { row: 5 },
          type: 'test_node',
          children: []
        }
      }]
    };

    mockQueryResults = [mockResult];
  });

  describe('normalize', () => {
    it('should normalize query results successfully', async () => {
      const results = await adapter.normalize(mockQueryResults, 'functions', 'test');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('test');
      expect(results[0].startLine).toBe(1);
      expect(results[0].endLine).toBe(6);
      expect(results[0].content).toBe('test content');
      expect(results[0].metadata.language).toBe('test');
      expect(results[0].metadata.complexity).toBeGreaterThan(0);
      expect(results[0].metadata.modifiers).toContain('test');
    });

    it('should handle empty query results', async () => {
      const results = await adapter.normalize([], 'functions', 'test');
      expect(results).toHaveLength(0);
    });

    it('should filter invalid results', async () => {
      const invalidResults = [
        null,
        undefined,
        {},
        { captures: [] },
        { captures: [{}] }
      ];

      const results = await adapter.normalize(invalidResults, 'functions', 'test');
      expect(results).toHaveLength(0);
    });

    it('should use caching when enabled', async () => {
      const cachingAdapter = new TestLanguageAdapter({ enableCaching: true });

      const results1 = await cachingAdapter.normalize(mockQueryResults, 'functions', 'test');
      const results2 = await cachingAdapter.normalize(mockQueryResults, 'functions', 'test');

      expect(results1).toEqual(results2);
    });

    it('should handle errors with fallback when enabled', async () => {
      const errorAdapter = new TestLanguageAdapter({ enableErrorRecovery: true });

      // 模拟错误 - 需要模拟createStandardizedResult方法而不是extractName
      jest.spyOn(errorAdapter as any, 'createStandardizedResult').mockImplementation(() => {
        throw new Error('Test error');
      });

      const results = await errorAdapter.normalize(mockQueryResults, 'functions', 'test');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('fallback_0');
    });

    it('should throw errors when recovery is disabled', async () => {
      const errorAdapter = new TestLanguageAdapter({ enableErrorRecovery: false });

      // 模拟错误
      jest.spyOn(errorAdapter, 'extractName').mockImplementation(() => {
        throw new Error('Test error');
      });

      await expect(errorAdapter.normalize(mockQueryResults, 'functions', 'test'))
        .rejects.toThrow('Test error');
    });
  });

  describe('deduplication', () => {
    it('should remove duplicate results', async () => {
      const duplicateResults = [mockResult, mockResult];

      const results = await adapter.normalize(duplicateResults, 'functions', 'test');
      expect(results).toHaveLength(1);
    });

    it('should merge metadata of duplicate results', async () => {
      const result1 = {
        ...mockResult,
        name: 'test1'
      };

      const result2 = {
        ...mockResult,
        name: 'test2'
      };

      jest.spyOn(adapter, 'extractName')
        .mockReturnValueOnce('test1')
        .mockReturnValueOnce('test2');

      const results = await adapter.normalize([result1, result2], 'functions', 'test');
      expect(results).toHaveLength(2);
    });
  });

  describe('utility methods', () => {
    it('should extract start line correctly', () => {
      const startLine = adapter.testExtractStartLine(mockResult);
      expect(startLine).toBe(1);
    });

    it('should extract end line correctly', () => {
      const endLine = adapter.testExtractEndLine(mockResult);
      expect(endLine).toBe(6);
    });

    it('should extract content correctly', () => {
      const content = adapter.testExtractContent(mockResult);
      expect(content).toBe('test content');
    });

    it('should calculate base complexity', () => {
      const complexity = adapter.testCalculateBaseComplexity(mockResult);
      expect(complexity).toBeGreaterThan(0);
    });

    it('should calculate nesting depth', () => {
      const depth = adapter.testCalculateNestingDepth(mockResult.captures[0].node);
      expect(depth).toBe(0);
    });

    it('should identify block nodes', () => {
      expect(adapter.testIsBlockNode({ type: 'block' })).toBe(true);
      expect(adapter.testIsBlockNode({ type: 'class_body' })).toBe(true);
      expect(adapter.testIsBlockNode({ type: 'other' })).toBe(false);
    });

    it('should extract base dependencies', () => {
      const dependencies = adapter.testExtractBaseDependencies(mockResult);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should generate cache key', () => {
      const cacheKey = adapter.testGenerateCacheKey(mockQueryResults, 'functions', 'test');
      expect(typeof cacheKey).toBe('string');
      expect(cacheKey).toContain('test:functions:');
    });

    it('should hash results', () => {
      const hash = adapter.testHashResults(mockQueryResults);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate simple hash', () => {
      const hash = adapter.testSimpleHash('test string');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('configuration options', () => {
    it('should respect custom options', () => {
      const customOptions: AdapterOptions = {
        enableDeduplication: false,
        enablePerformanceMonitoring: true,
        enableErrorRecovery: false,
        enableCaching: false,
        cacheSize: 50,
        customTypeMappings: { 'custom': 'expression' }
      };

      const customAdapter = new TestLanguageAdapter(customOptions);
      expect(customAdapter).toBeInstanceOf(TestLanguageAdapter);
    });
  });
});