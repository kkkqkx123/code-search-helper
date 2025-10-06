import { injectable } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { 
  InfrastructureConfig, 
  ConfigValidationRule, 
  ConfigValidationResult 
} from './types';

@injectable()
export class ConfigValidator {
  private logger: LoggerService;
  private validationRules: Map<string, ConfigValidationRule[]>;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.validationRules = new Map();
    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    // 通用配置验证规则
    this.validationRules.set('common', [
      {
        field: 'enableCache',
        required: true,
        type: 'boolean',
        message: 'enableCache must be a boolean value'
      },
      {
        field: 'enableMonitoring',
        required: true,
        type: 'boolean',
        message: 'enableMonitoring must be a boolean value'
      },
      {
        field: 'enableBatching',
        required: true,
        type: 'boolean',
        message: 'enableBatching must be a boolean value'
      },
      {
        field: 'logLevel',
        required: true,
        type: 'string',
        pattern: /^(debug|info|warn|error)$/,
        message: 'logLevel must be one of: debug, info, warn, error'
      },
      {
        field: 'enableHealthChecks',
        required: true,
        type: 'boolean',
        message: 'enableHealthChecks must be a boolean value'
      },
      {
        field: 'healthCheckInterval',
        required: true,
        type: 'number',
        min: 1000,
        message: 'healthCheckInterval must be at least 1000ms'
      },
      {
        field: 'gracefulShutdownTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'gracefulShutdownTimeout must be at least 1000ms'
      }
    ]);

    // 缓存配置验证规则
    this.validationRules.set('cache', [
      {
        field: 'defaultTTL',
        required: true,
        type: 'number',
        min: 1000,
        message: 'defaultTTL must be at least 1000ms'
      },
      {
        field: 'maxEntries',
        required: true,
        type: 'number',
        min: 1,
        message: 'maxEntries must be at least 1'
      },
      {
        field: 'cleanupInterval',
        required: true,
        type: 'number',
        min: 1000,
        message: 'cleanupInterval must be at least 1000ms'
      },
      {
        field: 'enableStats',
        required: true,
        type: 'boolean',
        message: 'enableStats must be a boolean value'
      }
    ]);

    // 性能配置验证规则
    this.validationRules.set('performance', [
      {
        field: 'monitoringInterval',
        required: true,
        type: 'number',
        min: 1000,
        message: 'monitoringInterval must be at least 1000ms'
      },
      {
        field: 'metricsRetentionPeriod',
        required: true,
        type: 'number',
        min: 60000,
        message: 'metricsRetentionPeriod must be at least 60000ms'
      },
      {
        field: 'enableDetailedLogging',
        required: true,
        type: 'boolean',
        message: 'enableDetailedLogging must be a boolean value'
      }
    ]);

    // 批处理配置验证规则
    this.validationRules.set('batch', [
      {
        field: 'maxConcurrentOperations',
        required: true,
        type: 'number',
        min: 1,
        max: 100,
        message: 'maxConcurrentOperations must be between 1 and 100'
      },
      {
        field: 'defaultBatchSize',
        required: true,
        type: 'number',
        min: 1,
        max: 10000,
        message: 'defaultBatchSize must be between 1 and 10000'
      },
      {
        field: 'maxBatchSize',
        required: true,
        type: 'number',
        min: 1,
        max: 10000,
        message: 'maxBatchSize must be between 1 and 10000'
      },
      {
        field: 'minBatchSize',
        required: true,
        type: 'number',
        min: 1,
        max: 1000,
        message: 'minBatchSize must be between 1 and 1000'
      },
      {
        field: 'memoryThreshold',
        required: true,
        type: 'number',
        min: 10,
        max: 95,
        message: 'memoryThreshold must be between 10 and 95'
      },
      {
        field: 'processingTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'processingTimeout must be at least 1000ms'
      },
      {
        field: 'retryAttempts',
        required: true,
        type: 'number',
        min: 0,
        max: 10,
        message: 'retryAttempts must be between 0 and 10'
      },
      {
        field: 'retryDelay',
        required: true,
        type: 'number',
        min: 100,
        message: 'retryDelay must be at least 100ms'
      },
      {
        field: 'adaptiveBatchingEnabled',
        required: true,
        type: 'boolean',
        message: 'adaptiveBatchingEnabled must be a boolean value'
      },
      {
        field: 'performanceThreshold',
        required: true,
        type: 'number',
        min: 100,
        message: 'performanceThreshold must be at least 100ms'
      },
      {
        field: 'adjustmentFactor',
        required: true,
        type: 'number',
        min: 0.01,
        max: 1.0,
        message: 'adjustmentFactor must be between 0.01 and 1.0'
      }
    ]);

