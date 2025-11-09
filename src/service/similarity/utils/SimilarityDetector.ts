import { injectable, inject } from 'inversify';
import {
  SimilarityOptions,
  ISimilarityService,
  SimilarityError,
  SimilarityResult
} from '../types/SimilarityTypes';

/**
 * 相似度检测器（重构为全异步）
 * 计算代码片段之间的相似度，用于识别和去重相似的代码块
 */
@injectable()
export class SimilarityDetector {
  private static similarityService?: ISimilarityService;

  /**
   * 注入服务实例（在应用启动时调用）
   */
  static setService(service: ISimilarityService): void {
    this.similarityService = service;
  }

  /**
   * 获取服务实例
   */
  private static getService(): ISimilarityService {
    if (!this.similarityService) {
      throw new SimilarityError(
        'SimilarityService not initialized. Call setService() first.',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.similarityService;
  }

  /**
   * 从代码块列表中过滤掉相似的块
   */
  static async filterSimilarChunks<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<T[]> {
    return await this.getService().filterSimilarItems(chunks, threshold, options);
  }

  /**
   * 从相似块组中选择最佳的代表块
   */
  private static async selectBestChunk<T extends { content: string }>(
    chunks: T[],
    options?: SimilarityOptions
  ): Promise<T> {
    if (chunks.length === 1) {
      return chunks[0];
    }

    // 多种选择策略
    const strategies = [
      // 1. 选择内容最完整的块（通常是最长的那个）
      async (items: T[]) => {
        return items.reduce((best, current) =>
          current.content.length > best.content.length ? current : best
        );
      },

      // 2. 选择与其他块平均相似度最高的块
      async (items: T[]) => {
        if (items.length === 1) return items[0];

        let bestChunk = items[0];
        let bestAvgSimilarity = 0;

        for (const chunk of items) {
          let totalSimilarity = 0;
          let comparisons = 0;

          for (const otherChunk of items) {
            if (chunk === otherChunk) continue;

            const similarity = await this.getService().calculateSimilarity(
              chunk.content,
              otherChunk.content,
              options
            );
            totalSimilarity += similarity.similarity;
            comparisons++;
          }

          const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
          if (avgSimilarity > bestAvgSimilarity) {
            bestAvgSimilarity = avgSimilarity;
            bestChunk = chunk;
          }
        }

        return bestChunk;
      },

      // 3. 选择包含最多唯一关键词的块
      async (items: T[]) => {
        let bestChunk = items[0];
        let maxUniqueKeywords = 0;

        for (const chunk of items) {
          const keywords = this.extractKeywords(chunk.content);
          const uniqueKeywords = new Set(keywords).size;

          if (uniqueKeywords > maxUniqueKeywords) {
            maxUniqueKeywords = uniqueKeywords;
            bestChunk = chunk;
          }
        }

        return bestChunk;
      }
    ];

    // 使用第一种策略作为默认选择
    return await strategies[0](chunks);
  }

  /**
   * 计算代码块的相似度矩阵
   */
  static async calculateSimilarityMatrix(
    contents: string[],
    options?: SimilarityOptions
  ): Promise<number[][]> {
    const result = await this.getService().calculateBatchSimilarity(contents, options);
    return result.matrix;
  }

  /**
   * 查找相似块组
   */
  static async findSimilarityGroups<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<Map<string, T[]>> {
    return await this.getService().findSimilarityGroups(chunks, threshold, options);
  }

  /**
   * 查找详细的相似块组（包含代表块和相似度分数）
   */
  static async findDetailedSimilarityGroups<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<SimilarityGroup<T>[]> {
    const groups = await this.findSimilarityGroups(chunks, threshold, options);
    const detailedGroups: SimilarityGroup<T>[] = [];

    for (const [groupId, groupChunks] of groups) {
      // 选择代表块
      const representative = await this.selectBestChunk(groupChunks, options);

      // 计算组内平均相似度
      let totalSimilarity = 0;
      let comparisons = 0;

      for (let i = 0; i < groupChunks.length; i++) {
        for (let j = i + 1; j < groupChunks.length; j++) {
          const similarity = await this.getService().calculateSimilarity(
            groupChunks[i].content,
            groupChunks[j].content,
            options
          );
          totalSimilarity += similarity.similarity;
          comparisons++;
        }
      }

      const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;

      detailedGroups.push({
        groupId,
        chunks: groupChunks,
        representative,
        similarityScore: avgSimilarity
      });
    }

    return detailedGroups;
  }

  /**
   * 检测重复块
   */
  static async detectDuplicates<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold: number = 0.9,
    options?: SimilarityOptions
  ): Promise<{
    duplicates: Map<string, T[]>; // 重复块组
    uniques: T[]; // 唯一块
  }> {
    const groups = await this.findSimilarityGroups(chunks, threshold, options);
    const duplicates = new Map<string, T[]>();
    const uniques: T[] = [];
    const processed = new Set<string>();

    // 处理每个块
    for (const chunk of chunks) {
      const chunkId = chunk.id || JSON.stringify(chunk);

      if (processed.has(chunkId)) {
        continue;
      }

      // 查找这个块所属的组
      let foundGroup = false;
      for (const [groupId, groupChunks] of groups) {
        if (groupChunks.includes(chunk)) {
          if (groupChunks.length > 1) {
            duplicates.set(groupId, groupChunks);
          } else {
            uniques.push(chunk);
          }

          // 标记所有组内块为已处理
          groupChunks.forEach(c => {
            const id = c.id || JSON.stringify(c);
            processed.add(id);
          });

          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        uniques.push(chunk);
        processed.add(chunkId);
      }
    }

    return { duplicates, uniques };
  }

  /**
   * 计算两个内容的详细相似度分析
   */
  static async analyzeSimilarity(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<SimilarityResult & {
    details: {
      contentLength1: number;
      contentLength2: number;
      lengthDifference: number;
      lengthRatio: number;
      keywordOverlap: number;
      estimatedComplexity: {
        content1: number;
        content2: number;
      };
    };
  }> {
    const result = await this.getService().calculateSimilarity(content1, content2, options);

    // 计算额外的分析信息
    const contentLength1 = content1.length;
    const contentLength2 = content2.length;
    const lengthDifference = Math.abs(contentLength1 - contentLength2);
    const lengthRatio = Math.min(contentLength1, contentLength2) / Math.max(contentLength1, contentLength2);

    // 计算关键词重叠度
    const keywords1 = this.extractKeywords(content1);
    const keywords2 = this.extractKeywords(content2);
    const intersection = keywords1.filter(k => keywords2.includes(k));
    const union = [...new Set([...keywords1, ...keywords2])];
    const keywordOverlap = union.length > 0 ? intersection.length / union.length : 0;

    // 估算复杂度
    const estimatedComplexity = {
      content1: this.estimateComplexity(content1),
      content2: this.estimateComplexity(content2)
    };

    return {
      ...result,
      details: {
        contentLength1,
        contentLength2,
        lengthDifference,
        lengthRatio,
        keywordOverlap,
        estimatedComplexity,
        ...result.details
      }
    };
  }

  /**
   * 提取关键词
   */
  private static extractKeywords(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  /**
   * 检查是否为停用词
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
      'why', 'how', 'not', 'no', 'yes'
    ]);

    return stopWords.has(word);
  }

  /**
   * 估算内容复杂度
   */
  private static estimateComplexity(content: string): number {
    // 简单的复杂度估算：基于唯一字符、行数、关键词数量等
    const uniqueChars = new Set(content).size;
    const lines = content.split('\n').length;
    const keywords = this.extractKeywords(content).length;

    // 归一化复杂度分数
    return Math.min(1, (uniqueChars * 0.3 + lines * 0.4 + keywords * 0.3) / 1000);
  }

  /**
   * 清理资源
   */
  static cleanup(): void {
    this.similarityService = undefined;
  }
}

/**
 * 相似度检测结果（保持向后兼容）
 */


/**
 * 相似块组信息（保持向后兼容）
 */
export interface SimilarityGroup<T> {
  groupId: string;
  chunks: T[];
  representative: T;
  similarityScore: number;
}