import { injectable } from 'inversify';
import { IConfigManager } from '../core/interfaces/IConfigManager';
import { ProcessingConfig, LanguageConfig } from '../core/types/ConfigTypes';

/**
 * 简单配置管理器实现
 * 提供基本的配置管理功能，避免循环依赖
 */
@injectable()
export class SimpleConfigManager implements IConfigManager {
  private config: ProcessingConfig;
  private listeners: Array<(oldConfig: ProcessingConfig, newConfig: ProcessingConfig, changes: any[]) => void> = [];

  constructor(config: ProcessingConfig) {
    this.config = { ...config };
  }

  getConfig(): ProcessingConfig {
    return { ...this.config };
  }

  getLanguageConfig(language: string): LanguageConfig {
    return this.config.languages[language] || {
      name: language,
      extensions: [],
      strategy: 'line-segmentation',
      enabled: true,
      priority: 1
    };
  }

  updateConfig(updates: Partial<ProcessingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    // 简单的变更检测
    const changes = this.detectChanges(oldConfig, this.config);
    
    // 通知监听器
    this.listeners.forEach(listener => {
      listener(oldConfig, this.config, changes);
    });
  }

  resetToDefaults(): void {
    const defaultConfig: ProcessingConfig = {
      chunking: {
        maxChunkSize: 2000,
        minChunkSize: 200,
        overlapSize: 100,
        maxLinesPerChunk: 50,
        minLinesPerChunk: 5,
        maxOverlapRatio: 0.2,
        defaultStrategy: 'semantic',
        strategyPriorities: {
          'semantic': 10,
          'bracket': 8,
          'line': 6,
          'ast': 9
        },
        enableIntelligentChunking: true,
        enableSemanticBoundaryDetection: true
      },
      features: {
        enableAST: true,
        enableSemanticDetection: true,
        enableBracketBalance: true,
        enableCodeOverlap: true,
        enableStandardization: true,
        standardizationFallback: true,
        enableComplexityCalculation: true,
        enableLanguageFeatureDetection: true,
        featureDetectionThresholds: {}
      },
      performance: {
        memoryLimitMB: 500,
        maxExecutionTime: 30000,
        enableCaching: true,
        cacheSizeLimit: 100,
        enablePerformanceMonitoring: true,
        concurrencyLimit: 10,
        queueSizeLimit: 100,
        enableBatchProcessing: true,
        batchSize: 50,
        enableLazyLoading: true
      },
      languages: {},
      postProcessing: {
        enabled: true,
        enabledProcessors: ['OverlapPostProcessor', 'ChunkFilter', 'ChunkRebalancer'],
        processorConfigs: {},
        processorOrder: ['OverlapPostProcessor', 'ChunkFilter', 'ChunkRebalancer'],
        maxProcessingRounds: 3,
        enableParallelProcessing: false,
        parallelProcessingLimit: 5
      },
      global: {
        debugMode: false,
        logLevel: 'info',
        enableMetrics: true,
        enableStatistics: true,
        configVersion: '1.0.0',
        compatibilityMode: false,
        strictMode: false,
        experimentalFeatures: [],
        customProperties: {}
      },
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.updateConfig(defaultConfig);
  }

  validateConfig(config: ProcessingConfig): any {
    const errors: any[] = [];
    const warnings: any[] = [];

    // 基本验证
    if (!config.chunking) {
      errors.push({
        path: 'chunking',
        message: 'Chunking configuration is required',
        code: 'MISSING_CHUNKING_CONFIG'
      });
    } else {
      if (config.chunking.maxChunkSize <= config.chunking.minChunkSize) {
        errors.push({
          path: 'chunking.maxChunkSize',
          message: 'maxChunkSize must be greater than minChunkSize',
          code: 'INVALID_CHUNK_SIZE'
        });
      }
    }

    if (!config.performance) {
      warnings.push({
        path: 'performance',
        message: 'Performance configuration is missing, using defaults',
        code: 'MISSING_PERFORMANCE_CONFIG'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  addConfigListener(listener: (oldConfig: ProcessingConfig, newConfig: ProcessingConfig, changes: any[]) => void): void {
    this.listeners.push(listener);
  }

  removeConfigListener(listener: (oldConfig: ProcessingConfig, newConfig: ProcessingConfig, changes: any[]) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async saveConfig(): Promise<void> {
    // 可选实现：保存到持久化存储
    // 目前为空实现
  }

  async loadConfig(): Promise<void> {
    // 可选实现：从持久化存储加载
    // 目前为空实现
  }

  /**
   * 检测配置变更
   */
  private detectChanges(oldConfig: ProcessingConfig, newConfig: ProcessingConfig): any[] {
    const changes: any[] = [];

    // 简单的变更检测逻辑
    const keys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
    
    for (const key of keys) {
      const oldValue = (oldConfig as any)[key];
      const newValue = (newConfig as any)[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          path: key,
          oldValue,
          newValue,
          type: newValue === undefined ? 'delete' : oldValue === undefined ? 'add' : 'update'
        });
      }
    }

    return changes;
  }
}