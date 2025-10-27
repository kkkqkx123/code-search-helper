import { CodeChunk } from '../../types/splitting-types';

export type OverlapStrategy = 'semantic' | 'syntactic' | 'size-based' | 'hybrid' | 'ast-boundary' | 'node-aware' | 'smart-deduplication';

export interface OverlapOptions {
  maxSize: number;
  minLines: number;
  maxOverlapRatio: number;
  maxOverlapLines?: number;
  enableASTBoundaryDetection: boolean;
  enableNodeAwareOverlap?: boolean;
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  mergeStrategy?: 'aggressive' | 'conservative';
}

/**
 * 重叠策略工具类
 * 统一管理重叠策略选择和决策逻辑
 */
export class OverlapStrategyUtils {
  /**
   * 选择统一的重叠策略
   */
  static selectUnifiedOverlapStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: OverlapOptions
  ): OverlapStrategy {
    // 优先级1：智能去重策略（如果启用）
    if (options.enableSmartDeduplication && this.shouldUseSmartDeduplicationStrategy(currentChunk, nextChunk, options)) {
      return 'smart-deduplication';
    }

    // 优先级2：节点感知策略（如果启用）
    if (options.enableNodeAwareOverlap && this.shouldUseNodeAwareStrategy(currentChunk, nextChunk)) {
      return 'node-aware';
    }

    // 优先级3：AST边界策略（如果启用）
    if (options.enableASTBoundaryDetection) {
      return 'ast-boundary';
    }

    // 优先级4：混合策略（默认）
    return 'hybrid';
  }

  /**
   * 判断是否应使用智能去重策略
   */
  static shouldUseSmartDeduplicationStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: OverlapOptions
  ): boolean {
    // 检查内容相似度
    const contentSimilarity = this.calculateContentSimilarity(currentChunk.content, nextChunk.content);

    // 检查是否有重复的历史记录
    const hasDuplicateHistory = this.checkDuplicateHistory(currentChunk, nextChunk);

    // 检查块大小是否适合去重
    const isSizeAppropriate = this.isSizeAppropriateForDeduplication(currentChunk, nextChunk, options);

    return contentSimilarity > (options.similarityThreshold || 0.8) || hasDuplicateHistory || !isSizeAppropriate;
  }

  /**
   * 判断是否应使用节点感知策略
   */
  static shouldUseNodeAwareStrategy(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查是否有AST节点信息
    const hasNodeIds = currentChunk.metadata.nodeIds && currentChunk.metadata.nodeIds.length > 0;

    // 检查块之间是否有明显间隙
    const hasGap = nextChunk.metadata.startLine > currentChunk.metadata.endLine + 1;

    // 检查内容是否有明显的语义边界
    const hasSemanticBoundary = this.hasSemanticBoundary(currentChunk, nextChunk);

    return hasNodeIds || hasGap || hasSemanticBoundary;
  }

  /**
   * 计算内容相似度（简化版）
   */
  private static calculateContentSimilarity(content1: string, content2: string): number {
    if (!content1 || !content2) return 0;

    // 简单的相似度计算：基于共同行数
    const lines1 = new Set(content1.split('\n').map(line => line.trim()));
    const lines2 = new Set(content2.split('\n').map(line => line.trim()));

    const commonLines = Array.from(lines1).filter(line => lines2.has(line) && line.length > 0);
    const totalLines = Array.from(new Set([...lines1, ...lines2])).filter(line => line.length > 0);

    return totalLines.length === 0 ? 0 : commonLines.length / totalLines.length;
  }

  /**
   * 检查重复历史
   */
  private static checkDuplicateHistory(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 这里可以实现基于历史记录的重复检测
    // 暂时返回false，实际实现需要维护历史记录
    return false;
  }

  /**
   * 检查大小是否适合去重
   */
  private static isSizeAppropriateForDeduplication(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: OverlapOptions
  ): boolean {
    const currentSize = currentChunk.content.length;
    const nextSize = nextChunk.content.length;
    const maxSize = Math.max(currentSize, nextSize);

    // 检查是否超过最大重叠比例
    const overlapRatio = options.maxOverlapRatio || 0.3;
    const maxAllowedOverlap = maxSize * overlapRatio;

    return maxAllowedOverlap >= options.minLines * 50; // 假设每行平均50字符
  }

  /**
   * 检查是否有语义边界
   */
  private static hasSemanticBoundary(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查块类型是否不同
    if (currentChunk.metadata.type !== nextChunk.metadata.type) {
      return true;
    }

    // 检查是否有函数或类边界
    const currentContent = currentChunk.content;
    const nextContent = nextChunk.content;

    // 检查函数定义
    if (this.hasFunctionDefinition(currentContent) || this.hasFunctionDefinition(nextContent)) {
      return true;
    }

    // 检查类定义
    if (this.hasClassDefinition(currentContent) || this.hasClassDefinition(nextContent)) {
      return true;
    }

    // 检查控制结构
    if (this.hasControlStructure(currentContent) || this.hasControlStructure(nextContent)) {
      return true;
    }

    return false;
  }

  /**
   * 检查是否有函数定义
   */
  private static hasFunctionDefinition(content: string): boolean {
    const functionPatterns = [
      /^\s*(public|private|protected|static|async)*\s*function\s+\w+\s*\(/, // JavaScript/TypeScript
      /^\s*(public|private|protected|static|async)*\s*\w+\s*\([^)]*\)\s*{/, // JavaScript/TypeScript 箭头函数
      /^\s*(public|private|protected|static|async)*\s*\w+\s*\([^)]*\)\s*:/, // TypeScript 方法
      /^\s*def\s+\w+\s*\(/, // Python
      /^\s*(public|private|protected|static)*\s*\w+\s+\w+\s*\(/ // Java/C#/C++
    ];

    const lines = content.split('\n');
    return lines.some(line => functionPatterns.some(pattern => pattern.test(line)));
  }

  /**
   * 检查是否有类定义
   */
  private static hasClassDefinition(content: string): boolean {
    const classPatterns = [
      /^\s*(export\s+)?(abstract\s+)?class\s+\w+/, // JavaScript/TypeScript
      /^\s*(public|private|protected)*\s*(abstract|final)*\s*class\s+\w+/, // Java/C#/C++
      /^\s*class\s+\w+/, // Python
      /^\s*interface\s+\w+/ // TypeScript/Java
    ];

    const lines = content.split('\n');
    return lines.some(line => classPatterns.some(pattern => pattern.test(line)));
  }

  /**
   * 检查是否有控制结构
   */
  private static hasControlStructure(content: string): boolean {
    const controlPatterns = [
      /^\s*(if|for|while|switch|case|default)\s*\(/, // 通用控制结构
      /^\s*try\s*{/, // try块
      /^\s*catch\s*\(/, // catch块
      /^\s*finally\s*{/, // finally块
      /^\s*with\s+\w+:/ // Python with语句
    ];

    const lines = content.split('\n');
    return lines.some(line => controlPatterns.some(pattern => pattern.test(line)));
  }

  /**
   * 评估重叠质量
   */
  static evaluateOverlapQuality(
    overlapContent: string,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): number {
    if (!overlapContent || overlapContent.trim().length === 0) {
      return 0;
    }

    let quality = 0.5; // 基础质量分数

    // 基于内容长度评估
    const overlapLength = overlapContent.length;
    const avgChunkLength = (currentChunk.content.length + nextChunk.content.length) / 2;
    const lengthRatio = overlapLength / avgChunkLength;

    if (lengthRatio >= 0.1 && lengthRatio <= 0.3) {
      quality += 0.2; // 合适的长度比例
    } else if (lengthRatio > 0.3) {
      quality -= 0.1; // 长度过长
    } else if (lengthRatio < 0.1) {
      quality -= 0.05; // 长度过短
    }

    // 基于语义完整性评估
    const hasCompleteStatements = this.hasCompleteStatements(overlapContent);
    if (hasCompleteStatements) {
      quality += 0.2;
    }

    // 基于语法完整性评估
    const isSyntacticallyValid = this.isSyntacticallyValid(overlapContent);
    if (isSyntacticallyValid) {
      quality += 0.1;
    }

    // 基于边界位置评估
    const isAtGoodBoundary = this.isAtGoodBoundary(overlapContent, currentChunk, nextChunk);
    if (isAtGoodBoundary) {
      quality += 0.1;
    }

    return Math.min(1.0, Math.max(0.0, quality));
  }

  /**
   * 检查是否有完整的语句
   */
  private static hasCompleteStatements(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim());

    // 检查是否有完整的语句（以分号结束，或是完整的控制结构）
    return lines.some(line =>
      line.endsWith(';') ||
      line.endsWith('{') ||
      line.endsWith('}') ||
      line.match(/^\s*(return|break|continue|throw)\s/)
    );
  }

  /**
   * 检查语法是否有效（简化版）
   */
  private static isSyntacticallyValid(content: string): boolean {
    // 简单的语法检查：括号是否平衡
    const openBrackets = (content.match(/\(/g) || []).length;
    const closeBrackets = (content.match(/\)/g) || []).length;
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;

    return openBrackets === closeBrackets && openBraces === closeBraces;
  }

  /**
   * 检查是否位于好的边界位置
   */
  private static isAtGoodBoundary(
    overlapContent: string,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): boolean {
    // 检查是否位于函数、类或其他语义单元的边界
    const lines = overlapContent.split('\n').map(line => line.trim());

    // 检查是否以右大括号结束（可能是函数/类结束）
    if (lines.length > 0 && lines[lines.length - 1] === '}') {
      return true;
    }

    // 检查是否包含return语句
    if (lines.some(line => line.startsWith('return'))) {
      return true;
    }

    // 检查是否位于空行或注释
    if (lines.some(line => line === '' || line.startsWith('//') || line.startsWith('/*'))) {
      return true;
    }

    return false;
  }
}