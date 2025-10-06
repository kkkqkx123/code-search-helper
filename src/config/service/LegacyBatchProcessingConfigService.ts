import { injectable } from 'inversify';
import { BatchProcessingConfigService, BatchProcessingConfig } from './BatchProcessingConfigService';
import * as Joi from 'joi';

/**
 * Legacy batch processing configuration with adaptive batching support
 * Provides backward compatibility for existing code that depends on adaptive batching
 * Follows Liskov Substitution Principle by extending the simplified service
 */
export interface LegacyBatchProcessingConfig {
  enabled: boolean;
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;

  // Legacy adaptive batching (deprecated - use separate adaptive service if needed)
  adaptiveBatching: {
    enabled: boolean;
    minBatchSize: number;
    maxBatchSize: number;
    performanceThreshold: number;
    adjustmentFactor: number;
  };

  // Simplified monitoring
  monitoring?: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      highMemoryUsage: number;
      highErrorRate: number;
      // Legacy fields for backward compatibility
      lowThroughput?: number;
      criticalMemoryUsage?: number;
      highCpuUsage?: number;
      criticalCpuUsage?: number;
    };
  };
}

/**
 * Legacy batch processing configuration service
 * Provides backward compatibility while encouraging migration to simplified version
 */
@injectable()
export class LegacyBatchProcessingConfigService extends BatchProcessingConfigService {
  loadConfig(): LegacyBatchProcessingConfig {
    // Get base configuration from simplified service
    const baseConfig = super.loadConfig();

    // Add legacy adaptive batching configuration (with deprecation warning)
    const legacyConfig: LegacyBatchProcessingConfig = {
      ...baseConfig,
      adaptiveBatching: {
        enabled: process.env.ADAPTIVE_BATCHING_ENABLED !== 'false',
        minBatchSize: parseInt(process.env.MIN_BATCH_SIZE || '10'),
        maxBatchSize: parseInt(process.env.ADAPTIVE_MAX_BATCH_SIZE || '200'),
        performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '1000'),
        adjustmentFactor: parseFloat(process.env.ADJUSTMENT_FACTOR || '1.2'),
      },

      // Extend monitoring with legacy fields
      monitoring: baseConfig.monitoring ? {
        ...baseConfig.monitoring,
        alertThresholds: {
          ...baseConfig.monitoring.alertThresholds,
          // Legacy fields for backward compatibility
          lowThroughput: parseInt(process.env.LOW_THROUGHPUT_THRESHOLD || '10'),
          criticalMemoryUsage: parseInt(process.env.CRITICAL_MEMORY_USAGE_THRESHOLD || '90'),
          highCpuUsage: parseInt(process.env.HIGH_CPU_USAGE_THRESHOLD || '70'),
          criticalCpuUsage: parseInt(process.env.CRITICAL_CPU_USAGE_THRESHOLD || '85'),
        },
      } : undefined,
    };

