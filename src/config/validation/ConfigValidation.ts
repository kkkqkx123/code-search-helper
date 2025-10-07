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

// Redis配置验证模式
export const redisSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  url: Joi.string().uri().default('redis://localhost:6379'),
  maxmemory: Joi.string().default('256mb'),
  useMultiLevel: Joi.boolean().default(true),
  ttl: Joi.object({
    embedding: Joi.number().default(86400),
    search: Joi.number().default(3600),
    graph: Joi.number().default(1800),
    progress: Joi.number().default(300),
  }),
  retry: Joi.object({
    attempts: Joi.number().default(3),
    delay: Joi.number().default(1000),
  }),
  pool: Joi.object({
    min: Joi.number().default(1),
    max: Joi.number().default(10),
  }),
});

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

// LSP配置验证模式
export const lspSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  timeout: Joi.number().positive().default(30000),
  retryAttempts: Joi.number().positive().default(3),
  retryDelay: Joi.number().positive().default(100),
  cacheEnabled: Joi.boolean().default(true),
  cacheTTL: Joi.number().positive().default(300),
  batchSize: Joi.number().positive().default(20),
  maxConcurrency: Joi.number().positive().default(5),
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
      'c',
      'csharp',
      'php',
      'ruby',
    ]),
  languageServers: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        command: Joi.string().required(),
        args: Joi.array().items(Joi.string()).default([]),
        enabled: Joi.boolean().default(true),
        workspaceRequired: Joi.boolean().default(true),
        initializationOptions: Joi.object().optional(),
        settings: Joi.object().optional(),
      })
    )
    .default({}),
});

// Semgrep配置验证模式
export const semgrepSchema = Joi.object({
  binaryPath: Joi.string().default('semgrep'),
  timeout: Joi.number().positive().default(3000),
  maxMemory: Joi.number().positive().default(512),
  maxTargetBytes: Joi.number().positive().default(1000000),
  jobs: Joi.number().positive().default(4),
  noGitIgnore: Joi.boolean().default(false),
  noRewriteRuleIds: Joi.boolean().default(false),
  strict: Joi.boolean().default(false),
  configPaths: Joi.array()
    .items(Joi.string())
    .default([
      'auto',
      'p/security-audit',
      'p/secrets',
      'p/owasp-top-ten',
      'p/javascript',
      'p/python',
      'p/java',
      'p/go',
      'p/typescript',
    ]),
  customRulesPath: Joi.string().default('./config/semgrep-rules'),
  enhancedRulesPath: Joi.string().default('./enhanced-rules'),
  enableControlFlow: Joi.boolean().default(false),
  enableDataFlow: Joi.boolean().default(false),
  enableTaintAnalysis: Joi.boolean().default(false),
  securitySeverity: Joi.array().items(Joi.string()).default(['HIGH', 'MEDIUM']),
  outputFormat: Joi.string().valid('json', 'sarif', 'text').default('json'),
  excludePatterns: Joi.array()
    .items(Joi.string())
    .default([
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '*.min.js',
      '*.min.css',
      'vendor',
      'test/fixtures',
      'tests/fixtures',
    ]),
  includePatterns: Joi.array()
    .items(Joi.string())
    .default([
      '*.js',
      '*.ts',
      '*.jsx',
      '*.tsx',
      '*.py',
      '*.java',
      '*.go',
      '*.php',
      '*.rb',
      '*.cs',
    ]),
  severityLevels: Joi.array().items(Joi.string()).default(['ERROR', 'WARNING', 'INFO']),
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
  redis: redisSchema,
  project: projectSchema,
  indexing: indexingSchema,
  lsp: lspSchema,
  semgrep: semgrepSchema,
  treeSitter: treeSitterSchema,
});