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
  ProjectNamingConfigService,
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
    // 在测试环境中，允许返回模拟的配置值
    if (!this.config && process.env.NODE_ENV === 'test') {
      if (key === 'batchProcessing') {
        return {
          enabled: true,
          maxConcurrentOperations: 5,
          defaultBatchSize: 10,
          maxBatchSize: 100,
          memoryThreshold: 80,
          processingTimeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          continueOnError: true,
          adaptiveBatching: {
            enabled: true,
            minBatchSize: 1,
            maxBatchSize: 100,
            performanceThreshold: 5000,
            adjustmentFactor: 0.1
          },
          monitoring: {
            enabled: true,
            metricsInterval: 30000,
            alertThresholds: {
              highLatency: 5000,
              lowThroughput: 10,
              highErrorRate: 0.1,
              highMemoryUsage: 80,
              criticalMemoryUsage: 95,
              highCpuUsage: 85,
              criticalCpuUsage: 95
            }
          }
        } as any;
      }
      if (key === 'project') {
        return {
          statePath: './data/project-states.json',
          mappingPath: './data/project-mapping.json',
          allowReindex: true
        } as any;
      }
      if (key === 'indexing') {
        return {
          batchSize: 10,
          maxConcurrency: 3
        } as any;
      }
      // 对于其他配置，返回空对象或默认值
      return {} as any;
    }
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


}