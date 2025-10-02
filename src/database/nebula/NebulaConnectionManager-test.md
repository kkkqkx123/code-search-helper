import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { DatabaseEventListener } from '../common/DatabaseEventTypes';

// 导入Nebula Graph客户端库
const { createClient } = require('@nebula-contrib/nebula-nodejs');

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
      this.client = createClient({
        servers: [`${this.config.host}:${this.config.port}`],
        userName: this.config.username,
        password: this.config.password,
        space: this.config.space,
        poolSize: 1, // 减少连接池大小
        bufferSize: 100, // 减少缓冲区大小
        executeTimeout: 30000, // 增加超时时间到30秒
        pingInterval: 30000   // 减少ping间隔
      });

      // 调试：检查client对象的结构
      this.logger.debug('Nebula client created', {
        clientType: typeof this.client,
        clientKeys: Object.keys(this.client || {}),
        clientMethods: Object.getOwnPropertyNames(this.client || {}),
        clientHasExecute: this.client && typeof this.client.execute === 'function'
      });

      // 测试连接 - 尝试执行一个简单查询
      try {
        const testResult = await this.client.execute('SHOW HOSTS');
        this.logger.debug('Connection test successful', {
          hasData: !!testResult,
          resultType: typeof testResult
        });
      } catch (error) {
        throw new Error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // 设置连接状态
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.space = this.config.space;

      // 切换到指定的space（如果不存在则创建）
      if (this.config.space) {
        try {
          await this.client.execute(`USE ${this.config.space}`);
          this.logger.info(`Using existing space: ${this.config.space}`);
        } catch (error) {
          // Space不存在，尝试创建
          try {
            this.logger.debug(`Attempting to create space: ${this.config.space}`);
            
            // 先检查space是否已经存在
            const spacesResult = await this.client.execute('SHOW SPACES');
            const spaces = spacesResult?.data || [];
            const spaceExists = spaces.some((space: any) => space.Name === this.config.space);
            
            if (!spaceExists) {
              this.logger.debug(`Creating new space: ${this.config.space}`);
              await this.client.execute(`CREATE SPACE IF NOT EXISTS ${this.config.space}(partition_num=10, replica_factor=1, vid_type=fixed_string(30));`);
              
              // 等待space创建完成（Nebula Graph需要时间创建）
              await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
              
              this.logger.info(`Created new space: ${this.config.space}`);
            } else {
              this.logger.info(`Space already exists: ${this.config.space}`);
            }
            
            // 切换到指定的space
            await this.client.execute(`USE ${this.config.space}`);
            this.logger.info(`Using space: ${this.config.space}`);
            
          } catch (createError) {
            const errorMessage = createError instanceof Error ? createError.message : String(createError);
            this.logger.error(`Failed to create/use space: ${this.config.space}`, {
              error: errorMessage,
              errorCode: (createError as any)?.errno,
              space: this.config.space
            });
            
            // 即使space创建失败，我们也已经连接上了
            this.logger.info('Nebula Graph connection established but space operations failed');
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
    if (!this.isConnected() || !this.client) {
      return {
        error: 'Not connected to Nebula Graph',
      } as NebulaQueryResult;
    }

    try {
      this.logger.debug('Executing Nebula query', { nGQL, parameters });

      const startTime = Date.now();

      // 执行查询 - 注意：这个版本的API可能不支持参数
      const result = await this.client.execute(nGQL);

      const executionTime = Date.now() - startTime;

      // 转换结果格式 - 根据实际的返回结构进行调整
      const nebulaResult: NebulaQueryResult = {
        table: result?.table || {},
        results: result?.results || [],
        rows: result?.rows || [],
        data: result?.data || [],
        executionTime,
        timeCost: result?.timeCost || 0,
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
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Executing Nebula transaction', { queryCount: queries.length });

      const startTime = Date.now();

      // 开始事务
      await this.client.execute('BEGIN');

      const results: any[] = [];

      try {
        // 执行事务中的所有查询
        for (const { query, params } of queries) {
          const result = await this.client.execute(query);
          // 只返回data字段而不是整个结果对象
          results.push(result?.data || {});
        }

        // 提交事务
        await this.client.execute('COMMIT');

        const executionTime = Date.now() - startTime;
        this.logger.debug('Transaction executed successfully', { executionTime });

        return results;
      } catch (error) {
        // 回滚事务
        await this.client.execute('ROLLBACK');
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
    if (!this.isConnected() || !this.client) {
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

      await this.client.execute(nGQL);

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
    if (!this.isConnected() || !this.client) {
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

      await this.client.execute(nGQL);

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
    if (!this.isConnected() || !this.client) {
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

      const result = await this.client.execute(nGQL);

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
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.isConnected() || !this.client) {
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

      const result = await this.client.execute(nGQL);

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
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      this.logger.debug('Getting database stats');

      // 获取spaces信息（不需要切换space）
      const spacesResult = await this.client.execute('SHOW SPACES');
      const spaces = spacesResult?.data || [];

      // 获取当前space的标签和边类型信息
      let tags = [];
      let edgeTypes = [];
      let nodeCount = 0;
      let edgeCount = 0;

      if (this.config.space) {
        try {
          // 切换到当前space
          await this.client.execute(`USE ${this.config.space}`);
          
          // 获取当前space的标签和边类型信息
          const tagsResult = await this.client.execute('SHOW TAGS');
          tags = tagsResult?.data || [];

          const edgeTypesResult = await this.client.execute('SHOW EDGES');
          edgeTypes = edgeTypesResult?.data || [];

          // 统计节点数量 - 使用第一个字段作为标签名（Nebula返回的结构可能不同）
          for (const tag of tags) {
            try {
              // 获取标签名，可能是第一个字段的值
              const tagName = Object.values(tag)[0] || '';
              if (tagName) {
                const countResult = await this.client.execute(`MATCH (n:${tagName}) RETURN count(n) AS count`);
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
                const countResult = await this.client.execute(`MATCH ()-[r:${edgeTypeName}]->() RETURN count(r) AS count`);
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