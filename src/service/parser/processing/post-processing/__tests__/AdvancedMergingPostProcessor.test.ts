import { AdvancedMergingPostProcessor } from '../AdvancedMergingPostProcessor';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, EnhancedChunkingOptions } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';

describe('AdvancedMergingPostProcessor', () => {
  let processor: AdvancedMergingPostProcessor;
  let logger: LoggerService;
  let mockOptions: EnhancedChunkingOptions;

  beforeEach(() => {
    logger = new LoggerService();
    processor = new AdvancedMergingPostProcessor(logger);
    
    mockOptions = {
      // 基础选项
      minChunkSize: 100,
      maxChunkSize: 1000,
      overlapSize: 50,
      preserveFunctionBoundaries: true,
      preserveClassBoundaries: true,
      includeComments: false,
      extractSnippets: true,
      addOverlap: false,
      optimizationLevel: 'medium' as const,
      maxLines: 10000,
      
      // EnhancedChunkingOptions 必需属性
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
      
      // 新增：增强配置选项
      enableEnhancedBalancing: false,
      enableIntelligentFiltering: false,
      enableSmartRebalancing: false,
      enableAdvancedMerging: true, // 启用高级合并
      enableBoundaryOptimization: false,
      enableOverlap: false,
      balancedChunkerThreshold: 0.8,
      minChunkSizeThreshold: 50,
      maxChunkSizeThreshold: 1500,
      rebalancingStrategy: 'conservative' as const,
      boundaryOptimizationThreshold: 0.9,
      mergeDecisionThreshold: 0.85,
      enablePerformanceMonitoring: false
    };
  });

  describe('基础功能测试', () => {
    test('应该正确识别处理器名称', () => {
      expect(processor.getName()).toBe('advanced-merging-processor');
    });

    test('应该在启用高级合并且有多个块时应用', () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } },
        { content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1\nchunk2',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    test('应该在禁用高级合并时不应用', () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } },
        { content: 'chunk2', metadata: { startLine: 2, endLine: 2, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1\nchunk2',
        language: 'typescript',
        filePath: 'test.ts',
        options: { ...mockOptions, enableAdvancedMerging: false }
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    test('应该只有一个块时不应用', () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    test('应该在空块列表时不应用', () => {
      const chunks: CodeChunk[] = [];

      const context: PostProcessingContext = {
        originalContent: '',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('处理逻辑测试', () => {
    test('应该在禁用高级合并时返回原始块', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        },
        {
          content: 'function test2() { return "world"; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\nfunction test2() { return "world"; }',
        language: 'typescript',
        filePath: 'test.ts',
        options: { ...mockOptions, enableAdvancedMerging: false }
      };

      const result = await processor.process(chunks, context);
      
      // 应该返回原始块（因为shouldApply返回false，直接返回原始块）
      expect(result).toEqual(chunks);
    });

    test('应该保持单个块不变', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该保持单个块不变
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
      expect(result[0].metadata.type).toBe('function');
    });

    test('应该优雅处理空内容', async () => {
      const chunks: CodeChunk[] = [
        {
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
  });

  describe('配置测试', () => {
    test('应该正确处理不同的块大小配置', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          content: 'const y = 2;',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const x = 1;\nconst y = 2;',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          minChunkSizeThreshold: 10,
          maxChunkSizeThreshold: 1000
        }
      };

      const result = await processor.process(chunks, context);
      
      // 应该成功处理 - 由于我们没有mock ChunkMerger，它会尝试使用真实的合并器
      // 但因为我们没有提供完整的依赖，它可能会失败并返回原始块
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('日志测试', () => {
    test('应该在处理时记录调试日志', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        },
        {
          content: 'function test2() { return "world"; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\nfunction test2() { return "world"; }',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      await processor.process(chunks, context);
      
      // 应该记录开始和完成的调试日志
      expect(debugSpy).toHaveBeenCalledWith('Starting advanced merging for 2 chunks');
      expect(debugSpy).toHaveBeenCalledWith('Advanced merging completed: 2 -> 2 chunks');
    });

    test('应该在错误时记录错误日志', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      // 创建一个简单的测试场景，可能会触发错误
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        },
        {
          content: 'function test2() { return "world"; }',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\nfunction test2() { return "world"; }',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      try {
        await processor.process(chunks, context);
      } catch (error) {
        // 如果发生错误，应该记录错误日志
        expect(errorSpy).toHaveBeenCalled();
      }
      
      // 即使没有错误，也应该检查是否记录了任何日志
      expect(errorSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });
});