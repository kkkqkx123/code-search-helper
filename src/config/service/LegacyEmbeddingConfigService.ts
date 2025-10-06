import { injectable } from 'inversify';
import { EmbeddingConfigService, EmbeddingProviderFactory, OpenAIConfig, OllamaConfig, GeminiConfig, MistralConfig, SiliconFlowConfig, CustomProviderConfig } from './EmbeddingConfigService';
import * as Joi from 'joi';
import { LegacyEmbeddingConfig } from '../ConfigTypes';

/**
 * Legacy embedding configuration service
 * Provides backward compatibility while encouraging migration to the factory pattern
 */
@injectable()
export class LegacyEmbeddingConfigService extends EmbeddingConfigService {
  loadConfig(): LegacyEmbeddingConfig {
    // Get simplified configuration from base service
    const simpleConfig = super.loadConfig();

    // Convert to legacy format for backward compatibility
    const legacyConfig: LegacyEmbeddingConfig = {
      provider: simpleConfig.provider,

      // Generate all provider configurations manually since getProviderConfig() doesn't take parameters
      openai: EmbeddingProviderFactory.createProviderConfig('openai') as any,
      ollama: EmbeddingProviderFactory.createProviderConfig('ollama') as any,
      gemini: EmbeddingProviderFactory.createProviderConfig('gemini') as any,
      mistral: EmbeddingProviderFactory.createProviderConfig('mistral') as any,
      siliconflow: EmbeddingProviderFactory.createProviderConfig('siliconflow') as any,

      // Custom providers
      custom: {
        custom1: this.getCustomProviderConfig('custom1'),
        custom2: this.getCustomProviderConfig('custom2'),
        custom3: this.getCustomProviderConfig('custom3'),
      },

      // Weights
      qualityWeight: simpleConfig.weights?.quality,
      performanceWeight: simpleConfig.weights?.performance,
    };

    // Log deprecation warning in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DEPRECATED] LegacyEmbeddingConfigService is deprecated. Please migrate to EmbeddingConfigService with provider factory pattern.');
    }

