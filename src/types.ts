// 1. 工具类型
export type EventListener<T = any> = (data: T) => void;

// 2. 配置模块
import { ConfigService } from './config/ConfigService';
import { ConfigFactory } from './config/ConfigFactory';

// 3. 核心服务模块
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';
import { ProjectIdManager } from './database/ProjectIdManager';
import { DatabaseLoggerService } from './database/common/DatabaseLoggerService';
import { ProjectPathMappingService } from './database/ProjectPathMappingService';
import { EventToLogBridge } from './database/common/EventToLogBridge';

// 4. Qdrant 数据库模块
import { QdrantService } from './database/qdrant/QdrantService';
import { IQdrantConnectionManager } from './database/qdrant/QdrantConnectionManager';
import { IQdrantCollectionManager } from './database/qdrant/QdrantCollectionManager';
import { IQdrantVectorOperations } from './database/qdrant/QdrantVectorOperations';
import { IQdrantQueryUtils } from './database/qdrant/QdrantQueryUtils';
import { IQdrantProjectManager } from './database/qdrant/QdrantProjectManager';

// 5. 文件系统模块
import { FileSystemTraversal } from './service/filesystem/FileSystemTraversal';
import { FileWatcherService } from './service/filesystem/FileWatcherService';
import { ChangeDetectionService } from './service/filesystem/ChangeDetectionService';
import { HotReloadRecoveryService } from './service/filesystem/HotReloadRecoveryService';
import { ProjectHotReloadService } from './service/filesystem/ProjectHotReloadService';
import { HotReloadConfigService } from './service/filesystem/HotReloadConfigService';
import { HotReloadMonitoringService } from './service/filesystem/HotReloadMonitoringService';
import { HotReloadErrorPersistenceService } from './service/filesystem/HotReloadErrorPersistenceService';
import { HotReloadRestartService } from './service/filesystem/HotReloadRestartService';

// 6. 索引模块
import { IndexService } from './service/index/IndexService';
import { IndexingLogicService } from './service/index/IndexingLogicService';
import { VectorIndexService } from './service/index/VectorIndexService';

// 7. 项目状态管理模块
import { ProjectStateManager } from './service/project/ProjectStateManager';
import { CoreStateService } from './service/project/services/CoreStateService';
import { StorageStateService } from './service/project/services/StorageStateService';

// 8. 性能优化模块
import { PerformanceOptimizerService } from './infrastructure/batching/PerformanceOptimizerService';

// 9. 嵌入器模块
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';

// 10. 忽略规则模块
import { IgnoreRuleManager } from './service/ignore/IgnoreRuleManager';

// 11. Tree-sitter 解析模块
import { TreeSitterService } from './service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from './service/parser/core/parse/TreeSitterCoreService';
import { ChunkToVectorCoordinationService } from './service/parser/ChunkToVectorCoordinationService';
import { UnifiedGuardCoordinator } from './service/parser/guard/UnifiedGuardCoordinator';
import { IUnifiedGuardCoordinator } from './service/parser/guard/IUnifiedGuardCoordinator';
// ProcessingGuard 现在是 UnifiedGuardCoordinator 的别名
type ProcessingGuard = UnifiedGuardCoordinator;
import { UnifiedDetectionService } from './service/parser/processing/detection/UnifiedDetectionService';
import { IntelligentFallbackEngine } from './service/parser/guard/IntelligentFallbackEngine';
import { ProcessingStrategyFactory } from './service/parser/processing/strategies/providers/ProcessingStrategyFactory';
import { MarkdownTextStrategy } from './service/parser/processing/utils/md/MarkdownTextStrategy';
import { XMLTextStrategy } from './service/parser/processing/utils/xml/XMLTextStrategy';
import { UnifiedConfigManager } from './service/parser/config/UnifiedConfigManager';
import { ASTCodeSplitter } from './service/parser/processing/strategies/impl/ASTCodeSplitter';
import { ImportStrategyProvider } from './service/parser/processing/strategies/providers/ImportStrategyProvider';
import { SyntaxAwareStrategyProvider } from './service/parser/processing/strategies/providers/SyntaxAwareStrategyProvider';
import { IntelligentStrategyProvider } from './service/parser/processing/strategies/providers/IntelligentStrategyProvider';
import { StructureAwareStrategyProvider } from './service/parser/processing/strategies/providers/StructureAwareStrategyProvider';
import { SemanticStrategyProvider } from './service/parser/processing/strategies/providers/SemanticStrategyProvider';

