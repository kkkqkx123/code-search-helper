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

// Nebula Graph 服务
import { NebulaService } from './database/NebulaService';
import { NebulaConnectionManager } from './database/nebula/NebulaConnectionManager';
import { NebulaQueryBuilder } from './database/nebula/NebulaQueryBuilder';
import { NebulaSpaceManager } from './database/nebula/NebulaSpaceManager';
import { NebulaGraphOperations } from './database/nebula/NebulaGraphOperations';

// 图服务
import { GraphService } from './service/graph/core/GraphService';
import { GraphSearchService } from './service/graph/core/GraphSearchService';
import { GraphPersistenceService } from './service/graph/core/GraphPersistenceService';
import { GraphCacheService } from './service/graph/cache/GraphCacheService';
import { GraphQueryBuilder } from './service/graph/query/GraphQueryBuilder';
import { GraphPerformanceMonitor } from './service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from './service/graph/performance/GraphBatchOptimizer';

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
  // Nebula 数据库服务
  NebulaService: Symbol.for('NebulaService'),
  INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
  INebulaSpaceManager: Symbol.for('INebulaSpaceManager'),
  INebulaGraphOperations: Symbol.for('INebulaGraphOperations'),
  INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),

  // 图服务
  GraphService: Symbol.for('GraphService'),
  GraphSearchService: Symbol.for('GraphSearchService'),
  GraphPersistenceService: Symbol.for('GraphPersistenceService'),
  GraphCacheService: Symbol.for('GraphCacheService'),
  GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
  GraphPerformanceMonitor: Symbol.for('GraphPerformanceMonitor'),
  GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
  GraphPersistenceUtils: Symbol.for('GraphPersistenceUtils'),
};