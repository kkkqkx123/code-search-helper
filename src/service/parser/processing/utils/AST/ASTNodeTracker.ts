import { Tree } from 'tree-sitter';
import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { SimilarityUtils } from '../similarity/SimilarityUtils';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ASTNode } from '../../types/ASTNode';

export interface TrackingStats {
  totalNodes: number;
  usedNodes: number;
  reuseCount: number;
  similarityHits: number;
  contentHashCollisions: number;
}

/**
 * AST节点跟踪器 - 支持内容哈希和相似度检测
 * 合并了原始ASTNodeTracker和EnhancedASTNodeTracker的功能
 */
export class ASTNodeTracker {
  private usedNodes: Set<string> = new Set();
  private nodeCache: Map<string, ASTNode> = new Map();
  private contentHashIndex: Map<string, Set<string>> = new Map();
  private similarityIndex: Map<string, Set<string>> = new Map();
  private reuseCount: number = 0;
  private similarityHits: number = 0;
  private hashCollisions: number = 0;
  private maxCacheSize: number;
  private cacheEvictionThreshold: number;
  private enableContentHashing: boolean;
  private similarityThreshold: number;
  private logger?: LoggerService;

  constructor(
    maxCacheSize: number = 10000,
    enableContentHashing: boolean = true,
    similarityThreshold: number = 0.8,
    logger?: LoggerService
  ) {
    this.maxCacheSize = maxCacheSize;
    this.cacheEvictionThreshold = Math.floor(maxCacheSize * 0.8);
    this.enableContentHashing = enableContentHashing;
    this.similarityThreshold = similarityThreshold;
    this.logger = logger;
  }

  /**
   * 标记节点为已使用
   */
  markUsed(node: ASTNode): void {
    const nodeId = this.generateEnhancedNodeId(node);

    if (this.usedNodes.has(nodeId)) {
      this.reuseCount++;
      this.logger?.debug(`Node already used: ${nodeId}`);
      return;
    }

    if (this.enableContentHashing && this.isContentSimilar(node)) {
      this.similarityHits++;
      this.logger?.debug(`Similar content detected, skipping node: ${nodeId}`);
      return;
    }

    this.usedNodes.add(nodeId);
    this.nodeCache.set(nodeId, node);

    if (this.enableContentHashing && node.contentHash) {
      this.updateContentHashIndex(node.contentHash, nodeId);
    }

    if (node.similarityGroup) {
      this.updateSimilarityIndex(node.similarityGroup, nodeId);
    }

    this.ensureCacheSize();
    this.logger?.debug(`Marked node as used: ${nodeId}`);
  }

  /**
   * 检查节点是否已被使用
   */
  isUsed(node: ASTNode): boolean {
    const nodeId = this.generateEnhancedNodeId(node);

    if (this.usedNodes.has(nodeId)) {
      this.reuseCount++;
      return true;
    }

    if (this.enableContentHashing && this.isContentSimilar(node)) {
      this.similarityHits++;
      return true;
    }

    return false;
  }

