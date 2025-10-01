import { Container, ContainerModule } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { ConfigFactory } from '../config/ConfigFactory';
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
} from '../config/service';
import { QdrantService } from '../database/qdrant/QdrantService';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { QdrantConnectionManager } from '../database/qdrant/QdrantConnectionManager';
import { QdrantCollectionManager } from '../database/qdrant/QdrantCollectionManager';
import { QdrantVectorOperations } from '../database/qdrant/QdrantVectorOperations';
import { QdrantQueryUtils } from '../database/qdrant/QdrantQueryUtils';
import { QdrantProjectManager } from '../database/qdrant/QdrantProjectManager';

import { FileSystemTraversal } from '../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../service/filesystem/ChangeDetectionService';
import { IndexSyncService } from '../service/index/IndexSyncService';
import { ProjectStateManager } from '../service/project/ProjectStateManager';
import { PerformanceOptimizerService } from '../service/resilience/ResilientBatchingService';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../embedders/EmbeddingCacheService';
import { TYPES } from '../types';

// Tree-sitter 解析服务
import { TreeSitterService } from '../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from '../service/parser/splitting/ASTCodeSplitter';

// 文件搜索服务
import { FileSearchService } from '../service/filesearch/FileSearchService';
import { FileVectorIndexer } from '../service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from '../service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from '../service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from '../service/filesearch/FileSearchCache';

// Graph 服务
import { GraphService } from '../service/graph/core/GraphService';
import { GraphPersistenceService } from '../service/graph/core/GraphPersistenceService';
import { GraphSearchService } from '../service/graph/core/GraphSearchService';
import { GraphCacheService } from '../service/graph/cache/GraphCacheService';
import { GraphQueryBuilder } from '../service/graph/query/GraphQueryBuilder';
import { GraphPerformanceMonitor } from '../service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../service/graph/performance/GraphBatchOptimizer';
import { GraphPersistenceUtils } from '../service/graph/utils/GraphPersistenceUtils';

// 创建依赖注入容器
const diContainer = new Container();

// 注册配置服务
diContainer.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
diContainer.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
diContainer.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
diContainer.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
diContainer.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
diContainer.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
diContainer.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
diContainer.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
diContainer.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
diContainer.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
diContainer.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
diContainer.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
diContainer.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();

// 注册主配置服务
diContainer.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();

// 注意：ConfigFactory 不再通过 DI 容器注册，因为它需要手动创建以确保 ConfigService 已初始化

// 注册其他服务
diContainer.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
diContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
diContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();

// 注册 Qdrant 服务模块
diContainer.bind<QdrantConnectionManager>(TYPES.IQdrantConnectionManager).to(QdrantConnectionManager).inSingletonScope();
diContainer.bind<QdrantCollectionManager>(TYPES.IQdrantCollectionManager).to(QdrantCollectionManager).inSingletonScope();
diContainer.bind<QdrantVectorOperations>(TYPES.IQdrantVectorOperations).to(QdrantVectorOperations).inSingletonScope();
diContainer.bind<QdrantQueryUtils>(TYPES.IQdrantQueryUtils).to(QdrantQueryUtils).inSingletonScope();
diContainer.bind<QdrantProjectManager>(TYPES.IQdrantProjectManager).to(QdrantProjectManager).inSingletonScope();
diContainer.bind<QdrantService>(TYPES.QdrantService).to(QdrantService).inSingletonScope();


// 注册文件系统服务
diContainer.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
diContainer.bind<FileWatcherService>(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
diContainer.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();

// 注册索引同步服务
diContainer.bind<IndexSyncService>(TYPES.IndexSyncService).to(IndexSyncService).inSingletonScope();

// 注册项目状态管理服务
diContainer.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

// 注册性能优化器服务
diContainer.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

// 注册嵌入器服务
diContainer.bind<EmbedderFactory>(TYPES.EmbedderFactory).to(EmbedderFactory).inSingletonScope();

// 注册 EmbeddingCacheService - 使用工厂类模式避免手动unbind/rebind
// 注意：EmbeddingCacheService将在应用启动时通过工厂类创建实例
diContainer.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();

// 注册 Tree-sitter 解析服务
diContainer.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
diContainer.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
diContainer.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();

// 注册文件搜索服务
diContainer.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService).inSingletonScope();
diContainer.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer).inSingletonScope();
diContainer.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor).inSingletonScope();
diContainer.bind<FileQueryIntentClassifier>(TYPES.FileQueryIntentClassifier).to(FileQueryIntentClassifier).inSingletonScope();
diContainer.bind<FileSearchCache>(TYPES.FileSearchCache).to(FileSearchCache).inSingletonScope();

// 注册Graph服务
diContainer.bind<GraphService>(TYPES.GraphService).to(GraphService).inSingletonScope();
diContainer.bind<GraphPersistenceService>(TYPES.GraphPersistenceService).to(GraphPersistenceService).inSingletonScope();
diContainer.bind<GraphSearchService>(TYPES.GraphSearchService).to(GraphSearchService).inSingletonScope();
diContainer.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
diContainer.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
diContainer.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
diContainer.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
diContainer.bind<GraphPersistenceUtils>(TYPES.GraphPersistenceUtils).to(GraphPersistenceUtils).inSingletonScope();
diContainer.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();

export { diContainer };