import { CodeChunk } from '../types';

/**
 * 相似度计算工具类
 * 统一管理所有相似度相关的计算逻辑
 */
export class SimilarityUtils {
  private static readonly DEFAULT_THRESHOLD = 0.8;

  /**
   * 检查两个内容是否相似
   */
  static isSimilar(content1: string, content2: string, threshold: number = this.DEFAULT_THRESHOLD): boolean {
    const similarity = this.calculateSimilarity(content1, content2);
    return similarity >= threshold;
  }

  /**
   * 计算两个内容的相似度
   */
  static calculateSimilarity(content1: string, content2: string): number {
    if (!content1 || !content2) return 0;
    
    // 标准化内容
    const normalized1 = this.normalizeContent(content1);
    const normalized2 = this.normalizeContent(content2);
    
    if (normalized1 === normalized2) return 1.0;
    
    // 使用编辑距离计算相似度
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
  }

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
    // 确定合并后的范围
    const startLine = Math.min(chunk1.metadata.startLine, chunk2.metadata.startLine);
    const endLine = Math.max(chunk1.metadata.endLine, chunk2.metadata.endLine);
    
    // 智能合并内容（处理重叠）
    const mergedContent = this.mergeContents(
      chunk1.content, 
      chunk2.content,
      chunk1.metadata.startLine,
      chunk2.metadata.startLine
    );

    // 合并元数据
    const mergedMetadata = {
      ...chunk1.metadata,
      startLine,
      endLine,
      type: this.mergeTypes(chunk1.metadata.type, chunk2.metadata.type),
      nodeIds: this.mergeNodeIds(chunk1.metadata.nodeIds, chunk2.metadata.nodeIds)
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }

  /**
   * 智能合并内容（处理重叠）
   */
  static mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // 如果chunk2在chunk1之后，直接拼接
    if (startLine2 > startLine1 + lines1.length) {
      return content1 + '\n' + content2;
    }

    // 如果有重叠，智能处理重叠部分
    const overlapStart = Math.max(0, startLine1 + lines1.length - startLine2);
    const overlapEnd = Math.min(lines2.length, startLine1 + lines1.length - startLine2);

    if (overlapStart < overlapEnd) {
      // 有重叠部分，使用chunk1的内容（优先级更高）
      const nonOverlapLines2 = lines2.slice(overlapEnd);
      return lines1.join('\n') + '\n' + nonOverlapLines2.join('\n');
    } else {
      // 没有重叠，直接拼接
      return content1 + '\n' + content2;
    }
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
   * 标准化内容（用于相似度计算）
   */
  private static normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // 标准化空白字符
      .replace(/\/\/.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .replace(/\s+/g, ' ') // 再次标准化空白字符
      .trim()
      .toLowerCase();
  }

  /**
   * 计算编辑距离（Levenshtein距离）
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // 删除
          matrix[j - 1][i] + 1, // 插入
          matrix[j - 1][i - 1] + indicator // 替换
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 合并类型
   */
  private static mergeTypes(type1?: string, type2?: string): string {
    if (type1 === type2) return type1 || 'merged';
    if (!type1) return type2 || 'merged';
    if (!type2) return type1 || 'merged';
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