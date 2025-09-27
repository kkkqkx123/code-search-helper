import { injectable } from 'inversify';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import { AppConfig } from './ConfigTypes';

dotenv.config();

// 配置验证模式
const configSchema = Joi.object({
  nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),

  qdrant: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(633),
    collection: Joi.string().default('code-snippets'),
    apiKey: Joi.string().optional(),
    useHttps: Joi.boolean().default(false),
    timeout: Joi.number().default(30000),
  }),

  embedding: Joi.object({
    provider: Joi.string()
      .valid(
        'openai',
        'ollama',
        'gemini',
        'mistral',
        'siliconflow',
        'custom1',
        'custom2',
        'custom3'
      )
      .default('openai'),
    openai: Joi.object({
      apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'openai', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('text-embedding-ada-002'),
      dimensions: Joi.number().positive().default(1536),
    }),
    ollama: Joi.object({
      baseUrl: Joi.string().uri().default('http://localhost:1434'),
      model: Joi.string().default('nomic-embed-text'),
      dimensions: Joi.number().positive().default(768),
    }),
    gemini: Joi.object({
      apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'gemini', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('embedding-001'),
      dimensions: Joi.number().positive().default(768),
    }),
    mistral: Joi.object({
      apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'mistral', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('mistral-embed'),
      dimensions: Joi.number().positive().default(1024),
    }),
    siliconflow: Joi.object({
      apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'siliconflow', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('BAAI/bge-large-en-v1.5'),
      dimensions: Joi.number().positive().default(1024),
    }),
    custom: Joi.object({
      custom1: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768),
      }),
      custom2: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768),
      }),
      custom3: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768),
      }),
    }).optional(),
    qualityWeight: Joi.number().min(0).max(1).default(0.7),
    performanceWeight: Joi.number().min(0).max(1).default(0.3),
  }),

  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'text').default('json'),
 }),

  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    port: Joi.number().port().default(9090),
    prometheusTargetDir: Joi.string().default('./etc/prometheus'),
  }),

  fileProcessing: Joi.object({
    maxFileSize: Joi.number().positive().default(10485760),
    supportedExtensions: Joi.string().default('.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h'),
    indexBatchSize: Joi.number().positive().default(100),
    chunkSize: Joi.number().positive().default(1000),
    overlapSize: Joi.number().positive().default(200),
  }),

  batchProcessing: Joi.object({
    enabled: Joi.boolean().default(true),
    maxConcurrentOperations: Joi.number().positive().default(5),
    defaultBatchSize: Joi.number().positive().default(50),
    maxBatchSize: Joi.number().positive().default(500),
    memoryThreshold: Joi.number().positive().default(80), // percentage
    processingTimeout: Joi.number().positive().default(300000), // 5 minutes
    retryAttempts: Joi.number().positive().default(3),
    retryDelay: Joi.number().positive().default(1000), // 1 second
    continueOnError: Joi.boolean().default(true),
    adaptiveBatching: Joi.object({
      enabled: Joi.boolean().default(true),
      minBatchSize: Joi.number().positive().default(10),
      maxBatchSize: Joi.number().positive().default(200),
      performanceThreshold: Joi.number().positive().default(1000), // ms
      adjustmentFactor: Joi.number().positive().default(1.2),
    }),
    monitoring: Joi.object({
      enabled: Joi.boolean().default(true),
      metricsInterval: Joi.number().positive().default(6000), // 1 minute
      alertThresholds: Joi.object({
        highLatency: Joi.number().positive().default(5000), // ms
        lowThroughput: Joi.number().positive().default(10), // operations/sec
        highErrorRate: Joi.number().positive().default(0.1), // 10%
        highMemoryUsage: Joi.number().positive().default(80), // percentage
        criticalMemoryUsage: Joi.number().positive().default(90), // percentage
        highCpuUsage: Joi.number().positive().default(70), // percentage
        criticalCpuUsage: Joi.number().positive().default(85), // percentage
      }),
    }),
  }),
  mlReranking: Joi.object({
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
  }).optional(),

  caching: Joi.object({
    defaultTL: Joi.number().positive().default(300), // 5 minutes
    maxSize: Joi.number().positive().default(1000),
  }).optional(),

  redis: Joi.object({
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
  }),

  indexing: Joi.object({
    batchSize: Joi.number().positive().default(50),
    maxConcurrency: Joi.number().positive().default(3),
  }),
  lsp: Joi.object({
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
  }),

  semgrep: Joi.object({
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
  }),
});

