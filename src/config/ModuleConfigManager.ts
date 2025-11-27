import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { TYPES } from '../types';

export interface ModuleConfig {
  [key: string]: any;
}

export interface ConfigValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface ConfigSchema {
  [key: string]: ConfigValidationRule;
}

/**
 * 模块配置管理器 - 集中管理各模块的配置
 */
@injectable()
export class ModuleConfigManager {
  private logger: LoggerService;
  private configs: Map<string, ModuleConfig> = new Map();
  private schemas: Map<string, ConfigSchema> = new Map();
  private watchers: Map<string, Set<(config: ModuleConfig) => void>> = new Map();

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
    this.initializeDefaultConfigs();
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfigs(): void {
    // 热重载配置
    this.setConfig('hot-reload', {
      batch: {
        maxBatchSize: 50,
        mediumBatchSize: 20,
        minDelay: 100,
        mediumDelay: 1000,
        maxDelay: 5000,
        maxConcurrency: 3
      },
      cache: {
        resultTTL: 60000,
        contextTTL: 300000,
        astTTL: 180000,
        maxCacheSize: 1000,
        compressionThreshold: 1024
      },
      reliability: {
        maxRetries: 3,
        baseDelay: 1000,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000
      }
    });

    // Parser配置
    this.setConfig('parser', {
      cache: {
        resultTTL: 60000,
        contextTTL: 300000,
        astTTL: 180000,
        maxCacheSize: 1000,
        compressionThreshold: 1024
      },
      processing: {
        maxConcurrency: 5,
        timeout: 30000,
        enableBatchProcessing: true,
        batchSize: 10
      },
      reliability: {
        maxRetries: 2,
        baseDelay: 500,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 30000
      }
    });

    // 向量索引配置
    this.setConfig('vector-index', {
      batch: {
        maxBatchSize: 100,
        concurrency: 3,
        timeout: 60000
      },
      cache: {
        embeddingTTL: 3600000,
        similarityTTL: 1800000,
        maxCacheSize: 5000
      },
      reliability: {
        maxRetries: 5,
        baseDelay: 2000,
        circuitBreakerThreshold: 10,
        circuitBreakerTimeout: 120000
      }
    });

    // 图索引配置
    this.setConfig('graph-index', {
      batch: {
        maxBatchSize: 50,
        concurrency: 2,
        timeout: 90000
      },
      cache: {
        nodeTTL: 7200000,
        relationshipTTL: 3600000,
        maxCacheSize: 3000
      },
      reliability: {
        maxRetries: 3,
        baseDelay: 1500,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 90000
      }
    });

    // 设置配置验证模式
    this.setupValidationSchemas();
  }

  /**
   * 设置配置验证模式
   */
  private setupValidationSchemas(): void {
    // 热重载配置验证
    this.setSchema('hot-reload', {
      'batch.maxBatchSize': { type: 'number', min: 1, max: 1000 },
      'batch.mediumBatchSize': { type: 'number', min: 1, max: 500 },
      'batch.minDelay': { type: 'number', min: 10, max: 10000 },
      'batch.mediumDelay': { type: 'number', min: 100, max: 30000 },
      'batch.maxDelay': { type: 'number', min: 500, max: 60000 },
      'batch.maxConcurrency': { type: 'number', min: 1, max: 10 },
      'cache.resultTTL': { type: 'number', min: 1000, max: 3600000 },
      'cache.contextTTL': { type: 'number', min: 1000, max: 7200000 },
      'cache.astTTL': { type: 'number', min: 1000, max: 3600000 },
      'cache.maxCacheSize': { type: 'number', min: 10, max: 10000 },
      'cache.compressionThreshold': { type: 'number', min: 100, max: 10240 },
      'reliability.maxRetries': { type: 'number', min: 0, max: 10 },
      'reliability.baseDelay': { type: 'number', min: 100, max: 10000 },
      'reliability.circuitBreakerThreshold': { type: 'number', min: 1, max: 20 },
      'reliability.circuitBreakerTimeout': { type: 'number', min: 10000, max: 300000 }
    });

    // Parser配置验证
    this.setSchema('parser', {
      'cache.resultTTL': { type: 'number', min: 1000, max: 3600000 },
      'cache.contextTTL': { type: 'number', min: 1000, max: 7200000 },
      'cache.astTTL': { type: 'number', min: 1000, max: 3600000 },
      'cache.maxCacheSize': { type: 'number', min: 10, max: 10000 },
      'cache.compressionThreshold': { type: 'number', min: 100, max: 10240 },
      'processing.maxConcurrency': { type: 'number', min: 1, max: 20 },
      'processing.timeout': { type: 'number', min: 5000, max: 300000 },
      'processing.enableBatchProcessing': { type: 'boolean' },
      'processing.batchSize': { type: 'number', min: 1, max: 100 },
      'reliability.maxRetries': { type: 'number', min: 0, max: 5 },
      'reliability.baseDelay': { type: 'number', min: 100, max: 5000 },
      'reliability.circuitBreakerThreshold': { type: 'number', min: 1, max: 10 },
      'reliability.circuitBreakerTimeout': { type: 'number', min: 10000, max: 120000 }
    });
  }

