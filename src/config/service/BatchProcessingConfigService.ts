import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';
import { parseRateEnv } from '../utils/environment-variables';

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
      enabled: EnvironmentUtils.parseBoolean('BATCH_PROCESSING_ENABLED', true),
      maxConcurrentOperations: EnvironmentUtils.parseNumber('MAX_CONCURRENT_OPERATIONS', 5),
      defaultBatchSize: EnvironmentUtils.parseNumber('DEFAULT_BATCH_SIZE', 50),
      maxBatchSize: EnvironmentUtils.parseNumber('MAX_BATCH_SIZE', 500),
      memoryThreshold: parseRateEnv('MEMORY_THRESHOLD', 0.80),
      processingTimeout: EnvironmentUtils.parseNumber('PROCESSING_TIMEOUT', 300000),
      retryAttempts: EnvironmentUtils.parseNumber('RETRY_ATTEMPTS', 3),
      retryDelay: EnvironmentUtils.parseNumber('RETRY_DELAY', 1000),
      continueOnError: EnvironmentUtils.parseBoolean('CONTINUE_ON_ERROR', true),

      // Simplified monitoring (4 environment variables instead of 9)
      monitoring: {
        enabled: !EnvironmentUtils.parseBoolean('BATCH_MONITORING_ENABLED', true),
        metricsInterval: EnvironmentUtils.parseNumber('METRICS_INTERVAL', 60000),
        alertThresholds: {
          highLatency: EnvironmentUtils.parseNumber('HIGH_LATENCY_THRESHOLD', 5000),
          highMemoryUsage: parseRateEnv('HIGH_MEMORY_USAGE_THRESHOLD', 0.80),
          highErrorRate: EnvironmentUtils.parseFloat('HIGH_ERROR_RATE_THRESHOLD', 0.1),
        },
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): BatchProcessingConfig {
    const schema = Joi.object({
      enabled: ValidationUtils.booleanSchema(true),
      maxConcurrentOperations: ValidationUtils.rangeNumberSchema(1, 100, 5),
      defaultBatchSize: ValidationUtils.rangeNumberSchema(1, 10000, 50),
      maxBatchSize: ValidationUtils.rangeNumberSchema(1, 10000, 500),
      memoryThreshold: ValidationUtils.rangeNumberSchema(0.1, 0.95, 0.80),
      processingTimeout: ValidationUtils.optionalRangeNumberSchema(1000, Number.MAX_SAFE_INTEGER, 300000),
      retryAttempts: ValidationUtils.rangeNumberSchema(1, 10, 3),
      retryDelay: ValidationUtils.optionalRangeNumberSchema(100, Number.MAX_SAFE_INTEGER, 1000),
      continueOnError: ValidationUtils.booleanSchema(true),

      // Optional monitoring - if not needed, can be undefined
      monitoring: ValidationUtils.optionalObjectSchema({
        enabled: ValidationUtils.booleanSchema(true),
        metricsInterval: ValidationUtils.optionalRangeNumberSchema(1000, Number.MAX_SAFE_INTEGER, 60000),
        alertThresholds: ValidationUtils.objectSchema({
          highLatency: ValidationUtils.optionalRangeNumberSchema(100, Number.MAX_SAFE_INTEGER, 5000),
          highMemoryUsage: ValidationUtils.rangeNumberSchema(0.1, 0.95, 0.80),
          highErrorRate: ValidationUtils.rangeNumberSchema(0, 1, 0.1),
        }),
      }),
    });

    return ValidationUtils.validateConfig(config, schema);
  }

  getDefaultConfig(): BatchProcessingConfig {
    return {
      enabled: true,
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      memoryThreshold: 0.80,
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
          highMemoryUsage: 0.80,
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
      memoryThreshold: 0.70,
      processingTimeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      continueOnError: true,
      // No monitoring - not needed for basic use cases
    };
  }
}