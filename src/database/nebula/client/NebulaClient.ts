import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from '../NebulaTypes';
import { EventListener } from '../../../types';
import { IQueryRunner } from '../query/QueryRunner';
import { ITransactionManager, ITransaction } from '../transaction/TransactionManager';

// 查询批次接口
export interface QueryBatch {
  query: string;
  params?: Record<string, any>;
}

// 事务接口
export interface ITransaction {
  id: string;
  execute(query: string, params?: Record<string, any>): Promise<NebulaQueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// 查询选项接口
export interface QueryOptions {
  timeout?: number;
  retryAttempts?: number;
  useCache?: boolean;
}

// NebulaClient接口
export interface INebulaClient {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // 查询执行
  execute(query: string, params?: Record<string, any>, options?: QueryOptions): Promise<NebulaQueryResult>;
  executeBatch(queries: QueryBatch[]): Promise<NebulaQueryResult[]>;
  
  // 事务管理
  beginTransaction(): Promise<ITransaction>;
  
  // 配置管理（复用现有服务）
  updateConfig(config: Partial<NebulaConfig>): void;
  getConfig(): NebulaConfig;
  
  // 事件订阅（复用现有EventEmitter）
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): boolean;
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
  private transactionManager: ITransactionManager;
  private config: NebulaConfig;
  private connectionStatus: NebulaConnectionStatus;
  private isConnectedFlag: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.IQueryRunner) queryRunner: IQueryRunner,
    @inject(TYPES.ITransactionManager) transactionManager: ITransactionManager
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.performanceMonitor = performanceMonitor;
    this.queryRunner = queryRunner;
    this.transactionManager = transactionManager;
    
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
   * 开始事务
   */
  async beginTransaction(): Promise<ITransaction> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      const transaction = await this.transactionManager.beginTransaction();
      this.emit('transactionBegan', { transaction });
      return transaction;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to begin transaction'),
        { component: 'NebulaClient', operation: 'beginTransaction' }
      );
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
}