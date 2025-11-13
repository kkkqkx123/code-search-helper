import { Container } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import {
  EnvironmentConfigService,
  QdrantConfigService,
  EmbeddingConfigService,

  MemoryMonitorConfigService,
  FileProcessingConfigService,

  ProjectConfigService,
  IndexingConfigService,
  TreeSitterConfigService,
  ProjectNamingConfigService,
  NebulaConfigService,
  EmbeddingBatchConfigService,
  GraphCacheConfigService,
  SimilarityConfigService,
} from '../../config/service';
import { ProjectMappingService } from '../../database/ProjectMappingService';

export class ConfigServiceRegistrar {
  static register(container: Container): void {
    try {
      // 配置服务
      container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
      container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
      container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
      container.bind<MemoryMonitorConfigService>(TYPES.MemoryMonitorConfigService).to(MemoryMonitorConfigService).inSingletonScope();
      container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();

      container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
      container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
      container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
      container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
      container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
      container.bind<EmbeddingBatchConfigService>(TYPES.EmbeddingBatchConfigService).to(EmbeddingBatchConfigService).inSingletonScope();
      container.bind<GraphCacheConfigService>(TYPES.GraphCacheConfigService).to(GraphCacheConfigService).inSingletonScope();
      container.bind<SimilarityConfigService>(TYPES.SimilarityService).to(SimilarityConfigService).inSingletonScope();

      // 数据库服务
      container.bind<ProjectMappingService>(TYPES.UnifiedMappingService).to(ProjectMappingService).inSingletonScope();

      // 主配置服务
      container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    } catch (error: any) {
      console.error('Error in ConfigServiceRegistrar.register:', error);
      console.error('Error type:', typeof error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      if (error && typeof error === 'object' && 'kind' in error) {
        console.error('Error kind:', (error as any).kind);
      }
      throw error;
    }
  }
}