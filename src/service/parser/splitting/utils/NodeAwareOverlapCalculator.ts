import { CodeChunk, ASTNode, OverlapCalculator } from '../types';
import { ASTNodeTracker } from './ASTNodeTracker';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 节点感知的重叠计算器 - 基于AST节点的智能重叠计算
 */
export class NodeAwareOverlapCalculator implements OverlapCalculator {
  private nodeTracker: ASTNodeTracker;
  private logger?: LoggerService;
  private maxOverlapRatio: number;
  private maxOverlapLines: number;

  constructor(
    nodeTracker: ASTNodeTracker,
    options: {
      maxOverlapRatio?: number;
      maxOverlapLines?: number;
    } = {},
    logger?: LoggerService
  ) {
    this.nodeTracker = nodeTracker;
    this.logger = logger;
    this.maxOverlapRatio = options.maxOverlapRatio || 0.3;
    this.maxOverlapLines = options.maxOverlapLines || 50;
  }

  /**
   * 为代码块添加重叠内容
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const result: CodeChunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i - 1];
      const nextChunk = chunks[i];

      // 使用节点感知的重叠计算
      const overlapResult = this.calculateNodeAwareOverlap(
        currentChunk,
        nextChunk,
        originalCode
      );

      if (overlapResult.isDuplicate) {
        this.logger?.debug(`Skipping duplicate chunk at lines ${nextChunk.metadata.startLine}-${nextChunk.metadata.endLine}`);
        continue; // 跳过重复块
      }

      // 更新下一个块的内容（包含重叠）
      const enhancedNextChunk: CodeChunk = {
        ...nextChunk,
        content: overlapResult.overlapContent + nextChunk.content,
        metadata: {
          ...nextChunk.metadata,
          startLine: nextChunk.metadata.startLine - this.countLines(overlapResult.overlapContent)
        }
      };

      result.push(enhancedNextChunk);
    }

    return result;
  }

  /**
   * 提取重叠内容
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const overlapResult = this.calculateNodeAwareOverlap(
      currentChunk,
      nextChunk,
      originalCode
    );
    return overlapResult.overlapContent;
  }

  /**
   * 智能计算重叠
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[] {
    // 将当前块转换为CodeChunk格式进行处理
    const currentCodeChunk: CodeChunk = {
      content: currentChunk.join('\n'),
      metadata: {
        startLine: startLine,
        endLine: startLine + currentChunk.length - 1,
        language: 'unknown'
      }
    };

    // 创建下一个块的占位符
    const nextCodeChunk: CodeChunk = {
      content: '',
      metadata: {
        startLine: startLine + currentChunk.length,
        endLine: startLine + currentChunk.length,
        language: 'unknown'
      }
    };

    const overlapResult = this.calculateNodeAwareOverlap(
      currentCodeChunk,
      nextCodeChunk,
      originalCode
    );

    return overlapResult.overlapContent.split('\n');
  }

  /**
   * 节点感知的重叠计算核心方法
   */
  private calculateNodeAwareOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): {
    overlapContent: string;
    isDuplicate: boolean;
  } {
    // 获取当前块的结束行和下一个块的开始行
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    // 检查是否有重叠空间
    if (currentEndLine >= nextStartLine) {
      // 块之间有重叠，检查是否为重复
      if (this.isDuplicateChunk(currentChunk, nextChunk)) {
        return { overlapContent: '', isDuplicate: true };
      }
      return { overlapContent: '', isDuplicate: false };
    }

    // 计算理论重叠行数
    const gapLines = nextStartLine - currentEndLine - 1;
    const maxPossibleOverlap = Math.min(gapLines, this.maxOverlapLines);

    if (maxPossibleOverlap <= 0) {
      return { overlapContent: '', isDuplicate: false };
    }

    // 提取重叠内容
    const overlapContent = this.extractOverlapFromOriginal(
      originalCode,
      currentEndLine + 1,
      nextStartLine - 1
    );

    // 检查重叠内容是否包含已使用的节点
    const overlapNodes = this.extractNodesFromContent(
      overlapContent,
      currentEndLine + 1,
      nextStartLine - 1
    );

    const unusedNodes = overlapNodes.filter(node => !this.nodeTracker.isUsed(node));

    if (unusedNodes.length === 0) {
      // 所有重叠节点都已被使用，减少重叠
      const reducedOverlap = this.findReducedOverlap(overlapContent, originalCode, currentEndLine);
      return { overlapContent: reducedOverlap, isDuplicate: false };
    }

    // 标记重叠节点为已使用
    unusedNodes.forEach(node => this.nodeTracker.markUsed(node));

    return { overlapContent, isDuplicate: false };
  }

  /**
   * 检查是否为重复块
   */
  private isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 简单的内容比较
    if (chunk1.content === chunk2.content) {
      return true;
    }

    // 基于节点ID的比较
    if (chunk1.metadata.nodeIds && chunk2.metadata.nodeIds) {
      const commonNodes = chunk1.metadata.nodeIds.filter(id => 
        chunk2.metadata.nodeIds!.includes(id)
      );
      
      // 如果共享节点超过块内容的50%，认为是重复
      const maxNodes = Math.max(chunk1.metadata.nodeIds.length, chunk2.metadata.nodeIds.length);
      if (commonNodes.length / maxNodes > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * 从原始代码中提取重叠内容
   */
  private extractOverlapFromOriginal(
    originalCode: string,
    startLine: number,
    endLine: number
  ): string {
    const lines = originalCode.split('\n');
    const overlapLines = lines.slice(startLine - 1, endLine);
    return overlapLines.join('\n');
  }

  /**
   * 从内容中提取AST节点
   */
  private extractNodesFromContent(
    content: string,
    startLine: number,
    endLine: number
  ): ASTNode[] {
    // 这里需要根据实际的AST结构实现节点提取逻辑
    // 暂时返回空数组，实际实现需要根据Tree-sitter的AST结构来提取
    return [];
  }

  /**
   * 查找减少的重叠内容
   */
  private findReducedOverlap(
    originalOverlap: string,
    originalCode: string,
    currentEndLine: number
  ): string {
    const lines = originalOverlap.split('\n');
    
    // 从后向前查找未使用的节点
    for (let i = lines.length - 1; i >= 0; i--) {
      const testOverlap = lines.slice(0, i + 1).join('\n');
      const testStartLine = currentEndLine + 1;
      const testEndLine = currentEndLine + i + 1;
      
      const testNodes = this.extractNodesFromContent(testOverlap, testStartLine, testEndLine);
      const unusedNodes = testNodes.filter(node => !this.nodeTracker.isUsed(node));
      
      if (unusedNodes.length > 0) {
        // 标记找到的未使用节点
        unusedNodes.forEach(node => this.nodeTracker.markUsed(node));
        return testOverlap;
      }
    }
    
    return '';
  }

  /**
   * 计算行数
   */
  private countLines(content: string): number {
    return content.split('\n').length;
  }

  /**
   * 设置最大重叠比例
   */
  setMaxOverlapRatio(ratio: number): void {
    this.maxOverlapRatio = Math.max(0, Math.min(1, ratio));
  }

  /**
   * 设置最大重叠行数
   */
  setMaxOverlapLines(lines: number): void {
    this.maxOverlapLines = Math.max(0, lines);
  }

  /**
   * 获取计算器统计信息
   */
  getStats(): {
    maxOverlapRatio: number;
    maxOverlapLines: number;
    nodeTrackerStats: any;
  } {
    return {
      maxOverlapRatio: this.maxOverlapRatio,
      maxOverlapLines: this.maxOverlapLines,
      nodeTrackerStats: this.nodeTracker.getStats()
    };
  }
}