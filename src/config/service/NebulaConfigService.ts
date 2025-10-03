import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  space?: string;
  bufferSize?: number;
  pingInterval?: number;
  vidTypeLength?: number;
}

@injectable()
export class NebulaConfigService extends BaseConfigService<NebulaConfig> {
  loadConfig(): NebulaConfig {
    const rawConfig = {
      host: process.env.NEBULA_HOST || 'localhost',
      port: parseInt(process.env.NEBULA_PORT || '9669'),
      username: process.env.NEBULA_USERNAME || 'root',
      password: process.env.NEBULA_PASSWORD || 'nebula',
      timeout: parseInt(process.env.NEBULA_TIMEOUT || '30000'),
      maxConnections: parseInt(process.env.NEBULA_MAX_CONNECTIONS || '10'),
      retryAttempts: parseInt(process.env.NEBULA_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.NEBULA_RETRY_DELAY || '1000'),
      space: process.env.NEBULA_SPACE || 'codebase',
      bufferSize: parseInt(process.env.NEBULA_BUFFER_SIZE || '10'),
      pingInterval: parseInt(process.env.NEBULA_PING_INTERVAL || '3000'),
      vidTypeLength: parseInt(process.env.NEBULA_VID_TYPE_LENGTH || '128'),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): NebulaConfig {
    const schema = Joi.object({
      host: Joi.string().hostname().default('localhost'),
      port: Joi.number().port().default(9669),
      username: Joi.string().default('root'),
      password: Joi.string().default('nebula'),
      timeout: Joi.number().default(30000),
      maxConnections: Joi.number().default(10),
      retryAttempts: Joi.number().default(3),
      retryDelay: Joi.number().default(1000),
      space: Joi.string().optional(),
      bufferSize: Joi.number().default(10),
      pingInterval: Joi.number().default(3000),
      vidTypeLength: Joi.number().min(8).max(256).default(128),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Nebula config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): NebulaConfig {
    return {
      host: 'localhost',
      port: 9669,
      username: 'root',
      password: 'nebula',
      timeout: 30000,
      maxConnections: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      space: 'codebase',
      bufferSize: 10,
      pingInterval: 3000,
      vidTypeLength: 128,
    };
  }
}