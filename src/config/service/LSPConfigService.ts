import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface LSPConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  batchSize: number;
  maxConcurrency: number;
  supportedLanguages: string[];
  languageServers: {
    [key: string]: {
      command: string;
      args: string[];
      enabled: boolean;
      workspaceRequired: boolean;
      initializationOptions?: any;
      settings?: any;
    };
  };
}

@injectable()
export class LSPConfigService extends BaseConfigService<LSPConfig> {
  loadConfig(): LSPConfig {
    const rawConfig = {
      enabled: process.env.LSP_ENABLED !== 'false',
      timeout: parseInt(process.env.LSP_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.LSP_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.LSP_RETRY_DELAY || '100'),
      cacheEnabled: process.env.LSP_CACHE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.LSP_CACHE_TTL || '300'),
      batchSize: parseInt(process.env.LSP_BATCH_SIZE || '20'),
      maxConcurrency: parseInt(process.env.LSP_MAX_CONCURRENCY || '5'),
      supportedLanguages: process.env.LSP_SUPPORTED_LANGUAGES 
        ? process.env.LSP_SUPPORTED_LANGUAGES.split(',')
        : ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp', 'php', 'ruby'],
      languageServers: this.parseLanguageServers(),
    };

    return this.validateConfig(rawConfig);
  }

  private parseLanguageServers(): { [key: string]: any } {
    // 这里可以添加更复杂的语言服务器配置解析逻辑
    // 目前返回空对象，可以根据需要扩展
    return {};
  }

  validateConfig(config: any): LSPConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      timeout: Joi.number().positive().default(30000),
      retryAttempts: Joi.number().positive().default(3),
      retryDelay: Joi.number().positive().default(100),
      cacheEnabled: Joi.boolean().default(true),
      cacheTTL: Joi.number().positive().default(300),
      batchSize: Joi.number().positive().default(20),
      maxConcurrency: Joi.number().positive().default(5),
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
          'c',
          'csharp',
          'php',
          'ruby',
        ]),
      languageServers: Joi.object()
        .pattern(
          Joi.string(),
          Joi.object({
            command: Joi.string().required(),
            args: Joi.array().items(Joi.string()).default([]),
            enabled: Joi.boolean().default(true),
            workspaceRequired: Joi.boolean().default(true),
            initializationOptions: Joi.object().optional(),
            settings: Joi.object().optional(),
          })
        )
        .default({}),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`LSP config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): LSPConfig {
    return {
      enabled: true,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 100,
      cacheEnabled: true,
      cacheTTL: 300,
      batchSize: 20,
      maxConcurrency: 5,
      supportedLanguages: [
        'typescript',
        'javascript',
        'python',
        'java',
        'go',
        'rust',
        'cpp',
        'c',
        'csharp',
        'php',
        'ruby',
      ],
      languageServers: {},
    };
  }
}