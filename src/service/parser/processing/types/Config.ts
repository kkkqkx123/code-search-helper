/**
 * 配置类型定义
 * 定义处理配置、分块配置、性能配置等
 */

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

/** 边界规则接口 */
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

/** 语言特定规则接口 */
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
 * 主处理配置接口
 */
export interface ProcessingConfig {
  /** 分块配置 */
  chunking: ChunkingConfig;
  /** 特征配置 */
  features: FeatureConfig;
  /** 性能配置 */
  performance: PerformanceConfig;
  /** 语言配置映射 */
  languages: Record<string, LanguageConfig>;
  /** 后处理配置 */
  postProcessing: PostProcessingConfig;
  /** 全局设置 */
  global: GlobalConfig;
  /** 高级配置 */
  advanced?: {
    enableEnhancedBalancing?: boolean;
    enableIntelligentFiltering?: boolean;
    enableSmartRebalancing?: boolean;
    enableAdvancedMerging?: boolean;
    enableBoundaryOptimization?: boolean;
    addOverlap?: boolean;
    minChunkSizeThreshold?: number;
    maxChunkSizeThreshold?: number;
    rebalancingStrategy?: string;
    semanticWeight?: number;
    syntacticWeight?: number;
    structuralWeight?: number;
    enableChunkDeduplication?: boolean;
    deduplicationThreshold?: number;
  };
  /** 配置版本 */
  version: string;
  /** 配置创建时间 */
  createdAt: number;
  /** 配置更新时间 */
  updatedAt: number;
}

/** 全局配置接口 */
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

/** 语言特征配置接口 */
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
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误信息列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 配置变更监听器类型
 */
export type ConfigChangeListener = (config: ProcessingConfig, changes: Partial<ProcessingConfig>) => void;

/**
 * 默认配置工厂类
 */
export class DefaultConfigFactory {
  /**
   * 创建默认分块配置
   */
  static createDefaultChunkingConfig(): ChunkingConfig {
    return {
      maxChunkSize: 2000,
      minChunkSize: 100,
      overlapSize: 50,
      maxLinesPerChunk: 100,
      minLinesPerChunk: 5,
      maxOverlapRatio: 0.2,
      defaultStrategy: 'hybrid',
      strategyPriorities: {
        'hybrid': 10,
        'semantic': 8,
        'ast': 7,
        'bracket': 6,
        'line': 5
      },
      enableIntelligentChunking: true,
      enableSemanticBoundaryDetection: true
    };
  }

  /**
   * 创建默认特征配置
   */
  static createDefaultFeatureConfig(): FeatureConfig {
    return {
      enableAST: true,
      enableSemanticDetection: true,
      enableBracketBalance: true,
      enableCodeOverlap: true,
      enableStandardization: true,
      standardizationFallback: true,
      enableComplexityCalculation: true,
      enableLanguageFeatureDetection: true,
      featureDetectionThresholds: {
        complexity: 0.5,
        imports: 0.3,
        exports: 0.2,
        functions: 0.4,
        classes: 0.3
      }
    };
  }

  /**
   * 创建默认性能配置
   */
  static createDefaultPerformanceConfig(): PerformanceConfig {
    return {
      memoryLimitMB: 512,
      maxExecutionTime: 30000,
      enableCaching: true,
      cacheSizeLimit: 1000,
      enablePerformanceMonitoring: true,
      concurrencyLimit: 4,
      queueSizeLimit: 100,
      enableBatchProcessing: false,
      batchSize: 10,
      enableLazyLoading: false
    };
  }

  /**
   * 创建默认边界配置
   */
  static createDefaultBoundaryConfig(): BoundaryConfig {
    return {
      strongBoundaries: [
        'function\\s+\\w+\\s*\\(',
        'class\\s+\\w+',
        'interface\\s+\\w+',
        'def\\s+\\w+\\s*\\('
      ],
      weakBoundaries: [
        '\\w+\\s*=>\\s*',
        'public\\s+\\w+\\s*\\(',
        'private\\s+\\w+\\s*\\(',
        'protected\\s+\\w+\\s*\\('
      ],
      ignoreBoundaries: [
        '\\{[\\s\\S]*?\\}',
        '\\[[\\s\\S]*?\\]',
        '\\([\\s\\S]*?\\)'
      ],
      customRules: []
    };
  }

  /**
   * 创建默认权重配置
   */
  static createDefaultWeightConfig(): WeightConfig {
    return {
      semantic: 0.4,
      syntax: 0.3,
      structure: 0.2,
      length: 0.05,
      complexity: 0.05,
      custom: {}
    };
  }

  /**
   * 创建默认语言分块配置
   */
  static createDefaultLanguageChunkingConfig(): LanguageChunkingConfig {
    return {
      defaultChunkSize: 1000,
      maxChunkSize: 2000,
      minChunkSize: 100,
      preferredStrategy: 'hybrid',
      specificRules: []
    };
  }

  /**
   * 创建默认语言配置
   */
  static createDefaultLanguageConfig(): LanguageConfig {
    return {
      name: 'unknown',
      boundaries: this.createDefaultBoundaryConfig(),
      weights: this.createDefaultWeightConfig(),
      chunking: this.createDefaultLanguageChunkingConfig(),
      features: this.createDefaultLanguageFeatureConfig(),
      extensions: [],
      mimeTypes: [],
      enabled: true
    };
  }

