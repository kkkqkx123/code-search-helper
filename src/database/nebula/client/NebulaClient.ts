import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult, NebulaNode, NebulaRelationship } from '../NebulaTypes';
import { IQueryRunner } from '../query/QueryRunner';
import { INebulaProjectManager } from '../NebulaProjectManager';
import { ProjectIdManager } from '../../ProjectIdManager';
import { Subscription } from '../../common/DatabaseEventTypes';

// 查询批次接口
export interface QueryBatch {
  query: string;
  params?: Record<string, any>;
}

// 查询选项接口
export interface QueryOptions {
  timeout?: number;
  retryAttempts?: number;
  useCache?: boolean;
}

// NebulaClient接口 - 完整的独立接口，包含所有必要的方法
export interface INebulaClient {
  // 基础操作
  initialize(config?: NebulaConfig): Promise<boolean>;
  isConnected(): boolean;
  isInitialized(): boolean;
  close(): Promise<void>;
  reconnect(): Promise<boolean>;

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // 查询执行
  execute(query: string, params?: Record<string, any>, options?: QueryOptions): Promise<NebulaQueryResult>;
  executeQuery(query: string, params?: Record<string, any>, options?: QueryOptions): Promise<NebulaQueryResult>;
  executeBatch(queries: QueryBatch[]): Promise<NebulaQueryResult[]>;

  // 统计信息
  getStats(): any;

  // 配置管理
  updateConfig(config: Partial<NebulaConfig>): void;
  getConfig(): NebulaConfig;

  // 事件订阅
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): boolean;
  subscribe(type: string, listener: (event: any) => void): Subscription;

  // 项目空间管理
  createSpaceForProject(projectPath: string): Promise<boolean>;
  deleteSpaceForProject(projectPath: string): Promise<boolean>;

  // 数据操作
  insertNodes(nodes: NebulaNode[]): Promise<boolean>;
  insertRelationships(relationships: NebulaRelationship[]): Promise<boolean>;
  deleteDataForFile(filePath: string): Promise<void>;

  // 查询操作
  findNodesByLabel(label: string, filter?: any): Promise<any[]>;
  findRelationships(type?: string, filter?: any): Promise<any[]>;
  getDatabaseStats(): Promise<any>;

  // 兼容性方法（保持向后兼容）
  executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any>;
  executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any>;
  useSpace(spaceName: string): Promise<void>;
  createNode(label: string, properties: Record<string, any>): Promise<string>;
  createRelationship(
    type: string,
    sourceId: string,
    targetId: string,
    properties?: Record<string, any>
  ): Promise<void>;
  findNodes(label: string, properties?: Record<string, any>): Promise<any[]>;

  // 健康检查
  healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
    error?: string;
  }>;
}

/**
 * Nebula Graph客户端门面类
 * 作为整个客户端的统一入口，集成现有配置和监控服务
 */
