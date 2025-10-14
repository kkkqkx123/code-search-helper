import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';

export interface HotReloadConfig {
  enabled: boolean;
  debounceInterval: number;
  maxFileSize: number;
  maxConcurrentProjects: number;
  enableDetailedLogging: boolean;
  errorHandling: {
    maxRetries: number;
    alertThreshold: number;
    autoRecovery: boolean;
  };
}

@injectable()
export class HotReloadConfigService extends BaseConfigService<HotReloadConfig> {
  loadConfig(): HotReloadConfig {
    const rawConfig = {
      enabled: EnvironmentUtils.parseBoolean('HOT_RELOAD_ENABLED', true),
      debounceInterval: EnvironmentUtils.parseNumber('HOT_RELOAD_DEBOUNCE_INTERVAL', 500),
      maxFileSize: EnvironmentUtils.parseNumber('HOT_RELOAD_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      maxConcurrentProjects: EnvironmentUtils.parseNumber('HOT_RELOAD_MAX_CONCURRENT_PROJECTS', 5),
      enableDetailedLogging: EnvironmentUtils.parseBoolean('HOT_RELOAD_ENABLE_DETAILED_LOGGING', false),
      errorHandling: {
        maxRetries: EnvironmentUtils.parseNumber('HOT_RELOAD_ERROR_MAX_RETRIES', 3),
        alertThreshold: EnvironmentUtils.parseNumber('HOT_RELOAD_ERROR_ALERT_THRESHOLD', 5),
        autoRecovery: EnvironmentUtils.parseBoolean('HOT_RELOAD_ERROR_AUTO_RECOVERY', true),
      }
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): HotReloadConfig {
    const errorHandlingSchema = Joi.object({
      maxRetries: Joi.number().min(0).max(10).default(3),
      alertThreshold: Joi.number().min(1).max(100).default(5),
      autoRecovery: Joi.boolean().default(true),
    });

    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      debounceInterval: Joi.number().min(50).max(5000).default(500),
      maxFileSize: Joi.number().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024), // 100MB max
      maxConcurrentProjects: Joi.number().min(1).max(50).default(5),
      enableDetailedLogging: Joi.boolean().default(false),
      errorHandling: errorHandlingSchema,
    });

    return ValidationUtils.validateConfig(config, schema);
  }

  getDefaultConfig(): HotReloadConfig {
    return {
      enabled: true,
      debounceInterval: 500,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentProjects: 5,
      enableDetailedLogging: false,
      errorHandling: {
        maxRetries: 3,
        alertThreshold: 5,
        autoRecovery: true,
      }
    };
  }
}