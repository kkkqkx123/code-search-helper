import { injectable, inject } from 'inversify';
import { ChunkingOptions, StrategyConfiguration } from '../interfaces/CoreISplitStrategy';
import { LanguageConfiguration } from './LanguageConfigManager';

/**
 * 统一配置管理器
 * 整合了 ChunkingConfigManager、UniversalProcessingConfig 和 LanguageConfigManager 的功能
 */
export interface UnifiedConfig {
  global: ChunkingOptions; // 全局分段配置
  language: Map<string, ChunkingOptions>; // 语言特定分段配置
  strategy: Map<string, ChunkingOptions>; // 策略特定分段配置
  universal: UniversalProcessingConfig; // 通用处理配置
  languageConfigs: Map<string, LanguageConfiguration>; // 语言特定配置
}

export interface UniversalProcessingConfig {
  // 错误处理配置
  error: {
    maxErrors: number;
    errorResetInterval: number;
  };

  // 内存限制配置
  memory: {
    memoryLimitMB: number;
    memoryCheckInterval: number;
  };

  // 分段参数配置
  chunking: {
    maxChunkSize: number;
    chunkOverlap: number;
    maxLinesPerChunk: number;
  };

  // 备份文件处理配置
  backup: {
    backupFilePatterns: string[];
    backupFileConfidenceThreshold: number;
  };
}

@injectable()
export class UnifiedConfigManager {
  private config: UnifiedConfig;
  private listeners: Array<(config: UnifiedConfig) => void> = [];
  private defaultUniversalConfig: UniversalProcessingConfig = {
    error: {
      maxErrors: 5,
      errorResetInterval: 6000
    },
    memory: {
      memoryLimitMB: 500,
      memoryCheckInterval: 5000
    },
    chunking: {
      maxChunkSize: 2000,
      chunkOverlap: 200,
      maxLinesPerChunk: 50
    },
    backup: {
      backupFilePatterns: ['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save'],
      backupFileConfidenceThreshold: 0.7
    }
  };

