import { injectable, inject } from 'inversify';
import * as dotenv from 'dotenv';
import { AppConfig, TreeSitterConfig } from './ConfigTypes';
import {
  EnvironmentConfigService,
  QdrantConfigService,
  EmbeddingConfigService,
  LoggingConfigService,
  MonitoringConfigService,
  FileProcessingConfigService,
  BatchProcessingConfigService,
  RedisConfigService,
  ProjectConfigService,
  IndexingConfigService,
  LSPConfigService,
  SemgrepConfigService,
  TreeSitterConfigService,
} from './service';
import { TYPES } from '../types';

dotenv.config();



@injectable()
export class ConfigService {
  private config: AppConfig | null = null;

  constructor(
    @inject(TYPES.EnvironmentConfigService) private environmentConfigService: EnvironmentConfigService,
    @inject(TYPES.QdrantConfigService) private qdrantConfigService: QdrantConfigService,
    @inject(TYPES.EmbeddingConfigService) private embeddingConfigService: EmbeddingConfigService,
    @inject(TYPES.LoggingConfigService) private loggingConfigService: LoggingConfigService,
    @inject(TYPES.MonitoringConfigService) private monitoringConfigService: MonitoringConfigService,
    @inject(TYPES.FileProcessingConfigService) private fileProcessingConfigService: FileProcessingConfigService,
    @inject(TYPES.BatchProcessingConfigService) private batchProcessingConfigService: BatchProcessingConfigService,
    @inject(TYPES.RedisConfigService) private redisConfigService: RedisConfigService,
    @inject(TYPES.ProjectConfigService) private projectConfigService: ProjectConfigService,
    @inject(TYPES.IndexingConfigService) private indexingConfigService: IndexingConfigService,
    @inject(TYPES.LSPConfigService) private lspConfigService: LSPConfigService,
    @inject(TYPES.SemgrepConfigService) private semgrepConfigService: SemgrepConfigService,
    @inject(TYPES.TreeSitterConfigService) private treeSitterConfigService: TreeSitterConfigService,
  ) {}

  async initialize(): Promise<void> {
    try {
      // 获取各子配置
      const environment = this.environmentConfigService.getConfig();
      const qdrant = this.qdrantConfigService.getConfig();
      const embedding = this.embeddingConfigService.getConfig();
      const logging = this.loggingConfigService.getConfig();
      const monitoring = this.monitoringConfigService.getConfig();
      const fileProcessing = this.fileProcessingConfigService.getConfig();
      const batchProcessing = this.batchProcessingConfigService.getConfig();
      const redis = this.redisConfigService.getConfig();
      const project = this.projectConfigService.getConfig();
      const indexing = this.indexingConfigService.getConfig();
      const lsp = this.lspConfigService.getConfig();
      const semgrep = this.semgrepConfigService.getConfig();
      const treeSitter = this.treeSitterConfigService.getConfig();

      // 构建完整的应用配置
      this.config = {
        environment,
        qdrant,
        embedding,
        logging,
        monitoring,
        fileProcessing,
        batchProcessing,
        redis,
        lsp,
        semgrep,
        caching: {
          defaultTTL: 3600,
          maxSize: 10000,
          cleanupInterval: 300,
        },
        indexing,
        project,
        treeSitter,
        // 可选配置项
        mlReranking: undefined, // 可以根据需要添加ML重排序配置
        nebula: undefined, // 可以根据需要添加nebula配置
        performance: {
          cleanupInterval: 300,
          retentionPeriod: 86400,
        },
        cache: {
          ttl: 3600,
          maxEntries: 10000,
          cleanupInterval: 300,
        },
        fusion: {
          vectorWeight: 0.4,
          graphWeight: 0.3,
          contextualWeight: 0.2,
          recencyWeight: 0.05,
          popularityWeight: 0.05,
        },
      };
    } catch (error) {
      throw new Error(`Failed to initialize configuration: ${error}`);
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config[key];
  }

  getAll(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return { ...this.config };
  }

  /**
   * 专门用于获取Qdrant配置的方法
   */
  getQdrantConfig() {
    return this.get('qdrant');
  }

  /**
   * 专门用于获取环境配置的方法
   */
  getEnvironmentConfig() {
    return this.get('environment');
  }

  /**
   * 专门用于获取嵌入器配置的方法
   */
  getEmbeddingConfig() {
    return this.get('embedding');
  }

  /**
   * 验证嵌入提供者配置
   * 使用策略模式处理不同提供者的验证逻辑
   */
  validateEmbeddingProviderConfig(provider: string, config: any): string[] {
    const providerValidators: Record<string, (config: any) => string[]> = {
      openai: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('OpenAI model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('OpenAI API key is required');
        }
        return errors;
      },
      ollama: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Ollama model is required');
        }
        if (!config.baseUrl || config.baseUrl.trim() === '') {
          errors.push('Ollama base URL is required');
        }
        return errors;
      },
      transformers: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Transformers model is required');
        }
        return errors;
      },
      'transformers-multilingual': (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Transformers multilingual model is required');
        }
        return errors;
      },
      cohere: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('Cohere model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('Cohere API key is required');
        }
        return errors;
      },
      huggingface: (config) => {
        const errors: string[] = [];
        if (!config.model || config.model.trim() === '') {
          errors.push('HuggingFace model is required');
        }
        if (!config.apiKey || config.apiKey.trim() === '') {
          errors.push('HuggingFace API key is required');
        }
        return errors;
      }
    };

    const validator = providerValidators[provider];
    if (!validator) {
      return [`Unknown embedding provider: ${provider}`];
    }

    return validator(config);
  }
}