import { IOverlapCalculator } from '../../interfaces/IOverlapCalculator';
import { CodeChunk } from '../../types';
import { OverlapStrategyUtils } from '../../utils/OverlapStrategyUtils';
import { SimilarityUtils } from '../../utils/SimilarityUtils';

export interface OverlapCalculatorOptions {
  maxSize?: number;
  minLines?: number;
  maxOverlapRatio?: number;
  maxOverlapLines?: number;
  enableASTBoundaryDetection?: boolean;
  enableNodeAwareOverlap?: boolean;
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  mergeStrategy?: 'aggressive' | 'conservative';
}

/**
 * 统一的重叠计算器实现
 * 整合了所有重叠计算策略
 */
export class OverlapCalculator implements IOverlapCalculator {
  private options: Required<OverlapCalculatorOptions>;
  private processedChunks: Map<string, CodeChunk>;
  private overlapHistory: Map<string, string[]>;

  constructor(options?: OverlapCalculatorOptions) {
    this.options = {
      maxSize: options?.maxSize ?? 200,
      minLines: options?.minLines ?? 1,
      maxOverlapRatio: options?.maxOverlapRatio ?? 0.3,
      maxOverlapLines: options?.maxOverlapLines ?? 50,
      enableASTBoundaryDetection: options?.enableASTBoundaryDetection ?? false,
      enableNodeAwareOverlap: options?.enableNodeAwareOverlap ?? false,
      enableSmartDeduplication: options?.enableSmartDeduplication ?? false,
      similarityThreshold: options?.similarityThreshold ?? 0.8,
      mergeStrategy: options?.mergeStrategy ?? 'conservative'
    };

    this.processedChunks = new Map();
    this.overlapHistory = new Map();
  }

