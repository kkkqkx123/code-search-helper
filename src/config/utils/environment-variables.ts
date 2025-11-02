/**
 * Environment variable utilities
 * Centralizes common parsing patterns and eliminates DRY violations
 * Follows DRY principle by providing reusable environment variable parsing functions
 */

/**
 * Parse boolean environment variable
 * Common pattern: process.env.FEATURE_ENABLED !== 'false'
 */
export function parseBooleanEnv(envValue: string | undefined, defaultValue: boolean = false): boolean {
  if (envValue === undefined) {
    return defaultValue;
  }

  // Common patterns for boolean environment variables
  const falseValues = ['false', '0', 'no', 'off', 'disabled', ''];
  const trueValues = ['true', '1', 'yes', 'on', 'enabled'];

  const normalizedValue = envValue.toLowerCase().trim();

  if (falseValues.includes(normalizedValue)) {
    return false;
  }

  if (trueValues.includes(normalizedValue)) {
    return true;
  }

  // Default to defaultValue if value is not recognized
  return defaultValue;
}

/**
 * Parse integer environment variable with validation
 */
export function parseIntEnv(
  envValue: string | undefined,
  defaultValue: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  if (envValue === undefined) {
    return defaultValue;
  }

  const parsed = parseInt(envValue, 10);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  // Apply validation constraints
  if (options.min !== undefined && parsed < options.min) {
    return options.min;
  }

  if (options.max !== undefined && parsed > options.max) {
    return options.max;
  }

  return parsed;
}

/**
 * Parse float environment variable with validation
 */
export function parseFloatEnv(
  envValue: string | undefined,
  defaultValue: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  if (envValue === undefined) {
    return defaultValue;
  }

  const parsed = parseFloat(envValue);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  // Apply validation constraints
  if (options.min !== undefined && parsed < options.min) {
    return options.min;
  }

  if (options.max !== undefined && parsed > options.max) {
    return options.max;
  }

  return parsed;
}

/**
 * Parse string environment variable with validation
 */
export function parseStringEnv(
  envValue: string | undefined,
  defaultValue: string,
  options: {
    allowedValues?: string[];
    minLength?: number;
    maxLength?: number;
  } = {}
): string {
  if (envValue === undefined) {
    return defaultValue;
  }

  const trimmed = envValue.trim();

  // Validate against allowed values if provided
  if (options.allowedValues && !options.allowedValues.includes(trimmed)) {
    return defaultValue;
  }

  // Validate length constraints
  if (options.minLength && trimmed.length < options.minLength) {
    return defaultValue;
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    return defaultValue;
  }

  return trimmed;
}

/**
 * Parse URL environment variable with validation
 */
export function parseUrlEnv(envValue: string | undefined, defaultValue: string): string {
  if (envValue === undefined) {
    return defaultValue;
  }

  const trimmed = envValue.trim();

  // Basic URL validation
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return defaultValue;
  }
}

/**
 * Parse array environment variable (comma-separated)
 */
export function parseArrayEnv(
  envValue: string | undefined,
  defaultValue: string[],
  options: {
    separator?: string;
    filterEmpty?: boolean;
    trim?: boolean;
  } = {}
): string[] {
  if (envValue === undefined) {
    return defaultValue;
  }

  const {
    separator = ',',
    filterEmpty = true,
    trim = true
  } = options;

  let result = envValue.split(separator);

  if (trim) {
    result = result.map(item => item.trim());
  }

  if (filterEmpty) {
    result = result.filter(item => item.length > 0);
  }

  return result.length > 0 ? result : defaultValue;
}

/**
 * Parse timeout environment variable (always in milliseconds)
 */
export function parseTimeoutEnv(
  envValue: string | undefined,
  defaultValue: number,
  options: {
    minMs?: number;
    maxMs?: number;
  } = {}
): number {
  return parseIntEnv(envValue, defaultValue, {
    min: options.minMs || 100,
    max: options.maxMs || 3600000, // 1 hour max
  });
}

/**
 * Parse percentage environment variable (0-100)
 */
export function parsePercentageEnv(
  envValue: string | undefined,
  defaultValue: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  return parseIntEnv(envValue, defaultValue, {
    min: options.min || 0,
    max: options.max || 100,
  });
}

/**
 * Parse rate environment variable (0-1 for rates, weights, etc.)
 */
export function parseRateEnv(
  envValue: string | undefined,
  defaultValue: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  return parseFloatEnv(envValue, defaultValue, {
    min: options.min || 0,
    max: options.max || 1,
  });
}

/**
 * Parse file path environment variable
 */
