import { CodeChunk } from '../../types/CodeChunk';
import { ChunkingOptions } from '../../strategies/types/SegmentationTypes';
import { ASTNodeTracker } from '../AST/ASTNodeTracker';
import { BaseChunkProcessor } from '../base/BaseChunkProcessor';

export class ChunkMerger extends BaseChunkProcessor {
  private options: ChunkingOptions;
  private nodeTracker?: ASTNodeTracker;

  constructor(options: ChunkingOptions, nodeTracker?: ASTNodeTracker) {
    super();
    this.options = options;
    this.nodeTracker = nodeTracker;
  }

  /**
   * 合并重叠的代码块
   */
  async mergeOverlappingChunks(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    const mergedChunks: CodeChunk[] = [];
    let currentMerge: CodeChunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const lastChunk = currentMerge[currentMerge.length - 1];

      if (this.shouldMerge(lastChunk, currentChunk)) {
        currentMerge.push(currentChunk);
      } else {
        // 合并当前累积的块
        if (currentMerge.length > 1) {
          const merged = await this.mergeChunks(currentMerge);
          mergedChunks.push(merged);
        } else {
          mergedChunks.push(currentMerge[0]);
        }
        currentMerge = [currentChunk];
      }
    }

    // 处理最后的累积块
    if (currentMerge.length > 1) {
      const merged = await this.mergeChunks(currentMerge);
      mergedChunks.push(merged);
    } else {
      mergedChunks.push(currentMerge[0]);
    }

    return mergedChunks;
  }

  /**
   * 判断是否应该合并两个块
   */
  shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 检查块是否重叠
    const isOverlapping = this.areChunksOverlapping(chunk1, chunk2);
    
    if (!isOverlapping) {
      return false;
    }

    // 检查合并后的块大小是否合理
    const mergedSize = chunk1.content.length + chunk2.content.length;
    const maxSize = this.options.maxChunkSize || 1000;
    
    if (mergedSize > maxSize) {
      return false;
    }

    // 检查语言是否相同
    if (chunk1.metadata.language !== chunk2.metadata.language) {
      return false;
    }

    // 检查类型兼容性
    if (!this.areTypesCompatible(chunk1.metadata.type, chunk2.metadata.type)) {
      return false;
    }

    // 使用合并决策阈值
    const mergeThreshold = 0.75;
    const similarityScore = this.calculateSimilarity(chunk1, chunk2);
    
    return similarityScore >= mergeThreshold;
  }

  /**
   * 合并多个代码块
   */
  async mergeChunks(chunks: CodeChunk[]): Promise<CodeChunk> {
    if (chunks.length === 1) {
      return chunks[0];
    }

    const contents = chunks.map(chunk => chunk.content);
    const mergedContent = contents.join('\n\n');

    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];

    // 合并元数据
    const mergedMetadata = {
      ...firstChunk.metadata,
      endLine: lastChunk.metadata.endLine,
      type: 'merged' as any,
      complexity: chunks.reduce((sum, chunk) => sum + (chunk.metadata.complexity || 0), 0),
      mergedTypes: chunks.map(chunk => chunk.metadata.type || 'code'),
      mergedCount: chunks.length
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }

  /**
   * 检查两个块是否重叠
   */
  private areChunksOverlapping(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    const end1 = chunk1.metadata.endLine;
    const start2 = chunk2.metadata.startLine;
    
    // 允许一定的间隔重叠
    const overlapThreshold = 50;
    return (start2 - end1) <= overlapThreshold;
  }

  /**
   * 检查类型是否兼容
   */
  private areTypesCompatible(type1?: string, type2?: string): boolean {
    // 相同类型总是兼容
    if (type1 === type2) {
      return true;
    }

    // 定义兼容的类型组合
    const compatibleTypes: Record<string, string[]> = {
      'function': ['method', 'constructor'],
      'class': ['interface', 'type'],
      'import': ['export'],
      'variable': ['constant', 'let']
    };

    // 检查是否在兼容列表中
    if (type1 && compatibleTypes[type1]) {
      return compatibleTypes[type1].includes(type2 || '');
    }

    if (type2 && compatibleTypes[type2]) {
      return compatibleTypes[type2].includes(type1 || '');
    }

    // 默认不兼容
    return false;
  }

  /**
   * 计算两个块的相似度
   */
  private calculateSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    let similarity = 0;

    // 基于类型的相似度
    if (chunk1.metadata.type === chunk2.metadata.type) {
      similarity += 0.3;
    }

    // 基于复杂度的相似度
    const complexity1 = chunk1.metadata.complexity || 0;
    const complexity2 = chunk2.metadata.complexity || 0;
    const maxComplexity = Math.max(complexity1, complexity2);
    if (maxComplexity > 0) {
      const complexityDiff = Math.abs(complexity1 - complexity2) / maxComplexity;
      similarity += (1 - complexityDiff) * 0.2;
    }

    // 基于大小的相似度
    const size1 = chunk1.content.length;
    const size2 = chunk2.content.length;
    const maxSize = Math.max(size1, size2);
    if (maxSize > 0) {
      const sizeDiff = Math.abs(size1 - size2) / maxSize;
      similarity += (1 - sizeDiff) * 0.2;
    }

    // 基于位置的相似度（距离越近越相似）
    const distance = chunk2.metadata.startLine - chunk1.metadata.endLine;
    const maxDistance = 50;
    if (distance >= 0 && distance <= maxDistance) {
      similarity += (1 - distance / maxDistance) * 0.3;
    }

    return Math.min(similarity, 1.0);
  }

  /**
   * 智能合并策略
   */
  async intelligentMerge(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    // 按相似度分组
    const groups = this.groupBySimilarity(chunks);
    
    // 合并每个组
    const mergedChunks: CodeChunk[] = [];
    for (const group of groups) {
      if (group.length > 1) {
        const merged = await this.mergeChunks(group);
        mergedChunks.push(merged);
      } else {
        mergedChunks.push(group[0]);
      }
    }

    return mergedChunks;
  }

  /**
   * 按相似度分组
   */
  private groupBySimilarity(chunks: CodeChunk[]): CodeChunk[][] {
    const groups: CodeChunk[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < chunks.length; i++) {
      if (used.has(i)) continue;

      const group = [chunks[i]];
      used.add(i);

      for (let j = i + 1; j < chunks.length; j++) {
        if (used.has(j)) continue;

        const similarity = this.calculateSimilarity(chunks[i], chunks[j]);
        const threshold = 0.8;
        
        if (similarity >= threshold) {
          group.push(chunks[j]);
          used.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }
}