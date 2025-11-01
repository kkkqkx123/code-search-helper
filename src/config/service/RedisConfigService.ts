import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { RedisConfig } from '../ConfigTypes';

@injectable()
export class RedisConfigService extends BaseConfigService<RedisConfig> {
  loadConfig(): RedisConfig {
    const rawConfig = {
      enabled: process.env.REDIS_ENABLED === 'true',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxmemory: process.env.REDIS_MAXMEMORY,
      useMultiLevel: process.env.REDIS_USE_MULTI_LEVEL === 'true',
      ttl: {
        embedding: parseInt(process.env.REDIS_TTL_EMBEDDING || '3600'),
        search: parseInt(process.env.REDIS_TTL_SEARCH || '1800'),
        graph: parseInt(process.env.REDIS_TTL_GRAPH || '7200'),
        progress: parseInt(process.env.REDIS_TTL_PROGRESS || '300'),
      },
      retry: {
        attempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3'),
        delay: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
      },
      pool: {
        min: parseInt(process.env.REDIS_POOL_MIN || '2'),
        max: parseInt(process.env.REDIS_POOL_MAX || '10'),
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): RedisConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(false),
      url: Joi.string().uri().default('redis://localhost:6379'),
      maxmemory: Joi.string().optional(),
      useMultiLevel: Joi.boolean().default(false),
      ttl: Joi.object({
        embedding: Joi.number().positive().default(3600),
        search: Joi.number().positive().default(1800),
        graph: Joi.number().positive().default(7200),
        progress: Joi.number().positive().default(300),
      }).default({
        embedding: 3600,
        search: 1800,
        graph: 7200,
        progress: 300,
      }),
      retry: Joi.object({
        attempts: Joi.number().integer().min(0).default(3),
        delay: Joi.number().positive().default(1000),
      }).default({
        attempts: 3,
        delay: 1000,
      }),
      pool: Joi.object({
        min: Joi.number().integer().min(0).default(2),
        max: Joi.number().integer().min(Joi.ref('min')).default(10),
      }).default({
        min: 2,
        max: 10,
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
      useMultiLevel: false,
      ttl: {
        embedding: 3600,
        search: 1800,
        graph: 7200,
        progress: 300,
      },
      retry: {
        attempts: 3,
        delay: 1000,
      },
      pool: {
        min: 2,
        max: 10,
      },
    };
  }
}