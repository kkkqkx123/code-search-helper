import { CodeChunk } from '../types';
import { SimilarityDetector } from './SimilarityDetector';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';

/**
 * 智能重叠控制器 - 防止生成过于相似的重叠块
 */
export class SmartOverlapController {
  private readonly similarityThreshold: number;
  private readonly mergeStrategy: 'aggressive' | 'conservative';
  private readonly maxOverlapRatio: number;
  private processedChunks: Map<string, CodeChunk>;
  private overlapHistory: Map<string, string[]>; // 记录每个位置的重叠历史

  constructor(
    similarityThreshold: number = 0.8,
    mergeStrategy: 'aggressive' | 'conservative' = 'conservative',
    maxOverlapRatio: number = 0.3
  ) {
    this.similarityThreshold = similarityThreshold;
    this.mergeStrategy = mergeStrategy;
    this.maxOverlapRatio = maxOverlapRatio;
    this.processedChunks = new Map();
    this.overlapHistory = new Map();
  }

  /**
   * 智能重叠控制 - 检查新的重叠块是否与已有块过于相似
   */
  shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    originalContent: string
  ): boolean {
    // 生成新块的内容哈希
    const newChunkHash = ContentHashIDGenerator.getContentHashPrefix(newChunk.content);
    
    // 检查是否已经存在相同内容的块
    for (const existingChunk of existingChunks) {
      const existingHash = ContentHashIDGenerator.getContentHashPrefix(existingChunk.content);
      
      // 如果内容哈希相同，说明内容基本相同
      if (newChunkHash === existingHash) {
        return false; // 跳过这个重叠块
      }
      
      // 检查相似度
      if (SimilarityDetector.isSimilar(newChunk.content, existingChunk.content, this.similarityThreshold)) {
        return false; // 跳过过于相似的重叠块
      }
    }

    // 检查重叠历史，避免在同一区域重复生成相似块
    const overlapKey = `${newChunk.metadata.startLine}-${newChunk.metadata.endLine}`;
    const history = this.overlapHistory.get(overlapKey) || [];
    
    for (const historicalHash of history) {
      if (historicalHash === newChunkHash) {
        return false; // 这个区域已经生成过相同内容的重叠块
      }
    }

    return true;
  }

  /**
   * 智能重叠生成 - 生成不重复的重叠内容
   */
  createSmartOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    allChunks: CodeChunk[]
  ): string {
    const overlapSize = this.calculateOptimalOverlapSize(currentChunk, nextChunk);
    
    if (overlapSize <= 0) {
      return '';
    }

    // 从原始内容中提取重叠区域
    const overlapContent = this.extractOverlapContent(
      currentChunk,
      nextChunk,
      originalContent,
      overlapSize
    );

    if (!overlapContent) {
      return '';
    }

    // 创建临时的重叠块进行相似度检查
    const tempOverlapChunk: CodeChunk = {
      content: overlapContent,
      metadata: {
        startLine: currentChunk.metadata.endLine - overlapSize + 1,
        endLine: currentChunk.metadata.endLine,
        language: currentChunk.metadata.language,
        filePath: currentChunk.metadata.filePath,
        type: 'overlap'
      }
    };

    // 检查是否应该创建这个重叠块
    if (!this.shouldCreateOverlap(tempOverlapChunk, allChunks, originalContent)) {
      // 尝试生成不同的重叠内容
      return this.generateAlternativeOverlap(currentChunk, nextChunk, originalContent, allChunks);
    }

    // 记录重叠历史
    this.recordOverlapHistory(tempOverlapChunk);

    return overlapContent;
  }

  /**
   * 计算最佳重叠大小
   */
  private calculateOptimalOverlapSize(chunk1: CodeChunk, chunk2: CodeChunk): number {
    const chunk1Size = chunk1.metadata.endLine - chunk1.metadata.startLine + 1;
    const chunk2Size = chunk2.metadata.endLine - chunk2.metadata.startLine + 1;
    
    // 基于块大小和最大重叠比例计算
    const maxOverlap = Math.min(chunk1Size, chunk2Size) * this.maxOverlapRatio;
    
    // 保守策略：使用较小的重叠
    // 激进策略：使用较大的重叠
    const overlapMultiplier = this.mergeStrategy === 'conservative' ? 0.7 : 1.0;
    
    return Math.max(1, Math.floor(maxOverlap * overlapMultiplier));
  }

  /**
   * 从原始内容中提取重叠内容
   */
  private extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    overlapSize: number
  ): string {
    const lines = originalContent.split('\n');
    
    // 计算重叠区域
    const overlapStartLine = Math.max(0, currentChunk.metadata.endLine - overlapSize);
    const overlapEndLine = currentChunk.metadata.endLine;
    
    if (overlapStartLine >= lines.length || overlapEndLine > lines.length) {
      return '';
    }
    
    const overlapLines = lines.slice(overlapStartLine, overlapEndLine);
    return overlapLines.join('\n');
  }

  /**
   * 生成替代的重叠内容（当原始重叠太相似时）
   */
  private generateAlternativeOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    allChunks: CodeChunk[]
  ): string {
    const lines = originalContent.split('\n');
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;
    
    // 尝试不同的重叠策略
    const strategies = [
      // 策略1：减少重叠大小
      () => {
        const smallerOverlap = Math.max(1, Math.floor((currentEndLine - currentChunk.metadata.startLine + 1) * this.maxOverlapRatio * 0.5));
        return this.extractOverlapContent(currentChunk, nextChunk, originalContent, smallerOverlap);
      },
      
      // 策略2：调整重叠起始位置
      () => {
        const offset = Math.max(0, currentEndLine - 2);
        const availableLines = lines.slice(Math.max(0, offset - 1), currentEndLine);
        return availableLines.join('\n');
      },
      
      // 策略3：使用语义边界（简化实现）
      () => {
        // 查找语义边界，如函数结束、类结束等
        for (let i = currentEndLine - 1; i >= Math.max(0, currentEndLine - 5); i--) {
          const line = lines[i];
          if (line.includes('}') || line.includes('return') || line.trim() === '') {
            const overlapLines = lines.slice(i, currentEndLine);
            return overlapLines.join('\n');
          }
        }
        return '';
      }
    ];

    // 尝试每种策略，直到找到不相似的重叠
    for (const strategy of strategies) {
      const alternativeOverlap = strategy();
      
      if (alternativeOverlap) {
        const tempChunk: CodeChunk = {
          content: alternativeOverlap,
          metadata: {
            startLine: currentEndLine - alternativeOverlap.split('\n').length,
            endLine: currentEndLine,
            language: currentChunk.metadata.language,
            filePath: currentChunk.metadata.filePath,
            type: 'overlap'
          }
        };

        if (this.shouldCreateOverlap(tempChunk, allChunks, originalContent)) {
          this.recordOverlapHistory(tempChunk);
          return alternativeOverlap;
        }
      }
    }

    // 如果所有策略都失败，返回空字符串（表示不创建重叠）
    return '';
  }

  /**
   * 记录重叠历史
   */
  private recordOverlapHistory(chunk: CodeChunk): void {
    const overlapKey = `${chunk.metadata.startLine}-${chunk.metadata.endLine}`;
    const contentHash = ContentHashIDGenerator.getContentHashPrefix(chunk.content);
    
    if (!this.overlapHistory.has(overlapKey)) {
      this.overlapHistory.set(overlapKey, []);
    }
    
    const history = this.overlapHistory.get(overlapKey)!;
    history.push(contentHash);
    
    // 限制历史记录大小
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 智能合并相似的块
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
        if (this.canMergeChunks(currentChunk, otherChunk)) {
          currentChunk = this.mergeTwoChunks(currentChunk, otherChunk);
          processed.add(j);
        }
      }

      merged.push(currentChunk);
    }

    return merged;
  }

  /**
   * 检查两个块是否可以合并
   */
  private canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 检查相似度
    if (!SimilarityDetector.isSimilar(chunk1.content, chunk2.content, this.similarityThreshold)) {
      return false;
    }

    // 检查位置关系（相邻或重叠）
    const start1 = chunk1.metadata.startLine;
    const end1 = chunk1.metadata.endLine;
    const start2 = chunk2.metadata.startLine;
    const end2 = chunk2.metadata.endLine;

    // 相邻：块2紧接在块1后面
    const isAdjacent = start2 === end1 + 1;
    
    // 重叠：两个块有重叠区域
    const isOverlapping = start2 <= end1 && start1 <= end2;
    
    return isAdjacent || isOverlapping;
  }

  /**
   * 合并两个块
   */
  private mergeTwoChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    const startLine = Math.min(chunk1.metadata.startLine, chunk2.metadata.startLine);
    const endLine = Math.max(chunk1.metadata.endLine, chunk2.metadata.endLine);
    
    // 合并内容（处理重叠情况）
    let mergedContent: string;
    
    if (chunk1.metadata.startLine <= chunk2.metadata.startLine) {
      // chunk1在前
      mergedContent = this.mergeContents(chunk1.content, chunk2.content, chunk1.metadata.startLine, chunk2.metadata.startLine);
    } else {
      // chunk2在前
      mergedContent = this.mergeContents(chunk2.content, chunk1.content, chunk2.metadata.startLine, chunk1.metadata.startLine);
    }

    return {
      content: mergedContent,
      metadata: {
        startLine,
        endLine,
        language: chunk1.metadata.language,
        filePath: chunk1.metadata.filePath,
        type: chunk1.metadata.type || chunk2.metadata.type || 'merged',
        complexity: Math.max(chunk1.metadata.complexity || 0, chunk2.metadata.complexity || 0)
      }
    };
  }

  /**
   * 智能合并内容（处理重叠）
   */
  private mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    
    // 计算重叠行数
    const overlapLines = Math.max(0, startLine1 + lines1.length - startLine2);
    
    if (overlapLines <= 0) {
      // 没有重叠，简单拼接
      return content1 + '\n' + content2;
    }

    // 有重叠，需要智能合并
    const nonOverlapLines1 = lines1.slice(0, -overlapLines);
    const mergedLines = [...nonOverlapLines1, ...lines2];
    
    return mergedLines.join('\n');
  }

  /**
   * 清理历史记录（内存管理）
   */
  clearHistory(): void {
    this.processedChunks.clear();
    this.overlapHistory.clear();
  }

  /**
   * 获取控制器统计信息
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
      similarityThreshold: this.similarityThreshold,
      mergeStrategy: this.mergeStrategy
    };
  }
}

/**
 * 重叠控制选项
 */
export interface OverlapControlOptions {
  similarityThreshold: number;
  mergeStrategy: 'aggressive' | 'conservative';
  maxOverlapRatio: number;
  enableSmartMerging: boolean;
}