// 12. 文件搜索模块
import { FileSearchService } from './service/filesearch/FileSearchService';
import { FileVectorIndexer } from './service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from './service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from './service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from './service/filesearch/FileSearchCache';

// 13. Nebula 数据库模块
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

// 14. Nebula 监控模块
import { NebulaConnectionMonitor } from './service/graph/monitoring/NebulaConnectionMonitor';

// 15. 图服务模块
import { GraphCacheService } from './infrastructure/caching/GraphCacheService';
import { GraphQueryBuilder, IGraphQueryBuilder } from './database/nebula/query/GraphQueryBuilder';
import { GraphPerformanceMonitor } from './service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from './service/graph/performance/GraphBatchOptimizer';
import { GraphQueryValidator } from './service/graph/query/GraphQueryValidator';
import { IGraphSearchService } from './service/graph/core/IGraphSearchService';
import { GraphAnalysisService } from './service/graph/core/GraphAnalysisService';
import { GraphDataService } from './service/graph/core/GraphDataService';
import { GraphTransactionService } from './service/graph/core/GraphTransactionService';
import { GraphSearchServiceNew } from './service/graph/core/GraphSearchService';
import { GraphServiceNewAdapter } from './service/graph/core/GraphServiceNewAdapter';

// 16. 图数据库模块
import { GraphDatabaseService } from './database/graph/GraphDatabaseService';

// 17. 基础设施模块
import { TransactionCoordinator } from './infrastructure/transaction/TransactionCoordinator';
import { DatabaseHealthChecker } from './infrastructure/monitoring/DatabaseHealthChecker';

// 18. 图数据映射模块
import { GraphDataMappingService } from './service/graph/mapping/GraphDataMappingService';

// 19. SQLite 数据库模块
import { SqliteDatabaseService } from './database/splite/SqliteDatabaseService';
import { SqliteStateManager } from './database/splite/SqliteStateManager';
import { MigrationManager } from './database/splite/migrations/MigrationManager';
import { DatabaseMigrationRunner } from './database/splite/migrations/DatabaseMigrationRunner';

