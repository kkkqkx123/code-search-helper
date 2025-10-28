import Parser from 'tree-sitter';
import { CodeChunk, CodeChunkMetadata, ASTNode, ChunkingOptions } from '../processing/types/splitting-types';

// 重新导出类型，以便其他模块可以使用
export type { CodeChunk, CodeChunkMetadata, ASTNode, ChunkingOptions };
export type { IOverlapCalculator } from '../processing/types/splitting-types';

/**
 * 统一的分段策略接口
 * 整合了 IProcessingStrategy、SplitStrategy 和 ChunkingStrategy 的功能
 */
export interface ISplitStrategy {
  /**
   * 执行代码分段（通用分段方法）
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   * @param nodeTracker AST节点跟踪器（可选）
   * @param ast AST树（可选）
   */
  split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
 ): Promise<CodeChunk[]>;

  /**
   * 基于AST的细粒度分段（来自core/strategy）
   * @param ast AST语法树
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   */
  chunkByAST?(
    ast: any,
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]>;

  /**
   * 检查策略是否可以处理给定的语言和节点（来自core/strategy）
   * @param language 编程语言
   * @param node AST语法节点
   */
  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean;

  /**
   * 获取策略名称（用于日志和调试）
   */
  getName(): string;

  /**
   * 检查是否支持该语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 获取策略描述
   */
  getDescription?(): string;

  /**
   * 获取策略支持的节点类型（来自core/strategy）
   * @param language 编程语言
   */
  getSupportedNodeTypes?(language: string): Set<string>;

  /**
   * 验证分段结果的合理性（来自core/strategy）
   * @param chunks 代码块数组
   */
  validateChunks?(chunks: CodeChunk[]): boolean;

  /**
   * 提取代码块关联的AST节点（来自splitting）
   * @param chunk 代码块
   * @param ast AST树
   */
  extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

  /**
   * 检查代码块是否包含已使用的节点（来自splitting）
   * @param chunk 代码块
   * @param nodeTracker 节点跟踪器
   * @param ast AST树
   */
  hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

/**
 * 策略提供者接口
 * 用于创建和管理策略实例
 */
export interface IStrategyProvider {
  /**
   * 获取提供者名称
   */
  getName(): string;

  /**
   * 创建策略实例
   * @param options 分段选项
   */
  createStrategy(options?: ChunkingOptions): ISplitStrategy;

  /**
   * 获取提供者的依赖项
   */
  getDependencies(): string[];

  /**
   * 检查提供者是否支持指定的语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 获取提供者描述
   */
  getDescription(): string;
}

/**
 * 策略配置接口（来自core/strategy）
 */
export interface StrategyConfiguration {
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;

  /** 是否启用缓存 */
  enableCaching?: boolean;

  /** 缓存大小 */
  cacheSize?: number;

  /** 最大执行时间（毫秒） */
  maxExecutionTime?: number;

  /** 是否启用并行处理 */
  enableParallel?: boolean;

  // 通用配置
  [key: string]: any;
}