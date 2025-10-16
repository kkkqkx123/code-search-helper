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
import { DatabaseLoggerService } from './database/common/DatabaseLoggerService';
import { EventToLogBridge } from './database/common/EventToLogBridge';

/**
 * 通用事件监听器类型
 *
 * 这是一个泛型类型，允许指定事件数据的具体类型以增强类型安全性。
 * 如果未指定泛型参数，则默认使用 any 类型以保持向后兼容性。
 *
 * @template T - 事件数据的类型，默认为 any
 * @param data - 事件数据
 * @returns void
 *
 * @example
 * // 使用默认的 any 类型（向后兼容）
 * const listener: EventListener = (data) => {
 *   console.log(data);
 * };
 *
 * @example
 * // 使用具体类型增强类型安全性
 * interface UserEventData {
 *   userId: string;
 *   userName: string;
 * }
 *
 * const userListener: EventListener<UserEventData> = (data) => {
 *   // 此时 TypeScript 会知道 data 是 UserEventData 类型
 *   console.log(`User ${data.userName} (${data.userId})`);
 * };
 */
export type EventListener<T = any> = (data: T) => void;

import { FileSystemTraversal } from './service/filesystem/FileSystemTraversal';
import { FileWatcherService } from './service/filesystem/FileWatcherService';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { HotReloadRecoveryService } from './service/filesystem/HotReloadRecoveryService';
import { ProjectHotReloadService } from './service/filesystem/ProjectHotReloadService';
import { HotReloadConfigService } from './service/filesystem/HotReloadConfigService';
import { HotReloadMonitoringService } from './service/filesystem/HotReloadMonitoringService';
import { HotReloadErrorPersistenceService } from './service/filesystem/HotReloadErrorPersistenceService';
import { HotReloadRestartService } from './service/filesystem/HotReloadRestartService';
import { IndexService } from './service/index/IndexService';
import { IndexingLogicService } from './service/index/IndexingLogicService';
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { PerformanceOptimizerService } from './infrastructure/batching/PerformanceOptimizerService';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { ConfigFactory } from './config/ConfigFactory';
import { IgnoreRuleManager } from './service/ignore/IgnoreRuleManager';

// Tree-sitter 解析服务
import { TreeSitterService } from './service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from './service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from './service/parser/splitting/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from './service/parser/ChunkToVectorCoordinationService';

// 文件搜索服务
import { FileSearchService } from './service/filesearch/FileSearchService';
import { FileVectorIndexer } from './service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from './service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from './service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from './service/filesearch/FileSearchCache';

// Nebula Graph 服务
import { NebulaService, INebulaService } from './database/nebula/NebulaService';
import { NebulaConnectionManager } from './database/nebula/NebulaConnectionManager';
import { NebulaQueryBuilder } from './database/nebula/query/NebulaQueryBuilder';
import { NebulaSpaceManager } from './database/nebula/space/NebulaSpaceManager';
import { INebulaSpaceManager } from './database/nebula/space/NebulaSpaceManager';
import { NebulaGraphOperations } from './database/nebula/operation/NebulaGraphOperations';
import { ConnectionStateManager } from './database/nebula/ConnectionStateManager';
import { NebulaQueryUtils } from './database/nebula/query/NebulaQueryUtils';
import { NebulaResultFormatter } from './database/nebula/NebulaResultFormatter';
import { NebulaEventManager } from './database/nebula/NebulaEventManager';
import { NebulaQueryService, INebulaQueryService } from './database/nebula/query/NebulaQueryService';
import { NebulaTransactionService, INebulaTransactionService } from './database/nebula/NebulaTransactionService';
import { NebulaDataOperations, INebulaDataOperations } from './database/nebula/operation/NebulaDataOperations';
import { NebulaSchemaManager, INebulaSchemaManager } from './database/nebula/NebulaSchemaManager';
import { NebulaIndexManager, INebulaIndexManager } from './database/nebula/NebulaIndexManager';
import { SpaceNameUtils, ISpaceNameUtils } from './database/nebula/SpaceNameUtils';

// Nebula 监控服务
import { NebulaConnectionMonitor } from './service/graph/monitoring/NebulaConnectionMonitor';

