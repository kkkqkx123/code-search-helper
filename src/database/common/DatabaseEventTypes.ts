/**
 * 统一的数据库事件类型定义
 * 适用于Qdrant和Nebula数据库服务
 */

/**
 * 基础数据库事件类型
 */
export enum DatabaseEventType {
  // 连接事件
  CONNECTION_OPENED = 'connection_opened',
  CONNECTION_CLOSED = 'connection_closed',
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_ERROR = 'connection_error',
  
  // 项目空间事件
  SPACE_CREATED = 'space_created',
  SPACE_DELETED = 'space_deleted',
  SPACE_CLEARED = 'space_cleared',
  SPACE_ERROR = 'space_error',
  
  // 数据操作事件
  DATA_INSERTED = 'data_inserted',
  DATA_UPDATED = 'data_updated',
  DATA_DELETED = 'data_deleted',
  DATA_QUERIED = 'data_queried',
  DATA_ERROR = 'data_error',
  
  // 服务生命周期事件
  SERVICE_INITIALIZED = 'service_initialized',
  SERVICE_STARTED = 'service_started',
  SERVICE_STOPPED = 'service_stopped',
  SERVICE_ERROR = 'service_error',
  
  // 性能和监控事件
  PERFORMANCE_METRIC = 'performance_metric',
  QUERY_EXECUTED = 'query_executed',
  BATCH_OPERATION_COMPLETED = 'batch_operation_completed',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Qdrant特定事件类型
 */
export enum QdrantEventType {
  // 集合事件
  COLLECTION_CREATED = 'collection_created',
  COLLECTION_DELETED = 'collection_deleted',
  COLLECTION_UPDATED = 'collection_updated',
  COLLECTION_ERROR = 'collection_error',
  
  // 向量操作事件
  VECTOR_INSERTED = 'vector_inserted',
  VECTOR_UPDATED = 'vector_updated',
  VECTOR_DELETED = 'vector_deleted',
  VECTOR_SEARCHED = 'vector_searched',
  
  // 索引事件
  INDEX_CREATED = 'index_created',
  INDEX_DELETED = 'index_deleted',
  INDEX_UPDATED = 'index_updated'
}

/**
 * Nebula特定事件类型
 */
export enum NebulaEventType {
  // 空间事件
  SPACE_CREATED = 'space_created',
  SPACE_DELETED = 'space_deleted',
  SPACE_UPDATED = 'space_updated',
  SPACE_ERROR = 'space_error',
  
  // 节点和边事件
  NODE_INSERTED = 'node_inserted',
  NODE_UPDATED = 'node_updated',
  NODE_DELETED = 'node_deleted',
  RELATIONSHIP_INSERTED = 'relationship_inserted',
  RELATIONSHIP_UPDATED = 'relationship_updated',
  RELATIONSHIP_DELETED = 'relationship_deleted',
  
  // 查询事件
  QUERY_EXECUTED = 'query_executed',
  QUERY_ERROR = 'query_error'
}

/**
 * 统一的事件接口
 */
export interface DatabaseEvent {
  type: DatabaseEventType | QdrantEventType | NebulaEventType;
  timestamp: Date;
  source: 'qdrant' | 'nebula' | 'common';
  data?: any;
  error?: Error;
  metadata?: {
    projectId?: string;
    userId?: string;
    sessionId?: string;
    duration?: number;
    operation?: string;
    originalEventType?: string;
  };
}

/**
 * 事件监听器接口
 */
export interface DatabaseEventListener {
  (event: DatabaseEvent): void;
}

/**
 * 事件管理器接口
 */
export interface IEventManager {
  addEventListener(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener
  ): void;
  
  removeEventListener(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener
  ): void;
  
  emitEvent(event: DatabaseEvent): void;
  
  removeAllListeners(): void;
  getListenerCount(eventType?: DatabaseEventType | QdrantEventType | NebulaEventType): number;
}

/**
 * 事件过滤器接口
 */
export interface IEventFilter {
  filter(event: DatabaseEvent): boolean;
}

/**
 * 事件处理器接口
 */
export interface IEventHandler {
  handle(event: DatabaseEvent): Promise<void>;
}

/**
 * 性能指标事件数据
 */
export interface PerformanceMetricData {
  operation: string;
  duration: number;
  success: boolean;
  dataSize?: number;
  timestamp: Date;
}

/**
 * 查询执行事件数据
 */
export interface QueryExecutionData {
  query: string;
  parameters?: Record<string, any>;
  executionTime: number;
  resultCount?: number;
  success: boolean;
  error?: string;
}

/**
 * 批量操作事件数据
 */
export interface BatchOperationData {
  operationType: 'insert' | 'update' | 'delete';
  batchSize: number;
  success: boolean;
  failedItems?: number;
  duration: number;
}