import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface EmbeddingConfig {
  provider: string;
  openai: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  ollama: {
    baseUrl: string;
    model: string;
    dimensions: number;
  };
  gemini: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  mistral: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  siliconflow: {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
  };
  custom?: {
    custom1?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
    custom2?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
    custom3?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    };
  };
  qualityWeight?: number;
  performanceWeight?: number;
}

@injectable()
export class EmbeddingConfigService extends BaseConfigService<EmbeddingConfig> {
  loadConfig(): EmbeddingConfig {
    const rawConfig = {
      provider: process.env.EMBEDDING_PROVIDER || 'openai',
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'text-embedding-ada-002',
        dimensions: parseInt(process.env.OPENAI_DIMENSIONS || '1536'),
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
        dimensions: parseInt(process.env.OLLAMA_DIMENSIONS || '768'),
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        baseUrl: process.env.GEMINI_BASE_URL,
        model: process.env.GEMINI_MODEL || 'embedding-001',
        dimensions: parseInt(process.env.GEMINI_DIMENSIONS || '768'),
      },
      mistral: {
        apiKey: process.env.MISTRAL_API_KEY,
        baseUrl: process.env.MISTRAL_BASE_URL,
        model: process.env.MISTRAL_MODEL || 'mistral-embed',
        dimensions: parseInt(process.env.MISTRAL_DIMENSIONS || '1024'),
      },
      siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY,
        baseUrl: process.env.SILICONFLOW_BASE_URL,
        model: process.env.SILICONFLOW_MODEL || 'BAAI/bge-large-en-v1.5',
        dimensions: parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024'),
      },
      custom: {
        custom1: {
          apiKey: process.env.CUSTOM_CUSTOM1_API_KEY,
          baseUrl: process.env.CUSTOM_CUSTOM1_BASE_URL,
          model: process.env.CUSTOM_CUSTOM1_MODEL,
          dimensions: process.env.CUSTOM_CUSTOM1_DIMENSIONS
            ? parseInt(process.env.CUSTOM_CUSTOM1_DIMENSIONS)
            : undefined,
        },
        custom2: {
          apiKey: process.env.CUSTOM_CUSTOM2_API_KEY,
          baseUrl: process.env.CUSTOM_CUSTOM2_BASE_URL,
          model: process.env.CUSTOM_CUSTOM2_MODEL,
          dimensions: process.env.CUSTOM_CUSTOM2_DIMENSIONS
            ? parseInt(process.env.CUSTOM_CUSTOM2_DIMENSIONS)
            : undefined,
        },
        custom3: {
          apiKey: process.env.CUSTOM_CUSTOM3_API_KEY,
          baseUrl: process.env.CUSTOM_CUSTOM3_BASE_URL,
          model: process.env.CUSTOM_CUSTOM3_MODEL,
          dimensions: process.env.CUSTOM_CUSTOM3_DIMENSIONS
            ? parseInt(process.env.CUSTOM_CUSTOM3_DIMENSIONS)
            : undefined,
        },
      },
      qualityWeight: process.env.QUALITY_WEIGHT
        ? parseFloat(process.env.QUALITY_WEIGHT)
        : undefined,
      performanceWeight: process.env.PERFORMANCE_WEIGHT
        ? parseFloat(process.env.PERFORMANCE_WEIGHT)
        : undefined,
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): EmbeddingConfig {
    const schema = Joi.object({
      provider: Joi.string()
        .valid(
          'openai',
          'ollama',
          'gemini',
          'mistral',
          'siliconflow',
          'custom1',
          'custom2',
          'custom3'
        )
        .default('openai'),
      openai: Joi.object({
        apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'openai', then: Joi.required() }),
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
        apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'gemini', then: Joi.required() }),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('embedding-001'),
        dimensions: Joi.number().positive().default(768),
      }),
      mistral: Joi.object({
        apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'mistral', then: Joi.required() }),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().default('mistral-embed'),
        dimensions: Joi.number().positive().default(1024),
      }),
      siliconflow: Joi.object({
        apiKey: Joi.string().when(Joi.ref('...provider'), { is: 'siliconflow', then: Joi.required() }),
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
      throw new Error(`Embedding config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): EmbeddingConfig {
    return {
      provider: 'openai',
      openai: {
        model: 'text-embedding-ada-002',
        dimensions: 1536,
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
        dimensions: 768,
      },
      gemini: {
        model: 'embedding-001',
        dimensions: 768,
      },
      mistral: {
        model: 'mistral-embed',
        dimensions: 1024,
      },
      siliconflow: {
        model: 'BAAI/bge-large-en-v1.5',
        dimensions: 1024,
      },
      qualityWeight: 0.7,
      performanceWeight: 0.3,
    };
  }

  /**
   * 验证嵌入提供者配置
   * 返回缺失的环境变量列表
   */
  validateProviderConfig(provider: string, config: any): string[] {
    const providerValidators: Record<string, (config: any) => string[]> = {
      openai: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('OpenAI model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('OpenAI API key is required');
        }
        return errors;
      },
      ollama: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Ollama model is required');
        }
        if (!config.baseUrl || config.baseUrl.trim() === '') {
          errors.push('Ollama base URL is required');
        }
        return errors;
      },
      gemini: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Gemini model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('Gemini API key is required');
        }
        return errors;
      },
      mistral: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Mistral model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('Mistral API key is required');
        }
        return errors;
      },
      siliconflow: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('SiliconFlow model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('SiliconFlow API key is required');
        }
        return errors;
      },
      custom1: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Custom1 model is required');
        }
        return errors;
      },
      custom2: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Custom2 model is required');
        }
        return errors;
      },
      custom3: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Custom3 model is required');
        }
        return errors;
      }
    };

    const validator = providerValidators[provider];
    if (!validator) {
      return [`Unknown embedding provider: ${provider}. Available providers: openai, ollama, gemini, mistral, siliconflow, custom1, custom2, custom3`];
    }

    return validator(config);
  }
}