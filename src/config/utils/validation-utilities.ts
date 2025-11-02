import * as Joi from 'joi';

/**
 * Shared validation utilities for configuration services
 * Eliminates DRY violations in validation schemas
 * Follows DRY principle by providing reusable validation patterns
 */

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  // Common numeric patterns
  positiveInteger: Joi.number().positive().integer(),
  nonNegativeInteger: Joi.number().min(0).integer(),
  percentage: Joi.number().min(0).max(100),
  rate: Joi.number().min(0).max(1),

  // Common string patterns
  url: Joi.string().uri(),
  nonEmptyString: Joi.string().min(1).trim(),
  alphanumeric: Joi.string().alphanum(),

  // Common time patterns (in milliseconds)
  timeout: Joi.number().positive().min(100), // Minimum 100ms
  interval: Joi.number().positive().min(1000), // Minimum 1 second
  retention: Joi.number().positive().min(60000), // Minimum 1 minute


  // Common batch processing patterns
  batchSize: Joi.number().positive().min(1).max(10000),
  memoryThreshold: Joi.number().min(10).max(95), // Percentage
  concurrentOperations: Joi.number().positive().min(1).max(100),

  // Common cache patterns
  ttl: Joi.number().positive().min(1000), // Minimum 1 second
  maxEntries: Joi.number().positive().min(1),

  // Log levels
  logLevel: Joi.string().valid('debug', 'info', 'warn', 'error'),

  // Boolean patterns with defaults
  booleanDefaultTrue: Joi.boolean().default(true),
  booleanDefaultFalse: Joi.boolean().default(false),
} as const;

/**
 * Reusable validation schema builders
 */
export class SchemaBuilder {
  /**
   * Build service configuration schema
   */
  static serviceSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      enabled: ValidationPatterns.booleanDefaultTrue,
      timeout: ValidationPatterns.timeout.default(30000),
      retryAttempts: ValidationPatterns.positiveInteger.default(3),
      retryDelay: ValidationPatterns.timeout.default(1000),
      logLevel: ValidationPatterns.logLevel.default('info'),
      ...additionalFields,
    });
  }


  /**
   * Build cache configuration schema
   */
  static cacheSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      defaultTTL: ValidationPatterns.ttl.default(300000),
      maxEntries: ValidationPatterns.maxEntries.default(1000),
      cleanupInterval: ValidationPatterns.interval.default(60000),
      enableStats: ValidationPatterns.booleanDefaultTrue,
      ...additionalFields,
    });
  }

  /**
   * Build monitoring configuration schema
   */
  static monitoringSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      enabled: ValidationPatterns.booleanDefaultTrue,
      monitoringInterval: ValidationPatterns.interval.default(30000),
      metricsRetentionPeriod: ValidationPatterns.retention.default(86400000),
      enableDetailedLogging: ValidationPatterns.booleanDefaultFalse,
      ...additionalFields,
    });
  }

  /**
   * Build batch processing configuration schema
   */
  static batchSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      maxConcurrentOperations: ValidationPatterns.concurrentOperations.default(5),
      defaultBatchSize: ValidationPatterns.batchSize.default(50),
      maxBatchSize: ValidationPatterns.batchSize.default(500),
      minBatchSize: Joi.number().positive().min(1).max(1000).default(10),
      memoryThreshold: ValidationPatterns.memoryThreshold.default(80),
      processingTimeout: ValidationPatterns.timeout.default(300000),
      retryAttempts: ValidationPatterns.positiveInteger.max(10).default(3),
      retryDelay: ValidationPatterns.timeout.min(100).default(1000),
      continueOnError: ValidationPatterns.booleanDefaultTrue,
      ...additionalFields,
    });
  }

  /**
   * Build alert thresholds schema
   */
  static alertThresholdsSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      highLatency: ValidationPatterns.timeout.default(5000),
      lowThroughput: ValidationPatterns.positiveInteger.default(10),
      highMemoryUsage: ValidationPatterns.memoryThreshold.default(80),
      criticalMemoryUsage: Joi.number().min(1).max(100).default(90),
      highErrorRate: ValidationPatterns.rate.default(0.1),
      ...additionalFields,
    });
  }

  /**
   * Build performance thresholds schema
   */
  static performanceThresholdsSchema(additionalFields: Record<string, Joi.Schema> = {}): Joi.ObjectSchema {
    return Joi.object({
      queryExecutionTime: ValidationPatterns.timeout.default(1000),
      memoryUsage: ValidationPatterns.memoryThreshold.default(80),
      responseTime: ValidationPatterns.timeout.min(10).default(500),
      cpuUsage: ValidationPatterns.percentage.default(70),
      ...additionalFields,
    });
  }
}