    // Log deprecation warning in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DEPRECATED] LegacyBatchProcessingConfigService is deprecated. Please migrate to BatchProcessingConfigService. Adaptive batching will be removed in a future version.');
    }

    return this.validateConfig(legacyConfig);
  }

  validateConfig(config: any): LegacyBatchProcessingConfig {
    const schema = Joi.object({
      // Base configuration
      enabled: Joi.boolean().default(true),
      maxConcurrentOperations: Joi.number().positive().max(100).default(5),
      defaultBatchSize: Joi.number().positive().max(10000).default(50),
      maxBatchSize: Joi.number().positive().max(10000).default(500),
      memoryThreshold: Joi.number().positive().min(10).max(95).default(80),
      processingTimeout: Joi.number().positive().min(1000).default(300000),
      retryAttempts: Joi.number().positive().max(10).default(3),
      retryDelay: Joi.number().positive().min(100).default(1000),
      continueOnError: Joi.boolean().default(true),

      // Legacy adaptive batching (deprecated)
      adaptiveBatching: Joi.object({
        enabled: Joi.boolean().default(false), // Disabled by default to encourage migration
        minBatchSize: Joi.number().positive().default(10),
        maxBatchSize: Joi.number().positive().default(200),
        performanceThreshold: Joi.number().positive().default(1000),
        adjustmentFactor: Joi.number().positive().min(0.01).max(1.0).default(1.2),
      }),

      // Monitoring with legacy support
      monitoring: Joi.object({
        enabled: Joi.boolean().default(true),
        metricsInterval: Joi.number().positive().min(1000).default(60000),
        alertThresholds: Joi.object({
          highLatency: Joi.number().positive().min(100).default(5000),
          highMemoryUsage: Joi.number().positive().min(10).max(95).default(80),
          highErrorRate: Joi.number().positive().min(0).max(1).default(0.1),
          // Legacy fields
          lowThroughput: Joi.number().positive().default(10),
          criticalMemoryUsage: Joi.number().positive().min(1).max(100).default(90),
          highCpuUsage: Joi.number().positive().min(0).max(100).default(70),
          criticalCpuUsage: Joi.number().positive().min(0).max(100).default(85),
        }),
      }).optional(),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Legacy batch processing config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): LegacyBatchProcessingConfig {
    const baseConfig = super.getDefaultConfig();

    return {
      ...baseConfig,
      adaptiveBatching: {
        enabled: false, // Disabled by default
        minBatchSize: 10,
        maxBatchSize: 200,
        performanceThreshold: 1000,
        adjustmentFactor: 1.2,
      },
      monitoring: baseConfig.monitoring ? {
        ...baseConfig.monitoring,
        alertThresholds: {
          ...baseConfig.monitoring.alertThresholds,
          lowThroughput: 10,
          criticalMemoryUsage: 90,
          highCpuUsage: 70,
          criticalCpuUsage: 85,
        },
      } : undefined,
    };
  }

  /**
   * Get simplified configuration for migration
   * Returns configuration compatible with the simplified BatchProcessingConfigService
   */
  getSimplifiedConfig(): BatchProcessingConfig {
    const legacyConfig = this.getConfig();

    return {
      enabled: legacyConfig.enabled,
      maxConcurrentOperations: legacyConfig.maxConcurrentOperations,
      defaultBatchSize: legacyConfig.defaultBatchSize,
      maxBatchSize: legacyConfig.maxBatchSize,
      memoryThreshold: legacyConfig.memoryThreshold,
      processingTimeout: legacyConfig.processingTimeout,
      retryAttempts: legacyConfig.retryAttempts,
      retryDelay: legacyConfig.retryDelay,
      continueOnError: legacyConfig.continueOnError,
      monitoring: legacyConfig.monitoring ? {
        enabled: legacyConfig.monitoring.enabled,
        metricsInterval: legacyConfig.monitoring.metricsInterval,
        alertThresholds: {
          highLatency: legacyConfig.monitoring.alertThresholds.highLatency,
          highMemoryUsage: legacyConfig.monitoring.alertThresholds.highMemoryUsage,
          highErrorRate: legacyConfig.monitoring.alertThresholds.highErrorRate,
        },
      } : undefined,
    };
  }

  /**
   * Check if adaptive batching is enabled (for migration purposes)
   */
  isAdaptiveBatchingEnabled(): boolean {
    const config = this.getConfig() as LegacyBatchProcessingConfig;
    return config.adaptiveBatching.enabled;
  }

  /**
   * Get migration warnings
   */
  getMigrationWarnings(): string[] {
    const config = this.getConfig() as LegacyBatchProcessingConfig;
    const warnings: string[] = [];

    if (config.adaptiveBatching.enabled) {
      warnings.push('Adaptive batching is deprecated and will be removed in a future version. Consider using a dedicated adaptive batching service.');
    }

    if (config.monitoring?.alertThresholds.lowThroughput) {
      warnings.push('lowThroughput threshold is deprecated. Use highLatency threshold instead.');
    }

    if (config.monitoring?.alertThresholds.criticalMemoryUsage) {
      warnings.push('criticalMemoryUsage threshold is deprecated. Use highMemoryUsage threshold instead.');
    }

    if (config.monitoring?.alertThresholds.highCpuUsage || config.monitoring?.alertThresholds.criticalCpuUsage) {
      warnings.push('CPU usage thresholds are deprecated. Use memory and latency thresholds instead.');
    }

    return warnings;
  }
}