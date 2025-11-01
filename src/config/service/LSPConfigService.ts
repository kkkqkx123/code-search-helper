import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { LSPConfig } from '../ConfigTypes';

@injectable()
export class LSPConfigService extends BaseConfigService<LSPConfig> {
  loadConfig(): LSPConfig {
    const rawConfig = {
      enabled: process.env.LSP_ENABLED === 'true',
      timeout: parseInt(process.env.LSP_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.LSP_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.LSP_RETRY_DELAY || '1000'),
      cacheEnabled: process.env.LSP_CACHE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.LSP_CACHE_TTL || '3600'),
      batchSize: parseInt(process.env.LSP_BATCH_SIZE || '10'),
      maxConcurrency: parseInt(process.env.LSP_MAX_CONCURRENCY || '5'),
      supportedLanguages: process.env.LSP_SUPPORTED_LANGUAGES
        ? process.env.LSP_SUPPORTED_LANGUAGES.split(',')
        : ['typescript', 'javascript', 'python', 'java', 'go'],
      languageServers: this.parseLanguageServers(process.env.LSP_LANGUAGE_SERVERS || '{}'),
    };

    return this.validateConfig(rawConfig);
  }

  private parseLanguageServers(serversStr: string): LSPConfig['languageServers'] {
    try {
      return JSON.parse(serversStr);
    } catch (e) {
      return {};
    }
  }

  validateConfig(config: any): LSPConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(false),
      timeout: Joi.number().positive().default(30000),
      retryAttempts: Joi.number().integer().min(0).default(3),
      retryDelay: Joi.number().positive().default(1000),
      cacheEnabled: Joi.boolean().default(true),
      cacheTTL: Joi.number().positive().default(3600),
      batchSize: Joi.number().positive().default(10),
      maxConcurrency: Joi.number().positive().default(5),
      supportedLanguages: Joi.array()
        .items(Joi.string())
        .default(['typescript', 'javascript', 'python', 'java', 'go']),
      languageServers: Joi.object().pattern(
        Joi.string(),
        Joi.object({
          command: Joi.string().required(),
          args: Joi.array().items(Joi.string()).default([]),
          enabled: Joi.boolean().default(true),
          workspaceRequired: Joi.boolean().default(true),
          initializationOptions: Joi.object().optional(),
          settings: Joi.object().optional(),
        })
      ).default({}),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`LSP config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): LSPConfig {
    return {
      enabled: false,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 3600,
      batchSize: 10,
      maxConcurrency: 5,
      supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go'],
      languageServers: {},
    };
  }
}