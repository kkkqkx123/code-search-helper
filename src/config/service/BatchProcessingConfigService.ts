import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

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
  adaptiveBatching: {
    enabled: boolean;
    minBatchSize: number;
    maxBatchSize: number;
    performanceThreshold: number;
    adjustmentFactor: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      lowThroughput: number;
      highErrorRate: number;
      highMemoryUsage: number;
      criticalMemoryUsage: number;
      highCpuUsage: number;
      criticalCpuUsage: number;
    };
  };
}

@injectable()
export class BatchProcessingConfigService extends BaseConfigService<BatchProcessingConfig> {
  loadConfig(): BatchProcessingConfig {
    const rawConfig = {
      enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
      maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPERATIONS || '5'),
      defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
      maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500'),
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
      processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',
      adaptiveBatching: {
        enabled: process.env.ADAPTIVE_BATCHING_ENABLED !== 'false',
        minBatchSize: parseInt(process.env.MIN_BATCH_SIZE || '10'),
        maxBatchSize: parseInt(process.env.ADAPTIVE_MAX_BATCH_SIZE || '200'),
        performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '1000'),
        adjustmentFactor: parseFloat(process.env.ADJUSTMENT_FACTOR || '1.2'),
      },
      monitoring: {
        enabled: process.env.BATCH_MONITORING_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
        alertThresholds: {
          highLatency: parseInt(process.env.HIGH_LATENCY_THRESHOLD || '5000'),
          lowThroughput: parseInt(process.env.LOW_THROUGHPUT_THRESHOLD || '10'),
          highErrorRate: parseFloat(process.env.HIGH_ERROR_RATE_THRESHOLD || '0.1'),
          highMemoryUsage: parseInt(process.env.HIGH_MEMORY_USAGE_THRESHOLD || '80'),
          criticalMemoryUsage: parseInt(process.env.CRITICAL_MEMORY_USAGE_THRESHOLD || '90'),
          highCpuUsage: parseInt(process.env.HIGH_CPU_USAGE_THRESHOLD || '70'),
          criticalCpuUsage: parseInt(process.env.CRITICAL_CPU_USAGE_THRESHOLD || '85'),
        },
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): BatchProcessingConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      maxConcurrentOperations: Joi.number().positive().default(5),
      defaultBatchSize: Joi.number().positive().default(50),
      maxBatchSize: Joi.number().positive().default(500),
      memoryThreshold: Joi.number().positive().default(80),
      processingTimeout: Joi.number().positive().default(300000),
      retryAttempts: Joi.number().positive().default(3),
      retryDelay: Joi.number().positive().default(1000),
      continueOnError: Joi.boolean().default(true),
      adaptiveBatching: Joi.object({
        enabled: Joi.boolean().default(true),
        minBatchSize: Joi.number().positive().default(10),
        maxBatchSize: Joi.number().positive().default(200),
        performanceThreshold: Joi.number().positive().default(1000),
        adjustmentFactor: Joi.number().positive().default(1.2),
      }),
      monitoring: Joi.object({
        enabled: Joi.boolean().default(true),
        metricsInterval: Joi.number().positive().default(60000),
        alertThresholds: Joi.object({
          highLatency: Joi.number().positive().default(5000),
          lowThroughput: Joi.number().positive().default(10),
          highErrorRate: Joi.number().positive().default(0.1),
          highMemoryUsage: Joi.number().positive().default(80),
          criticalMemoryUsage: Joi.number().positive().default(90),
          highCpuUsage: Joi.number().positive().default(70),
          criticalCpuUsage: Joi.number().positive().default(85),
        }),
      }),
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
      adaptiveBatching: {
        enabled: true,
        minBatchSize: 10,
        maxBatchSize: 200,
        performanceThreshold: 1000,
        adjustmentFactor: 1.2,
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        alertThresholds: {
          highLatency: 5000,
          lowThroughput: 10,
          highErrorRate: 0.1,
          highMemoryUsage: 80,
          criticalMemoryUsage: 90,
          highCpuUsage: 70,
          criticalCpuUsage: 85,
        },
      },
    };
  }
}