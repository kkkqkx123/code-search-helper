import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { NebulaQueryResult } from '../NebulaTypes';
import { ISessionManager } from '../session/SessionManager';
import { Session } from '../session/Session';
import { IBatchProcessingService, BatchContext } from '../../../infrastructure/batching/types';

// 事务接口
export interface ITransaction {
  id: string;
  execute(query: string, params?: Record<string, any>): Promise<NebulaQueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

// 事务管理器配置
export interface TransactionManagerConfig {
  defaultTimeout: number;
  maxConcurrentTransactions: number;
  enableBatching: boolean;
  batchSize: number;
}

// 事务管理器统计信息
export interface TransactionManagerStats {
  totalTransactions: number;
  activeTransactions: number;
  committedTransactions: number;
  rolledBackTransactions: number;
  averageTransactionTime: number;
  totalExecutionTime: number;
}

// 默认事务管理器配置
const DEFAULT_TRANSACTION_MANAGER_CONFIG: TransactionManagerConfig = {
  defaultTimeout: 30000, // 30秒
  maxConcurrentTransactions: 10,
  enableBatching: true,
  batchSize: 50
};

// 事务管理器接口
export interface ITransactionManager {
  beginTransaction(spaceName?: string): Promise<ITransaction>;
  getStats(): TransactionManagerStats;
  cleanup(): void;
}

/**
 * 事务管理器
 * 管理Nebula Graph数据库的事务操作
 */
@injectable()
export class TransactionManager extends EventEmitter implements ITransactionManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: NebulaConfigService;
  private performanceMonitor: PerformanceMonitor;
  private sessionManager: ISessionManager;
  private batchProcessingService: IBatchProcessingService;
  private config: TransactionManagerConfig;
  
  // 活跃事务存储
  private activeTransactions: Map<string, { 
    transaction: ITransaction; 
    startTime: number; 
    spaceName?: string 
  }> = new Map();
  
  // 统计信息
  private stats: TransactionManagerStats = {
    totalTransactions: 0,
    activeTransactions: 0,
    committedTransactions: 0,
    rolledBackTransactions: 0,
    averageTransactionTime: 0,
    totalExecutionTime: 0
  };

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.ISessionManager) sessionManager: ISessionManager,
    @inject(TYPES.IBatchProcessingService) batchProcessingService: IBatchProcessingService,
    config: Partial<TransactionManagerConfig> = {}
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.performanceMonitor = performanceMonitor;
    this.sessionManager = sessionManager;
    this.batchProcessingService = batchProcessingService;
    this.config = { ...DEFAULT_TRANSACTION_MANAGER_CONFIG, ...config };

    this.logger.info('TransactionManager initialized', {
      defaultTimeout: this.config.defaultTimeout,
      maxConcurrentTransactions: this.config.maxConcurrentTransactions,
      enableBatching: this.config.enableBatching
    });
  }

  /**
   * 开始新事务
   */
  async beginTransaction(spaceName?: string): Promise<ITransaction> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.stats.totalTransactions++;
    this.stats.activeTransactions++;

    try {
      this.logger.debug('Beginning transaction', {
        transactionId,
        spaceName
      });

      // 获取会话
      const session = await this.sessionManager.getSession(spaceName);

      // 创建事务对象
      const transaction: ITransaction = new NebulaTransaction(
        transactionId,
        session,
        this.sessionManager,
        this.logger,
        this.errorHandler,
        this.performanceMonitor
      );

      // 存储活跃事务
      this.activeTransactions.set(transactionId, {
        transaction,
        startTime,
        spaceName
      });

      this.emit('transactionStarted', {
        transactionId,
        spaceName,
        timestamp: new Date()
      });

      return transaction;
    } catch (error) {
      this.stats.activeTransactions--;
      
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to begin transaction'),
        { 
          component: 'TransactionManager', 
          operation: 'beginTransaction', 
          transactionId,
          spaceName 
        }
      );
      
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): TransactionManagerStats {
    // 计算平均事务时间
    if (this.stats.totalTransactions > 0) {
      this.stats.averageTransactionTime = this.stats.totalExecutionTime / this.stats.totalTransactions;
    }
    
    return { ...this.stats };
  }

  /**
   * 清理过期事务
   */
  cleanup(): void {
    const now = Date.now();
    const timeout = this.config.defaultTimeout;
    
    for (const [transactionId, transactionData] of this.activeTransactions.entries()) {
      if (now - transactionData.startTime > timeout) {
        this.logger.warn('Found expired transaction, rolling back', {
          transactionId,
          duration: now - transactionData.startTime
        });
        
        // 回滚过期事务
        const { transaction } = transactionData;
        if (transaction.isActive()) {
          transaction.rollback().catch(error => {
            this.logger.error('Failed to rollback expired transaction', {
              transactionId,
              error: error instanceof Error ? error.message : String(error)
            });
          });
        }
      }
    }
  }

  /**
   * 检查是否达到最大并发事务数
   */
  private isAtMaxCapacity(): boolean {
    return this.activeTransactions.size >= this.config.maxConcurrentTransactions;
  }
}

