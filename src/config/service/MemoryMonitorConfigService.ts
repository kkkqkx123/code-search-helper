import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface MemoryMonitorConfig {
  /** 警告阈值（0-1） */
  warningThreshold: number;
  /** 严重阈值（0-1） */
  criticalThreshold: number;
  /** 紧急阈值（0-1） */
  emergencyThreshold: number;
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 清理冷却时间（毫秒） */
  cleanupCooldown: number;
  /** 历史记录最大数量 */
  maxHistorySize: number;
}

@injectable()
export class MemoryMonitorConfigService extends BaseConfigService<MemoryMonitorConfig> {
  loadConfig(): MemoryMonitorConfig {
    const rawConfig = {
      warningThreshold: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.90'),
      criticalThreshold: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '0.94'),
      emergencyThreshold: parseFloat(process.env.MEMORY_EMERGENCY_THRESHOLD || '0.98'),
      checkInterval: parseInt(process.env.MEMORY_CHECK_INTERVAL || '30000'),
      cleanupCooldown: parseInt(process.env.MEMORY_CLEANUP_COOLDOWN || '30000'),
      maxHistorySize: parseInt(process.env.MEMORY_HISTORY_SIZE || '100'),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): MemoryMonitorConfig {
    const schema = Joi.object({
      warningThreshold: Joi.number().min(0).max(1).default(0.90),
      criticalThreshold: Joi.number().min(0).max(1).default(0.94),
      emergencyThreshold: Joi.number().min(0).max(1).default(0.98),
      checkInterval: Joi.number().min(1000).default(30000),
      cleanupCooldown: Joi.number().min(1000).default(30000),
      maxHistorySize: Joi.number().min(10).default(100),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Memory monitor config validation error: ${error.message}`);
    }

    // 确保阈值逻辑正确：warning < critical < emergency
    if (value.warningThreshold >= value.criticalThreshold) {
      throw new Error('Warning threshold must be less than critical threshold');
    }
    if (value.criticalThreshold >= value.emergencyThreshold) {
      throw new Error('Critical threshold must be less than emergency threshold');
    }

    return value;
  }

  getDefaultConfig(): MemoryMonitorConfig {
    return {
      warningThreshold: 0.90,
      criticalThreshold: 0.94,
      emergencyThreshold: 0.98,
      checkInterval: 30000,
      cleanupCooldown: 30000,
      maxHistorySize: 100,
    };
  }
}