  /**
   * 获取配置
   */
  getConfig<T = ModuleConfig>(module: string, key?: string): T {
    const config = this.configs.get(module);
    if (!config) {
      this.logger.warn(`Configuration not found for module: ${module}`);
      return {} as T;
    }

    if (key) {
      return this.getNestedValue(config, key) as T;
    }

    return config as T;
  }

  /**
   * 设置配置
   */
  setConfig(module: string, config: ModuleConfig): void {
    // 验证配置
    if (!this.validateConfig(module, config)) {
      throw new Error(`Invalid configuration for module: ${module}`);
    }

    const oldConfig = this.configs.get(module);
    this.configs.set(module, { ...config });

    this.logger.info(`Configuration updated for module: ${module}`, {
      changes: this.getConfigChanges(oldConfig, config)
    });

    // 通知观察者
    this.notifyWatchers(module, config);
  }

  /**
   * 更新配置
   */
  updateConfig(module: string, updates: Partial<ModuleConfig>): void {
    const currentConfig = this.getConfig(module);
    const newConfig = this.mergeConfigs(currentConfig, updates);
    this.setConfig(module, newConfig);
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * 合并配置
   */
  private mergeConfigs(base: ModuleConfig, updates: Partial<ModuleConfig>): ModuleConfig {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = { ...(result[key] || {}), ...value };
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * 验证配置
   */
  private validateConfig(module: string, config: ModuleConfig): boolean {
    const schema = this.schemas.get(module);
    if (!schema) {
      return true; // 没有验证模式则跳过验证
    }

    for (const [path, rule] of Object.entries(schema)) {
      const value = this.getNestedValue(config, path);
      
      if (!this.validateValue(path, value, rule)) {
        this.logger.error(`Configuration validation failed for ${module}.${path}`, {
          value,
          rule
        });
        return false;
      }
    }

    return true;
  }

  /**
   * 验证单个值
   */
  private validateValue(path: string, value: any, rule: ConfigValidationRule): boolean {
    // 检查必需字段
    if (rule.required && (value === undefined || value === null)) {
      return false;
    }

    // 如果值为空且不是必需的，跳过其他验证
    if (value === undefined || value === null) {
      return true;
    }

    // 类型验证
    if (rule.type && !this.validateType(value, rule.type)) {
      return false;
    }

    // 数值范围验证
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return false;
      }
      if (rule.max !== undefined && value > rule.max) {
        return false;
      }
    }

    // 正则表达式验证
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return false;
    }

    // 枚举值验证
    if (rule.enum && !rule.enum.includes(value)) {
      return false;
    }

    // 自定义验证
    if (rule.custom) {
      const result = rule.custom(value);
      if (result === false || (typeof result === 'string' && result.length > 0)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证类型
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 设置验证模式
   */
  setSchema(module: string, schema: ConfigSchema): void {
    this.schemas.set(module, schema);
  }

  /**
   * 获取配置变更
   */
  private getConfigChanges(oldConfig?: ModuleConfig, newConfig?: ModuleConfig): any {
    if (!oldConfig || !newConfig) {
      return {};
    }

    const changes: any = {};
    
    for (const [key, value] of Object.entries(newConfig)) {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(value)) {
        changes[key] = {
          old: oldConfig[key],
          new: value
        };
      }
    }

    return changes;
  }

  /**
   * 添加配置观察者
   */
  watch(module: string, callback: (config: ModuleConfig) => void): () => void {
    if (!this.watchers.has(module)) {
      this.watchers.set(module, new Set());
    }

    this.watchers.get(module)!.add(callback);

    // 返回取消观察的函数
    return () => {
      const watchers = this.watchers.get(module);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(module);
        }
      }
    };
  }

  /**
   * 通知观察者
   */
  private notifyWatchers(module: string, config: ModuleConfig): void {
    const watchers = this.watchers.get(module);
    if (watchers) {
      for (const callback of watchers) {
        try {
          callback(config);
        } catch (error) {
          this.logger.error(`Error in config watcher for module ${module}:`, error);
        }
      }
    }
  }

  /**
   * 获取所有模块配置
   */
  getAllConfigs(): Map<string, ModuleConfig> {
    return new Map(this.configs);
  }

  /**
   * 重置模块配置为默认值
   */
  resetConfig(module: string): void {
    this.configs.delete(module);
    this.initializeDefaultConfigs();
    this.logger.info(`Configuration reset for module: ${module}`);
  }

  /**
   * 重置所有配置
   */
  resetAllConfigs(): void {
    this.configs.clear();
    this.initializeDefaultConfigs();
    this.logger.info('All configurations have been reset to defaults');
  }

  /**
   * 导出配置
   */
  exportConfigs(): Record<string, ModuleConfig> {
    const exported: Record<string, ModuleConfig> = {};
    for (const [module, config] of this.configs) {
      exported[module] = { ...config };
    }
    return exported;
  }

  /**
   * 导入配置
   */
  importConfigs(configs: Record<string, ModuleConfig>): void {
    for (const [module, config] of Object.entries(configs)) {
      try {
        this.setConfig(module, config);
      } catch (error) {
        this.logger.error(`Failed to import configuration for module ${module}:`, error);
      }
    }
  }
}