import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface LoggingConfig {
  level: string;
  format: string;
}

@injectable()
export class LoggingConfigService extends BaseConfigService<LoggingConfig> {
  loadConfig(): LoggingConfig {
    const rawConfig = {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): LoggingConfig {
    const schema = Joi.object({
      level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
      format: Joi.string().valid('json', 'text').default('json'),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Logging config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): LoggingConfig {
    return {
      level: 'info',
      format: 'json',
    };
  }
}