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
import { IQueryRunner } from './query/QueryRunner';
import { EventEmitter } from 'events';

export interface INebulaConnectionManager extends IConnectionManager {
  getConnectionStatus(): NebulaConnectionStatus;
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeTransaction(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<NebulaQueryResult[]>;
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
  private eventEmitter: EventEmitter;
  private queryRunner: IQueryRunner;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) nebulaConfigService: NebulaConfigService,
    @inject(TYPES.GraphConfigService) graphConfigService: GraphConfigService,
    @inject(TYPES.IQueryRunner) queryRunner: IQueryRunner
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.nebulaConfigService = nebulaConfigService;
    this.graphConfigService = graphConfigService;
    this.eventEmitter = new EventEmitter();
    this.queryRunner = queryRunner;
    this.connectionStatus = {
      connected: false,
      host: '',
      port: 0,
      username: '',
    };

    // 使用NebulaConfigService加载配置
    this.loadConfiguration();
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
    try {
      // 重新加载配置
      const loadedConfig = this.nebulaConfigService.loadConfig();
      const faultToleranceOptions = this.graphConfigService.getFaultToleranceOptions();

      // 合并配置
      this.config = {
        ...loadedConfig, ...{
          retryAttempts: faultToleranceOptions.maxRetries,
          retryDelay: faultToleranceOptions.retryDelay
        }
      };
      this.updateConnectionStatusFromConfig();

      // 使用 DatabaseLoggerService 记录连接信息
      await this.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_OPENED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Connecting to Nebula Graph',
          host: this.config.host,
          port: this.config.port,
          username: this.config.username
        }
      });

      // 简单的连接测试
      await this.queryRunner.execute('YIELD 1 AS connection_test;');

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
   * 更新断开连接后的状态
   */
  private updateConnectionStatusAfterDisconnect(): void {
    this.connectionStatus.connected = false;
    this.connectionStatus.space = undefined;
  }

  isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  getConnectionStatus(): NebulaConnectionStatus {
    const status = { ...this.connectionStatus };
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
   * 订阅事件（推荐的新API）
   */
  subscribe(eventType: string, listener: EventListener) {
    this.eventEmitter.on(eventType, listener);
    return {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      handler: listener,
      unsubscribe: () => this.eventEmitter.off(eventType, listener)
    };
  }

}