// 图服务
// GraphCacheService 从 service/graph/cache 导入
import { GraphCacheService } from './service/graph/cache/GraphCacheService';
import { GraphQueryBuilder, IGraphQueryBuilder } from './database/nebula/query/GraphQueryBuilder';
import { GraphPerformanceMonitor } from './service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from './service/graph/performance/GraphBatchOptimizer';
import { GraphQueryValidator } from './service/graph/validation/GraphQueryValidator';
import { IGraphSearchService } from './service/graph/core/IGraphSearchService';
import { GraphAnalysisService } from './service/graph/core/GraphAnalysisService';
import { GraphDataService } from './service/graph/core/GraphDataService';
import { GraphTransactionService } from './service/graph/core/GraphTransactionService';
import { GraphSearchServiceNew } from './service/graph/core/GraphSearchService';
import { GraphServiceNewAdapter } from './service/graph/core/GraphServiceNewAdapter';

// 图数据库服务
import { GraphDatabaseService } from './database/graph/GraphDatabaseService';

// 基础设施服务
import { TransactionCoordinator } from './infrastructure/transaction/TransactionCoordinator';
import { DatabaseHealthChecker } from './infrastructure/monitoring/DatabaseHealthChecker';
// GraphCacheService 已经从 service/graph/cache 导入，不再从 infrastructure/caching 导入

// 图数据映射服务
import { GraphDataMappingService } from './service/graph/mapping/GraphDataMappingService';
import { VectorIndexService } from './service/index/VectorIndexService';

// 项目状态管理服务
import { CoreStateService } from './service/project/services/CoreStateService';
import { StorageStateService } from './service/project/services/StorageStateService';

