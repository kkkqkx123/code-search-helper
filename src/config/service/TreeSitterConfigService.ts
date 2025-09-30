import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface TreeSitterConfig {
  enabled: boolean;
  cacheSize: number;
  timeout: number;
  supportedLanguages: string[];
}

@injectable()
export class TreeSitterConfigService extends BaseConfigService<TreeSitterConfig> {
  loadConfig(): TreeSitterConfig {
    const rawConfig = {
      enabled: process.env.TREE_SITTER_ENABLED !== 'false',
      cacheSize: parseInt(process.env.TREE_SITTER_CACHE_SIZE || '1000'),
      timeout: parseInt(process.env.TREE_SITTER_TIMEOUT || '30000'),
      supportedLanguages: process.env.TREE_SITTER_SUPPORTED_LANGUAGES 
        ? process.env.TREE_SITTER_SUPPORTED_LANGUAGES.split(',')
        : ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c'],
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): TreeSitterConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      cacheSize: Joi.number().positive().default(1000),
      timeout: Joi.number().positive().default(30000),
      supportedLanguages: Joi.array()
        .items(Joi.string())
        .default([
          'typescript',
          'javascript',
          'python',
          'java',
          'go',
          'rust',
          'cpp',
          'c'
        ])
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`TreeSitter config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): TreeSitterConfig {
    return {
      enabled: true,
      cacheSize: 1000,
      timeout: 30000,
      supportedLanguages: [
        'typescript',
        'javascript',
        'python',
        'java',
        'go',
        'rust',
        'cpp',
        'c'
      ],
    };
  }
}