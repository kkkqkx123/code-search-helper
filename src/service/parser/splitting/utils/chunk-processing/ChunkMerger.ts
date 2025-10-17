import { CodeChunk, CodeChunkMetadata, EnhancedChunkingOptions } from '../..';
import { ASTNode, ASTNodeTracker } from '../ASTNodeTracker';
import { BaseChunkProcessor } from '../base/BaseChunkProcessor';

export interface MergeDecision {
  shouldMerge: boolean;
  mergeStrategy: 'combine' | 'replace';
  confidence: number;
  reason?: string;
}

export interface ChunkSimilarity {
  contentSimilarity: number;
  astSimilarity: number;
  proximity: number;
  overall: number;
}

/**
 * 智能块合并器 - 检测并合并重复或重叠的片段
 */
export class ChunkMerger extends BaseChunkProcessor {
  private options: Required<EnhancedChunkingOptions>;
  private nodeTracker?: ASTNodeTracker;

  constructor(options: Required<EnhancedChunkingOptions>, nodeTracker?: ASTNodeTracker) {
    super();
    this.options = options;
    this.nodeTracker = nodeTracker;
  }

  /**
   * 合并重叠的代码块
   */
  mergeOverlappingChunks(chunks: CodeChunk[]): CodeChunk[] {
    if (!this.options.enableChunkDeduplication || chunks.length <= 1) {
      return chunks;
    }

    const mergedChunks: CodeChunk[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < chunks.length; i++) {
      if (usedIndices.has(i)) continue;

      let currentChunk = chunks[i];
      let merged = false;

      // 查找可以与当前块合并的后续块
      for (let j = i + 1; j < chunks.length; j++) {
        if (usedIndices.has(j)) continue;

        const nextChunk = chunks[j];
        const decision = this.decideMerge(currentChunk, nextChunk);

        if (decision.shouldMerge) {
          currentChunk = this.mergeChunks(currentChunk, nextChunk, decision.mergeStrategy);
          usedIndices.add(j);
          merged = true;
        }
      }

      mergedChunks.push(currentChunk);
    }

    return mergedChunks;
  }

  /**
   * 检测重复内容
   */
  detectDuplicateContent(chunks: CodeChunk[]): Map<string, number> {
    const duplicateMap = new Map<string, number>();
    const contentHashes = new Map<string, number>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const contentHash = this.calculateContentHash(chunk.content);

      if (contentHashes.has(contentHash)) {
        const existingIndex = contentHashes.get(contentHash)!;
        const duplicateKey = `${existingIndex}-${i}`;
        const similarity = this.calculateContentSimilarity(chunks[existingIndex], chunk);

        if (similarity > this.options.deduplicationThreshold) {
          duplicateMap.set(duplicateKey, similarity);
        }
      } else {
        contentHashes.set(contentHash, i);
      }
    }