  /**
   * 创建默认语言特征配置
   */
  static createDefaultLanguageFeatureConfig(): LanguageFeatureConfig {
    return {
      enabledFeatures: ['syntax-highlighting', 'semantic-analysis'],
      disabledFeatures: [],
      featureParams: {},
      customDetectors: []
    };
  }

  /**
   * 创建默认后处理配置
   */
  static createDefaultPostProcessingConfig(): PostProcessingConfig {
    return {
      enabled: true,
      enabledProcessors: [
        'symbol-balance-processor',
        'intelligent-filter-processor',
        'smart-rebalancing-processor',
        'advanced-merging-processor',
        'boundary-optimization-processor',
        'overlap-processor'
      ],
      processorConfigs: {},
      processorOrder: [
        'symbol-balance-processor',
        'intelligent-filter-processor',
        'smart-rebalancing-processor',
        'advanced-merging-processor',
        'boundary-optimization-processor',
        'overlap-processor'
      ],
      maxProcessingRounds: 3,
      enableParallelProcessing: false,
      parallelProcessingLimit: 2
    };
  }

  /**
   * 创建默认全局配置
   */
  static createDefaultGlobalConfig(): GlobalConfig {
    return {
      debugMode: false,
      logLevel: 'info',
      enableMetrics: true,
      enableStatistics: true,
      configVersion: '1.0.0',
      compatibilityMode: false,
      strictMode: false,
      experimentalFeatures: [],
      customProperties: {}
    };
  }

  /**
   * 创建默认处理配置
   */
  static createDefaultProcessingConfig(): ProcessingConfig {
    const now = Date.now();
    return {
      chunking: this.createDefaultChunkingConfig(),
      features: this.createDefaultFeatureConfig(),
      performance: this.createDefaultPerformanceConfig(),
      languages: {
        javascript: this.createDefaultLanguageConfig(),
        typescript: this.createDefaultLanguageConfig(),
        python: this.createDefaultLanguageConfig(),
        java: this.createDefaultLanguageConfig(),
        cpp: this.createDefaultLanguageConfig(),
        csharp: this.createDefaultLanguageConfig(),
        go: this.createDefaultLanguageConfig(),
        rust: this.createDefaultLanguageConfig()
      },
      postProcessing: this.createDefaultPostProcessingConfig(),
      global: this.createDefaultGlobalConfig(),
      version: '1.0.0',
      createdAt: now,
      updatedAt: now
    };
  }
}

/**
 * 配置工具函数
 */
export class ConfigUtils {
  /**
   * 验证配置
   */
  static validateConfig(config: ProcessingConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证分块配置
    if (config.chunking.maxChunkSize <= config.chunking.minChunkSize) {
      errors.push('maxChunkSize must be greater than minChunkSize');
    }

    if (config.chunking.maxLinesPerChunk <= config.chunking.minLinesPerChunk) {
      errors.push('maxLinesPerChunk must be greater than minLinesPerChunk');
    }

    if (config.chunking.maxOverlapRatio >= 1) {
      errors.push('maxOverlapRatio must be less than 1');
    }

    // 验证性能配置
    if (config.performance.memoryLimitMB <= 0) {
      errors.push('memoryLimitMB must be greater than 0');
    }

    if (config.performance.maxExecutionTime <= 0) {
      errors.push('maxExecutionTime must be greater than 0');
    }

    // 验证权重配置
    for (const [lang, langConfig] of Object.entries(config.languages)) {
      const totalWeight = Object.values(langConfig.weights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        warnings.push(`Language ${lang} weights do not sum to 1.0 (current: ${totalWeight})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 合并配置
   */
  static mergeConfigs(base: ProcessingConfig, override: Partial<ProcessingConfig>): ProcessingConfig {
    const merged = { ...base };

    // 深度合并各个配置部分
    if (override.chunking) {
      merged.chunking = { ...base.chunking, ...override.chunking };
    }

    if (override.features) {
      merged.features = { ...base.features, ...override.features };
    }

    if (override.performance) {
      merged.performance = { ...base.performance, ...override.performance };
    }

    if (override.postProcessing) {
      merged.postProcessing = { ...base.postProcessing, ...override.postProcessing };
    }

    if (override.languages) {
      merged.languages = { ...base.languages };
      for (const [lang, langConfig] of Object.entries(override.languages)) {
        if (base.languages[lang]) {
          merged.languages[lang] = {
            ...base.languages[lang],
            ...langConfig,
            boundaries: { ...base.languages[lang].boundaries, ...langConfig.boundaries },
            weights: { ...base.languages[lang].weights, ...langConfig.weights },
            chunking: { ...base.languages[lang].chunking, ...langConfig.chunking }
          };
        } else {
          merged.languages[lang] = langConfig;
        }
      }
    }

    // 更新元数据
    merged.updatedAt = Date.now();

    return merged;
  }

  /**
   * 克隆配置
   */
  static cloneConfig(config: ProcessingConfig): ProcessingConfig {
    return JSON.parse(JSON.stringify(config));
  }
}