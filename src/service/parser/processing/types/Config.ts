/**
 * 配置类型定义
 * 定义处理配置、分块配置、性能配置等
 */

/**
 * 边界配置接口
 */
export interface BoundaryConfig {
  /** 函数边界模式 */
  functionPatterns: string[];
  /** 类边界模式 */
  classPatterns: string[];
  /** 块边界模式 */
  blockPatterns: string[];
  /** 导入边界模式 */
  importPatterns: string[];
  /** 导出边界模式 */
  exportPatterns: string[];
  /** 自定义边界模式 */
  customPatterns?: string[];
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
}

/**
 * 语言特定分块配置接口
 */
export interface LanguageChunkingConfig {
  /** 最大块大小 */
  maxChunkSize: number;
  /** 最小块大小 */
  minChunkSize: number;
  /** 重叠大小 */
  overlapSize: number;
  /** 每块最大行数 */
  maxLinesPerChunk: number;
  /** 每块最小行数 */
  minLinesPerChunk: number;
  /** 最大重叠比例 */
  maxOverlapRatio: number;
  /** 是否启用智能分割 */
  enableIntelligentSplitting: boolean;
  /** 是否保持语义完整性 */
  preserveSemanticIntegrity: boolean;
}

/**
 * 分块配置接口
 */
export interface ChunkingConfig {
  /** 最大块大小 */
  maxChunkSize: number;
  /** 最小块大小 */
  minChunkSize: number;
  /** 重叠大小 */
  overlapSize: number;
  /** 每块最大行数 */
  maxLinesPerChunk: number;
  /** 每块最小行数 */
  minLinesPerChunk: number;
  /** 最大重叠比例 */
  maxOverlapRatio: number;
  /** 默认策略 */
  defaultStrategy: string;
  /** 可用策略列表 */
  availableStrategies: string[];
  /** 是否启用自适应策略选择 */
  enableAdaptiveStrategy: boolean;
}

/**
 * 特征配置接口
 */
export interface FeatureConfig {
  /** 是否启用AST */
  enableAST: boolean;
  /** 是否启用语义检测 */
  enableSemanticDetection: boolean;
  /** 是否启用括号平衡 */
  enableBracketBalance: boolean;
  /** 是否启用代码重叠 */
  enableCodeOverlap: boolean;
  /** 是否启用标准化 */
  enableStandardization: boolean;
  /** 标准化回退 */
  standardizationFallback: boolean;
  /** 是否启用复杂度分析 */
  enableComplexityAnalysis: boolean;
  /** 是否启用依赖分析 */
  enableDependencyAnalysis: boolean;
}

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  /** 内存限制（MB） */
  memoryLimitMB: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
  /** 是否启用缓存 */
  enableCaching: boolean;
  /** 缓存大小限制 */
  cacheSizeLimit: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 并发处理限制 */
  concurrencyLimit: number;
  /** 是否启用批处理 */
  enableBatchProcessing: boolean;
  /** 批处理大小 */
  batchSize: number;
}

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  /** 边界配置 */
  boundaries: BoundaryConfig;
  /** 权重配置 */
  weights: WeightConfig;
  /** 分块配置 */
  chunking: LanguageChunkingConfig;
  /** 语言特定扩展 */
  extensions?: string[];
  /** 语言特定忽略模式 */
  ignorePatterns?: string[];
  /** 语言特定处理规则 */
  processingRules?: Record<string, any>;
}

/**
 * 后处理配置接口
 */
export interface PostProcessingConfig {
  /** 是否启用后处理 */
  enabled: boolean;
  /** 启用的处理器列表 */
  enabledProcessors: string[];
  /** 处理器配置映射 */
  processorConfigs: Record<string, any>;
  /** 最大后处理轮次 */
  maxProcessingRounds: number;
  /** 是否启用并行处理 */
  enableParallelProcessing: boolean;
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
  /** 配置版本 */
  version: string;
  /** 配置创建时间 */
  createdAt: number;
  /** 配置更新时间 */
  updatedAt: number;
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
      availableStrategies: ['line', 'semantic', 'ast', 'bracket', 'hybrid'],
      enableAdaptiveStrategy: true
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
      enableComplexityAnalysis: true,
      enableDependencyAnalysis: false
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
      enableBatchProcessing: false,
      batchSize: 10
    };
  }

  /**
   * 创建默认边界配置
   */
  static createDefaultBoundaryConfig(): BoundaryConfig {
    return {
      functionPatterns: [
        /function\s+\w+\s*\(/,
        /def\s+\w+\s*\(/,
        /\w+\s*:\s*function/,
        /\w+\s*=>\s*/,
        /func\s+\w+\s*\(/,
        /fn\s+\w+\s*\(/,
        /public\s+\w+\s*\(/,
        /private\s+\w+\s*\(/,
        /protected\s+\w+\s*\(/
      ],
      classPatterns: [
        /class\s+\w+/,
        /interface\s+\w+/,
        /struct\s+\w+/,
        /enum\s+\w+/,
        /type\s+\w+\s*=/,
        /protocol\s+\w+/,
        /abstract\s+class\s+\w+/
      ],
      blockPatterns: [
        /\{[\s\S]*?\}/,
        /\[[\s\S]*?\]/,
        /\([\s\S]*?\)/
      ],
      importPatterns: [
        /import\s+.*from/,
        /require\s*\(/,
        /#include/,
        /using\s+/,
        /use\s+/,
        /import\s+/
      ],
      exportPatterns: [
        /export\s+/,
        /module\.exports/,
        /exports\./,
        /export\s+default/,
        /public\s+class/,
        /__all__\s*=/
      ]
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
      complexity: 0.05
    };
  }

  /**
   * 创建默认语言分块配置
   */
  static createDefaultLanguageChunkingConfig(): LanguageChunkingConfig {
    return {
      maxChunkSize: 1500,
      minChunkSize: 100,
      overlapSize: 50,
      maxLinesPerChunk: 80,
      minLinesPerChunk: 5,
      maxOverlapRatio: 0.2,
      enableIntelligentSplitting: true,
      preserveSemanticIntegrity: true
    };
  }

  /**
   * 创建默认语言配置
   */
  static createDefaultLanguageConfig(): LanguageConfig {
    return {
      boundaries: this.createDefaultBoundaryConfig(),
      weights: this.createDefaultWeightConfig(),
      chunking: this.createDefaultLanguageChunkingConfig(),
      extensions: [],
      ignorePatterns: [],
      processingRules: {}
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
      maxProcessingRounds: 3,
      enableParallelProcessing: false
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
            boundaries: { ...base.languages[lang].boundaries, ...langConfig.boundaries },
            weights: { ...base.languages[lang].weights, ...langConfig.weights },
            chunking: { ...base.languages[lang].chunking, ...langConfig.chunking },
            ...langConfig
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