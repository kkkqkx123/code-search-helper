import { IComplexityCalculator } from '../strategies/types/SegmentationTypes';

export class ComplexityCalculator implements IComplexityCalculator {
  /**
   * 计算代码复杂度
   * @param content 代码内容
   */
  calculate(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 快速估算复杂度（用于性能优化）
   * @param content 代码内容
   */
  estimate(content: string): number {
    // 快速复杂度估算
    let score = 0;
    score += (content.match(/\b(function|class|interface)\b/g) || []).length * 10;
    score += (content.match(/\b(if|else|for|while|switch)\b/g) || []).length * 5;
    score += (content.match(/[{}()[\]]/g) || []).length;
    return score;
  }

  /**
   * 计算语义分数
   * @param line 单行代码
   */
  calculateSemanticScore(line: string): number {
    let score = line.length; // 基础分数

    // 语义关键字权重
    if (line.match(/\b(function|class|interface|const|let|var)\b/)) score += 10;
    if (line.match(/\b(if|else|while|for|switch|case)\b/)) score += 5;
    if (line.match(/\b(import|export|require|from)\b/)) score += 8;
    if (line.match(/\b(try|catch|finally|throw)\b/)) score += 6;
    if (line.match(/\b(return|break|continue)\b/)) score += 4;

    // 结构复杂度
    score += (line.match(/[{}]/g) || []).length * 3;
    score += (line.match(/[()]/g) || []).length * 2;
    score += (line.match(/[\[\]]/g) || []).length * 1.5;

    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) score *= 0.3;
    if (line.trim() === '') score = 1;

    return score;
  }
}