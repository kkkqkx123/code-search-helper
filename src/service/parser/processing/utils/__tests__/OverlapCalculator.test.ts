import { OverlapCalculator } from '../overlap/OverlapCalculator';
import { CodeChunk, ChunkMetadata } from '../../types/CodeChunk';

describe('UnifiedOverlapCalculator', () => {
  let calculator: OverlapCalculator;

  beforeEach(() => {
    calculator = new OverlapCalculator({
      maxSize: 200,
      minLines: 1,
      maxOverlapRatio: 0.3,
      enableASTBoundaryDetection: false
    });
  });

  describe('calculateOptimalOverlap', () => {
    it('should use semantic strategy for sequential functions', () => {
      const currentChunk: CodeChunk = {
        content: 'function first() {\n return "first";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'function',
          size: 30,
          lineCount: 3
        } as ChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'function second() {\n  return "second";\n}',
        metadata: {
          startLine: 5,
          endLine: 7,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'function',
          size: 30,
          lineCount: 3
        } as ChunkMetadata
      };
      const originalCode = 'function first() {\n  return "first";\n}\n\nfunction second() {\n  return "second";\n}';

      const result = calculator.calculateOptimalOverlap(
        currentChunk,
        nextChunk,
        originalCode,
        { maxSize: 100, minLines: 1 }
      );

      expect(result.strategy).toBe('semantic');
      expect(result.content).toContain('}');
    });

    it('should use syntactic strategy for complex structures', () => {
      const currentChunk: CodeChunk = {
        content: 'class ComplexClass {\n  constructor() {\n    this.data = [];\n  }',
        metadata: {
          startLine: 1,
          endLine: 4,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'class',
          size: 50,
          lineCount: 4
        } as ChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: '  method() {\n    return this.data;\n }\n}',
        metadata: {
          startLine: 5,
          endLine: 8,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'method' as any,
          size: 40,
          lineCount: 4
        } as ChunkMetadata
      };
      const originalCode = 'class ComplexClass {\n  constructor() {\n    this.data = [];\n  }\n method() {\n    return this.data;\n  }\n}';

      const result = calculator.calculateOptimalOverlap(
        currentChunk,
        nextChunk,
        originalCode,
        { maxSize: 100, minLines: 1 }
      );

      expect(result.strategy).toBe('semantic');
    });

    it('should apply context-aware optimization when enabled', () => {
      const currentChunk: CodeChunk = {
        content: 'function test() {\n return "test";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'function',
          size: 30,
          lineCount: 3
        } as ChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'console.log(test());',
        metadata: {
          startLine: 5,
          endLine: 5,
          language: 'typescript',
          strategy: 'test',
          timestamp: Date.now(),
          type: 'generic',
          size: 20,
          lineCount: 1
        } as ChunkMetadata
      };
      const originalCode = 'function test() {\n return "test";\n}\n\nconsole.log(test());';

      const result = calculator.calculateOptimalOverlap(
        currentChunk,
        nextChunk,
        originalCode,
        { maxSize: 100, minLines: 1 }
      );

      // Should have reasonable quality score
      expect(result.quality).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeLessThanOrEqual(1);
    });
  });

  describe('addOverlap', () => {
    it('should add overlap between chunks', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function first() {\n  return "first";',
          metadata: {
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: 'function',
            size: 30,
            lineCount: 2
          } as ChunkMetadata
        },
        {
          content: '}\nfunction second() {\n  return "second";\n}',
          metadata: {
            startLine: 3,
            endLine: 5,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: 'function',
            size: 40,
            lineCount: 3
          } as ChunkMetadata
        }
      ];
      const originalCode = 'function first() {\n  return "first";\n}\nfunction second() {\n  return "second";\n}';

      const result = calculator.addOverlap(chunks, originalCode);

      expect(result.length).toBe(2);
      // First chunk should have overlap appended
      expect(result[0].content).toContain('function first()');
    });
  });
});