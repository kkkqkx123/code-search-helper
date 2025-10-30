import { IntelligentFilterPostProcessor } from '../IntelligentFilterPostProcessor';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, EnhancedChunkingOptions, ChunkingOptions, ChunkingPreset } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';

describe('IntelligentFilterPostProcessor', () => {
  let processor: IntelligentFilterPostProcessor;
  let logger: LoggerService;
  let mockOptions: EnhancedChunkingOptions;

  beforeEach(() => {
    logger = new LoggerService();
    processor = new IntelligentFilterPostProcessor(logger);
    
    mockOptions = {
      preset: ChunkingPreset.BALANCED,
      basic: {
        minChunkSize: 100,
        maxChunkSize: 1000,
        overlapSize: 50,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: false,
        extractSnippets: true,
        addOverlap: false,
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
        enableIntelligentFiltering: true, // 启用智能过滤
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
      expect(processor.getName()).toBe('intelligent-filter-post-processor');
    });

    test('应该在启用智能过滤且有代码块时应用', () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    test('应该在禁用智能过滤时不应用', () => {
      const chunks: CodeChunk[] = [
        { content: 'chunk1', metadata: { startLine: 1, endLine: 1, language: 'typescript' } }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          advanced: {
            ...mockOptions.advanced,
            enableIntelligentFiltering: false
          }
        }
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
    test('应该在禁用智能过滤时返回原始块', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const validChunk = "this is a valid chunk with sufficient content";',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          content: 'tiny', // 过小的块
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const validChunk = "this is a valid chunk with sufficient content";\ntiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          advanced: {
            ...mockOptions.advanced,
            enableIntelligentFiltering: false
          }
        }
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

    test('应该过滤掉空内容块', async () => {
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
      
      // 应该过滤掉空内容块，返回空数组
      expect(result).toHaveLength(0);
    });
  });

  describe('语言检测测试', () => {
    test('应该正确识别代码文件', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'javascript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'javascript',
        filePath: 'test.js',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该成功处理JavaScript代码
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });

    test('应该正确识别Markdown文件', async () => {
      const chunks: CodeChunk[] = [
        {
          content: '# Header\nThis is a paragraph.',
          metadata: {
            startLine: 1,
            endLine: 2,
            language: 'markdown',
            type: 'paragraph'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: '# Header\nThis is a paragraph.',
        language: 'markdown',
        filePath: 'test.md',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 应该成功处理Markdown内容
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });
  });

  describe('错误处理测试', () => {
    test('应该过滤掉空内容块', async () => {
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
      
      // 应该过滤掉空内容块，返回空数组
      expect(result).toHaveLength(0);
    });

    test('应该优雅处理无效的行号', async () => {
      const chunks: CodeChunk[] = [
        {
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
    test('应该根据最小块大小阈值过滤', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;', // 小块
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          content: 'const y = 2;', // 小块
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
          advanced: {
            ...mockOptions.advanced,
            minChunkSizeThreshold: 5 // 设置较低阈值
          }
        }
      };

      const result = await processor.process(chunks, context);
      
      // 应该根据配置处理
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    test('应该根据最大块大小阈值处理', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const x = 1;',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          advanced: {
            ...mockOptions.advanced,
            maxChunkSizeThreshold: 1000
          }
        }
      };

      const result = await processor.process(chunks, context);
      
      // 应该成功处理
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });
  });

  describe('日志测试', () => {
    test('应该在处理时记录调试日志', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
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

      await processor.process(chunks, context);
      
      // 应该记录处理日志
      expect(debugSpy).toHaveBeenCalledWith('Applying intelligent filter post-processing to 1 chunks');
    });

    test('应该在过滤和合并时记录详细日志', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;', // 小块
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          content: 'const y = 2;', // 小块
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
        options: mockOptions
      };

      await processor.process(chunks, context);
      
      // 应该记录过滤和合并的详细日志
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Intelligent filter:'));
    });
  });
});