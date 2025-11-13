/**
 * 提取配置接口
 * 定义提取选项、缓存策略和性能监控参数
 */

/**
 * 缓存策略配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存大小限制 */
  maxSize: number;
  /** 缓存项TTL（毫秒） */
  ttl: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值（字节） */
  compressionThreshold: number;
  /** 是否启用详细统计 */
  enableDetailedStats: boolean;
}

/**
 * 性能监控配置
 */
export interface PerformanceConfig {
  /** 是否启用性能监控 */
  enabled: boolean;
  /** 是否记录详细指标 */
  recordDetailedMetrics: boolean;
  /** 性能数据保留时间（毫秒） */
  retentionPeriod: number;
  /** 是否启用自动报告 */
  enableAutoReporting: boolean;
  /** 报告间隔（毫秒） */
  reportingInterval: number;
  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number;
}

/**
 * 提取选项配置
 */
export interface ExtractionOptionsConfig {
  /** 是否包含顶级结构 */
  includeTopLevel: boolean;
  /** 是否包含嵌套结构 */
  includeNested: boolean;
  /** 是否包含内部结构 */
  includeInternal: boolean;
  /** 最大嵌套层级 */
  maxNestingLevel: number;
  /** 是否启用关系分析 */
  enableRelationshipAnalysis: boolean;
  /** 是否启用复杂度分析 */
  enableComplexityAnalysis: boolean;
  /** 最小结构大小（字符数） */
  minStructureSize: number;
  /** 最大结构大小（字符数） */
  maxStructureSize: number;
  /** 置信度阈值 */
  confidenceThreshold: number;
}

/**
 * 语言特定配置
 */
export interface LanguageSpecificConfig {
  /** 语言名称 */
  language: string;
  /** 支持的查询类型 */
  supportedQueryTypes: string[];
  /** 语言特定的提取选项 */
  extractionOptions: Partial<ExtractionOptionsConfig>;
  /** 语言特定的缓存配置 */
  cacheConfig: Partial<CacheConfig>;
  /** 语言特定的性能配置 */
  performanceConfig: Partial<PerformanceConfig>;
  /** 自定义类型映射 */
  typeMappings: Record<string, string>;
  /** 语言特定的优化选项 */
  optimizations: {
    /** 是否启用并行处理 */
    enableParallelProcessing: boolean;
    /** 并行处理的最大线程数 */
    maxParallelThreads: number;
    /** 是否启用增量解析 */
    enableIncrementalParsing: boolean;
    /** 是否启用智能缓存 */
    enableSmartCaching: boolean;
  };
}

/**
 * 完整的提取配置
 */
export interface ExtractionConfig {
  /** 全局缓存配置 */
  cache: CacheConfig;
  /** 全局性能配置 */
  performance: PerformanceConfig;
  /** 全局提取选项 */
  extraction: ExtractionOptionsConfig;
  /** 语言特定配置 */
  languages: LanguageSpecificConfig[];
  /** 调试选项 */
  debug: {
    /** 是否启用调试模式 */
    enabled: boolean;
    /** 日志级别 */
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    /** 是否记录详细日志 */
    verbose: boolean;
    /** 是否启用性能分析 */
    enableProfiling: boolean;
  };
  /** 错误处理配置 */
  errorHandling: {
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试延迟（毫秒） */
    retryDelay: number;
    /** 是否启用降级机制 */
    enableFallback: boolean;
    /** 错误报告策略 */
    errorReportingStrategy: 'silent' | 'log' | 'throw';
  };
}

/**
 * 默认配置
 */