  /**
   * 为代码块添加重叠内容
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];

        // 检查是否为重复块
        if (this.options.enableSmartDeduplication) {
          const isDuplicate = SimilarityUtils.isDuplicateChunk(chunk, nextChunk);
          if (isDuplicate) {
            continue; // 跳过重复的块
          }
        }

        // 计算重叠
        const overlapContent = this.extractOverlapContent(chunk, nextChunk, originalCode);
        
        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }

    return overlappedChunks;
  }

  /**
   * 提取重叠内容
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    // 选择重叠策略
    const strategy = OverlapStrategyUtils.selectUnifiedOverlapStrategy(
      currentChunk,
      nextChunk,
      this.options
    );

    // 根据策略计算重叠内容
    const overlapContent = this.calculateOverlapByStrategy(
      strategy,
      currentChunk,
      nextChunk,
      originalCode
    );

    // 评估重叠质量
    const quality = OverlapStrategyUtils.evaluateOverlapQuality(
      overlapContent,
      currentChunk,
      nextChunk
    );

    // 如果质量太低，返回空字符串
    if (quality < 0.3) {
      return '';
    }

    return overlapContent;
  }

  /**
   * 智能计算重叠
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[] {
    const currentCodeChunk: CodeChunk = {
      content: currentChunk.join('\n'),
      metadata: {
        startLine: startLine,
        endLine: startLine + currentChunk.length - 1,
        language: 'unknown'
      }
    };

    const nextCodeChunk: CodeChunk = {
      content: '',
      metadata: {
        startLine: startLine + currentChunk.length,
        endLine: startLine + currentChunk.length,
        language: 'unknown'
      }
    };

    const overlapContent = this.extractOverlapContent(
      currentCodeChunk,
      nextCodeChunk,
      originalCode
    );

    return overlapContent.split('\n');
  }

  /**
   * 根据策略计算重叠
   */
  private calculateOverlapByStrategy(
    strategy: string,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    switch (strategy) {
      case 'semantic':
        return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
      case 'syntactic':
        return this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode);
      case 'size-based':
        return this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode);
      case 'hybrid':
        return this.calculateHybridOverlap(currentChunk, nextChunk, originalCode);
      case 'smart-deduplication':
        return this.calculateSmartDeduplicationOverlap(currentChunk, nextChunk, originalCode);
      default:
        return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
    }
  }

  /**
   * 计算语义重叠
   */
  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const lines = originalCode.split('\n');
    const overlapLines: string[] = [];

    // 从当前块的末尾开始，向前查找合适的重叠点
    const startLine = Math.max(0, currentChunk.metadata.endLine - this.options.maxOverlapLines);
    
    for (let i = currentChunk.metadata.endLine - 1; i >= startLine; i--) {
      if (i >= lines.length) continue;

      const line = lines[i];
      
      // 检查是否超过最大大小限制
      const currentContent = overlapLines.join('\n');
      if (currentContent.length + line.length + 1 > this.options.maxSize) {
        break;
      }

      // 检查重叠比例
      const tentativeOverlap = [line, ...overlapLines].join('\n');
      const overlapRatio = tentativeOverlap.length / currentChunk.content.length;
      
      if (overlapRatio > this.options.maxOverlapRatio) {
        break;
      }

      // 语义评估：检查是否是好的分割点
      if (this.isGoodSemanticBreakPoint(line, i, lines)) {
        overlapLines.unshift(line);
      } else if (overlapLines.length === 0) {
        // 如果还没有重叠内容，强制添加这一行
        overlapLines.unshift(line);
      }
    }

    return overlapLines.join('\n');
  }

  /**
   * 计算语法重叠
   */
  private calculateSyntacticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const lines = originalCode.split('\n');
    const overlapLines: string[] = [];
    
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;

    // 从当前块的末尾开始，向前查找语法边界
    const startLine = Math.max(0, currentChunk.metadata.endLine - this.options.maxOverlapLines);
    
    for (let i = currentChunk.metadata.endLine - 1; i >= startLine; i--) {
      if (i >= lines.length) continue;

      const line = lines[i];
      
      // 更新括号计数
      braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      parenCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      bracketCount += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;

      // 检查是否超过最大大小限制
      const currentContent = overlapLines.join('\n');
      if (currentContent.length + line.length + 1 > this.options.maxSize) {
        break;
      }

      // 检查重叠比例
      const tentativeOverlap = [line, ...overlapLines].join('\n');
      const overlapRatio = tentativeOverlap.length / currentChunk.content.length;
      
      if (overlapRatio > this.options.maxOverlapRatio) {
        break;
      }

      // 如果括号平衡，这是一个好的语法分割点
      if (braceCount === 0 && parenCount === 0 && bracketCount === 0) {
        overlapLines.unshift(line);
        break; // 在第一个平衡的语法点停止
      } else {
        overlapLines.unshift(line);
      }
    }

    return overlapLines.join('\n');
  }

  /**
   * 基于大小的重叠计算
   */
  private calculateSizeBasedOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const lines = originalCode.split('\n');
    const overlapLines: string[] = [];
    let totalSize = 0;

    // 从当前块的末尾开始，向前添加行直到达到大小限制
    const startLine = Math.max(0, currentChunk.metadata.endLine - this.options.maxOverlapLines);
    
    for (let i = currentChunk.metadata.endLine - 1; i >= startLine; i--) {
      if (i >= lines.length) continue;

      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查大小限制
      if (totalSize + lineSize > this.options.maxSize) {
        break;
      }

      // 检查重叠比例
      const newTotalSize = totalSize + lineSize;
      const overlapRatio = newTotalSize / currentChunk.content.length;
      
      if (overlapRatio > this.options.maxOverlapRatio) {
        break;
      }

      overlapLines.unshift(line);
      totalSize = newTotalSize;
    }

    return overlapLines.join('\n');
  }

  /**
   * 混合重叠策略
   */
  private calculateHybridOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    // 计算所有策略的结果
    const semanticOverlap = this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
    const syntacticOverlap = this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode);
    const sizeBasedOverlap = this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode);

    // 评估每个结果的质量
    const overlaps = [
      { content: semanticOverlap, strategy: 'semantic' },
      { content: syntacticOverlap, strategy: 'syntactic' },
      { content: sizeBasedOverlap, strategy: 'size-based' }
    ];

    // 选择质量最高的重叠
    let bestOverlap = overlaps[0];
    let bestQuality = 0;

    for (const overlap of overlaps) {
      if (!overlap.content) continue;

      const quality = OverlapStrategyUtils.evaluateOverlapQuality(
        overlap.content,
        currentChunk,
        nextChunk
      );

      if (quality > bestQuality) {
        bestQuality = quality;
        bestOverlap = overlap;
      }
    }

    return bestOverlap.content;
  }

  /**
   * 智能去重重叠
   */
  private calculateSmartDeduplicationOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    // 首先尝试语义重叠
    const baseOverlap = this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);

    if (!baseOverlap) {
      return '';
    }

    // 创建临时重叠块进行相似度检查
    const tempOverlapChunk: CodeChunk = {
      content: baseOverlap,
      metadata: {
        startLine: currentChunk.metadata.endLine - baseOverlap.split('\n').length,
        endLine: currentChunk.metadata.endLine,
        language: currentChunk.metadata.language,
        filePath: currentChunk.metadata.filePath,
        type: 'overlap'
      }
    };

    // 检查是否应该创建这个重叠块
    if (!SimilarityUtils.shouldCreateOverlap(tempOverlapChunk, [], this.options.similarityThreshold)) {
      // 尝试生成替代的重叠内容
      return this.generateAlternativeOverlap(currentChunk, nextChunk, originalCode);
    }

    return baseOverlap;
  }

  /**
   * 生成替代的重叠内容
   */
  private generateAlternativeOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const strategies = [
      // 策略1：减少重叠大小
      () => {
        const reducedSize = Math.floor(this.options.maxSize * 0.5);
        const tempOptions = { ...this.options, maxSize: reducedSize };
        return this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode);
      },

      // 策略2：调整重叠起始位置
      () => {
        const lines = originalCode.split('\n');
        const offset = Math.max(0, currentChunk.metadata.endLine - 2);
        const availableLines = lines.slice(Math.max(0, offset - 1), currentChunk.metadata.endLine);
        return availableLines.join('\n');
      },

      // 策略3：使用语法边界
      () => {
        return this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode);
      }
    ];

    // 尝试每种策略，直到找到合适的重叠
    for (const strategy of strategies) {
      const alternativeOverlap = strategy();
      
      if (alternativeOverlap) {
        const tempChunk: CodeChunk = {
          content: alternativeOverlap,
          metadata: {
            startLine: currentChunk.metadata.endLine - alternativeOverlap.split('\n').length,
            endLine: currentChunk.metadata.endLine,
            language: currentChunk.metadata.language,
            filePath: currentChunk.metadata.filePath,
            type: 'overlap'
          }
        };

        if (SimilarityUtils.shouldCreateOverlap(tempChunk, [], this.options.similarityThreshold)) {
          return alternativeOverlap;
        }
      }
    }

    // 如果所有策略都失败，返回空字符串
    return '';
  }

  /**
   * 检查是否是好的语义分割点
   */
  private isGoodSemanticBreakPoint(line: string, lineNumber: number, allLines: string[]): boolean {
    const trimmedLine = line.trim();

    // 空行是好的分割点
    if (trimmedLine === '') {
      return true;
    }

    // 注释行
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
      return true;
    }

    // 函数/类/控制结构的结束
    if (trimmedLine === '}' || trimmedLine.match(/^\s*}\s*$/)) {
      return true;
    }

    // return语句
    if (trimmedLine.startsWith('return')) {
      return true;
    }

    // 函数或类定义的开始
    if (trimmedLine.match(/^\s*(public|private|protected|static|async)*\s*(function|class|interface|def)\s/)) {
      return true;
    }

    // 控制结构的开始
    if (trimmedLine.match(/^\s*(if|for|while|switch|case|default|try|catch|finally)\s/)) {
      return true;
    }

    return false;
  }

  /**
   * 合并相似的块
   */
  mergeSimilarChunks(chunks: CodeChunk[]): CodeChunk[] {
    const merged: CodeChunk[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      let currentChunk = chunks[i];
      processed.add(i);

      // 查找可以合并的相似块
      for (let j = i + 1; j < chunks.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const otherChunk = chunks[j];

        // 检查是否相似且相邻或重叠
        if (SimilarityUtils.canMergeChunks(currentChunk, otherChunk, this.options.similarityThreshold)) {
          currentChunk = SimilarityUtils.mergeTwoChunks(currentChunk, otherChunk);
          processed.add(j);
        }
      }

      merged.push(currentChunk);
    }

    return merged;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    processedChunks: number;
    overlapHistoryEntries: number;
    similarityThreshold: number;
    mergeStrategy: string;
  } {
    return {
      processedChunks: this.processedChunks.size,
      overlapHistoryEntries: this.overlapHistory.size,
      similarityThreshold: this.options.similarityThreshold,
      mergeStrategy: this.options.mergeStrategy
    };
  }
}