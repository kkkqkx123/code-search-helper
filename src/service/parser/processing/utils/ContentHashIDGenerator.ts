import { createHash } from 'crypto';
import { ASTNode } from '../types/ASTNode';
import { NodeIdGenerator } from '../../../../utils/deterministic-node-id';

/**
 * 内容哈希ID生成器 - 基于代码内容生成唯一ID
 * 解决传统基于位置的ID无法识别内容相似性的问题
 */
export class ContentHashIDGenerator {
  private static readonly CONTENT_HASH_LENGTH = 16; // 使用16字符的哈希前缀
  private static readonly NORMALIZATION_CACHE = new Map<string, string>();
  private static readonly MAX_CACHE_SIZE = 10000;

  /**
   * 为AST节点生成基于内容的唯一ID
   */
  static generateNodeId(node: ASTNode): string {
    const normalizedContent = this.normalizeContent(node.text);
    
    // 使用中央ID生成服务，结合内容哈希和位置信息
    return NodeIdGenerator.forSymbol(
      normalizedContent.substring(0, 50), // 限制长度避免过长
      node.type,
      `content_hash_${node.startByte}-${node.endByte}`,
      0
    );
  }

  /**
   * 为代码块生成基于内容的唯一ID
   */
  static generateChunkId(content: string, startLine: number, endLine: number, type?: string): string {
    const normalizedContent = this.normalizeContent(content);
    
    // 使用中央ID生成服务
    return NodeIdGenerator.forChunk(
      'content_hash_chunk',
      startLine,
      endLine,
      normalizedContent
    );
  }

  /**
   * 生成内容哈希
   */
  private static generateContentHash(content: string): string {
    return createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, this.CONTENT_HASH_LENGTH);
  }

  /**
   * 标准化代码内容用于哈希计算
   * 移除不影响语义的差异，如多余的空白、注释等
   */
  private static normalizeContent(content: string): string {
    // 使用缓存避免重复计算
    if (this.NORMALIZATION_CACHE.has(content)) {
      return this.NORMALIZATION_CACHE.get(content)!;
    }

    let normalized = content;

    // 1. 移除行尾空白
    normalized = normalized.replace(/[ \t]+$/gm, '');

    // 2. 标准化缩进（统一使用空格）
    normalized = normalized.replace(/\t/g, '  ');

    // 3. 移除空行
    normalized = normalized.replace(/\n\s*\n/g, '\n');

    // 4. 移除单行注释（保留重要信息）
    // 注意：这里要谨慎，避免移除重要的文档注释
    normalized = normalized.replace(/\/\/.*$/gm, '');

    // 5. 标准化字符串引号（统一使用双引号）
    normalized = normalized.replace(/'/g, '"');

    // 6. 移除多余的空格
    normalized = normalized.replace(/\s+/g, ' ');

    // 7. 修剪首尾空白
    normalized = normalized.trim();

    // 缓存结果，控制缓存大小
    if (this.NORMALIZATION_CACHE.size >= this.MAX_CACHE_SIZE) {
      // 简单的LRU策略：删除最旧的条目
      const firstKey = this.NORMALIZATION_CACHE.keys().next().value;
      if (firstKey) {
        this.NORMALIZATION_CACHE.delete(firstKey);
      }
    }

    this.NORMALIZATION_CACHE.set(content, normalized);
    return normalized;
  }

  /**
   * 快速内容相似度检查（基于哈希前缀）
   * 用于快速判断两个内容是否可能相似
   */
  static isPotentiallySimilar(content1: string, content2: string): boolean {
    const normalized1 = this.normalizeContent(content1);
    const normalized2 = this.normalizeContent(content2);

    const hash1 = this.generateContentHash(normalized1);
    const hash2 = this.generateContentHash(normalized2);

    return hash1 === hash2;
  }

  /**
   * 获取内容哈希的前缀（用于快速比较）
   */
  static getContentHashPrefix(content: string): string {
    const normalized = this.normalizeContent(content);
    return this.generateContentHash(normalized);
  }

  /**
   * 清理缓存（内存管理）
   */
  static clearCache(): void {
    this.NORMALIZATION_CACHE.clear();
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats(): {
    cacheSize: number;
    maxCacheSize: number;
    hitRate: number;
  } {
    return {
      cacheSize: this.NORMALIZATION_CACHE.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      hitRate: 0 // 可以扩展实现实际的命中率统计
    };
  }
}

/**
 * 增强的AST节点，包含内容哈希信息
 */
export interface EnhancedASTNode extends ASTNode {
  contentHash: string;
  similarityGroup?: string; // 相似性分组标识
}