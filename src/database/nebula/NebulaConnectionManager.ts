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
        // 但在重新加载之前，先保存当前的更新配置
        const currentConfig = { ...this.config };
        const loadedConfig = this.nebulaConfigService.loadConfig();

        // 合并配置，优先使用当前实例中更新的配置
        this.config = { ...loadedConfig, ...currentConfig };
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
        // 确保等待客户端完全准备好再进行验证
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
        // 改进错误处理，确保错误对象被正确转换为字符串
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          try {
            // 尝试获取错误对象的有用属性
            errorMessage = (error as any).message || (error as any).error_msg || JSON.stringify(error);
          } catch (stringifyError) {
            errorMessage = `Error object: ${Object.keys(error).join(', ')}`;
          }
        } else {
          errorMessage = String(error);
        }

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
   * 针对@nebula-contrib/nebula-nodejs库的特殊处理
   */
  private async waitForClientConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout: Client failed to connect within reasonable time'));
      }, this.config.timeout || 30000);

      // 标记是否已连接，防止重复触发
      let connected = false;
      let authorizedCount = 0;
      const requiredAuthorizations = 1; // 只需要一个成功的授权

      // 监听 ready 事件，这是连接完全就绪的标志
      const onReady = (event: any) => {
        try {
          const connectionId = event.sender?.connectionId;
          console.log(`[NebulaConnectionManager] Client ready event:`, { connectionId });
          if (!connected) {
            connected = true;
            clearTimeout(timeout);
            // 移除事件监听器
            this.client.removeListener('ready', onReady);
            this.client.removeListener('error', onError);
            this.client.removeListener('connected', onConnected);
            this.client.removeListener('authorized', onAuthorized);
            resolve();
          }
        } catch (error) {
          console.error('[NebulaConnectionManager] Error in ready event handler:', error);
          if (!connected) {
            connected = true;
            clearTimeout(timeout);
            this.client.removeListener('ready', onReady);
            this.client.removeListener('error', onError);
            this.client.removeListener('connected', onConnected);
            this.client.removeListener('authorized', onAuthorized);
            reject(error);
          }
        }
      };

      // 监听 connected 事件以进行调试
      const onConnected = (event: any) => {
        try {
          const connectionId = event.sender?.connectionId;
          console.log(`[NebulaConnectionManager] Client connected event:`, { connectionId });
        } catch (error) {
          console.error('[NebulaConnectionManager] Error in connected event handler:', error);
        }
      };

      // 监听 authorized 事件 - 这是库版本问题的关键事件
      const onAuthorized = (event: any) => {
        try {
          const connectionId = event.sender?.connectionId;
          console.log(`[NebulaConnectionManager] Client authorized event:`, { connectionId });

          authorizedCount++;

          // 对于@nebula-contrib/nebula-nodejs库版本3.0.3，在authorized事件后
          // 需要等待一段时间让会话完全就绪，然后直接认为连接成功
          // 因为ready事件可能永远不会触发
          setTimeout(() => {
            if (!connected && authorizedCount >= requiredAuthorizations) {
              console.log(`[NebulaConnectionManager] Connection authorized ${authorizedCount} times, considering connection ready`);
              connected = true;
              clearTimeout(timeout);
              this.client.removeListener('ready', onReady);
              this.client.removeListener('error', onError);
              this.client.removeListener('connected', onConnected);
              this.client.removeListener('authorized', onAuthorized);
              resolve();
            }
          }, 2000); // 增加等待时间到2秒，确保会话完全就绪
        } catch (error) {
          console.error('[NebulaConnectionManager] Error in authorized event handler:', error);
          if (!connected) {
            connected = true;
            clearTimeout(timeout);
            this.client.removeListener('ready', onReady);
            this.client.removeListener('error', onError);
            this.client.removeListener('connected', onConnected);
            this.client.removeListener('authorized', onAuthorized);
            reject(error);
          }
        }
      };

      // 定义错误处理函数 - 特别处理"会话无效或连接未就绪"错误
      const onError = (error: any) => {
        try {
          // 安全地提取错误信息，避免循环引用问题
          let errorMessage = 'Unknown error';
          if (error) {
            if (typeof error === 'string') {
              errorMessage = error;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.error) {
              errorMessage = error.error;
            } else {
              try {
                // 尝试安全地序列化错误对象
                const errorObj: any = {};
                for (const key in error) {
                  if (key !== 'sender' && typeof error[key] !== 'object' && key !== 'client') {
                    errorObj[key] = error[key];
                  }
                }
                errorMessage = JSON.stringify(errorObj);
              } catch (stringifyError) {
                errorMessage = `Error object (circular reference detected): ${Object.keys(error).join(', ')}`;
              }
            }
          }

          console.log(`[NebulaConnectionManager] Client error event:`, { error: errorMessage });

          // 特别处理"会话无效或连接未就绪"错误
          // 这个错误在库版本3.0.3中经常出现，但不一定意味着连接失败
          if (errorMessage.includes('会话无效或连接未就绪') ||
            errorMessage.includes('Session invalid') ||
            errorMessage.includes('Connection not ready')) {

            console.log(`[NebulaConnectionManager] Session not ready error, waiting for authorization...`);

            // 不要立即拒绝，而是等待授权事件
            // 如果已经收到足够的授权，就认为连接成功
            if (authorizedCount >= requiredAuthorizations && !connected) {
              console.log(`[NebulaConnectionManager] Session error but already authorized, considering connection ready`);
              connected = true;
              clearTimeout(timeout);
              this.client.removeListener('ready', onReady);
              this.client.removeListener('error', onError);
              this.client.removeListener('connected', onConnected);
              this.client.removeListener('authorized', onAuthorized);
              resolve();
            }
            return; // 不要拒绝，继续等待
          }

          // 对于其他类型的错误，拒绝连接
          if (!connected) {
            clearTimeout(timeout);
            // 移除事件监听器
            this.client.removeListener('ready', onReady);
            this.client.removeListener('connected', onConnected);
            this.client.removeListener('authorized', onAuthorized);
            this.client.removeListener('error', onError);
            reject(new Error(errorMessage));
          }
        } catch (handlerError) {
          console.error('[NebulaConnectionManager] Error in error event handler:', handlerError);
          if (!connected) {
            clearTimeout(timeout);
            this.client.removeListener('ready', onReady);
            this.client.removeListener('error', onError);
            this.client.removeListener('connected', onConnected);
            this.client.removeListener('authorized', onAuthorized);
            // 使用安全错误信息
            reject(new Error('Connection failed with unhandled error'));
          }
        }
      };

      // 监听相关事件
      this.client.on('ready', onReady);
      this.client.on('connected', onConnected);
      this.client.on('authorized', onAuthorized);
      this.client.on('error', onError);
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
   * 针对@nebula-contrib/nebula-nodejs库的特殊处理
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

      // 尝试执行一个简单的查询验证连接是否可用，重试机制
      let attempt = 0;
      const maxAttempts = 10; // 增加重试次数
      let lastError: any = null;

      while (attempt < maxAttempts) {
        try {
          // 先等待一小段时间，确保连接状态同步
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 直接检查客户端连接池中是否有可用的连接
          if (client.connections && client.connections.length > 0) {
            const readyConnections = client.connections.filter((conn: any) => conn.isReady && !conn.isBusy);
            console.log(`[NebulaConnectionManager] 连接池状态: 总共${client.connections.length}个连接, ${readyConnections.length}个就绪`);

            if (readyConnections.length > 0) {
              console.log(`[NebulaConnectionManager] 发现就绪连接，跳过初始验证...`);
            }
          }

          // 验证连接时只使用不依赖空间的查询
          const validationQuery = 'YIELD 1 AS validation;';

          // 验证查询可能需要等待连接完全准备好
          const result = await client.execute(validationQuery);

          await this.logDatabaseEvent({
            type: DatabaseEventType.QUERY_EXECUTED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: `Connection validation query result (attempt ${attempt + 1})`,
              validationQuery,
              hasResult: !!result,
              resultType: typeof result,
              hasErrorCode: typeof result?.error_code !== 'undefined',
              errorCode: result?.error_code,
              errorMessage: result?.error_msg,
              hasError: !!result?.error,
              error: result?.error,
              hasData: !!result?.data,
              dataLength: result?.data?.length,
              hasResults: !!result?.results
            }
          });

          // 根据 Nebula Graph 的返回结果格式检查连接验证结果
          // Nebula Graph 返回结果中的 error_code 为 0 表示成功
          if (result && typeof result.error_code !== 'undefined' && result.error_code !== 0) {
            const errorMessage = result?.error_msg || result?.error || 'Unknown error';
            throw new Error(`Connection validation failed: ${errorMessage}`);
          }

          // 只有在连接验证成功且配置了有效的空间名称时，才尝试切换到指定空间
          if (this.connectionStatus.space && this.connectionStatus.space !== 'undefined' && this.connectionStatus.space !== '') {
            // 尝试切换到指定空间
            const useQuery = `USE \`${this.connectionStatus.space}\`;`;
            console.log(`[NebulaConnectionManager] 切换到空间: ${this.connectionStatus.space}`);
            const useResult = await client.execute(useQuery);

            // 检查是否是因为空间不存在导致的错误
            if (useResult && typeof useResult.error_code !== 'undefined' && useResult.error_code !== 0) {
              const errorMessage = useResult?.error_msg || useResult?.error || 'Unknown error';
              console.log(`[NebulaConnectionManager] Failed to switch to space '${this.connectionStatus.space}': ${errorMessage}`);

              // 检查错误信息是否表示空间不存在
              if (errorMessage.includes('Space not found') ||
                errorMessage.includes('Space not exist') ||
                errorMessage.includes('Space does not exist')) {
                console.log(`[NebulaConnectionManager] Space does not exist, attempting to create space: ${this.connectionStatus.space}`);

                try {
                  // 创建空间
                  const createSpaceQuery = `
                    CREATE SPACE IF NOT EXISTS \`${this.connectionStatus.space}\` (
                      partition_num = 10,
                      replica_factor = 1,
                      vid_type = "FIXED_STRING(32)"
                    )
                  `;

                  const createResult = await client.execute(createSpaceQuery);

                  if (createResult && typeof createResult.error_code !== 'undefined' && createResult.error_code !== 0) {
                    const createErrorMsg = createResult?.error_msg || createResult?.error || 'Unknown error';
                    throw new Error(`Failed to create space ${this.connectionStatus.space}: ${createErrorMsg}`);
                  }

                  // 等待空间创建完成
                  await new Promise(resolve => setTimeout(resolve, 2000));

                  // 再次尝试切换到空间
                  const reUseResult = await client.execute(useQuery);

                  if (reUseResult && typeof reUseResult.error_code !== 'undefined' && reUseResult.error_code !== 0) {
                    const reUseErrorMsg = reUseResult?.error_msg || reUseResult?.error || 'Unknown error';
                    throw new Error(`Failed to switch to newly created space ${this.connectionStatus.space}: ${reUseErrorMsg}`);
                  }

                  console.log(`[NebulaConnectionManager] Successfully created and switched to space: ${this.connectionStatus.space}`);

                  // 空间切换成功，更新连接状态管理器中的空间状态
                  this.connectionStateManager.updateConnectionSpace('nebula-client-main', this.connectionStatus.space);
                } catch (createError) {
                  const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
                  console.log(`[NebulaConnectionManager] Failed to create space: ${createErrorMsg}`);
                  throw new Error(`Space switching failed and automatic creation failed: ${createErrorMsg}`);
                }
              } else {
                // 如果是其他类型的错误，抛出错误
                throw new Error(`Failed to switch to space ${this.connectionStatus.space}: ${errorMessage}`);
              }
            } else {
              // 空间切换成功，更新连接状态管理器中的空间状态
              this.connectionStateManager.updateConnectionSpace('nebula-client-main', this.connectionStatus.space);
            }
          } else {
            // 如果没有配置特定空间，记录信息但不抛出错误，因为项目特定的空间将在使用时动态创建
            console.log(`[NebulaConnectionManager] No specific space configured, connection ready. Project-specific spaces will be created as needed.`);
          }

          // 如果成功，跳出循环
          console.log(`[NebulaConnectionManager] Connection validation successful on attempt ${attempt + 1}`);
          return;
        } catch (queryError) {
          lastError = queryError;
          console.log(`[NebulaConnectionManager] Connection validation attempt ${attempt + 1} failed:`, (queryError as Error).message || queryError);

          // 如果不是"会话无效或连接未就绪"错误，立即重抛错误
          const queryErrorAsAny = queryError as any;
          const errorMsg = queryErrorAsAny.message || queryErrorAsAny.error_msg || String(queryError);

          // 特殊处理"会话无效或连接未就绪"错误 - 这是库的常见问题，需要重试
          if (errorMsg.includes('会话无效或连接未就绪') ||
            errorMsg.includes('Session invalid') ||
            errorMsg.includes('Connection not ready') ||
            errorMsg.includes('ERR_NEBULA')) {
            console.log(`[NebulaConnectionManager] 检测到会话状态问题，等待并重试...`);

            // 检查客户端连接池状态
            if (client.connections) {
              const connectionStates = client.connections.map((conn: any) => ({
                connectionId: conn.connectionId,
                isReady: conn.isReady,
                isBusy: conn.isBusy,
                sessionId: conn.sessionId
              }));
              console.log(`[NebulaConnectionManager] 连接池状态:`, connectionStates);
            }

            // 等待更长时间，让连接状态同步
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempt++;
            continue;
          } else {
            // 对于其他类型的错误，直接抛出
            throw queryError;
          }
        }
      }

      // 如果所有尝试都失败了，抛出最后的错误
      if (lastError) {
        throw lastError;
      }
    } catch (error) {
      // 改进错误处理，确保错误对象被正确转换为字符串
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        try {
          // 尝试获取错误对象的有用属性
          errorMessage = (error as any).message || (error as any).error_msg || JSON.stringify(error);
        } catch (stringifyError) {
          errorMessage = `Error object: ${Object.keys(error).join(', ')}`;
        }
      } else {
        errorMessage = String(error);
      }

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
      // 额外检查客户端是否存在且可执行查询
      if (!this.client || typeof this.client.execute !== 'function') {
        return this.createErrorResult('Client is not ready to execute queries');
      }

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

      // 验证客户端是否准备好执行查询，避免在连接未完全准备好的情况下执行查询
      try {
        // 创建一个简单的查询来测试客户端连接状态
        const testResult = await client.execute('YIELD 1 AS test_connection;');
        if (testResult && typeof testResult.error_code !== 'undefined' && testResult.error_code !== 0) {
          const testError = testResult?.error_msg || testResult?.error || 'Unknown connection error';
          return this.createErrorResult(`Client is not ready: ${testError}`);
        }
      } catch (testError) {
        const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
        if (testErrorMessage.includes('会话无效或连接未就绪') ||
          testErrorMessage.includes('Session invalid') ||
          testErrorMessage.includes('Connection not ready')) {
          return this.createErrorResult(`Connection not ready: ${testErrorMessage}`);
        }
        // 如果测试查询也失败，继续执行实际查询，让原始错误处理来处理
      }

      // 获取当前连接的空间
      const currentSpace = this.connectionStateManager.getConnectionSpace('nebula-client-main');
      
      // 如果配置了特定空间，确保在执行查询前切换到正确的空间
      if (currentSpace && !trimmedQuery.toUpperCase().startsWith('USE ')) {
        try {
          // 检查是否需要在执行查询前切换空间
          const useResult = await client.execute(`USE \`${currentSpace}\``);
          if (useResult && (useResult.code !== 0 && (typeof useResult.error_code !== 'undefined' && useResult.error_code !== 0))) {
            const useError = useResult?.error_msg || useResult?.error || 'Unknown error';
            console.warn(`[NebulaConnectionManager] Failed to switch to space ${currentSpace} before query: ${useError}`);
          } else {
            console.log(`[NebulaConnectionManager] Switched to space ${currentSpace} before executing query`);
          }
        } catch (useError) {
          const useErrorMessage = useError instanceof Error ? useError.message : String(useError);
          console.warn(`[NebulaConnectionManager] Space switch warning before query: ${useErrorMessage}`);
          // 不抛出错误，继续执行查询
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
      if (!errorMessage.includes('Space does not exist') && !errorMessage.includes('Connection not ready')) {
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

      // 对于连接未就绪的错误，也要抛出错误而不是返回错误结果
      if (errorMessage.includes('Connection not ready')) {
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

    // 额外检查客户端是否存在且可执行查询
    if (!this.client || typeof this.client.execute !== 'function') {
      throw new Error('Client is not ready to execute queries');
    }

    try {
      const client = this.client;

      // 验证客户端是否准备好执行查询
      try {
        const testResult = await client.execute('YIELD 1 AS test_connection;');
        if (testResult && typeof testResult.error_code !== 'undefined' && testResult.error_code !== 0) {
          const testError = testResult?.error_msg || testResult?.error || 'Unknown connection error';
          throw new Error(`Connection not ready: ${testError}`);
        }
      } catch (testError) {
        const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
        if (testErrorMessage.includes('会话无效或连接未就绪') ||
          testErrorMessage.includes('Session invalid') ||
          testErrorMessage.includes('Connection not ready')) {
          throw new Error(`Connection not ready: ${testErrorMessage}`);
        }
        // 如果测试查询也失败，让原始错误处理来处理
      }

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
      // 对于连接就绪性错误，不记录为错误，因为这是预期的行为
      if (!errorMessage.includes('Connection not ready')) {
        this.errorHandler.handleError(
          new Error(`Failed to execute Nebula batch queries: ${errorMessage}`),
          {
            component: 'NebulaConnectionManager',
            operation: 'executeTransaction',
            queries
          }
        );
      }

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

    // 额外检查客户端是否存在且可执行查询
    if (!this.client || typeof this.client.execute !== 'function') {
      throw new Error('Client is not ready to execute queries');
    }

    // 验证客户端连接是否就绪
    try {
      const testResult = await this.client.execute('YIELD 1 AS test_connection;');
      if (testResult && typeof testResult.error_code !== 'undefined' && testResult.error_code !== 0) {
        const testError = testResult?.error_msg || testResult?.error || 'Unknown connection error';
        throw new Error(`Connection not ready: ${testError}`);
      }
    } catch (testError) {
      const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
      if (testErrorMessage.includes('会话无效或连接未就绪') ||
        testErrorMessage.includes('Session invalid') ||
        testErrorMessage.includes('Connection not ready')) {
        throw new Error(`Connection not ready: ${testErrorMessage}`);
      }
      // 如果测试失败，让原始错误处理来处理
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
      if (result && (result.code === 0 || (typeof result.error_code !== 'undefined' && result.error_code === 0))) {
        // 更新连接状态管理器中的空间状态
        this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
        console.log(`[NebulaConnectionManager] Successfully switched to space: ${spaceName}`);
        
        // 验证空间切换是否真正成功
        try {
          const verifyResult = await this.client.execute('SHOW SPACES;');
          console.log(`[NebulaConnectionManager] Verification query result:`, {
            hasData: !!verifyResult?.data,
            dataLength: verifyResult?.data?.length,
            currentSpace: spaceName
          });
        } catch (verifyError) {
          console.warn(`[NebulaConnectionManager] Space verification failed:`, verifyError);
        }
        
        return this.client;
      } else {
        const errorMsg = result?.error || result?.error_msg || 'Unknown error';

        // 检查是否是因为空间不存在导致的错误
        if (errorMsg.includes('Space not found') ||
          errorMsg.includes('Space not exist') ||
          errorMsg.includes('Space does not exist') ||
          errorMsg.includes('SpaceNotFound')) {

          console.log(`[NebulaConnectionManager] Space '${spaceName}' does not exist, attempting to create it...`);

          try {
            // 创建空间
            const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${spaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`;

            console.log(`[NebulaConnectionManager] Creating space with query: ${createSpaceQuery}`);
            const createResult = await this.client.execute(createSpaceQuery);

            if (createResult && (typeof createResult.error_code !== 'undefined' && createResult.error_code !== 0)) {
              const createErrorMsg = createResult?.error_msg || createResult?.error || 'Unknown error';
              throw new Error(`Failed to create space ${spaceName}: ${createErrorMsg}`);
            }

            console.log(`[NebulaConnectionManager] Successfully created space: ${spaceName}`);

            // 等待空间创建完成并同步到所有节点
            await new Promise(resolve => setTimeout(resolve, 10000));

            // 再次尝试切换到空间
            console.log(`[NebulaConnectionManager] Attempting to switch to newly created space: ${spaceName}`);
            const reUseResult = await this.client.execute(useQuery);

            if (reUseResult && (reUseResult.code === 0 || (typeof reUseResult.error_code !== 'undefined' && reUseResult.error_code === 0))) {
              // 更新连接状态管理器中的空间状态
              this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
              console.log(`[NebulaConnectionManager] Successfully switched to newly created space: ${spaceName}`);
              return this.client;
            } else {
              const reUseErrorMsg = reUseResult?.error || reUseResult?.error_msg || 'Unknown error';
              throw new Error(`Failed to switch to newly created space ${spaceName}: ${reUseErrorMsg}`);
            }
          } catch (createError) {
            const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
            console.error(`[NebulaConnectionManager] Failed to create space: ${createErrorMsg}`);
            throw new Error(`Space switching failed and automatic creation failed: ${createErrorMsg}`);
          }
        } else {
          // 如果是其他类型的错误，抛出错误
          throw new Error(`Failed to switch to space ${spaceName}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 检查是否是空间不存在的错误，如果是其他错误类型也需要处理
      if (errorMessage.includes('SpaceNotFound') ||
        errorMessage.includes('Space not found') ||
        errorMessage.includes('Space not exist') ||
        errorMessage.includes('Space does not exist')) {

        console.log(`[NebulaConnectionManager] Space '${spaceName}' does not exist (catch block), attempting to create it...`);

        try {
          // 创建空间
          const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${spaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`;

          console.log(`[NebulaConnectionManager] Creating space with query: ${createSpaceQuery}`);
          const createResult = await this.client.execute(createSpaceQuery);

          if (createResult && (typeof createResult.error_code !== 'undefined' && createResult.error_code !== 0)) {
            const createErrorMsg = createResult?.error_msg || createResult?.error || 'Unknown error';
            throw new Error(`Failed to create space ${spaceName}: ${createErrorMsg}`);
          }

          console.log(`[NebulaConnectionManager] Successfully created space: ${spaceName}`);

          // 等待空间创建完成并同步到所有节点
          await new Promise(resolve => setTimeout(resolve, 10000));

          // 再次尝试切换到空间
          console.log(`[NebulaConnectionManager] Attempting to switch to newly created space: ${spaceName}`);
          const reUseResult = await this.client.execute(`USE \`${spaceName}\``);

          if (reUseResult && (reUseResult.code === 0 || (typeof reUseResult.error_code !== 'undefined' && reUseResult.error_code === 0))) {
            // 更新连接状态管理器中的空间状态
            this.connectionStateManager.updateConnectionSpace('nebula-client-main', spaceName);
            console.log(`[NebulaConnectionManager] Successfully switched to newly created space: ${spaceName}`);
            return this.client;
          } else {
            const reUseErrorMsg = reUseResult?.error || reUseResult?.error_msg || 'Unknown error';
            throw new Error(`Failed to switch to newly created space ${spaceName}: ${reUseErrorMsg}`);
          }
        } catch (createError) {
          const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
          console.error(`[NebulaConnectionManager] Failed to create space: ${createErrorMsg}`);
          throw new Error(`Space switching failed and automatic creation failed: ${createErrorMsg}`);
        }
      } else {
        // 保持原有的错误格式
        throw new Error(`Failed to switch to space ${spaceName}: ${errorMessage}`);
      }
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
        const cleanupQuery = 'YIELD 1 AS health_check;';
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