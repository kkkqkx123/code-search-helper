/**
 * Test fixtures for configuration service
 * This file contains test-specific configurations to avoid hardcoding them in the main service
 */

export const testBatchProcessingConfig = {
  enabled: true,
  maxConcurrentOperations: 5,
  defaultBatchSize: 10,
  maxBatchSize: 100,
  memoryThreshold: 80,
  processingTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  continueOnError: true,
  adaptiveBatching: {
    enabled: true,
    minBatchSize: 1,
    maxBatchSize: 100,
    performanceThreshold: 5000,
    adjustmentFactor: 0.1
  },
  monitoring: {
    enabled: true,
    metricsInterval: 30000,
    alertThresholds: {
      highLatency: 5000,
      lowThroughput: 10,
      highErrorRate: 0.1,
      highMemoryUsage: 80,
      criticalMemoryUsage: 95,
      highCpuUsage: 85,
      criticalCpuUsage: 95
    }
  }
};

export const testProjectConfig = {
  statePath: './data/project-states.json',
  mappingPath: './data/project-mapping.json',
  allowReindex: true
};

export const testIndexingConfig = {
  batchSize: 10,
  maxConcurrency: 3
};

export const testQdrantConfig = {
  host: 'localhost',
  port: 6333,
  apiKey: 'test-api-key',
  timeout: 30000,
  maxRetries: 3,
  connectionString: 'http://localhost:6333',
  collectionName: 'test-collection'
};

export const testEnvironmentConfig = {
  nodeEnv: 'test',
  port: 3000,
  logLevel: 'debug',
  cors: {
    enabled: true,
    origin: '*'
  }
};

export const testLoggingConfig = {
  level: 'debug',
  format: 'json',
  enableConsole: true,
  enableFile: true,
  filename: 'test.log'
};

export const testMonitoringConfig = {
  enabled: true,
  metricsInterval: 10000,
  healthCheckInterval: 30000,
  performanceTracking: true
};

export const testEmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-ada-002',
  apiKey: 'test-api-key',
  maxTokens: 1000,
  timeout: 30000
};

export const testFileProcessingConfig = {
  maxFileSize: 10485760,
  allowedExtensions: ['.ts', '.js', '.json', '.md'],
  processingTimeout: 30000,
  enableValidation: true
};

export const testRedisConfig = {
  enabled: true,
  host: 'localhost',
  port: 6379,
  password: '',
  db: 0,
  keyPrefix: 'test:'
};

export const testLSPConfig = {
  enabled: true,
  port: 3001,
  workspace: './test-workspace',
  languages: ['typescript', 'javascript']
};

export const testSemgrepConfig = {
  enabled: true,
  rulesPath: './test-rules',
  timeout: 30000,
  maxFileSize: 1048576
};

export const testTreeSitterConfig = {
  enabled: true,
  parsers: ['typescript', 'javascript', 'json'],
  highlightEnabled: true,
  queryEnabled: true
};

/**
 * Get test configuration for a specific key
 * This provides a clean interface for test fixtures
 */
export function getTestConfig<T>(key: string): T | undefined {
  switch (key) {
    case 'batchProcessing':
      return testBatchProcessingConfig as T;
    case 'project':
      return testProjectConfig as T;
    case 'indexing':
      return testIndexingConfig as T;
    case 'qdrant':
      return testQdrantConfig as T;
    case 'environment':
      return testEnvironmentConfig as T;
    case 'logging':
      return testLoggingConfig as T;
    case 'monitoring':
      return testMonitoringConfig as T;
    case 'embedding':
      return testEmbeddingConfig as T;
    case 'fileProcessing':
      return testFileProcessingConfig as T;
    case 'redis':
      return testRedisConfig as T;
    case 'lsp':
      return testLSPConfig as T;
    case 'semgrep':
      return testSemgrepConfig as T;
    case 'treeSitter':
      return testTreeSitterConfig as T;
    default:
      return undefined;
  }
}

/**
 * Get all test configurations
 */
export function getAllTestConfigs(): Record<string, any> {
  return {
    batchProcessing: testBatchProcessingConfig,
    project: testProjectConfig,
    indexing: testIndexingConfig,
    qdrant: testQdrantConfig,
    environment: testEnvironmentConfig,
    logging: testLoggingConfig,
    monitoring: testMonitoringConfig,
    embedding: testEmbeddingConfig,
    fileProcessing: testFileProcessingConfig,
    redis: testRedisConfig,
    lsp: testLSPConfig,
    semgrep: testSemgrepConfig,
    treeSitter: testTreeSitterConfig
  };
}