import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface QdrantConfig {
  host: string;
  port: number;
  collection: string;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
}

@injectable()
export class QdrantConfigService extends BaseConfigService<QdrantConfig> {
  loadConfig(): QdrantConfig {
    const rawConfig = {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333'),
      collection: process.env.QDRANT_COLLECTION || 'code-snippets',
      apiKey: process.env.QDRANT_API_KEY,
      useHttps: process.env.QDRANT_USE_HTTPS === 'true',
      timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): QdrantConfig {
    const schema = Joi.object({
      host: Joi.string().hostname().default('localhost'),
      port: Joi.number().port().default(6333),
      collection: Joi.string().default('code-snippets'),
      apiKey: Joi.string().optional(),
      useHttps: Joi.boolean().default(false),
      timeout: Joi.number().default(30000),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Qdrant config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): QdrantConfig {
    return {
      host: 'localhost',
      port: 6333,
      collection: 'code-snippets',
      useHttps: false,
      timeout: 30000,
    };
  }
}