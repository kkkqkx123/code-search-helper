import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

/**
 * Simplified batch processing configuration
 * Removed complex adaptive batching and excessive monitoring thresholds
 * Following KISS and YAGNI principles
 */
export interface BatchProcessingConfig {
  enabled: boolean;
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;

  // Simplified monitoring - only essential metrics
  monitoring?: {
    enabled: boolean;
    metricsInterval: number;

    // Essential alert thresholds only
    alertThresholds: {
      highLatency: number;
      highMemoryUsage: number;
      highErrorRate: number;
    };
  };
}

@injectable()
export class BatchProcessingConfigService extends BaseConfigService<BatchProcessingConfig> {
  loadConfig(): BatchProcessingConfig {
    const rawConfig = {
      // Core batch processing settings (8 environment variables instead of 18)
      enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
      maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPERATIONS || '5'),
      defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
      maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500'),
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
      processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',

      // Simplified monitoring (4 environment variables instead of 9)
      monitoring: {
        enabled: process.env.BATCH_MONITORING_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
        alertThresholds: {
          highLatency: parseInt(process.env.HIGH_LATENCY_THRESHOLD || '5000'),
          highMemoryUsage: parseInt(process.env.HIGH_MEMORY_USAGE_THRESHOLD || '80'),
          highErrorRate: parseFloat(process.env.HIGH_ERROR_RATE_THRESHOLD || '0.1'),
        },
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): BatchProcessingConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      maxConcurrentOperations: Joi.number().positive().max(100).default(5),
      defaultBatchSize: Joi.number().positive().max(10000).default(50),
      maxBatchSize: Joi.number().positive().max(10000).default(500),
      memoryThreshold: Joi.number().positive().min(10).max(95).default(80),
      processingTimeout: Joi.number().positive().min(1000).default(300000),
      retryAttempts: Joi.number().positive().max(10).default(3),
      retryDelay: Joi.number().positive().min(100).default(1000),
      continueOnError: Joi.boolean().default(true),

      // Optional monitoring - if not needed, can be undefined
      monitoring: Joi.object({
        enabled: Joi.boolean().default(true),
        metricsInterval: Joi.number().positive().min(1000).default(60000),
        alertThresholds: Joi.object({
          highLatency: Joi.number().positive().min(100).default(5000),
          highMemoryUsage: Joi.number().positive().min(10).max(95).default(80),
          highErrorRate: Joi.number().positive().min(0).max(1).default(0.1),
        }),
      }).optional(),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Batch processing config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): BatchProcessingConfig {
    return {
      enabled: true,
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      memoryThreshold: 80,
      processingTimeout: 300000,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: true,

      // Essential monitoring only
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        alertThresholds: {
          highLatency: 5000,
          highMemoryUsage: 80,
          highErrorRate: 0.1,
        },
      },
    };
  }

  /**
   * Get a minimal configuration for environments where monitoring is not needed
   * This follows YAGNI principle - only include what you actually need
   */
  getMinimalConfig(): BatchProcessingConfig {
    return {
      enabled: true,
      maxConcurrentOperations: 3,
      defaultBatchSize: 25,
      maxBatchSize: 100,
      memoryThreshold: 70,
      processingTimeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      continueOnError: true,
      // No monitoring - not needed for basic use cases
    };
  }
}