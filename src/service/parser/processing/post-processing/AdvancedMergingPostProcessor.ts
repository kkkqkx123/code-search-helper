import { CodeChunk, EnhancedChunkingOptions } from '../types/splitting-types';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { ChunkMerger } from '../utils/chunk-processing/ChunkMerger';
import { DEFAULT_ENHANCED_CHUNKING_OPTIONS } from '../types/splitting-types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 高级合并后处理器
 * 集成ChunkMerger的智能合并决策逻辑
 */
export class AdvancedMergingPostProcessor implements IChunkPostProcessor {
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  getName(): string {
    return 'advanced-merging-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 只有多个代码块时才需要合并处理
    return chunks.length > 1 && context.options.enableAdvancedMerging === true;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    this.logger?.debug(`Starting advanced merging for ${chunks.length} chunks`);

    try {
      // 确保传递给ChunkMerger的options是完整类型
      const completeOptions: Required<EnhancedChunkingOptions> = {
        ...DEFAULT_ENHANCED_CHUNKING_OPTIONS,
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