export const TYPES = {
  // 1. 工具类型
  EventListener: Symbol.for('EventListener'),

  // 2. 配置服务
  ConfigService: Symbol.for('ConfigService'),
  ConfigFactory: Symbol.for('ConfigFactory'),
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
  GraphCacheConfigService: Symbol.for('GraphCacheConfigService'),

  // 3. 核心服务
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  ProjectPathMappingService: Symbol.for('ProjectPathMappingService'),
  UnifiedMappingService: Symbol.for('UnifiedMappingService'),
  MemoryMonitorService: Symbol.for('MemoryMonitorService'),
  DatabaseLoggerService: Symbol.for('DatabaseLoggerService'),
  EventToLogBridge: Symbol.for('EventToLogBridge'),
  PerformanceMonitor: Symbol.for('PerformanceMonitor'),
  DatabasePerformanceMonitor: Symbol.for('DatabasePerformanceMonitor'),

  // 4. Qdrant 服务模块
  QdrantService: Symbol.for('QdrantService'),
  IQdrantConnectionManager: Symbol.for('IQdrantConnectionManager'),
  IQdrantCollectionManager: Symbol.for('IQdrantCollectionManager'),
  IQdrantVectorOperations: Symbol.for('IQdrantVectorOperations'),
  IQdrantQueryUtils: Symbol.for('IQdrantQueryUtils'),
  IQdrantProjectManager: Symbol.for('IQdrantProjectManager'),

  // 5. 文件系统服务
  FileSystemTraversal: Symbol.for('FileSystemTraversal'),
  FileWatcherService: Symbol.for('FileWatcherService'),
  ChangeDetectionService: Symbol.for('ChangeDetectionService'),
  HotReloadRecoveryService: Symbol.for('HotReloadRecoveryService'),
  ProjectHotReloadService: Symbol.for('ProjectHotReloadService'),
  HotReloadConfigService: Symbol.for('HotReloadConfigService'),
  HotReloadMonitoringService: Symbol.for('HotReloadMonitoringService'),
  HotReloadErrorPersistenceService: Symbol.for('HotReloadErrorPersistenceService'),
  HotReloadRestartService: Symbol.for('HotReloadRestartService'),

  // 6. 索引服务
  IndexService: Symbol.for('IndexService'),
  IndexingLogicService: Symbol.for('IndexingLogicService'),
  VectorIndexService: Symbol.for('VectorIndexService'),
  GraphIndexService: Symbol.for('GraphIndexService'),
  StorageCoordinatorService: Symbol.for('StorageCoordinatorService'),
  FileTraversalService: Symbol.for('FileTraversalService'),
  ConcurrencyService: Symbol.for('ConcurrencyService'),

  // 7. 项目状态管理服务
  ProjectStateManager: Symbol.for('ProjectStateManager'),
  CoreStateService: Symbol.for('CoreStateService'),
  StorageStateService: Symbol.for('StorageStateService'),
  DataConsistencyService: Symbol.for('DataConsistencyService'),

  // 8. 性能优化器服务
  PerformanceOptimizerService: Symbol.for('PerformanceOptimizerService'),

  // 9. 嵌入器服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),

  // 10. 忽略规则管理
  IgnoreRuleManager: Symbol.for('IgnoreRuleManager'),

  // 11. Tree-sitter 解析服务
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  ChunkToVectorCoordinationService: Symbol.for('ChunkToVectorCoordinationService'),
  UnifiedGuardCoordinator: Symbol.for('UnifiedGuardCoordinator'),
  IUnifiedGuardCoordinator: Symbol.for('IUnifiedGuardCoordinator'),

  // 12. 文件搜索服务
  FileSearchService: Symbol.for('FileSearchService'),
  FileVectorIndexer: Symbol.for('FileVectorIndexer'),
  FileQueryProcessor: Symbol.for('FileQueryProcessor'),
  FileQueryIntentClassifier: Symbol.for('FileQueryIntentClassifier'),
  FileSearchCache: Symbol.for('FileSearchCache'),

  // 13. Nebula 数据库服务
  NebulaService: Symbol.for('NebulaService'),
  INebulaService: Symbol.for('INebulaService'),
  NebulaConnectionManager: Symbol.for('NebulaConnectionManager'),
  NebulaQueryBuilder: Symbol.for('NebulaQueryBuilder'),
  INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
  INebulaSpaceManager: Symbol.for('INebulaSpaceManager'),
  INebulaGraphOperations: Symbol.for('INebulaGraphOperations'),
  INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),
  INebulaProjectManager: Symbol.for('INebulaProjectManager'),
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

  // 14. Nebula 监控服务
  NebulaConnectionMonitor: Symbol.for('NebulaConnectionMonitor'),
  ConnectionStateManager: Symbol.for('ConnectionStateManager'),

  // 15. 图服务
  GraphService: Symbol.for('GraphService'),
  GraphSearchService: Symbol.for('GraphSearchService'),
  IGraphSearchService: Symbol.for('IGraphSearchService'),
  GraphPersistenceService: Symbol.for('GraphPersistenceService'),
  GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
  IGraphQueryBuilder: Symbol.for('IGraphQueryBuilder'),
  GraphPerformanceMonitor: Symbol.for('GraphPerformanceMonitor'),
  GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
  GraphPersistenceUtils: Symbol.for('GraphPersistenceUtils'),
  GraphQueryValidator: Symbol.for('GraphQueryValidator'),
  TransactionManager: Symbol.for('TransactionManager'),
  GraphDatabaseService: Symbol.for('GraphDatabaseService'),
  GraphAnalysisService: Symbol.for('GraphAnalysisService'),
  GraphDataService: Symbol.for('GraphDataService'),
  GraphTransactionService: Symbol.for('GraphTransactionService'),
  GraphSearchServiceNew: Symbol.for('GraphSearchServiceNew'),
  GraphServiceNewAdapter: Symbol.for('GraphServiceNewAdapter'),

  // 16. 项目查询服务
  ProjectLookupService: Symbol.for('ProjectLookupService'),

  // 17. 基础设施服务
  CacheService: Symbol.for('CacheService'),
  BatchOptimizer: Symbol.for('BatchOptimizer'),
  HealthChecker: Symbol.for('HealthChecker'),
  DatabaseConnectionPool: Symbol.for('DatabaseConnectionPool'),
  TransactionCoordinator: Symbol.for('TransactionCoordinator'),
  InfrastructureManager: Symbol.for('InfrastructureManager'),
  DatabaseHealthChecker: Symbol.for('DatabaseHealthChecker'),
  GraphCacheService: Symbol.for('GraphCacheService'),
  GraphConfigService: Symbol.for('GraphConfigService'),
  CacheConfig: Symbol.for('CacheConfig'),
  InfrastructureErrorHandler: Symbol.for('InfrastructureErrorHandler'),

  // 18. 图数据映射服务
  GraphDataMappingService: Symbol.for('GraphDataMappingService'),

  // 19. 异步处理服务
  AsyncTaskQueue: Symbol.for('AsyncTaskQueue'),

  // 20. 验证服务
  DataMappingValidator: Symbol.for('DataMappingValidator'),

  // 21. 缓存服务
  GraphMappingCache: Symbol.for('GraphMappingCache'),

  // 22. 批处理优化服务
  VectorBatchOptimizer: Symbol.for('VectorBatchOptimizer'),

  // 23. 事务相关服务
  TransactionLogger: Symbol.for('TransactionLogger'),
  DataConsistencyChecker: Symbol.for('DataConsistencyChecker'),
  ConflictResolver: Symbol.for('ConflictResolver'),
  TransactionPerformanceOptimizer: Symbol.for('TransactionPerformanceOptimizer'),

  // 24. 高级映射相关服务
  AdvancedMappingService: Symbol.for('AdvancedMappingService'),
  FaultToleranceHandler: Symbol.for('FaultToleranceHandler'),
  MappingRuleEngine: Symbol.for('MappingRuleEngine'),
  MappingCacheManager: Symbol.for('MappingCacheManager'),

  // 25. 性能监控和优化相关服务
  PerformanceDashboard: Symbol.for('PerformanceDashboard'),
  PerformanceMetricsCollector: Symbol.for('PerformanceMetricsCollector'),
  AutoOptimizationAdvisor: Symbol.for('AutoOptimizationAdvisor'),
  PerformanceBenchmark: Symbol.for('PerformanceBenchmark'),
  CachePerformanceMonitor: Symbol.for('CachePerformanceMonitor'),
  BatchProcessingOptimizer: Symbol.for('BatchProcessingOptimizer'),

  // 26. 通用文件处理服务
  UniversalTextStrategy: Symbol.for('UniversalTextStrategy'),
  ErrorThresholdManager: Symbol.for('ErrorThresholdManager'),
  MemoryGuard: Symbol.for('MemoryGuard'),
  BackupFileProcessor: Symbol.for('BackupFileProcessor'),
  ExtensionlessFileProcessor: Symbol.for('ExtensionlessFileProcessor'),
  ProcessingGuard: Symbol.for('ProcessingGuard'),
  ProcessingStrategySelector: Symbol.for('ProcessingStrategySelector'),
  CleanupManager: Symbol.for('CleanupManager'),
  UniversalProcessingConfig: Symbol.for('UniversalProcessingConfig'),
  FileProcessingCoordinator: Symbol.for('FileProcessingCoordinator'),
  FileFeatureDetector: Symbol.for('FileFeatureDetector'),

  // 27. MemoryGuard 参数
  MemoryLimitMB: Symbol.for('MemoryLimitMB'),
  MemoryCheckIntervalMs: Symbol.for('MemoryCheckIntervalMs'),

  // 28. SQLite服务
  SqliteDatabaseService: Symbol.for('SqliteDatabaseService'),
  SqliteConnectionManager: Symbol.for('SqliteConnectionManager'),
  SqliteProjectManager: Symbol.for('SqliteProjectManager'),
  SqliteInfrastructure: Symbol.for('SqliteInfrastructure'),

  // 29. SQLite迁移服务
  JsonToSqliteMigrator: Symbol.for('JsonToSqliteMigrator'),
  MigrationOrchestrator: Symbol.for('MigrationOrchestrator'),

  // 30. SQLite状态管理服务
  SqliteStateManager: Symbol.for('SqliteStateManager'),

  // 31. 数据库迁移管理
  MigrationManager: Symbol.for('MigrationManager'),
  DatabaseMigrationRunner: Symbol.for('DatabaseMigrationRunner'),

  // 32. 文件哈希管理服务
  FileHashManager: Symbol.for('FileHashManager'),

  // 33. 查询结果标准化服务
  QueryResultNormalizer: Symbol.for('QueryResultNormalizer'),
  NormalizationIntegrationService: Symbol.for('NormalizationIntegrationService'),

  // 34. 统一缓存管理器
  UnifiedCacheManager: Symbol.for('UnifiedCacheManager'),

  // 35. 错误处理管理器
  ErrorHandlingManager: Symbol.for('ErrorHandlingManager'),

  // 36. 分段器相关服务
  SegmentationStrategyCoordinator: Symbol.for('SegmentationStrategyCoordinator'),
  ConfigurationManager: Symbol.for('ConfigurationManager'),
  ProtectionCoordinator: Symbol.for('ProtectionCoordinator'),
  ComplexityCalculator: Symbol.for('ComplexityCalculator'),
  SemanticSegmentationStrategy: Symbol.for('SemanticSegmentationStrategy'),
  BracketSegmentationStrategy: Symbol.for('BracketSegmentationStrategy'),
  LineSegmentationStrategy: Symbol.for('LineSegmentationStrategy'),
  MarkdownSegmentationStrategy: Symbol.for('MarkdownSegmentationStrategy'),
  StandardizationSegmentationStrategy: Symbol.for('StandardizationSegmentationStrategy'),
  ASTSegmentationStrategy: Symbol.for('ASTSegmentationStrategy'),
  OverlapProcessor: Symbol.for('OverlapProcessor'),
  OverlapPostProcessor: Symbol.for('OverlapPostProcessor'),
  ASTNodeTracker: Symbol.for('ASTNodeTracker'),
  ChunkFilter: Symbol.for('ChunkFilter'),
  ChunkRebalancer: Symbol.for('ChunkRebalancer'),

  // 37. 优化的降级处理相关服务
  OptimizedProcessingGuard: Symbol.for('OptimizedProcessingGuard'),
  UnifiedDetectionService: Symbol.for('UnifiedDetectionService'),
  IntelligentFallbackEngine: Symbol.for('IntelligentFallbackEngine'),
  ProcessingStrategyFactory: Symbol.for('ProcessingStrategyFactory'),

  // 38. 特殊格式文本分割器
  MarkdownTextStrategy: Symbol.for('MarkdownTextStrategy'),
  XMLTextStrategy: Symbol.for('XMLTextStrategy'),

  // 39. 统一配置管理器
  UnifiedConfigManager: Symbol.for('UnifiedConfigManager'),

  // 40. 统一策略工厂和管理器
  UnifiedStrategyFactory: Symbol.for('UnifiedStrategyFactory'),
  UnifiedStrategyManager: Symbol.for('UnifiedStrategyManager'),
  UnifiedProcessingCoordinator: Symbol.for('UnifiedProcessingCoordinator'),

  LanguageDetector: Symbol.for('LanguageDetector'),

  // 42. 分段策略提供者
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),
  ImportStrategyProvider: Symbol.for('ImportStrategyProvider'),
  SyntaxAwareStrategyProvider: Symbol.for('SyntaxAwareStrategyProvider'),
  IntelligentStrategyProvider: Symbol.for('IntelligentStrategyProvider'),
  StructureAwareStrategyProvider: Symbol.for('StructureAwareStrategyProvider'),
  SemanticStrategyProvider: Symbol.for('SemanticStrategyProvider'),
  // 41. 优先级管理系统
  PriorityManager: Symbol.for('PriorityManager'),
  SmartStrategySelector: Symbol.for('SmartStrategySelector'),
  FallbackManager: Symbol.for('FallbackManager'),

  // 43. 协调器
  PerformanceMonitoringCoordinator: Symbol.for('PerformanceMonitoringCoordinator'),
  ConfigCoordinator: Symbol.for('ConfigCoordinator'),
};