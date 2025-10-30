import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, ChunkingOptions, ChunkingPreset } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { AdvancedMergingPostProcessor } from '../AdvancedMergingPostProcessor';

describe('AdvancedMergingPostProcessor', () => {
  let processor: AdvancedMergingPostProcessor;
  let logger: LoggerService;
  let mockOptions: ChunkingOptions;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    processor = new AdvancedMergingPostProcessor(logger);

    // 创建测试配置
    mockOptions = {
      advanced: {
        enableAdvancedMerging: true,
        mergeDecisionThreshold: 0.75,
        maxOverlapLines: 50,
        similarityThreshold: 0.8
      },
      basic: {
        maxChunkSize: 1000,
        minChunkSize: 100
      }
    };
  });

  describe('getName', () => {
    it('should return processor name', () => {
      expect(processor.getName()).toBe('advanced-merging-processor');
    });
  });

  describe('shouldApply', () => {
    it('should return true when advanced merging is enabled and multiple chunks', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        },
        {
          content: 'function small2() { return 2; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    it('should return false when advanced merging is disabled', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: false } },
        filePath: 'test.js',
        language: 'javascript'
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when only one chunk', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('process', () => {
    it('should merge small chunks when enabled', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        },
        {
          content: 'function small2() { return 2; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('small1');
      expect(result[0].content).toContain('small2');
    });

    it('should not merge when disabled', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        },
        {
          content: 'function small2() { return 2; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: false } },
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(2);
    });

    it('should respect merge decision threshold', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function medium1() {\n  // Some medium sized function\n  return 1;\n}',
          metadata: {
            startLine: 1,
            endLine: 4,
            language: 'javascript',
            type: 'function',
            complexity: 5
          }
        },
        {
          content: 'class VeryDifferentClass {\n  constructor() {\n    this.value = 42;\n  }\n  getValue() {\n    return this.value;\n  }\n}',
          metadata: {
            startLine: 100, // Far away from the first chunk
            endLine: 106,
            language: 'javascript',
            type: 'class', // Different type
            complexity: 15 // Different complexity
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { 
          ...mockOptions, 
          advanced: { 
            ...mockOptions.advanced, 
            enableAdvancedMerging: true,
            mergeDecisionThreshold: 0.9 // High threshold, should not merge
          }
        },
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(2);
    });

    it('should handle empty chunks array', async () => {
      const chunks: CodeChunk[] = [];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: mockOptions,
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(0);
    });

    it('should preserve metadata when merging', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1,
            customProperty: 'value1'
          }
        },
        {
          content: 'function small2() { return 2; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'javascript',
            type: 'function',
            complexity: 1,
            customProperty: 'value2'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[0].metadata.endLine).toBe(2);
      expect(result[0].metadata.type).toBe('merged');
      expect(result[0].metadata.complexity).toBe(2);
    });

    it('should handle chunks with different languages', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function jsFunc() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        },
        {
          content: 'def py_func():\n    return 1',
          metadata: {
            startLine: 1,
            endLine: 2,
            language: 'python',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      const result = await processor.process(chunks, context);

      // Should not merge chunks with different languages
      expect(result).toHaveLength(2);
    });

    it('should log debug information', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function small1() { return 1; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function',
            complexity: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        options: { ...mockOptions, advanced: { ...mockOptions.advanced, enableAdvancedMerging: true } },
        filePath: 'test.js',
        language: 'javascript'
      };

      await processor.process(chunks, context);

      expect(logger.debug).toHaveBeenCalled();
    });
  });
});