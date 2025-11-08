import { CodeChunk } from '../types/CodeChunk';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../strategies/types/SegmentationTypes';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { ChunkMerger } from '../utils/chunk-processing/ChunkMerger';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 高级合并后处理器
 * 集成ChunkMerger的智能合并决策逻辑
 */
export class MergingPostProcessor implements IChunkPostProcessor {
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  getName(): string {
    return 'advanced-merging-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 只有多个代码块时才需要合并处理
    return chunks.length > 1 && context.advancedOptions?.enableAdvancedMerging === true;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    this.logger?.debug(`Starting advanced merging for ${chunks.length} chunks`);

    // 检查是否应该应用合并处理
    if (!this.shouldApply(chunks, context)) {
      this.logger?.debug('Advanced merging is disabled or not applicable, returning original chunks');
      return chunks;
    }

    try {
      // 确保传递给ChunkMerger的options是完整类型
      const completeOptions: ChunkingOptions = {
        ...DEFAULT_CHUNKING_OPTIONS,
        ...context.options
      };

      const merger = new ChunkMerger(completeOptions);
      const mergedChunks = await merger.mergeOverlappingChunks(chunks);

      this.logger?.debug(`Advanced merging completed: ${chunks.length} -> ${mergedChunks.length} chunks`);

      return mergedChunks;
    } catch (error) {
      this.logger?.error('Error during advanced merging:', error);
      // 如果合并失败，返回原始块
      return chunks;
    }
  }
}