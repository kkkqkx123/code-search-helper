import * as Joi from 'joi';

// 基础配置验证模式
export const environmentSchema = Joi.object({
  nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),
});

// Qdrant配置验证模式
export const qdrantSchema = Joi.object({
  host: Joi.string().hostname().default('localhost'),
  port: Joi.number().port().default(6333),
  collection: Joi.string().default('code-snippets'),
  apiKey: Joi.string().optional(),
  useHttps: Joi.boolean().default(false),
  timeout: Joi.number().default(30000),
});

// Embedding配置验证模式
export const embeddingSchema = Joi.object({
  provider: Joi.string()
    .valid('openai', 'ollama', 'gemini', 'mistral', 'siliconflow')
    .default('openai'),
  weights: Joi.object({
    quality: Joi.number().min(0).max(1).default(0.7),
    performance: Joi.number().min(0).max(1).default(0.3),
  }).optional(),
});

// Logging配置验证模式
export const loggingSchema = Joi.object({
  level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  format: Joi.string().valid('json', 'text').default('json'),
});

// Monitoring配置验证模式
export const monitoringSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  port: Joi.number().port().default(9090),
  prometheusTargetDir: Joi.string().default('./etc/prometheus'),
});

// FileProcessing配置验证模式
export const fileProcessingSchema = Joi.object({
  maxFileSize: Joi.number().positive().default(10485760),
  supportedExtensions: Joi.string().default('.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h'),
  indexBatchSize: Joi.number().positive().default(100),
  chunkSize: Joi.number().positive().default(1000),
  overlapSize: Joi.number().positive().default(200),
});

// BatchProcessing配置验证模式
export const batchProcessingSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  maxConcurrentOperations: Joi.number().positive().default(5),
  defaultBatchSize: Joi.number().positive().default(50),
  maxBatchSize: Joi.number().positive().default(500),
  memoryThreshold: Joi.number().positive().default(80), // percentage
  processingTimeout: Joi.number().positive().default(300000), // 5 minutes
  retryAttempts: Joi.number().positive().default(3),
  retryDelay: Joi.number().positive().default(1000), // 1 second
  continueOnError: Joi.boolean().default(true),
  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    metricsInterval: Joi.number().positive().default(60000), // 1 minute
    alertThresholds: Joi.object({
      highLatency: Joi.number().positive().default(5000), // ms
      highErrorRate: Joi.number().positive().default(0.1), // 10%
      highMemoryUsage: Joi.number().positive().default(80), // percentage
    }),
  }),
});

// MLReranking配置验证模式
export const mlRerankingSchema = Joi.object({
  modelPath: Joi.string().optional(),
  modelType: Joi.string().valid('linear', 'neural', 'ensemble').default('linear'),
  features: Joi.array()
    .items(Joi.string())
    .default([
      'semanticScore',
      'graphScore',
      'contextualScore',
      'recencyScore',
      'popularityScore',
      'originalScore',
    ]),
  trainingEnabled: Joi.boolean().default(true),
}).optional();

// Caching配置验证模式
export const cachingSchema = Joi.object({
  defaultTTL: Joi.number().positive().default(300), // 5 minutes
  maxSize: Joi.number().positive().default(1000),
  cleanupInterval: Joi.number().positive().default(600000), // 10 minutes
}).optional();


// Project配置验证模式
export const projectSchema = Joi.object({
  statePath: Joi.string().default('./data/project-states.json'),
  mappingPath: Joi.string().default('./data/project-mapping.json'),
  allowReindex: Joi.boolean().default(true),
});

// Indexing配置验证模式
export const indexingSchema = Joi.object({
  batchSize: Joi.number().positive().default(50),
  maxConcurrency: Joi.number().positive().default(3),
});



// TreeSitter配置验证模式
export const treeSitterSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  cacheSize: Joi.number().positive().default(1000),
  timeout: Joi.number().positive().default(30000),
  supportedLanguages: Joi.array()
    .items(Joi.string())
    .default([
      'typescript',
      'javascript',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c'
    ])
}).optional();

// 主配置验证模式
export const mainConfigSchema = Joi.object({
  nodeEnv: environmentSchema.extract('nodeEnv'),
  port: environmentSchema.extract('port'),
  qdrant: qdrantSchema,
  embedding: embeddingSchema,
  logging: loggingSchema,
  monitoring: monitoringSchema,
  fileProcessing: fileProcessingSchema,
  batchProcessing: batchProcessingSchema,
  mlReranking: mlRerankingSchema,
  caching: cachingSchema,
  project: projectSchema,
  indexing: indexingSchema,
  treeSitter: treeSitterSchema,
});