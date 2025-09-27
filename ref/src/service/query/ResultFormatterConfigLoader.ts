import { injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ResultFormatterFullConfig } from './ResultFormatter';

@injectable()
export class ResultFormatterConfigLoader {
  private config: ResultFormatterFullConfig | null = null;

  loadConfig(configPath?: string): ResultFormatterFullConfig {
    // If we've already loaded the config, return it
    if (this.config) {
      return this.config;
    }

    // Try to load from specified path or default location
    const configFilePath = configPath || path.join(__dirname, '../../../config/llm-formatter.yaml');

    try {
      // Check if config file exists
      if (fs.existsSync(configFilePath)) {
        const configFileContent = fs.readFileSync(configFilePath, 'utf8');
        const configData = yaml.load(configFileContent) as ResultFormatterFullConfig;

        // Validate and merge with defaults
        this.config = this.mergeWithDefaults(configData);
        return this.config;
      } else {
        console.warn(`Config file not found at ${configFilePath}, using defaults`);
        this.config = this.getDefaultConfig();
        return this.config;
      }
    } catch (error) {
      console.warn('Could not load config file, using defaults:', error);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  private mergeWithDefaults(configData: any): ResultFormatterFullConfig {
    const defaults = this.getDefaultConfig();

    return {
      profiles: {
        openai: { ...defaults.profiles.openai, ...configData?.profiles?.openai },
        claude: { ...defaults.profiles.claude, ...configData?.profiles?.claude },
        anthropic: { ...defaults.profiles.anthropic, ...configData?.profiles?.anthropic },
        custom: { ...defaults.profiles.custom, ...configData?.profiles?.custom },
      },
      defaults: { ...defaults.defaults, ...configData?.defaults },
      formatting: {
        entityExtraction: {
          ...defaults.formatting.entityExtraction,
          ...configData?.formatting?.entityExtraction,
        },
        summaryGeneration: {
          ...defaults.formatting.summaryGeneration,
          ...configData?.formatting?.summaryGeneration,
        },
        suggestionGeneration: {
          ...defaults.formatting.suggestionGeneration,
          ...configData?.formatting?.suggestionGeneration,
        },
      },
      performance: {
        caching: { ...defaults.performance.caching, ...configData?.performance?.caching },
        memory: { ...defaults.performance.memory, ...configData?.performance?.memory },
        rateLimiting: {
          ...defaults.performance.rateLimiting,
          ...configData?.performance?.rateLimiting,
        },
      },
    };
  }

  private getDefaultConfig(): ResultFormatterFullConfig {
    return {
      profiles: {
        openai: {
          format: 'json',
          includeMetadata: true,
          maxTokens: 4000,
          structuredOutput: true,
        },
        claude: {
          format: 'markdown',
          includeMetadata: false,
          maxTokens: 8000,
          structuredOutput: false,
        },
        anthropic: {
          format: 'json',
          includeMetadata: true,
          maxTokens: 2000,
          structuredOutput: true,
        },
        custom: {
          format: 'json',
          includeMetadata: true,
          maxTokens: 4000,
          structuredOutput: true,
        },
      },
      defaults: {
        provider: 'openai',
        format: 'json',
        includeMetadata: true,
        maxTokens: 4000,
        structuredOutput: true,
      },
      formatting: {
        entityExtraction: {
          confidenceThreshold: 0.7,
          maxEntities: 100,
          includeRelationships: true,
        },
        summaryGeneration: {
          maxLength: 500,
          includeStatistics: true,
          includeRecommendations: true,
        },
        suggestionGeneration: {
          maxSuggestions: 5,
          includeCodeSmells: true,
          includeRefactoringTips: true,
        },
      },
      performance: {
        caching: {
          enabled: true,
          ttl: 300,
          maxCacheSize: 1000,
        },
        memory: {
          maxResultSize: 1000000,
          streamResults: true,
        },
        rateLimiting: {
          maxRequestsPerSecond: 10,
          burstLimit: 20,
        },
      },
    };
  }
}
