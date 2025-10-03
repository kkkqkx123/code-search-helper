import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { DatabaseEventListener } from '../common/DatabaseEventTypes';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';

// 导入Nebula Graph客户端库
const { createClient } = require('@nebula-contrib/nebula-nodejs');

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]>;
  createNode(node: { label: string; properties: Record<string, any> }): Promise<string>;
  createRelationship(relationship: {
    type: string;
    sourceId: string;
    targetId: string;
    properties?: Record<string, any>;
  }): Promise<void>;
  findNodesByLabel(label: string, properties?: Record<string, any>): Promise<any[]>;
  findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]>;
  getDatabaseStats(): Promise<any>;
  isConnectedToDatabase(): boolean;
}

@injectable()
export class NebulaConnectionManager implements INebulaConnectionManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private nebulaConfigService: NebulaConfigService;
  private connectionStatus: NebulaConnectionStatus;
  private config: NebulaConfig;
  private client: any; // Nebula Graph客户端实例
  private session: any; // Nebula Graph会话实例
  private sessionPool: any[] = []; // 会话池
  private maxPoolSize: number; // 最大会话池大小
  private eventListeners: Map<string, DatabaseEventListener[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaConfigService = nebulaConfigService;
    this.connectionStatus = {
      connected: false,
      host: '',
      port: 0,
      username: '',
    };

    // 使用NebulaConfigService加载配置
    this.config = this.nebulaConfigService.loadConfig();
    this.connectionStatus.host = this.config.host;
    this.connectionStatus.port = this.config.port;
    this.connectionStatus.username = this.config.username;
    
    // 使用配置中的maxConnections作为maxPoolSize，如果没有配置则使用默认值10
    this.maxPoolSize = this.config.maxConnections || 10;
  }

  async connect(): Promise<boolean> {
    try {
      // 重新加载配置以确保获取最新配置
      this.config = this.nebulaConfigService.loadConfig();
      this.connectionStatus.host = this.config.host;
      this.connectionStatus.port = this.config.port;
      this.connectionStatus.username = this.config.username;
      
      // 如果配置中有maxConnections，则使用它作为maxPoolSize
      if (this.config.maxConnections) {
        this.maxPoolSize = this.config.maxConnections;
      }

      this.logger.info('Connecting to Nebula Graph', {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        space: this.config.space,
        timeout: this.config.timeout,
        maxConnections: this.config.maxConnections,
        retryAttempts: this.config.retryAttempts,
        retryDelay: this.config.retryDelay
      });

      // 创建Nebula Graph客户端
      this.client = createClient({
        servers: [`${this.config.host}:${this.config.port}`],
        userName: this.config.username,
        password: this.config.password,
        space: this.config.space,
        poolSize: this.maxPoolSize, // 使用配置中的最大连接数
        bufferSize: this.config.bufferSize || 10, // 使用配置中的缓冲区大小
        executeTimeout: this.config.timeout || 30000, // 使用配置中的超时时间
        pingInterval: this.config.pingInterval || 3000   // 使用配置中的ping间隔
      });


      // 初始化会话池
      await this.initializeSessionPool();

      // 设置连接状态
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.space = this.config.space;

      this.logger.info('Successfully connected to Nebula Graph');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.connectionStatus.connected = false;
      this.connectionStatus.error = errorMessage;

      this.errorHandler.handleError(
        new Error(`Failed to connect to Nebula Graph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'connect' }
      );

      return false;
    }
  }

  /**
   * 初始化会话池
   */
  private async initializeSessionPool(): Promise<void> {
    this.logger.debug('Initializing session pool', { size: this.maxPoolSize });

    let successfulSessions = 0;
    
    for (let i = 0; i < this.maxPoolSize; i++) {
      try {
        // 创建会话
        const session = this.client.getSession(this.config.username, this.config.password, false);
        
        // 验证连接是否成功
        await this.validateConnection(session);
        
        // 初始化space
        await this.initializeSpace(session, i + 1);
        
        // 会话创建成功，添加到池中
        this.sessionPool.push(session);
        successfulSessions++;
        
      } catch (error) {
        this.logger.error(`Failed to create session ${i + 1}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // 如果是第一个会话就失败，抛出异常
        if (i === 0) {
          throw new Error(`Failed to create initial session: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 检查是否至少有一个会话创建成功
    if (successfulSessions === 0) {
      throw new Error('Failed to create any sessions in the pool');
    }

    this.logger.info(`Session pool initialized with ${successfulSessions}/${this.maxPoolSize} sessions`);
  }

  /**
   * 验证连接是否成功
   */
  private async validateConnection(session: any): Promise<void> {
    try {
      // 执行简单查询验证连接
      const result = await session.execute('SHOW HOSTS');
      
      if (!result || result.code !== 0) {
        throw new Error(`Connection validation failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      throw new Error(`Connection validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 初始化space
   */
  private async initializeSpace(session: any, sessionIndex: number): Promise<void> {
    if (!this.config.space) {
      return; // 如果没有配置space，则跳过
    }

    try {
      // 尝试切换到指定的space
      await session.execute(`USE ${this.config.space}`);
      this.logger.debug(`Session ${sessionIndex} using existing space: ${this.config.space}`);
    } catch (error) {
      // Space不存在，尝试创建
      try {
        this.logger.debug(`Attempting to create space for session ${sessionIndex}: ${this.config.space}`);
        
        // 检查space是否已经存在
        const spaceExists = await this.checkSpaceExists(session);
        
        if (!spaceExists) {
          await this.createSpace(session, this.config.space);
          this.logger.info(`Created new space for session ${sessionIndex}: ${this.config.space}`);
        } else {
          this.logger.info(`Space already exists for session ${sessionIndex}: ${this.config.space}`);
        }
        
        // 切换到指定的space
        await session.execute(`USE ${this.config.space}`);
        this.logger.debug(`Session ${sessionIndex} using space: ${this.config.space}`);
        
      } catch (createError) {
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        this.logger.error(`Failed to create/use space for session ${sessionIndex}: ${this.config.space}`, {
          error: errorMessage,
          errorCode: (createError as any)?.errno,
          space: this.config.space
        });
        
        // 即使space创建失败，也保留会话，但记录问题
        this.logger.warn(`Session ${sessionIndex} initialized but space operations failed`);
      }
    }
  }

  /**
   * 检查space是否存在
   */
  private async checkSpaceExists(session: any): Promise<boolean> {
    try {
      const spacesResult = await session.execute('SHOW SPACES');
      const spaces = spacesResult?.data || [];
      return spaces.some((space: any) => space.Name === this.config.space);
    } catch (error) {
      this.logger.error('Failed to check if space exists', {
        error: error instanceof Error ? error.message : String(error),
        space: this.config.space
      });
      return false;
    }
  }

  /**
   * 创建space
   */
  private async createSpace(session: any, spaceName: string): Promise<void> {
    try {
      await session.execute(`CREATE SPACE IF NOT EXISTS ${spaceName}(partition_num=10, replica_factor=1, vid_type=fixed_string(${this.config.vidTypeLength || 128}));`);
      
      // 等待space创建完成（Nebula Graph需要时间创建）
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      
    } catch (error) {
      throw new Error(`Failed to create space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从池中获取会话
   */
  private getSessionFromPool(): any {
    if (this.sessionPool.length === 0) {
      throw new Error('No available sessions in pool');
    }
    // 从池中取出第一个可用会话
    return this.sessionPool.shift();
  }

  /**
   * 将会话返回到池中
   */
  private returnSessionToPool(session: any): void {
    if (!session) {
      return;
    }
    
    if (this.sessionPool.length < this.maxPoolSize) {
      // 检查会话是否仍然有效
      try {
        // 简单的会话有效性检查
        if (session && typeof session.execute === 'function') {
          this.sessionPool.push(session);
        } else {
          // 会话无效，释放资源
          this.releaseSession(session);
        }
      } catch (error) {
        this.logger.error('Error checking session validity', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.releaseSession(session);
      }
    } else {
      // 如果池已满，释放会话
      this.releaseSession(session);
    }
  }

  /**
   * 安全释放会话资源
   */
  private releaseSession(session: any): void {
    if (!session) {
      return;
    }
    
    try {
      if (typeof session.release === 'function') {
        session.release();
      }
    } catch (error) {
      this.logger.error('Error releasing session', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connectionStatus.connected) {
      this.logger.debug('Already disconnected from Nebula Graph');
      return;
    }

    try {
      this.logger.info('Disconnecting from Nebula Graph');

      // 释放所有池中的会话
      await this.releaseAllSessions();

      // 关闭客户端连接
      await this.closeClient();

      // 更新连接状态
      this.updateConnectionStatusAfterDisconnect();

      this.logger.info('Successfully disconnected from Nebula Graph');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to disconnect from Nebula Graph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'disconnect' }
      );
    }
  }

  /**
   * 释放所有会话
   */
  private async releaseAllSessions(): Promise<void> {
    const releasePromises = this.sessionPool.map(async (session, index) => {
      try {
        if (session && typeof session.release === 'function') {
          await session.release();
          this.logger.debug(`Session ${index + 1} released successfully`);
        }
      } catch (error) {
        this.logger.error(`Error releasing session ${index + 1} during disconnect`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(releasePromises);
    this.sessionPool = [];
  }

  /**
   * 关闭客户端连接
   */
  private async closeClient(): Promise<void> {
    if (this.client) {
      try {
        if (typeof this.client.close === 'function') {
          await this.client.close();
          this.logger.debug('Client closed successfully');
        }
      } catch (error) {
        this.logger.error('Error closing client', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.client = null;
      }
    }
  }

  /**
   * 更新断开连接后的状态
   */
  private updateConnectionStatusAfterDisconnect(): void {
    this.connectionStatus.connected = false;
    this.connectionStatus.space = undefined;
  }

  isConnected(): boolean {
    // 检查连接状态和会话池
    if (!this.connectionStatus.connected || this.sessionPool.length === 0) {
      return false;
    }
    
    // 检查客户端是否存在
    if (!this.client) {
      return false;
    }
    
    return true;
  }

  getConnectionStatus(): NebulaConnectionStatus {
    return { ...this.connectionStatus };
  }

  async executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    // 验证连接状态
    if (!this.isConnected()) {
      const errorResult: NebulaQueryResult = {
        table: {},
        results: [],
        rows: [],
        data: [],
        error: 'Not connected to Nebula Graph',
        executionTime: 0,
        timeCost: 0,
        space: this.config.space,
      };
      return errorResult;
    }

    // 验证查询参数
    if (!nGQL || typeof nGQL !== 'string' || nGQL.trim() === '') {
      const errorResult: NebulaQueryResult = {
        table: {},
        results: [],
        rows: [],
        data: [],
        error: 'Invalid query: Query string is empty or invalid',
        executionTime: 0,
        timeCost: 0,
        space: this.config.space,
      };
      return errorResult;
    }

    let session: any;
    try {
      // 从池中获取会话
      session = this.getSessionFromPool();
      
      this.logger.debug('Executing Nebula query', {
        query: nGQL.substring(0, 100) + (nGQL.length > 100 ? '...' : ''),
        hasParameters: !!parameters && Object.keys(parameters).length > 0
      });

      const startTime = Date.now();

      // 执行查询 - Nebula Graph客户端库不支持参数化查询，需要手动处理参数
      const finalQuery = this.prepareQuery(nGQL, parameters);
      const result = await session.execute(finalQuery);

      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult = this.formatQueryResult(result, executionTime);

      this.logger.debug('Query executed successfully', {
        executionTime,
        hasData: !!(nebulaResult.data && nebulaResult.data.length > 0)
      });
      
      return nebulaResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.errorHandler.handleError(
        new Error(`Failed to execute Nebula query: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'executeQuery',
          query: nGQL,
          parameters
        }
      );

      const errorResult: NebulaQueryResult = {
        table: {},
        results: [],
        rows: [],
        data: [],
        error: errorMessage,
        executionTime: 0,
        timeCost: 0,
        space: this.config.space,
      };
      
      return errorResult;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  /**
   * 准备查询语句，处理参数插值
   */
  private prepareQuery(nGQL: string, parameters?: Record<string, any>): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return nGQL;
    }
    
    return this.interpolateParameters(nGQL, parameters);
  }

  /**
   * 格式化查询结果
   */
  private formatQueryResult(result: any, executionTime: number): NebulaQueryResult {
    return {
      table: result?.table || {},
      results: result?.results || [],
      rows: result?.rows || [],
      data: result?.data || [],
      executionTime,
      timeCost: result?.timeCost || 0,
      space: this.config.space,
      error: result?.error || undefined
    };
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Executing Nebula batch queries (no true transaction support)', { queryCount: queries.length });

      const startTime = Date.now();
      const results: NebulaQueryResult[] = [];

      // 执行所有查询（不使用事务，因为nGQL不支持）
      for (const { query, params } of queries) {
        let finalQuery = query;
        if (params && Object.keys(params).length > 0) {
          finalQuery = this.interpolateParameters(query, params);
        }
        
        const result = await session.execute(finalQuery);
        // 返回完整的NebulaQueryResult对象
        const nebulaResult: NebulaQueryResult = {
          table: result?.table || {},
          results: result?.results || [],
          rows: result?.rows || [],
          data: result?.data || [],
          executionTime: 0, // 批量查询时单独计算每个查询的执行时间不太实际
          timeCost: result?.timeCost || 0,
          space: this.config.space,
        };
        results.push(nebulaResult);
      }

      const executionTime = Date.now() - startTime;
      this.logger.debug('Batch queries executed successfully', { executionTime });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute Nebula batch queries: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'executeTransaction',
          queries
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Creating node', { label: node.label, properties: node.properties });

      // 生成节点ID
      const nodeId = `${node.label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 构建插入节点的nGQL，使用安全的参数处理
      const propertyNames = Object.keys(node.properties).join(', ');
      
      let nGQL = `INSERT VERTEX ${node.label}`;
      if (propertyNames) {
        const escapedProperties = this.escapeProperties(node.properties);
        const propertyValues = Object.values(escapedProperties).map(v => `"${v}"`).join(', ');
        nGQL += `(${propertyNames}) VALUES "${nodeId}":(${propertyValues})`;
      } else {
        nGQL += `() VALUES "${nodeId}":()`;
      }

      await session.execute(nGQL);

      this.logger.debug('Node created successfully', { nodeId });
      return nodeId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to create node: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'createNode',
          node
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  async createRelationship(relationship: {
    type: string;
    sourceId: string;
    targetId: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Creating relationship', {
        type: relationship.type,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        properties: relationship.properties
      });

      // 构建插入边的nGQL，使用安全的参数处理
      let nGQL = `INSERT EDGE ${relationship.type}`;

      if (relationship.properties && Object.keys(relationship.properties).length > 0) {
        const propertyNames = Object.keys(relationship.properties).join(', ');
        const escapedProperties = this.escapeProperties(relationship.properties);
        const propertyValues = Object.values(escapedProperties).map(v => `"${v}"`).join(', ');
        nGQL += `(${propertyNames}) VALUES "${relationship.sourceId}"->"${relationship.targetId}":(${propertyValues})`;
      } else {
        nGQL += `() VALUES "${relationship.sourceId}"->"${relationship.targetId}":()`;
      }

      await session.execute(nGQL);

      this.logger.debug('Relationship created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to create relationship: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'createRelationship',
          relationship
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Finding nodes by label', { label, properties });

      // 构建查询节点的nGQL，使用安全的参数处理
      let nGQL = `MATCH (n:${label})`;

      if (properties && Object.keys(properties).length > 0) {
        const escapedProperties = this.escapeProperties(properties);
        const conditions = Object.entries(escapedProperties)
          .map(([key, value]) => `n.${key} == "${value}"`)
          .join(' AND ');
        nGQL += ` WHERE ${conditions}`;
      }

      nGQL += ' RETURN n';

      const result = await session.execute(nGQL);

      // 提取节点数据
      const nodes = result?.data || [];

      this.logger.debug('Found nodes', { count: nodes.length });
      return nodes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to find nodes: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'findNodesByLabel',
          label,
          properties
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Finding relationships', { type, properties });

      // 构建查询边的nGQL，使用安全的参数处理
      let nGQL = 'MATCH ()-[r';

      if (type) {
        nGQL += `:${type}`;
      }

      nGQL += ']->()';

      if (properties && Object.keys(properties).length > 0) {
        const escapedProperties = this.escapeProperties(properties);
        const conditions = Object.entries(escapedProperties)
          .map(([key, value]) => `r.${key} == "${value}"`)
          .join(' AND ');
        nGQL += ` WHERE ${conditions}`;
      }

      nGQL += ' RETURN r';

      const result = await session.execute(nGQL);

      // 提取关系数据
      const relationships = result?.data || [];

      this.logger.debug('Found relationships', { count: relationships.length });
      return relationships;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to find relationships: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'findRelationships',
          type,
          properties
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    let session: any;
    try {
      session = this.getSessionFromPool();
      this.logger.debug('Getting database stats');

      // 获取spaces信息（不需要切换space）
      const spacesResult = await session.execute('SHOW SPACES');
      const spaces = spacesResult?.data || [];

      // 获取当前space的标签和边类型信息
      let tags = [];
      let edgeTypes = [];
      let nodeCount = 0;
      let edgeCount = 0;

      if (this.config.space) {
        try {
          // 切换到当前space
          await session.execute(`USE ${this.config.space}`);

          // 获取当前space的标签和边类型信息
          const tagsResult = await session.execute('SHOW TAGS');
          tags = tagsResult?.data || [];

          const edgeTypesResult = await session.execute('SHOW EDGES');
          edgeTypes = edgeTypesResult?.data || [];

          // 统计节点数量 - 使用第一个字段作为标签名（Nebula返回的结构可能不同）
          for (const tag of tags) {
            try {
              // 获取标签名，可能是第一个字段的值
              const tagName = Object.values(tag)[0] || '';
              if (tagName) {
                const countResult = await session.execute(`MATCH (n:${tagName}) RETURN count(n) AS count`);
                nodeCount += countResult?.data?.[0]?.count || 0;
              }
            } catch (countError) {
              this.logger.warn(`Failed to count nodes for tag`, { tag, error: countError });
            }
          }

          // 统计边数量 - 使用第一个字段作为边类型名
          for (const edgeType of edgeTypes) {
            try {
              // 获取边类型名，可能是第一个字段的值
              const edgeTypeName = Object.values(edgeType)[0] || '';
              if (edgeTypeName) {
                const countResult = await session.execute(`MATCH ()-[r:${edgeTypeName}]->() RETURN count(r) AS count`);
                edgeCount += countResult?.data?.[0]?.count || 0;
              }
            } catch (countError) {
              this.logger.warn(`Failed to count edges for type`, { edgeType, error: countError });
            }
          }
        } catch (error) {
          this.logger.warn('Failed to get detailed counts for current space', error);
        }
      }

      return {
        version: '3.0.0',
        status: 'online',
        spaces: spaces.length,
        currentSpace: this.config.space,
        tags: tags.length,
        edgeTypes: edgeTypes.length,
        nodes: nodeCount,
        relationships: edgeCount,
        connectionInfo: {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to get database stats: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'getDatabaseStats'
        }
      );

      throw error;
    } finally {
      // 确保会话被返回到池中
      if (session) {
        this.returnSessionToPool(session);
      }
    }
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected();
  }

  /**
   * 获取当前配置
   */
  getConfig(): any {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加事件监听器
   */
  addEventListener(eventType: string, listener: DatabaseEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(eventType: string, listener: DatabaseEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
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

  /**
   * 插值参数到nGQL查询中
   */
  private interpolateParameters(nGQL: string, parameters: Record<string, any>): string {
    let interpolatedQuery = nGQL;
    
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `:${key}`;
      const escapedValue = typeof value === 'string'
        ? `"${value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}"`
        : String(value);
      
      interpolatedQuery = interpolatedQuery.replace(new RegExp(placeholder, 'g'), escapedValue);
    }
    
    return interpolatedQuery;
  }

  protected emitEvent(eventType: string, data: any, error?: Error): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const event = {
        type: eventType as any, // 我们将在运行时确保这是有效的事件类型
        timestamp: new Date(),
        source: 'nebula' as const,
        data,
        error
      };
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          this.logger.error(`Error in event listener for ${eventType}:`, err);
        }
      });
    }
  }
}