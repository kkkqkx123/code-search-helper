export { SimilarityOptions, SimilarityStrategyType, ISimilarityStrategy } from '../../types/SimilarityTypes';
import type { SimilarityOptions, SimilarityStrategyType, ISimilarityStrategy } from '../../types/SimilarityTypes';

/**
 * 协调器接口定义
 */
export interface ISimilarityCoordinator {
  /**
   * 计算相似度（使用逐级降级策略）
   */
  calculateSimilarity(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<SimilarityCoordinationResult>;

  /**
   * 生成执行计划
   */
  generateExecutionPlan(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<ExecutionPlan>;

  /**
   * 获取协调器统计信息
   */
  getCoordinatorStats(): CoordinatorStats;

  /**
   * 注册策略
   */
  registerStrategy(strategy: ISimilarityStrategy): void;
}

/**
 * 相似度协调结果
 */
export interface SimilarityCoordinationResult {
  /**
   * 最终相似度分数
   */
  similarity: number;

  /**
   * 是否相似
   */
  isSimilar: boolean;

  /**
   * 使用的阈值
   */
  threshold: number;

  /**
   * 执行计划
   */
  executionPlan: ExecutionPlan;

  /**
   * 执行详情
   */
  executionDetails: ExecutionDetails;

  /**
   * 策略执行结果
   */
  strategyResults: StrategyExecutionResult[];
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /**
   * 计划ID
   */
  id: string;

  /**
   * 内容分析结果
   */
  contentAnalysis: ContentAnalysisResult;

  /**
   * 策略执行顺序
   */
  strategySequence: StrategyExecutionStep[];

  /**
   * 早期退出阈值
   */
  earlyExitThresholds: EarlyExitThresholds;

  /**
   * 预估执行时间（毫秒）
   */
  estimatedExecutionTime: number;

  /**
   * 创建时间
   */
  createdAt: Date;
}

/**
 * 内容分析结果
 */
export interface ContentAnalysisResult {
  /**
   * 内容类型
   */
  contentType: string;

  /**
   * 内容长度
   */
  contentLength: number;

  /**
   * 内容复杂度
   */
  complexity: ContentComplexity;

  /**
   * 语言类型
   */
  language?: string;

  /**
   * 关键特征
   */
  features: ContentFeature[];

  /**
   * 推荐策略
   */
  recommendedStrategies: SimilarityStrategyType[];
}

/**
 * 内容复杂度
 */
export interface ContentComplexity {
  /**
   * 复杂度分数（0-1）
   */
  score: number;

  /**
   * 复杂度级别
   */
  level: 'low' | 'medium' | 'high';

  /**
   * 影响因素
   */
  factors: string[];
}

/**
 * 内容特征
 */
export interface ContentFeature {
  /**
   * 特征名称
   */
  name: string;

  /**
   * 特征值
   */
  value: any;

  /**
   * 权重
   */
  weight: number;
}

/**
 * 策略执行步骤
 */
export interface StrategyExecutionStep {
  /**
   * 策略类型
   */
  strategy: SimilarityStrategyType;

  /**
   * 执行顺序
   */
  order: number;

  /**
   * 策略成本
   */
  cost: StrategyCost;

  /**
   * 是否必需
   */
  required: boolean;

  /**
   * 执行条件
   */
  condition?: ExecutionCondition;

  /**
   * 权重
   */
  weight: number;
}

/**
 * 策略成本
 */
export interface StrategyCost {
  /**
   * 计算成本（0-1，越高越昂贵）
   */
  computational: number;

  /**
   * 内存成本（0-1）
   */
  memory: number;

  /**
   * 时间成本（预估毫秒）
   */
  time: number;

  /**
   * 总体成本
   */
  total: number;
}

/**
 * 执行条件
 */
export interface ExecutionCondition {
  /**
   * 最小相似度阈值
   */
  minSimilarity?: number;

  /**
   * 最大相似度阈值
   */
  maxSimilarity?: number;

  /**
   * 前置策略结果
   */
  previousStrategyResults?: string[];
}

/**
 * 早期退出阈值
 */
export interface EarlyExitThresholds {
  /**
   * 高相似度阈值（0.9+）
   */
  high: number;

  /**
   * 中相似度阈值（0.7+）
   */
  medium: number;

  /**
   * 低相似度阈值（0.5+）
   */
  low: number;
}

/**
 * 执行详情
 */
export interface ExecutionDetails {
  /**
   * 总执行时间（毫秒）
   */
  totalExecutionTime: number;

  /**
   * 实际执行的策略数量
   */
  executedStrategies: number;

  /**
   * 是否早期退出
   */
  earlyExit: boolean;

  /**
   * 退出原因
   */
  exitReason?: string;

  /**
   * 缓存命中次数
   */
  cacheHits: number;

  /**
   * 错误信息
   */
  errors?: string[];
}

/**
 * 策略执行结果
 */
export interface StrategyExecutionResult {
  /**
   * 策略类型
   */
  strategy: SimilarityStrategyType;

  /**
   * 相似度分数
   */
  similarity: number;

  /**
   * 执行时间（毫秒）
   */
  executionTime: number;

  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 错误信息
   */
  error?: string;

  /**
   * 是否缓存命中
   */
  cacheHit: boolean;

  /**
   * 权重
   */
  weight: number;
}

/**
 * 协调器统计信息
 */
export interface CoordinatorStats {
  /**
   * 总计算次数
   */
  totalCalculations: number;

  /**
   * 平均执行时间（毫秒）
   */
  averageExecutionTime: number;

  /**
   * 早期退出率
   */
  earlyExitRate: number;

  /**
   * 缓存命中率
   */
  cacheHitRate: number;

  /**
   * 策略使用统计
   */
  strategyUsage: Map<SimilarityStrategyType, number>;

  /**
   * 错误率
   */
  errorRate: number;

  /**
   * 最后更新时间
   */
  lastUpdated: Date;
}

/**
 * 执行计划生成器接口
 */
export interface IExecutionPlanGenerator {
  /**
   * 生成执行计划
   */
  generatePlan(
    contentAnalysis: ContentAnalysisResult,
    options?: SimilarityOptions
  ): Promise<ExecutionPlan>;

  /**
   * 获取策略成本信息
   */
  getStrategyCosts(): Map<SimilarityStrategyType, StrategyCost>;

  /**
   * 更新策略成本
   */
  updateStrategyCost(strategy: SimilarityStrategyType, cost: Partial<StrategyCost>): void;
}

/**
 * 内容分析器接口
 */
export interface IContentAnalyzer {
  /**
   * 分析内容特征
   */
  analyzeContent(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<ContentAnalysisResult>;

  /**
   * 检测内容类型
   */
  detectContentType(content: string, language?: string): Promise<string>;

  /**
   * 计算内容复杂度
   */
  calculateComplexity(content: string): ContentComplexity;

  /**
   * 提取内容特征
   */
  extractFeatures(content: string, contentType: string): ContentFeature[];
}

/**
 * 阈值管理器接口
 */
export interface IThresholdManager {
  /**
   * 获取早期退出阈值
   */
  getEarlyExitThresholds(contentType: string): EarlyExitThresholds;

  /**
   * 获取策略阈值
   */
  getStrategyThreshold(strategy: SimilarityStrategyType, contentType: string): number;

  /**
   * 更新阈值
   */
  updateThreshold(
    type: 'earlyExit' | 'strategy',
    key: string | SimilarityStrategyType,
    threshold: number | EarlyExitThresholds
  ): void;

  /**
   * 自适应阈值调整
   */
  adaptThresholds(
    strategy: SimilarityStrategyType,
    contentType: string,
    results: StrategyExecutionResult[]
  ): void;
}