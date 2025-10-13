import { CodeChunk, OverlapStrategy } from '../types';
import { ASTNodeTracker } from './ASTNodeTracker';
import { SimilarityDetector } from './SimilarityDetector';

export type OverlapStrategy = 'semantic' | 'syntactic' | 'size-based' | 'hybrid' | 'ast-boundary' | 'node-aware' | 'smart-deduplication';

export interface UnifiedOverlapOptions {
  maxSize: number;
  minLines: number;
  maxOverlapRatio: number;
  maxOverlapLines?: number;
  enableASTBoundaryDetection: boolean;
  enableNodeAwareOverlap?: boolean;
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  mergeStrategy?: 'aggressive' | 'conservative';
  nodeTracker?: ASTNodeTracker;
  ast?: any;
}

/**
 * 重叠策略工具类
 * 提供选择和应用不同重叠策略的方法
 */
export class OverlapStrategyUtils {
  /**
   * 选择统一的重叠策略
   */
 static selectUnifiedOverlapStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: Required<UnifiedOverlapOptions>
  ): OverlapStrategy {
    // 智能去重策略优先级最高
    if (options.enableSmartDeduplication) {
      if (this.shouldUseSmartDeduplicationStrategy(currentChunk, nextChunk, options)) {
        return 'smart-deduplication';
      }
    }

    // 节点感知策略
    if (options.enableNodeAwareOverlap && options.nodeTracker) {
      if (this.shouldUseNodeAwareStrategy(currentChunk, nextChunk)) {
        return 'node-aware';
      }
    }

    // AST边界检测策略
    if (options.enableASTBoundaryDetection && options.ast && options.nodeTracker) {
      return 'ast-boundary';
    }

    // 基于内容特征选择策略
    if (this.isSequentialFunctions(currentChunk, nextChunk)) {
      return 'semantic';
    }

    if (this.isComplexStructure(currentChunk)) {
      return 'syntactic';
    }

    if (this.isSimpleCode(currentChunk, nextChunk)) {
      return 'size-based';
    }

    return 'hybrid';
  }

  /**
   * 判断是否应使用智能去重策略
   */
  static shouldUseSmartDeduplicationStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: Required<UnifiedOverlapOptions>
  ): boolean {
    // 检查内容相似度
    if (SimilarityDetector.isSimilar(currentChunk.content, nextChunk.content, options.similarityThreshold)) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否应使用节点感知策略
   */
  static shouldUseNodeAwareStrategy(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查行范围重叠
    if (currentChunk.metadata.endLine >= nextChunk.metadata.startLine) {
      return true;
    }

    // 检查节点ID重叠
    if (currentChunk.metadata.nodeIds && nextChunk.metadata.nodeIds) {
      const commonNodes = currentChunk.metadata.nodeIds.filter(id =>
        nextChunk.metadata.nodeIds!.includes(id)
      );
      if (commonNodes.length > 0) {
        return true;
      }
    }

    return false;
 }

  /**
   * 检查两个代码块是否为连续函数
   */
 static isSequentialFunctions(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const lastLineOfCurrent = currentLines[currentLines.length - 1]?.trim() || '';
    const firstLineOfNext = nextLines[0]?.trim() || '';

    return (lastLineOfCurrent.endsWith('}') &&
      (firstLineOfNext.startsWith('function') ||
        !!firstLineOfNext.match(/^\w+\s*\([^)]*\)\s*{/)));
  }

 /**
   * 检查代码块是否为复杂结构
   */
  static isComplexStructure(chunk: CodeChunk): boolean {
    const lines = chunk.content.split('\n');
    let braceDepth = 0;
    let maxDepth = 0;

    for (const line of lines) {
      for (const char of line) {
        if (char === '{') {
          braceDepth++;
          maxDepth = Math.max(maxDepth, braceDepth);
        } else if (char === '}') {
          braceDepth--;
        }
      }
    }

    return maxDepth > 2;
  }

  /**
   * 检查代码是否为简单代码
   */
  static isSimpleCode(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const allLines = [...currentLines, ...nextLines];
    return allLines.every(line =>
      line.trim().startsWith('const') ||
      line.trim().startsWith('let') ||
      line.trim().startsWith('var') ||
      line.trim().startsWith('import') ||
      line.trim().startsWith('export') ||
      line.trim().match(/^\w+\s*=/)
    );
  }
}