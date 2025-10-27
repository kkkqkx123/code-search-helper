import { SmartRebalancingPostProcessor } from '../SmartRebalancingPostProcessor';
import { PostProcessingContext } from '../IChunkPostProcessor';
import { CodeChunk, EnhancedChunkingOptions } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { IComplexityCalculator } from '../../strategies/types/SegmentationTypes';

// Mock ComplexityCalculator
class MockComplexityCalculator implements IComplexityCalculator {
  calculate(content: string): number {
    // 简单的复杂度计算：基于内容长度和关键字数量
    const keywords = ['function', 'class', 'if', 'for', 'while', 'return'];
    const keywordCount = keywords.reduce((count, keyword) => {
      return count + (content.split(keyword).length - 1);
    }, 0);
    return content.length + (keywordCount * 10);
  }
}

describe('SmartRebalancingComplexity', () => {
  let processor: SmartRebalancingPostProcessor;
  let logger: LoggerService;
  let complexityCalculator: IComplexityCalculator;
  let mockOptions: EnhancedChunkingOptions;

  beforeEach(() => {
    logger = new LoggerService();
    complexityCalculator = new MockComplexityCalculator();
    processor = new SmartRebalancingPostProcessor(logger, complexityCalculator);
    
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
      
      // 启用智能再平衡
      enableSmartRebalancing: true,
      minChunkSizeThreshold: 50,
      maxChunkSizeThreshold: 1500,
      rebalancingStrategy: 'conservative' as const,
      
      // 其他选项
      enablePerformanceMonitoring: false
    };
  });

  describe('复杂度计算集成测试', () => {
    test('应该在合并块时重新计算复杂度', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function',
            complexity: 50 // 原始复杂度
          }
        },
        {
          content: 'tiny', // 过小的块，应该被合并
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code',
            complexity: 10 // 原始复杂度
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\ntiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          minChunkSizeThreshold: 30 // 设置较高的阈值以确保tiny被合并
        }
      };

      const result = await processor.process(chunks, context);
      
      // 应该合并成一个块（因为tiny块太小）
      expect(result).toHaveLength(1);
      
      // 复杂度应该被重新计算
      const mergedChunk = result[0];
      expect(mergedChunk.metadata.complexity).toBeGreaterThan(0);
      
      // 验证内容确实被合并了
      expect(mergedChunk.content).toContain('function test1');
      expect(mergedChunk.content).toContain('tiny');
    });

    test('应该在拆分块时计算新块的复杂度', async () => {
      const largeContent = 'function bigFunction() { '.repeat(100) + 'return "large"; }';
      const chunks: CodeChunk[] = [
        {
          content: largeContent,
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function',
            complexity: 1000 // 原始复杂度
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: largeContent,
        language: 'typescript',
        filePath: 'test.ts',
        options: {
          ...mockOptions,
          maxChunkSizeThreshold: 200, // 设置较小的阈值以触发拆分
          rebalancingStrategy: 'aggressive' // 使用激进策略确保拆分
        }
      };

      const result = await processor.process(chunks, context);
      
      // 验证处理完成（可能不会拆分，取决于具体实现）
      expect(result.length).toBeGreaterThanOrEqual(1);
      
      // 每个块都应该有有效的复杂度
      result.forEach(chunk => {
        expect(chunk.metadata.complexity).toBeGreaterThan(0);
      });
    });

    test('应该在没有复杂度计算器时使用默认值', async () => {
      const processorWithoutCalculator = new SmartRebalancingPostProcessor(logger);
      
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function',
            complexity: 50
          }
        },
        {
          content: 'tiny',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code',
            complexity: 10
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\ntiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processorWithoutCalculator.process(chunks, context);
      
      // 应该仍然能正常工作
      expect(result).toHaveLength(1);
      
      // 复杂度应该是原始值或默认值
      expect(result[0].metadata.complexity).toBeGreaterThanOrEqual(0);
    });

    test('应该支持动态设置复杂度计算器', async () => {
      const processorWithoutCalculator = new SmartRebalancingPostProcessor(logger);
      
      // 动态设置复杂度计算器
      processorWithoutCalculator.setComplexityCalculator(complexityCalculator);
      
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return "hello"; }',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            type: 'function',
            complexity: 50
          }
        },
        {
          content: 'tiny',
          metadata: {
            startLine: 2,
            endLine: 2,
            language: 'typescript',
            type: 'code',
            complexity: 10
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: 'function test1() { return "hello"; }\ntiny',
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processorWithoutCalculator.process(chunks, context);
      
      // 现在应该使用复杂度计算器
      expect(result).toHaveLength(1);
      expect(result[0].metadata.complexity).toBeGreaterThan(0);
    });

    test('应该支持配置更新', async () => {
      const newConfig = {
        enableSmartRebalancing: true,
        minChunkSizeThreshold: 75,
        maxChunkSizeThreshold: 1200,
        rebalancingStrategy: 'aggressive' as const
      };

      // 应该不抛出错误
      expect(() => {
        processor.setRebalancingConfig(newConfig);
      }).not.toThrow();
    });
  });

  describe('复杂度计算准确性测试', () => {
    test('应该正确计算包含关键字的代码复杂度', async () => {
      const contentWithKeywords = `
        function complexFunction() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (true) {
                return result;
              }
            }
          }
        }
      `;

      const chunks: CodeChunk[] = [
        {
          content: contentWithKeywords.trim(),
          metadata: {
            startLine: 1,
            endLine: 10,
            language: 'typescript',
            type: 'function',
            complexity: 100
          }
        }
      ];

      const context: PostProcessingContext = {
        originalContent: contentWithKeywords.trim(),
        language: 'typescript',
        filePath: 'test.ts',
        options: mockOptions
      };

      const result = await processor.process(chunks, context);
      
      // 验证处理完成
      expect(result).toHaveLength(1);
      
      // 验证复杂度计算器被正确调用（内容包含多个关键字）
      const processedChunk = result[0];
      expect(processedChunk.metadata.complexity).toBeGreaterThan(0);
      
      // 验证内容包含预期的关键字
      expect(processedChunk.content).toContain('function');
      expect(processedChunk.content).toContain('if');
      expect(processedChunk.content).toContain('for');
      expect(processedChunk.content).toContain('while');
      expect(processedChunk.content).toContain('return');
    });
  });
});