/**
 * 节点ID生成器
 * 生成确定性的节点ID，确保同一节点始终生成相同的ID
 */

import Parser from 'tree-sitter';
import { ContentHashUtils } from '../../../../../utils/cache/ContentHashUtils';

/**
 * 节点ID生成器配置接口
 */
export interface NodeIdGeneratorConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** ID前缀 */
  idPrefix?: string;
  /** 哈希算法 */
  hashAlgorithm?: 'simple' | 'djb2' | 'fnv1a';
}

/**
 * 节点信息接口
 */
export interface NodeInfo {
  /** 节点类型 */
  type: string;
  /** 开始位置 */
  startPosition: { row: number; column: number };
  /** 结束位置 */
  endPosition: { row: number; column: number };
  /** 节点文本 */
  text: string;
  /** 父节点类型 */
  parentType?: string;
  /** 节点深度 */
  depth: number;
}

/**
 * 节点ID生成器
 */
export class NodeIdGenerator {
  private config: NodeIdGeneratorConfig;
  private cache: Map<string, string> = new Map();
  private debugMode: boolean;

  constructor(config: NodeIdGeneratorConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 10000,
      debug: config.debug ?? false,
      idPrefix: config.idPrefix ?? 'node',
      hashAlgorithm: config.hashAlgorithm ?? 'djb2'
    };
    this.debugMode = this.config.debug ?? false;
  }

  /**
   * 生成确定性节点ID
   */
  generateDeterministicNodeId(astNode: Parser.SyntaxNode): string {
    if (!astNode) {
      throw new Error('AST node is null or undefined');
    }

    // 生成节点信息
    const nodeInfo = this.extractNodeInfo(astNode);

    // 生成缓存键
    const cacheKey = this.generateCacheKey(nodeInfo);

    // 检查缓存
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      this.logDebug('Node ID cache hit', { nodeType: astNode.type });
      return this.cache.get(cacheKey)!;
    }

    // 生成ID
    const nodeId = this.generateNodeIdFromInfo(nodeInfo);

    // 存储到缓存
    if (this.config.enableCache) {
      this.manageCacheSize();
      this.cache.set(cacheKey, nodeId);
    }

    this.logDebug('Generated node ID', {
      nodeType: astNode.type,
      nodeId,
      cacheHit: false
    });

    return nodeId;
  }

  /**
   * 生成降级节点ID
   */
  generateFallbackNodeId(type: string, name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${this.config.idPrefix}_${type}_${name}_${timestamp}_${random}`;
  }

  /**
   * 提取节点信息
   */
  private extractNodeInfo(astNode: Parser.SyntaxNode): NodeInfo {
    const nodeInfo: NodeInfo = {
      type: astNode.type,
      startPosition: {
        row: astNode.startPosition.row,
        column: astNode.startPosition.column
      },
      endPosition: {
        row: astNode.endPosition.row,
        column: astNode.endPosition.column
      },
      text: astNode.text || '',
      depth: this.calculateNodeDepth(astNode)
    };

    // 添加父节点类型
    if (astNode.parent) {
      nodeInfo.parentType = astNode.parent.type;
    }

    return nodeInfo;
  }

  /**
   * 计算节点深度
   */
  private calculateNodeDepth(astNode: Parser.SyntaxNode): number {
    let depth = 0;
    let current: Parser.SyntaxNode | null = astNode;

    while (current?.parent) {
      depth++;
      current = current.parent;
    }

    return depth;
  }

  /**
   * 从节点信息生成ID
   */
  private generateNodeIdFromInfo(nodeInfo: NodeInfo): string {
    // 构建基础字符串
    const baseString = [
      nodeInfo.type,
      nodeInfo.startPosition.row,
      nodeInfo.startPosition.column,
      nodeInfo.endPosition.row,
      nodeInfo.endPosition.column,
      nodeInfo.parentType || '',
      nodeInfo.depth
    ].join('|');

    // 生成哈希
    const hash = this.generateHash(baseString);

    // 构建最终ID
    return `${this.config.idPrefix}_${nodeInfo.type}_${hash}`;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(nodeInfo: NodeInfo): string {
    return [
      nodeInfo.type,
      nodeInfo.startPosition.row,
      nodeInfo.startPosition.column,
      nodeInfo.endPosition.row,
      nodeInfo.endPosition.column,
      nodeInfo.parentType || '',
      nodeInfo.depth,
      nodeInfo.text.length // 使用文本长度而不是完整文本来节省内存
    ].join('|');
  }

  /**
   * 生成哈希值
   */
  private generateHash(input: string): string {
    switch (this.config.hashAlgorithm) {
      case 'simple':
        return this.simpleHash(input);
      case 'djb2':
        return this.djb2Hash(input);
      case 'fnv1a':
        return this.fnv1aHash(input);
      default:
        return this.djb2Hash(input);
    }
  }

  /**
   * 简单哈希算法
   */
  private simpleHash(str: string): string {
    return ContentHashUtils.generateContentHash(str);
  }

  /**
   * DJB2 哈希算法
   */
  private djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash >>> 0; // 转为无符号32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * FNV-1a 哈希算法
   */
  private fnv1aHash(str: string): string {
    const FNV_PRIME = 16777619;
    const FNV_OFFSET_BASIS = 2166136261;

    let hash = FNV_OFFSET_BASIS;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash *= FNV_PRIME;
      hash = hash >>> 0; // 转为无符号32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 批量生成节点ID
   */
  generateNodeIds(astNodes: Parser.SyntaxNode[]): Record<string, string> {
    const nodeIds: Record<string, string> = {};

    for (const node of astNodes) {
      const nodeId = this.generateDeterministicNodeId(node);
      const nodeKey = this.generateNodeKey(node);
      nodeIds[nodeKey] = nodeId;
    }

    return nodeIds;
  }

  /**
   * 生成节点键
   */
  private generateNodeKey(astNode: Parser.SyntaxNode): string {
    return `${astNode.type}:${astNode.startPosition.row}:${astNode.startPosition.column}`;
  }

  /**
   * 验证节点ID
   */
  validateNodeId(nodeId: string): boolean {
    // 检查ID格式
    const pattern = new RegExp(`^${this.config.idPrefix}_[^_]+_[a-z0-9]+$`);
    return pattern.test(nodeId);
  }

  /**
   * 从节点ID提取信息
   */
  parseNodeId(nodeId: string): { type: string; hash: string } | null {
    if (!this.validateNodeId(nodeId)) {
      return null;
    }

    const parts = nodeId.split('_');
    if (parts.length < 3) {
      return null;
    }

    return {
      type: parts[1],
      hash: parts.slice(2).join('_')
    };
  }

  /**
   * 比较两个节点ID是否来自同一类型的节点
   */
  isSameNodeType(nodeId1: string, nodeId2: string): boolean {
    const info1 = this.parseNodeId(nodeId1);
    const info2 = this.parseNodeId(nodeId2);

    return info1?.type === info2?.type;
  }

  /**
   * 管理缓存大小
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.config.cacheSize!) {
      // 简单的LRU：删除第一个元素
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logDebug('Node ID cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize!
    };
  }

  /**
   * 获取生成器统计
   */
  getStats(): {
    cacheStats: { size: number; maxSize: number };
    config: NodeIdGeneratorConfig;
  } {
    return {
      cacheStats: this.getCacheStats(),
      config: { ...this.config }
    };
  }

  /**
   * 设置配置
   */
  updateConfig(newConfig: Partial<NodeIdGeneratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.debugMode = this.config.debug ?? false;

    // 如果禁用了缓存，清空现有缓存
    if (!this.config.enableCache) {
      this.clearCache();
    }

    this.logDebug('Configuration updated', this.config);
  }

  /**
   * 导出缓存
   */
  exportCache(): Record<string, string> {
    const exported: Record<string, string> = {};
    for (const [key, value] of this.cache) {
      exported[key] = value;
    }
    return exported;
  }

  /**
   * 导入缓存
   */
  importCache(cacheData: Record<string, string>): void {
    this.cache.clear();
    for (const [key, value] of Object.entries(cacheData)) {
      this.cache.set(key, value);
    }

    this.logDebug('Cache imported', {
      entries: Object.keys(cacheData).length
    });
  }

  /**
   * 健康检查
   */
  healthCheck(): { isHealthy: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查配置
    if (this.config.cacheSize! <= 0) {
      issues.push('Cache size must be greater than 0');
    }

    if (!this.config.idPrefix) {
      issues.push('ID prefix cannot be empty');
    }

    // 检查缓存大小
    if (this.cache.size > this.config.cacheSize!) {
      issues.push(`Cache size (${this.cache.size}) exceeds maximum (${this.config.cacheSize})`);
    }

    return {
      isHealthy: issues.length === 0,
      issues
    };
  }

  /**
   * 重置生成器
   */
  reset(): void {
    this.clearCache();
    this.logDebug('Node ID generator reset');
  }

  /**
   * 记录调试信息
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[NodeIdGenerator] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  private logError(message: string, error?: Error): void {
    console.error(`[NodeIdGenerator] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  private logWarning(message: string, data?: any): void {
    console.warn(`[NodeIdGenerator] ${message}`, data);
  }
}

/**
 * 全局节点ID生成器实例
 */
export const globalNodeIdGenerator = new NodeIdGenerator();

/**
 * 便捷函数：生成确定性节点ID
 */
export function generateDeterministicNodeId(astNode: Parser.SyntaxNode): string {
  return globalNodeIdGenerator.generateDeterministicNodeId(astNode);
}

/**
 * 便捷函数：生成降级节点ID
 */
export function generateFallbackNodeId(type: string, name: string): string {
  return globalNodeIdGenerator.generateFallbackNodeId(type, name);
}