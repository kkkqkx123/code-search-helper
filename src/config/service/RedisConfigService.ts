import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface RedisConfig {
  enabled: boolean;
  url: string;
  maxmemory?: string;
  useMultiLevel: boolean;
  ttl: {
    embedding: number;
    search: number;
    graph: number;
    progress: number;
  };
  retry: {
    attempts: number;
    delay: number;
  };
  pool: {
    min: number;
    max: number;
  };
}

@injectable()
export class RedisConfigService extends BaseConfigService<RedisConfig> {
  loadConfig(): RedisConfig {
    const rawConfig = {
      enabled: process.env.REDIS_ENABLED === 'true',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxmemory: process.env.REDIS_MAXMEMORY || '256mb',
      useMultiLevel: process.env.REDIS_USE_MULTI_LEVEL !== 'false',
      ttl: {
        embedding: parseInt(process.env.REDIS_TTL_EMBEDDING || '86400'),
        search: parseInt(process.env.REDIS_TTL_SEARCH || '3600'),
        graph: parseInt(process.env.REDIS_TTL_GRAPH || '1800'),
        progress: parseInt(process.env.REDIS_TTL_PROGRESS || '300'),
      },
      retry: {
        attempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3'),
        delay: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
      },
      pool: {
        min: parseInt(process.env.REDIS_POOL_MIN || '1'),
        max: parseInt(process.env.REDIS_POOL_MAX || '10'),
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): RedisConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(false),
      url: Joi.string().uri().default('redis://localhost:6379'),
      maxmemory: Joi.string().default('256mb'),
      useMultiLevel: Joi.boolean().default(true),
      ttl: Joi.object({
        embedding: Joi.number().default(86400),
        search: Joi.number().default(3600),
        graph: Joi.number().default(1800),
        progress: Joi.number().default(300),
      }),
      retry: Joi.object({
        attempts: Joi.number().default(3),
        delay: Joi.number().default(1000),
      }),
      pool: Joi.object({
        min: Joi.number().default(1),
        max: Joi.number().default(10),
      }),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Redis config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): RedisConfig {
    return {
      enabled: false,
      url: 'redis://localhost:6379',
      maxmemory: '256mb',
      useMultiLevel: true,
      ttl: {
        embedding: 86400,
        search: 3600,
        graph: 1800,
        progress: 300,
      },
      retry: {
        attempts: 3,
        delay: 1000,
      },
      pool: {
        min: 1,
        max: 10,
      },
    };
  }
}