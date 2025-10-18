import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { DatabaseEventType } from '../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { NebulaQueryResult } from './NebulaTypes';
import { PerformanceMonitor } from '../common/PerformanceMonitor';
import { INebulaQueryService } from './query/NebulaQueryService';

export interface INebulaTransactionService {
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  isInTransaction(): boolean;
  validateTransaction(queries: Array<{ query: string; params: Record<string, any> }>): boolean;
}

@injectable()
export class NebulaTransactionService implements INebulaTransactionService {
  private queryService: INebulaQueryService;
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private performanceMonitor: PerformanceMonitor;
  private inTransaction: boolean = false;

  constructor(
    @inject(TYPES.NebulaQueryService) queryService: INebulaQueryService,
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.DatabasePerformanceMonitor) performanceMonitor: PerformanceMonitor
  ) {
    this.queryService = queryService;
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.performanceMonitor = performanceMonitor;
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    const startTime = Date.now();

    try {
      // Nebula Graph不支持真正的事务，但我们可以通过批处理模拟事务行为
      // 使用 DatabaseLoggerService 记录事务执行事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing transaction (Nebula does not support true transactions)',
          queryCount: queries.length
        }
      });

      // 执行所有查询（没有真正的回滚机制，因为Nebula不支持事务）
      const results: NebulaQueryResult[] = [];
      for (const { query, params } of queries) {
        const result = await this.queryService.executeQuery(query, params);
        results.push(result);

        // 检查单个查询是否失败
        if (result.error) {
          // 使用 DatabaseLoggerService 记录单个查询失败事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.ERROR_OCCURRED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: 'Query in transaction failed',
              query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
              error: result.error,
              queryIndex: results.length - 1
            }
          });

          // 由于Nebula不支持真正事务，我们不能回滚先前的查询，但可以记录错误并继续
          this.errorHandler.handleError(
            new Error(`Transaction query failed: ${result.error}`),
            {
              component: 'NebulaTransactionService',
              operation: 'executeTransaction',
              query,
              params
            }
          );
        }
      }

      const executionTime = Date.now() - startTime;

      // 记录性能指标
      this.performanceMonitor.recordOperation('executeTransaction', executionTime, {
        queryCount: queries.length
      });

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Transaction executed (with Nebula limitations)',
          executionTime,
          queryCount: queries.length,
          resultCount: results.length
        }
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;

      // 使用 DatabaseLoggerService 记录事务执行失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Transaction execution failed',
          error: errorMessage,
          executionTime,
          queryCount: queries.length
        }
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute Nebula transaction: ${errorMessage}`),
        {
          component: 'NebulaTransactionService',
          operation: 'executeTransaction',
          queries
        }
      );

      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    // Nebula Graph 不支持传统事务，但我们可以记录状态
    // 使用 DatabaseLoggerService 记录事务开始事件
    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_INITIALIZED,
      source: 'nebula',
      timestamp: new Date(),
      data: {
        message: 'Transaction begin requested (Nebula does not support true transactions)'
      }
    });

    this.inTransaction = true;
  }

  async commitTransaction(): Promise<void> {
    // Nebula Graph 不支持传统事务提交，但我们可以记录状态
    // 使用 DatabaseLoggerService 记录事务提交事件
    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_INITIALIZED,
      source: 'nebula',
      timestamp: new Date(),
      data: {
        message: 'Transaction commit requested (Nebula does not support true transactions)'
      }
    });

    this.inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    // Nebula Graph 不支持传统事务回滚，但我们可以记录状态
    // 使用 DatabaseLoggerService 记录事务回滚事件
    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SPACE_ERROR,
      source: 'nebula',
      timestamp: new Date(),
      data: {
        message: 'Transaction rollback requested (Nebula does not support true transactions)'
      }
    });

    this.inTransaction = false;
  }

  isInTransaction(): boolean {
    return this.inTransaction;
  }

  validateTransaction(queries: Array<{ query: string; params: Record<string, any> }>): boolean {
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return false;
    }

    // 验证每个查询
    for (const { query, params } of queries) {
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return false;
      }

      // 简单的查询验证
      const trimmedQuery = query.trim();
      const uppercaseQuery = trimmedQuery.toUpperCase();

      // 检查是否是不允许的查询类型
      if (uppercaseQuery.startsWith('DROP SPACE') ||
        uppercaseQuery.startsWith('CREATE SPACE') ||
        uppercaseQuery.startsWith('USE ') && trimmedQuery.includes('undefined')) {
        return false;
      }

      // 验证参数
      if (params && typeof params !== 'object') {
        return false;
      }
    }

    return true;
  }
}