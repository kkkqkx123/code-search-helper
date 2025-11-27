import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';

/**
 * 批处理配置接口
 */
export interface BatchProcessingConfig {
  maxBatchSize: number;
  maxConcurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enabled: boolean;
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  continueOnError: boolean;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      highMemoryUsage: number;
      highErrorRate: number;
    };
  };
}

/**
 * 批处理配置管理服务
 */
@injectable()
export class BatchConfigManager {
  private config: BatchProcessingConfig | null = null;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 获取配置，如果未初始化则使用默认配置
   */
  getConfig(): BatchProcessingConfig {
    if (!this.config) {
      this.config = this.getDefaultConfig();
      this.logger.info('BatchProcessingService config initialized with defaults', {
        config: this.config
      });
    }
    return this.config;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): BatchProcessingConfig {
    return {
      enabled: true,
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      maxConcurrency: 5,
      timeout: 30000,
      memoryThreshold: 0.80,
      processingTimeout: 300000,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: true,
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        alertThresholds: {
          highLatency: 5000,
          highMemoryUsage: 0.80,
          highErrorRate: 0.1,
        },
      },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.getDefaultConfig(), ...config };
    this.logger.info('BatchProcessingService config updated', {
      config: this.config
    });
  }

  /**
   * 重置配置为默认值
   */
  resetConfig(): void {
    this.config = null;
    this.logger.info('BatchProcessingService config reset to defaults');
  }
}
