// 配置类型定义，专注于当前项目需求
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
  openai: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  ollama: {
    baseUrl: string;
    model: string;
    dimensions: number;
  };
  gemini: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  mistral: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
 };
  siliconflow: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  custom?: {
    custom1?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
    custom2?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
    custom3?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
  };
  qualityWeight?: number;
  performanceWeight?: number;
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
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;
  adaptiveBatching: {
    enabled: boolean;
    minBatchSize: number;
    maxBatchSize: number;
    performanceThreshold: number;
    adjustmentFactor: number;
  };
 monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      lowThroughput: number;
      highErrorRate: number;
      highMemoryUsage: number;
      criticalMemoryUsage: number;
      highCpuUsage: number;
      criticalCpuUsage: number;
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

export interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
}

export interface AppConfig {
  environment: EnvironmentConfig;
  qdrant: QdrantConfig;
  embedding: EmbeddingConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  fileProcessing: FileProcessingConfig;
  batchProcessing: BatchProcessingConfig;
  redis: RedisConfig;
  lsp: LSPConfig;
  semgrep: SemgrepConfig;
  mlReranking?: MLRerankingConfig;
  caching: CachingConfig;
 indexing: IndexingConfig;
  nebula?: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
  performance?: {
    cleanupInterval?: number;
    retentionPeriod?: number;
  };
 cache?: {
    ttl?: number;
    maxEntries?: number;
    cleanupInterval?: number;
  };
  fusion?: {
    vectorWeight?: number;
    graphWeight?: number;
    contextualWeight?: number;
    recencyWeight?: number;
    popularityWeight?: number;
  };
}