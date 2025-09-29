import Parser from 'tree-sitter';
import { BaseChunkingStrategy, ChunkingStrategy, StrategyConfiguration } from '../../strategy/ChunkingStrategy';
import { CodeChunk } from '../../types';

// 创建一个具体的策略实现用于测试
class TestChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'test_chunking';
  readonly priority = 10;
  readonly description = 'Test chunking strategy';
  readonly supportedLanguages = ['typescript', 'javascript'];

  canHandle(language: string, node: Parser.SyntaxNode): boolean {
    return this.supportedLanguages.includes(language) && node.type === 'function_declaration';
  }

 chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    if (!this.canHandle(this.detectLanguage(node), node)) {
      return [];
    }

    const nodeContent = content.substring(node.startIndex, node.endIndex);
    const location = this.getNodeLocation(node);

    const chunk: CodeChunk = {
      content: nodeContent,
      metadata: {
        startLine: location.startLine,
        endLine: location.endLine,
        language: this.detectLanguage(node),
        type: 'function',
        complexity: this.calculateComplexity(nodeContent)
      }
    };

    return [chunk];
  }

  getSupportedNodeTypes(language: string): Set<string> {
    return new Set(['function_declaration']);
  }

 private detectLanguage(node: Parser.SyntaxNode): string {
    return 'typescript'; // For testing purposes
  }
}

