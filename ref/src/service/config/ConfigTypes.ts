// Environment Configuration Layer
export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  debug: boolean;
  corsEnabled: boolean;
  maxRequestBodySize: string;
}

// Service Configuration Layer
export interface ServiceConfig {
  database: DatabaseConfig;
  embedding: EmbeddingConfig;
  monitoring: MonitoringConfig;
  search: SearchConfig;
  processing: ProcessingConfig;
  storage: StorageConfig;
}

export interface DatabaseConfig {
  vector: VectorDatabaseConfig;
  graph: GraphDatabaseConfig;
  connectionPool: ConnectionPoolConfig;
}

export interface VectorDatabaseConfig {
  host: string;
  port: number;
  apiKey?: string;
  timeout: number;
  maxConnections: number;
  retryAttempts: number;
  retryDelay: number;
  indexName: string;
  dimension: number;
}

export interface GraphDatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout: number;
  maxConnections: number;
  retryAttempts: number;
  retryDelay: number;
  database: string;
  space?: string;
  partitionNum?: number;
  replicaFactor?: number;
  vidType?: string;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  createTimeoutMs: number;
  destroyTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
  createRetryIntervalMs: number;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'ollama' | 'gemini' | 'mistral' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeout: number;
  maxRetries: number;
  batchSize: number;
  maxTokens: number;
  temperature: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number;
  memoryThreshold: number;
  cpuThreshold: number;
  eventLoopThreshold: number;
  metricsEnabled: boolean;
  healthCheckEnabled: boolean;
  prometheusEnabled: boolean;
  prometheusPort: number;
}

export interface SearchConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultThreshold: number;
  includeGraph: boolean;
  useHybrid: boolean;
  useLSP: boolean;
  useReranking: boolean;
  lspSearchTypes: ('symbol' | 'definition' | 'reference' | 'diagnostic')[];
  includeDiagnostics: boolean;
  lspTimeout: number;
  weights: {
    semantic: number;
    keyword: number;
    graph: number;
    lsp: number;
  };
  cacheEnabled: boolean;
  cacheTtl: number;
}

export interface ProcessingConfig {
  batchProcessing: BatchProcessingConfig;
  chunking: ChunkingConfig;
  parsing: ParsingConfig;
}

export interface BatchProcessingConfig {
  enabled: boolean;
  defaultBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  maxConcurrentOperations: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;
  adaptiveBatching: {
    enabled: boolean;
    performanceThreshold: number;
    adjustmentFactor: number;
    maxBatchSize: number;
    minBatchSize: number;
  };
}

export interface ChunkingConfig {
  defaultChunkSize: number;
  overlapSize: number;
  maxChunkSize: number;
  minChunkSize: number;
  chunkByLanguage: boolean;
  preserveStructure: boolean;
}

export interface ParsingConfig {
  enabledLanguages: string[];
  timeout: number;
  maxFileSize: number;
  includePatterns: string[];
  excludePatterns: string[];
  extractComments: boolean;
  extractMetadata: boolean;
}

export interface StorageConfig {
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli' | 'none';
    level: number;
  };
  caching: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    strategy: 'lru' | 'lfu' | 'fifo';
  };
  backup: {
    enabled: boolean;
    interval: number;
    retention: number;
    location: string;
  };
}

// Feature Configuration Layer
export interface FeatureConfig {
  indexing: IndexingFeatureConfig;
  search: SearchFeatureConfig;
  monitoring: MonitoringFeatureConfig;
  api: ApiFeatureConfig;
  staticAnalysis: StaticAnalysisFeatureConfig;
}

// Static Analysis Configuration
export interface StaticAnalysisFeatureConfig {
  enabled: boolean;
  defaultTool: 'semgrep';
  scanOnChange: boolean;
  batchSize: number;
  resultRetentionDays: number;
  semgrep: SemgrepConfig;
}

export interface SemgrepConfig {
  enabled: boolean;
  cliPath: string;
  rulesDir: string;
  defaultRules: string[];
  timeout: number;
  maxTargetBytes: number;
  maxConcurrentScans: number;
  cacheEnabled: boolean;
  cacheTtl: number;
}

export interface IndexingFeatureConfig {
  autoIndex: boolean;
  watchMode: boolean;
  incrementalUpdates: boolean;
  deduplication: boolean;
  parallelProcessing: boolean;
}

export interface SearchFeatureConfig {
  semanticSearch: boolean;
  keywordSearch: boolean;
  fuzzySearch: boolean;
  regexSearch: boolean;
  graphSearch: boolean;
  hybridSearch: boolean;
  reranking: boolean;
  faceting: boolean;
  aggregation: boolean;
}

export interface MonitoringFeatureConfig {
  metrics: boolean;
  logging: boolean;
  tracing: boolean;
  alerting: boolean;
  dashboard: boolean;
}

export interface ApiFeatureConfig {
  rest: boolean;
  graphql: boolean;
  websocket: boolean;
  mcp: boolean;
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };
  authentication: {
    enabled: boolean;
    type: 'jwt' | 'api-key' | 'oauth';
  };
}

// Security Configuration Layer
export interface SecurityConfig {
  encryption: EncryptionConfig;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  rateLimit: RateLimitConfig;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotationDays: number;
  atRest: boolean;
  inTransit: boolean;
}

export interface AuthenticationConfig {
  enabled: boolean;
  method: 'jwt' | 'api-key' | 'oauth' | 'basic';
  tokenExpiry: number;
  refreshExpiry: number;
  issuer: string;
  audience: string;
}

export interface AuthorizationConfig {
  enabled: boolean;
  method: 'rbac' | 'abac' | 'acl';
  defaultRole: string;
  roleHierarchy: string[];
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: string;
  handler: string;
}

// Complete Configuration
export interface CompleteConfig {
  environment: EnvironmentConfig;
  services: ServiceConfig;
  features: FeatureConfig;
  security: SecurityConfig;
}

// Configuration Factory Types
export type ConfigSection =
  | 'environment'
  | 'services'
  | 'features'
  | 'security'
  | 'services.database'
  | 'services.embedding'
  | 'services.monitoring'
  | 'services.search'
  | 'services.processing'
  | 'services.storage'
  | 'features.indexing'
  | 'features.search'
  | 'features.monitoring'
  | 'features.api'
  | 'security.encryption'
  | 'security.authentication'
  | 'security.authorization'
  | 'security.rateLimit';

export interface ConfigFactory {
  getConfig<T>(section: ConfigSection): T;
  updateConfig<T>(section: ConfigSection, updates: Partial<T>): void;
  reloadConfig(): void;
  exportConfig(): CompleteConfig;
  validateConfig(): boolean;
}
