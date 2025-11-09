import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { EnvironmentUtils, ValidationUtils, SimilarityConfig } from '../ConfigTypes';

@injectable()
export class SimilarityConfigService extends BaseConfigService<SimilarityConfig> {
  loadConfig(): SimilarityConfig {
    const rawConfig = {
      apiKey: EnvironmentUtils.parseString('SIMILARITY_API_KEY', ''),
      baseUrl: EnvironmentUtils.parseString('[REDACTED:api-key]', 'http://localhost:11434'),
      model: EnvironmentUtils.parseString('SIMILARITY_MODEL', 'default'),
      dimensions: EnvironmentUtils.parseNumber('SIMILARITY_DIMENSIONS', 512),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): SimilarityConfig {
    const schema = Joi.object({
      apiKey: Joi.string().optional().allow(''),
      baseUrl: Joi.string().uri().default('http://localhost:11434'),
      model: Joi.string().default('default'),
      dimensions: Joi.number().integer().positive().default(512),
    });

    return ValidationUtils.validateConfig(config, schema);
  }

  getDefaultConfig(): SimilarityConfig {
    return {
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'default',
      dimensions: 512,
    };
  }
}
