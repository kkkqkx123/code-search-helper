import { injectable, inject } from 'inversify';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { DatabaseEventType } from '../common/DatabaseEventTypes';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from './NebulaTypes';
import { TYPES } from '../../types';
import { IConnectionManager } from '../common/IDatabaseService';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';
import { GraphConfigService } from '../../config/service/GraphConfigService';
import { EventListener } from '../../types';
import { NebulaEventManager } from './NebulaEventManager';
import { INebulaQueryService } from './query/NebulaQueryService';
import { IQueryRunner } from './query/QueryRunner';

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<NebulaQueryResult[]>;
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
  private nebulaConfigService: NebulaConfigService;
  private graphConfigService: GraphConfigService;
  private connectionStatus: NebulaConnectionStatus;
  private config!: NebulaConfig;
  private client: any; // Nebula Graph客户端实例 - 使用项目原生实现
  private eventManager: NebulaEventManager;
  private queryRunner: IQueryRunner;
  private configUpdateInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
    @inject(TYPES.GraphConfigService) graphConfigService: GraphConfigService,
    @inject(TYPES.NebulaEventManager) eventManager: NebulaEventManager,
    @inject(TYPES.IQueryRunner) queryRunner: IQueryRunner
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.nebulaConfigService = nebulaConfigService;
    this.graphConfigService = graphConfigService;
    this.eventManager = eventManager;
    this.queryRunner = queryRunner;
    this.connectionStatus = {
      connected: false,
      host: '',
      port: 0,
      username: '',
    };

    // 使用NebulaConfigService加载配置
    this.loadConfiguration();

    // 启动配置热更新
    this.startConfigHotReload();
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
          poolSize: this.config.maxConnections || 10,
          bufferSize: this.config.bufferSize || 10,
          executeTimeout: this.config.timeout || 30000,
          pingInterval: this.config.pingInterval || 3000
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

        // 使用项目原生的连接池实现，而不是外部库
        // 这里我们直接使用QueryRunner来执行查询，因为QueryRunner已经集成了连接管理
        // 创建一个模拟客户端，实际查询通过QueryRunner执行
        this.client = {
          execute: async (query: string) => {
            // 通过QueryRunner执行查询
            const result = await this.queryRunner.execute(query);
            return result;
          },
          close: async () => {
            // 连接管理由QueryRunner和SessionManager处理
          }
        };

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
   * 使用项目原生的连接管理实现
   */
  private async waitForClientConnection(): Promise<void> {
    // 由于使用项目原生的QueryRunner，连接管理由QueryRunner和SessionManager处理
    // 这里只需要确保QueryRunner已准备好
    if (!this.queryRunner) {
      throw new Error('QueryRunner is not initialized');
    }
    
    // 简单的连接测试
    try {
      await this.queryRunner.execute('YIELD 1 AS connection_test;');
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * 使用项目原生的连接管理实现
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

      // 使用QueryRunner执行验证查询
      const validationQuery = 'YIELD 1 AS validation;';
      const result = await this.queryRunner.execute(validationQuery);
      
      // 检查结果是否有效
      if (!result || result.error) {
        throw new Error(`Connection validation failed: ${result?.error || 'Unknown error'}`);
      }

      // 如果配置了空间，尝试切换到该空间
      if (this.connectionStatus.space && this.connectionStatus.space !== 'undefined' && this.connectionStatus.space !== '') {
        try {
          // 尝试切换到指定空间
          await this.queryRunner.execute(`USE \`${this.connectionStatus.space}\`;`);
        } catch (useError) {
          const errorMessage = useError instanceof Error ? useError.message : String(useError);
          
          // 如果空间不存在，尝试创建它
          if (errorMessage.includes('Space not found') ||
              errorMessage.includes('Space not exist') ||
              errorMessage.includes('Space does not exist')) {
              
            try {
              // 创建空间
              const createSpaceQuery = `
                CREATE SPACE IF NOT EXISTS \`${this.connectionStatus.space}\` (
                  partition_num = 10,
                  replica_factor = 1,
                  vid_type = "FIXED_STRING(32)"
                )
              `;
              
              await this.queryRunner.execute(createSpaceQuery);
              
              // 等待空间创建完成
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // 再次尝试切换到空间
              await this.queryRunner.execute(`USE \`${this.connectionStatus.space}\`;`);
            } catch (createError) {
              throw new Error(`Failed to create space ${this.connectionStatus.space}: ${createError instanceof Error ? createError.message : String(createError)}`);
            }
          } else {
            throw new Error(`Failed to switch to space ${this.connectionStatus.space}: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
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

      // 停止配置热更新
      this.stopConfigHotReload();

      // 关闭客户端连接
      await this.closeClient();

      // 更新连接状态
      this.updateConnectionStatusAfterDisconnect();

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
    // 委托给新的QueryRunner
    return await this.queryRunner.execute(nGQL, parameters);
  }

  async executeTransaction(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    // 转换查询格式以匹配QueryRunner的接口
    const queryBatches = queries.map(q => ({
      query: q.query,
      params: q.params,
      options: undefined
    }));

    // 委托给新的QueryRunner
    return await this.queryRunner.executeBatch(queryBatches);
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

    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_INITIALIZED,
      source: 'nebula',
      timestamp: new Date(),
      data: { message: 'Configuration updated', config: this.config }
    });
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): void {
    try {
      // 从NebulaConfigService加载基础配置
      const baseConfig = this.nebulaConfigService.loadConfig();

      // 从GraphConfigService获取容错配置
      const faultToleranceOptions = this.graphConfigService.getFaultToleranceOptions();

      // 将容错选项转换为NebulaConfig格式
      const faultTolerantConfig: Partial<NebulaConfig> = {
        retryAttempts: faultToleranceOptions.maxRetries,
        retryDelay: faultToleranceOptions.retryDelay
      };

      // 合并配置，容错配置优先
      this.config = { ...baseConfig, ...faultTolerantConfig };
      this.updateConnectionStatusFromConfig();

      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Configuration loaded', config: this.config }
      });
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to load configuration'),
        { component: 'NebulaConnectionManager', operation: 'loadConfiguration' }
      );
      throw error;
    }
  }

  /**
   * 启动配置热更新
   */
  private startConfigHotReload(): void {
    // 每30秒检查一次配置更新
    this.configUpdateInterval = setInterval(() => {
      try {
        const currentConfig = this.nebulaConfigService.loadConfig();
        const faultToleranceOptions = this.graphConfigService.getFaultToleranceOptions();

        // 将容错选项转换为NebulaConfig格式
        const faultTolerantConfig: Partial<NebulaConfig> = {
          retryAttempts: faultToleranceOptions.maxRetries,
          retryDelay: faultToleranceOptions.retryDelay
        };
        const newConfig = { ...currentConfig, ...faultTolerantConfig };

        // 检查配置是否有变化
        if (this.hasConfigChanged(this.config, newConfig)) {
          const oldConfig = { ...this.config };
          this.config = newConfig;
          this.updateConnectionStatusFromConfig();

          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.SERVICE_INITIALIZED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: 'Configuration hot-reloaded',
              oldConfig,
              newConfig: this.config
            }
          });

          // 创建配置更新事件
          const configUpdateEvent = {
            type: 'config_updated' as any,
            timestamp: new Date(),
            data: { oldConfig, newConfig: this.config }
          };

          this.eventManager.emit(configUpdateEvent);
        }
      } catch (error) {
        this.errorHandler.handleError(
          error instanceof Error ? error : new Error('Failed to hot-reload configuration'),
          { component: 'NebulaConnectionManager', operation: 'configHotReload' }
        );
      }
    }, 30000);

    // 确保定时器不会阻止进程退出
    if (this.configUpdateInterval.unref) {
      this.configUpdateInterval.unref();
    }
  }

  /**
   * 停止配置热更新
   */
  private stopConfigHotReload(): void {
    if (this.configUpdateInterval) {
      clearInterval(this.configUpdateInterval);
      this.configUpdateInterval = null;
    }
  }

  /**
   * 检查配置是否有变化
   */
  private hasConfigChanged(oldConfig: NebulaConfig, newConfig: NebulaConfig): boolean {
    const keys: (keyof NebulaConfig)[] = [
      'host', 'port', 'username', 'password', 'timeout',
      'maxConnections', 'retryAttempts', 'retryDelay', 'space',
      'bufferSize', 'pingInterval', 'vidTypeLength'
    ];

    return keys.some(key => oldConfig[key] !== newConfig[key]);
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

    // 使用QueryRunner来处理空间切换，而不是直接操作客户端
    try {
      // 切换到目标空间
      const useQuery = `USE \`${spaceName}\``;
      const result = await this.queryRunner.execute(useQuery);

      // 检查切换是否成功
      if (!result.error) {
        // 返回一个包装对象，包含QueryRunner的执行方法
        return {
          execute: async (query: string) => {
            return await this.queryRunner.execute(query);
          }
        };
      } else {
        const errorMsg = result.error;

        // 检查是否是因为空间不存在导致的错误
        if (errorMsg.includes('Space not found') ||
          errorMsg.includes('Space not exist') ||
          errorMsg.includes('Space does not exist') ||
          errorMsg.includes('SpaceNotFound')) {

          // 创建空间
          const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${spaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`;

          // 在执行前记录查询内容以进行调试
          await this.logDatabaseEvent({
            type: DatabaseEventType.QUERY_EXECUTED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: 'About to execute getConnectionForSpace CREATE SPACE query',
              query: createSpaceQuery,
              queryLength: createSpaceQuery.length,
              first100Chars: createSpaceQuery.substring(0, 100),
              spaceName: spaceName
            }
          });

          const createResult = await this.queryRunner.execute(createSpaceQuery);

          if (createResult.error) {
            const createErrorMsg = createResult.error;
            throw new Error(`Failed to create space ${spaceName}: ${createErrorMsg}`);
          }

          // 等待空间创建完成并同步到所有节点
          await new Promise(resolve => setTimeout(resolve, 2000));

          // 再次尝试切换到空间
          const reUseResult = await this.queryRunner.execute(useQuery);

          if (!reUseResult.error) {
            // 返回一个包装对象，包含QueryRunner的执行方法
            return {
              execute: async (query: string) => {
                return await this.queryRunner.execute(query);
              }
            };
          } else {
            const reUseErrorMsg = reUseResult.error;
            throw new Error(`Failed to switch to newly created space ${spaceName}: ${reUseErrorMsg}`);
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

        // 创建空间
        const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${spaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`;

        // 在执行前记录查询内容以进行调试
        await this.logDatabaseEvent({
          type: DatabaseEventType.QUERY_EXECUTED,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: 'About to execute fallback CREATE SPACE query',
            query: createSpaceQuery,
            queryLength: createSpaceQuery.length,
            first100Chars: createSpaceQuery.substring(0, 100),
            spaceName: spaceName
          }
        });

        const createResult = await this.queryRunner.execute(createSpaceQuery);

        if (createResult.error) {
          const createErrorMsg = createResult.error;
          throw new Error(`Failed to create space ${spaceName}: ${createErrorMsg}`);
        }

        // 等待空间创建完成并同步到所有节点
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 再次尝试切换到空间
        const reUseResult = await this.queryRunner.execute(`USE \`${spaceName}\``);

        if (!reUseResult.error) {
          // 返回一个包装对象，包含QueryRunner的执行方法
          return {
            execute: async (query: string) => {
              return await this.queryRunner.execute(query);
            }
          };
        } else {
          const reUseErrorMsg = reUseResult.error;
          throw new Error(`Failed to switch to newly created space ${spaceName}: ${reUseErrorMsg}`);
        }
      } else {
        // 保持原有的错误格式
        throw new Error(`Failed to switch to space ${spaceName}: ${errorMessage}`);
      }
    }
  }

  /**
   * 订阅事件（推荐的新API）
   */
  subscribe(eventType: string, listener: EventListener) {
    return this.eventManager.subscribe(eventType, listener);
  }

}