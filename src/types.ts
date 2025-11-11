// 1. 工具类型
export type EventListener<T = any> = (data: T) => void;

export const TYPES = {
  // 1. 工具类型
  EventListener: Symbol.for('EventListener'),

  // 2. 配置服务
  ConfigService: Symbol.for('ConfigService'),
  EnvironmentConfigService: Symbol.for('EnvironmentConfigService'),
  QdrantConfigService: Symbol.for('QdrantConfigService'),
  EmbeddingConfigService: Symbol.for('EmbeddingConfigService'),
  EmbeddingBatchConfigService: Symbol.for('EmbeddingBatchConfigService'),
  LoggingConfigService: Symbol.for('LoggingConfigService'),
  MonitoringConfigService: Symbol.for('MonitoringConfigService'),
  MemoryMonitorConfigService: Symbol.for('MemoryMonitorConfigService'),
  FileProcessingConfigService: Symbol.for('FileProcessingConfigService'),
  BatchProcessingConfigService: Symbol.for('BatchProcessingConfigService'),
  ProjectConfigService: Symbol.for('ProjectConfigService'),
  IndexingConfigService: Symbol.for('IndexingConfigService'),
  TreeSitterConfigService: Symbol.for('TreeSitterConfigService'),
  NebulaConfigService: Symbol.for('NebulaConfigService'),
  ProjectNamingConfigService: Symbol.for('ProjectNamingConfigService'),
  InfrastructureConfigService: Symbol.for('InfrastructureConfigService'),
  GraphCacheConfigService: Symbol.for('GraphCacheConfigService'),

  // 3. 核心服务
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  ProjectIdManager: Symbol.for('ProjectIdManager'),
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
  BatchProcessingService: Symbol.for('BatchProcessingService'),

  // 9. 嵌入器服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),

  // 10. 忽略规则管理
  IgnoreRuleManager: Symbol.for('IgnoreRuleManager'),

  // 11. Tree-sitter 解析服务
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  TreeSitterQueryEngine: Symbol.for('TreeSitterQueryEngine'),
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
  IQueryRunner: Symbol.for('IQueryRunner'),
  NebulaDataOperations: Symbol.for('NebulaDataOperations'),
  INebulaDataOperations: Symbol.for('INebulaDataOperations'),
  NebulaSchemaManager: Symbol.for('NebulaSchemaManager'),
  INebulaSchemaManager: Symbol.for('INebulaSchemaManager'),
  NebulaIndexManager: Symbol.for('NebulaIndexManager'),
  INebulaIndexManager: Symbol.for('INebulaIndexManager'),
  SpaceNameUtils: Symbol.for('SpaceNameUtils'),
  ISpaceNameUtils: Symbol.for('ISpaceNameUtils'),
  IConnectionPool: Symbol.for('IConnectionPool'),
  ISessionManager: Symbol.for('ISessionManager'),
  IRetryStrategy: Symbol.for('IRetryStrategy'),
  ICircuitBreaker: Symbol.for('ICircuitBreaker'),
  NebulaQueryUtils: Symbol.for('NebulaQueryUtils'),
  NebulaResultFormatter: Symbol.for('NebulaResultFormatter'),
  NebulaEventManager: Symbol.for('NebulaEventManager'),
  NebulaBatchService: Symbol.for('NebulaBatchService'),
  INebulaBatchService: Symbol.for('INebulaBatchService'),
  NebulaFileDataService: Symbol.for('NebulaFileDataService'),
  INebulaFileDataService: Symbol.for('INebulaFileDataService'),
  NebulaClient: Symbol.for('NebulaClient'),
  QueryPipeline: Symbol.for('QueryPipeline'),
  ParallelQueryExecutor: Symbol.for('ParallelQueryExecutor'),
  MemoryOptimizer: Symbol.for('MemoryOptimizer'),
  QueryCache: Symbol.for('QueryCache'),

  // 14. Nebula 监控服务
  NebulaConnectionMonitor: Symbol.for('NebulaConnectionMonitor'),
  ConnectionStateManager: Symbol.for('ConnectionStateManager'),
   ConnectionPool: Symbol.for('ConnectionPool'),
   ConnectionHealthChecker: Symbol.for('ConnectionHealthChecker'),
   ConnectionWarmer: Symbol.for('ConnectionWarmer'),
   LoadBalancer: Symbol.for('LoadBalancer'),

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
  GraphDatabaseService: Symbol.for('GraphDatabaseService'),
  GraphAnalysisService: Symbol.for('GraphAnalysisService'),
  GraphDataService: Symbol.for('GraphDataService'),
  GraphSearchServiceNew: Symbol.for('GraphSearchServiceNew'),

  // 16. 项目查询服务
  ProjectLookupService: Symbol.for('ProjectLookupService'),

  // 17. 基础设施服务
  CacheService: Symbol.for('CacheService'),
  BatchOptimizer: Symbol.for('BatchOptimizer'),
  HealthChecker: Symbol.for('HealthChecker'),
  InfrastructureManager: Symbol.for('InfrastructureManager'),
  DatabaseHealthChecker: Symbol.for('DatabaseHealthChecker'),
  GraphCacheService: Symbol.for('GraphCacheService'),
  GraphConfigService: Symbol.for('GraphConfigService'),
  CacheConfig: Symbol.for('CacheConfig'),
  InfrastructureErrorHandler: Symbol.for('InfrastructureErrorHandler'),

  // 18. 图数据映射服务
  GraphDataMappingService: Symbol.for('GraphDataMappingService'),
  GraphMapperService: Symbol.for('GraphMapperService'),

  // 19. 异步处理服务
  AsyncTaskQueue: Symbol.for('AsyncTaskQueue'),

  // 20. 验证服务
  DataMappingValidator: Symbol.for('DataMappingValidator'),

  // 21. 缓存服务
  GraphMappingCache: Symbol.for('GraphMappingCache'),

  // 22. 批处理优化服务
  VectorBatchOptimizer: Symbol.for('VectorBatchOptimizer'),

  // 24. 高级映射相关服务
  AdvancedMappingService: Symbol.for('AdvancedMappingService'),
  FaultToleranceHandler: Symbol.for('FaultToleranceHandler'),
  MappingRuleEngine: Symbol.for('MappingRuleEngine'),
  MappingCacheManager: Symbol.for('MappingCacheManager'),

  // 25. 符号解析器相关
  SymbolResolver: Symbol.for('SymbolResolver'),
  LanguageSymbolExtractor: Symbol.for('LanguageSymbolExtractor'),
  JavaScriptSymbolExtractor: Symbol.for('JavaScriptSymbolExtractor'),
  TypeScriptSymbolExtractor: Symbol.for('TypeScriptSymbolExtractor'),
  PythonSymbolExtractor: Symbol.for('PythonSymbolExtractor'),
  JavaSymbolExtractor: Symbol.for('JavaSymbolExtractor'),

  // 26. 关系提取器相关
  RelationshipExtractorFactory: Symbol.for('RelationshipExtractorFactory'),
  // @deprecated ILanguageRelationshipExtractor is deprecated
  // ILanguageRelationshipExtractor: Symbol.for('ILanguageRelationshipExtractor'),
  // JavaScriptRelationshipExtractor: Symbol.for('JavaScriptRelationshipExtractor'),
  TypeScriptRelationshipExtractor: Symbol.for('TypeScriptRelationshipExtractor'),
  PythonRelationshipExtractor: Symbol.for('PythonRelationshipExtractor'),
  JavaRelationshipExtractor: Symbol.for('JavaRelationshipExtractor'),
  RustRelationshipExtractor: Symbol.for('RustRelationshipExtractor'),
  // 子提取器
  CallExtractor: Symbol.for('CallExtractor'),
  InheritanceExtractor: Symbol.for('InheritanceExtractor'),
  DependencyExtractor: Symbol.for('DependencyExtractor'),
  ReferenceExtractor: Symbol.for('ReferenceExtractor'),
  CreationExtractor: Symbol.for('CreationExtractor'),
  AnnotationExtractor: Symbol.for('AnnotationExtractor'),
  DataFlowExtractor: Symbol.for('DataFlowExtractor'),
  ControlFlowExtractor: Symbol.for('ControlFlowExtractor'),
  SemanticExtractor: Symbol.for('SemanticExtractor'),
  LifecycleExtractor: Symbol.for('LifecycleExtractor'),
  ConcurrencyExtractor: Symbol.for('ConcurrencyExtractor'),

  // 27. 新增的关系类型
  ReferenceRelationship: Symbol.for('ReferenceRelationship'),
  CreationRelationship: Symbol.for('CreationRelationship'),
  AnnotationRelationship: Symbol.for('AnnotationRelationship'),

  // 28. 性能监控和优化相关服务
  PerformanceDashboard: Symbol.for('PerformanceDashboard'),
  PerformanceMetricsCollector: Symbol.for('PerformanceMetricsCollector'),
  AutoOptimizationAdvisor: Symbol.for('AutoOptimizationAdvisor'),
  PerformanceBenchmark: Symbol.for('PerformanceBenchmark'),
  CachePerformanceMonitor: Symbol.for('CachePerformanceMonitor'),
  BatchProcessingOptimizer: Symbol.for('BatchProcessingOptimizer'),

  // 29. 通用文件处理服务
  UniversalTextStrategy: Symbol.for('UniversalTextStrategy'),
  ErrorThresholdManager: Symbol.for('ErrorThresholdManager'),
  MemoryGuard: Symbol.for('MemoryGuard'),
  BackupFileProcessor: Symbol.for('BackupFileProcessor'),
  ProcessingGuard: Symbol.for('ProcessingGuard'),
  ProcessingStrategySelector: Symbol.for('ProcessingStrategySelector'),
  CleanupManager: Symbol.for('CleanupManager'),
  UniversalProcessingConfig: Symbol.for('UniversalProcessingConfig'),
  FileProcessingCoordinator: Symbol.for('FileProcessingCoordinator'),
  FileFeatureDetector: Symbol.for('FileFeatureDetector'),

  // 30. MemoryGuard 参数
  MemoryLimitMB: Symbol.for('MemoryLimitMB'),
  MemoryCheckIntervalMs: Symbol.for('MemoryCheckIntervalMs'),

  // 31. SQLite服务
  SqliteDatabaseService: Symbol.for('SqliteDatabaseService'),
  SqliteConnectionManager: Symbol.for('SqliteConnectionManager'),
  SqliteProjectManager: Symbol.for('SqliteProjectManager'),
  SqliteInfrastructure: Symbol.for('SqliteInfrastructure'),

  // 32. SQLite迁移服务
  JsonToSqliteMigrator: Symbol.for('JsonToSqliteMigrator'),
  MigrationOrchestrator: Symbol.for('MigrationOrchestrator'),

  // 33. SQLite状态管理服务
  SqliteStateManager: Symbol.for('SqliteStateManager'),

  // 34. 数据库迁移管理
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

  BracketSegmentationStrategy: Symbol.for('BracketSegmentationStrategy'),
  LineSegmentationStrategy: Symbol.for('LineSegmentationStrategy'),
  MarkdownSegmentationStrategy: Symbol.for('MarkdownSegmentationStrategy'),


  OverlapProcessor: Symbol.for('OverlapProcessor'),
  OverlapPostProcessor: Symbol.for('OverlapPostProcessor'),
  ASTNodeTracker: Symbol.for('ASTNodeTracker'),
  ChunkFilter: Symbol.for('ChunkFilter'),
  ChunkRebalancer: Symbol.for('ChunkRebalancer'),
   ChunkMerger: Symbol.for('ChunkMerger'),

   // 37. 优化的降级处理相关服务
  OptimizedProcessingGuard: Symbol.for('OptimizedProcessingGuard'),
  UnifiedDetectionService: Symbol.for('UnifiedDetectionService'),
  DetectionService: Symbol.for('DetectionService'),
  IntelligentFallbackEngine: Symbol.for('IntelligentFallbackEngine'),

  // 38. 特殊格式文本分割器
  MarkdownTextStrategy: Symbol.for('MarkdownTextStrategy'),
  XMLTextStrategy: Symbol.for('XMLTextStrategy'),
  LayeredHTMLStrategy: Symbol.for('LayeredHTMLStrategy'),
  HTMLContentExtractor: Symbol.for('HTMLContentExtractor'),

  // 39. 分段配置服务
  SegmentationConfigService: Symbol.for('SegmentationConfigService'),

  UnifiedProcessingCoordinator: Symbol.for('UnifiedProcessingCoordinator'),

  LanguageDetector: Symbol.for('LanguageDetector'),
  LanguageDetectionService: Symbol.for('LanguageDetectionService'),

  // 42. 分段策略提供者
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),
  ImportStrategyProvider: Symbol.for('ImportStrategyProvider'),
  SyntaxAwareStrategyProvider: Symbol.for('SyntaxAwareStrategyProvider'),
  IntelligentStrategyProvider: Symbol.for('IntelligentStrategyProvider'),
  StructureAwareStrategyProvider: Symbol.for('StructureAwareStrategyProvider'),

  // 41. 优先级管理系统
  PriorityManager: Symbol.for('PriorityManager'),
  SmartStrategySelector: Symbol.for('SmartStrategySelector'),

  // 43. 服务容器和依赖倒置
  ServiceContainer: Symbol.for('ServiceContainer'),
  ErrorThresholdInterceptor: Symbol.for('ErrorThresholdInterceptor'),
  StrategyRegistry: Symbol.for('StrategyRegistry'),
  EventBus: Symbol.for('EventBus'),
  FallbackManager: Symbol.for('FallbackManager'),

  // 43. 协调器
  PerformanceMonitoringCoordinator: Symbol.for('PerformanceMonitoringCoordinator'),
  ConfigCoordinator: Symbol.for('ConfigCoordinator'),

  // 44. Processing模块组件
  StrategyFactory: Symbol.for('StrategyFactory'),
  BatchStrategyFactory: Symbol.for('BatchStrategyFactory'),
  UnifiedPerformanceMonitoringSystem: Symbol.for('UnifiedPerformanceMonitoringSystem'),
  ChunkPostProcessorCoordinator: Symbol.for('ChunkPostProcessorCoordinator'),

  // 45. 相似度服务相关
  SimilarityService: Symbol.for('SimilarityService'),
  SimilarityCacheManager: Symbol.for('SimilarityCacheManager'),
  SimilarityPerformanceMonitor: Symbol.for('SimilarityPerformanceMonitor'),
  SimilarityServiceInitializer: Symbol.for('SimilarityServiceInitializer'),
  SimilarityUtils: Symbol.for('SimilarityUtils'),
  LevenshteinSimilarityStrategy: Symbol.for('LevenshteinSimilarityStrategy'),
  SemanticSimilarityStrategy: Symbol.for('SemanticSimilarityStrategy'),
  KeywordSimilarityStrategy: Symbol.for('KeywordSimilarityStrategy'),
  HybridSimilarityStrategy: Symbol.for('HybridSimilarityStrategy'),
  ChunkSimilarityCalculator: Symbol.for('ChunkSimilarityCalculator'),

  // 46. 批处理计算器相关
  BatchCalculatorFactory: Symbol.for('BatchCalculatorFactory'),
  GenericBatchCalculator: Symbol.for('GenericBatchCalculator'),
  SemanticOptimizedBatchCalculator: Symbol.for('SemanticOptimizedBatchCalculator'),
  HybridOptimizedBatchCalculator: Symbol.for('HybridOptimizedBatchCalculator'),
  AdaptiveBatchCalculator: Symbol.for('AdaptiveBatchCalculator'),

  // 47. 批处理策略
  SemanticBatchStrategy: Symbol.for('SemanticBatchStrategy'),
  QdrantBatchStrategy: Symbol.for('QdrantBatchStrategy'),
  NebulaBatchStrategy: Symbol.for('NebulaBatchStrategy'),
  EmbeddingBatchStrategy: Symbol.for('EmbeddingBatchStrategy'),
};