/**
 * Nebula事务实现
 */
class NebulaTransaction implements ITransaction {
  public id: string;
  private session: Session;
  private sessionManager: ISessionManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private performanceMonitor: PerformanceMonitor;
  private isActiveFlag: boolean = true;
  private queries: Array<{ query: string; params?: Record<string, any> }> = [];

  constructor(
    id: string,
    session: Session,
    sessionManager: ISessionManager,
    logger: LoggerService,
    errorHandler: ErrorHandlerService,
    performanceMonitor: PerformanceMonitor
  ) {
    this.id = id;
    this.session = session;
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * 执行查询
   */
  async execute(query: string, params?: Record<string, any>): Promise<NebulaQueryResult> {
    if (!this.isActiveFlag) {
      throw new Error(`Transaction ${this.id} is not active`);
    }

    const startTime = Date.now();
    const operationId = this.performanceMonitor.startOperation('nebula_transaction_query', {
      transactionId: this.id,
      query: query.substring(0, 100)
    });

    try {
      this.logger.debug('Executing query in transaction', {
        transactionId: this.id,
        query: query.substring(0, 100),
        hasParams: !!params
      });

      // 记录查询以便在回滚时使用
      this.queries.push({ query, params });

      // 执行查询
      const result = await this.session.execute(query, params);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        resultCount: result.data?.length || 0,
        executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Transaction query failed'),
        { 
          component: 'NebulaTransaction', 
          operation: 'execute', 
          transactionId: this.id, 
          query,
          params
        }
      );

      throw error;
    }
  }

  /**
   * 提交事务
   */
  async commit(): Promise<void> {
    if (!this.isActiveFlag) {
      throw new Error(`Transaction ${this.id} is not active`);
    }

    const startTime = Date.now();
    const operationId = this.performanceMonitor.startOperation('nebula_transaction_commit', {
      transactionId: this.id
    });

    try {
      this.logger.debug('Committing transaction', { transactionId: this.id });

      // 在Nebula Graph中，事务是自动提交的，所以这里只是释放会话
      this.isActiveFlag = false;

      // 释放会话回池中
      this.sessionManager.releaseSession(this.session);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        executionTime
      });

      this.logger.debug('Transaction committed', { 
        transactionId: this.id, 
        executionTime,
        queryCount: this.queries.length
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Transaction commit failed'),
        { 
          component: 'NebulaTransaction', 
          operation: 'commit', 
          transactionId: this.id 
        }
      );

      throw error;
    }
  }

  /**
   * 回滚事务
   */
  async rollback(): Promise<void> {
    if (!this.isActiveFlag) {
      throw new Error(`Transaction ${this.id} is not active`);
    }

    const startTime = Date.now();
    const operationId = this.performanceMonitor.startOperation('nebula_transaction_rollback', {
      transactionId: this.id
    });

    try {
      this.logger.debug('Rolling back transaction', { transactionId: this.id });

      // 在Nebula Graph中，我们通过释放会话来实现回滚
      this.isActiveFlag = false;

      // 释放会话回池中
      this.sessionManager.releaseSession(this.session);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        executionTime
      });

      this.logger.debug('Transaction rolled back', { 
        transactionId: this.id, 
        executionTime,
        queryCount: this.queries.length
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Transaction rollback failed'),
        { 
          component: 'NebulaTransaction', 
          operation: 'rollback', 
          transactionId: this.id 
        }
      );

      throw error;
    }
  }

  /**
   * 检查事务是否活跃
   */
  isActive(): boolean {
    return this.isActiveFlag;
  }
}