export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 30 * 60 * 1000, // 30分钟
    enableCompression: true,
    compressionThreshold: 2048, // 2KB
    enableDetailedStats: true
  },
  performance: {
    enabled: true,
    recordDetailedMetrics: true,
    retentionPeriod: 60 * 60 * 1000, // 1小时
    enableAutoReporting: false,
    reportingInterval: 60 * 1000, // 1分钟
    slowQueryThreshold: 1000 // 1秒
  },
  extraction: {
    includeTopLevel: true,
    includeNested: true,
    includeInternal: true,
    maxNestingLevel: 5,
    enableRelationshipAnalysis: true,
    enableComplexityAnalysis: true,
    minStructureSize: 10,
    maxStructureSize: 10000,
    confidenceThreshold: 0.5
  },
  languages: [
    {
      language: 'javascript',
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'exports'],
      extractionOptions: {},
      cacheConfig: {},
      performanceConfig: {},
      typeMappings: {
        'function_declaration': 'function',
        'function_expression': 'function',
        'class_declaration': 'class',
        'variable_declaration': 'variable',
        'import_statement': 'import',
        'export_statement': 'export'
      },
      optimizations: {
        enableParallelProcessing: true,
        maxParallelThreads: 4,
        enableIncrementalParsing: true,
        enableSmartCaching: true
      }
    },
    {
      language: 'typescript',
      supportedQueryTypes: ['functions', 'classes', 'methods', 'interfaces', 'imports', 'variables', 'exports', 'types'],
      extractionOptions: {},
      cacheConfig: {},
      performanceConfig: {},
      typeMappings: {
        'function_declaration': 'function',
        'function_expression': 'function',
        'class_declaration': 'class',
        'interface_declaration': 'interface',
        'type_alias_declaration': 'type',
        'variable_declaration': 'variable',
        'import_statement': 'import',
        'export_statement': 'export'
      },
      optimizations: {
        enableParallelProcessing: true,
        maxParallelThreads: 4,
        enableIncrementalParsing: true,
        enableSmartCaching: true
      }
    },
    {
      language: 'python',
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables'],
      extractionOptions: {
        maxNestingLevel: 8 // Python通常有更深的嵌套
      },
      cacheConfig: {},
      performanceConfig: {},
      typeMappings: {
        'function_definition': 'function',
        'class_definition': 'class',
        'import_statement': 'import',
        'import_from_statement': 'import',
        'assignment': 'variable'
      },
      optimizations: {
        enableParallelProcessing: true,
        maxParallelThreads: 4,
        enableIncrementalParsing: true,
        enableSmartCaching: true
      }
    },
    {
      language: 'java',
      supportedQueryTypes: ['classes', 'methods', 'interfaces', 'imports', 'variables', 'enums'],
      extractionOptions: {
        maxNestingLevel: 6
      },
      cacheConfig: {},
      performanceConfig: {},
      typeMappings: {
        'class_declaration': 'class',
        'interface_declaration': 'interface',
        'method_declaration': 'method',
        'enum_declaration': 'enum',
        'import_declaration': 'import',
        'field_declaration': 'variable'
      },
      optimizations: {
        enableParallelProcessing: true,
        maxParallelThreads: 4,
        enableIncrementalParsing: true,
        enableSmartCaching: true
      }
    }
  ],
  debug: {
    enabled: false,
    logLevel: 'info',
    verbose: false,
    enableProfiling: false
  },
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000,
    enableFallback: true,
    errorReportingStrategy: 'log'
  }
};

/**
 * 配置管理器类
 */
export class ExtractionConfigManager {
  private config: ExtractionConfig;

  constructor(config: Partial<ExtractionConfig> = {}) {
    // 深度合并默认配置和用户配置
    this.config = this.mergeConfig(DEFAULT_EXTRACTION_CONFIG, config);
  }

  /**
   * 获取完整配置
   */
  getConfig(): ExtractionConfig {
    return this.config;
  }

  /**
   * 获取缓存配置
   */
  getCacheConfig(): CacheConfig {
    return this.config.cache;
  }

  /**
   * 获取性能配置
   */
  getPerformanceConfig(): PerformanceConfig {
    return this.config.performance;
  }

  /**
   * 获取提取选项配置
   */
  getExtractionConfig(): ExtractionOptionsConfig {
    return this.config.extraction;
  }