  /**
   * 检查内容相似性
   */
  private isContentSimilar(node: ASTNode): boolean {
    if (!node.contentHash) {
      node.contentHash = ContentHashIDGenerator.getContentHashPrefix(node.text);
    }

    const similarNodes = this.contentHashIndex.get(node.contentHash);
    if (similarNodes && similarNodes.size > 0) {
      this.hashCollisions++;

      for (const existingNodeId of similarNodes) {
        const existingNode = this.nodeCache.get(existingNodeId);
        if (existingNode && this.usedNodes.has(existingNodeId)) {
          if (SimilarityUtils.isSimilar(node.text, existingNode.text, this.similarityThreshold)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 检查节点范围是否与已使用的节点重叠
   */
  hasOverlap(node: ASTNode): boolean {
    const byteOverlap = this.hasByteOverlap(node);
    if (byteOverlap) {
      return true;
    }

    if (this.enableContentHashing) {
      return this.hasContentOverlap(node);
    }

    return false;
  }

  /**
   * 检查字节范围重叠
   */
  private hasByteOverlap(node: ASTNode): boolean {
    for (const usedNodeId of this.usedNodes) {
      const usedNode = this.nodeCache.get(usedNodeId);
      if (usedNode && this.rangesOverlap(
        node.startByte, node.endByte,
        usedNode.startByte, usedNode.endByte
      )) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查内容重叠（基于相似性）
   */
  private hasContentOverlap(node: ASTNode): boolean {
    if (!node.contentHash) {
      node.contentHash = ContentHashIDGenerator.getContentHashPrefix(node.text);
    }

    const similarNodes = this.contentHashIndex.get(node.contentHash);
    if (!similarNodes || similarNodes.size === 0) {
      return false;
    }

    for (const existingNodeId of similarNodes) {
      const existingNode = this.nodeCache.get(existingNodeId);
      if (existingNode && this.usedNodes.has(existingNodeId)) {
        if (this.rangesOverlap(
          node.startLine, node.endLine,
          existingNode.startLine, existingNode.endLine
        )) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查范围是否重叠
   */
  private rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  /**
   * 获取未使用的节点列表
   */
  getUnusedNodes(): ASTNode[] {
    const unusedNodes: ASTNode[] = [];

    for (const [nodeId, node] of this.nodeCache) {
      if (!this.usedNodes.has(nodeId) && !this.isContentSimilar(node)) {
        unusedNodes.push(node);
      }
    }

    return unusedNodes;
  }

  /**
   * 获取所有已使用的节点
   */
  getUsedNodes(): ASTNode[] {
    const usedNodes: ASTNode[] = [];
    for (const nodeId of this.usedNodes) {
      const node = this.nodeCache.get(nodeId);
      if (node) {
        usedNodes.push(node);
      }
    }
    return usedNodes;
  }

  /**
   * 清空跟踪器
   */
  clear(): void {
    this.usedNodes.clear();
    this.nodeCache.clear();
    this.contentHashIndex.clear();
    this.similarityIndex.clear();
    this.reuseCount = 0;
    this.similarityHits = 0;
    this.hashCollisions = 0;
    this.logger?.debug('ASTNodeTracker cleared');
  }

  /**
   * 获取统计信息
   */
  getStats(): TrackingStats {
    return {
      totalNodes: this.nodeCache.size,
      usedNodes: this.usedNodes.size,
      reuseCount: this.reuseCount,
      similarityHits: this.similarityHits,
      contentHashCollisions: this.hashCollisions
    };
  }

  /**
   * 从AST树中提取节点并过滤已使用的节点
   */
  filterUnusedNodesFromTree(tree: Tree, startLine?: number, endLine?: number): ASTNode[] {
    const allNodes: ASTNode[] = [];
    const root = tree.rootNode;

    const cursor = root.walk();
    this.collectNodes(cursor, allNodes, startLine, endLine);

    return allNodes.filter(node => !this.isUsed(node));
  }

  /**
   * 递归收集节点
   */
  private collectNodes(cursor: any, nodes: ASTNode[], startLine?: number, endLine?: number): void {
    const node = cursor.currentNode;

    if (startLine !== undefined && endLine !== undefined) {
      if (node.endPosition.row < startLine || node.startPosition.row > endLine) {
        if (cursor.gotoFirstChild()) {
          this.collectNodes(cursor, nodes, startLine, endLine);
          cursor.gotoParent();
        }
        return;
      }
    }

    const astNode: ASTNode = {
      id: this.generateEnhancedNodeId({
        startByte: node.startIndex,
        endByte: node.endIndex,
        startLine: node.startPosition.row,
        endLine: node.startPosition.row,
        type: node.type,
        text: node.text
      } as ASTNode),
      type: node.type,
      startByte: node.startIndex,
      endByte: node.endIndex,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      text: node.text
    };

    if (this.enableContentHashing) {
      astNode.contentHash = ContentHashIDGenerator.getContentHashPrefix(node.text);
    }

    nodes.push(astNode);

    if (cursor.gotoFirstChild()) {
      do {
        this.collectNodes(cursor, nodes, startLine, endLine);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }

  /**
   * 生成增强的节点唯一ID
   */
  private generateEnhancedNodeId(node: ASTNode): string {
    if (this.enableContentHashing) {
      return ContentHashIDGenerator.generateNodeId(node);
    } else {
      return `${node.startByte}-${node.endByte}-${node.type}`;
    }
  }

  /**
   * 更新内容哈希索引
   */
  private updateContentHashIndex(contentHash: string, nodeId: string): void {
    if (!this.contentHashIndex.has(contentHash)) {
      this.contentHashIndex.set(contentHash, new Set());
    }
    this.contentHashIndex.get(contentHash)!.add(nodeId);
  }

  /**
   * 更新相似性索引
   */
  private updateSimilarityIndex(similarityGroup: string, nodeId: string): void {
    if (!this.similarityIndex.has(similarityGroup)) {
      this.similarityIndex.set(similarityGroup, new Set());
    }
    this.similarityIndex.get(similarityGroup)!.add(nodeId);
  }

  /**
   * 确保缓存大小在限制范围内
   */
  private ensureCacheSize(): void {
    if (this.nodeCache.size > this.maxCacheSize) {
      const keys = Array.from(this.nodeCache.keys());
      const keysToRemove = keys.slice(0, keys.length - this.cacheEvictionThreshold);

      for (const key of keysToRemove) {
        const node = this.nodeCache.get(key);
        if (node) {
          if (node.contentHash) {
            this.contentHashIndex.get(node.contentHash)?.delete(key);
            if (this.contentHashIndex.get(node.contentHash)?.size === 0) {
              this.contentHashIndex.delete(node.contentHash);
            }
          }

          if (node.similarityGroup) {
            this.similarityIndex.get(node.similarityGroup)?.delete(key);
            if (this.similarityIndex.get(node.similarityGroup)?.size === 0) {
              this.similarityIndex.delete(node.similarityGroup);
            }
          }
        }

        this.nodeCache.delete(key);
        if (this.usedNodes.has(key)) {
          this.usedNodes.delete(key);
        }
      }
    }
  }

  /**
   * 获取内容哈希索引统计
   */
  getContentHashStats(): {
    totalHashes: number;
    totalNodes: number;
    averageNodesPerHash: number;
  } {
    let totalNodes = 0;
    for (const nodes of this.contentHashIndex.values()) {
      totalNodes += nodes.size;
    }

    return {
      totalHashes: this.contentHashIndex.size,
      totalNodes,
      averageNodesPerHash: this.contentHashIndex.size > 0 ? totalNodes / this.contentHashIndex.size : 0
    };
  }
}