import { injectable, inject } from 'inversify';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { TYPES } from '../../../types';
import { INebulaConnectionManager } from '../NebulaConnectionManager';
import { NebulaQueryResult } from '../NebulaTypes';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';

export interface INebulaTransactionService {
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]>;
}

@injectable()
export class NebulaTransactionService implements INebulaTransactionService {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private connectionManager: INebulaConnectionManager;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConnectionManager) connectionManager: INebulaConnectionManager
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.connectionManager = connectionManager;
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 使用 DatabaseLoggerService 记录事务执行事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing transaction',
          queryCount: queries.length
        }
      });

      const results = await this.connectionManager.executeTransaction(queries);

      // 使用 DatabaseLoggerService 记录事务执行成功事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Transaction executed successfully',
          queryCount: queries.length,
          resultCount: results.length
        }
      });

      return results;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录事务执行失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Transaction execution failed',
          error: error instanceof Error ? error.message : String(error),
          queryCount: queries.length
        }
      });

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'NebulaTransactionService', operation: 'executeTransaction' }
      );

      throw error;
    }
  }
}