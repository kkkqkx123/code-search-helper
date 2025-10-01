import { ConfigService } from './config/ConfigService';
import { QdrantService } from './database/qdrant/QdrantService';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { ProjectIdManager } from './database/ProjectIdManager';
import { IQdrantConnectionManager } from './database/qdrant/QdrantConnectionManager';
import { IQdrantCollectionManager } from './database/qdrant/QdrantCollectionManager';
import { IQdrantVectorOperations } from './database/qdrant/QdrantVectorOperations';
import { IQdrantQueryUtils } from './database/qdrant/QdrantQueryUtils';
import { IQdrantProjectManager } from './database/qdrant/QdrantProjectManager';

import { FileSystemTraversal } from './service/filesystem/FileSystemTraversal';
import { FileWatcherService } from './service/filesystem/FileWatcherService';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { IndexSyncService } from './service/index/IndexSyncService';
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { PerformanceOptimizerService } from './service/resilience/ResilientBatchingService';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { ConfigFactory } from './config/ConfigFactory';

// Tree-sitter 解析服务
import { TreeSitterService } from './service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from './service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from './service/parser/splitting/ASTCodeSplitter';

// 文件搜索服务
import { FileSearchService } from './service/filesearch/FileSearchService';
import { FileVectorIndexer } from './service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from './service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from './service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from './service/filesearch/FileSearchCache';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  ConfigFactory: Symbol.for('ConfigFactory'),

  // 配置服务
  EnvironmentConfigService: Symbol.for('EnvironmentConfigService'),
  QdrantConfigService: Symbol.for('QdrantConfigService'),
  EmbeddingConfigService: Symbol.for('EmbeddingConfigService'),
  LoggingConfigService: Symbol.for('LoggingConfigService'),
  MonitoringConfigService: Symbol.for('MonitoringConfigService'),
  FileProcessingConfigService: Symbol.for('FileProcessingConfigService'),
  BatchProcessingConfigService: Symbol.for('BatchProcessingConfigService'),
  RedisConfigService: Symbol.for('RedisConfigService'),
  ProjectConfigService: Symbol.for('ProjectConfigService'),
  IndexingConfigService: Symbol.for('IndexingConfigService'),
  LSPConfigService: Symbol.for('LSPConfigService'),
  SemgrepConfigService: Symbol.for('SemgrepConfigService'),
  TreeSitterConfigService: Symbol.for('TreeSitterConfigService'),

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

  // Tree-sitter 解析服务
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),

  // 文件搜索服务
  FileSearchService: Symbol.for('FileSearchService'),
  FileVectorIndexer: Symbol.for('FileVectorIndexer'),
  FileQueryProcessor: Symbol.for('FileQueryProcessor'),
  FileQueryIntentClassifier: Symbol.for('FileQueryIntentClassifier'),
  FileSearchCache: Symbol.for('FileSearchCache'),
};