import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';

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
      nodeEnv: EnvironmentUtils.parseString('NODE_ENV', 'development'),
      port: EnvironmentUtils.parsePort('PORT', 3000),
      logLevel: EnvironmentUtils.parseString('LOG_LEVEL', 'info'),
      debug: EnvironmentUtils.parseBoolean('DEBUG', false),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): EnvironmentConfig {
    const schema = Joi.object({
      nodeEnv: ValidationUtils.enumSchema(['development', 'production', 'test'], 'development'),
      port: ValidationUtils.portSchema(3000),
      logLevel: ValidationUtils.enumSchema(['error', 'warn', 'info', 'debug'], 'info'),
      debug: ValidationUtils.booleanSchema(false),
    });

    return ValidationUtils.validateConfig(config, schema);
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