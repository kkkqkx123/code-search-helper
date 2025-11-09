import { injectable } from 'inversify';
import { CodeChunk } from '../../../types/CodeChunk';
import { IChunkSimilarityCalculator } from '../types/ChunkFilterTypes';
import { SimilarityUtils } from '../../../../../similarity/utils/SimilarityUtils';

/**
 * 块相似性计算器
 * 复用现有的 SimilarityUtils 模块
 */
@injectable()
export class ChunkSimilarityCalculator implements IChunkSimilarityCalculator {

  /**
   * 计算两个块的相似性
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   * @returns 相似性分数 (0-1)
   */
  async calculateSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): Promise<number> {
    // 基于类型相似性
    const typeSimilarity = chunk1.metadata.type === chunk2.metadata.type ? 0.3 : 0;

    // 基于语言相似性
    const languageSimilarity = chunk1.metadata.language === chunk2.metadata.language ? 0.2 : 0;

    // 基于内容相似性（使用 SimilarityUtils 的更准确算法）
    const contentSimilarity = await SimilarityUtils.calculateSimilarity(chunk1.content, chunk2.content);

    // 组合相似性，内容相似性权重更高
    return typeSimilarity + languageSimilarity + (contentSimilarity * 0.5);
  }

  /**
   * 计算内容相似性
   * @param content1 第一个内容
   * @param content2 第二个内容
   * @returns 相似性分数 (0-1)
   */
  async calculateContentSimilarity(content1: string, content2: string): Promise<number> {
    // 直接使用 SimilarityUtils 的实现
    return await SimilarityUtils.calculateSimilarity(content1, content2);
  }
}