import { IChunkRebalancer, ChunkRebalancerContext, RebalancerResult } from '../strategies/types/SegmentationTypes';
import { CodeChunk } from '../types/splitting-types';
import { injectable } from 'inversify';

/**
 * 块重新平衡器实现
 * 用于调整代码块的大小分布，防止出现过小或过大的块
 */
@injectable()
export class ChunkRebalancer implements IChunkRebalancer {
  /**
   * 重新平衡块
   */
  async rebalance(context: ChunkRebalancerContext): Promise<RebalancerResult> {
    const { chunks, options } = context;
    
    if (!options.enableChunkRebalancing) {
      return {
        chunks: [...chunks],
        rebalanced: 0,
        metadata: {
          rebalanceReason: 'Chunk rebalancing is disabled',
          originalSize: chunks.length,
          rebalancedSize: chunks.length
        }
      };
    }

    // 创建块的副本以避免修改原始数据
    let rebalancedChunks = [...chunks];
    let rebalancedCount = 0;

    // 如果启用了小块过滤，处理过小的块
    if (options.enableSmallChunkFilter) {
      rebalancedChunks = this.handleSmallChunks(rebalancedChunks, options.minChunkSize || 100);
      rebalancedCount = rebalancedChunks.length - chunks.length;
    }

    return {
      chunks: rebalancedChunks,
      rebalanced: Math.abs(rebalancedCount),
      metadata: {
        rebalanceReason: 'Processed small chunks',
        originalSize: chunks.length,
        rebalancedSize: rebalancedChunks.length
      }
    };
  }

  /**
   * 检查是否应该应用此重新平衡器
   */
  shouldApply(chunks: CodeChunk[], context: ChunkRebalancerContext): boolean {
    // 当启用块重新平衡且有多个块时应用
    return context.options.enableChunkRebalancing === true && chunks.length > 1;
  }

  /**
   * 获取重新平衡器名称
   */
  getName(): string {
    return 'chunk-rebalancer';
  }

  /**
   * 处理过小的块
   */
  private handleSmallChunks(chunks: CodeChunk[], minChunkSize: number): CodeChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const result: CodeChunk[] = [];
    let i = 0;

    while (i < chunks.length) {
      let currentChunk = chunks[i];
      
      // 如果当前块太小，尝试与下一个块合并
      if (currentChunk.content.length < minChunkSize && i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        
        // 合并当前块和下一个块
        const mergedChunk: CodeChunk = {
          content: currentChunk.content + '\n' + nextChunk.content,
          metadata: {
            ...currentChunk.metadata,
            endLine: nextChunk.metadata.endLine,
            type: 'merged'
          }
        };

        result.push(mergedChunk);
        i += 2; // 跳过下一个块，因为它已经被合并
      } else {
        result.push(currentChunk);
        i++;
      }
    }

    return result;
  }
}