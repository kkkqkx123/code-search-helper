export const TYPES = {
  // 通用服务
  ConfigService: Symbol.for('ConfigService'),
  DatabaseLoggerService: Symbol.for('DatabaseLoggerService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  
  // 配置服务
  NebulaConfigService: Symbol.for('NebulaConfigService'),
  QdrantConfigService: Symbol.for('QdrantConfigService'),
  
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
  UniversalTextSplitter: Symbol.for('UniversalTextSplitter'),
  ErrorThresholdManager: Symbol.for('ErrorThresholdManager'),
  MemoryGuard: Symbol.for('MemoryGuard'),
  BackupFileProcessor: Symbol.for('BackupFileProcessor'),
  ExtensionlessFileProcessor: Symbol.for('ExtensionlessFileProcessor'),
  ProcessingGuard: Symbol.for('ProcessingGuard'),
  
  // 新增的索引服务
  VectorIndexService: Symbol.for('VectorIndexService'),
  GraphIndexService: Symbol.for('GraphIndexService'),
  StorageCoordinatorService: Symbol.for('StorageCoordinatorService'),
  
  // 共享服务
  FileTraversalService: Symbol.for('FileTraversalService'),
  ConcurrencyService: Symbol.for('ConcurrencyService'),
  
  // 适配器服务
  IndexAdapterService: Symbol.for('IndexAdapterService'),
};