  constructor(@inject('unmanaged') initialConfig?: Partial<UnifiedConfig>) {
    this.config = {
      global: {
        maxChunkSize: 2000,
        overlapSize: 200,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: false,
        minChunkSize: 100,
        extractSnippets: true,
        addOverlap: false,
        optimizationLevel: 'medium',
        maxLines: 1000,
        adaptiveBoundaryThreshold: false,
        contextAwareOverlap: false,
        semanticWeight: 0.7,
        syntacticWeight: 0.3,
        boundaryScoring: {
          enableSemanticScoring: true,
          minBoundaryScore: 0.5,
          maxSearchDistance: 10,
          languageSpecificWeights: true
        },
        overlapStrategy: {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.7
        },
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 2000,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        },
        enableASTBoundaryDetection: false,
        enableChunkDeduplication: false,
        maxOverlapRatio: 0.3,
        deduplicationThreshold: 0.8,
        astNodeTracking: false,
        chunkMergeStrategy: 'conservative',
        minChunkSimilarity: 0.6,
        enablePerformanceOptimization: false,
        enablePerformanceMonitoring: false,
        enableChunkingCoordination: false,
        strategyExecutionOrder: ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
        enableNodeTracking: false,
        enableSmartDeduplication: false,
        similarityThreshold: 0.8,
        overlapMergeStrategy: 'conservative'
      },
      language: new Map(),
      strategy: new Map(),
      universal: { ...this.defaultUniversalConfig },
      languageConfigs: new Map(),
      ...initialConfig
    };
  }

  /**
   * 获取全局分段配置
   */
  getGlobalConfig(): ChunkingOptions {
    return { ...this.config.global };
  }

  /**
   * 获取语言特定分段配置
   */
  getLanguageConfig(language: string): ChunkingOptions {
    const languageConfig = this.config.language.get(language);
    if (languageConfig) {
      return { ...this.config.global, ...languageConfig };
    }
    return { ...this.config.global };
  }

  /**
   * 获取策略特定分段配置
   */
  getStrategyConfig(strategyType: string): ChunkingOptions {
    const strategyConfig = this.config.strategy.get(strategyType);
    if (strategyConfig) {
      return { ...this.config.global, ...strategyConfig };
    }
    return { ...this.config.global };
  }

  /**
   * 获取合并分段配置（全局 + 语言 + 策略）
   */
  getMergedConfig(language?: string, strategyType?: string): ChunkingOptions {
    let config = { ...this.config.global };

    // 应用语言特定配置
    if (language) {
      const languageConfig = this.config.language.get(language);
      if (languageConfig) {
        config = { ...config, ...languageConfig };
      }
    }

    // 应用策略特定配置
    if (strategyType) {
      const strategyConfig = this.config.strategy.get(strategyType);
      if (strategyConfig) {
        config = { ...config, ...strategyConfig };
      }
    }

    return config;
  }

  /**
   * 获取通用处理配置
   */
  getUniversalConfig(): UniversalProcessingConfig {
    return { ...this.config.universal };
  }

  /**
   * 获取语言特定配置
   */
  getLanguageSpecificConfig(language: string): LanguageConfiguration {
    return this.config.languageConfigs.get(language) || this.getDefaultLanguageConfig(language);
  }

  /**
   * 获取默认语言配置
   */
  private getDefaultLanguageConfig(language: string): LanguageConfiguration {
    return {
      language: 'default',
      fileExtensions: [],
      chunkTypes: ['function', 'class', 'module'],
      defaultChunkConfig: {
        maxChunkSize: 2000,
        minChunkSize: 100,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 10
      },
      syntaxRules: [],
      specialRules: [],
      performanceConfig: {
        maxFileSize: 1024 * 1024, // 1MB
        maxParseTime: 5000, // 5秒
        cacheSize: 1000,
        enableParallel: true,
        parallelThreads: 4
      }
    };
  }

  /**
   * 更新全局分段配置
   */
  updateGlobalConfig(newOptions: Partial<ChunkingOptions>): void {
    this.config.global = { ...this.config.global, ...newOptions };
    this.notifyListeners();
  }

  /**
   * 更新语言特定分段配置
   */
  updateLanguageConfig(language: string, newOptions: Partial<ChunkingOptions>): void {
    const existingConfig = this.config.language.get(language) || {};
    this.config.language.set(language, { ...existingConfig, ...newOptions });
    this.notifyListeners();
  }

  /**
   * 更新策略特定分段配置
   */
  updateStrategyConfig(strategyType: string, newOptions: Partial<ChunkingOptions>): void {
    const existingConfig = this.config.strategy.get(strategyType) || {};
    this.config.strategy.set(strategyType, { ...existingConfig, ...newOptions });
    this.notifyListeners();
  }

  /**
   * 更新通用处理配置
   */
  updateUniversalConfig(newConfig: Partial<UniversalProcessingConfig>): void {
    this.config.universal = { ...this.config.universal, ...newConfig };
    this.notifyListeners();
  }

  /**
   * 更新语言特定配置
   */
  updateLanguageSpecificConfig(language: string, newConfig: Partial<LanguageConfiguration>): void {
    const existingConfig = this.config.languageConfigs.get(language) || this.getDefaultLanguageConfig(language);
    this.config.languageConfigs.set(language, { ...existingConfig, ...newConfig });
    this.notifyListeners();
  }

  /**
   * 移除语言特定分段配置
   */
  removeLanguageConfig(language: string): void {
    this.config.language.delete(language);
    this.notifyListeners();
  }

  /**
   * 移除策略特定分段配置
   */
  removeStrategyConfig(strategyType: string): void {
    this.config.strategy.delete(strategyType);
    this.notifyListeners();
  }

  /**
   * 移除语言特定配置
   */
  removeLanguageSpecificConfig(language: string): void {
    this.config.languageConfigs.delete(language);
    this.notifyListeners();
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.config = {
      global: {
        maxChunkSize: 2000,
        overlapSize: 200,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: false,
        minChunkSize: 100,
        extractSnippets: true,
        addOverlap: false,
        optimizationLevel: 'medium',
        maxLines: 10000,
        adaptiveBoundaryThreshold: false,
        contextAwareOverlap: false,
        semanticWeight: 0.7,
        syntacticWeight: 0.3,
        boundaryScoring: {
          enableSemanticScoring: true,
          minBoundaryScore: 0.5,
          maxSearchDistance: 10,
          languageSpecificWeights: true
        },
        overlapStrategy: {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.7
        },
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 200,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        },
        enableASTBoundaryDetection: false,
        enableChunkDeduplication: false,
        maxOverlapRatio: 0.3,
        deduplicationThreshold: 0.8,
        astNodeTracking: false,
        chunkMergeStrategy: 'conservative',
        minChunkSimilarity: 0.6,
        enablePerformanceOptimization: false,
        enablePerformanceMonitoring: false,
        enableChunkingCoordination: false,
        strategyExecutionOrder: ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
        enableNodeTracking: false,
        enableSmartDeduplication: false,
        similarityThreshold: 0.8,
        overlapMergeStrategy: 'conservative'
      },
      language: new Map(),
      strategy: new Map(),
      universal: { ...this.defaultUniversalConfig },
      languageConfigs: new Map()
    };
    this.notifyListeners();
  }

  /**
   * 添加配置变更监听器
   */
  addConfigListener(listener: (config: UnifiedConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeConfigListener(listener: (config: UnifiedConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取当前配置快照
   */
  getConfigSnapshot(): UnifiedConfig {
    return {
      global: { ...this.config.global },
      language: new Map(this.config.language),
      strategy: new Map(this.config.strategy),
      universal: { ...this.config.universal },
      languageConfigs: new Map(this.config.languageConfigs)
    };
  }

  /**
   * 验证配置的有效性
   */
  validateConfig(): boolean {
    // 验证分段配置
    if (this.config.global.maxChunkSize && this.config.global.minChunkSize &&
      this.config.global.maxChunkSize < this.config.global.minChunkSize) {
      throw new Error('maxChunkSize must be greater than or equal to minChunkSize');
    }

    // 验证重叠配置
    if (this.config.global.overlapSize && this.config.global.maxChunkSize &&
      this.config.global.overlapSize >= this.config.global.maxChunkSize) {
      throw new Error('overlapSize must be less than maxChunkSize');
    }

    // 验证权重配置
    if (this.config.global.semanticWeight !== undefined && this.config.global.syntacticWeight !== undefined) {
      const totalWeight = this.config.global.semanticWeight + this.config.global.syntacticWeight;
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error('semanticWeight and syntacticWeight must sum to 1.0');
      }
    }

    // 验证通用配置
    if (this.config.universal.error.maxErrors <= 0) {
      throw new Error('maxErrors must be greater than 0');
    }

    if (this.config.universal.error.errorResetInterval <= 0) {
      throw new Error('errorResetInterval must be greater than 0');
    }

    if (this.config.universal.memory.memoryLimitMB <= 0) {
      throw new Error('memoryLimitMB must be greater than 0');
    }

    if (this.config.universal.memory.memoryCheckInterval <= 0) {
      throw new Error('memoryCheckInterval must be greater than 0');
    }

    if (this.config.universal.chunking.maxChunkSize <= 0) {
      throw new Error('maxChunkSize must be greater than 0');
    }

    if (this.config.universal.chunking.chunkOverlap < 0) {
      throw new Error('chunkOverlap must be non-negative');
    }

    if (this.config.universal.chunking.chunkOverlap >= this.config.universal.chunking.maxChunkSize) {
      throw new Error('chunkOverlap must be less than maxChunkSize');
    }

    if (this.config.universal.chunking.maxLinesPerChunk <= 0) {
      throw new Error('maxLinesPerChunk must be greater than 0');
    }

    return true;
  }

  /**
   * 从配置文件加载配置
   */
  async loadFromConfigFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const configData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (configData.global) {
        this.updateGlobalConfig(configData.global);
      }

      if (configData.language) {
        for (const [language, config] of Object.entries(configData.language)) {
          this.updateLanguageConfig(language, config as Partial<ChunkingOptions>);
        }
      }

      if (configData.strategy) {
        for (const [strategy, config] of Object.entries(configData.strategy)) {
          this.updateStrategyConfig(strategy, config as Partial<ChunkingOptions>);
        }
      }

      if (configData.universal) {
        this.updateUniversalConfig(configData.universal);
      }

      if (configData.languageConfigs) {
        for (const [language, config] of Object.entries(configData.languageConfigs)) {
          this.updateLanguageSpecificConfig(language, config as Partial<LanguageConfiguration>);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`);
    }
  }

  /**
   * 保存配置到文件
   */
  async saveToConfigFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const configData = {
        global: this.config.global,
        language: Object.fromEntries(this.config.language),
        strategy: Object.fromEntries(this.config.strategy),
        universal: this.config.universal,
        languageConfigs: Object.fromEntries(this.config.languageConfigs)
      };

      fs.writeFileSync(filePath, JSON.stringify(configData, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${filePath}: ${error}`);
    }
  }

  /**
   * 获取配置统计信息
   */
  getConfigStats(): {
    totalLanguages: number;
    totalStrategies: number;
    globalOptionsCount: number;
    totalConfigSize: number;
    totalUniversalOptions: number;
    totalLanguageConfigs: number;
  } {
    return {
      totalLanguages: this.config.language.size,
      totalStrategies: this.config.strategy.size,
      globalOptionsCount: Object.keys(this.config.global).length,
      totalConfigSize: JSON.stringify(this.getConfigSnapshot()).length,
      totalUniversalOptions: Object.keys(this.config.universal).length,
      totalLanguageConfigs: this.config.languageConfigs.size
    };
  }

  /**
   * 通知所有监听器配置已变更
   */
  private notifyListeners(): void {
    const configSnapshot = this.getConfigSnapshot();
    this.listeners.forEach(listener => {
      try {
        listener(configSnapshot);
      } catch (error) {
        console.error('Error in config listener:', error);
      }
    });
  }
}