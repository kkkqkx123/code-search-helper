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

export interface RedisConfig {
  enabled: boolean;
  url: string;
  maxmemory?: string;
  useMultiLevel: boolean;
  ttl: {
    embedding: number;
    search: number;
    graph: number;
    progress: number;
  };
  retry: {
    attempts: number;
    delay: number;
  };
  pool: {
    min: number;
    max: number;
  };
}

export interface LSPConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  batchSize: number;
  maxConcurrency: number;
  supportedLanguages: string[];
  languageServers: {
    [key: string]: {
      command: string;
      args: string[];
      enabled: boolean;
      workspaceRequired: boolean;
      initializationOptions?: any;
      settings?: any;
    };
  };
}

export interface SemgrepConfig {
  binaryPath: string;
  timeout: number;
  maxMemory: number;
  maxTargetBytes: number;
  jobs: number;
  noGitIgnore: boolean;
  noRewriteRuleIds: boolean;
  strict: boolean;
  configPaths: string[];
  customRulesPath: string;
  enhancedRulesPath: string;
  outputFormat: 'json' | 'sarif' | 'text';
  excludePatterns: string[];
  includePatterns: string[];
  severityLevels: string[];
  enableControlFlow: boolean;
  enableDataFlow: boolean;
  enableTaintAnalysis: boolean;
  securitySeverity: string[];
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
  redis: RedisConfig;
  lsp: LSPConfig;
  semgrep: SemgrepConfig;
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
 }
  
// 导出工具类类型
export { EnvironmentUtils } from './utils/EnvironmentUtils';
export { ValidationUtils } from './utils/ValidationUtils';
export { ConfigValidationDecorator } from './utils/ConfigValidationDecorator';