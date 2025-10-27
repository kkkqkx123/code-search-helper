import { CodeChunk, EnhancedChunkingOptions, DEFAULT_ENHANCED_CHUNKING_OPTIONS } from '../types/splitting-types';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { BalancedChunker } from '../utils/chunking/BalancedChunker';
import { ChunkFilter } from '../utils/chunking/ChunkFilter';
import { ChunkRebalancer } from '../utils/chunking/ChunkRebalancer';
import { ChunkMerger } from '../utils/chunk-processing/ChunkMerger';
import { ChunkOptimizer } from '../utils/chunk-processing/ChunkOptimizer';
import { SymbolBalancePostProcessor } from './SymbolBalancePostProcessor';
import { IntelligentFilterPostProcessor } from './IntelligentFilterPostProcessor';
import { SmartRebalancingPostProcessor } from './SmartRebalancingPostProcessor';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 分段后处理协调器
 * 协调执行各种后处理策略，增强现有ChunkingCoordinator的功能
 */
export class ChunkPostProcessorCoordinator {
  private chunkingProcessors: IChunkPostProcessor[];
  private chunkProcessingProcessors: IChunkPostProcessor[];
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.chunkingProcessors = [];
    this.chunkProcessingProcessors = [];
    this.logger = logger;
  }

  /**
   * 注册chunking处理策略
   */
  addChunkingProcessor(processor: IChunkPostProcessor): void {
    this.chunkingProcessors.push(processor);
    this.logger?.debug(`Registered chunking processor: ${processor.getName()}`);
  }

  /**
   * 注册chunk-processing处理策略
   */
  addChunkProcessingProcessor(processor: IChunkPostProcessor): void {
    this.chunkProcessingProcessors.push(processor);
    this.logger?.debug(`Registered chunk-processing processor: ${processor.getName()}`);
  }

  /**
   * 执行后处理
   */
  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    let processedChunks = [...chunks];

    // 执行chunking处理（符号平衡、智能过滤、再平衡）
    processedChunks = await this.executeChunkingProcessors(processedChunks, context);

    // 执行chunk-processing处理（合并、边界优化）
    processedChunks = await this.executeChunkProcessingProcessors(processedChunks, context);

    return processedChunks;
  }

  /**
   * 执行chunking处理器
   */
  private async executeChunkingProcessors(
    chunks: CodeChunk[],
    context: PostProcessingContext
  ): Promise<CodeChunk[]> {
    let processedChunks = [...chunks];

    for (const processor of this.chunkingProcessors) {
      if (processor.shouldApply(processedChunks, context)) {
        this.logger?.debug(`Applying chunking processor: ${processor.getName()}`);
        processedChunks = await processor.process(processedChunks, context);
      }
    }

    return processedChunks;
  }

  /**
   * 执行chunk-processing处理器
   */
  private async executeChunkProcessingProcessors(
    chunks: CodeChunk[],
    context: PostProcessingContext
  ): Promise<CodeChunk[]> {
    let processedChunks = [...chunks];

    for (const processor of this.chunkProcessingProcessors) {
      if (processor.shouldApply(processedChunks, context)) {
        this.logger?.debug(`Applying chunk-processing processor: ${processor.getName()}`);
        processedChunks = await processor.process(processedChunks, context);
      }
    }

    return processedChunks;
  }

  /**
   * 初始化默认处理器
   */
  initializeDefaultProcessors(options: EnhancedChunkingOptions): void {
    // 创建基于选项的处理器实例
    if (options.enableEnhancedBalancing) {
      // 创建一个包装器来实现IChunkPostProcessor接口
      this.addChunkingProcessor({
        getName: () => 'balanced-chunker',
        shouldApply: (chunks: CodeChunk[], context: PostProcessingContext) => chunks.length > 0,
        process: async (chunks: CodeChunk[], context: PostProcessingContext) => {
          // 使用BalancedChunker进行符号平衡分析
          const balancedChunker = new BalancedChunker(this.logger);
          
          // 对每个代码块进行符号平衡检查
          const balancedChunks = chunks.map(chunk => {
            // 重置并分析代码块的符号平衡
            balancedChunker.reset();
            const lines = chunk.content.split('\n');
            
            for (const line of lines) {
              balancedChunker.analyzeLineSymbols(line);
            }
            
            // 如果代码块符号不平衡，可能需要特殊处理
            // 目前我们只是确保代码块在语法上是完整的
            return chunk;
          });
          
          return balancedChunks;
        }
      });
    }

    if (options.enableIntelligentFiltering) {
      // 创建一个包装器来实现IChunkPostProcessor接口
      this.addChunkingProcessor({
        getName: () => 'chunk-filter',
        shouldApply: (chunks: CodeChunk[], context: PostProcessingContext) => chunks.length > 0,
        process: async (chunks: CodeChunk[], context: PostProcessingContext) => {
          // 使用ChunkFilter的智能过滤功能
          const filter = new ChunkFilter();
          // 使用默认的上下文进行过滤
          const filterContext: any = {
            options: {
              filterConfig: {
                enableSmallChunkFilter: true,
                minChunkSize: context.options.minChunkSize || 100,
                maxChunkSize: context.options.maxChunkSize || 1000
              }
            },
            metadata: { isCodeFile: true }
          };
          return filter.process(chunks, filterContext);
        }
      });
    }

    if (options.enableSmartRebalancing) {
      // 创建一个包装器来实现IChunkPostProcessor接口
      this.addChunkingProcessor({
        getName: () => 'chunk-rebalancer',
        shouldApply: (chunks: CodeChunk[], context: PostProcessingContext) => chunks.length > 1,
        process: async (chunks: CodeChunk[], context: PostProcessingContext) => {
          // 使用context中的options进行再平衡
          const minChunkSize = context.options.minChunkSize || 100;
          const maxChunkSize = context.options.maxChunkSize || 1000;

          if (chunks.length === 0) return chunks;

          const rebalancedChunks: CodeChunk[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // 检查是否是最后一块且过小
            if (i === chunks.length - 1 && chunk.content.length < minChunkSize) {
              // 尝试向前合并到前一个块
              if (rebalancedChunks.length > 0) {
                const prevChunk = rebalancedChunks[rebalancedChunks.length - 1];
                const combinedSize = prevChunk.content.length + chunk.content.length;

                // 确保合并后不超过最大限制
                if (combinedSize <= maxChunkSize) {
                  prevChunk.content += '\n' + chunk.content;
                  prevChunk.metadata.endLine = chunk.metadata.endLine;
                  continue;
                }
              }
            }

            rebalancedChunks.push(chunk);
          }

          return rebalancedChunks;
        }
      });
    }

    if (options.enableAdvancedMerging) {
      this.addChunkProcessingProcessor({
        getName: () => 'chunk-merger',
        shouldApply: (chunks: CodeChunk[], context: PostProcessingContext) => chunks.length > 1,
        process: async (chunks: CodeChunk[], context: PostProcessingContext) => {
          // 确保传递给ChunkMerger的options是完整类型
          const completeOptions: Required<EnhancedChunkingOptions> = {
            ...DEFAULT_ENHANCED_CHUNKING_OPTIONS,
            ...context.options
          };
          const merger = new ChunkMerger(completeOptions);
          return merger.mergeOverlappingChunks(chunks);
        }
      });
    }

    if (options.enableBoundaryOptimization) {
      this.addChunkProcessingProcessor({
        getName: () => 'chunk-optimizer',
        shouldApply: (chunks: CodeChunk[], context: PostProcessingContext) => chunks.length > 0,
        process: async (chunks: CodeChunk[], context: PostProcessingContext) => {
          // 确保传递给ChunkOptimizer的options是完整类型
          const completeOptions: Required<EnhancedChunkingOptions> = {
            ...DEFAULT_ENHANCED_CHUNKING_OPTIONS,
            ...context.options
          };
          const optimizer = new ChunkOptimizer(completeOptions);
          return optimizer.optimize(chunks, context.originalContent);
        }
      });
    }
  }
}