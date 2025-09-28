import { ConfigService } from './config/ConfigService';
import { QdrantService } from './database/QdrantService';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { ProjectIdManager } from './database/ProjectIdManager';
import { IQdrantConnectionManager } from './database/QdrantConnectionManager';
import { IQdrantCollectionManager } from './database/QdrantCollectionManager';
import { IQdrantVectorOperations } from './database/QdrantVectorOperations';
import { IQdrantQueryUtils } from './database/QdrantQueryUtils';
import { IQdrantProjectManager } from './database/QdrantProjectManager';

import { FileSystemTraversal } from './service/filesystem/FileSystemTraversal';
import { FileWatcherService } from './service/filesystem/FileWatcherService';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { IndexSyncService } from './service/index/IndexSyncService';
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { PerformanceOptimizerService } from './service/resilience/ResilientBatchingService';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  QdrantService: Symbol.for('QdrantService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  
  // Qdrant 服务模块
  IQdrantConnectionManager: Symbol.for('IQdrantConnectionManager'),
  IQdrantCollectionManager: Symbol.for('IQdrantCollectionManager'),
  IQdrantVectorOperations: Symbol.for('IQdrantVectorOperations'),
  IQdrantQueryUtils: Symbol.for('IQdrantQueryUtils'),
  IQdrantProjectManager: Symbol.for('IQdrantProjectManager'),
  
  // 文件系统服务
  FileSystemTraversal: Symbol.for('FileSystemTraversal'),
  FileWatcherService: Symbol.for('FileWatcherService'),
  ChangeDetectionService: Symbol.for('ChangeDetectionService'),
  // 索引同步服务
  IndexSyncService: Symbol.for('IndexSyncService'),
  // 项目状态管理服务
  ProjectStateManager: Symbol.for('ProjectStateManager'),
  // 性能优化器服务
  PerformanceOptimizerService: Symbol.for('PerformanceOptimizerService'),
  // 嵌入器服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),
};