/**
 * Common validation error messages
 */
export const ValidationMessages = {
  required: 'This field is required',
  positive: 'Value must be positive',
  minZero: 'Value must be zero or positive',
  percentage: 'Value must be between 0 and 100',
  rate: 'Value must be between 0 and 1',
  minTimeout: 'Timeout must be at least 100ms',
  minInterval: 'Interval must be at least 1 second',
  validUrl: 'Must be a valid URL',
  nonEmpty: 'Value cannot be empty',
  logLevel: 'Must be one of: debug, info, warn, error',
  memoryThreshold: 'Memory threshold must be between 10% and 95%',
  connections: 'Connections must be between 1 and 1000',
  batchSize: 'Batch size must be between 1 and 10000',
} as const;

/**
 * Enhanced validation with custom error messages
 */
export class EnhancedValidator {
  /**
   * Validate configuration with custom error messages
   */
  static validateWithMessages<T>(schema: Joi.ObjectSchema<T>, config: any): {
    isValid: boolean;
    value?: T;
    errors: string[];
    warnings: string[];
  } {
    const result: { isValid: boolean; value?: T; errors: string[]; warnings: string[] } = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const { error, value, warning } = schema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      result.isValid = false;
      result.errors = error.details.map(detail => detail.message);
    }

    if (warning) {
      result.warnings = warning.details.map(detail => detail.message);
    }

    if (result.isValid) {
      result.value = value;
    }

    return result;
  }

  /**
   * Validate and throw error if invalid
   */
  static validateOrThrow<T>(schema: Joi.ObjectSchema<T>, config: any, context: string = 'configuration'): T {
    const result = this.validateWithMessages(schema, config);

    if (!result.isValid) {
      const errorMessage = `${context} validation failed: ${result.errors.join(', ')}`;
      throw new Error(errorMessage);
    }

    return result.value!;
  }

  /**
   * Cross-field validation for related configurations
   */
  static validateCrossFields(config: any): string[] {
    const errors: string[] = [];


    if (config.minBatchSize !== undefined && config.maxBatchSize !== undefined) {
      if (config.minBatchSize > config.maxBatchSize) {
        errors.push('minBatchSize cannot be greater than maxBatchSize');
      }
    }

    if (config.defaultBatchSize !== undefined && config.maxBatchSize !== undefined) {
      if (config.defaultBatchSize > config.maxBatchSize) {
        errors.push('defaultBatchSize cannot be greater than maxBatchSize');
      }
    }

    // Validate timeout relationships
    if (config.connectionTimeout !== undefined && config.operationTimeout !== undefined) {
      if (config.connectionTimeout >= config.operationTimeout) {
        errors.push('connectionTimeout should be less than operationTimeout');
      }
    }

    return errors;
  }
}

/**
 * Configuration validation helpers
 */
export class ConfigValidationHelper {
  /**
   * Validate that required environment variables are present
   */
  static validateRequiredEnv(requiredVars: string[]): string[] {
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName] || process.env[varName]!.trim() === '') {
        missing.push(varName);
      }
    }

    return missing;
  }

  /**
   * Validate configuration completeness
   */
  static validateCompleteness(config: any, requiredFields: string[]): string[] {
    const missing: string[] = [];

    for (const field of requiredFields) {
      if (config[field] === undefined || config[field] === null || config[field] === '') {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Sanitize configuration by removing sensitive fields
   */
  static sanitizeForLogging(config: any, sensitiveFields: string[] = ['apiKey', 'password', 'secret', 'token']): any {
    const sanitized = { ...config };

    const sanitizeValue = (obj: any, path: string[]): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      const result = Array.isArray(obj) ? [...obj] : { ...obj };

      for (const [key, value] of Object.entries(result)) {
        const currentPath = [...path, key];

        if (sensitiveFields.some(field => currentPath.join('.').toLowerCase().includes(field.toLowerCase()))) {
          (result as any)[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          (result as any)[key] = sanitizeValue(value, currentPath);
        }
      }

      return result;
    };

    return sanitizeValue(sanitized, []);
  }
}