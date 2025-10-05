export const TYPES = {
  // 通用服务
  ConfigService: Symbol.for('ConfigService'),
  DatabaseLoggerService: Symbol.for('DatabaseLoggerService'),
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
};