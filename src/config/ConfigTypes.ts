// 配置类型定义，专注于当前项目需求
export interface ProjectNamingConfig {
  qdrant: {
    defaultCollection: string;
    namingPattern: string;
  };
  nebula: {
    defaultSpace: string;
    namingPattern: string;
  };
}

export interface QdrantConfig {
  host: string;
  port: number;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
  collection: string;
}

export interface EmbeddingConfig {
  provider: string;
  weights?: {
    quality?: number;
    performance?: number;
  };
  providerConfig?: any; // Simplified to use provider factory pattern
}


export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  debug: boolean;
}

export interface LoggingConfig {
  level: string;
  format: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  port: number;
  prometheusTargetDir: string;
}

export interface MemoryMonitorConfig {
  /** 是否启用监控 */
  enabled: boolean;
  /** 警告阈值（0-1） */
  warningThreshold: number;
  /** 严重阈值（0-1） */
  criticalThreshold: number;
  /** 紧急阈值（0-1） */
  emergencyThreshold: number;
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 清理冷却时间（毫秒） */
  cleanupCooldown: number;
  /** 历史记录最大数量 */
  maxHistorySize: number;
}

export interface FileProcessingConfig {
  maxFileSize: number;
  supportedExtensions: string;
  indexBatchSize: number;
  chunkSize: number;
  overlapSize: number;
}

export interface BatchProcessingConfig {
  enabled: boolean;
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  minSize?: number;
  adjustmentFactor?: number;
  performanceThreshold?: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;
  monitoring?: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      highMemoryUsage: number;
      highErrorRate: number;
      lowThroughput?: number;
    };
  };
}


export interface MLRerankingConfig {
  modelPath?: string;
  modelType: 'linear' | 'neural' | 'ensemble';
  features: string[];
  trainingEnabled: boolean;
}

export interface CachingConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
}

export interface GraphCacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 默认TTL（秒） */
  defaultTTL: number;
  /** 最大内存使用（字节） */
  maxMemory: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值（字节） */
  compressionThreshold: number;
  /** 是否启用统计 */
  enableStats: boolean;
  /** 压缩级别（1-9） */
  compressionLevel: number;
}

export interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
}

export interface TreeSitterConfig {
  enabled: boolean;
  cacheSize: number;
  timeout: number;
  supportedLanguages: string[];
}

export interface ProjectConfig {
  statePath: string;
  mappingPath?: string;
  allowReindex?: boolean;
}

export interface PerformanceConfig {
  cleanupInterval?: number;
  retentionPeriod?: number;
}

export interface CacheConfig {
  ttl?: number;
  maxEntries?: number;
  cleanupInterval?: number;
}

export interface FusionConfig {
  vectorWeight?: number;
  graphWeight?: number;
  contextualWeight?: number;
  recencyWeight?: number;
  popularityWeight?: number;
}

export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  space?: string;
  bufferSize?: number;
  pingInterval?: number;
  vidTypeLength?: number;
}

export interface SimilarityConfig {
  provider: string;
  apiKey?: string;
  baseUrl: string;
  model: string;
  dimensions: number;
}

export interface EmbeddingBatchConfig {
  defaultBatchSize: number;
  providerBatchLimits: {
    openai: number;
    siliconflow: number;
    ollama: number;
    gemini: number;
    mistral: number;
    custom1: number;
    custom2: number;
    custom3: number;
    similarity: number;
  };
}

export interface HotReloadConfig {
  enabled: boolean;
  debounceInterval: number;
  maxFileSize: number;
  maxConcurrentProjects: number;
  enableDetailedLogging: boolean;
  errorHandling: {
    maxRetries: number;
    alertThreshold: number;
    autoRecovery: boolean;
  };
}

export interface AppConfig {
  environment: EnvironmentConfig;
  qdrant: QdrantConfig;
  embedding: EmbeddingConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  memoryMonitor: MemoryMonitorConfig;
  fileProcessing: FileProcessingConfig;
  batchProcessing: BatchProcessingConfig;
  mlReranking?: MLRerankingConfig;
  caching: CachingConfig;
  indexing: IndexingConfig;
  nebula?: NebulaConfig;
  performance?: PerformanceConfig;
  cache?: CacheConfig;
  fusion?: FusionConfig;
  project?: ProjectConfig;
  projectNaming?: ProjectNamingConfig;
  treeSitter?: TreeSitterConfig;
  embeddingBatch: EmbeddingBatchConfig;
  hotReload: HotReloadConfig;
  graphCache?: GraphCacheConfig;
  similarity: SimilarityConfig;
}
// ==================== Segmentation Configuration ====================

/**
 * 分段配置模式枚举
 */
export enum SegmentationMode {
  DEFAULT = 'default',
  HIGH_PERFORMANCE = 'high-performance',
  HIGH_QUALITY = 'high-quality',
}

/**
 * 降级策略配置
 */
export interface FallbackStrategyConfig {
  /** 是否启用降级 */
  enableFallback: boolean;
  /** 降级阈值 (0-1) */
  fallbackThreshold: number;
  /** 降级策略列表 */
  strategies: string[];
}

/**
 * 语言特定的分段配置
 */
export interface LanguageSpecificSegmentationConfig {
  /** 最大分段大小 */
  maxChunkSize: number;
  /** 最小分段大小 */
  minChunkSize: number;
  /** 最大嵌套级别 */
  maxNestingLevel: number;
  /** 是否保留注释 */
  preserveComments: boolean;
  /** 是否保留空行 */
  preserveEmptyLines: boolean;
}

/**
 * 统一的分段配置接口
 */
export interface SegmentationConfig {
  // 全局分段设置 (合并自 UnifiedConfigManager)
  global: {
    /** 最小分段大小 */
    minChunkSize: number;
    /** 最大分段大小 */
    maxChunkSize: number;
    /** 分段重叠大小 */
    chunkOverlap: number;
    /** 每个分段的最小行数 */
    minLinesPerChunk: number;
    /** 每个分段的最大行数 */
    maxLinesPerChunk: number;
  };

  // 性能设置 (合并自 UnifiedConfigManager 和 ASTSplitterConfig)
  performance: {
    /** 最大文件大小（字节） */
    maxFileSize: number;
    /** 最大解析时间（毫秒） */
    maxParseTime: number;
    /** 是否启用缓存 */
    enableCaching: boolean;
    /** 最大缓存大小 */
    maxCacheSize: number;
    /** 是否启用并行处理 */
    enableParallel: boolean;
    /** 并行处理线程数 */
    parallelThreads: number;
  };

  // 嵌套提取控制 (来自 ASTSplitterConfig)
  nesting: {
    /** 是否启用嵌套提取 */
    enableNestedExtraction: boolean;
    /** 最大嵌套级别 */
    maxNestingLevel: number;
  };

  // 降级策略配置
  fallback: FallbackStrategyConfig;

  // 语言特定配置
  languageSpecific: {
    [language: string]: LanguageSpecificSegmentationConfig;
  };
}

// 导出工具类类型
export { EnvironmentUtils } from './utils/EnvironmentUtils';
export { ValidationUtils } from './utils/ValidationUtils';
export { ConfigValidationDecorator } from './utils/ConfigValidationDecorator';