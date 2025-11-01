import { injectable, inject } from 'inversify';
import * as dotenv from 'dotenv';
import { AppConfig, TreeSitterConfig, HotReloadConfig } from './ConfigTypes';
import {
  EnvironmentConfigService,
  QdrantConfigService,
  EmbeddingConfigService,
  LoggingConfigService,
  MonitoringConfigService,
  MemoryMonitorConfigService,
  FileProcessingConfigService,
  BatchProcessingConfigService,
  ProjectConfigService,
  IndexingConfigService,
  TreeSitterConfigService,
  ProjectNamingConfigService,
  EmbeddingBatchConfigService,
  GraphCacheConfigService,
} from './service';
import { TYPES } from '../types';
import { HotReloadConfigFactory } from './factories/HotReloadConfigFactory';

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
    @inject(TYPES.MemoryMonitorConfigService) private memoryMonitorConfigService: MemoryMonitorConfigService,
    @inject(TYPES.FileProcessingConfigService) private fileProcessingConfigService: FileProcessingConfigService,
    @inject(TYPES.BatchProcessingConfigService) private batchProcessingConfigService: BatchProcessingConfigService,
    @inject(TYPES.ProjectConfigService) private projectConfigService: ProjectConfigService,
    @inject(TYPES.IndexingConfigService) private indexingConfigService: IndexingConfigService,
    @inject(TYPES.TreeSitterConfigService) private treeSitterConfigService: TreeSitterConfigService,
    @inject(TYPES.ProjectNamingConfigService) private projectNamingConfigService: ProjectNamingConfigService,
    @inject(TYPES.EmbeddingBatchConfigService) private embeddingBatchConfigService: EmbeddingBatchConfigService,
    @inject(TYPES.GraphCacheConfigService) private graphCacheConfigService: GraphCacheConfigService,
  ) { }


  async initialize(): Promise<void> {
    try {
      // 获取各子配置
      const environment = this.environmentConfigService.getConfig();
      const qdrant = this.qdrantConfigService.getConfig();
      const embedding = this.embeddingConfigService.getConfig();
      const logging = this.loggingConfigService.getConfig();
      const monitoring = this.monitoringConfigService.getConfig();
      const memoryMonitor = this.memoryMonitorConfigService.getConfig();
      const fileProcessing = this.fileProcessingConfigService.getConfig();
      const batchProcessing = this.batchProcessingConfigService.getConfig();
      const project = this.projectConfigService.getConfig();
      const indexing = this.indexingConfigService.getConfig();
      const treeSitter = this.treeSitterConfigService.getConfig();
      const projectNaming = this.projectNamingConfigService.getConfig();
      const embeddingBatch = this.embeddingBatchConfigService.getConfig();
      const graphCache = this.graphCacheConfigService.getConfig();
      // 提供默认的热重载配置
      const hotReload = this.getDefaultHotReloadConfig();

      // 构建完整的应用配置
      this.config = {
        environment,
        qdrant,
        embedding,
        logging,
        monitoring,
        memoryMonitor,
        fileProcessing,
        batchProcessing,
        caching: {
          defaultTTL: 3600,
          maxSize: 10000,
          cleanupInterval: 300,
        },
        indexing,
        treeSitter,
        projectNaming,
        embeddingBatch, // 添加嵌入批处理配置
        hotReload, // 添加热更新配置
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
        project,
        graphCache, // 添加图缓存配置
      };
    } catch (error) {
      throw new Error(`Failed to initialize configuration: ${error}`);
    }
  }

  private getDefaultHotReloadConfig(): HotReloadConfig {
    // 使用配置工厂获取默认配置，避免硬编码
    const globalConfig = HotReloadConfigFactory.createDefaultGlobalConfig();

    // 转换为HotReloadConfig格式
    return {
      enabled: globalConfig.enabled,
      debounceInterval: globalConfig.defaultDebounceInterval,
      maxFileSize: globalConfig.defaultMaxFileSize,
      maxConcurrentProjects: globalConfig.maxConcurrentProjects,
      enableDetailedLogging: globalConfig.enableDetailedLogging,
      errorHandling: globalConfig.defaultErrorHandling
    };
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
}