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
    this.currentConfig = this.configManager.getGlobalConfig();
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
    const newConfig = { ...oldConfig, ...updates };
    
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

    // 验证内存配置
    if (config.memory?.memoryLimitMB && config.memory.memoryLimitMB < 100) {
      errors.push('Memory limit must be at least 100MB');
    }

    // 验证缓存配置
    if (config.cache?.maxSize && config.cache.maxSize < 0) {
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