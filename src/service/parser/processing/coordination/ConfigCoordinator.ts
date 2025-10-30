import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { EventEmitter } from 'events';

export interface ConfigUpdateEvent {
  type: 'config-updated';
  changes: string[];
  timestamp: Date;
}

@injectable()
export class ConfigCoordinator extends EventEmitter {
  private configManager: UnifiedConfigManager;
  private logger?: LoggerService;
  private currentConfig: any;

  constructor(
    @inject(TYPES.UnifiedConfigManager) configManager: UnifiedConfigManager,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    super();
    this.configManager = configManager;
    this.logger = logger;
    // 合并全局配置和通用配置
    const globalConfig = this.configManager.getGlobalConfig();
    let universalConfig;
    try {
      universalConfig = this.configManager.getUniversalConfig();
    } catch (e) {
      // 如果获取通用配置失败，使用默认值
      universalConfig = {
        memory: { memoryLimitMB: 512, memoryCheckInterval: 5000 },
        chunking: { maxChunkSize: 2000, chunkOverlap: 200, maxLinesPerChunk: 1000 },
        error: { maxErrors: 5, errorResetInterval: 6000 },
        backup: { backupFilePatterns: [], backupFileConfidenceThreshold: 0.7 }
      };
    }
    // 确保配置对象结构完整，即使在测试环境中
    const basicConfig = globalConfig?.basic || {};
    this.currentConfig = {
      ...basicConfig,
      memory: universalConfig?.memory || { memoryLimitMB: 512, memoryCheckInterval: 5000 },
      chunking: universalConfig?.chunking || { maxChunkSize: 2000, chunkOverlap: 200, maxLinesPerChunk: 1000 },
      error: universalConfig?.error || { maxErrors: 5, errorResetInterval: 6000 },
      backup: universalConfig?.backup || { backupFilePatterns: [], backupFileConfidenceThreshold: 0.7 },
      cache: {
        maxSize: 2000 // 默认缓存大小
      },
      performance: {
        thresholds: {
          processFile: 5000 // 默认阈值
        }
      }
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): any {
    return { ...this.currentConfig };
  }

  /**
   * 更新配置并通知相关模块
   */
  async updateConfig(updates: Partial<any>): Promise<void> {
    const oldConfig = this.currentConfig;
    // 深度合并配置，确保嵌套对象被正确合并
    const newConfig = this.deepMerge({ ...oldConfig }, updates);
    
    // 验证配置
    const validationResult = this.validateConfig(newConfig);
    if (!validationResult.valid) {
      throw new Error(`Config validation failed: ${validationResult.errors.join(', ')}`);
    }

    // 应用配置更新
    this.currentConfig = newConfig;
    
    // 通知配置变更
    const changes = this.detectConfigChanges(oldConfig, newConfig);
    this.emitConfigUpdate(changes);
    
    this.logger?.info('Configuration updated', { changes });
  }

  /**
   * 深度合并配置对象
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  private isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }

  /**
   * 监听配置变更
   */
  onConfigUpdate(callback: (event: ConfigUpdateEvent) => void): void {
    this.on('config-updated', callback);
  }

  /**
   * 验证配置
   */
  private validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证内存配置 - 先检查memory对象中的memoryLimitMB
    if (config.memory && config.memory.memoryLimitMB !== undefined && config.memory.memoryLimitMB < 100) {
      errors.push('Memory limit must be at least 100MB');
    }
    // 然后检查maxChunkSize
    else if (config.maxChunkSize !== undefined && config.maxChunkSize < 100) {
      errors.push('Max chunk size must be at least 100');
    }

    // 验证缓存配置
    if (config.overlapSize !== undefined && config.overlapSize < 0) {
      errors.push('Overlap size must be non-negative');
    }

    if (config.cache && config.cache.maxSize !== undefined && config.cache.maxSize < 0) {
      errors.push('Cache size must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 检测配置变更
   */
  private detectConfigChanges(oldConfig: any, newConfig: any): string[] {
    const changes: string[] = [];

    // 检测基础配置变更
    if (oldConfig.maxChunkSize !== newConfig.maxChunkSize) {
      changes.push('maxChunkSize');
    }
    if (oldConfig.overlapSize !== newConfig.overlapSize) {
      changes.push('overlapSize');
    }
    if (oldConfig.preserveFunctionBoundaries !== newConfig.preserveFunctionBoundaries) {
      changes.push('preserveFunctionBoundaries');
    }

    // 检测内存配置变更
    if (oldConfig.memory?.memoryLimitMB !== newConfig.memory?.memoryLimitMB) {
      changes.push('memoryLimitMB');
    }

    // 检测缓存配置变更
    if (oldConfig.cache?.maxSize !== newConfig.cache?.maxSize) {
      changes.push('cacheMaxSize');
    }

    // 检测性能阈值变更
    if (oldConfig.performance?.thresholds !== newConfig.performance?.thresholds) {
      changes.push('performanceThresholds');
    }

    return changes;
  }

  /**
   * 发出配置更新事件
   */
  private emitConfigUpdate(changes: string[]): void {
    const event: ConfigUpdateEvent = {
      type: 'config-updated',
      changes,
      timestamp: new Date()
    };
    
    this.emit('config-updated', event);
  }
}