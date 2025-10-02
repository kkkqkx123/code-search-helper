import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { DatabaseEventListener } from '../common/DatabaseEventTypes';

// 导入Nebula Graph客户端库
const { NebulaGraph } = require('@nebula-contrib/nebula-nodejs');

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<any[]>;
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
  private connectionStatus: NebulaConnectionStatus;
  private config: NebulaConfig;
  private client: any; // Nebula Graph客户端实例
  private session: any; // Nebula Graph会话实例
  private eventListeners: Map<string, DatabaseEventListener[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.connectionStatus = {
      connected: false,
      host: '',
      port: 0,
      username: '',
    };

    // 初始化默认配置
    this.config = {
      host: process.env.NEBULA_HOST || 'localhost',
      port: parseInt(process.env.NEBULA_PORT || '9669'),
      username: process.env.NEBULA_USERNAME || 'root',
      password: process.env.NEBULA_PASSWORD || 'nebula',
      space: process.env.NEBULA_SPACE || 'codebase',
    };
    this.connectionStatus.host = this.config.host;
    this.connectionStatus.port = this.config.port;
    this.connectionStatus.username = this.config.username;
  }

  async connect(): Promise<boolean> {
    try {
      // 获取Nebula配置（延迟获取）
      try {
        const nebulaConfig = this.configService.get('nebula');
        if (nebulaConfig) {
          this.config = { ...this.config, ...nebulaConfig };
          this.connectionStatus.host = nebulaConfig.host;
          this.connectionStatus.port = nebulaConfig.port;
          this.connectionStatus.username = nebulaConfig.username;
        }
      } catch (configError) {
        // 如果配置未初始化，使用默认配置
        this.logger.debug('Using default Nebula configuration');
      }

      this.logger.info('Connecting to Nebula Graph', {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        space: this.config.space,
      });

      // 创建Nebula Graph客户端
      this.client = new NebulaGraph.Client({
        host: this.config.host,
        port: this.config.port,
      });

      // 建立连接并创建会话
      await this.client.connect();
      this.session = await this.client.session(this.config.username, this.config.password);

      // 设置连接状态（在切换space之前）
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.space = this.config.space;

      // 切换到指定的space（如果不存在则创建）
      if (this.config.space) {
        try {
          await this.session.execute(`USE ${this.config.space}`);
          this.logger.info(`Using existing space: ${this.config.space}`);
        } catch (error) {
          // Space不存在，尝试创建
          try {
            await this.session.execute(`CREATE SPACE IF NOT EXISTS ${this.config.space} (partition_num=10, replica_factor=1)`);
            await this.session.execute(`USE ${this.config.space}`);
            // 等待space创建完成
            // 在测试环境中跳过等待，直接继续
            if (process.env.NODE_ENV !== 'test') {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            this.logger.info(`Created new space: ${this.config.space}`);
          } catch (createError) {
            this.logger.error(`Failed to create space: ${this.config.space}`, createError);
            // 即使space创建失败，我们也已经连接上了
            this.logger.info('Successfully connected to Nebula Graph');
            return true;
          }
        }
      }

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

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Nebula Graph');

      if (this.session) {
        await this.session.release();
        this.session = null;
      }

      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      this.connectionStatus.connected = false;
      this.connectionStatus.space = undefined;

      this.logger.info('Successfully disconnected from Nebula Graph');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to disconnect from Nebula Graph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'disconnect' }
      );
    }
  }

  isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  getConnectionStatus(): NebulaConnectionStatus {
    return { ...this.connectionStatus };
  }

  async executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    if (!this.isConnected() || !this.session) {
      return {
        error: 'Not connected to Nebula Graph',
      } as NebulaQueryResult;
    }

    try {
      this.logger.debug('Executing Nebula query', { nGQL, parameters });

      const startTime = Date.now();

      // 执行查询
      const result = await this.session.execute(nGQL, parameters);

      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult: NebulaQueryResult = {
        table: result.data?.table || {},
        results: result.data?.results || [],
        rows: result.data?.rows || [],
        data: result.data?.data || [],
        executionTime,
        timeCost: result.timeCost,
        space: this.config.space,
      };

      this.logger.debug('Query executed successfully', { executionTime });
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

      return {
        error: errorMessage,
      } as NebulaQueryResult;
    }
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<any[]> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Executing Nebula transaction', { queryCount: queries.length });

      const startTime = Date.now();

      // 开始事务
      await this.session.execute('BEGIN');

      const results: any[] = [];

      try {
        // 执行事务中的所有查询
        for (const { query, params } of queries) {
          const result = await this.session.execute(query, params);
          // 只返回data字段而不是整个结果对象
          results.push(result.data || {});
        }

        // 提交事务
        await this.session.execute('COMMIT');

        const executionTime = Date.now() - startTime;
        this.logger.debug('Transaction executed successfully', { executionTime });

        return results;
      } catch (error) {
        // 回滚事务
        await this.session.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute Nebula transaction: ${errorMessage}`),
        {
          component: 'NebulaConnectionManager',
          operation: 'executeTransaction'
        }
      );

      throw error;
    }
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Creating node', { label: node.label, properties: node.properties });

      // 生成节点ID
      const nodeId = `${node.label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 构建插入节点的nGQL
      const propertyNames = Object.keys(node.properties).join(', ');
      const propertyValues = Object.values(node.properties).map(v => `"${v}"`).join(', ');

      let nGQL = `INSERT VERTEX ${node.label}`;
      if (propertyNames) {
        nGQL += `(${propertyNames}) VALUES "${nodeId}":(${propertyValues})`;
      } else {
        nGQL += `() VALUES "${nodeId}":()`;
      }

      await this.session.execute(nGQL);

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
    }
  }

  async createRelationship(relationship: {
    type: string;
    sourceId: string;
    targetId: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Creating relationship', {
        type: relationship.type,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        properties: relationship.properties
      });

      // 构建插入边的nGQL
      let nGQL = `INSERT EDGE ${relationship.type}`;

      if (relationship.properties && Object.keys(relationship.properties).length > 0) {
        const propertyNames = Object.keys(relationship.properties).join(', ');
        const propertyValues = Object.values(relationship.properties).map(v => `"${v}"`).join(', ');
        nGQL += `(${propertyNames}) VALUES "${relationship.sourceId}"->"${relationship.targetId}":(${propertyValues})`;
      } else {
        nGQL += `() VALUES "${relationship.sourceId}"->"${relationship.targetId}":()`;
      }

      await this.session.execute(nGQL);

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
    }
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Finding nodes by label', { label, properties });

      // 构建查询节点的nGQL
      let nGQL = `MATCH (n:${label})`;

      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.entries(properties)
          .map(([key, value]) => `n.${key} == "${value}"`)
          .join(' AND ');
        nGQL += ` WHERE ${conditions}`;
      }

      nGQL += ' RETURN n';

      const result = await this.session.execute(nGQL);

      // 提取节点数据
      const nodes = result.data?.data || [];

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
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Finding relationships', { type, properties });

      // 构建查询边的nGQL
      let nGQL = 'MATCH ()-[r';

      if (type) {
        nGQL += `:${type}`;
      }

      nGQL += ']->()';

      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.entries(properties)
          .map(([key, value]) => `r.${key} == "${value}"`)
          .join(' AND ');
        nGQL += ` WHERE ${conditions}`;
      }

      nGQL += ' RETURN r';

      const result = await this.session.execute(nGQL);

      // 提取关系数据
      const relationships = result.data?.data || [];

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
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.isConnected() || !this.session) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Getting database stats');

      // 获取spaces信息
      const spacesResult = await this.session.execute('SHOW SPACES');
      const spaces = spacesResult.data?.data || [];

      // 获取当前space的标签和边类型信息
      const tagsResult = await this.session.execute('SHOW TAGS');
      const tags = tagsResult.data?.data || [];

      const edgeTypesResult = await this.session.execute('SHOW EDGES');
      const edgeTypes = edgeTypesResult.data?.data || [];

      // 获取节点和边的数量统计
      let nodeCount = 0;
      let edgeCount = 0;

      if (this.config.space) {
        try {
          // 统计节点数量
          for (const tag of tags) {
            const countResult = await this.session.execute(`MATCH (n:${tag.Name}) RETURN count(n) AS count`);
            nodeCount += countResult.data?.data[0]?.count || 0;
          }

          // 统计边数量
          for (const edgeType of edgeTypes) {
            const countResult = await this.session.execute(`MATCH ()-[r:${edgeType.Name}]->() RETURN count(r) AS count`);
            edgeCount += countResult.data?.data[0]?.count || 0;
          }
        } catch (error) {
          this.logger.warn('Failed to get detailed counts', error);
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