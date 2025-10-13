import { ASTNode, CodeChunk } from '../types';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';
import { SimilarityDetector } from './SimilarityDetector';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 增强的AST节点跟踪器 - 解决重复分段问题的核心组件
 * 提供精确的节点使用跟踪和内容相似性检测
 */
export class EnhancedASTNodeTracker {
  private usedNodes: Set<string> = new Set();
  private nodeContentMap: Map<string, string> = new Map();
  private contentHashMap: Map<string, Set<string>> = new Map();
  private lineRangeMap: Map<string, Set<string>> = new Map();
  private similarityGroups: Map<string, Set<string>> = new Map();
  private stats = {
    totalNodes: 0,
    usedNodes: 0,
    similarityHits: 0,
    contentHashCollisions: 0,
    lineRangeConflicts: 0
  };

  private similarityThreshold: number;
  private enableContentHash: boolean;
  private enableLineRangeTracking: boolean;
  private logger?: LoggerService;

  constructor(
    options: {
      similarityThreshold?: number;
      enableContentHash?: boolean;
      enableLineRangeTracking?: boolean;
    } = {},
    logger?: LoggerService
  ) {
    this.similarityThreshold = options.similarityThreshold || 0.8;
    this.enableContentHash = options.enableContentHash ?? true;
    this.enableLineRangeTracking = options.enableLineRangeTracking ?? true;
    this.logger = logger;
  }

  /**
   * 标记节点为已使用（增强版）
   */
  markUsed(node: ASTNode): void {
    const nodeId = this.generateConsistentNodeId(node);
    
    // 检查是否已经使用
    if (this.usedNodes.has(nodeId)) {
      return;
    }

    // 检查内容相似性
    if (this.enableContentHash && this.isContentSimilarToExisting(node)) {
      this.stats.similarityHits++;
      this.logger?.debug(`Skipping similar content node: ${nodeId}`);
      return;
    }

    // 检查行范围冲突
    if (this.enableLineRangeTracking && this.hasLineRangeConflict(node)) {
      this.stats.lineRangeConflicts++;
      this.logger?.debug(`Skipping node with line range conflict: ${nodeId}`);
      return;
    }

    // 标记节点为已使用
    this.usedNodes.add(nodeId);
    this.nodeContentMap.set(nodeId, node.text || '');
    
    // 更新内容哈希映射
    if (this.enableContentHash && node.contentHash) {
      const hashPrefix = node.contentHash;
      if (!this.contentHashMap.has(hashPrefix)) {
        this.contentHashMap.set(hashPrefix, new Set());
      }
      this.contentHashMap.get(hashPrefix)!.add(nodeId);
    }

    // 更新行范围映射
    if (this.enableLineRangeTracking && node.startLine && node.endLine) {
      const rangeKey = this.generateRangeKey(node.startLine, node.endLine);
      if (!this.lineRangeMap.has(rangeKey)) {
        this.lineRangeMap.set(rangeKey, new Set());
      }
      this.lineRangeMap.get(rangeKey)!.add(nodeId);
    }

    this.stats.usedNodes++;
    this.stats.totalNodes++;

    this.logger?.debug(`Marked node as used: ${nodeId}`);
  }

  /**
   * 检查节点是否已被使用（增强版）
   */
  isUsed(node: ASTNode): boolean {
    const nodeId = this.generateConsistentNodeId(node);
    
    // 直接检查节点ID
    if (this.usedNodes.has(nodeId)) {
      return true;
    }

    // 检查内容相似性
    if (this.enableContentHash && this.isContentSimilarToExisting(node)) {
      return true;
    }

    // 检查行范围冲突
    if (this.enableLineRangeTracking && this.hasLineRangeConflict(node)) {
      return true;
    }

    return false;
  }

