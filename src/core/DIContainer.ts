import { Container, ContainerModule } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { QdrantService } from '../database/QdrantService';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { QdrantConnectionManager } from '../database/QdrantConnectionManager';
import { QdrantCollectionManager } from '../database/QdrantCollectionManager';
import { QdrantVectorOperations } from '../database/QdrantVectorOperations';
import { QdrantQueryUtils } from '../database/QdrantQueryUtils';
import { QdrantProjectManager } from '../database/QdrantProjectManager';

import { FileSystemTraversal } from '../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../service/filesystem/ChangeDetectionService';
import { IndexSyncService } from '../service/index/IndexSyncService';
import { ProjectStateManager } from '../service/project/ProjectStateManager';
import { PerformanceOptimizerService } from '../service/resilience/ResilientBatchingService';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../embedders/EmbeddingCacheService';
import { TYPES } from '../types';

// 创建依赖注入容器
const diContainer = new Container();

// 注册服务
diContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(ConfigService.getInstance());
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
diContainer.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();

export { diContainer };