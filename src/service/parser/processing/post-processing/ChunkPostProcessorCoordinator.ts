import { CodeChunk, EnhancedChunkingOptions, DEFAULT_ENHANCED_CHUNKING_OPTIONS } from '../types/splitting-types';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { ChunkMerger } from '../utils/chunk-processing/ChunkMerger';
import { ChunkOptimizer } from '../utils/chunk-processing/ChunkOptimizer';
import { SymbolBalancePostProcessor } from './SymbolBalancePostProcessor';
import { IntelligentFilterPostProcessor } from './IntelligentFilterPostProcessor';
import { SmartRebalancingPostProcessor } from './SmartRebalancingPostProcessor';
import { AdvancedMergingPostProcessor } from './AdvancedMergingPostProcessor';
import { BoundaryOptimizationPostProcessor } from './BoundaryOptimizationPostProcessor';
import { OverlapPostProcessor } from './OverlapPostProcessor';
import { LoggerService } from '../../../../utils/LoggerService';
import { IComplexityCalculator } from '../strategies/types/SegmentationTypes';

/**
 * 分段后处理协调器
 * 协调执行各种后处理策略，增强现有ChunkingCoordinator的功能
 */
export class ChunkPostProcessorCoordinator {
  private chunkingProcessors: IChunkPostProcessor[];
  private chunkProcessingProcessors: IChunkPostProcessor[];
  private logger?: LoggerService;
  private complexityCalculator?: IComplexityCalculator;

  constructor(logger?: LoggerService, complexityCalculator?: IComplexityCalculator) {
    this.chunkingProcessors = [];
    this.chunkProcessingProcessors = [];
    this.logger = logger;
    this.complexityCalculator = complexityCalculator;
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
      // 使用专用的符号平衡处理器
      const symbolBalanceProcessor = new SymbolBalancePostProcessor(this.logger);
      this.addChunkingProcessor(symbolBalanceProcessor);
    }

    if (options.enableIntelligentFiltering) {
      // 使用专用的智能过滤处理器
      const intelligentFilterProcessor = new IntelligentFilterPostProcessor(this.logger);
      this.addChunkingProcessor(intelligentFilterProcessor);
    }

    if (options.enableSmartRebalancing) {
      // 使用专用的智能再平衡处理器
      const smartRebalancingProcessor = new SmartRebalancingPostProcessor(this.logger, this.complexityCalculator);
      this.addChunkingProcessor(smartRebalancingProcessor);
    }

    if (options.enableAdvancedMerging) {
      // 使用专用的高级合并处理器
      const advancedMergingProcessor = new AdvancedMergingPostProcessor(this.logger);
      this.addChunkProcessingProcessor(advancedMergingProcessor);
    }

    if (options.enableBoundaryOptimization) {
      // 使用专用的边界优化处理器
      const boundaryOptimizationProcessor = new BoundaryOptimizationPostProcessor(this.logger);
      this.addChunkProcessingProcessor(boundaryOptimizationProcessor);
    }

    if (options.enableOverlap) {
      // 使用专用的重叠处理器
      const overlapProcessor = new OverlapPostProcessor(this.logger);
      this.addChunkProcessingProcessor(overlapProcessor);
    }
  }
}