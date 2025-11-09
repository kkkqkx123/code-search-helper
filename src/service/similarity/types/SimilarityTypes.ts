/**
 * 相似度服务相关类型定义
 */

// 基础相似度选项
export interface SimilarityOptions {
  contentType?: 'code' | 'document' | 'generic';
  language?: string;
  threshold?: number;
  enableCache?: boolean;
  strategy?: SimilarityStrategyType;
}

// 高级相似度选项
export interface AdvancedSimilarityOptions extends SimilarityOptions {
  includeStructure?: boolean;
  includeSemantic?: boolean;
  includeKeywords?: boolean;
  weights?: {
    content?: number;
    structure?: number;
    semantic?: number;
    keywords?: number;
  };
}

// 相似度策略类型
export type SimilarityStrategyType = 'levenshtein' | 'semantic' | 'keyword' | 'structure' | 'hybrid';

// 相似度计算结果
export interface SimilarityResult {
  similarity: number; // 0-1之间的相似度分数
  isSimilar: boolean; // 是否相似（基于阈值）
  threshold: number; // 使用的阈值
  strategy: SimilarityStrategyType; // 使用的策略
  details?: {
    contentSimilarity?: number;
    structureSimilarity?: number;
    semanticSimilarity?: number;
    keywordSimilarity?: number;
    executionTime?: number; // 执行时间（毫秒）
    cacheHit?: boolean; // 是否命中缓存
  };
}

// 批量相似度计算结果
export interface BatchSimilarityResult {
  matrix: number[][]; // 相似度矩阵
  pairs: Array<{
    index1: number;
    index2: number;
    similarity: number;
    isSimilar: boolean;
  }>;
  executionTime: number;
  cacheHits: number;
}

// 相似度策略接口
export interface ISimilarityStrategy {
  readonly name: string;
  readonly type: SimilarityStrategyType;
  
  calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number>;
  isSupported(contentType: string, language?: string): boolean;
  getDefaultThreshold(): number;
}

// 相似度计算器接口
export interface ISimilarityCalculator {
  calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number>;
  calculateBatch(contents: string[], options?: SimilarityOptions): Promise<number[][]>;
  isSupported(strategy: SimilarityStrategyType): boolean;
}

// 缓存管理器接口
export interface ISimilarityCacheManager {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
  }>;
}

// 相似度服务接口
export interface ISimilarityService {
  calculateSimilarity(
    content1: string, 
    content2: string, 
    options?: SimilarityOptions
  ): Promise<SimilarityResult>;
  
  calculateBatchSimilarity(
    contents: string[],
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult>;
  
  calculateAdvancedSimilarity(
    content1: string,
    content2: string,
    options: AdvancedSimilarityOptions
  ): Promise<SimilarityResult>;
  
  isSimilar(
    content1: string,
    content2: string,
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<boolean>;
  
  filterSimilarItems<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<T[]>;
  
  findSimilarityGroups<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<Map<string, T[]>>;
}

// 错误类型
export class SimilarityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SimilarityError';
  }
}

// 缓存键生成器
export interface ICacheKeyGenerator {
  generateKey(content1: string, content2: string, options?: SimilarityOptions): string;
}

// 性能监控接口
export interface ISimilarityPerformanceMonitor {
  startTimer(): () => number;
  recordCalculation(strategy: SimilarityStrategyType, executionTime: number, cacheHit: boolean): void;
  getMetrics(): {
    totalCalculations: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    strategyUsage: Record<SimilarityStrategyType, number>;
  };
}