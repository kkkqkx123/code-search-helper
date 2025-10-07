// Nebula 数据库配置类型
export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  space?: string;
  bufferSize?: number;
  pingInterval?: number;
  vidTypeLength?: number;
}

// Nebula 连接状态类型
export interface NebulaConnectionStatus {
  connected: boolean;
  host: string;
  port: number;
  username: string;
  space?: string;
  lastConnected?: Date;
  error?: string;
}

// Nebula 查询结果类型
export interface NebulaQueryResult {
  table: any;
  results: any;
  rows: any;
  data?: any[];
  error?: string;
  executionTime?: number;
  timeCost?: number;
  space?: string;
  errorCode?: any;
  errorDetails?: any;
  query?: string;
  stats?: {
    rowCount?: number;
    columnCount?: number;
    dataSize?: number;
    processedTime?: number;
  };
}

// Nebula 错误处理类型
export interface NebulaErrorContext {
  component: string;
  operation: string;
  query?: string;
  parameters?: Record<string, any>;
  retryCount?: number;
  duration?: number;
}

// Nebula 批量顶点类型
export interface BatchVertex {
  tag: string;
  id: string;
  properties: Record<string, any>;
}

// Nebula 批量边类型
export interface BatchEdge {
  type: string;
  srcId: string;
  dstId: string;
  properties: Record<string, any>;
}

// Nebula 空间信息类型
export interface NebulaSpaceInfo {
  name: string;
  partition_num: number;
  replica_factor: number;
  vid_type: string;
  charset: string;
  collate: string;
}

// Nebula 标签信息类型
export interface NebulaTagInfo {
  name: string;
  fields: Array<{
    field: string;
    type: string;
    null: string;
    default: string;
    comment: string;
  }>;
}

// Nebula 边类型信息类型
export interface NebulaEdgeInfo {
  name: string;
  fields: Array<{
    field: string;
    type: string;
    null: string;
    default: string;
    comment: string;
  }>;
}

// Nebula 节点类型
export interface NebulaNode {
  id: string;
  label: string;
  properties: Record<string, any>;
}

// Nebula 关系类型
export interface NebulaRelationship {
  id?: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, any>;
}

// 项目空间信息类型
export interface ProjectSpaceInfo {
  projectPath: string;
  spaceName: string;
  spaceInfo: NebulaSpaceInfo;
  createdAt: Date;
  updatedAt: Date;
}

// Nebula 事件类型
export enum NebulaEventType {
  CONNECTION_OPENED = 'connection_opened',
  CONNECTION_CLOSED = 'connection_closed',
  SPACE_CREATED = 'space_created',
  SPACE_DELETED = 'space_deleted',
  SPACE_UPDATED = 'space_updated',
  SPACE_ERROR = 'space_error',
  NODE_INSERTED = 'node_inserted',
  NODE_UPDATED = 'node_updated',
  NODE_DELETED = 'node_deleted',
  RELATIONSHIP_INSERTED = 'relationship_inserted',
  RELATIONSHIP_UPDATED = 'relationship_updated',
  RELATIONSHIP_DELETED = 'relationship_deleted',
  QUERY_EXECUTED = 'query_executed',
  QUERY_ERROR = 'query_error',
  ERROR_OCCURRED = 'error_occurred'
}

// Nebula 事件接口
export interface NebulaEvent {
  type: NebulaEventType;
  timestamp: Date;
  data?: any;
  error?: Error;
}