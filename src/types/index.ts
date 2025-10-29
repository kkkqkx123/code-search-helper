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
  ProjectNamingConfigService: Symbol.for('ProjectNamingConfigService'),

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

  // 解析服务
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  ASTCodeSplitter: Symbol.for('ASTCodeSplitter'),
  ChunkToVectorCoordinationService: Symbol.for('ChunkToVectorCoordinationService'),

  // 嵌入服务
  EmbedderFactory: Symbol.for('EmbedderFactory'),

  // 项目管理
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  ProjectPathMappingService: Symbol.for('ProjectPathMappingService'),

  // Nebula-specific services
  INebulaConnectionManager: Symbol.for('INebulaConnectionManager'),
  INebulaQueryBuilder: Symbol.for('INebulaQueryBuilder'),
  INebulaSchemaManager: Symbol.for('INebulaSchemaManager'),
  INebulaIndexManager: Symbol.for('INebulaIndexManager'),
  INebulaDataOperations: Symbol.for('INebulaDataOperations'),
  INebulaQueryService: Symbol.for('INebulaQueryService'),
  INebulaTransactionService: Symbol.for('INebulaTransactionService'),
  ISpaceNameUtils: Symbol.for('ISpaceNameUtils'),

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
};