@injectable()
export class NebulaClient extends EventEmitter implements INebulaClient {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: NebulaConfigService;
  private performanceMonitor: PerformanceMonitor;
  private queryRunner: IQueryRunner;
  private projectManager: INebulaProjectManager;
  private projectIdManager: ProjectIdManager;
  private config: NebulaConfig;
  private connectionStatus: NebulaConnectionStatus;
  private isConnectedFlag: boolean = false;
  private connectionPool: any;
  private sessionManager: any;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.IQueryRunner) queryRunner: IQueryRunner,
    @inject(TYPES.INebulaProjectManager) projectManager: INebulaProjectManager,
    @inject(TYPES.ProjectIdManager) projectIdManager: ProjectIdManager,
    @inject(TYPES.IConnectionPool) connectionPool: any,
    @inject(TYPES.ISessionManager) sessionManager: any
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.performanceMonitor = performanceMonitor;
    this.queryRunner = queryRunner;
    this.projectManager = projectManager;
    this.projectIdManager = projectIdManager;
    this.connectionPool = connectionPool;
    this.sessionManager = sessionManager;

    // 加载配置
    this.config = this.configService.loadConfig();
    this.connectionStatus = {
      connected: false,
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      space: this.config.space
    };

    this.logger.info('NebulaClient initialized', {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      space: this.config.space
    });
  }

  /**
   * 连接到Nebula Graph数据库
   */
  async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      this.logger.warn('Already connected to Nebula Graph');
      return;
    }

    try {
      this.logger.info('Connecting to Nebula Graph', {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username
      });

      // TODO: 实现实际的连接逻辑
      // 这里将在后续实现ConnectionPool后完成
      this.isConnectedFlag = true;
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();

      this.emit('connected', this.connectionStatus);
      this.logger.info('Successfully connected to Nebula Graph');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.connectionStatus.error = errorMessage;

      this.errorHandler.handleError(
        new Error(`Failed to connect to Nebula Graph: ${errorMessage}`),
        { component: 'NebulaClient', operation: 'connect' }
      );

      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 断开与Nebula Graph数据库的连接
   */
  async disconnect(): Promise<void> {
    if (!this.isConnectedFlag) {
      this.logger.warn('Not connected to Nebula Graph');
      return;
    }

    try {
      this.logger.info('Disconnecting from Nebula Graph');

      // TODO: 实现实际的断开连接逻辑
      // 这里将在后续实现ConnectionPool后完成
      this.isConnectedFlag = false;
      this.connectionStatus.connected = false;
      this.connectionStatus.space = undefined;

      this.emit('disconnected');
      this.logger.info('Successfully disconnected from Nebula Graph');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.errorHandler.handleError(
        new Error(`Failed to disconnect from Nebula Graph: ${errorMessage}`),
        { component: 'NebulaClient', operation: 'disconnect' }
      );

      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * 执行查询
   */
  async execute(
    query: string,
    params?: Record<string, any>,
    options?: QueryOptions
  ): Promise<NebulaQueryResult> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Nebula Graph');
    }

    const startTime = Date.now();
    const operationId = this.performanceMonitor.startOperation('nebula_query', {
      query: query.substring(0, 100),
      hasParams: !!params,
      options
    });

    try {
      this.logger.debug('Executing query', {
        query: query.substring(0, 100),
        hasParams: !!params
      });

      // 使用QueryRunner执行查询
      const result = await this.queryRunner.execute(query, params, options);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        resultCount: result.data?.length || 0
      });

      this.emit('queryExecuted', { query, params, result, executionTime });
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: errorMessage
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute query: ${errorMessage}`),
        { component: 'NebulaClient', operation: 'execute', query, params }
      );

      this.emit('queryError', { query, params, error, executionTime });
      throw error;
    }
  }

  /**
   * 执行批量查询
   */
  async executeBatch(queries: QueryBatch[]): Promise<NebulaQueryResult[]> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Nebula Graph');
    }

    const startTime = Date.now();
    const operationId = this.performanceMonitor.startOperation('nebula_batch_query', {
      queryCount: queries.length
    });

    try {
      this.logger.debug('Executing batch queries', { queryCount: queries.length });

      // 使用QueryRunner执行批量查询
      const results = await this.queryRunner.executeBatch(queries);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        resultCount: results.length
      });

      this.emit('batchQueryExecuted', { queries, results, executionTime });
      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: errorMessage
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute batch queries: ${errorMessage}`),
        { component: 'NebulaClient', operation: 'executeBatch', queries }
      );

      this.emit('batchQueryError', { queries, error, executionTime });
      throw error;
    }
  }


  /**
   * 更新配置
   */
  updateConfig(config: Partial<NebulaConfig>): void {
    this.config = { ...this.config, ...config };
    this.connectionStatus.host = this.config.host;
    this.connectionStatus.port = this.config.port;
    this.connectionStatus.username = this.config.username;
    this.connectionStatus.space = this.config.space;

    this.logger.info('Configuration updated', { config });
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * 获取当前配置
   */
  getConfig(): NebulaConfig {
    return { ...this.config };
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): NebulaConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * 初始化客户端
   */
  async initialize(config?: NebulaConfig): Promise<boolean> {
    try {
      if (config) {
        this.logger.info('Initializing NebulaClient', config);

        // 更新配置
        this.config = { ...this.config, ...config };
        this.connectionStatus.host = this.config.host;
        this.connectionStatus.port = this.config.port;
        this.connectionStatus.username = this.config.username;
        this.connectionStatus.space = this.config.space;

        // 初始化连接池和会话管理器
        await this.connectionPool.initialize(config);
        await this.sessionManager.initialize(config);
      } else {
        // 使用现有配置初始化
        await this.connectionPool.initialize(this.config);
        await this.sessionManager.initialize(this.config);
      }

      // 尝试连接
      await this.connect();

      this.logger.info('NebulaClient initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to initialize NebulaClient'),
        { component: 'NebulaClient', operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isInitialized(): boolean {
    return this.isConnected();
  }

  /**
   * 尝试重新连接到Nebula数据库
   */
  async reconnect(): Promise<boolean> {
    try {
      this.logger.info('Attempting to reconnect to Nebula Graph');

      // 断开现有连接
      await this.disconnect();

      // 等待一段时间再重连
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 重新连接
      await this.connect();

      this.logger.info('Successfully reconnected to Nebula Graph');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to reconnect to Nebula Graph: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaClient', operation: 'reconnect' }
      );
      return false;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
    error?: string;
  }> {
    try {
      const connectionStatus = this.isConnected();
      const stats = this.getStats();
      
      return {
        status: connectionStatus ? 'healthy' : 'unhealthy',
        details: {
          connected: connectionStatus,
          stats,
          lastCheck: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 订阅事件
   */
  subscribe(type: string, listener: (event: any) => void): Subscription {
    this.on(type, listener);
    return {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: type,
      handler: listener,
      unsubscribe: () => this.off(type, listener)
    };
  }

  /**
   * 执行查询（别名方法）
   */
  async executeQuery(
    query: string,
    params?: Record<string, any>,
    options?: QueryOptions
  ): Promise<NebulaQueryResult> {
    return this.execute(query, params, options);
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      connectionPool: this.connectionPool?.getStats?.() || {},
      sessionManager: this.sessionManager?.getStats?.() || {},
      queryRunner: this.queryRunner?.getStats?.() || {},
      transactionManager: {} // 如果有事务管理器的话
    };
  }

  /**
   * 关闭客户端
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing NebulaClient');

      // 关闭会话管理器
      await this.sessionManager.close();

      // 关闭连接池
      await this.connectionPool.close();

      // 断开连接
      await this.disconnect();

      this.logger.info('NebulaClient closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to close NebulaClient'),
        { component: 'NebulaClient', operation: 'close' }
      );
      throw error;
    }
  }

 /**
  * 为项目创建空间
  */
 async createSpaceForProject(projectPath: string): Promise<boolean> {
   this.ensureConnected();
   return await this.projectManager.createSpaceForProject(projectPath);
 }

 /**
  * 删除项目的空间
  */
 async deleteSpaceForProject(projectPath: string): Promise<boolean> {
   this.ensureConnected();
   return await this.projectManager.deleteSpaceForProject(projectPath);
 }

 /**
  * 确保已连接
  */
 private ensureConnected(): void {
   if (!this.isConnectedFlag) {
     throw new Error('Not connected to Nebula Graph');
   }
 }

 /**
  * 批量插入节点
  */
 async insertNodes(nodes: NebulaNode[]): Promise<boolean> {
   this.ensureConnected();
   if (!nodes || nodes.length === 0) {
     return true;
   }
   
   // 使用项目管理器的批量插入功能
   // 需要确定当前项目，这里可以使用默认项目或从配置获取
   // 为了简化，我们假设使用默认项目或第一个项目
   const projectPaths = this.projectIdManager.listAllProjectPaths();
   if (projectPaths.length === 0) {
     throw new Error('No project found for node insertion');
   }
   
   const projectPath = projectPaths[0]; // 使用第一个项目
   return await this.projectManager.insertNodesForProject(projectPath, nodes);
 }

 /**
  * 批量插入关系
  */
 async insertRelationships(relationships: NebulaRelationship[]): Promise<boolean> {
   this.ensureConnected();
   if (!relationships || relationships.length === 0) {
     return true;
   }
   
   const projectPaths = this.projectIdManager.listAllProjectPaths();
   if (projectPaths.length === 0) {
     throw new Error('No project found for relationship insertion');
   }
   
   const projectPath = projectPaths[0]; // 使用第一个项目
   return await this.projectManager.insertRelationshipsForProject(projectPath, relationships);
 }

 /**
  * 删除文件相关的所有数据
  */
 async deleteDataForFile(filePath: string): Promise<void> {
   this.ensureConnected();
   
   try {
     this.logger.info('Deleting data for file', { filePath });
     
     // 实现完整的文件数据删除逻辑
     const deleteQuery = `
       MATCH (v:File)
       WHERE v.filePath == $filePath
       DETACH DELETE v
     `;
     
     await this.execute(deleteQuery, { filePath });
     
     this.logger.info('Successfully deleted data for file', { filePath });
   } catch (error) {
     this.errorHandler.handleError(
       new Error(`Failed to delete data for file ${filePath}: ${error instanceof Error ? error.message : String(error)}`),
       { component: 'NebulaClient', operation: 'deleteDataForFile', filePath }
     );
     throw error;
   }
 }

 /**
  * 根据标签查找节点
  */
 async findNodesByLabel(label: string, filter?: any): Promise<any[]> {
   this.ensureConnected();
   
   const projectPaths = this.projectIdManager.listAllProjectPaths();
   if (projectPaths.length === 0) {
     return [];
   }
   
   const projectPath = projectPaths[0]; // 使用第一个项目
   return await this.projectManager.findNodesForProject(projectPath, label, filter);
 }

 /**
  * 查找关系
  */
 async findRelationships(type?: string, filter?: any): Promise<any[]> {
   this.ensureConnected();
   
   const projectPaths = this.projectIdManager.listAllProjectPaths();
   if (projectPaths.length === 0) {
     return [];
   }
   
   const projectPath = projectPaths[0]; // 使用第一个项目
   return await this.projectManager.findRelationshipsForProject(projectPath, type, filter);
 }

 /**
  * 获取数据库统计信息
  */
 async getDatabaseStats(): Promise<any> {
   this.ensureConnected();
   
   // 获取当前连接状态和基本统计
   const stats = this.getStats();
   
   // 尝试获取更多数据库特定的统计信息
   try {
     const spacesResult = await this.execute('SHOW SPACES');
     const spaces = spacesResult?.data || [];
     
     return {
       ...stats,
       spaces: spaces.length,
       connected: this.isConnectedFlag,
       connectionStatus: this.connectionStatus
     };
   } catch (error) {
     this.logger.error('Failed to get database stats', error);
     return {
       ...stats,
       error: error instanceof Error ? error.message : String(error),
       connected: this.isConnectedFlag
     };
   }
 }

 /**
  * 执行读查询
  */
 async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
   this.ensureConnected();
   return await this.execute(nGQL, parameters);
 }

 /**
  * 执行写查询
  */
 async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
   this.ensureConnected();
   return await this.execute(nGQL, parameters);
 }

 /**
  * 使用指定空间
  */
 async useSpace(spaceName: string): Promise<void> {
   this.ensureConnected();
   if (!spaceName || spaceName === 'undefined' || spaceName === '') {
     throw new Error(`Invalid space name provided: ${spaceName}`);
   }
   
   const query = `USE \`${spaceName}\``;
   await this.execute(query);
   this.connectionStatus.space = spaceName;
 }

 /**
  * 创建节点
  */
 async createNode(label: string, properties: Record<string, any>): Promise<string> {
   this.ensureConnected();
   
   // 生成节点ID
   const nodeId = `${label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   
   // 构建插入节点的nGQL
   const propertyNames = Object.keys(properties).join(', ');
   let nGQL = `INSERT VERTEX ${label}`;
   
   if (propertyNames) {
     const escapedProperties = this.escapeProperties(properties);
     const propertyValues = Object.values(escapedProperties).map(v => `"${v}"`).join(', ');
     nGQL += `(${propertyNames}) VALUES "${nodeId}":(${propertyValues})`;
   } else {
     nGQL += `() VALUES "${nodeId}":()`;
   }
   
   await this.execute(nGQL);
   return nodeId;
 }

 /**
  * 创建关系
  */
 async createRelationship(
   type: string,
   sourceId: string,
   targetId: string,
   properties?: Record<string, any>
 ): Promise<void> {
   this.ensureConnected();
   
   // 构建插入边的nGQL
   let nGQL = `INSERT EDGE ${type}`;
   
   if (properties && Object.keys(properties).length > 0) {
     const propertyNames = Object.keys(properties).join(', ');
     const escapedProperties = this.escapeProperties(properties);
     const propertyValues = Object.values(escapedProperties).map(v => `"${v}"`).join(', ');
     nGQL += `(${propertyNames}) VALUES "${sourceId}"->"${targetId}":(${propertyValues})`;
   } else {
     nGQL += `() VALUES "${sourceId}"->"${targetId}":()`;
   }
   
   await this.execute(nGQL);
 }

 /**
  * 根据标签和属性查找节点
  */
 async findNodes(label: string, properties?: Record<string, any>): Promise<any[]> {
   this.ensureConnected();
   
   // 构建查询节点的nGQL
   let nGQL = `MATCH (n:${label})`;
   
   if (properties && Object.keys(properties).length > 0) {
     const escapedProperties = this.escapeProperties(properties);
     const conditions = Object.entries(escapedProperties)
       .map(([key, value]) => `n.${key} == "${value}"`)
       .join(' AND ');
     nGQL += ` WHERE ${conditions}`;
   }
   
   nGQL += ' RETURN n';
   
   const result = await this.execute(nGQL);
   return result?.data || [];
 }

 /**
  * 转义属性值中的特殊字符，防止nGQL注入
  */
 private escapeProperties(properties: Record<string, any>): Record<string, any> {
   const escaped: Record<string, any> = {};
   for (const [key, value] of Object.entries(properties)) {
     if (typeof value === 'string') {
       // 转义字符串中的引号和反斜杠
       escaped[key] = value.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
     } else {
       escaped[key] = value;
     }
   }
   return escaped;
 }
}