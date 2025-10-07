import { injectable, inject } from 'inversify';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { DatabaseEventType } from '../common/DatabaseEventTypes';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';
import { ConnectionStateManager } from './ConnectionStateManager';
import { NebulaQueryUtils } from './NebulaQueryUtils';
import { NebulaResultFormatter } from './NebulaResultFormatter';
import { EventListener } from '../../types';
import { NebulaEventManager } from './NebulaEventManager';

// 导入Nebula Graph客户端库
import { createClient } from '@nebula-contrib/nebula-nodejs';

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]>;
  // 空间连接管理
  getConnectionForSpace(spaceName: string): Promise<any>;
  // 配置管理
  getConfig(): NebulaConfig;
  updateConfig(config: Partial<NebulaConfig>): void;
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
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private eventManager: NebulaEventManager;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
    @inject(TYPES.ConnectionStateManager) connectionStateManager: ConnectionStateManager,
    @inject(TYPES.NebulaEventManager) eventManager: NebulaEventManager
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaConfigService = nebulaConfigService;
    this.connectionStateManager = connectionStateManager;
    this.eventManager = eventManager;
    this.connectionStatus = {
      connected: false,
      host: '',
      port: 0,
      username: '',
    };

    // 使用NebulaConfigService加载配置
    this.config = this.nebulaConfigService.loadConfig();
    this.updateConnectionStatusFromConfig();
    
    // 启动连接状态清理任务
    this.connectionStateManager.startPeriodicCleanup();
    
    // 启动会话清理任务
    this.startSessionCleanupTask();
  }

  /**
   * 从配置更新连接状态
   */
  private updateConnectionStatusFromConfig(): void {
    this.connectionStatus.host = this.config.host;
    this.connectionStatus.port = this.config.port;
    this.connectionStatus.username = this.config.username;
    this.connectionStatus.space = this.getValidSpace(this.config.space);
  }

  /**
   * 获取有效的space名称
   */
  private getValidSpace(space?: string): string | undefined {
    return (space && space !== 'undefined' && space !== '') ? space : undefined;
  }

  async connect(): Promise<boolean> {
    const maxRetries = this.config.retryAttempts || 3;
    const retryDelay = this.config.retryDelay || 3000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 重新加载配置以确保获取最新配置
        this.config = this.nebulaConfigService.loadConfig();
        this.updateConnectionStatusFromConfig();
        
        // nebula客户端内部管理连接池，不需要手动配置

        // 使用 DatabaseLoggerService 记录连接信息
        await this.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_OPENED,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: `Connecting to Nebula Graph (attempt ${attempt + 1}/${maxRetries + 1})`,
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            space: this.connectionStatus.space,
            timeout: this.config.timeout,
            maxConnections: this.config.maxConnections,
            retryAttempts: this.config.retryAttempts,
            retryDelay: this.config.retryDelay
          }
        });

        // 创建Nebula Graph客户端配置
        const clientConfig: any = {
          servers: [`${this.config.host}:${this.config.port}`],
          userName: this.config.username,
          password: this.config.password,
          poolSize: this.config.maxConnections || 10, // nebula客户端内部管理连接池
          bufferSize: this.config.bufferSize || 10, // 使用配置中的缓冲区大小
          executeTimeout: this.config.timeout || 30000, // 使用配置中的超时时间
          pingInterval: this.config.pingInterval || 3000   // 使用配置中的ping间隔
        };
        
        // 只有在配置了有效空间时才设置space参数
        const validSpace = this.getValidSpace(this.config.space);
        if (validSpace) {
          clientConfig.space = validSpace;
        }

        // 如果已有客户端，先关闭它
        if (this.client) {
          await this.closeClient();
        }

        this.client = createClient(clientConfig);

        // 针对@nebula-contrib/nebula-nodejs库，客户端自动管理连接
        // 不需要手动创建会话，直接使用客户端执行查询
        await this.logDatabaseEvent({
          type: DatabaseEventType.SERVICE_INITIALIZED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Client created successfully, waiting for connection...' }
        });
        
        // 等待客户端连接就绪
        await this.waitForClientConnection();
        
        // 验证连接是否成功
        await this.validateConnection(this.client);
        
        // nebula客户端内部管理连接池，不需要手动管理会话
        await this.logDatabaseEvent({
          type: DatabaseEventType.SERVICE_INITIALIZED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Client connected successfully (nebula manages internal pool)' }
        });

        // 设置连接状态
        this.connectionStatus.connected = true;
        this.connectionStatus.lastConnected = new Date();

        await this.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_OPENED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Successfully connected to Nebula Graph' }
        });
        
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 如果是最后一次重试，记录错误并返回false
        if (attempt === maxRetries) {
          this.connectionStatus.connected = false;
          this.connectionStatus.error = errorMessage;

          this.errorHandler.handleError(
            new Error(`Failed to connect to Nebula Graph after ${maxRetries + 1} attempts: ${errorMessage}`),
            { component: 'NebulaConnectionManager', operation: 'connect' }
          );

          return false;
        } else {
          // 记录重试信息
          await this.logDatabaseEvent({
            type: DatabaseEventType.ERROR_OCCURRED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: `Connection attempt ${attempt + 1} failed, retrying in ${retryDelay}ms`,
              error: errorMessage,
              attempt: attempt + 1,
              maxRetries: maxRetries + 1
            }
          });
          
          // 等待重试延迟
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    return false;
  }

  /**
   * 等待客户端连接就绪
   */
  private async waitForClientConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout: Client failed to connect within reasonable time'));
      }, this.config.timeout || 30000);
      
      // 等待'ready'事件，确保连接完全就绪（包括空间切换）
      this.client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.client.once('error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 记录数据库事件（错误处理版本）
   */
  private async logDatabaseEvent(event: any): Promise<void> {
    try {
      await this.databaseLogger.logDatabaseEvent(event);
    } catch (error) {
      // 如果日志记录失败，我们不希望影响主流程
      console.error('Failed to log database event:', error);
    }
  }

  /**
   * 验证连接是否成功
   */
  private async validateConnection(client: any): Promise<void> {
    try {
      // 执行简单查询验证连接 - 使用不依赖空间的查询
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Validating connection with simple query' }
      });
      
      // 使用不依赖特定空间的简单查询进行验证
      const validationQuery = this.connectionStatus.space ? 'SHOW SPACES' : 'YIELD 1';
      const result = await client.execute(validationQuery);
      
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Connection validation query result',
          validationQuery,
          hasResult: !!result,
          resultType: typeof result,
          hasCode: typeof result?.code !== 'undefined',
          code: result?.code,
          hasError: !!result?.error,
          error: result?.error,
          hasData: !!result?.data,
          dataLength: result?.data?.length
        }
      });
      
      if (!result || (typeof result.code !== 'undefined' && result.code !== 0)) {
        throw new Error(`Connection validation failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      // 捕获并重新抛出错误，提供更明确的信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Connection validation failed',
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      throw new Error(`Connection validation failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connectionStatus.connected) {
      await this.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_CLOSED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Already disconnected from Nebula Graph' }
      });
      return;
    }

    try {
      await this.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_CLOSED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Disconnecting from Nebula Graph' }
      });

      // 关闭客户端连接
      await this.closeClient();

      // 停止连接状态管理器的定期清理任务
      this.connectionStateManager.stopPeriodicCleanup();
      
      // 停止会话清理任务
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = null;
      }

      // 更新连接状态
      this.updateConnectionStatusAfterDisconnect();

      // 重置连接状态管理器中的主连接状态
      this.connectionStateManager.removeConnection('nebula-client-main');

      await this.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_CLOSED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Successfully disconnected from Nebula Graph' }
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
          await this.logDatabaseEvent({
            type: DatabaseEventType.SERVICE_INITIALIZED,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: 'Client closed successfully' }
          });
        }
      } catch (error) {
        await this.logDatabaseEvent({
          type: DatabaseEventType.ERROR_OCCURRED,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: 'Error closing client',
            error: error instanceof Error ? error.message : String(error)
          }
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
    // 创建连接状态的副本
    const status = { ...this.connectionStatus };
    
    // 确保空间名称有效，如果无效则设置为undefined
    if (!status.space || status.space === 'undefined' || status.space === '') {
      status.space = undefined;
    }
    
    return status;
  }

  async executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    // 验证连接状态
    if (!this.isConnected()) {
      return this.createErrorResult('Not connected to Nebula Graph');
    }

    // 验证查询参数
    if (!nGQL || typeof nGQL !== 'string' || nGQL.trim() === '') {
      throw new Error('Invalid query: Query string is empty or invalid');
    }

    // 检查非USE查询是否是无效的字符串，如 'undefined'
    const trimmedQuery = nGQL.trim();
    if (!trimmedQuery.toUpperCase().startsWith('USE ') && trimmedQuery.toLowerCase() === 'undefined') {
      throw new Error('Invalid query: Query string is invalid');
    }

    try {
      const client = this.client;
      
      // 检查是否是USE命令来更新空间状态
      if (trimmedQuery.toUpperCase().startsWith('USE ')) {
        const match = trimmedQuery.match(/USE\s+`?([^\s`]+)?`?/i);
        if (match) {
          const spaceName = match[1]; // 可能是 undefined（当匹配 `` 时）
          
          // 检查是否试图使用无效的space
          if (spaceName === undefined || spaceName === 'undefined' || spaceName === '') {
            throw new Error('Space does not exist');
          }
          
          // 获取当前连接的空间
          const currentSpace = this.connectionStateManager.getConnectionSpace('nebula-client-main');
          
          // 如果已经在目标空间，则不执行USE命令
          if (currentSpace === spaceName) {
            return this.createSuccessResult(`Already in space ${spaceName}`);
          }
          
          // 执行USE命令切换空间
          const result = await client.execute(nGQL);
          
          // 检查切换是否成功
          if (result && result.code === 0) {
            // 更新连接状态管理器中的空间状态
            this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
            return this.formatQueryResult(result, 0);
          } else {
            throw new Error(result?.error || 'Space does not exist');
          }
        }
      }
      
      await this.logDatabaseEvent({
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
      });

      const startTime = Date.now();

      // 执行查询 - Nebula Graph客户端库不支持参数化查询，需要手动处理参数
      const finalQuery = this.prepareQuery(nGQL, parameters);
      
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Prepared query for execution',
          originalQuery: nGQL,
          preparedQuery: finalQuery,
          parameters
        }
      });
      
      const result = await client.execute(finalQuery);
      
      await this.logDatabaseEvent({
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
      });

      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult = this.formatQueryResult(result, executionTime);

      await this.logDatabaseEvent({
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
      });
      
      return nebulaResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 如果错误是"Space does not exist"，我们不应该记录为错误，因为这是预期的行为
      if (!errorMessage.includes('Space does not exist')) {
        this.errorHandler.handleError(
          new Error(`Failed to execute Nebula query: ${errorMessage}`),
          {
            component: 'NebulaConnectionManager',
            operation: 'executeQuery',
            query: nGQL,
            parameters
          }
        );
      }

      // 如果错误是由于无效空间名称引起的，应该抛出错误而不是返回错误结果
      if (errorMessage.includes('Space does not exist')) {
        throw error;
      }

      // 对于空查询验证，我们应抛出错误而不是返回错误结果
      if (errorMessage.includes('Invalid query:')) {
        throw error;
      }

      return this.createErrorResult(errorMessage);
    }
  }

  /**
   * 处理USE空间命令
   */
  private handleUseSpaceCommand(nGQL: string): void {
    const trimmedQuery = nGQL.trim();
    if (trimmedQuery.toUpperCase().startsWith('USE ')) {
      const match = trimmedQuery.match(/USE\s+`?([^\s`]+)/i);
      if (match && match[1]) {
        const spaceName = match[1];
        // 确保空间名称有效，如果无效则不更新连接状态
        if (spaceName && spaceName !== 'undefined' && spaceName !== '') {
          // 更新连接状态管理器中的连接空间状态
          // 使用一个虚拟的连接ID，因为我们只有一个客户端连接
          this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
        } else {
          // 如果空间名称无效，确保连接状态中的空间也被清除
          this.connectionStateManager.updateConnectionSpace('nebula-client-main', undefined);
        }
      }
    }
  }

  /**
   * 检查是否是无效的USE查询
   */
  private isInvalidUseQuery(nGQL: string): boolean {
    return nGQL.trim().toUpperCase().startsWith('USE ') && nGQL.includes('undefined');
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(errorMessage: string): NebulaQueryResult {
    return {
      table: {},
      results: [],
      rows: [],
      data: [],
      error: errorMessage,
      executionTime: 0,
      timeCost: 0,
      space: this.connectionStatus.space,
    };
  }
  
  /**
   * 创建成功结果
   */
  private createSuccessResult(message: string): NebulaQueryResult {
    return {
      table: {},
      results: [],
      rows: [],
      data: [{ message }],
      executionTime: 0,
      timeCost: 0,
      space: this.connectionStatus.space,
      error: undefined
    };
  }

  /**
   * 准备查询语句，处理参数插值
   */
  private prepareQuery(nGQL: string, parameters?: Record<string, any>): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return nGQL;
    }
    
    return NebulaQueryUtils.interpolateParameters(nGQL, parameters);
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
      space: this.connectionStatus.space,
      error: result?.error || undefined
    };
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const client = this.client;
      
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing Nebula batch queries (no true transaction support)',
          queryCount: queries.length
        }
      });

      const startTime = Date.now();
      const results: NebulaQueryResult[] = [];

      // 执行所有查询（不使用事务，因为nGQL不支持）
      for (const { query, params } of queries) {
        let finalQuery = query;
        if (params && Object.keys(params).length > 0) {
          finalQuery = NebulaQueryUtils.interpolateParameters(query, params);
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
          space: this.connectionStatus.space,
        };
        results.push(nebulaResult);
      }

      const executionTime = Date.now() - startTime;
      
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Batch queries executed successfully',
          executionTime
        }
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
  getConfig(): NebulaConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NebulaConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateConnectionStatusFromConfig();
  }

  /**
   * 添加事件监听器 - 委托给全局事件管理器
   */
  addEventListener(eventType: string, listener: EventListener): void {
    // 委托给 NebulaEventManager
    this.eventManager.on(eventType, listener);
  }

  /**
   * 获取指定空间的连接
   */
  async getConnectionForSpace(spaceName: string): Promise<any> {
    // 验证空间名称
    if (!spaceName || typeof spaceName !== 'string' || spaceName.trim() === '') {
      throw new Error(`Cannot get connection for invalid space: "${spaceName}"`);
    }
    
    // 检查是否是无效的空间名称
    if (spaceName === 'undefined' || spaceName === '') {
      throw new Error(`Cannot get connection for invalid space: "${spaceName}"`);
    }

    // 检查连接状态
    if (!this.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    // 获取当前连接的空间
    const currentSpace = this.connectionStateManager.getConnectionSpace('nebula-client-main');
    
    // 如果已经在目标空间，直接返回客户端
    if (currentSpace === spaceName) {
      return this.client;
    }

    try {
      // 切换到目标空间
      const useQuery = `USE \`${spaceName}\``;
      const result = await this.client.execute(useQuery);
      
      // 检查切换是否成功
      if (result && result.code === 0) {
        // 更新连接状态管理器中的空间状态
        this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
        return this.client;
      } else {
        const errorMsg = result?.error || 'Unknown error';
        // 保持原有的错误格式
        throw new Error(`Failed to switch to space ${spaceName}: ${errorMsg}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 保持原有的错误格式
      throw new Error(`Failed to switch to space ${spaceName}: ${errorMessage}`);
    }
  }

  /**
   * 移除事件监听器 - 委托给全局事件管理器
   */
  removeEventListener(eventType: string, listener: EventListener): void {
    // 委托给 NebulaEventManager
    // 需要先获取订阅对象才能取消订阅
    console.warn('Direct removeEventListener is deprecated, use the subscription object to unsubscribe');
  }
  
  /**
   * 启动会话清理任务
   * 定期清理可能存在的未正确关闭的会话
   */
  private startSessionCleanupTask(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    
    // 在测试环境中不启动定时器，以避免Jest无法退出
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    this.sessionCleanupInterval = setInterval(async () => {
      try {
        await this.performSessionCleanup();
      } catch (error) {
        this.errorHandler.handleError(
          new Error(`Session cleanup task failed: ${error instanceof Error ? error.message : String(error)}`),
          { component: 'NebulaConnectionManager', operation: 'sessionCleanupTask' }
        );
      }
    }, 30 * 60 * 1000); // 每30分钟执行一次清理
  }
  
  /**
   * 执行会话清理
   * 检查并清理可能的过期或未正确关闭的会话
   */
  private async performSessionCleanup(): Promise<void> {
    if (!this.client || !this.isConnected()) {
      return;
    }
    
    try {
      // 记录当前会话数量用于调试
      await this.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Session cleanup task executed',
          connected: this.isConnected(),
          hasClient: !!this.client
        }
      });
      
      // 检查Nebula客户端是否健康
      if (typeof this.client.execute === 'function') {
        // 执行一个不依赖空间的简单查询来测试连接
        const cleanupQuery = this.connectionStatus.space ? 'SHOW SPACES' : 'YIELD 1';
        await this.client.execute(cleanupQuery);
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Session cleanup check failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'performSessionCleanup' }
      );
      
      // 如果连接有问题，尝试重新建立连接
      try {
        await this.disconnect();
        this.client = null;
        await this.connect();
      } catch (reconnectError) {
        this.errorHandler.handleError(
          new Error(`Failed to reconnect after session cleanup: ${reconnectError instanceof Error ? reconnectError.message : String(reconnectError)}`),
          { component: 'NebulaConnectionManager', operation: 'reconnectAfterCleanup' }
        );
      }
    }
  }
}