// UnifiedGuardCoordinator 相关类型
import { UnifiedGuardCoordinator } from './service/parser/guard/UnifiedGuardCoordinator';
import { IUnifiedGuardCoordinator } from './service/parser/guard/interfaces/IUnifiedGuardCoordinator';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  ConfigFactory: Symbol.for('ConfigFactory'),

  // 配置服务
  EnvironmentConfigService: Symbol.for('EnvironmentConfigService'),
  QdrantConfigService: Symbol.for('QdrantConfigService'),
  EmbeddingConfigService: Symbol.for('EmbeddingConfigService'),
  EmbeddingBatchConfigService: Symbol.for('EmbeddingBatchConfigService'),
  LoggingConfigService: Symbol.for('LoggingConfigService'),
  MonitoringConfigService: Symbol.for('MonitoringConfigService'),
  MemoryMonitorConfigService: Symbol.for('MemoryMonitorConfigService'),
  FileProcessingConfigService: Symbol.for('FileProcessingConfigService'),
  BatchProcessingConfigService: Symbol.for('BatchProcessingConfigService'),
  RedisConfigService: Symbol.for('RedisConfigService'),
  ProjectConfigService: Symbol.for('ProjectConfigService'),
  IndexingConfigService: Symbol.for('IndexingConfigService'),
  LSPConfigService: Symbol.for('LSPConfigService'),
  SemgrepConfigService: Symbol.for('SemgrepConfigService'),
  TreeSitterConfigService: Symbol.for('TreeSitterConfigService'),
  NebulaConfigService: Symbol.for('NebulaConfigService'),
  ProjectNamingConfigService: Symbol.for('ProjectNamingConfigService'),
  InfrastructureConfigService: Symbol.for('InfrastructureConfigService'),
  

  QdrantService: Symbol.for('QdrantService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  MemoryMonitorService: Symbol.for('MemoryMonitorService'),

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
  HotReloadRecoveryService: Symbol.for('HotReloadRecoveryService'),
  ProjectHotReloadService: Symbol.for('ProjectHotReloadService'),
  HotReloadConfigService: Symbol.for('HotReloadConfigService'),
  HotReloadMonitoringService: Symbol.for('HotReloadMonitoringService'),
  HotReloadErrorPersistenceService: Symbol.for('HotReloadErrorPersistenceService'),
  HotReloadRestartService: Symbol.for('HotReloadRestartService'),
  // 索引同步服务
  IndexService: Symbol.for('IndexService'),
  IndexingLogicService: Symbol.for('IndexingLogicService'),
  VectorIndexService: Symbol.for('VectorIndexService'),
  GraphIndexService: Symbol.for('GraphIndexService'),
  StorageCoordinatorService: Symbol.for('StorageCoordinatorService'),
  FileTraversalService: Symbol.for('FileTraversalService'),
  ConcurrencyService: Symbol.for('ConcurrencyService'),
  // 项目状态管理服务
  ProjectStateManager: Symbol.for('ProjectStateManager'),
  CoreStateService: Symbol.for('CoreStateService'),
  StorageStateService: Symbol.for('StorageStateService'),
  // 性能优化器服务
  PerformanceOptimizerService: Symbol.for('PerformanceOptimizerService'),
  // 嵌入器服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),

  // Tree-sitter 解析服务
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),
  ChunkToVectorCoordinationService: Symbol.for('ChunkToVectorCoordinationService'),

  // 文件搜索服务
  FileSearchService: Symbol.for('FileSearchService'),
  FileVectorIndexer: Symbol.for('FileVectorIndexer'),
  FileQueryProcessor: Symbol.for('FileQueryProcessor'),
  FileQueryIntentClassifier: Symbol.for('FileQueryIntentClassifier'),
  FileSearchCache: Symbol.for('FileSearchCache'),
  // Nebula 数据库服务
  NebulaService: Symbol.for('NebulaService'),
  INebulaService: Symbol.for('INebulaService'),
  NebulaConnectionManager: Symbol.for('NebulaConnectionManager'),
  NebulaQueryBuilder: Symbol.for('NebulaQueryBuilder'),
  INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
  INebulaSpaceManager: Symbol.for('INebulaSpaceManager'),
  INebulaGraphOperations: Symbol.for('INebulaGraphOperations'),
  INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),
  INebulaProjectManager: Symbol.for('INebulaProjectManager'),
  // Nebula 数据和空间服务
  NebulaDataService: Symbol.for('NebulaDataService'),
  INebulaDataService: Symbol.for('INebulaDataService'),
  NebulaSpaceService: Symbol.for('NebulaSpaceService'),
  INebulaSpaceService: Symbol.for('INebulaSpaceService'),
  NebulaQueryService: Symbol.for('NebulaQueryService'),
  INebulaQueryService: Symbol.for('INebulaQueryService'),
  NebulaTransactionService: Symbol.for('NebulaTransactionService'),
  INebulaTransactionService: Symbol.for('INebulaTransactionService'),
  NebulaDataOperations: Symbol.for('NebulaDataOperations'),
  INebulaDataOperations: Symbol.for('INebulaDataOperations'),
  NebulaSchemaManager: Symbol.for('NebulaSchemaManager'),
  INebulaSchemaManager: Symbol.for('INebulaSchemaManager'),
  NebulaIndexManager: Symbol.for('NebulaIndexManager'),
  INebulaIndexManager: Symbol.for('INebulaIndexManager'),
  SpaceNameUtils: Symbol.for('SpaceNameUtils'),
  ISpaceNameUtils: Symbol.for('ISpaceNameUtils'),
  NebulaQueryUtils: Symbol.for('NebulaQueryUtils'),
  NebulaResultFormatter: Symbol.for('NebulaResultFormatter'),
  NebulaEventManager: Symbol.for('NebulaEventManager'),

  // Nebula 监控服务
  NebulaConnectionMonitor: Symbol.for('NebulaConnectionMonitor'),
  ConnectionStateManager: Symbol.for('ConnectionStateManager'),

  // 图服务
  GraphService: Symbol.for('GraphService'),
  GraphSearchService: Symbol.for('GraphSearchService'),
  IGraphSearchService: Symbol.for('IGraphSearchService'),
  GraphPersistenceService: Symbol.for('GraphPersistenceService'),
  // GraphCacheService 符号已定义在前面
  GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
  IGraphQueryBuilder: Symbol.for('IGraphQueryBuilder'),
  GraphPerformanceMonitor: Symbol.for('GraphPerformanceMonitor'),
  // GraphBatchOptimizer 符号已定义在前面
  GraphPersistenceUtils: Symbol.for('GraphPersistenceUtils'),
  GraphQueryValidator: Symbol.for('GraphQueryValidator'),
  TransactionManager: Symbol.for('TransactionManager'),
  GraphDatabaseService: Symbol.for('GraphDatabaseService'),
  GraphAnalysisService: Symbol.for('GraphAnalysisService'),
  GraphDataService: Symbol.for('GraphDataService'),
  GraphTransactionService: Symbol.for('GraphTransactionService'),
  GraphSearchServiceNew: Symbol.for('GraphSearchServiceNew'),
  GraphServiceNewAdapter: Symbol.for('GraphServiceNewAdapter'),

  // 项目查询服务
  ProjectLookupService: Symbol.for('ProjectLookupService'),

  // 数据库日志服务
  DatabaseLoggerService: Symbol.for('DatabaseLoggerService'),
  EventToLogBridge: Symbol.for('EventToLogBridge'),
  PerformanceMonitor: Symbol.for('PerformanceMonitor'),

  // 基础设施服务
  CacheService: Symbol.for('CacheService'),
  BatchOptimizer: Symbol.for('BatchOptimizer'),
  HealthChecker: Symbol.for('HealthChecker'),
  DatabaseConnectionPool: Symbol.for('DatabaseConnectionPool'),
  TransactionCoordinator: Symbol.for('TransactionCoordinator'),

  // 新增基础设施服务
  InfrastructureManager: Symbol.for('InfrastructureManager'),
  DatabaseHealthChecker: Symbol.for('DatabaseHealthChecker'),
  GraphCacheService: Symbol.for('GraphCacheService'),
  CacheConfig: Symbol.for('CacheConfig'),

  // 图数据映射服务
  GraphDataMappingService: Symbol.for('GraphDataMappingService'),

  // 异步处理服务
  AsyncTaskQueue: Symbol.for('AsyncTaskQueue'),

  // 验证服务
  DataMappingValidator: Symbol.for('DataMappingValidator'),

  // 缓存服务
  GraphMappingCache: Symbol.for('GraphMappingCache'),

  // 批处理优化服务
  GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
  VectorBatchOptimizer: Symbol.for('VectorBatchOptimizer'),

  // 事务相关服务
  TransactionLogger: Symbol.for('TransactionLogger'),
  DataConsistencyChecker: Symbol.for('DataConsistencyChecker'),
  ConflictResolver: Symbol.for('ConflictResolver'),
  TransactionPerformanceOptimizer: Symbol.for('TransactionPerformanceOptimizer'),

  // 高级映射相关服务
  AdvancedMappingService: Symbol.for('AdvancedMappingService'),
  FaultToleranceHandler: Symbol.for('FaultToleranceHandler'),
  MappingRuleEngine: Symbol.for('MappingRuleEngine'),
  MappingCacheManager: Symbol.for('MappingCacheManager'),

  // 性能监控和优化相关服务
  PerformanceDashboard: Symbol.for('PerformanceDashboard'),
  PerformanceMetricsCollector: Symbol.for('PerformanceMetricsCollector'),
  AutoOptimizationAdvisor: Symbol.for('AutoOptimizationAdvisor'),
  PerformanceBenchmark: Symbol.for('PerformanceBenchmark'),
  CachePerformanceMonitor: Symbol.for('CachePerformanceMonitor'),
  BatchProcessingOptimizer: Symbol.for('BatchProcessingOptimizer'),

  // 通用文件处理服务
  UniversalTextSplitter: Symbol.for('UniversalTextSplitter'),
  ErrorThresholdManager: Symbol.for('ErrorThresholdManager'),
  MemoryGuard: Symbol.for('MemoryGuard'),
  BackupFileProcessor: Symbol.for('BackupFileProcessor'),
  ExtensionlessFileProcessor: Symbol.for('ExtensionlessFileProcessor'),
  ProcessingGuard: Symbol.for('ProcessingGuard'),
  ProcessingStrategySelector: Symbol.for('ProcessingStrategySelector'),
  CleanupManager: Symbol.for('CleanupManager'),
  FileProcessingCoordinator: Symbol.for('FileProcessingCoordinator'),

  // MemoryGuard 参数
  MemoryLimitMB: Symbol.for('MemoryLimitMB'),
  MemoryCheckIntervalMs: Symbol.for('MemoryCheckIntervalMs'),

  // IgnoreRuleManager 符号
  IgnoreRuleManager: Symbol.for('IgnoreRuleManager'),

  // UnifiedGuardCoordinator 相关符号
  UnifiedGuardCoordinator: Symbol.for('UnifiedGuardCoordinator'),
  IUnifiedGuardCoordinator: Symbol.for('IUnifiedGuardCoordinator'),
};