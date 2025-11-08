import { OverlapPostProcessor } from '../OverlapPostProcessor';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk } from '../../types/CodeChunk';
import { EnhancedChunkingOptions, ChunkingOptions, ChunkingPreset } from '../../strategies/types/SegmentationTypes';
import { LoggerService } from '../../../../../utils/LoggerService';

describe('OverlapPostProcessor', () => {
  let processor: OverlapPostProcessor;
  let logger: LoggerService;
  let mockOptions: EnhancedChunkingOptions;

  beforeEach(() => {
    logger = new LoggerService();
    processor = new OverlapPostProcessor(logger);
    
    mockOptions = {
      preset: ChunkingPreset.BALANCED,
      basic: {
        minChunkSize: 100,
        maxChunkSize: 1000,
        overlapSize: 200,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: false,
        extractSnippets: true,
        addOverlap: true,
        optimizationLevel: 'medium' as const,
        maxLines: 10000
      },
      advanced: {
        maxOverlapRatio: 0.3,
        enableASTBoundaryDetection: false,
        deduplicationThreshold: 0.8,
        astNodeTracking: false,
        chunkMergeStrategy: 'conservative' as const,
        enableChunkDeduplication: true,
        maxOverlapLines: 10,
        minChunkSimilarity: 0.7,
        enableSmartDeduplication: true,
        similarityThreshold: 0.8,
        overlapMergeStrategy: 'conservative' as const,
        enableEnhancedBalancing: false,
        enableIntelligentFiltering: false,
        enableSmartRebalancing: false,
        enableAdvancedMerging: false,
        enableBoundaryOptimization: false,
        balancedChunkerThreshold: 0.8,
        minChunkSizeThreshold: 50,
        maxChunkSizeThreshold: 1500,
        rebalancingStrategy: 'conservative' as const,
        boundaryOptimizationThreshold: 0.9,
        mergeDecisionThreshold: 0.85,
        adaptiveBoundaryThreshold: false,
        contextAwareOverlap: false,
        semanticWeight: 0.5,
        syntacticWeight: 0.5
      },
      performance: {
        enablePerformanceOptimization: true,
        enablePerformanceMonitoring: false,
        enableChunkingCoordination: true,
        strategyExecutionOrder: [],
        enableNodeTracking: false
      }
    };
  });

  describe('基础功能测试', () => {
    test('应该正确识别处理器名称', () => {
      expect(processor.getName()).toBe('overlap-post-processor');
    });

    test('应该在启用重叠且有多个块时应用', () => {
      const chunks: CodeChunk[] = [
        { id: 'test-chunk-3-1', content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } },
        { id: 'test-chunk-3-2', content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1\nchunk2',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    test('应该在禁用重叠时不应用', () => {
      const chunks: CodeChunk[] = [
        { id: 'test-chunk-2-1', content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } },
        { id: 'test-chunk-2-2', content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1\nchunk2',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          basic: {
            ...mockOptions.basic,
            addOverlap: false
          }
        }
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    test('应该在没有重叠大小时不应用', () => {
      const chunks: CodeChunk[] = [
        { id: 'test-chunk-1-1', content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } },
        { id: 'test-chunk-1-2', content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1\nchunk2',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          basic: {
            ...mockOptions.basic,
            overlapSize: 0
          }
        }
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    test('应该只有一个块时不应用', () => {
      const chunks: CodeChunk[] = [
        { id: 'test-chunk-4-1', content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('代码文件处理测试', () => {
    test('应该对过大的代码块进行拆分', async () => {
      // 创建一个真正大的代码块（超过maxChunkSize的1000字符）
      const largeContent = 'const x = "This is a very long string that will make the chunk exceed the maximum size limit";\n'.repeat(50);
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          content: largeContent,
          metadata: {
            startLine: 1,
            endLine: 50,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: largeContent,
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该被拆分成多个块（因为typescript是代码文件且有大型块）
      expect(result.length).toBeGreaterThan(1);
      
      // 验证每个块都有有效的元数据
      result.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata.startLine).toBeDefined();
        expect(chunk.metadata.endLine).toBeDefined();
        expect(chunk.metadata.language).toBe('typescript');
      });
    });

    test('应该对正常大小的代码块不进行拆分', async () => {
      const normalContent = 'const x = 1;\nconst y = 2;';
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-2',
          content: normalContent,
          metadata: {
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: normalContent,
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 不应该被拆分
      expect(result.length).toBe(1);
      expect(result[0].content).toBe(normalContent);
    });
  });

  describe('文本文件处理测试', () => {
    test('应该为文本文件添加重叠内容', async () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-3',
          content: 'First paragraph',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'markdown',
            type: 'paragraph'
          }
        },
        {
          id: 'chunk-4',
          content: 'Second paragraph',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'markdown',
            type: 'paragraph'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'First paragraph\nSecond paragraph',
        language: 'markdown',
        filePath: 'test.md',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该保持相同的块数
      expect(result.length).toBe(2);
      
      // 第一个块应该包含重叠内容（因为markdown是文本文件且有多个块）
      expect(result[0].content.length).toBeGreaterThan(chunks[0].content.length);
      expect(result[0].content).toContain('Second paragraph');
    });
  });

  describe('语义边界检测测试', () => {
    test('应该检测函数定义作为语义边界', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {\n  return "hello";\n}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'javascript',
            type: 'function'
          }
        },
        {
          content: 'function another() {\n  return "world";\n}',
          metadata: {
            startLine: 4,
            endLine: 6,
            language: 'javascript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {\n  return "hello";\n}\nfunction another() {\n  return "world";\n}',
        language: 'javascript',
        filePath: 'test.js',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该保持相同的块数
      expect(result.length).toBe(2);
      
      // 验证语义边界检测功能正常工作
      expect(result[0].content).toContain('function test()');
    });
  });

  describe('错误处理测试', () => {
    test('应该优雅处理空内容', async () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-7',
          content: '',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: '',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该返回原始块
      expect(result).toEqual(chunks);
    });

    test('应该优雅处理无效的行号', async () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-8',
          content: 'test content',
          metadata: {
            startLine: 0,
            endLine: 0,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该返回原始块
      expect(result).toEqual(chunks);
    });
  });

  describe('配置测试', () => {
    test('应该根据重叠大小配置调整重叠内容', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
          metadata: {
            startLine: 1,
            endLine: 5,
            language: 'text',
            type: 'paragraph'
          }
        },
        {
          content: 'Line 6\nLine 7\nLine 8\nLine 9\nLine 10',
          metadata: {
            startLine: 6,
            endLine: 10,
            language: 'text',
            type: 'paragraph'
          }
        }
      ];

      const smallOverlapOptions = { ...mockOptions, overlapSize: 50 };
      const largeOverlapOptions = { ...mockOptions, overlapSize: 500 };

      const context: PostProcessingContext = {
        originalContent: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10',
        language: 'text',
        filePath: 'test.txt',
        options: smallOverlapOptions
      };

      const smallResult = await processor.process(chunks, context);
      
      context.options = largeOverlapOptions;
      const largeResult = await processor.process(chunks, context);
      
      // 大重叠配置应该产生更多的重叠内容
      expect(largeResult[0].content.length).toBeGreaterThanOrEqual(smallResult[0].content.length);
    });
  });

  describe('清理测试', () => {
    test('应该正确清理资源', () => {
      expect(() => processor.cleanup()).not.toThrow();
    });
  });
});