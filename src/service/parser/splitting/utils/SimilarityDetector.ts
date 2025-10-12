import { ContentHashIDGenerator } from './ContentHashIDGenerator';

/**
 * 相似度检测器 - 计算代码片段之间的相似度
 * 用于识别和去重相似的代码块
 */
export class SimilarityDetector {
  private static readonly DEFAULT_THRESHOLD = 0.8; // 默认相似度阈值
  private static readonly MIN_CONTENT_LENGTH = 10; // 最小内容长度，避免过短的片段

  /**
   * 计算两个代码片段的相似度（0-1之间）
   */
  static calculateSimilarity(content1: string, content2: string): number {
    // 快速预检查：如果内容完全相同
    if (content1 === content2) {
      return 1.0;
    }

    // 快速预检查：基于内容哈希
    if (ContentHashIDGenerator.isPotentiallySimilar(content1, content2)) {
      return 1.0;
    }

    // 标准化内容
    const normalized1 = ContentHashIDGenerator['normalizeContent'](content1);
    const normalized2 = ContentHashIDGenerator['normalizeContent'](content2);

    // 如果标准化后内容相同
    if (normalized1 === normalized2) {
      return 1.0;
    }

    // 检查最小长度
    if (normalized1.length < this.MIN_CONTENT_LENGTH || normalized2.length < this.MIN_CONTENT_LENGTH) {
      return normalized1 === normalized2 ? 1.0 : 0.0;
    }

    // 使用编辑距离算法计算相似度
    return this.calculateLevenshteinSimilarity(normalized1, normalized2);
  }

  /**
   * 使用Levenshtein距离计算相似度
   */
  private static calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) {
      return 1.0;
    }

    return 1.0 - (distance / maxLength);
  }

  /**
   * Levenshtein距离算法实现
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 检查两个代码片段是否相似（基于阈值）
   */
  static isSimilar(content1: string, content2: string, threshold: number = this.DEFAULT_THRESHOLD): boolean {
    const similarity = this.calculateSimilarity(content1, content2);
    return similarity >= threshold;
  }

  /**
   * 从代码块列表中过滤掉相似的块
   */
  static filterSimilarChunks<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold: number = this.DEFAULT_THRESHOLD
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

        if (this.isSimilar(currentChunk.content, chunks[j].content, threshold)) {
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
          matrix[i][j] = this.calculateSimilarity(contents[i], contents[j]);
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
    threshold: number = this.DEFAULT_THRESHOLD
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

        if (this.isSimilar(currentChunk.content, chunks[j].content, threshold)) {
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

  /**
   * 获取推荐的相似度阈值
   */
  static getRecommendedThreshold(contentType: 'function' | 'class' | 'generic' = 'generic'): number {
    switch (contentType) {
      case 'function':
        return 0.85; // 函数通常更相似
      case 'class':
        return 0.8;  // 类定义相似度适中
      case 'generic':
      default:
        return this.DEFAULT_THRESHOLD;
    }
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