    return this.validateConfig(legacyConfig);
  }

  validateConfig(config: any): LegacyEmbeddingConfig {
    const schema = Joi.object({
      provider: Joi.string()
        .valid('openai', 'ollama', 'gemini', 'mistral', 'siliconflow', 'custom1', 'custom2', 'custom3')
        .default('openai'),

      // All provider configurations (legacy format)
      openai: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('text-embedding-ada-002'),
        dimensions: Joi.number().positive().default(1536),
      }),

      ollama: Joi.object({
        baseUrl: Joi.string().uri().default('http://localhost:11434'),
        model: Joi.string().default('nomic-embed-text'),
        dimensions: Joi.number().positive().default(768),
      }),

      gemini: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('embedding-001'),
        dimensions: Joi.number().positive().default(768),
      }),

      mistral: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('mistral-embed'),
        dimensions: Joi.number().positive().default(1024),
      }),

      siliconflow: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('BAAI/bge-large-en-v1.5'),
        dimensions: Joi.number().positive().default(1024),
      }),

      custom: Joi.object({
        custom1: Joi.object({
          apiKey: Joi.string().allow('').optional(),
          baseUrl: Joi.string().uri().allow('').optional(),
          model: Joi.string().allow('').optional(),
          dimensions: Joi.number().positive().default(768),
        }),
        custom2: Joi.object({
          apiKey: Joi.string().allow('').optional(),
          baseUrl: Joi.string().uri().allow('').optional(),
          model: Joi.string().allow('').optional(),
          dimensions: Joi.number().positive().default(768),
        }),
        custom3: Joi.object({
          apiKey: Joi.string().allow('').optional(),
          baseUrl: Joi.string().uri().allow('').optional(),
          model: Joi.string().allow('').optional(),
          dimensions: Joi.number().positive().default(768),
        }),
      }).optional(),

      qualityWeight: Joi.number().min(0).max(1).default(0.7),
      performanceWeight: Joi.number().min(0).max(1).default(0.3),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Legacy embedding config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): LegacyEmbeddingConfig {
    const simpleConfig = super.getDefaultConfig();

    return {
      provider: simpleConfig.provider,
      openai: EmbeddingProviderFactory.createProviderConfig('openai') as any,
      ollama: EmbeddingProviderFactory.createProviderConfig('ollama') as any,
      gemini: EmbeddingProviderFactory.createProviderConfig('gemini') as any,
      mistral: EmbeddingProviderFactory.createProviderConfig('mistral') as any,
      siliconflow: EmbeddingProviderFactory.createProviderConfig('siliconflow') as any,
      custom: {
        custom1: this.getCustomProviderConfig('custom1'),
        custom2: this.getCustomProviderConfig('custom2'),
        custom3: this.getCustomProviderConfig('custom3'),
      },
      qualityWeight: simpleConfig.weights?.quality,
      performanceWeight: simpleConfig.weights?.performance,
    };
  }

  /**
   * Get custom provider configuration
   */
  private getCustomProviderConfig(customProvider: string): CustomProviderConfig {
    return {
      apiKey: process.env[`CUSTOM_${customProvider.toUpperCase()}_API_KEY`],
      baseUrl: process.env[`CUSTOM_${customProvider.toUpperCase()}_BASE_URL`],
      model: process.env[`CUSTOM_${customProvider.toUpperCase()}_MODEL`] || 'custom-embed',
      dimensions: parseInt(process.env[`CUSTOM_${customProvider.toUpperCase()}_DIMENSIONS`] || '768'),
    };
  }

  /**
   * Get simplified configuration for migration
   * Returns configuration compatible with the simplified EmbeddingConfigService
   */
  getSimplifiedConfig() {
    const legacyConfig = this.getConfig() as LegacyEmbeddingConfig;

    const providerConfig = EmbeddingProviderFactory.createProviderConfig(legacyConfig.provider);

    return {
      provider: legacyConfig.provider,
      providerConfig,
      weights: {
        quality: legacyConfig.qualityWeight,
        performance: legacyConfig.performanceWeight,
      },
    };
  }

  /**
   * Get migration warnings
   */
  getMigrationWarnings(): string[] {
    const config = this.getConfig() as LegacyEmbeddingConfig;
    const warnings: string[] = [];

    if (config.custom?.custom1 || config.custom?.custom2 || config.custom?.custom3) {
      warnings.push('Custom providers configuration format is deprecated. Use the provider factory pattern instead.');
    }

    const legacyConfig = config as LegacyEmbeddingConfig;
    const provider = legacyConfig.provider;
    const providerConfig = legacyConfig[provider as keyof LegacyEmbeddingConfig] as any;

    if (providerConfig && !this.isProviderConfigured(provider, providerConfig)) {
      warnings.push(`Provider ${provider} appears to be incompletely configured. Check required fields.`);
    }

    return warnings;
  }

  /**
   * Check if a provider is properly configured
   */
  private isProviderConfigured(provider: string, config: any): boolean {
    switch (provider) {
      case 'openai':
      case 'gemini':
      case 'mistral':
      case 'siliconflow':
        return !!(config?.model && (config?.apiKey || config?.baseUrl));
      case 'ollama':
        return !!(config?.model && config?.baseUrl);
      case 'custom1':
      case 'custom2':
      case 'custom3':
        return !!(config?.model);
      default:
        return false;
    }
  }

  /**
   * Get configured providers (providers with required configuration)
   */
  getConfiguredProviders(): string[] {
    const legacyConfig = this.getConfig() as LegacyEmbeddingConfig;
    const configured: string[] = [];

    const providers = ['openai', 'ollama', 'gemini', 'mistral', 'siliconflow'];

    for (const provider of providers) {
      const providerConfig = legacyConfig[provider as keyof LegacyEmbeddingConfig] as any;
      if (this.isProviderConfigured(provider, providerConfig)) {
        configured.push(provider);
      }
    }

    // Check custom providers
    if (legacyConfig.custom) {
      for (let i = 1; i <= 3; i++) {
        const customProvider = `custom${i}`;
        const customConfig = legacyConfig.custom[customProvider as keyof typeof legacyConfig.custom];
        if (customConfig && this.isProviderConfigured(customProvider, customConfig)) {
          configured.push(customProvider);
        }
      }
    }

    return configured;
  }
}