import { injectable } from 'inversify';
import { BaseSimilarityStrategy } from './BaseSimilarityStrategy';
import { SimilarityOptions, SimilarityStrategyType } from '../types/SimilarityTypes';

/**
 * Levenshtein距离相似度策略
 * 基于编辑距离计算文本相似度
 */
@injectable()
export class LevenshteinSimilarityStrategy extends BaseSimilarityStrategy {
  readonly name = 'Levenshtein Similarity';
  readonly type = 'levenshtein' as SimilarityStrategyType;

  async calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number> {
    // 验证输入
    this.validateInput(content1, content2, options);

    // 快速检查完全相同
    if (await this.isIdentical(content1, content2)) {
      return 1.0;
    }

    // 预处理内容
    const normalized1 = await this.preprocessContent(content1, options);
    const normalized2 = await this.preprocessContent(content2, options);

    // 再次检查预处理后是否相同
    if (normalized1 === normalized2) {
      return 1.0;
    }

    // 计算Levenshtein距离
    const distance = this.calculateLevenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    if (maxLength === 0) {
      return 1.0;
    }

    const similarity = 1.0 - (distance / maxLength);
    return this.normalizeScore(similarity);
  }

  /**
   * 计算Levenshtein距离
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
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
   * 获取默认阈值 - Levenshtein策略使用较高的阈值
   */
  getDefaultThreshold(): number {
    return 0.85;
  }

  /**
   * 检查是否支持指定的内容类型
   */
  isSupported(contentType: string, language?: string): boolean {
    // Levenshtein策略适用于所有文本类型
    return true;
  }
}