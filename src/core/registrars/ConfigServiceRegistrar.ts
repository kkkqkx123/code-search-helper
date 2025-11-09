import { Container } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
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
  NebulaConfigService,
  EmbeddingBatchConfigService,
  GraphCacheConfigService,
  SimilarityConfigService,
} from '../../config/service';
import { ProjectPathMappingService } from '../../database/ProjectPathMappingService';

export class ConfigServiceRegistrar {
  static register(container: Container): void {
    try {
      // 配置服务
      container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
      container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
      container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
      container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
      container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
      container.bind<MemoryMonitorConfigService>(TYPES.MemoryMonitorConfigService).to(MemoryMonitorConfigService).inSingletonScope();
      container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
      container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
      container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
      container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
      container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
      container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
      container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
      container.bind<EmbeddingBatchConfigService>(TYPES.EmbeddingBatchConfigService).to(EmbeddingBatchConfigService).inSingletonScope();
      container.bind<GraphCacheConfigService>(TYPES.GraphCacheConfigService).to(GraphCacheConfigService).inSingletonScope();
      container.bind<SimilarityConfigService>(TYPES.SimilarityService).to(SimilarityConfigService).inSingletonScope();

      // 数据库服务
      container.bind<ProjectPathMappingService>(TYPES.ProjectPathMappingService).to(ProjectPathMappingService).inSingletonScope();

      // 主配置服务
      container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    } catch (error: any) {
      console.error('Error registering config services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }
}