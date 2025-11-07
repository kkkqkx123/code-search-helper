/**
 * 重叠计算器接口
 * 定义了代码块重叠计算的基本契约
 */
export interface IOverlapCalculator {
  /** 计算器名称 */
  readonly name: string;
  
  /** 计算器版本 */
  readonly version: string;
  
  /** 支持的编程语言列表，'*' 表示支持所有语言 */
  readonly supportedLanguages: string[];
  
  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   * @param options 可选的重叠选项
   * @returns 添加重叠后的代码块数组
   */
  addOverlap(chunks: CodeChunk[], originalCode: string, options?: OverlapOptions): CodeChunk[];
  
  /**
   * 提取重叠内容
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @param originalCode 原始代码
   * @param options 可选的重叠选项
   * @returns 重叠内容字符串
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options?: OverlapOptions
  ): string;
  
  /**
   * 计算最优重叠
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @param originalCode 原始代码
   * @param options 可选的重叠选项
   * @returns 重叠结果
   */
  calculateOptimalOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options?: OverlapOptions
  ): OverlapResult;
  
  /**
   * 验证重叠参数是否有效（可选实现）
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @param options 重叠选项
   * @returns 是否有效
   */
  validateOverlapParams?(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options?: OverlapOptions
  ): boolean;
  
  /**
   * 获取性能统计信息（可选实现）
   * @returns 性能统计
   */
  getPerformanceStats?(): OverlapPerformanceStats;
}

/**
 * 重叠选项接口
 */
export interface OverlapOptions {
  /** 最大重叠大小（字符数） */
  maxSize?: number;
  
  /** 最小重叠行数 */
  minLines?: number;
  
  /** 最大重叠比例（0-1） */
  maxOverlapRatio?: number;
  
  /** 最大重叠行数 */
  maxOverlapLines?: number;
  
  /** 启用AST边界检测 */
  enableASTBoundaryDetection?: boolean;
  
  /** 启用节点感知重叠 */
  enableNodeAwareOverlap?: boolean;
  
  /** 启用智能去重 */
  enableSmartDeduplication?: boolean;
  
  /** 相似度阈值 */
  similarityThreshold?: number;
  
  /** 合并策略 */
  mergeStrategy?: 'aggressive' | 'conservative';
  
  /** 重叠策略 */
  strategy?: OverlapStrategy;
  
  /** 额外选项 */
  [key: string]: any;
}

/**
 * 重叠策略枚举
 */
export enum OverlapStrategy {
  SEMANTIC = 'semantic',
  SYNTACTIC = 'syntactic',
  SIZE_BASED = 'size-based',
  HYBRID = 'hybrid',
  AST_BOUNDARY = 'ast-boundary',
  NODE_AWARE = 'node-aware',
  SMART_DEDUPLICATION = 'smart-deduplication'
}

/**
 * 重叠结果接口
 */
export interface OverlapResult {
  /** 重叠内容 */
  content: string;
  
  /** 重叠行数 */
  lines: number;
  
  /** 使用的策略 */
  strategy: OverlapStrategy;
  
  /** 重叠质量评分（0-1） */
  quality: number;
  
  /** 重叠比例 */
  overlapRatio: number;
  
  /** 使用的AST节点ID列表 */
  astNodesUsed?: string[];
  
  /** 是否为重复块 */
  isDuplicate?: boolean;
  
  /** 重叠元数据 */
  metadata?: OverlapMetadata;
  
  /** 执行时间（毫秒） */
  executionTime?: number;
}

/**
 * 重叠元数据接口
 */
export interface OverlapMetadata {
  /** 重叠类型 */
  overlapType: string;
  
  /** 边界信息 */
  boundaryInfo?: BoundaryInfo;
  
  /** 语义信息 */
  semanticInfo?: SemanticInfo;
  
  /** 上下文信息 */
  contextInfo?: ContextInfo;
  
  /** 额外的元数据 */
  [key: string]: any;
}

/**
 * 边界信息接口
 */
export interface BoundaryInfo {
  /** 边界类型 */
  type: string;
  
  /** 边界强度（0-1） */
  strength: number;
  
  /** 边界位置 */
  position: {
    start: number;
    end: number;
  };
}

/**
 * 语义信息接口
 */
export interface SemanticInfo {
  /** 语义类型 */
  type: string;
  
  /** 语义相关性 */
  relevance: number;
  
  /** 关键符号 */
  symbols: string[];
}

/**
 * 上下文信息接口
 */
export interface ContextInfo {
  /** 上下文类型 */
  type: string;
  
  /** 上下文关系 */
  relationship: string;
  
  /** 上下文相似度 */
  similarity: number;
}

/**
 * 重叠计算器性能统计接口
 */
export interface OverlapPerformanceStats {
  /** 总计算次数 */
  totalCalculations: number;
  
  /** 成功计算次数 */
  successfulCalculations: number;
  
  /** 平均计算时间（毫秒） */
  averageCalculationTime: number;
  
  /** 最后计算时间 */
  lastCalculationTime: number;
  
  /** 错误次数 */
  errorCount: number;
  
  /** 平均重叠大小 */
  averageOverlapSize: number;
  
  /** 平均重叠质量 */
  averageOverlapQuality: number;
}

// 导入相关类型，避免循环依赖
import type { CodeChunk } from '../types/ResultTypes';