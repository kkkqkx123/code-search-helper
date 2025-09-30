import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  debug: boolean;
}

@injectable()
export class EnvironmentConfigService extends BaseConfigService<EnvironmentConfig> {
  loadConfig(): EnvironmentConfig {
    const rawConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
      logLevel: process.env.LOG_LEVEL || 'info',
      debug: process.env.DEBUG === 'true' || false,
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): EnvironmentConfig {
    const schema = Joi.object({
      nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
      port: Joi.number().port().default(3000),
      logLevel: Joi.string().trim().valid('error', 'warn', 'info', 'debug').default('info'),
      debug: Joi.boolean().default(false),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Environment config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): EnvironmentConfig {
    return {
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      debug: false,
    };
  }
}