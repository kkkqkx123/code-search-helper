import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../../splitting';

/**
 * 分层配置管理器
 */
export interface ChunkingConfig {
  global: ChunkingOptions; // 全局配置
  language: Map<string, ChunkingOptions>; // 语言特定配置
  strategy: Map<string, ChunkingOptions>; // 策略特定配置
}

/**
 * 代码分割配置管理器
 */
export class ChunkingConfigManager {
  private config: ChunkingConfig;
  private listeners: Array<(config: ChunkingConfig) => void> = [];

  constructor(initialConfig?: Partial<ChunkingConfig>) {
    this.config = {
      global: { ...DEFAULT_CHUNKING_OPTIONS },
      language: new Map(),
      strategy: new Map(),
      ...initialConfig
    };
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig(): ChunkingOptions {
    return { ...this.config.global };
  }

  /**
   * 获取语言特定配置
   */
  getLanguageConfig(language: string): ChunkingOptions {
    const languageConfig = this.config.language.get(language);
    if (languageConfig) {
      return { ...this.config.global, ...languageConfig };
    }
    return { ...this.config.global };
  }

  /**
   * 获取策略特定配置
   */
  getStrategyConfig(strategyType: string): ChunkingOptions {
    const strategyConfig = this.config.strategy.get(strategyType);
    if (strategyConfig) {
      return { ...this.config.global, ...strategyConfig };
    }
    return { ...this.config.global };
  }

  /**
   * 获取合并配置（全局 + 语言 + 策略）
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
   * 更新全局配置
   */
  updateGlobalConfig(newOptions: Partial<ChunkingOptions>): void {
    this.config.global = { ...this.config.global, ...newOptions };
    this.notifyListeners();
  }

  /**
   * 更新语言特定配置
   */
  updateLanguageConfig(language: string, newOptions: Partial<ChunkingOptions>): void {
    const existingConfig = this.config.language.get(language) || {};
    this.config.language.set(language, { ...existingConfig, ...newOptions });
    this.notifyListeners();
  }

  /**
   * 更新策略特定配置
   */
  updateStrategyConfig(strategyType: string, newOptions: Partial<ChunkingOptions>): void {
    const existingConfig = this.config.strategy.get(strategyType) || {};
    this.config.strategy.set(strategyType, { ...existingConfig, ...newOptions });
    this.notifyListeners();
  }

  /**
   * 移除语言特定配置
   */
  removeLanguageConfig(language: string): void {
    this.config.language.delete(language);
    this.notifyListeners();
  }

  /**
   * 移除策略特定配置
   */
  removeStrategyConfig(strategyType: string): void {
    this.config.strategy.delete(strategyType);
    this.notifyListeners();
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.config = {
      global: { ...DEFAULT_CHUNKING_OPTIONS },
      language: new Map(),
      strategy: new Map()
    };
    this.notifyListeners();
  }

  /**
   * 添加配置变更监听器
   */
  addConfigListener(listener: (config: ChunkingConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeConfigListener(listener: (config: ChunkingConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取当前配置快照
   */
  getConfigSnapshot(): ChunkingConfig {
    return {
      global: { ...this.config.global },
      language: new Map(this.config.language),
      strategy: new Map(this.config.strategy)
    };
  }

  /**
   * 验证配置的有效性
   */
  validateConfig(config: ChunkingOptions): boolean {
    // 检查块大小配置
    if (config.maxChunkSize && config.minChunkSize && config.maxChunkSize < config.minChunkSize) {
      throw new Error('maxChunkSize must be greater than or equal to minChunkSize');
    }

    // 检查重叠配置
    if (config.overlapSize && config.maxChunkSize && config.overlapSize >= config.maxChunkSize) {
      throw new Error('overlapSize must be less than maxChunkSize');
    }

    // 检查权重配置
    if (config.semanticWeight !== undefined && config.syntacticWeight !== undefined) {
      const totalWeight = config.semanticWeight + config.syntacticWeight;
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error('semanticWeight and syntacticWeight must sum to 1.0');
      }
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
        strategy: Object.fromEntries(this.config.strategy)
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
  } {
    return {
      totalLanguages: this.config.language.size,
      totalStrategies: this.config.strategy.size,
      globalOptionsCount: Object.keys(this.config.global).length,
      totalConfigSize: JSON.stringify(this.getConfigSnapshot()).length
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