    // 连接配置验证规则
    this.validationRules.set('connection', [
      {
        field: 'maxConnections',
        required: true,
        type: 'number',
        min: 1,
        max: 1000,
        message: 'maxConnections must be between 1 and 1000'
      },
      {
        field: 'minConnections',
        required: true,
        type: 'number',
        min: 0,
        message: 'minConnections must be at least 0'
      },
      {
        field: 'connectionTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'connectionTimeout must be at least 1000ms'
      },
      {
        field: 'idleTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'idleTimeout must be at least 1000ms'
      },
      {
        field: 'acquireTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'acquireTimeout must be at least 1000ms'
      },
      {
        field: 'validationInterval',
        required: true,
        type: 'number',
        min: 1000,
        message: 'validationInterval must be at least 1000ms'
      },
      {
        field: 'enableConnectionPooling',
        required: true,
        type: 'boolean',
        message: 'enableConnectionPooling must be a boolean value'
      }
    ]);

    // 事务配置验证规则
    this.validationRules.set('transaction', [
      {
        field: 'timeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'timeout must be at least 1000ms'
      },
      {
        field: 'retryAttempts',
        required: true,
        type: 'number',
        min: 0,
        max: 10,
        message: 'retryAttempts must be between 0 and 10'
      },
      {
        field: 'retryDelay',
        required: true,
        type: 'number',
        min: 100,
        message: 'retryDelay must be at least 100ms'
      },
      {
        field: 'enableTwoPhaseCommit',
        required: true,
        type: 'boolean',
        message: 'enableTwoPhaseCommit must be a boolean value'
      },
      {
        field: 'maxConcurrentTransactions',
        required: true,
        type: 'number',
        min: 1,
        max: 1000,
        message: 'maxConcurrentTransactions must be between 1 and 1000'
      },
      {
        field: 'deadlockDetectionTimeout',
        required: true,
        type: 'number',
        min: 1000,
        message: 'deadlockDetectionTimeout must be at least 1000ms'
      }
    ]);
  }

  validateConfig(config: InfrastructureConfig): ConfigValidationResult {
    this.logger.debug('Starting configuration validation');

    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // 验证通用配置
    this.validateSection('common', config.common, result);

    // 验证 Qdrant 配置
    this.validateSection('cache', config.qdrant.cache, result, 'qdrant.cache');
    this.validateSection('performance', config.qdrant.performance, result, 'qdrant.performance');
    this.validateSection('batch', config.qdrant.batch, result, 'qdrant.batch');
    this.validateSection('connection', config.qdrant.connection, result, 'qdrant.connection');

    // 验证 Nebula 配置
    this.validateSection('cache', config.nebula.cache, result, 'nebula.cache');
    this.validateSection('performance', config.nebula.performance, result, 'nebula.performance');
    this.validateSection('batch', config.nebula.batch, result, 'nebula.batch');
    this.validateSection('connection', config.nebula.connection, result, 'nebula.connection');

    // 验证事务配置
    this.validateSection('transaction', config.transaction, result);

    // 执行自定义验证逻辑
    this.performCustomValidations(config, result);

    result.isValid = result.errors.length === 0;

    if (result.isValid) {
      this.logger.info('Configuration validation passed');
    } else {
      this.logger.error('Configuration validation failed', {
        errors: result.errors.length,
        warnings: result.warnings.length
      });
    }

    return result;
  }

  private validateSection(
    sectionName: string, 
    sectionData: any, 
    result: ConfigValidationResult,
    prefix?: string
  ): void {
    const rules = this.validationRules.get(sectionName);
    if (!rules) {
      this.logger.warn(`No validation rules found for section: ${sectionName}`);
      return;
    }

    const fieldPrefix = prefix ? `${prefix}.` : '';

    for (const rule of rules) {
      const fieldPath = `${fieldPrefix}${rule.field}`;
      const value = sectionData[rule.field];

      // 检查必需字段
      if (rule.required && (value === undefined || value === null)) {
        result.errors.push({
          field: fieldPath,
          message: `${rule.field} is required`,
          value
        });
        continue;
      }

      // 如果字段不存在且不是必需的，跳过验证
      if (value === undefined || value === null) {
        continue;
      }

      // 类型验证
      if (!this.validateType(value, rule.type)) {
        result.errors.push({
          field: fieldPath,
          message: rule.message || `${rule.field} must be of type ${rule.type}`,
          value
        });
        continue;
      }

      // 数值范围验证
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          result.errors.push({
            field: fieldPath,
            message: rule.message || `${rule.field} must be at least ${rule.min}`,
            value
          });
        }
        if (rule.max !== undefined && value > rule.max) {
          result.errors.push({
            field: fieldPath,
            message: rule.message || `${rule.field} must be at most ${rule.max}`,
            value
          });
        }
      }

      // 正则表达式验证
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        result.errors.push({
          field: fieldPath,
          message: rule.message || `${rule.field} format is invalid`,
          value
        });
      }

      // 自定义验证器
      if (rule.validator && !rule.validator(value)) {
        result.errors.push({
          field: fieldPath,
          message: rule.message || `${rule.field} validation failed`,
          value
        });
      }
    }
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
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

  private performCustomValidations(config: InfrastructureConfig, result: ConfigValidationResult): void {
    // 验证批处理配置的逻辑一致性
    this.validateBatchConsistency(config, result);

    // 验证连接池配置的逻辑一致性
    this.validateConnectionConsistency(config, result);

    // 验证性能阈值配置
    this.validatePerformanceThresholds(config, result);
  }

  private validateBatchConsistency(config: InfrastructureConfig, result: ConfigValidationResult): void {
    // 检查 Qdrant 批处理配置
    const qdrantBatch = config.qdrant.batch;
    if (qdrantBatch.minBatchSize > qdrantBatch.defaultBatchSize) {
      result.errors.push({
        field: 'qdrant.batch.minBatchSize',
        message: 'minBatchSize cannot be greater than defaultBatchSize',
        value: qdrantBatch.minBatchSize
      });
    }

    if (qdrantBatch.defaultBatchSize > qdrantBatch.maxBatchSize) {
      result.errors.push({
        field: 'qdrant.batch.defaultBatchSize',
        message: 'defaultBatchSize cannot be greater than maxBatchSize',
        value: qdrantBatch.defaultBatchSize
      });
    }

    // 检查 Nebula 批处理配置
    const nebulaBatch = config.nebula.batch;
    if (nebulaBatch.minBatchSize > nebulaBatch.defaultBatchSize) {
      result.errors.push({
        field: 'nebula.batch.minBatchSize',
        message: 'minBatchSize cannot be greater than defaultBatchSize',
        value: nebulaBatch.minBatchSize
      });
    }

    if (nebulaBatch.defaultBatchSize > nebulaBatch.maxBatchSize) {
      result.errors.push({
        field: 'nebula.batch.defaultBatchSize',
        message: 'defaultBatchSize cannot be greater than maxBatchSize',
        value: nebulaBatch.defaultBatchSize
      });
    }
  }

  private validateConnectionConsistency(config: InfrastructureConfig, result: ConfigValidationResult): void {
    // 检查 Qdrant 连接池配置
    const qdrantConn = config.qdrant.connection;
    if (qdrantConn.minConnections > qdrantConn.maxConnections) {
      result.errors.push({
        field: 'qdrant.connection.minConnections',
        message: 'minConnections cannot be greater than maxConnections',
        value: qdrantConn.minConnections
      });
    }

    // 检查 Nebula 连接池配置
    const nebulaConn = config.nebula.connection;
    if (nebulaConn.minConnections > nebulaConn.maxConnections) {
      result.errors.push({
        field: 'nebula.connection.minConnections',
        message: 'minConnections cannot be greater than maxConnections',
        value: nebulaConn.minConnections
      });
    }
  }

  private validatePerformanceThresholds(config: InfrastructureConfig, result: ConfigValidationResult): void {
    // 检查性能阈值是否合理
    const qdrantPerf = config.qdrant.performance.performanceThresholds;
    if (qdrantPerf.queryExecutionTime < 100) {
      result.warnings.push({
        field: 'qdrant.performance.performanceThresholds.queryExecutionTime',
        message: 'queryExecutionTime threshold is very low (< 100ms), may cause false alerts',
        value: qdrantPerf.queryExecutionTime
      });
    }

    const nebulaPerf = config.nebula.performance.performanceThresholds;
    if (nebulaPerf.queryExecutionTime < 100) {
      result.warnings.push({
        field: 'nebula.performance.performanceThresholds.queryExecutionTime',
        message: 'queryExecutionTime threshold is very low (< 100ms), may cause false alerts',
        value: nebulaPerf.queryExecutionTime
      });
    }
  }
}