import { injectable, inject } from 'inversify';
import { CodeChunk } from '../../../types/CodeChunk';
import { PostProcessingContext } from '../../../../post-processing/IChunkPostProcessor';
import { IChunkMerger, IChunkSimilarityCalculator } from '../types/ChunkFilterTypes';
import { TYPES } from '../../../../../../types';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { CodeChunkBuilder } from '../../../types/CodeChunk';
import { ChunkSimilarityCalculator } from './ChunkSimilarityCalculator';

/**
 * 块合并器
 * 从原 ChunkFilter 中提取的合并逻辑
 */
@injectable()
export class ChunkMerger implements IChunkMerger {
  private similarityCalculator: IChunkSimilarityCalculator;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.similarityCalculator = new ChunkSimilarityCalculator();
    this.logger = logger;
  }

  /**
   * 智能合并块
   * @param chunks 块数组
   * @param context 上下文
   * @returns 合并后的块数组
   */
  async intelligentMerge(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    const mergedChunks: CodeChunk[] = [];
    let currentGroup: CodeChunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const lastChunk = currentGroup[currentGroup.length - 1];

      // 计算相似性
      const similarity = await this.similarityCalculator.calculateSimilarity(lastChunk, currentChunk);
      const combinedSize = this.calculateGroupSize(currentGroup) + currentChunk.content.length;

      // 如果相似性高且合并后大小不超过限制，则合并
      if (similarity > 0.6 && combinedSize < (context.options.maxChunkSize || 1000)) {
        currentGroup.push(currentChunk);
      } else {
        // 完成当前组，开始新组
        mergedChunks.push(this.mergeChunkGroup(currentGroup));
        currentGroup = [currentChunk];
      }
    }

    // 处理最后一组
    if (currentGroup.length > 0) {
      mergedChunks.push(this.mergeChunkGroup(currentGroup));
    }

    this.logger?.debug(`Intelligently merged ${chunks.length} chunks into ${mergedChunks.length} groups`);
    return mergedChunks;
  }

  /**
   * 合并块组
   * @param group 块组
   * @returns 合并后的块
   */
  mergeChunkGroup(group: CodeChunk[]): CodeChunk {
    if (group.length === 1) {
      return group[0];
    }

    const firstChunk = group[0];
    const lastChunk = group[group.length - 1];

    return new CodeChunkBuilder()
      .setContent(group.map(chunk => chunk.content).join('\n\n'))
      .setStartLine(firstChunk.metadata.startLine)
      .setEndLine(lastChunk.metadata.endLine)
      .setLanguage(firstChunk.metadata.language)
      .setFilePath(firstChunk.metadata.filePath || '')
      .setStrategy(firstChunk.metadata.strategy)
      .setType(firstChunk.metadata.type)
      .addMetadata('mergedFrom', group)
      .addMetadata('complexity', group.reduce((sum, chunk) => sum + (chunk.metadata.complexity || 0), 0))
      .build();
  }

  /**
   * 判断是否应该合并
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   * @param context 上下文
   * @returns 是否应该合并
   */
  async shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk, context: PostProcessingContext): Promise<boolean> {
    const similarity = await this.similarityCalculator.calculateSimilarity(chunk1, chunk2);
    const combinedSize = chunk1.content.length + chunk2.content.length;
    const maxSize = context.options.maxChunkSize || 1000;

    return similarity > 0.6 && combinedSize < maxSize;
  }

  /**
   * 计算组的大小
   * @param group 块组
   * @returns 总大小
   */
  private calculateGroupSize(group: CodeChunk[]): number {
    return group.reduce((total, chunk) => total + chunk.content.length, 0);
  }
}