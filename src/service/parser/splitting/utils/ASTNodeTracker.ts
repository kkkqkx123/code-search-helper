import { Tree } from 'tree-sitter';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';
import { SimilarityDetector } from './SimilarityDetector';

export interface TrackingStats {
  totalNodes: number;
  usedNodes: number;
  reuseCount: number;
  similarityHits: number; // 新增：相似性命中次数
  contentHashCollisions: number; // 新增：内容哈希冲突次数
}

export interface ASTNode {
  id: string;
  type: string;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  text: string;
  parent?: ASTNode;
  children?: ASTNode[];
  contentHash?: string; // 新增：内容哈希
  similarityGroup?: string; // 新增：相似性分组
}

/**
 * 增强的AST节点跟踪器 - 支持内容哈希和相似度检测
 */
export class ASTNodeTracker {
  private usedNodes: Set<string> = new Set();
  private nodeCache: Map<string, ASTNode> = new Map();
  private contentHashIndex: Map<string, Set<string>> = new Map(); // 内容哈希到节点ID的映射
  private similarityIndex: Map<string, Set<string>> = new Map(); // 相似性分组到节点ID的映射
  private reuseCount: number = 0;
  private similarityHits: number = 0;
  private hashCollisions: number = 0;
  private maxCacheSize: number;
  private cacheEvictionThreshold: number;
  private enableContentHashing: boolean;
  private similarityThreshold: number;

  constructor(
    maxCacheSize: number = 10000,
    enableContentHashing: boolean = true,
    similarityThreshold: number = 0.8
  ) {
    this.maxCacheSize = maxCacheSize;
    this.cacheEvictionThreshold = Math.floor(maxCacheSize * 0.8); // 80%阈值触发清理
    this.enableContentHashing = enableContentHashing;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * 标记节点为已使用（增强版）
   */
  markUsed(node: ASTNode): void {
    const nodeId = this.generateEnhancedNodeId(node);
    
    // 检查是否已经使用过
    if (this.usedNodes.has(nodeId)) {
      this.reuseCount++;
      return;
    }

    // 检查内容相似性
    if (this.enableContentHashing && this.isContentSimilar(node)) {
      this.similarityHits++;
      return;
    }

    this.usedNodes.add(nodeId);
    this.nodeCache.set(nodeId, node);
    
    // 更新内容哈希索引
    if (this.enableContentHashing && node.contentHash) {
      this.updateContentHashIndex(node.contentHash, nodeId);
    }

    // 更新相似性索引
    if (node.similarityGroup) {
      this.updateSimilarityIndex(node.similarityGroup, nodeId);
    }

    this.ensureCacheSize();
  }

  /**
   * 检查节点是否已被使用（增强版）
   */
  isUsed(node: ASTNode): boolean {
    const nodeId = this.generateEnhancedNodeId(node);
    
    if (this.usedNodes.has(nodeId)) {
      this.reuseCount++;
      return true;
    }

    // 检查内容相似性
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
      // 如果没有内容哈希，生成一个
      node.contentHash = ContentHashIDGenerator.getContentHashPrefix(node.text);
    }

    // 检查内容哈希索引
    const similarNodes = this.contentHashIndex.get(node.contentHash);
    if (similarNodes && similarNodes.size > 0) {
      this.hashCollisions++;
      
      // 进一步验证内容相似度
      for (const existingNodeId of similarNodes) {
        const existingNode = this.nodeCache.get(existingNodeId);
        if (existingNode && this.usedNodes.has(existingNodeId)) {
          if (SimilarityDetector.isSimilar(node.text, existingNode.text, this.similarityThreshold)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 检查节点范围是否与已使用的节点重叠（增强版）
   */
  hasOverlap(node: ASTNode): boolean {
    // 首先检查字节范围重叠
    const byteOverlap = this.hasByteOverlap(node);
    if (byteOverlap) {
      return true;
    }

    // 检查内容相似性重叠
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
        // 检查行范围重叠
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
   * 获取未使用的节点列表（增强版）
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
   * 查找相似节点组
   */
  findSimilarityGroups(): Map<string, ASTNode[]> {
    const groups = new Map<string, ASTNode[]>();
    
    for (const [nodeId, node] of this.nodeCache) {
      if (node.similarityGroup) {
        if (!groups.has(node.similarityGroup)) {
          groups.set(node.similarityGroup, []);
        }
        groups.get(node.similarityGroup)!.push(node);
      } else if (node.contentHash) {
        // 使用内容哈希作为相似性分组
        const groupKey = `hash-${node.contentHash}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(node);
      }
    }
    
    return groups;
  }

  /**
   * 获取所有已使用的节点（增强版）
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
   * 清空跟踪器（增强版）
   */
  clear(): void {
    this.usedNodes.clear();
    this.nodeCache.clear();
    this.contentHashIndex.clear();
    this.similarityIndex.clear();
    this.reuseCount = 0;
    this.similarityHits = 0;
    this.hashCollisions = 0;
  }

  /**
   * 获取统计信息（增强版）
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
   * 生成增强的节点唯一ID（支持内容哈希）
   */
  private generateEnhancedNodeId(node: ASTNode): string {
    if (this.enableContentHashing) {
      // 使用内容哈希生成ID
      return ContentHashIDGenerator.generateNodeId(node);
    } else {
      // 回退到传统的基于位置的ID
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
   * 确保缓存大小在限制范围内（增强版）
   */
  private ensureCacheSize(): void {
    if (this.nodeCache.size > this.maxCacheSize) {
      // 简单的LRU策略：删除最早添加的条目
      const keys = Array.from(this.nodeCache.keys());
      const keysToRemove = keys.slice(0, keys.length - this.cacheEvictionThreshold);
      
      for (const key of keysToRemove) {
        const node = this.nodeCache.get(key);
        if (node) {
          // 清理相关索引
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
   * 从AST树中提取节点并过滤已使用的节点（增强版）
   */
  filterUnusedNodesFromTree(tree: Tree, startLine?: number, endLine?: number): ASTNode[] {
    const allNodes: ASTNode[] = [];
    const root = tree.rootNode;
    
    // 遍历AST树收集所有节点
    const cursor = root.walk();
    this.collectNodes(cursor, allNodes, startLine, endLine);
    
    // 过滤已使用的节点（包括内容相似的）
    return allNodes.filter(node => !this.isUsed(node));
  }

  /**
   * 递归收集节点（增强版）
   */
  private collectNodes(cursor: any, nodes: ASTNode[], startLine?: number, endLine?: number): void {
    const node = cursor.currentNode;
    
    // 检查行范围限制
    if (startLine !== undefined && endLine !== undefined) {
      if (node.endPosition.row < startLine || node.startPosition.row > endLine) {
        // 如果当前节点不在范围内，检查是否有子节点可能在范围内
        if (cursor.gotoFirstChild()) {
          this.collectNodes(cursor, nodes, startLine, endLine);
          cursor.gotoParent();
        }
        return;
      }
    }
    
    // 创建增强的AST节点
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

    // 添加内容哈希（如果启用）
    if (this.enableContentHashing) {
      astNode.contentHash = ContentHashIDGenerator.getContentHashPrefix(node.text);
    }
    
    nodes.push(astNode);
    
    // 遍历子节点
    if (cursor.gotoFirstChild()) {
      do {
        this.collectNodes(cursor, nodes, startLine, endLine);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
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