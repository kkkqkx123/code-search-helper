import { CodeChunk } from '../../../splitting';
import { BaseSimilarityCalculator } from '../base/BaseSimilarityCalculator';
import { BaseChunkProcessor } from '../base/BaseChunkProcessor';

/**
 * 相似度计算工具类
 * 统一管理所有相似度相关的计算逻辑
 */
export class SimilarityUtils extends BaseSimilarityCalculator {
  /**
   * 过滤相似的代码块
   */
  static filterSimilarChunks(chunks: CodeChunk[], threshold: number = this.DEFAULT_THRESHOLD): CodeChunk[] {
    const uniqueChunks: CodeChunk[] = [];
    const processedContent = new Set<string>();

    for (const chunk of chunks) {
      const normalizedContent = this.normalizeContent(chunk.content);
      let isDuplicate = false;

      // 检查是否与已处理的块相似
      for (const processed of processedContent) {
        if (this.isSimilar(normalizedContent, processed, threshold)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueChunks.push(chunk);
        processedContent.add(normalizedContent);
      }
    }

    return uniqueChunks;
  }

  /**
   * 检查两个代码块是否重复
   */
  static isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 首先检查元数据是否指示重复
    if (chunk1.metadata.nodeIds && chunk2.metadata.nodeIds) {
      const hasCommonNodes = chunk1.metadata.nodeIds.some(id =>
        chunk2.metadata.nodeIds!.includes(id)
      );
      if (hasCommonNodes) return true;
    }

    // 检查内容相似度
    return this.isSimilar(chunk1.content, chunk2.content);
  }

  /**
   * 检查两个块是否可以合并
   */
  static canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, similarityThreshold: number = 0.7): boolean {
    // 检查是否相邻或重叠
    const isAdjacentOrOverlapping =
      (chunk1.metadata.endLine >= chunk2.metadata.startLine - 1) &&
      (chunk2.metadata.endLine >= chunk1.metadata.startLine - 1);

    if (!isAdjacentOrOverlapping) return false;

    // 检查内容相似度
    const contentSimilarity = this.calculateSimilarity(chunk1.content, chunk2.content);
    return contentSimilarity >= similarityThreshold;
  }

  /**
   * 合并两个代码块
   */
  static mergeTwoChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    // 使用基类的合并方法
    return BaseChunkProcessor.mergeTwoChunks(chunk1, chunk2);
  }

  /**
   * 智能合并内容（处理重叠）
   */
  static mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    // 使用基类的合并方法
    return BaseChunkProcessor.mergeContents(content1, content2, startLine1, startLine2);
  }

  /**
   * 检查是否应该创建重叠块
   */
  static shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    similarityThreshold: number = 0.8
  ): boolean {
    for (const existingChunk of existingChunks) {
      if (this.isSimilar(newChunk.content, existingChunk.content, similarityThreshold)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 合并类型
   */
  private static mergeTypes(type1?: string, type2?: string): 'function' | 'code' | 'method' | 'semantic' | 'class' | 'interface' | 'import' | 'generic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | undefined {
    if (type1 === type2) return type1 as any || 'merged';
    if (!type1) return (type2 as any) || 'merged';
    if (!type2) return (type1 as any) || 'merged';

    // 如果两个类型都存在但不同，则返回'merged'
    return 'merged';
  }

  /**
   * 合并节点ID
   */
  private static mergeNodeIds(nodeIds1?: string[], nodeIds2?: string[]): string[] {
    const merged = new Set<string>();

    if (nodeIds1) {
      nodeIds1.forEach(id => merged.add(id));
    }

    if (nodeIds2) {
      nodeIds2.forEach(id => merged.add(id));
    }

    return Array.from(merged);
  }
}