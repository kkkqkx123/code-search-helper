import { CodeChunk, EnhancedChunkingOptions } from '../types/splitting-types';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { ChunkOptimizer } from '../utils/chunk-processing/ChunkOptimizer';
import { DEFAULT_ENHANCED_CHUNKING_OPTIONS } from '../types/splitting-types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 边界优化后处理器
 * 集成ChunkOptimizer的边界优化算法
 */
export class BoundaryOptimizationPostProcessor implements IChunkPostProcessor {
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  getName(): string {
    return 'boundary-optimization-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 只有启用边界优化且有代码块时才应用
    return chunks.length > 0 && context.options.enableBoundaryOptimization === true;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    this.logger?.debug(`Starting boundary optimization for ${chunks.length} chunks`);

    try {
      // 确保传递给ChunkOptimizer的options是完整类型
      const completeOptions: Required<EnhancedChunkingOptions> = {
        ...DEFAULT_ENHANCED_CHUNKING_OPTIONS,
        ...context.options
      };

      const optimizer = new ChunkOptimizer(completeOptions);
      const optimizedChunks = await optimizer.optimize(chunks, context.originalContent);

      this.logger?.debug(`Boundary optimization completed: ${chunks.length} -> ${optimizedChunks.length} chunks`);
      
      return optimizedChunks;
    } catch (error) {
      this.logger?.error('Error during boundary optimization:', error);
      // 如果优化失败，返回原始块
      return chunks;
    }
  }
}