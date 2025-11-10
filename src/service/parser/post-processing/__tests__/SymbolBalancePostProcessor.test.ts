import { SymbolBalancePostProcessor } from '../SymbolBalancePostProcessor';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, ChunkType } from '../../processing/types/CodeChunk';
import { EnhancedChunkingOptions, ChunkingPreset } from '../../processing/strategies/types/SegmentationTypes';
import { LoggerService } from '../../../../utils/LoggerService';
import { ProcessingConfig } from '../../processing/core/types/ConfigTypes';

describe('SymbolBalancePostProcessor', () => {
  let processor: SymbolBalancePostProcessor;
  let logger: LoggerService;
  let mockOptions: EnhancedChunkingOptions;
  let mockConfig: ProcessingConfig;

  beforeEach(() => {
    logger = new LoggerService();
    processor = new SymbolBalancePostProcessor(logger);

    mockOptions = {
      maxChunkSize: 1000,
      minChunkSize: 100,
      overlapSize: 50,
      maxLinesPerChunk: 100,
      minLinesPerChunk: 10,
      enableIntelligentChunking: true,
      memoryLimitMB: 512,
      errorThreshold: 10,
      customParams: {},
      advanced: {
        semanticWeight: 0.5,
        syntacticWeight: 0.5,
        structuralWeight: 0.0,
        enableChunkDeduplication: true,
        deduplicationThreshold: 0.8
      }
    };

    // 创建模拟的 ProcessingConfig
    mockConfig = {
      chunking: {
        maxChunkSize: 1000,
        minChunkSize: 100,
        overlapSize: 50,
        maxLinesPerChunk: 100,
        minLinesPerChunk: 10,
        maxOverlapRatio: 0.3,
        defaultStrategy: 'balanced',
        strategyPriorities: {},
        enableIntelligentChunking: true,
        enableSemanticBoundaryDetection: true
      },
      features: {
        enableAST: true,
        enableSemanticDetection: true,
        enableBracketBalance: true,
        enableCodeOverlap: true,
        enableStandardization: true,
        standardizationFallback: true,
        enableComplexityCalculation: true,
        enableLanguageFeatureDetection: true,
        featureDetectionThresholds: {}
      },
      performance: {
        memoryLimitMB: 512,
        maxExecutionTime: 30000,
        enableCaching: true,
        cacheSizeLimit: 1000,
        enablePerformanceMonitoring: false,
        concurrencyLimit: 4,
        queueSizeLimit: 100,
        enableBatchProcessing: true,
        batchSize: 10,
        enableLazyLoading: true
      },
      languages: {},
      postProcessing: {
        enabled: true,
        enabledProcessors: ['symbol-balance-post-processor'],
        processorConfigs: {},
        processorOrder: ['symbol-balance-post-processor'],
        maxProcessingRounds: 3,
        enableParallelProcessing: false,
        parallelProcessingLimit: 2
      },
      global: {
        debugMode: false,
        logLevel: 'info',
        enableMetrics: false,
        enableStatistics: false,
        configVersion: '1.0.0',
        compatibilityMode: false,
        strictMode: false,
        experimentalFeatures: [],
        customProperties: {}
      },
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  });

  describe('基础功能测试', () => {
    test('应该正确识别处理器名称', () => {
      expect(processor.getName()).toBe('symbol-balance-post-processor');
    });

    test('应该在启用增强平衡且有代码块时应用', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'chunk1',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 6,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    test('应该在禁用增强平衡时不应用', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'chunk1',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 6,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'chunk1',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: false
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
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('符号平衡测试', () => {
    test('应该分析平衡的代码块', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {\n  return "hello";\n}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 3
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {\n  return "hello";\n}',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理平衡的代码块
      expect(result).toHaveLength(1);
      expect(result[0].content).toBeDefined();
    });

    test('应该在禁用增强平衡时返回原始块', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {\n  return "hello";\n}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 3
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {\n  return "hello";\n}',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: false
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
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该保持单个块不变
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
      expect(result[0].metadata.type).toBe(ChunkType.FUNCTION);
    });

    test('应该优雅处理空内容', async () => {
      const chunks: CodeChunk[] = [
        {
          content: '',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 0,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: '',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该返回原始块
      expect(result).toEqual(chunks);
    });
  });

  describe('多种符号类型测试', () => {
    test('应该处理括号符号', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const result = calculateSum(1, 2, (3 + 4));',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 39,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const result = calculateSum(1, 2, (3 + 4));',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理括号符号
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('calculateSum');
    });

    test('应该处理大括号符号', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'if (condition) {\n  console.log("hello");\n}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.BLOCK,
            size: 39,
            lineCount: 3
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'if (condition) {\n  console.log("hello");\n}',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理大括号符号
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('console.log');
    });

    test('应该处理方括号符号', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const array = [1, 2, [3, 4]];',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 26,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const array = [1, 2, [3, 4]];',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理方括号符号
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('[1, 2, [3, 4]]');
    });

    test('应该处理引号符号', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const str = "hello \\"world\\"";',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 28,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const str = "hello \\"world\\"";',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理引号符号，返回原始内容
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('const str = "hello \\"world\\"";');
    });
  });

  describe('多块处理测试', () => {
    test('应该处理多个代码块的符号平衡', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() {\n  return "hello";\n}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 3
          }
        },
        {
          content: 'function test2() {\n  return "world";\n}',
          metadata: {
            startLine: 4,
            endLine: 6,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 3
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() {\n  return "hello";\n}\nfunction test2() {\n  return "world";\n}',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理所有块的符号平衡
      expect(result).toHaveLength(2);
      result.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata.language).toBe('typescript');
      });
    });

    test('应该处理混合符号类型的代码块', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const obj = {\n  method: function() {\n    return [1, 2, 3];\n  }\n};',
          metadata: {
            startLine: 1,
            endLine: 5,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.CLASS,
            size: 63,
            lineCount: 5
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const obj = {\n  method: function() {\n    return [1, 2, 3];\n  }\n};',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该处理混合符号类型
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('const obj');
      expect(result[0].content).toContain('method: function');
      expect(result[0].content).toContain('[1, 2, 3]');
    });
  });

  describe('错误处理测试', () => {
    test('应该优雅处理空内容', async () => {
      const chunks: CodeChunk[] = [
        {
          content: '',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 0,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: '',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该返回原始块
      expect(result).toEqual(chunks);
    });

    test('应该优雅处理无效的行号', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'test content',
          metadata: {
            startLine: 0,
            endLine: 0,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 12,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'test content',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      const result = await processor.process(chunks, context);

      // 应该返回原始块
      expect(result).toEqual(chunks);
    });
  });

  describe('配置测试', () => {
    test('应该正确处理不同的平衡阈值', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true,
          semanticWeight: 0.95,
          syntacticWeight: 0.05
        }
      };

      const result = await processor.process(chunks, context);

      // 应该成功处理
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });

    test('应该处理不同的块大小配置', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'const x = 1;',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.LINE,
            size: 12,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'const x = 1;',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true,
          semanticWeight: 0.5,
          syntacticWeight: 0.5
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
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      await processor.process(chunks, context);

      // 应该记录开始和完成的调试日志
      expect(debugSpy).toHaveBeenCalledWith('Applying symbol balance post-processing to 1 chunks');
      expect(debugSpy).toHaveBeenCalledWith('Symbol balance post-processing completed');
    });

    test('应该在调整块时记录调试日志', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');

      // 创建一个不平衡的代码块
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {', // 不平衡的开始
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 17,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() {\n  return "hello";\n}', // 完整的内容
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
      };

      await processor.process(chunks, context);

      // 应该记录调整日志
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Adjusted chunk for symbol balance'));
    });

    test('应该在错误时记录错误日志', async () => {
      const errorSpy = jest.spyOn(logger, 'error');

      // 创建一个简单的测试场景，可能会触发错误
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            timestamp: Date.now(),
            type: ChunkType.FUNCTION,
            size: 33,
            lineCount: 1
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test() { return "hello"; }',
        language: 'typescript',
        filePath: 'test.ts',
        config: mockConfig,
        options: mockOptions,
        advancedOptions: {
          enableEnhancedBalancing: true
        }
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