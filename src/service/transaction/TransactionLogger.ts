import { injectable, inject, unmanaged } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../../infrastructure/types';

export interface TransactionLogEntry {
  id: string;
  timestamp: number;
  operation: string;
 databaseType: DatabaseType;
  status: 'pending' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  details: {
    [key: string]: any;
  };
  error?: string;
}

export interface TransactionLogOptions {
  maxEntries?: number;
  retentionPeriod?: number; // 毫秒
  enableFileLogging?: boolean;
}

@injectable()
export class TransactionLogger {
  private logger: LoggerService;
  private logEntries: TransactionLogEntry[] = [];
  private options: TransactionLogOptions;
  private fileLogger: any; // 实际实现中会使用文件日志系统

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @unmanaged() options?: TransactionLogOptions
  ) {
    try {
      this.logger = logger;
      this.options = {
        maxEntries: 10000,
        retentionPeriod: 24 * 60 * 60 * 1000, // 24小时
        enableFileLogging: false,
        ...options
      };
      
      this.logger.info('TransactionLogger initialized', { options: this.options });
    } catch (error) {
      logger.error('Failed to initialize TransactionLogger', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  /**
   * 记录事务操作
   */
  async logTransaction(
    transactionId: string,
    operation: string,
    databaseType: DatabaseType,
    status: TransactionLogEntry['status'],
    details: { [key: string]: any },
    error?: string
 ): Promise<void> {
    const logEntry: TransactionLogEntry = {
      id: transactionId,
      timestamp: Date.now(),
      operation,
      databaseType,
      status,
      details,
      error
    };

    this.logEntries.push(logEntry);

    // 限制日志条目数量
    if (this.logEntries.length > (this.options.maxEntries || 1000)) {
      this.logEntries = this.logEntries.slice(-Math.floor((this.options.maxEntries || 10000) * 0.8)); // 保留80%的条目
    }

    // 清理过期条目
    this.cleanupExpiredEntries();

    // 记录到控制台日志
    this.logger.info('Transaction log entry', logEntry);

    // 如果启用文件日志，也写入文件
    if (this.options.enableFileLogging) {
      await this.logToFile(logEntry);
    }
  }

  /**
   * 获取事务日志
   */
  async getTransactionLogs(
    transactionId?: string,
    status?: TransactionLogEntry['status'],
    fromTime?: number,
    toTime?: number
  ): Promise<TransactionLogEntry[]> {
    let logs = [...this.logEntries];

    if (transactionId) {
      logs = logs.filter(log => log.id === transactionId);
    }

    if (status) {
      logs = logs.filter(log => log.status === status);
    }

    if (fromTime) {
      logs = logs.filter(log => log.timestamp >= fromTime);
    }

    if (toTime) {
      logs = logs.filter(log => log.timestamp <= toTime);
    }

    return logs;
  }

  /**
   * 获取事务状态
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionLogEntry['status'] | null> {
    const logs = this.logEntries.filter(log => log.id === transactionId);
    if (logs.length === 0) {
      return null;
    }

    // 返回最新的状态
    return logs[logs.length - 1].status;
  }

  /**
   * 检查事务是否需要恢复
   */
  async getTransactionsNeedingRecovery(): Promise<TransactionLogEntry[]> {
    // 查找处于中间状态（prepared）超过一定时间的事务
    const recoveryThreshold = Date.now() - 5 * 60 * 1000; // 5分钟前的prepared状态事务需要恢复
    return this.logEntries.filter(
      log => log.status === 'prepared' && log.timestamp < recoveryThreshold
    );
  }

  /**
   * 清理过期日志条目
   */
  private cleanupExpiredEntries(): void {
    const retentionPeriod = this.options.retentionPeriod || 24 * 60 * 60 * 1000; // 24小时
    const cutoffTime = Date.now() - retentionPeriod;
    
    this.logEntries = this.logEntries.filter(entry => entry.timestamp > cutoffTime);
  }

  /**
   * 写入文件日志
   */
  private async logToFile(logEntry: TransactionLogEntry): Promise<void> {
    // 实际实现中会写入文件
    // 为了简化，这里只是模拟
    console.log(`[TRANSACTION-LOG] ${JSON.stringify(logEntry)}`);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalEntries: number;
    pendingCount: number;
    committedCount: number;
    rolledBackCount: number;
    failedCount: number;
  }> {
    const totalEntries = this.logEntries.length;
    const pendingCount = this.logEntries.filter(log => log.status === 'pending').length;
    const committedCount = this.logEntries.filter(log => log.status === 'committed').length;
    const rolledBackCount = this.logEntries.filter(log => log.status === 'rolled_back').length;
    const failedCount = this.logEntries.filter(log => log.status === 'failed').length;

    return {
      totalEntries,
      pendingCount,
      committedCount,
      rolledBackCount,
      failedCount
    };
  }

  /**
   * 清空日志
   */
  async clearLogs(): Promise<void> {
    this.logEntries = [];
    this.logger.info('Transaction logs cleared');
  }
}