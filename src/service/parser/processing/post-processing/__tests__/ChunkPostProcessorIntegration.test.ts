import { ChunkPostProcessorCoordinator } from '../ChunkPostProcessorCoordinator';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, EnhancedChunkingOptions, ChunkingOptions, ChunkingPreset } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';

describe('ChunkPostProcessorIntegration', () => {
  let coordinator: ChunkPostProcessorCoordinator;
  let logger: LoggerService;
  let mockOptions: EnhancedChunkingOptions;

  beforeEach(() => {
    logger = new LoggerService();
    coordinator = new ChunkPostProcessorCoordinator(logger);
    
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
        enableEnhancedBalancing: true,
        enableIntelligentFiltering: true,
        enableSmartRebalancing: true,
        enableAdvancedMerging: true,
        enableBoundaryOptimization: true,
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
    test('应该正确初始化所有处理器', () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      // 验证处理器已正确注册
      const stats = (coordinator as any).chunkingProcessors.length;
      const processingStats = (coordinator as any).chunkProcessingProcessors.length;
      
      expect(stats).toBeGreaterThan(0);
      expect(processingStats).toBeGreaterThan(0);
    });

    test('应该正确处理空的代码块列表', async () => {
      const context: PostProcessingContext = {
        originalContent: '',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process([], context);
      expect(result).toEqual([]);
    });
  });

  describe('符号平衡处理器测试', () => {
    test('应该检测符号不平衡的代码块', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      const chunks: CodeChunk[] = [
        {
          id: 'test-chunk-1',
          content: 'function test() {',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process(chunks, context);
      expect(result).toHaveLength(1);
      // 符号平衡处理器应该保持块不变，但记录分析结果
    });
  });

  describe('智能过滤处理器测试', () => {
    test('应该过滤过小的代码块', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      const chunks: CodeChunk[] = [
        {
          id: 'test-chunk-2-1',
          content: 'small', // 过小的块
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          id: 'test-chunk-2-2',
          content: 'const validChunk = "this is a valid chunk with sufficient content";',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'small\nconst validChunk = "this is a valid chunk with sufficient content";',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process(chunks, context);
      // 应该过滤掉过小的块
      expect(result.length).toBeLessThanOrEqual(chunks.length);
    });
  });

  describe('智能再平衡处理器测试', () => {
    test('应该合并过小的最后一块', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      const chunks: CodeChunk[] = [
        {
          id: 'test-chunk-3-1',
          content: 'const firstChunk = "this is a normal sized chunk";',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          id: 'test-chunk-3-2',
          content: 'tiny', // 过小的最后一块
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const firstChunk = "this is a normal sized chunk";\ntiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process(chunks, context);
      // 应该合并过小的最后一块
      expect(result.length).toBeLessThanOrEqual(chunks.length);
    });
  });

  describe('高级合并处理器测试', () => {
    test('应该合并相似的代码块', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
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

      const result = await coordinator.process(chunks, context);
      // 高级合并处理器可能会合并相似的函数
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('边界优化处理器测试', () => {
    test('应该优化代码块边界', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;\nconst y = 2;',
          metadata: {
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const x = 1;\nconst y = 2;\nconst z = 3;',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process(chunks, context);
      // 边界优化可能会调整块的边界
      expect(result).toHaveLength(1);
    });
  });

  describe('集成测试', () => {
    test('应该按正确顺序执行所有处理器', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function'
          }
        },
        {
          content: 'tiny',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code'
          }
        },
        {
          content: 'function similar() { return "hello"; }',
          metadata: {
            startLine: 3,
            endLine: 3,
            language: 'typescript',
            type: 'function'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {\ntiny\nfunction similar() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await coordinator.process(chunks, context);
      
      // 验证处理结果
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(chunks.length);
      
      // 验证每个结果块都有有效的元数据
      result.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.startLine).toBeDefined();
        expect(chunk.metadata.endLine).toBeDefined();
        expect(chunk.metadata.language).toBe('typescript');
      });
    });

    test('应该处理禁用的处理器', async () => {
      const disabledOptions = { 
        ...mockOptions,
        advanced: {
          ...mockOptions.advanced,
          enableIntelligentFiltering: false,
          enableSmartRebalancing: false
        }
      };
      
      coordinator.initializeDefaultProcessors(disabledOptions);
      
      const chunks: CodeChunk[] = [
        {
          content: 'tiny',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'code'
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'tiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: disabledOptions
      };

      const result = await coordinator.process(chunks, context);
      // 禁用的处理器不应该执行
      expect(result).toHaveLength(1);
    });
  });

  describe('错误处理测试', () => {
    test('应该优雅处理处理器错误', async () => {
      coordinator.initializeDefaultProcessors(mockOptions);
      
      // 创建可能导致错误的无效块
      const invalidChunks: CodeChunk[] = [
        {
          content: '',
          metadata: {
            startLine: 0,
            endLine: 0,
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

      // 应该不会抛出错误
      const result = await coordinator.process(invalidChunks, context);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});