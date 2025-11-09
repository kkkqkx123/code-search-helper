import { injectable } from 'inversify';
import { IContentQualityEvaluator } from '../types/ChunkFilterTypes';

/**
 * 内容质量评估器
 * 从原 ChunkFilter 中提取的质量评估逻辑
 */
@injectable()
export class ContentQualityEvaluator implements IContentQualityEvaluator {
  
  /**
   * 计算内容质量分数
   * @param content 内容
   * @param language 编程语言
   * @returns 质量分数 (0-1)
   */
  calculateQuality(content: string, language?: string): number {
    let score = 0;
    const lines = content.split('\n');

    // 基础分数：基于行数
    score += Math.min(lines.length / 10, 0.3); // 最多0.3分

    // 代码结构分数
    if (language && language !== 'markdown') {
      // 函数/类定义
      const functionMatches = content.match(/\b(function|class|def|interface|struct)\b/g);
      if (functionMatches) {
        score += Math.min(functionMatches.length * 0.1, 0.2);
      }

      // 控制结构
      const controlMatches = content.match(/\b(if|else|while|for|switch|case|try|catch)\b/g);
      if (controlMatches) {
        score += Math.min(controlMatches.length * 0.05, 0.2);
      }

      // 变量声明
      const variableMatches = content.match(/\b(let|const|var|int|string|bool|float|double)\b/g);
      if (variableMatches) {
        score += Math.min(variableMatches.length * 0.03, 0.1);
      }
    } else {
      // Markdown特定评分
      const headers = content.match(/^#{1,6}\s+/gm);
      if (headers) {
        score += Math.min(headers.length * 0.1, 0.2);
      }

      const codeBlocks = content.match(/```[\s\S]*?```/g);
      if (codeBlocks) {
        score += Math.min(codeBlocks.length * 0.15, 0.3);
      }

      const lists = content.match(/^[-*+]\s+/gm);
      if (lists) {
        score += Math.min(lists.length * 0.05, 0.1);
      }
    }

    // 惩罚分数：过多的空行或注释
    const emptyLines = lines.filter(line => line.trim() === '').length;
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('#') ||
        trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--');
    }).length;

    const totalLines = lines.length;
    const emptyRatio = emptyLines / totalLines;
    const commentRatio = commentLines / totalLines;

    // 如果空行或注释比例过高，降低分数
    if (emptyRatio > 0.5) {
      score -= 0.2;
    }

    if (commentRatio > 0.8) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 判断是否为高质量内容
   * @param content 内容
   * @param language 编程语言
   * @param threshold 质量阈值
   * @returns 是否高质量
   */
  isHighQuality(content: string, language?: string, threshold: number = 0.1): boolean {
    const qualityScore = this.calculateQuality(content, language);
    return qualityScore >= threshold;
  }
}