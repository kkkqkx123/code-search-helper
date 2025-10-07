import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';

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
      enabled: EnvironmentUtils.parseBoolean('REDIS_ENABLED', false),
      url: EnvironmentUtils.parseString('REDIS_URL', 'redis://localhost:6379'),
      maxmemory: EnvironmentUtils.parseString('REDIS_MAXMEMORY', '256mb'),
      useMultiLevel: !EnvironmentUtils.parseBoolean('REDIS_USE_MULTI_LEVEL', true),
      ttl: {
        embedding: EnvironmentUtils.parseNumber('REDIS_TTL_EMBEDDING', 86400),
        search: EnvironmentUtils.parseNumber('REDIS_TTL_SEARCH', 3600),
        graph: EnvironmentUtils.parseNumber('REDIS_TTL_GRAPH', 1800),
        progress: EnvironmentUtils.parseNumber('REDIS_TTL_PROGRESS', 300),
      },
      retry: {
        attempts: EnvironmentUtils.parseNumber('REDIS_RETRY_ATTEMPTS', 3),
        delay: EnvironmentUtils.parseNumber('REDIS_RETRY_DELAY', 1000),
      },
      pool: {
        min: EnvironmentUtils.parseNumber('REDIS_POOL_MIN', 1),
        max: EnvironmentUtils.parseNumber('REDIS_POOL_MAX', 10),
      },
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): RedisConfig {
    const schema = Joi.object({
      enabled: ValidationUtils.booleanSchema(false),
      url: ValidationUtils.uriSchema('redis://localhost:6379'),
      maxmemory: Joi.string().default('256mb'),
      useMultiLevel: ValidationUtils.booleanSchema(true),
      ttl: ValidationUtils.objectSchema({
        embedding: ValidationUtils.positiveNumberSchema(86400),
        search: ValidationUtils.positiveNumberSchema(3600),
        graph: ValidationUtils.positiveNumberSchema(1800),
        progress: ValidationUtils.positiveNumberSchema(300),
      }),
      retry: ValidationUtils.objectSchema({
        attempts: ValidationUtils.positiveNumberSchema(3),
        delay: ValidationUtils.positiveNumberSchema(1000),
      }),
      pool: ValidationUtils.objectSchema({
        min: ValidationUtils.positiveNumberSchema(1),
        max: ValidationUtils.positiveNumberSchema(10),
      }),
    });

    return ValidationUtils.validateConfig(config, schema);
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