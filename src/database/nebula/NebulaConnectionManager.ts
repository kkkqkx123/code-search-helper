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
import { createClient } from '@nebula-contrib/nebula-nodejs';

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]>;
  // 空间管理相关方法，但实现简化
  executeQueryInSpace(space: string, query: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  getConnectionForSpace(space: string): Promise<any>;
  // 配置管理
  getConfig(): any;
  updateConfig(config: any): void;
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
}