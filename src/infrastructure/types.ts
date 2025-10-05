export enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula',
  VECTOR = 'vector',
  GRAPH = 'graph'
}

export interface DatabaseConnection {
  // 数据库连接的通用接口
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface PoolStatus {
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  maxConnections: number;
}

export interface TransactionStatus {
  state: 'active' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  participants: Map<DatabaseType, boolean>;
  timestamp: number;
}