/**
 * 配置类型定义
 * 定义了处理配置相关的类型
 */

/**
 * 处理配置接口
 */
export interface ProcessingConfig {
  /** 分块配置 */
  chunking: ChunkingConfig;

  /** 特征配置 */
  features: FeatureConfig;

  /** 性能配置 */
  performance: PerformanceConfig;

  /** 语言特定配置 */
  languages: Record<string, LanguageConfig>;

  /** 后处理配置 */
  postProcessing: PostProcessingConfig;

  /** 全局设置 */
  global: GlobalConfig;
}

/**
 * 分块配置接口
 */
export interface ChunkingConfig {
  /** 最大块大小（字符数） */
  maxChunkSize: number;

  /** 最小块大小（字符数） */
  minChunkSize: number;

  /** 重叠大小（字符数） */
  overlapSize: number;

  /** 每块最大行数 */
  maxLinesPerChunk: number;

  /** 每块最小行数 */
  minLinesPerChunk: number;

  /** 最大重叠比例（0-1） */
  maxOverlapRatio: number;

  /** 默认策略 */
  defaultStrategy: string;

  /** 策略优先级 */
  strategyPriorities: Record<string, number>;

  /** 启用智能分块 */
  enableIntelligentChunking: boolean;

  /** 启用语义边界检测 */
  enableSemanticBoundaryDetection: boolean;
}

/**
 * 特征配置接口
 */
export interface FeatureConfig {
  /** 启用AST解析 */
  enableAST: boolean;

  /** 启用语义检测 */
  enableSemanticDetection: boolean;

  /** 启用括号平衡检测 */
  enableBracketBalance: boolean;

  /** 启用代码重叠检测 */
  enableCodeOverlap: boolean;

  /** 启用标准化 */
  enableStandardization: boolean;

  /** 标准化回退 */
  standardizationFallback: boolean;

  /** 启用复杂度计算 */
  enableComplexityCalculation: boolean;

  /** 启用语言特征检测 */
  enableLanguageFeatureDetection: boolean;

  /** 特征检测阈值 */
  featureDetectionThresholds: Record<string, number>;
}

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  /** 内存限制（MB） */
  memoryLimitMB: number;

  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;

  /** 启用缓存 */
  enableCaching: boolean;

  /** 缓存大小限制 */
  cacheSizeLimit: number;

  /** 启用性能监控 */
  enablePerformanceMonitoring: boolean;

  /** 并发处理限制 */
  concurrencyLimit: number;

  /** 队列大小限制 */
  queueSizeLimit: number;

  /** 启用批处理 */
  enableBatchProcessing: boolean;

  /** 批处理大小 */
  batchSize: number;

  /** 启用懒加载 */
  enableLazyLoading: boolean;
}

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  /** 语言名称 */
  name: string;

  /** 边界配置 */
  boundaries: BoundaryConfig;

  /** 权重配置 */
  weights: WeightConfig;

  /** 语言特定分块配置 */
  chunking: LanguageChunkingConfig;

  /** 语言特征配置 */
  features: LanguageFeatureConfig;

  /** 文件扩展名 */
  extensions: string[];

  /** MIME类型 */
  mimeTypes: string[];

  /** 是否启用 */
  enabled: boolean;
}

/**
 * 边界配置接口
 */
export interface BoundaryConfig {
  /** 强边界模式 */
  strongBoundaries: string[];

  /** 弱边界模式 */
  weakBoundaries: string[];

  /** 忽略边界模式 */
  ignoreBoundaries: string[];

  /** 自定义边界规则 */
  customRules: BoundaryRule[];
}

/**
 * 边界规则接口
 */
export interface BoundaryRule {
  /** 规则名称 */
  name: string;

  /** 正则表达式 */
  pattern: RegExp;

  /** 边界强度（0-1） */
  strength: number;

  /** 规则描述 */
  description?: string;
}

/**
 * 权重配置接口
 */
export interface WeightConfig {
  /** 语义权重 */
  semantic: number;

  /** 语法权重 */
  syntax: number;

  /** 结构权重 */
  structure: number;

  /** 长度权重 */
  length: number;

  /** 复杂度权重 */
  complexity: number;

  /** 自定义权重 */
  custom: Record<string, number>;
}

/**
 * 语言特定分块配置接口
 */
export interface LanguageChunkingConfig {
  /** 默认块大小 */
  defaultChunkSize: number;

  /** 最大块大小 */
  maxChunkSize: number;

  /** 最小块大小 */
  minChunkSize: number;

  /** 首选策略 */
  preferredStrategy: string;

  /** 语言特定规则 */
  specificRules: LanguageSpecificRule[];
}

/**
 * 语言特定规则接口
 */
export interface LanguageSpecificRule {
  /** 规则名称 */
  name: string;

  /** 规则类型 */
  type: 'chunking' | 'boundary' | 'post-processing';

  /** 规则条件 */
  condition: string;

  /** 规则动作 */
  action: string;

  /** 规则优先级 */
  priority: number;
}

/**
 * 语言特征配置接口
 */
export interface LanguageFeatureConfig {
  /** 启用的特征 */
  enabledFeatures: string[];

  /** 禁用的特征 */
  disabledFeatures: string[];

  /** 特征参数 */
  featureParams: Record<string, any>;

  /** 自定义特征检测器 */
  customDetectors: string[];
}

/**
 * 后处理配置接口
 */
export interface PostProcessingConfig {
  /** 是否启用 */
  enabled: boolean;

  /** 启用的处理器列表 */
  enabledProcessors: string[];

  /** 处理器配置 */
  processorConfigs: Record<string, any>;

  /** 处理器执行顺序 */
  processorOrder: string[];

  /** 最大处理轮数 */
  maxProcessingRounds: number;

  /** 启用并行处理 */
  enableParallelProcessing: boolean;

  /** 并行处理限制 */
  parallelProcessingLimit: number;
}

/**
 * 全局配置接口
 */
export interface GlobalConfig {
  /** 调试模式 */
  debugMode: boolean;

  /** 日志级别 */
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';

  /** 启用指标收集 */
  enableMetrics: boolean;

  /** 启用统计信息 */
  enableStatistics: boolean;

  /** 配置版本 */
  configVersion: string;

  /** 兼容性模式 */
  compatibilityMode: boolean;

  /** 严格模式 */
  strictMode: boolean;

  /** 实验性功能 */
  experimentalFeatures: string[];

  /** 自定义属性 */
  customProperties: Record<string, any>;
}

/**
 * 配置验证规则接口
 */
export interface ConfigValidationRule {
  /** 规则名称 */
  name: string;

  /** 规则路径 */
  path: string;

  /** 验证函数 */
  validator: (value: any) => boolean;

  /** 错误消息 */
  errorMessage: string;

  /** 规则优先级 */
  priority: number;
}

/**
 * 配置预设接口
 */
export interface ConfigPreset {
  /** 预设名称 */
  name: string;

  /** 预设描述 */
  description: string;

  /** 预设配置 */
  config: Partial<ProcessingConfig>;

  /** 适用语言 */
  applicableLanguages: string[];

  /** 预设标签 */
  tags: string[];
}

/**
 * 配置迁移接口
 */
export interface ConfigMigration {
  /** 源版本 */
  fromVersion: string;

  /** 目标版本 */
  toVersion: string;

  /** 迁移函数 */
  migrate: (config: any) => ProcessingConfig;

  /** 迁移描述 */
  description: string;
}