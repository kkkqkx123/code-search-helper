/**
 * Updated test fixtures for simplified configuration services
 * This file contains test configurations that match the new simplified interfaces
 */

import { BatchProcessingConfig } from '../../infrastructure/batching/BatchProcessingService';
import { EmbeddingConfig, OpenAIConfig, OllamaConfig } from '../service/EmbeddingConfigService';

/**
 * Simplified batch processing test configuration
 * Matches the new simplified BatchProcessingConfig interface
 */
export const testSimplifiedBatchProcessingConfig: BatchProcessingConfig = {
  enabled: true,
  maxConcurrentOperations: 5,
  defaultBatchSize: 50,
  maxBatchSize: 500,
  memoryThreshold: 80,
  processingTimeout: 300000,
  retryAttempts: 3,
  retryDelay: 1000,
  continueOnError: true,
  maxConcurrency: 5,
  timeout: 30000,

  // Optional monitoring - only essential metrics
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

/**
 * Minimal batch processing test configuration
 * For use cases where monitoring is not needed (YAGNI principle)
 */
export const testMinimalBatchProcessingConfig: BatchProcessingConfig = {
  enabled: true,
  maxConcurrentOperations: 3,
  defaultBatchSize: 25,
  maxBatchSize: 100,
  memoryThreshold: 70,
  processingTimeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000,
  continueOnError: true,
  maxConcurrency: 3,
  timeout: 30000,
  // No monitoring - follows YAGNI principle
  monitoring: {
    enabled: false,
    metricsInterval: 60000,
    alertThresholds: {
      highLatency: 5000,
      highMemoryUsage: 70,
      highErrorRate: 0.1,
    },
  },
};

/**
 * OpenAI embedding test configuration
 * Matches the new provider-specific interface
 */
export const testOpenAIEmbeddingConfig: EmbeddingConfig = {
  provider: 'openai',
  providerConfig: {
    apiKey: 'test-openai-api-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
  } as OpenAIConfig,
  weights: {
    quality: 0.7,
    performance: 0.3,
  },
};

/**
 * Ollama embedding test configuration
 * Matches the new provider-specific interface
 */
export const testOllamaEmbeddingConfig: EmbeddingConfig = {
  provider: 'ollama',
  providerConfig: {
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text',
    dimensions: 768,
  } as OllamaConfig,
  weights: {
    quality: 0.6,
    performance: 0.4,
  },
};

/**
 * Custom embedding test configuration
 * Demonstrates how custom providers work in the new system
 */
export const testCustomEmbeddingConfig: EmbeddingConfig = {
  provider: 'custom',
  providerConfig: {
    apiKey: 'test-custom-api-key',
    baseUrl: 'https://custom-embedding-api.com',
    model: 'custom-embed-v1',
    dimensions: 1024,
  },
  weights: {
    quality: 0.8,
    performance: 0.2,
  },
};

/**
 * Environment variable test fixtures
 * These simulate common environment variable scenarios for testing
 */
export const testEnvironmentVariables = {
  // Batch processing environment variables (12 instead of 18)
  BATCH_PROCESSING_ENABLED: 'true',
  MAX_CONCURRENT_OPERATIONS: '5',
  DEFAULT_BATCH_SIZE: '50',
  MAX_BATCH_SIZE: '500',
  MEMORY_THRESHOLD: '80',
  PROCESSING_TIMEOUT: '300000',
  RETRY_ATTEMPTS: '3',
  RETRY_DELAY: '1000',
  CONTINUE_ON_ERROR: 'true',
  BATCH_MONITORING_ENABLED: 'true',
  METRICS_INTERVAL: '60000',
  HIGH_LATENCY_THRESHOLD: '5000',
  HIGH_MEMORY_USAGE_THRESHOLD: '80',
  HIGH_ERROR_RATE_THRESHOLD: '0.1',

  // Embedding environment variables (simplified)
  EMBEDDING_PROVIDER: 'openai',
  OPENAI_API_KEY: 'test-api-key',
  OPENAI_MODEL: 'text-embedding-ada-002',
  OPENAI_DIMENSIONS: '1536',
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  QUALITY_WEIGHT: '0.7',
  PERFORMANCE_WEIGHT: '0.3',

  // Ollama configuration
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'nomic-embed-text',
  OLLAMA_DIMENSIONS: '768',

  // Custom provider configuration
  CUSTOM_API_KEY: 'test-custom-key',
  CUSTOM_BASE_URL: 'https://custom-api.com',
  CUSTOM_MODEL: 'custom-embed-v1',
  CUSTOM_DIMENSIONS: '1024',
};

/**
 * Mock environment variables for different scenarios
 */
export const mockEnvironmentScenarios = {
  // Minimal configuration scenario
  minimal: {
    BATCH_PROCESSING_ENABLED: 'true',
    MAX_CONCURRENT_OPERATIONS: '3',
    DEFAULT_BATCH_SIZE: '25',
    MAX_BATCH_SIZE: '100',
    MEMORY_THRESHOLD: '70',
    PROCESSING_TIMEOUT: '30000',
    RETRY_ATTEMPTS: '2',
    RETRY_DELAY: '1000',
    CONTINUE_ON_ERROR: 'true',
    // No monitoring variables - YAGNI principle
  },

  // Production configuration scenario
  production: {
    BATCH_PROCESSING_ENABLED: 'true',
    MAX_CONCURRENT_OPERATIONS: '10',
    DEFAULT_BATCH_SIZE: '100',
    MAX_BATCH_SIZE: '1000',
    MEMORY_THRESHOLD: '85',
    PROCESSING_TIMEOUT: '600000',
    RETRY_ATTEMPTS: '5',
    RETRY_DELAY: '2000',
    CONTINUE_ON_ERROR: 'false',
    BATCH_MONITORING_ENABLED: 'true',
    METRICS_INTERVAL: '30000',
    HIGH_LATENCY_THRESHOLD: '3000',
    HIGH_MEMORY_USAGE_THRESHOLD: '85',
    HIGH_ERROR_RATE_THRESHOLD: '0.05',

    EMBEDDING_PROVIDER: 'openai',
    OPENAI_MODEL: 'text-embedding-3-large',
    OPENAI_DIMENSIONS: '3072',
    QUALITY_WEIGHT: '0.8',
    PERFORMANCE_WEIGHT: '0.2',
  },

  // Development configuration scenario
  development: {
    BATCH_PROCESSING_ENABLED: 'true',
    MAX_CONCURRENT_OPERATIONS: '2',
    DEFAULT_BATCH_SIZE: '10',
    MAX_BATCH_SIZE: '50',
    MEMORY_THRESHOLD: '60',
    PROCESSING_TIMEOUT: '15000',
    RETRY_ATTEMPTS: '1',
    RETRY_DELAY: '500',
    CONTINUE_ON_ERROR: 'true',
    BATCH_MONITORING_ENABLED: 'false', // Disabled for development
    HIGH_LATENCY_THRESHOLD: '10000', // More lenient for development
    HIGH_MEMORY_USAGE_THRESHOLD: '90',
    HIGH_ERROR_RATE_THRESHOLD: '0.2',

    EMBEDDING_PROVIDER: 'ollama',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'nomic-embed-text',
    OLLAMA_DIMENSIONS: '768',
    QUALITY_WEIGHT: '0.5',
    PERFORMANCE_WEIGHT: '0.5',
  },
};

/**
 * Test configuration factory
 * Provides methods to create test configurations for different scenarios
 */
export class TestConfigFactory {
  /**
   * Create batch processing config for testing
   */
  static createBatchConfig(overrides: Partial<BatchProcessingConfig> = {}): BatchProcessingConfig {
    return {
      ...testSimplifiedBatchProcessingConfig,
      ...overrides,
    };
  }

  /**
   * Create minimal batch processing config for testing
   */
  static createMinimalBatchConfig(overrides: Partial<BatchProcessingConfig> = {}): BatchProcessingConfig {
    return {
      ...testMinimalBatchProcessingConfig,
      ...overrides,
    };
  }

  /**
   * Create embedding config for testing
   */
  static createEmbeddingConfig(provider: string, overrides: Partial<EmbeddingConfig> = {}): EmbeddingConfig {
    const baseConfig = this.getBaseEmbeddingConfig(provider);
    return {
      ...baseConfig,
      ...overrides,
    };
  }

  /**
   * Get base embedding configuration for a provider
   */
  private static getBaseEmbeddingConfig(provider: string): EmbeddingConfig {
    switch (provider) {
      case 'openai':
        return testOpenAIEmbeddingConfig;
      case 'ollama':
        return testOllamaEmbeddingConfig;
      case 'custom':
        return testCustomEmbeddingConfig;
      default:
        throw new Error(`Unsupported provider for test config: ${provider}`);
    }
  }

  /**
   * Create configuration with environment variables set
   */
  static createWithEnvironment(envVars: Record<string, string>): void {
    // Set environment variables for testing
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  /**
   * Clean up test environment variables
   */
  static cleanupEnvironment(envKeys: string[]): void {
    envKeys.forEach(key => {
      delete process.env[key];
    });
  }
}

/**
 * Test validation helpers
 */
export class TestValidationHelpers {
  /**
   * Create invalid batch configuration for testing validation
   */
  static createInvalidBatchConfig(): Partial<BatchProcessingConfig> {
    return {
      enabled: true,
      maxConcurrentOperations: -1, // Invalid: negative
      defaultBatchSize: 0, // Invalid: zero
      maxBatchSize: 50000, // Invalid: exceeds max
      memoryThreshold: 150, // Invalid: exceeds 100%
      processingTimeout: 100, // Invalid: below minimum
      retryAttempts: 20, // Invalid: exceeds max
      retryDelay: 10, // Invalid: below minimum
    };
  }

  /**
   * Create invalid embedding configuration for testing validation
   */
  static createInvalidEmbeddingConfig(): Partial<EmbeddingConfig> {
    return {
      provider: 'invalid-provider', // Invalid: not supported
      weights: {
        quality: 1.5, // Invalid: exceeds 1.0
        performance: -0.5, // Invalid: negative
      },
    };
  }

  /**
   * Simulate missing required environment variables
   */
  static createMissingEnvScenario(): Record<string, string> {
    return {
      // Deliberately missing required variables
      BATCH_PROCESSING_ENABLED: 'true',
      // Missing OPENAI_API_KEY when provider is 'openai'
      EMBEDDING_PROVIDER: 'openai',
      OPENAI_MODEL: 'text-embedding-ada-002',
      // Missing OPENAI_API_KEY - this should cause validation failure
    };
  }
}