
import { Tree } from 'tree-sitter';

export interface TrackingStats {
  totalNodes: number;
  usedNodes: number;
  reuseCount: number;
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
}

/**
 * AST节点跟踪器 - 跟踪已使用的AST节点，避免重复处理
 */
export class ASTNodeTracker {
  private usedNodes: Set<string> = new Set();
  private nodeCache: Map<string, ASTNode> = new Map();
  private reuseCount: number = 0;
  private maxCacheSize: number;
  private cacheEvictionThreshold: number;

  constructor(maxCacheSize: number = 10000) {
    this.maxCacheSize = maxCacheSize;
    this.cacheEvictionThreshold = Math.floor(maxCacheSize * 0.8); // 80%阈值触发清理
  }

  /**
   * 标记节点为已使用
   */
  markUsed(node: ASTNode): void {
    const nodeId = this.generateNodeId(node);
    this.usedNodes.add(nodeId);
    this.nodeCache.set(nodeId, node);
    this.ensureCacheSize();
  }

  /**
   * 检查节点是否已被使用
   */
  isUsed(node: ASTNode): boolean {
    const nodeId = this.generateNodeId(node);
    if (this.usedNodes.has(nodeId)) {
      this.reuseCount++;
      return true;
    }
    return false;
  }

  /**
   * 检查节点范围是否与已使用的节点重叠
   */
  hasOverlap(node: ASTNode): boolean {
    // 检查字节范围重叠
    for (const usedNodeId of this.usedNodes) {
      const usedNode = this.nodeCache.get(usedNodeId);
      if (usedNode) {
        if (this.rangesOverlap(
          node.startByte, node.endByte,
          usedNode.startByte, usedNode.endByte
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
      if (!this.usedNodes.has(nodeId)) {
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
    this.reuseCount = 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): TrackingStats {
    return {
      totalNodes: this.nodeCache.size,
      usedNodes: this.usedNodes.size,
      reuseCount: this.reuseCount
    };
  }

  /**
   * 生成节点唯一ID
   */
  private generateNodeId(node: ASTNode): string {
    // 使用字节范围和节点类型生成唯一ID，这比依赖可能不稳定的节点引用更可靠
    return `${node.startByte}-${node.endByte}-${node.type}`;
  }

  /**
   * 确保缓存大小在限制范围内
   */
  private ensureCacheSize(): void {
    if (this.nodeCache.size > this.maxCacheSize) {
      // 简单的LRU策略：删除最早添加的条目
      const keys = Array.from(this.nodeCache.keys());
      const keysToRemove = keys.slice(0, keys.length - this.cacheEvictionThreshold);
      
      for (const key of keysToRemove) {
        this.nodeCache.delete(key);
        if (this.usedNodes.has(key)) {
          this.usedNodes.delete(key);
        }
      }
    }
  }

  /**
   * 从AST树中提取节点并过滤已使用的节点
   */
  filterUnusedNodesFromTree(tree: Tree, startLine?: number, endLine?: number): ASTNode[] {
    const allNodes: ASTNode[] = [];
    const root = tree.rootNode;
    
    // 遍历AST树收集所有节点
    const cursor = root.walk();
    this.collectNodes(cursor, allNodes, startLine, endLine);
    
    // 过滤已使用的节点
    return allNodes.filter(node => !this.isUsed(node));
  }

  /**
   * 递归收集节点
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
    
    // 添加当前节点
    const astNode: ASTNode = {
      id: this.generateNodeId({
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
    
    nodes.push(astNode);
    
    // 遍历子节点
    if (cursor.gotoFirstChild()) {
      do {
        this.collectNodes(cursor, nodes, startLine, endLine);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  }
}

 