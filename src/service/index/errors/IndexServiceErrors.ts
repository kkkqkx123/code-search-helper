/**
 * 统一的索引服务错误类型
 */

/**
 * 索引服务错误类型枚举
 */
export enum IndexServiceErrorType {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  
  // 项目相关错误
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_ALREADY_INDEXING = 'PROJECT_ALREADY_INDEXING',
  PROJECT_CREATION_FAILED = 'PROJECT_CREATION_FAILED',
  
  // 索引相关错误
  INDEXING_FAILED = 'INDEXING_FAILED',
  INDEXING_STOPPED = 'INDEXING_STOPPED',
  FILE_PROCESSING_FAILED = 'FILE_PROCESSING_FAILED',
  BATCH_PROCESSING_FAILED = 'BATCH_PROCESSING_FAILED',
  
  // 向量索引错误
  VECTOR_COLLECTION_CREATION_FAILED = 'VECTOR_COLLECTION_CREATION_FAILED',
  VECTOR_INDEXING_FAILED = 'VECTOR_INDEXING_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  
  // 图索引错误
  SPACE_CREATION_FAILED = 'SPACE_CREATION_FAILED',
  GRAPH_INDEXING_FAILED = 'GRAPH_INDEXING_FAILED',
  NODE_CREATION_FAILED = 'NODE_CREATION_FAILED',
  RELATIONSHIP_CREATION_FAILED = 'RELATIONSHIP_CREATION_FAILED',
  
  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  
  // 配置错误
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SERVICE_DISABLED = 'SERVICE_DISABLED'
}

/**
 * 统一的索引服务错误类
 */
export class IndexServiceError extends Error {
  public readonly type: IndexServiceErrorType;
  public readonly context?: any;
  public readonly projectId?: string;
  public readonly serviceType?: 'vector' | 'graph';

  constructor(
    type: IndexServiceErrorType,
    message: string,
    context?: any,
    projectId?: string,
    serviceType?: 'vector' | 'graph'
  ) {
    super(message);
    this.name = 'IndexServiceError';
    this.type = type;
    this.context = context;
    this.projectId = projectId;
    this.serviceType = serviceType;
  }

  /**
   * 创建项目未找到错误
   */
  static projectNotFound(projectId: string, serviceType?: 'vector' | 'graph'): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.PROJECT_NOT_FOUND,
      `Project not found: ${projectId}`,
      { projectId },
      projectId,
      serviceType
    );
  }

  /**
   * 创建项目正在索引错误
   */
  static projectAlreadyIndexing(projectId: string, serviceType?: 'vector' | 'graph'): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.PROJECT_ALREADY_INDEXING,
      `Project already being indexed: ${projectId}`,
      { projectId },
      projectId,
      serviceType
    );
  }

  /**
   * 创建索引失败错误
   */
  static indexingFailed(
    message: string,
    projectId?: string,
    serviceType?: 'vector' | 'graph',
    context?: any
  ): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.INDEXING_FAILED,
      message,
      context,
      projectId,
      serviceType
    );
  }

  /**
   * 创建文件处理失败错误
   */
  static fileProcessingFailed(
    filePath: string,
    error: Error,
    projectId?: string,
    serviceType?: 'vector' | 'graph'
  ): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.FILE_PROCESSING_FAILED,
      `Failed to process file: ${filePath}`,
      { filePath, originalError: error.message },
      projectId,
      serviceType
    );
  }

  /**
   * 创建批处理失败错误
   */
  static batchProcessingFailed(
    message: string,
    projectId?: string,
    serviceType?: 'vector' | 'graph',
    context?: any
  ): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.BATCH_PROCESSING_FAILED,
      message,
      context,
      projectId,
      serviceType
    );
  }

  /**
   * 创建连接失败错误
   */
  static connectionFailed(
    service: string,
    projectId?: string,
    serviceType?: 'vector' | 'graph'
  ): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.CONNECTION_FAILED,
      `Failed to connect to ${service}`,
      { service },
      projectId,
      serviceType
    );
  }

  /**
   * 创建服务被禁用错误
   */
  static serviceDisabled(
    serviceName: string,
    projectId?: string,
    serviceType?: 'vector' | 'graph'
  ): IndexServiceError {
    return new IndexServiceError(
      IndexServiceErrorType.SERVICE_DISABLED,
      `${serviceName} is disabled`,
      { serviceName },
      projectId,
      serviceType
    );
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): any {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      projectId: this.projectId,
      serviceType: this.serviceType,
      stack: this.stack
    };
  }
}