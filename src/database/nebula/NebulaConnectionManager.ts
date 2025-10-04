import { injectable, inject } from 'inversify';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { DatabaseEventType } from '../common/DatabaseEventTypes';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { DatabaseEventListener } from '../common/DatabaseEventTypes';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';
import { ConnectionStateManager } from './ConnectionStateManager';

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
  executeQueryInSpace(space: string, query: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  getConnectionForSpace(space: string): Promise<any>;
}

@injectable()
export class NebulaConnectionManager implements INebulaConnectionManager {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private nebulaConfigService: NebulaConfigService;
  private connectionStateManager: ConnectionStateManager;
  private connectionStatus: NebulaConnectionStatus;
  private config: NebulaConfig;
  private client: any; // Nebula Graph客户端实例
  private eventListeners: Map<string, DatabaseEventListener[]> = new Map();

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
    @inject(TYPES.ConnectionStateManager) connectionStateManager: ConnectionStateManager
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaConfigService = nebulaConfigService;
    this.connectionStateManager = connectionStateManager;
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
    
    // 启动连接状态清理任务
    this.connectionStateManager.startPeriodicCleanup();
  }

  async connect(): Promise<boolean> {
    try {
      // 重新加载配置以确保获取最新配置
      this.config = this.nebulaConfigService.loadConfig();
      this.connectionStatus.host = this.config.host;
      this.connectionStatus.port = this.config.port;
      this.connectionStatus.username = this.config.username;
      
      // nebula客户端内部管理连接池，不需要手动配置

      // 使用 DatabaseLoggerService 记录连接信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_OPENED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Connecting to Nebula Graph',
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
          timeout: this.config.timeout,
          maxConnections: this.config.maxConnections,
          retryAttempts: this.config.retryAttempts,
          retryDelay: this.config.retryDelay
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log connection info:', error);
      });

      // 创建Nebula Graph客户端，但不设置默认空间，只验证连接
      const clientConfig: any = {
        servers: [`${this.config.host}:${this.config.port}`],
        userName: this.config.username,
        password: this.config.password,
        poolSize: this.config.maxConnections || 10, // nebula客户端内部管理连接池
        bufferSize: this.config.bufferSize || 10, // 使用配置中的缓冲区大小
        executeTimeout: this.config.timeout || 30000, // 使用配置中的超时时间
        pingInterval: this.config.pingInterval || 3000   // 使用配置中的ping间隔
      };

      this.client = createClient(clientConfig);

      // 针对@nebula-contrib/nebula-nodejs库，客户端自动管理连接
      // 不需要手动创建会话，直接使用客户端执行查询
      // 使用 DatabaseLoggerService 记录客户端创建信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Client created successfully, waiting for connection...' }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log client creation info:', error);
      });
      
      // 等待客户端连接就绪
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout: Client failed to connect within reasonable time'));
        }, this.config.timeout || 30000);
        
        this.client.once('authorized', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.client.once('error', (error: any) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // 使用 DatabaseLoggerService 记录客户端授权成功信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.CONNECTION_OPENED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Client connection authorized successfully' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log client authorization info:', error);
     });
      
      // 验证连接是否成功
      await this.validateConnection(this.client);
      
      // nebula客户端内部管理连接池，不需要手动管理会话
      // 使用 DatabaseLoggerService 记录客户端连接成功信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.SERVICE_INITIALIZED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Client connected successfully (nebula manages internal pool)' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log client connection info:', error);
     });

      // 设置连接状态 - 不设置特定space，因为我们没有在客户端配置中设置space
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      // 确保space字段只有在有效时才设置，否则设置为undefined
      this.connectionStatus.space = (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined;

      // 使用 DatabaseLoggerService 记录连接成功信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.CONNECTION_OPENED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Successfully connected to Nebula Graph' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log connection success info:', error);
     });
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
   * 验证连接是否成功
   */
  private async validateConnection(client: any): Promise<void> {
    try {
      // 执行简单查询验证连接
      // 使用 DatabaseLoggerService 记录连接验证信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Validating connection with SHOW SPACES query' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log connection validation info:', error);
     });
      const result = await client.execute('SHOW SPACES');
      
      // 使用 DatabaseLoggerService 记录连接验证结果
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Connection validation query result',
         hasResult: !!result,
         resultType: typeof result,
         hasCode: typeof result?.code !== 'undefined',
         code: result?.code,
         hasError: !!result?.error,
         error: result?.error,
         hasData: !!result?.data,
         dataLength: result?.data?.length
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log connection validation result:', error);
     });
      
      if (!result || (typeof result.code !== 'undefined' && result.code !== 0)) {
        throw new Error(`Connection validation failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      // 捕获并重新抛出错误，提供更明确的信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 使用 DatabaseLoggerService 记录连接验证失败信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.ERROR_OCCURRED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Connection validation failed',
         error: errorMessage,
         stack: error instanceof Error ? error.stack : undefined
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log connection validation failure:', error);
     });
      throw new Error(`Connection validation failed: ${errorMessage}`);
    }
  }

  /**
   * 初始化space - 这个方法可能不会被直接调用，因为space初始化现在在连接建立后的适当时候才执行
   */
  private async initializeSpace(session: any, sessionIndex: number): Promise<void> {
    // 检查是否有配置的space，如果有则尝试创建并使用它
    if (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') {
      const effectiveSpaceName = this.config.space;
      
      try {
        // 检查space是否已经存在
        const spaceExists = await this.checkSpaceExists(session, effectiveSpaceName);
        
        if (!spaceExists) {
          await this.createSpace(session, effectiveSpaceName);
          // 使用 DatabaseLoggerService 记录空间创建信息
         this.databaseLogger.logDatabaseEvent({
           type: DatabaseEventType.SPACE_CREATED,
           source: 'nebula',
           timestamp: new Date(),
           data: { message: `Created new space for session ${sessionIndex}: ${effectiveSpaceName}` }
         }).catch(error => {
           // 如果日志记录失败，我们不希望影响主流程
           console.error('Failed to log space creation info:', error);
         });
          
          // 等待space创建完成
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // 使用 DatabaseLoggerService 记录空间已存在信息
         this.databaseLogger.logDatabaseEvent({
           type: DatabaseEventType.SPACE_CREATED,
           source: 'nebula',
           timestamp: new Date(),
           data: { message: `Space already exists for session ${sessionIndex}: ${effectiveSpaceName}` }
         }).catch(error => {
           // 如果日志记录失败，我们不希望影响主流程
           console.error('Failed to log space existence info:', error);
         });
        }
        
        // 切换到指定的space
        await session.execute(`USE \`${effectiveSpaceName}\``);
        // 使用 DatabaseLoggerService 记录会话使用空间信息
       this.databaseLogger.logDatabaseEvent({
         type: DatabaseEventType.SPACE_CREATED,
         source: 'nebula',
         timestamp: new Date(),
         data: { message: `Session ${sessionIndex} using space: ${effectiveSpaceName}` }
       }).catch(error => {
         // 如果日志记录失败，我们不希望影响主流程
         console.error('Failed to log session space usage info:', error);
       });
        
      } catch (createError) {
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        // 使用 DatabaseLoggerService 记录空间创建/使用失败信息
       this.databaseLogger.logDatabaseEvent({
         type: DatabaseEventType.ERROR_OCCURRED,
         source: 'nebula',
         timestamp: new Date(),
         data: {
           message: `Failed to create/use space for session ${sessionIndex}: ${effectiveSpaceName}`,
           error: errorMessage,
           errorCode: (createError as any)?.errno,
           space: effectiveSpaceName
         }
       }).catch(error => {
         // 如果日志记录失败，我们不希望影响主流程
         console.error('Failed to log space creation/usage failure:', error);
       });
        
        // 即使space创建失败，也保留会话，但记录问题
        // 使用 DatabaseLoggerService 记录会话初始化警告信息
       this.databaseLogger.logDatabaseEvent({
         type: DatabaseEventType.CONNECTION_ERROR,
         source: 'nebula',
         timestamp: new Date(),
         data: { message: `Session ${sessionIndex} initialized but space operations failed` }
       }).catch(error => {
         // 如果日志记录失败，我们不希望影响主流程
         console.error('Failed to log session initialization warning:', error);
       });
      }
    } else {
      // 如果没有配置space，则不进行任何space操作，只保持连接
      // 使用 DatabaseLoggerService 记录会话初始化信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.SERVICE_INITIALIZED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: `Session ${sessionIndex} initialized without specific space` }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log session initialization info:', error);
     });
    }
  }

  /**
   * 检查space是否存在
   */
  private async checkSpaceExists(session: any, spaceName?: string): Promise<boolean> {
    // 如果没有提供spaceName，或者spaceName是undefined、空字符串或'undefined'，则返回false
    if (!spaceName || spaceName === 'undefined' || spaceName === '') {
      return false;
    }
    
    try {
      const spacesResult = await session.execute('SHOW SPACES');
      const spaces = spacesResult?.data || [];
      // 在Nebula中，space名称可能以不同字段返回，检查多个可能的字段名
      return spaces.some((space: any) => space.Name === spaceName || space.name === spaceName || Object.values(space)[0] === spaceName);
    } catch (error) {
      // 使用 DatabaseLoggerService 记录空间检查失败信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.ERROR_OCCURRED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Failed to check if space exists',
         error: error instanceof Error ? error.message : String(error),
         space: spaceName
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log space check failure:', error);
     });
      return false;
    }
  }

  /**
   * 创建space
   */
  private async createSpace(session: any, spaceName: string): Promise<void> {
    if (!spaceName || spaceName === 'undefined' || spaceName === '') {
      throw new Error(`Cannot create space with invalid name: ${spaceName}`);
    }
    
    try {
      // 使用反引号包围space名称以处理特殊字符
      await session.execute(`CREATE SPACE IF NOT EXISTS \`${spaceName}\`(partition_num=10, replica_factor=1, vid_type=fixed_string(${this.config.vidTypeLength || 128}));`);
      
      // 等待space创建完成（Nebula Graph需要时间创建）
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      
    } catch (error) {
      throw new Error(`Failed to create space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async disconnect(): Promise<void> {
    if (!this.connectionStatus.connected) {
      // 使用 DatabaseLoggerService 记录已断开连接信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.CONNECTION_CLOSED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Already disconnected from Nebula Graph' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log already disconnected info:', error);
     });
      return;
    }

    try {
      // 使用 DatabaseLoggerService 记录断开连接信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.CONNECTION_CLOSED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Disconnecting from Nebula Graph' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log disconnection info:', error);
     });

      // 关闭客户端连接
      await this.closeClient();

      // 停止连接状态管理器的定期清理任务
      this.connectionStateManager.stopPeriodicCleanup();

      // 更新连接状态
      this.updateConnectionStatusAfterDisconnect();

      // 重置连接状态管理器中的主连接状态
      this.connectionStateManager.removeConnection('nebula-client-main');

      // 使用 DatabaseLoggerService 记录成功断开连接信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.CONNECTION_CLOSED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Successfully disconnected from Nebula Graph' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log successful disconnection info:', error);
     });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to disconnect from Nebula Graph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'disconnect' }
      );
    }
  }


  /**
   * 关闭客户端连接
   */
  private async closeClient(): Promise<void> {
    if (this.client) {
      try {
        if (typeof this.client.close === 'function') {
          await this.client.close();
          // 使用 DatabaseLoggerService 记录客户端关闭成功信息
         this.databaseLogger.logDatabaseEvent({
           type: DatabaseEventType.SERVICE_INITIALIZED,
           source: 'nebula',
           timestamp: new Date(),
           data: { message: 'Client closed successfully' }
         }).catch(error => {
           // 如果日志记录失败，我们不希望影响主流程
           console.error('Failed to log client closure success:', error);
         });
        }
      } catch (error) {
        // 使用 DatabaseLoggerService 记录客户端关闭错误信息
       this.databaseLogger.logDatabaseEvent({
         type: DatabaseEventType.ERROR_OCCURRED,
         source: 'nebula',
         timestamp: new Date(),
         data: {
           message: 'Error closing client',
           error: error instanceof Error ? error.message : String(error)
         }
       }).catch(error => {
         // 如果日志记录失败，我们不希望影响主流程
         console.error('Failed to log client closure error:', error);
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
    // 检查连接状态
    if (!this.connectionStatus.connected) {
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

  /**
   * 获取指定空间的连接
   * 优先获取已经处于目标空间的连接，如果没有，则获取任意连接并切换空间
   */
  async getConnectionForSpace(space: string) {
    // 验证空间名称的有效性
    if (!space || space === 'undefined' || space === '') {
      throw new Error(`Cannot get connection for invalid space: ${space}`);
    }
    
    // 检查连接状态
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    // 获取已经处于目标空间的连接ID列表
    const availableConnections = this.connectionStateManager.getConnectionsForSpace(space);
    
    // 由于我们只使用一个客户端连接，检查主连接是否已经在目标空间
    const mainConnectionSpace = this.connectionStateManager.getConnectionSpace('nebula-client-main');
    if (mainConnectionSpace === space) {
      return this.client; // 返回当前客户端，因为它已经处于目标空间
    }
    
    // 如果主连接不在目标空间，我们需要切换它
    // 为简单起见，使用当前客户端连接并切换到目标空间
    const useQueryResult = await this.executeQuery(`USE \`${space}\``);
    
    // 检查USE命令是否成功执行
    if (useQueryResult.error) {
      throw new Error(`Failed to switch to space ${space}: ${useQueryResult.error}`);
    }
    
    this.connectionStateManager.updateConnectionSpace('nebula-client-main', space);
    
    return this.client;
  }

  /**
   * 在指定空间中执行查询
   * 优化执行查询的性能，首先检查连接当前是否已在目标空间中
   */
  async executeQueryInSpace(space: string, query: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    // 验证空间名称的有效性
    if (!space || space === 'undefined' || space === '') {
      throw new Error(`Cannot execute query in invalid space: ${space}`);
    }
    
    // 检查连接状态
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    // 获取当前连接的空间状态
    const currentSpace = this.connectionStateManager.getConnectionSpace('nebula-client-main');

    // 如果当前连接已经在目标空间，则直接执行查询
    if (currentSpace === space) {
      return await this.executeQuery(query, parameters);
    }

    // 否则，首先切换到目标空间
    const useQueryResult = await this.executeQuery(`USE \`${space}\``);
    
    // 检查USE命令是否成功执行
    if (useQueryResult.error) {
      throw new Error(`Failed to switch to space ${space}: ${useQueryResult.error}`);
    }
    
    // 更新连接状态管理器中的连接空间状态
    this.connectionStateManager.updateConnectionSpace('nebula-client-main', space);

    // 然后执行原始查询
    return await this.executeQuery(query, parameters);
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
        space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
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
        space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
      };
      return errorResult;
    }

    try {
      // 获取客户端实例（不使用会话池，因为客户端内部管理连接）
      const client = this.client;
      
      // 检查是否是USE命令来更新空间状态
      const trimmedQuery = nGQL.trim();
      if (trimmedQuery.toUpperCase().startsWith('USE ')) {
        const match = trimmedQuery.match(/USE\s+`?([^\s`]+)/i);
        if (match && match[1]) {
          const spaceName = match[1];
          if (spaceName && spaceName !== 'undefined' && spaceName !== '') {
            // 更新连接状态管理器中的连接空间状态
            // 使用一个虚拟的连接ID，因为我们只有一个客户端连接
            this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
          }
        }
      }
      
      // 在执行USE命令时，检查是否试图使用无效的space
      if (nGQL.trim().toUpperCase().startsWith('USE ') && nGQL.includes('undefined')) {
        throw new Error(`Cannot execute query: invalid space name "${nGQL}" contains "undefined"`);
      }
      
      // 使用 DatabaseLoggerService 记录查询执行信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Executing Nebula query',
         query: nGQL.substring(0, 100) + (nGQL.length > 100 ? '...' : ''),
         hasParameters: !!parameters && Object.keys(parameters).length > 0,
         clientAvailable: !!client,
         clientType: typeof client,
         clientMethods: client ? Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter(name => typeof client[name] === 'function') : []
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log query execution info:', error);
     });

      const startTime = Date.now();

      // 执行查询 - Nebula Graph客户端库不支持参数化查询，需要手动处理参数
      const finalQuery = this.prepareQuery(nGQL, parameters);
      // 使用 DatabaseLoggerService 记录准备查询信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Prepared query for execution',
         originalQuery: nGQL,
         preparedQuery: finalQuery,
         parameters
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log prepared query info:', error);
     });
      
      const result = await client.execute(finalQuery);
      
      // 使用 DatabaseLoggerService 记录原始查询结果
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Raw query result from Nebula',
         hasResult: !!result,
         resultType: typeof result,
         hasTable: !!result?.table,
         hasResults: !!result?.results,
         hasRows: !!result?.rows,
         hasData: !!result?.data,
         dataSize: result?.data?.length,
         hasError: !!result?.error,
         error: result?.error,
         hasCode: typeof result?.code !== 'undefined',
         code: result?.code,
         hasTimeCost: typeof result?.timeCost !== 'undefined',
         timeCost: result?.timeCost
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log raw query result:', error);
     });

      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult = this.formatQueryResult(result, executionTime);

      // 使用 DatabaseLoggerService 记录格式化查询结果
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Formatted query result',
         executionTime,
         hasData: !!(nebulaResult.data && nebulaResult.data.length > 0),
         dataSize: nebulaResult.data?.length,
         hasError: !!nebulaResult.error,
         error: nebulaResult.error
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log formatted query result:', error);
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
        space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
      };
      
      return errorResult;
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
      space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
      error: result?.error || undefined
    };
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录批处理查询执行信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Executing Nebula batch queries (no true transaction support)',
         queryCount: queries.length
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log batch query execution info:', error);
     });

      const startTime = Date.now();
      const results: NebulaQueryResult[] = [];

      // 执行所有查询（不使用事务，因为nGQL不支持）
      for (const { query, params } of queries) {
        let finalQuery = query;
        if (params && Object.keys(params).length > 0) {
          finalQuery = this.interpolateParameters(query, params);
        }
        
        const result = await client.execute(finalQuery);
        // 返回完整的NebulaQueryResult对象
        const nebulaResult: NebulaQueryResult = {
          table: result?.table || {},
          results: result?.results || [],
          rows: result?.rows || [],
          data: result?.data || [],
          executionTime: 0, // 批量查询时单独计算每个查询的执行时间不太实际
          timeCost: result?.timeCost || 0,
          space: (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined,
        };
        results.push(nebulaResult);
      }

      const executionTime = Date.now() - startTime;
      // 使用 DatabaseLoggerService 记录批处理查询成功执行信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.QUERY_EXECUTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Batch queries executed successfully',
         executionTime
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log batch query success info:', error);
     });

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
    }
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录节点创建信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_INSERTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Creating node',
         label: node.label,
         properties: node.properties
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log node creation info:', error);
     });

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

      await client.execute(nGQL);

      // 使用 DatabaseLoggerService 记录节点创建成功信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_INSERTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Node created successfully',
         nodeId
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log node creation success:', error);
     });
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
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录关系创建信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_INSERTED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Creating relationship',
         type: relationship.type,
         sourceId: relationship.sourceId,
         targetId: relationship.targetId,
         properties: relationship.properties
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log relationship creation info:', error);
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

      await client.execute(nGQL);

      // 使用 DatabaseLoggerService 记录关系创建成功信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_INSERTED,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Relationship created successfully' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log relationship creation success:', error);
     });
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
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录按标签查找节点信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_QUERIED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Finding nodes by label',
         label,
         properties
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log node search info:', error);
     });

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

      const result = await client.execute(nGQL);

      // 提取节点数据
      const nodes = result?.data || [];

      // 使用 DatabaseLoggerService 记录找到的节点信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_QUERIED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Found nodes',
         count: nodes.length
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log found nodes info:', error);
     });
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
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录查找关系信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_QUERIED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Finding relationships',
         type,
         properties
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log relationship search info:', error);
     });

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

      const result = await client.execute(nGQL);

      // 提取关系数据
      const relationships = result?.data || [];

      // 使用 DatabaseLoggerService 记录找到的关系信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.DATA_QUERIED,
       source: 'nebula',
       timestamp: new Date(),
       data: {
         message: 'Found relationships',
         count: relationships.length
       }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log found relationships info:', error);
     });
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
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      // 使用 DatabaseLoggerService 记录获取数据库统计信息
     this.databaseLogger.logDatabaseEvent({
       type: DatabaseEventType.PERFORMANCE_METRIC,
       source: 'nebula',
       timestamp: new Date(),
       data: { message: 'Getting database stats' }
     }).catch(error => {
       // 如果日志记录失败，我们不希望影响主流程
       console.error('Failed to log database stats info:', error);
     });

      // 获取spaces信息（不需要切换space）
      const spacesResult = await client.execute('SHOW SPACES');
      const spaces = spacesResult?.data || [];
      
      // 获取当前space的标签和边类型信息
      let tags = [];
      let edgeTypes = [];
      let nodeCount = 0;
      let edgeCount = 0;

      const effectiveSpace = (this.config.space && this.config.space !== 'undefined' && this.config.space !== '') ? this.config.space : undefined;
      
      if (effectiveSpace) {  // 只对有效space执行详细统计
        try {
          // 首先确保连接到有效的space，而不是"undefined"或空字符串
          await client.execute(`USE \`${effectiveSpace}\``);

          // 获取当前space的标签和边类型信息
          const tagsResult = await client.execute('SHOW TAGS');
          tags = tagsResult?.data || [];

          const edgeTypesResult = await client.execute('SHOW EDGES');
          edgeTypes = edgeTypesResult?.data || [];

          // 统计节点数量 - 使用第一个字段作为标签名（Nebula返回的结构可能不同）
          for (const tag of tags) {
            try {
              // 获取标签名，可能是第一个字段的值
              const tagName = Object.values(tag)[0] || '';
              if (tagName) {
                const countResult = await client.execute(`MATCH (n:${tagName}) RETURN count(n) AS count`);
                nodeCount += countResult?.data?.[0]?.count || 0;
              }
            } catch (countError) {
              // 使用 DatabaseLoggerService 记录节点计数失败警告
             this.databaseLogger.logDatabaseEvent({
               type: DatabaseEventType.CONNECTION_ERROR,
               source: 'nebula',
               timestamp: new Date(),
               data: {
                 message: `Failed to count nodes for tag`,
                 tag,
                 error: countError
               }
             }).catch(error => {
               // 如果日志记录失败，我们不希望影响主流程
               console.error('Failed to log node count failure:', error);
             });
            }
          }

          // 统计边数量 - 使用第一个字段作为边类型名
          for (const edgeType of edgeTypes) {
            try {
              // 获取边类型名，可能是第一个字段的值
              const edgeTypeName = Object.values(edgeType)[0] || '';
              if (edgeTypeName) {
                const countResult = await client.execute(`MATCH ()-[r:${edgeTypeName}]->() RETURN count(r) AS count`);
                edgeCount += countResult?.data?.[0]?.count || 0;
              }
            } catch (countError) {
              // 使用 DatabaseLoggerService 记录边计数失败警告
             this.databaseLogger.logDatabaseEvent({
               type: DatabaseEventType.CONNECTION_ERROR,
               source: 'nebula',
               timestamp: new Date(),
               data: {
                 message: `Failed to count edges for type`,
                 edgeType,
                 error: countError
               }
             }).catch(error => {
               // 如果日志记录失败，我们不希望影响主流程
               console.error('Failed to log edge count failure:', error);
             });
            }
          }
        } catch (error) {
          // 使用 DatabaseLoggerService 记录获取详细计数失败警告
         this.databaseLogger.logDatabaseEvent({
           type: DatabaseEventType.CONNECTION_ERROR,
           source: 'nebula',
           timestamp: new Date(),
           data: {
             message: 'Failed to get detailed counts for current space',
             error: error instanceof Error ? error.message : String(error),
             space: effectiveSpace
           }
         }).catch(error => {
           // 如果日志记录失败，我们不希望影响主流程
           console.error('Failed to log detailed count failure:', error);
         });
        }
      } else {
        // 使用 DatabaseLoggerService 记录无有效空间配置信息
       this.databaseLogger.logDatabaseEvent({
         type: DatabaseEventType.SERVICE_INITIALIZED,
         source: 'nebula',
         timestamp: new Date(),
         data: { message: 'No effective space configured, skipping space-specific stats' }
       }).catch(error => {
         // 如果日志记录失败，我们不希望影响主流程
         console.error('Failed to log no space config info:', error);
       });
      }

      return {
        version: '3.0.0',
        status: 'online',
        spaces: spaces.length,
        currentSpace: effectiveSpace || null, // 使用null而不是undefined以明确表示无space的状态
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
          // 使用 DatabaseLoggerService 记录事件监听器错误
         this.databaseLogger.logDatabaseEvent({
           type: DatabaseEventType.ERROR_OCCURRED,
           source: 'nebula',
           timestamp: new Date(),
           data: {
             message: `Error in event listener for ${eventType}:`,
             error: err
           }
         }).catch(error => {
           // 如果日志记录失败，我们不希望影响主流程
           console.error('Failed to log event listener error:', error);
         });
        }
      });
    }
  }
}