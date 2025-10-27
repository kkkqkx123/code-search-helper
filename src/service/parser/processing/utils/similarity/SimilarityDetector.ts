import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { SimilarityUtils } from './SimilarityUtils';

/**
 * 相似度检测器 - 计算代码片段之间的相似度
 * 用于识别和去重相似的代码块
 */
export class SimilarityDetector {
  /**
   * 从代码块列表中过滤掉相似的块
   */
  static filterSimilarChunks<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold: number = SimilarityUtils.getRecommendedThreshold()
  ): T[] {
    const filtered: T[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(chunks[i].id || String(i))) {
        continue;
      }

      const currentChunk = chunks[i];
      const similarGroup: T[] = [currentChunk];
      processed.add(currentChunk.id || String(i));

      // 查找相似的块
      for (let j = i + 1; j < chunks.length; j++) {
        if (processed.has(chunks[j].id || String(j))) {
          continue;
        }

        if (SimilarityUtils.isSimilar(currentChunk.content, chunks[j].content, threshold)) {
          similarGroup.push(chunks[j]);
          processed.add(chunks[j].id || String(j));
        }
      }

      // 选择最佳的代表块（通常选择最完整的那个）
      const bestChunk = this.selectBestChunk(similarGroup);
      filtered.push(bestChunk);
    }

    return filtered;
  }

  /**
   * 从相似块组中选择最佳的代表块
   */
  private static selectBestChunk<T extends { content: string }>(chunks: T[]): T {
    if (chunks.length === 1) {
      return chunks[0];
    }

    // 选择内容最完整的块（通常是最长的那个）
    // 也可以根据其他标准，如包含更多上下文、更好的边界等
    return chunks.reduce((best, current) => {
      return current.content.length > best.content.length ? current : best;
    });
  }

  /**
   * 计算代码块的相似度矩阵
   */
  static calculateSimilarityMatrix(contents: string[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < contents.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < contents.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (i > j) {
          matrix[i][j] = matrix[j][i]; // 对称矩阵
        } else {
          matrix[i][j] = SimilarityUtils.calculateSimilarity(contents[i], contents[j]);
        }
      }
    }

    return matrix;
  }

  /**
   * 查找相似块组
   */
  static findSimilarityGroups<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold: number = SimilarityUtils.getRecommendedThreshold()
  ): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    const processed = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = chunks[i].id || String(i);
      
      if (processed.has(chunkId)) {
        continue;
      }

      const currentChunk = chunks[i];
      const group: T[] = [currentChunk];
      processed.add(chunkId);

      // 查找相似的块
      for (let j = 0; j < chunks.length; j++) {
        if (i === j) continue;
        
        const otherChunkId = chunks[j].id || String(j);
        if (processed.has(otherChunkId)) {
          continue;
        }

        if (SimilarityUtils.isSimilar(currentChunk.content, chunks[j].content, threshold)) {
          group.push(chunks[j]);
          processed.add(otherChunkId);
        }
      }

      // 使用第一个块的ID作为组的标识
      if (group.length > 1) {
        groups.set(chunkId, group);
      }
    }

    return groups;
  }
}

/**
 * 相似度检测结果
 */
export interface SimilarityResult {
  similarity: number;
  isSimilar: boolean;
  threshold: number;
  contentLength1: number;
  contentLength2: number;
}

/**
 * 相似块组信息
 */
export interface SimilarityGroup<T> {
  groupId: string;
  chunks: T[];
  representative: T;
  similarityScore: number;
}