    return duplicateMap;
  }

  /**
   * 计算块相似度
   */
  calculateChunkSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): ChunkSimilarity {
    const contentSim = this.calculateContentSimilarity(chunk1, chunk2);
    const astSim = this.calculateASTSimilarity(chunk1, chunk2);
    const proximity = this.calculateProximity(chunk1.metadata, chunk2.metadata);

    const overall = (contentSim * 0.6) + (astSim * 0.3) + (proximity * 0.1);

    return {
      contentSimilarity: contentSim,
      astSimilarity: astSim,
      proximity: proximity,
      overall
    };
  }

  /**
   * 优化块边界
   */
  optimizeChunkBoundaries(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    return chunks.map(chunk => {
      // 如果启用了AST边界检测，尝试优化边界
      if (this.options.enableASTBoundaryDetection) {
        return this.optimizeSingleChunkBoundary(chunk, originalCode);
      }
      return chunk;
    });
  }

  /**
   * 决定是否合并两个块
   */
  private decideMerge(chunk1: CodeChunk, chunk2: CodeChunk): MergeDecision {
    const similarity = this.calculateChunkSimilarity(chunk1, chunk2);

    // 高相似度：直接替换
    if (similarity.overall > 0.9) {
      return {
        shouldMerge: true,
        mergeStrategy: 'replace',
        confidence: similarity.overall,
        reason: 'Very high similarity'
      };
    }

    // 中等相似度：合并内容
    if (similarity.overall > 0.7) {
      return {
        shouldMerge: true,
        mergeStrategy: 'combine',
        confidence: similarity.overall,
        reason: 'High similarity'
      };
    }

    // 检查是否相邻且有部分重叠
    if (this.areAdjacentAndOverlapping(chunk1, chunk2) && similarity.overall > 0.5) {
      return {
        shouldMerge: true,
        mergeStrategy: 'combine',
        confidence: similarity.overall,
        reason: 'Adjacent and overlapping'
      };
    }

    return {
      shouldMerge: false,
      mergeStrategy: 'combine', // 或者 'replace'，因为 shouldMerge 是 false，这个值不会被使用
      confidence: similarity.overall,
      reason: 'Similarity too low'
    };
  }

  /**
   * 合并两个代码块
   */
  private mergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, strategy: 'combine' | 'replace'): CodeChunk {
    if (strategy === 'replace') {
      // 如果内容高度相似，选择质量更高的块
      return chunk1.content.length > chunk2.content.length ? chunk1 : chunk2;
    }

    // 合并策略：连接两个块的内容
    const mergedContent = chunk1.content + '\n' + chunk2.content;
    const mergedMetadata: CodeChunkMetadata = {
      ...chunk1.metadata,
      endLine: chunk2.metadata.endLine,
      complexity: (chunk1.metadata.complexity || 0) + (chunk2.metadata.complexity || 0)
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }

  /**
   * 计算内容相似度
   */
  private calculateContentSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    const content1 = chunk1.content.trim();
    const content2 = chunk2.content.trim();

    if (content1 === content2) return 1.0;

    // 使用简单的文本相似度算法（Jaccard相似度）
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 计算AST结构相似度（使用节点跟踪器）
   */
  private calculateASTSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    if (!this.nodeTracker) return 0.5; // 如果没有节点跟踪器，返回中性值

    const nodes1 = this.nodeTracker.getUsedNodes().filter(node =>
      node.startLine >= chunk1.metadata.startLine &&
      node.endLine <= chunk1.metadata.endLine
    );

    const nodes2 = this.nodeTracker.getUsedNodes().filter(node =>
      node.startLine >= chunk2.metadata.startLine &&
      node.endLine <= chunk2.metadata.endLine
    );

    if (nodes1.length === 0 && nodes2.length === 0) return 0.5;

    const nodeTypes1 = nodes1.map(n => n.type);
    const nodeTypes2 = nodes2.map(n => n.type);

    const intersection = nodeTypes1.filter(type => nodeTypes2.includes(type));
    const union = [...new Set([...nodeTypes1, ...nodeTypes2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * 计算邻近度
   */
  private calculateProximity(metadata1: CodeChunkMetadata, metadata2: CodeChunkMetadata): number {
    const distance = Math.abs(metadata1.startLine - metadata2.startLine);
    // 距离越近，相似度越高（指数衰减）
    return Math.exp(-distance / 100);
  }

  /**
   * 检查两个块是否相邻且有重叠
   */
  private areAdjacentAndOverlapping(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 检查行号连续性
    const isAdjacent = chunk1.metadata.endLine + 1 >= chunk2.metadata.startLine;

    // 检查内容重叠
    const lines1 = chunk1.content.split('\n');
    const lines2 = chunk2.content.split('\n');

    const overlapThreshold = 0.3; // 30%重叠
    const maxOverlapLines = Math.min(lines1.length, lines2.length) * overlapThreshold;

    // 检查开头和结尾的重叠
    const startOverlap = this.countOverlappingLines(lines1.slice(-5), lines2.slice(0, 5));
    const endOverlap = this.countOverlappingLines(lines2.slice(-5), lines1.slice(0, 5));

    return isAdjacent && (startOverlap > maxOverlapLines || endOverlap > maxOverlapLines);
  }

  /**
   * 计算重叠行数
   */
  private countOverlappingLines(lines1: string[], lines2: string[]): number {
    let count = 0;
    for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
      if (lines1[lines1.length - 1 - i] === lines2[i]) {
        count++;
      }
    }
    return count;
  }

  /**
   * 优化单个块的边界
   */
  private optimizeSingleChunkBoundary(chunk: CodeChunk, originalCode: string): CodeChunk {
    // 暂时返回原块，后续可以实现更复杂的边界优化逻辑
    return chunk;
  }

  /**
   * 计算内容哈希（用于快速重复检测）
   */
  private calculateContentHash(content: string): string {
    // 简单的哈希函数，用于快速比较
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}