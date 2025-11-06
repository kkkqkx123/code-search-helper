/**
 * 基础关系提取器抽象类
 * 提供关系提取的通用接口和基础实现
 */

import Parser from 'tree-sitter';
import { RelationshipResult, RelationshipType, RelationshipCategory, RelationshipTypeMapping } from '../types/RelationshipTypes';
import { SymbolTable } from '../types';

/**
 * 关系提取器配置接口
 */
export interface RelationshipExtractorConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 自定义配置 */
  customConfig?: Record<string, any>;
}

/**
 * 关系提取上下文接口
 */
export interface RelationshipExtractionContext {
  /** 文件路径 */
  filePath: string;
  /** 编程语言 */
  language: string;
  /** 符号表 */
  symbolTable: SymbolTable;
  /** 查询结果 */
  queryResult: any;
  /** AST节点 */
  astNode: Parser.SyntaxNode;
  /** 提取选项 */
  options: Record<string, any>;
}

/**
 * 基础关系提取器抽象类
 */
export abstract class BaseRelationshipExtractor<TMetadata = any> {
  protected config: RelationshipExtractorConfig;
  protected cache: Map<string, RelationshipResult[]> = new Map();
  protected debugMode: boolean;

  constructor(config: RelationshipExtractorConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 100,
      debug: config.debug ?? false,
      customConfig: config.customConfig ?? {}
    };
    this.debugMode = this.config.debug;
  }

  /**
   * 获取提取器名称
   */
  abstract getName(): string;

  /**
   * 获取支持的关系类型
   */
  abstract getSupportedRelationshipTypes(): RelationshipType[];

  /**
   * 获取关系类别
   */
  abstract getRelationshipCategory(): RelationshipCategory;

  /**
   * 检查是否可以处理指定节点
   */
  abstract canHandle(astNode: Parser.SyntaxNode): boolean;

  /**
   * 提取关系（主要方法）
   */
  abstract extractRelationships(context: RelationshipExtractionContext): Promise<RelationshipResult[]>;

  /**
   * 提取关系元数据
   */
  abstract extractMetadata(context: RelationshipExtractionContext): Promise<TMetadata>;

  /**
   * 映射关系类型
   */
  protected abstract mapRelationshipType(internalType: string): RelationshipType;

  /**
   * 验证关系结果
   */
  protected validateRelationship(relationship: RelationshipResult): boolean {
    return !!(
      relationship.source &&
      relationship.target &&
      relationship.type &&
      relationship.category
    );
  }

  /**
   * 创建关系结果
   */
  protected createRelationship(
    source: string,
    target: string,
    type: RelationshipType,
    metadata?: Record<string, any>
  ): RelationshipResult {
    const relationship: RelationshipResult = {
      source,
      target,
      type,
      category: RelationshipTypeMapping.getCategory(type),
      metadata
    };

    if (!this.validateRelationship(relationship)) {
      throw new Error(`Invalid relationship: ${JSON.stringify(relationship)}`);
    }

    return relationship;
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(context: RelationshipExtractionContext): string {
    const { filePath, language, astNode } = context;
    const nodeHash = this.generateNodeHash(astNode);
    return `${this.getName()}:${language}:${filePath}:${nodeHash}`;
  }

  /**
   * 生成节点哈希
   */
  protected generateNodeHash(astNode: Parser.SyntaxNode): string {
    const { type, startPosition, endPosition } = astNode;
    return `${type}:${startPosition.row}:${startPosition.column}-${endPosition.row}:${endPosition.column}`;
  }

  /**
   * 记录调试信息
   */
  protected logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[${this.getName()}] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  protected logError(message: string, error?: Error): void {
    console.error(`[${this.getName()}] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  protected logWarning(message: string, data?: any): void {
    console.warn(`[${this.getName()}] ${message}`, data);
  }

  /**
   * 提取节点名称
   */
  protected extractNodeName(astNode: Parser.SyntaxNode): string | null {
    // 尝试从不同字段提取名称
    const nameFields = ['name', 'identifier', 'field_identifier', 'type_identifier'];
    
    for (const field of nameFields) {
      const nameNode = astNode.childForFieldName(field);
      if (nameNode?.text) {
        return nameNode.text;
      }
    }

    // 尝试从子节点中查找标识符
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text) {
        return child.text;
      }
    }

    return null;
  }

  /**
   * 提取节点内容
   */
  protected extractNodeContent(astNode: Parser.SyntaxNode): string {
    return astNode.text || '';
  }

  /**
   * 查找父节点
   */
  protected findParentNode(astNode: Parser.SyntaxNode, parentType: string): Parser.SyntaxNode | null {
    let current = astNode.parent;
    while (current) {
      if (current.type === parentType) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 查找子节点
   */
  protected findChildNode(astNode: Parser.SyntaxNode, childType: string): Parser.SyntaxNode | null {
    for (const child of astNode.children) {
      if (child.type === childType) {
        return child;
      }
    }
    return null;
  }

  /**
   * 查找所有子节点
   */
  protected findChildNodes(astNode: Parser.SyntaxNode, childType: string): Parser.SyntaxNode[] {
    return astNode.children.filter(child => child.type === childType);
  }

  /**
   * 遍历AST树
   */
  protected traverseAST(
    astNode: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode, depth: number) => void,
    depth: number = 0
  ): void {
    callback(astNode, depth);
    
    for (const child of astNode.children) {
      this.traverseAST(child, callback, depth + 1);
    }
  }

  /**
   * 查找匹配条件的节点
   */
  protected findNodes(
    astNode: Parser.SyntaxNode,
    predicate: (node: Parser.SyntaxNode) => boolean
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];
    
    this.traverseAST(astNode, (node) => {
      if (predicate(node)) {
        results.push(node);
      }
    });
    
    return results;
  }

  /**
   * 检查节点是否在指定位置范围内
   */
  protected isNodeInRange(
    astNode: Parser.SyntaxNode,
    startLine: number,
    endLine: number
  ): boolean {
    const nodeStartLine = astNode.startPosition.row + 1;
    const nodeEndLine = astNode.endPosition.row + 1;
    
    return nodeStartLine >= startLine && nodeEndLine <= endLine;
  }

  /**
   * 计算节点复杂度
   */
  protected calculateNodeComplexity(astNode: Parser.SyntaxNode): number {
    let complexity = 1;
    
    this.traverseAST(astNode, (node, depth) => {
      complexity += Math.min(depth, 10); // 限制深度贡献
    });
    
    return complexity;
  }

  /**
   * 获取节点路径
   */
  protected getNodePath(astNode: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    let current: Parser.SyntaxNode | null = astNode;
    
    while (current) {
      path.unshift(current.type);
      current = current.parent;
    }
    
    return path;
  }

  /**
   * 带缓存的关系提取
   */
  async extractRelationshipsWithCache(context: RelationshipExtractionContext): Promise<RelationshipResult[]> {
    if (!this.config.enableCache) {
      return this.extractRelationships(context);
    }

    const cacheKey = this.generateCacheKey(context);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      this.logDebug('Cache hit', { cacheKey });
      return this.cache.get(cacheKey)!;
    }

    // 提取关系
    const relationships = await this.extractRelationships(context);
    
    // 存储到缓存
    if (this.cache.size >= this.config.cacheSize!) {
      // 简单的LRU：删除第一个元素
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(cacheKey, relationships);
    this.logDebug('Cached relationships', { cacheKey, count: relationships.length });
    
    return relationships;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logDebug('Cache cleared');
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
   * 销毁提取器
   */
  async destroy(): Promise<void> {
    this.clearCache();
    this.logDebug('Extractor destroyed');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 基本健康检查
      const supportedTypes = this.getSupportedRelationshipTypes();
      return supportedTypes.length > 0;
    } catch (error) {
      this.logError('Health check failed', error as Error);
      return false;
    }
  }

  /**
   * 获取提取器信息
   */
  getInfo(): {
    name: string;
    supportedTypes: RelationshipType[];
    category: RelationshipCategory;
    config: RelationshipExtractorConfig;
  } {
    return {
      name: this.getName(),
      supportedTypes: this.getSupportedRelationshipTypes(),
      category: this.getRelationshipCategory(),
      config: this.config
    };
  }
}

/**
 * 关系提取器工厂接口
 */
export interface IRelationshipExtractorFactory {
  /**
   * 创建关系提取器
   */
  create(config: RelationshipExtractorConfig): BaseRelationshipExtractor;
  
  /**
   * 获取支持的提取器类型
   */
  getSupportedTypes(): string[];
}

/**
 * 关系提取器注册表
 */
export class RelationshipExtractorRegistry {
  private extractors: Map<string, IRelationshipExtractorFactory> = new Map();

  /**
   * 注册提取器工厂
   */
  register(name: string, factory: IRelationshipExtractorFactory): void {
    this.extractors.set(name, factory);
  }

  /**
   * 注销提取器工厂
   */
  unregister(name: string): void {
    this.extractors.delete(name);
  }

  /**
   * 创建提取器
   */
  create(name: string, config: RelationshipExtractorConfig = {}): BaseRelationshipExtractor | null {
    const factory = this.extractors.get(name);
    return factory ? factory.create(config) : null;
  }

  /**
   * 获取所有注册的提取器名称
   */
  getRegisteredNames(): string[] {
    return Array.from(this.extractors.keys());
  }

  /**
   * 检查提取器是否已注册
   */
  isRegistered(name: string): boolean {
    return this.extractors.has(name);
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.extractors.clear();
  }
}

// 全局提取器注册表实例
export const globalExtractorRegistry = new RelationshipExtractorRegistry();