export interface Config {
  nodeEnv: string;
  port: number;
  qdrant: {
    host: string;
    port: number;
    collection: string;
    apiKey?: string;
    useHttps: boolean;
    timeout: number;
  };
  embedding: {
    provider: string;
    openai: {
      apiKey: string;
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
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    mistral: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    siliconflow: {
      apiKey: string;
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
  };
  logging: {
    level: string;
    format: string;
  };
  monitoring: {
    enabled: boolean;
    port: number;
    prometheusTargetDir: string;
  };
  fileProcessing: {
    maxFileSize: number;
    supportedExtensions: string;
    indexBatchSize: number;
    chunkSize: number;
    overlapSize: number;
  };
  batchProcessing: {
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
  };
  mlReranking?: {
    modelPath?: string;
    modelType: 'linear' | 'neural' | 'ensemble';
    features: string[];
    trainingEnabled: boolean;
  };
  caching: {
    defaultTTL: number;
    maxSize: number;
 };
  indexing: {
    batchSize: number;
    maxConcurrency: number;
  };
  lsp: {
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
  };
  semgrep: {
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
  };
  redis: {
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
  nebula?: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
}

@injectable()
export class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  constructor() {
    const rawConfig = {
      nodeEnv: process.env.NODE_ENV,
      port: parseInt(process.env.PORT || '3000'),
      qdrant: {
        host: process.env.QDRANT_HOST,
        port: parseInt(process.env.QDRANT_PORT || '633'),
        collection: process.env.QDRANT_COLLECTION,
        apiKey: process.env.QDRANT_API_KEY,
        useHttps: process.env.QDRANT_USE_HTTPS === 'true',
        timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER,
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL,
          dimensions: parseInt(process.env.OPENAI_DIMENSIONS || '1536'),
        },
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL,
          dimensions: parseInt(process.env.OLLAMA_DIMENSIONS || '768'),
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
          baseUrl: process.env.GEMINI_BASE_URL,
          model: process.env.GEMINI_MODEL,
          dimensions: parseInt(process.env.GEMINI_DIMENSIONS || '768'),
        },
        mistral: {
          apiKey: process.env.MISTRAL_API_KEY,
          baseUrl: process.env.MISTRAL_BASE_URL,
          model: process.env.MISTRAL_MODEL,
          dimensions: parseInt(process.env.MISTRAL_DIMENSIONS || '1024'),
        },
        siliconflow: {
          apiKey: process.env.SILICONFLOW_API_KEY,
          baseUrl: process.env.SILICONFLOW_BASE_URL,
          model: process.env.SILICONFLOW_MODEL,
          dimensions: parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024'),
        },
        custom: {
          custom1: {
            apiKey: process.env.CUSTOM_CUSTOM1_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM1_BASE_URL,
            model: process.env.CUSTOM_CUSTOM1_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM1_DIMENSIONS
              ? parseInt(process.env.CUSTOM_CUSTOM1_DIMENSIONS)
              : undefined,
          },
          custom2: {
            apiKey: process.env.CUSTOM_CUSTOM2_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM2_BASE_URL,
            model: process.env.CUSTOM_CUSTOM2_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM2_DIMENSIONS
              ? parseInt(process.env.CUSTOM_CUSTOM2_DIMENSIONS)
              : undefined,
          },
          custom3: {
            apiKey: process.env.CUSTOM_CUSTOM3_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM3_BASE_URL,
            model: process.env.CUSTOM_CUSTOM3_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM3_DIMENSIONS
              ? parseInt(process.env.CUSTOM_CUSTOM3_DIMENSIONS)
              : undefined,
          },
        },
        qualityWeight: process.env.QUALITY_WEIGHT
          ? parseFloat(process.env.QUALITY_WEIGHT)
          : undefined,
        performanceWeight: process.env.PERFORMANCE_WEIGHT
          ? parseFloat(process.env.PERFORMANCE_WEIGHT)
          : undefined,
      },
      logging: {
        level: process.env.LOG_LEVEL,
        format: process.env.LOG_FORMAT,
      },
      monitoring: {
        enabled: process.env.ENABLE_METRICS === 'true',
        port: parseInt(process.env.METRICS_PORT || '9090'),
        prometheusTargetDir: process.env.PROMETHEUS_TARGET_DIR || './etc/prometheus',
      },
      fileProcessing: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
        supportedExtensions: process.env.SUPPORTED_EXTENSIONS,
        indexBatchSize: parseInt(process.env.INDEX_BATCH_SIZE || '10'),
        chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
        overlapSize: parseInt(process.env.OVERLAP_SIZE || '200'),
      },
      batchProcessing: {
        enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
        maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPERATIONS || '5'),
        defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
        maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500'),
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
        processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000'),
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
        continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',
        adaptiveBatching: {
          enabled: process.env.ADAPTIVE_BATCHING_ENABLED !== 'false',
          minBatchSize: parseInt(process.env.MIN_BATCH_SIZE || '10'),
          maxBatchSize: parseInt(process.env.ADAPTIVE_MAX_BATCH_SIZE || '200'),
          performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '1000'),
          adjustmentFactor: parseFloat(process.env.ADJUSTMENT_FACTOR || '1.2'),
        },
        monitoring: {
          enabled: process.env.BATCH_MONITORING_ENABLED !== 'false',
          metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
          alertThresholds: {
            highLatency: parseInt(process.env.HIGH_LATENCY_THRESHOLD || '5000'),
            lowThroughput: parseInt(process.env.LOW_THROUGHPUT_THRESHOLD || '10'),
            highErrorRate: parseFloat(process.env.HIGH_ERROR_RATE_THRESHOLD || '0.1'),
            highMemoryUsage: parseInt(process.env.HIGH_MEMORY_USAGE_THRESHOLD || '80'),
            criticalMemoryUsage: parseInt(process.env.CRITICAL_MEMORY_USAGE_THRESHOLD || '90'),
            highCpuUsage: parseInt(process.env.HIGH_CPU_USAGE_THRESHOLD || '70'),
            criticalCpuUsage: parseInt(process.env.CRITICAL_CPU_USAGE_THRESHOLD || '85'),
          },
        },
      },
      caching:
        process.env.CACHE_DEFAULT_TTL || process.env.CACHE_MAX_SIZE
          ? {
              defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
              maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
            }
          : undefined,
      indexing: {
        batchSize: parseInt(process.env.INDEXING_BATCH_SIZE || '50'),
        maxConcurrency: parseInt(process.env.INDEXING_MAX_CONCURRENCY || '3'),
      },
      semgrep: {
        binaryPath: process.env.SEMGREP_BINARY_PATH || 'semgrep',
        timeout: parseInt(process.env.SEMGREP_TIMEOUT || '30000'),
        maxMemory: parseInt(process.env.SEMGREP_MAX_MEMORY || '512'),
        maxTargetBytes: parseInt(process.env.SEMGREP_MAX_TARGET_BYTES || '1000000'),
        jobs: parseInt(process.env.SEMGREP_JOBS || '4'),
        noGitIgnore: process.env.SEMGREP_NO_GIT_IGNORE === 'true',
        noRewriteRuleIds: process.env.SEMGREP_NO_REWRITE_RULE_IDS === 'true',
        strict: process.env.SEMGREP_STRICT === 'true',
        configPaths: process.env.SEMGREP_CONFIG_PATHS
          ? process.env.SEMGREP_CONFIG_PATHS.split(',')
          : [
              'auto',
              'p/security-audit',
              'p/secrets',
              'p/owasp-top-ten',
              'p/javascript',
              'p/python',
              'p/java',
              'p/go',
              'p/typescript',
            ],
        customRulesPath: process.env.SEMGREP_CUSTOM_RULES_PATH || './config/semgrep-rules',
        enableControlFlow: process.env.SEMGREP_ENABLE_CONTROL_FLOW !== 'false',
        enableDataFlow: process.env.SEMGREP_ENABLE_DATA_FLOW !== 'false',
        enableTaintAnalysis: process.env.SEMGREP_ENABLE_TAINT_ANALYSIS !== 'false',
        securitySeverity: process.env.SEMGREP_SECURITY_SEVERITY
          ? process.env.SEMGREP_SECURITY_SEVERITY.split(',')
          : ['HIGH', 'MEDIUM'],
        outputFormat: (process.env.SEMGREP_OUTPUT_FORMAT as 'json' | 'sarif' | 'text') || 'json',
        excludePatterns: process.env.SEMGREP_EXCLUDE_PATTERNS
          ? process.env.SEMGREP_EXCLUDE_PATTERNS.split(',')
          : [
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
            ],
        includePatterns: process.env.SEMGREP_INCLUDE_PATTERNS
          ? process.env.SEMGREP_INCLUDE_PATTERNS.split(',')
          : ['*.js', '*.ts', '*.jsx', '*.tsx', '*.py', '*.java', '*.go', '*.php', '*.rb', '*.cs'],
        severityLevels: process.env.SEMGREP_SEVERITY_LEVELS
          ? process.env.SEMGREP_SEVERITY_LEVELS.split(',')
          : ['ERROR', 'WARNING', 'INFO'],
        enhancedRulesPath: process.env.SEMGREP_ENHANCED_RULES_PATH || './enhanced-rules',
      },
      mlReranking:
        process.env.ML_RERANKING_MODEL_PATH ||
        process.env.ML_RERANKING_MODEL_TYPE ||
        process.env.ML_RERANKING_FEATURES ||
        process.env.ML_RERANKING_TRAINING_ENABLED
          ? {
              modelPath: process.env.ML_RERANKING_MODEL_PATH || undefined,
              modelType:
                (process.env.ML_RERANKING_MODEL_TYPE as 'linear' | 'neural' | 'ensemble') ||
                'linear',
              features: process.env.ML_RERANKING_FEATURES
                ? process.env.ML_RERANKING_FEATURES.split(',')
                : [
                    'semanticScore',
                    'graphScore',
                    'contextualScore',
                    'recencyScore',
                    'popularityScore',
                    'originalScore',
                  ],
              trainingEnabled: process.env.ML_RERANKING_TRAINING_ENABLED !== 'false',
            }
          : undefined,
    };

    const { error, value } = configSchema.validate(rawConfig, { allowUnknown: false });

    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }

    this.config = value;
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getAll(): Config {
    return { ...this.config };
  }

  /**
   * 专门用于获取Qdrant配置的方法
   */
  getQdrantConfig(): Config['qdrant'] {
    return this.config.qdrant;
  }

  /**
   * 专门用于获取环境配置的方法
   */
  getEnvironmentConfig(): Config['nodeEnv'] {
    return this.config.nodeEnv;
  }

  /**
   * 专门用于获取端口配置的方法
   */
  getPort(): Config['port'] {
    return this.config.port;
  }

  /**
   * 专门用于获取嵌入器配置的方法
   */
  getEmbeddingConfig(): Config['embedding'] {
    return this.config.embedding;
  }
}