export function parseFilePathEnv(envValue: string | undefined, defaultValue: string): string {
  if (envValue === undefined) {
    return defaultValue;
  }

  const trimmed = envValue.trim();

  // Basic path validation - avoid empty paths and obvious invalid ones
  if (!trimmed || trimmed.includes('..')) {
    return defaultValue;
  }

  return trimmed;
}

/**
 * Get environment variable with type-specific parsing
 * Generic function that can be used for different types
 */
export function getEnvVar<T>(
  key: string,
  defaultValue: T,
  parser: (value: string | undefined, defaultValue: T) => T
): T {
  return parser(process.env[key], defaultValue);
}

/**
 * Batch environment variable parser for common patterns
 * Reduces repetitive environment variable parsing code
 */
export class EnvironmentParser {
  /**
   * Parse common service configuration
   */
  static parseServiceConfig(prefix: string) {
    return {
      enabled: parseBooleanEnv(process.env[`${prefix}_ENABLED`], true),
      timeout: parseTimeoutEnv(process.env[`${prefix}_TIMEOUT`], 30000),
      retryAttempts: parseIntEnv(process.env[`${prefix}_RETRY_ATTEMPTS`], 3),
      retryDelay: parseTimeoutEnv(process.env[`${prefix}_RETRY_DELAY`], 1000),
      logLevel: parseStringEnv(
        process.env[`${prefix}_LOG_LEVEL`],
        'info',
        { allowedValues: ['debug', 'info', 'warn', 'error'] }
      ),
    };
  }


  /**
   * Parse common cache configuration
   */
  static parseCacheConfig(prefix: string) {
    return {
      defaultTTL: parseTimeoutEnv(process.env[`${prefix}_DEFAULT_TTL`], 300000),
      maxEntries: parseIntEnv(process.env[`${prefix}_MAX_ENTRIES`], 1000, { min: 1 }),
      cleanupInterval: parseTimeoutEnv(process.env[`${prefix}_CLEANUP_INTERVAL`], 60000),
      enableStats: parseBooleanEnv(process.env[`${prefix}_ENABLE_STATS`], true),
    };
  }

  /**
   * Parse common monitoring configuration
   */
  static parseMonitoringConfig(prefix: string) {
    return {
      enabled: parseBooleanEnv(process.env[`${prefix}_ENABLED`], true),
      interval: parseTimeoutEnv(process.env[`${prefix}_INTERVAL`], 60000),
      retentionPeriod: parseTimeoutEnv(process.env[`${prefix}_RETENTION_PERIOD`], 86400000),
      enableDetailedLogging: parseBooleanEnv(process.env[`${prefix}_ENABLE_DETAILED_LOGGING`], false),
    };
  }

  /**
   * Parse common batch processing configuration
   */
  static parseBatchConfig(prefix: string) {
    return {
      maxConcurrentOperations: parseIntEnv(process.env[`${prefix}_MAX_CONCURRENT_OPERATIONS`], 5, { min: 1, max: 100 }),
      defaultBatchSize: parseIntEnv(process.env[`${prefix}_DEFAULT_BATCH_SIZE`], 50, { min: 1, max: 10000 }),
      maxBatchSize: parseIntEnv(process.env[`${prefix}_MAX_BATCH_SIZE`], 500, { min: 1, max: 10000 }),
      minBatchSize: parseIntEnv(process.env[`${prefix}_MIN_BATCH_SIZE`], 10, { min: 1, max: 1000 }),
      memoryThreshold: parsePercentageEnv(process.env[`${prefix}_MEMORY_THRESHOLD`], 80, { min: 10, max: 95 }),
      processingTimeout: parseTimeoutEnv(process.env[`${prefix}_PROCESSING_TIMEOUT`], 300000),
    };
  }
}

/**
 * Environment variable naming conventions
 * Standardizes naming patterns across the application
 */
export const ENV_NAMING_CONVENTIONS = {
  // Boolean patterns
  ENABLED: '_ENABLED',
  DISABLED: '_DISABLED',
  ALLOWED: '_ALLOWED',
  REQUIRED: '_REQUIRED',

  // Numeric patterns
  MAX: '_MAX_',
  MIN: '_MIN_',
  COUNT: '_COUNT',
  SIZE: '_SIZE',
  TIMEOUT: '_TIMEOUT',
  THRESHOLD: '_THRESHOLD',

  // String patterns
  URL: '_URL',
  HOST: '_HOST',
  PORT: '_PORT',
  PATH: '_PATH',
  KEY: '_KEY',
  SECRET: '_SECRET',
  TOKEN: '_TOKEN',

  // Array patterns
  LIST: '_LIST',
  ARRAY: '_ARRAY',

  // Config patterns
  CONFIG: '_CONFIG',
  SETTINGS: '_SETTINGS',
  OPTIONS: '_OPTIONS',
} as const;