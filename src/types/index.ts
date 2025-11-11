export const TYPES = {
  // 通用服务
  ConfigService: Symbol.for('ConfigService'),
  DatabaseLoggerService: Symbol.for('DatabaseLoggerService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),

  // 配置服务
  NebulaConfigService: Symbol.for('NebulaConfigService'),
  QdrantConfigService: Symbol.for('QdrantConfigService'),
  EnvironmentConfigService: Symbol.for('EnvironmentConfigService'),
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
  ProjectNamingConfigService: Symbol.for('ProjectNamingConfigService'),
  SimilarityConfigService: Symbol.for('SimilarityConfigService'),

  // 连接管理器
  NebulaConnectionManager: Symbol.for('NebulaConnectionManager'),
  QdrantConnectionManager: Symbol.for('QdrantConnectionManager'),

  // 服务层
  NebulaDataService: Symbol.for('NebulaDataService'),
  NebulaSpaceService: Symbol.for('NebulaSpaceService'),

  // 状态管理
  ConnectionStateManager: Symbol.for('ConnectionStateManager'),
  QdrantStateManager: Symbol.for('QdrantStateManager'),

  // 其他服务
  NebulaService: Symbol.for('NebulaService'),
  QdrantService: Symbol.for('QdrantService'),
  MemoryMonitorService: Symbol.for('MemoryMonitorService'),
  IMemoryMonitorService: Symbol.for('IMemoryMonitorService'),
  PerformanceOptimizerService: Symbol.for('PerformanceOptimizerService'),
  BatchProcessingService: Symbol.for('BatchProcessingService'),
  BatchStrategyFactory: Symbol.for('BatchStrategyFactory'),

  // 解析服务
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterQueryEngine: Symbol.for('TreeSitterQueryEngine'),
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),
  ChunkToVectorCoordinationService: Symbol.for('ChunkToVectorCoordinationService'),
  QueryResultNormalizer: Symbol.for('QueryResultNormalizer'),

  // 嵌入服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),

  // 项目管理
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  IndexService: Symbol.for('IndexService'),
  IndexingLogicService: Symbol.for('IndexingLogicService'),
  ProjectStateManager: Symbol.for('ProjectStateManager'),
  CoreStateService: Symbol.for('CoreStateService'),
  StorageStateService: Symbol.for('StorageStateService'),
  FileSystemTraversal: Symbol.for('FileSystemTraversal'),
  FileHashManager: Symbol.for('FileHashManager'),
  FileWatcherService: Symbol.for('FileWatcherService'),
  ChangeDetectionService: Symbol.for('ChangeDetectionService'),
  HotReloadRecoveryService: Symbol.for('HotReloadRecoveryService'),
  ProjectHotReloadService: Symbol.for('ProjectHotReloadService'),
  HotReloadConfigService: Symbol.for('HotReloadConfigService'),
  HotReloadMonitoringService: Symbol.for('HotReloadMonitoringService'),
  HotReloadErrorPersistenceService: Symbol.for('HotReloadErrorPersistenceService'),
  HotReloadRestartService: Symbol.for('HotReloadRestartService'),
  IgnoreRuleManager: Symbol.for('IgnoreRuleManager'),
  SegmentationConfigService: Symbol.for('SegmentationConfigService'),

  // Nebula-specific services
  INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
  INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),
  INebulaSchemaManager: Symbol.for('INebulaSchemaManager'),
  INebulaIndexManager: Symbol.for('INebulaIndexManager'),
  INebulaDataOperations: Symbol.for('INebulaDataOperations'),
  INebulaQueryService: Symbol.for('INebulaQueryService'),
  ISpaceNameUtils: Symbol.for('ISpaceNameUtils'),
   IConnectionPool: Symbol.for('IConnectionPool'),

  // 通用文件处理服务
  UniversalTextStrategy: Symbol.for('UniversalTextStrategy'),
  ErrorThresholdManager: Symbol.for('ErrorThresholdManager'),
  MemoryGuard: Symbol.for('MemoryGuard'),
  BackupFileProcessor: Symbol.for('BackupFileProcessor'),
  ExtensionlessFileProcessor: Symbol.for('ExtensionlessFileProcessor'),
  ProcessingGuard: Symbol.for('ProcessingGuard'),
  ProcessingStrategySelector: Symbol.for('ProcessingStrategySelector'),
  UniversalProcessingConfig: Symbol.for('UniversalProcessingConfig'),
  FileProcessingCoordinator: Symbol.for('FileProcessingCoordinator'),
  SegmentationStrategyCoordinator: Symbol.for('SegmentationStrategyCoordinator'),
  ConfigurationManager: Symbol.for('ConfigurationManager'),
  ProtectionCoordinator: Symbol.for('ProtectionCoordinator'),
  FileFeatureDetector: Symbol.for('FileFeatureDetector'),
  ASTNodeTracker: Symbol.for('ASTNodeTracker'),
  ChunkRebalancer: Symbol.for('ChunkRebalancer'),
  OverlapPostProcessor: Symbol.for('OverlapPostProcessor'),
  StrategyFactory: Symbol.for('StrategyFactory'),
  IntelligentFallbackEngine: Symbol.for('IntelligentFallbackEngine'),
  UnifiedGuardCoordinator: Symbol.for('UnifiedGuardCoordinator'),
  DetectionService: Symbol.for('DetectionService'),
  ServiceContainer: Symbol.for('ServiceContainer'),
  EventBus: Symbol.for('EventBus'),
  HTMLContentExtractor: Symbol.for('HTMLContentExtractor'),
  MemoryLimitMB: Symbol.for('MemoryLimitMB'),
  MemoryCheckIntervalMs: Symbol.for('MemoryCheckIntervalMs'),
  FileSearchService: Symbol.for('FileSearchService'),
  FileVectorIndexer: Symbol.for('FileVectorIndexer'),
  FileQueryProcessor: Symbol.for('FileQueryProcessor'),
  FileQueryIntentClassifier: Symbol.for('FileQueryIntentClassifier'),
  FileSearchCache: Symbol.for('FileSearchCache'),
  NebulaConnectionMonitor: Symbol.for('NebulaConnectionMonitor'),
  CleanupManager: Symbol.for('CleanupManager'),

  // 新增的索引服务
  VectorIndexService: Symbol.for('VectorIndexService'),
  GraphIndexService: Symbol.for('GraphIndexService'),
  StorageCoordinatorService: Symbol.for('StorageCoordinatorService'),

  // 共享服务
  FileTraversalService: Symbol.for('FileTraversalService'),
  ConcurrencyService: Symbol.for('ConcurrencyService'),

  // 适配器服务
  IndexAdapterService: Symbol.for('IndexAdapterService'),

  // 语言检测服务
  LanguageDetector: Symbol.for('LanguageDetector'),

  // 新增的策略提供者类型
  ImportStrategyProvider: Symbol.for('ImportStrategyProvider'),
  SyntaxAwareStrategyProvider: Symbol.for('SyntaxAwareStrategyProvider'),
  IntelligentStrategyProvider: Symbol.for('IntelligentStrategyProvider'),
  StructureAwareStrategyProvider: Symbol.for('StructureAwareStrategyProvider'),
  SemanticStrategyProvider: Symbol.for('SemanticStrategyProvider'),

  // 策略注册和配置管理
  StrategyRegistry: Symbol.for('StrategyRegistry'),
  
  StrategyConfigManager: Symbol.for('StrategyConfigManager'),
  MarkdownTextStrategy: Symbol.for('MarkdownTextStrategy'),
  XMLTextStrategy: Symbol.for('XMLTextStrategy'),

  // 块处理相关类型
  ChunkSimilarityCalculator: Symbol.for('ChunkSimilarityCalculator'),
  ContentQualityEvaluator: Symbol.for('ContentQualityEvaluator'),
  ChunkMerger: Symbol.for('ChunkMerger'),
  ChunkPostProcessorCoordinator: Symbol.for('ChunkPostProcessorCoordinator'),
  ChunkFilter: Symbol.for('ChunkFilter'),
  ProcessingCoordinator: Symbol.for('ProcessingCoordinator'),
  UnifiedProcessingCoordinator: Symbol.for('UnifiedProcessingCoordinator'),

  // 相似度服务相关类型
  SimilarityService: Symbol.for('SimilarityService'),
  SimilarityCacheManager: Symbol.for('SimilarityCacheManager'),
  SimilarityPerformanceMonitor: Symbol.for('SimilarityPerformanceMonitor'),
  SimilarityServiceInitializer: Symbol.for('SimilarityServiceInitializer'),
  SimilarityUtils: Symbol.for('SimilarityUtils'),
  LevenshteinSimilarityStrategy: Symbol.for('LevenshteinSimilarityStrategy'),
  SemanticSimilarityStrategy: Symbol.for('SemanticSimilarityStrategy'),
  KeywordSimilarityStrategy: Symbol.for('KeywordSimilarityStrategy'),
  HybridSimilarityStrategy: Symbol.for('HybridSimilarityStrategy'),
  BatchCalculatorFactory: Symbol.for('BatchCalculatorFactory'),
  GenericBatchCalculator: Symbol.for('GenericBatchCalculator'),
  SemanticOptimizedBatchCalculator: Symbol.for('SemanticOptimizedBatchCalculator'),
  HybridOptimizedBatchCalculator: Symbol.for('HybridOptimizedBatchCalculator'),
  AdaptiveBatchCalculator: Symbol.for('AdaptiveBatchCalculator'),

  // 批处理策略
  SemanticBatchStrategy: Symbol.for('SemanticBatchStrategy'),
  QdrantBatchStrategy: Symbol.for('QdrantBatchStrategy'),
  NebulaBatchStrategy: Symbol.for('NebulaBatchStrategy'),
  EmbeddingBatchStrategy: Symbol.for('EmbeddingBatchStrategy'),

  // 事件监听器
  EventListener: Symbol.for('EventListener'),

  // 批处理服务（新增的）
  GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
  VectorBatchOptimizer: Symbol.for('VectorBatchOptimizer'),
  BatchOptimizer: Symbol.for('BatchOptimizer'),

  // Nebula Graph 新增服务
  ISessionManager: Symbol.for('ISessionManager'),
  IRetryStrategy: Symbol.for('IRetryStrategy'),
  ICircuitBreaker: Symbol.for('ICircuitBreaker'),
  IQueryRunner: Symbol.for('IQueryRunner'),
  ConnectionWarmer: Symbol.for('ConnectionWarmer'),
  LoadBalancer: Symbol.for('LoadBalancer'),
  QueryPipeline: Symbol.for('QueryPipeline'),
  ParallelQueryExecutor: Symbol.for('ParallelQueryExecutor'),
  MemoryOptimizer: Symbol.for('MemoryOptimizer'),
} as const;

// 确保TYPES的类型被正确识别
export type TypesType = typeof TYPES;