  /**
   * 获取语言特定配置
   */
  getLanguageConfig(language: string): LanguageSpecificConfig | null {
    return this.config.languages.find(lang => lang.language === language) || null;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExtractionConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * 更新缓存配置
   */
  updateCacheConfig(config: Partial<CacheConfig>): void {
    this.config.cache = { ...this.config.cache, ...config };
  }

  /**
   * 更新性能配置
   */
  updatePerformanceConfig(config: Partial<PerformanceConfig>): void {
    this.config.performance = { ...this.config.performance, ...config };
  }

  /**
   * 更新提取选项配置
   */
  updateExtractionConfig(config: Partial<ExtractionOptionsConfig>): void {
    this.config.extraction = { ...this.config.extraction, ...config };
  }

  /**
   * 更新语言特定配置
   */
  updateLanguageConfig(language: string, config: Partial<LanguageSpecificConfig>): void {
    const existingIndex = this.config.languages.findIndex(lang => lang.language === language);
    
    if (existingIndex >= 0) {
      // 更新现有配置
      this.config.languages[existingIndex] = {
        ...this.config.languages[existingIndex],
        ...config,
        language // 确保语言名称不被覆盖
      };
    } else {
      // 添加新配置
      this.config.languages.push({
        language,
        supportedQueryTypes: [],
        extractionOptions: {},
        cacheConfig: {},
        performanceConfig: {},
        typeMappings: {},
        optimizations: {
          enableParallelProcessing: true,
          maxParallelThreads: 4,
          enableIncrementalParsing: true,
          enableSmartCaching: true
        },
        ...config
      });
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = { ...DEFAULT_EXTRACTION_CONFIG };
  }

  /**
   * 验证配置
   */
  validateConfig(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 验证缓存配置
    if (this.config.cache.maxSize <= 0) {
      errors.push('缓存大小必须大于0');
    }
    if (this.config.cache.ttl <= 0) {
      errors.push('缓存TTL必须大于0');
    }

    // 验证性能配置
    if (this.config.performance.retentionPeriod <= 0) {
      errors.push('性能数据保留时间必须大于0');
    }
    if (this.config.performance.reportingInterval <= 0) {
      errors.push('报告间隔必须大于0');
    }

    // 验证提取配置
    if (this.config.extraction.maxNestingLevel <= 0) {
      errors.push('最大嵌套层级必须大于0');
    }
    if (this.config.extraction.minStructureSize < 0) {
      errors.push('最小结构大小不能为负数');
    }
    if (this.config.extraction.maxStructureSize <= this.config.extraction.minStructureSize) {
      errors.push('最大结构大小必须大于最小结构大小');
    }
    if (this.config.extraction.confidenceThreshold < 0 || this.config.extraction.confidenceThreshold > 1) {
      errors.push('置信度阈值必须在0-1之间');
    }

    // 验证语言配置
    for (const langConfig of this.config.languages) {
      if (!langConfig.language || langConfig.language.trim() === '') {
        errors.push('语言名称不能为空');
      }
      if (langConfig.optimizations.maxParallelThreads <= 0) {
        errors.push(`${langConfig.language}的最大并行线程数必须大于0`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置为JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 从JSON导入配置
   */
  importFromJson(json: string): void {
    try {
      const config = JSON.parse(json);
      this.updateConfig(config);
    } catch (error) {
      throw new Error(`导入配置失败: ${error}`);
    }
  }

  /**
   * 深度合并配置
   */
  private mergeConfig(base: ExtractionConfig, override: Partial<ExtractionConfig>): ExtractionConfig {
    const result = { ...base };

    // 合并顶级属性
    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        const overrideValue = override[key as keyof ExtractionConfig];
        
        if (typeof overrideValue === 'object' && overrideValue !== null && !Array.isArray(overrideValue)) {
          // 深度合并对象
          result[key as keyof ExtractionConfig] = {
            ...result[key as keyof ExtractionConfig],
            ...overrideValue
          } as any;
        } else {
          // 直接赋值
          result[key as keyof ExtractionConfig] = overrideValue as any;
        }
      }
    }

    // 特殊处理languages数组
    if (override.languages) {
      result.languages = [...override.languages];
    }

    return result;
  }
}