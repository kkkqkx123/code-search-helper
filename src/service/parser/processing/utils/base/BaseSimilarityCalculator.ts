import { ContentHashIDGenerator } from '../ContentHashIDGenerator';

/**
 * 相似度计算基类
 * 提供统一的相似度计算公共方法
 */
export abstract class BaseSimilarityCalculator {
  protected static readonly DEFAULT_THRESHOLD = 0.8;
  protected static readonly MIN_CONTENT_LENGTH = 10;

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
    const normalized1 = this.normalizeContent(content1);
    const normalized2 = this.normalizeContent(content2);

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
   * 标准化内容（用于相似度计算）
   */
  static normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // 标准化空白字符
      .replace(/\/\/.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .replace(/\s+/g, ' ') // 再次标准化空白字符
      .trim()
      .toLowerCase();
  }

  /**
   * 计算内容哈希
   */
  static calculateContentHash(content: string): string {
    // 简单的哈希函数，用于快速比较
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
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