describe('BaseChunkingStrategy', () => {
  let strategy: TestChunkingStrategy;

  beforeEach(() => {
    strategy = new TestChunkingStrategy();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(strategy).toBeInstanceOf(TestChunkingStrategy);
      expect(strategy.name).toBe('test_chunking');
      expect(strategy.priority).toBe(10);
      expect(strategy.description).toBe('Test chunking strategy');
      expect(strategy.supportedLanguages).toEqual(['typescript', 'javascript']);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<StrategyConfiguration> = {
        maxChunkSize: 3000,
        minChunkSize: 200,
        preserveComments: false,
        preserveEmptyLines: true,
        maxNestingLevel: 5
      };

      const customStrategy = new TestChunkingStrategy(customConfig);
      const config = customStrategy.getConfiguration();

      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.preserveComments).toBe(false);
      expect(config.preserveEmptyLines).toBe(true);
      expect(config.maxNestingLevel).toBe(5);
    });
  });

 describe('validateChunks', () => {
    it('should return false for empty chunks array', () => {
      const result = strategy.validateChunks([]);
      expect(result).toBe(false);
    });

    it('should return false for chunks that are too small', () => {
      const smallChunk: CodeChunk = {
        content: 'a', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript'
        }
      };

      const result = strategy.validateChunks([smallChunk]);
      expect(result).toBe(false);
    });

    it('should return false for chunks that are too large', () => {
      const largeChunk: CodeChunk = {
        content: 'a'.repeat(3000), // Too large with default config
        metadata: {
          startLine: 1,
          endLine: 10,
          language: 'typescript'
        }
      };

      const result = strategy.validateChunks([largeChunk]);
      expect(result).toBe(false);
    });

    it('should return true for valid chunks', () => {
      const validChunk: CodeChunk = {
        content: 'function test() { return "hello"; }'.padEnd(150, ' '), // Within size limits (150 chars)
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript'
        }
      };

      const result = strategy.validateChunks([validChunk]);
      expect(result).toBe(true);
    });

    it('should return true for multiple valid chunks', () => {
      const validChunk1: CodeChunk = {
        content: 'function test1() { return "hello"; }'.padEnd(150, ' '),
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript'
        }
      };

      const validChunk2: CodeChunk = {
        content: 'function test2() { return "world"; }'.padEnd(150, ' '),
        metadata: {
          startLine: 2,
          endLine: 2,
          language: 'typescript'
        }
      };

      const result = strategy.validateChunks([validChunk1, validChunk2]);
      expect(result).toBe(true);
    });
  });

  describe('getConfiguration', () => {
    it('should return the strategy configuration', () => {
      const config = strategy.getConfiguration();
      expect(config).toHaveProperty('maxChunkSize');
      expect(config).toHaveProperty('minChunkSize');
      expect(config).toHaveProperty('preserveComments');
      expect(config).toHaveProperty('preserveEmptyLines');
      expect(config).toHaveProperty('maxNestingLevel');
      expect(typeof config.maxChunkSize).toBe('number');
      expect(typeof config.minChunkSize).toBe('number');
      expect(typeof config.preserveComments).toBe('boolean');
      expect(typeof config.preserveEmptyLines).toBe('boolean');
      expect(typeof config.maxNestingLevel).toBe('number');
    });

    it('should return a copy of the configuration', () => {
      const config1 = strategy.getConfiguration();
      config1.maxChunkSize = 9999;
      
      const config2 = strategy.getConfiguration();
      expect(config2.maxChunkSize).not.toBe(999); // Original should not be modified
    });
  });

  describe('extractNodeContent', () => {
    it('should extract content from node', () => {
      const mockNode = {
        startIndex: 0,
        endIndex: 10
      } as unknown as Parser.SyntaxNode;
      
      const content = strategy['extractNodeContent'](mockNode, 'function test()');
      expect(content).toBe('function t'); // First 10 characters
    });
  });

  describe('getNodeLocation', () => {
    it('should return location information for a node', () => {
      const mockNode = {
        startPosition: { row: 5, column: 10 },
        endPosition: { row: 8, column: 5 }
      } as unknown as Parser.SyntaxNode;
      
      const location = strategy['getNodeLocation'](mockNode);
      expect(location).toEqual({
        startLine: 6, // Should be 1-indexed
        endLine: 9,   // Should be 1-indexed
        startColumn: 11, // Should be 1-indexed
        endColumn: 6    // Should be 1-indexed
      });
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity based on control structures', () => {
      const simpleCode = 'function test() { return "hello"; }';
      const complexCode = `
        function test() {
          if (condition1) {
            for (let i = 0; i < 10; i++) {
              if (condition2) {
                while (condition3) {
                  try {
                    // code
                  } catch (e) {
                    // handle error
                  }
                }
              }
            }
          }
        }
      `;

      const simpleComplexity = strategy['calculateComplexity'](simpleCode);
      const complexComplexity = strategy['calculateComplexity'](complexCode);

      expect(typeof simpleComplexity).toBe('number');
      expect(typeof complexComplexity).toBe('number');
      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    it('should cap complexity at 50', () => {
      const veryComplexCode = `
        if (a) if (b) if (c) if (d) if (e) if (f) if (g) if (h) if (i) if (j)
        if (k) if (l) if (m) if (n) if (o) if (p) if (q) if (r) if (s) if (t)
        if (u) if (v) if (w) if (x) if (y) if (z) if (a2) if (b2) if (c2) if (d2)
        if (e2) if (f2) if (g2) if (h2) if (i2) if (j2) if (k2) if (l2) if (m2) if (n2)
        if (o2) if (p2) if (q2) if (r2) if (s2) if (t2) if (u2) if (v2) if (w2) if (x2)
      `;

      const complexity = strategy['calculateComplexity'](veryComplexCode);
      expect(complexity).toBeLessThanOrEqual(50);
    });
 });
});

describe('StrategyConfiguration', () => {
  it('should have correct default values in BaseChunkingStrategy', () => {
    const strategy = new TestChunkingStrategy();
    const config = strategy.getConfiguration();

    expect(config.maxChunkSize).toBe(2000);
    expect(config.minChunkSize).toBe(100);
    expect(config.preserveComments).toBe(true);
    expect(config.preserveEmptyLines).toBe(false);
    expect(config.maxNestingLevel).toBe(10);
  });
});

describe('StrategyExecutionResult', () => {
  // This is just an interface, so we test its structure through usage
  it('should have the correct properties', () => {
    const result: any = {
      chunks: [],
      executionTime: 10,
      processedNodes: 5,
      strategyName: 'test',
      success: true,
      error: undefined
    };

    expect(result).toHaveProperty('chunks');
    expect(result).toHaveProperty('executionTime');
    expect(result).toHaveProperty('processedNodes');
    expect(result).toHaveProperty('strategyName');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
  });
});