  /**
   * 检查内容是否与现有节点相似
   */
  private isContentSimilarToExisting(node: ASTNode): boolean {
    if (!node.text) return false;

    const nodeContent = node.text.trim();
    
    // 快速预检查：内容哈希
    if (node.contentHash && this.contentHashMap.has(node.contentHash)) {
      const existingNodes = this.contentHashMap.get(node.contentHash)!;
      
      for (const existingId of existingNodes) {
        const existingContent = this.nodeContentMap.get(existingId);
        if (existingContent) {
          const similarity = SimilarityDetector.calculateSimilarity(nodeContent, existingContent);
          if (similarity >= this.similarityThreshold) {
            this.logger?.debug(`Content similarity detected: ${similarity.toFixed(2)}`);
            return true;
          }
        }
      }
    }

    // 精确检查：与所有已使用节点比较
    for (const [existingId, existingContent] of this.nodeContentMap) {
      if (existingContent) {
        const similarity = SimilarityDetector.calculateSimilarity(nodeContent, existingContent);
        if (similarity >= this.similarityThreshold) {
          this.logger?.debug(`Content similarity detected: ${similarity.toFixed(2)}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查行范围冲突
   */
  private hasLineRangeConflict(node: ASTNode): boolean {
    if (!node.startLine || !node.endLine) return false;

    const rangeKey = this.generateRangeKey(node.startLine, node.endLine);
    
    // 检查完全相同的范围
    if (this.lineRangeMap.has(rangeKey)) {
      return true;
    }

    // 检查范围重叠
    for (const [existingRange, existingNodes] of this.lineRangeMap) {
      const existingRangeInfo = this.parseRangeKey(existingRange);
      if (this.doRangesOverlap(
        node.startLine, node.endLine,
        existingRangeInfo.start, existingRangeInfo.end
      )) {
        this.logger?.debug(`Line range overlap detected: ${node.startLine}-${node.endLine} overlaps with ${existingRangeInfo.start}-${existingRangeInfo.end}`);
        return true;
      }
    }

    return false;
  }

  /**
   * 生成一致的节点ID
   */
  private generateConsistentNodeId(node: ASTNode): string {
    if (node.id) {
      return node.id;
    }

    // 基于内容、位置和类型生成一致的ID
    const contentHash = node.contentHash || ContentHashIDGenerator.getContentHashPrefix(node.text || '');
    const positionInfo = `${node.startLine || 0}-${node.endLine || 0}`;
    const typeInfo = node.type || 'unknown';

    return `${typeInfo}:${positionInfo}:${contentHash}`;
  }

  /**
   * 生成范围键
   */
  private generateRangeKey(startLine: number, endLine: number): string {
    return `${startLine}-${endLine}`;
  }

  /**
   * 解析范围键
   */
  private parseRangeKey(rangeKey: string): { start: number; end: number } {
    const [start, end] = rangeKey.split('-').map(Number);
    return { start, end };
  }

  /**
   * 检查两个范围是否重叠
   */
  private doRangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && end1 >= start2;
  }

  /**
   * 检查代码块是否与现有节点冲突
   */
  isChunkConflicting(chunk: CodeChunk): boolean {
    if (!chunk.metadata.startLine || !chunk.metadata.endLine) return false;

    // 创建临时节点来检查冲突
    const tempNode: ASTNode = {
      id: chunk.metadata.nodeIds?.[0] || '',
      type: chunk.metadata.type || 'chunk',
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      startByte: 0,
      endByte: 0,
      text: chunk.content,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(chunk.content)
    };

    return this.isUsed(tempNode);
  }

  /**
   * 标记代码块为已使用
   */
  markChunkUsed(chunk: CodeChunk): void {
    if (!chunk.metadata.startLine || !chunk.metadata.endLine) return;

    // 创建增强的AST节点
    const astNode: ASTNode = {
      id: chunk.metadata.nodeIds?.[0] || this.generateChunkId(chunk),
      type: chunk.metadata.type || 'chunk',
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      startByte: 0,
      endByte: 0,
      text: chunk.content,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(chunk.content)
    };

    this.markUsed(astNode);
  }

  /**
   * 生成代码块ID
   */
  private generateChunkId(chunk: CodeChunk): string {
    const contentHash = ContentHashIDGenerator.getContentHashPrefix(chunk.content);
    const rangeInfo = `${chunk.metadata.startLine || 0}-${chunk.metadata.endLine || 0}`;
    const typeInfo = chunk.metadata.type || 'chunk';

    return `chunk:${typeInfo}:${rangeInfo}:${contentHash}`;
  }

  /**
   * 获取已使用的节点列表
   */
  getUsedNodes(): ASTNode[] {
    const nodes: ASTNode[] = [];
    
    for (const nodeId of this.usedNodes) {
      const content = this.nodeContentMap.get(nodeId);
      if (content) {
        nodes.push({
          id: nodeId,
          type: 'used',
          startByte: 0,
          endByte: 0,
          startLine: 0,
          endLine: 0,
          text: content
        });
      }
    }

    return nodes;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalNodes: number;
    usedNodes: number;
    similarityHits: number;
    contentHashCollisions: number;
    lineRangeConflicts: number;
  } {
    return { ...this.stats };
  }

  /**
   * 获取内容哈希统计信息
   */
  getContentHashStats(): {
    totalHashes: number;
    collisionRate: number;
    averageCollisionsPerHash: number;
  } {
    let totalCollisions = 0;
    let hashesWithCollisions = 0;

    for (const [hash, nodes] of this.contentHashMap) {
      if (nodes.size > 1) {
        hashesWithCollisions++;
        totalCollisions += nodes.size - 1;
      }
    }

    const collisionRate = this.contentHashMap.size > 0 
      ? hashesWithCollisions / this.contentHashMap.size 
      : 0;

    const averageCollisions = hashesWithCollisions > 0 
      ? totalCollisions / hashesWithCollisions 
      : 0;

    return {
      totalHashes: this.contentHashMap.size,
      collisionRate,
      averageCollisionsPerHash: averageCollisions
    };
  }

  /**
   * 清理跟踪器状态
   */
  clear(): void {
    this.usedNodes.clear();
    this.nodeContentMap.clear();
    this.contentHashMap.clear();
    this.lineRangeMap.clear();
    this.similarityGroups.clear();
    
    this.stats = {
      totalNodes: 0,
      usedNodes: 0,
      similarityHits: 0,
      contentHashCollisions: 0,
      lineRangeConflicts: 0
    };

    this.logger?.debug('EnhancedASTNodeTracker cleared');
  }
}