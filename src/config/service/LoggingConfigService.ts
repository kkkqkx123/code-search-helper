import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';

export interface LoggingConfig {
  level: string;
  format: string;
}

@injectable()
export class LoggingConfigService extends BaseConfigService<LoggingConfig> {
  loadConfig(): LoggingConfig {
    const rawConfig = {
      level: EnvironmentUtils.parseString('LOG_LEVEL', 'info'),
      format: EnvironmentUtils.parseString('LOG_FORMAT', 'json'),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): LoggingConfig {
    const schema = Joi.object({
      level: ValidationUtils.enumSchema(['error', 'warn', 'info', 'debug'], 'info'),
      format: ValidationUtils.enumSchema(['json', 'text'], 'json'),
    });

    return ValidationUtils.validateConfig(config, schema);
  }

  getDefaultConfig(): LoggingConfig {
    return {
      level: 'info',
      format: 'json',
    };
  }
}