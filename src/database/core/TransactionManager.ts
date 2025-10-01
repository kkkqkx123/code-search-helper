import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

export interface TransactionOperation {
  nGQL: string;
  parameters?: Record<string, any>;
}

export interface TransactionResult {
  success: boolean;
  results: any[];
  error?: string;
  executionTime: number;
}

@injectable()
export class TransactionManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private activeTransactions: Map<string, any> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  async beginTransaction(transactionId?: string): Promise<string> {
    const id = transactionId || this.generateTransactionId();

    try {
      // Create a new transaction context
      const transactionContext = {
        id,
        startTime: Date.now(),
        operations: [] as TransactionOperation[],
        status: 'active' as const,
      };

      this.activeTransactions.set(id, transactionContext);

      this.logger.debug('Transaction started', { transactionId: id });
      return id;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to begin transaction: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'TransactionManager', operation: 'beginTransaction' }
      );
      throw error;
    }
  }

  async addOperation(
    transactionId: string,
    operation: TransactionOperation
  ): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    transaction.operations.push(operation);
    this.logger.debug('Operation added to transaction', {
      transactionId,
      operationType: operation.nGQL.split(' ')[0],
    });
  }

  async commitTransaction(
    transactionId: string,
    executeCallback: (operations: TransactionOperation[]) => Promise<TransactionResult>
  ): Promise<TransactionResult> {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    const startTime = Date.now();

    try {
      this.logger.debug('Committing transaction', {
        transactionId,
        operationCount: transaction.operations.length
      });

      // Execute the transaction
      const result = await executeCallback(transaction.operations);

      // Update transaction status
      transaction.status = 'committed';
      transaction.endTime = Date.now();

      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      const executionTime = Date.now() - startTime;

      this.logger.info('Transaction committed successfully', {
        transactionId,
        operationCount: transaction.operations.length,
        executionTime,
        success: result.success,
      });

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.endTime = Date.now();
      transaction.error = error instanceof Error ? error.message : String(error);

      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      const executionTime = Date.now() - startTime;

      this.errorHandler.handleError(
        new Error(`Transaction commit failed: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'TransactionManager',
          operation: 'commitTransaction',
          transactionId,
          operationCount: transaction.operations.length,
          executionTime,
        }
      );

      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  async rollbackTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      this.logger.warn('Transaction not found for rollback', { transactionId });
      return false;
    }

    try {
      this.logger.debug('Rolling back transaction', {
        transactionId,
        operationCount: transaction.operations.length
      });

      // Update transaction status
      transaction.status = 'rolledback';
      transaction.endTime = Date.now();

      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      this.logger.info('Transaction rolled back successfully', {
        transactionId,
        operationCount: transaction.operations.length,
      });

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Transaction rollback failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'TransactionManager', operation: 'rollbackTransaction' }
      );
      return false;
    }
  }

  getTransactionStatus(transactionId: string): {
    exists: boolean;
    status?: 'active' | 'committed' | 'failed' | 'rolledback';
    operationCount?: number;
    duration?: number;
  } {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      return { exists: false };
    }

    const duration = transaction.endTime
      ? transaction.endTime - transaction.startTime
      : Date.now() - transaction.startTime;

    return {
      exists: true,
      status: transaction.status,
      operationCount: transaction.operations.length,
      duration,
    };
  }

  getActiveTransactions(): Array<{
    id: string;
    status: string;
    operationCount: number;
    duration: number;
  }> {
    const now = Date.now();

    return Array.from(this.activeTransactions.entries()).map(([id, transaction]) => ({
      id,
      status: transaction.status,
      operationCount: transaction.operations.length,
      duration: now - transaction.startTime,
    }));
  }

  async executeInTransaction<T>(
    operations: TransactionOperation[],
    executeCallback: (operations: TransactionOperation[]) => Promise<TransactionResult>
  ): Promise<TransactionResult> {
    const transactionId = await this.beginTransaction();

    try {
      // Add all operations to the transaction
      for (const operation of operations) {
        await this.addOperation(transactionId, operation);
      }

      // Commit the transaction
      return await this.commitTransaction(transactionId, executeCallback);
    } catch (error) {
      // Rollback on error
      await this.rollbackTransaction(transactionId);

      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
      };
    }
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility method to clean up old transactions
  cleanupOldTransactions(maxAgeMs: number = 300000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, transaction] of this.activeTransactions.entries()) {
      const age = now - transaction.startTime;

      if (age > maxAgeMs) {
        this.activeTransactions.delete(id);
        cleanedCount++;

        this.logger.warn('Cleaned up old transaction', {
          transactionId: id,
          age,
          maxAgeMs,
        });
      }
    }

    return cleanedCount;
  }

  // Method to get transaction statistics
  getTransactionStats(): {
    activeCount: number;
    averageOperationCount: number;
    averageDuration: number;
  } {
    const activeTransactions = this.getActiveTransactions();

    if (activeTransactions.length === 0) {
      return {
        activeCount: 0,
        averageOperationCount: 0,
        averageDuration: 0,
      };
    }

    const totalOperations = activeTransactions.reduce(
      (sum, tx) => sum + tx.operationCount,
      0
    );

    const totalDuration = activeTransactions.reduce(
      (sum, tx) => sum + tx.duration,
      0
    );

    return {
      activeCount: activeTransactions.length,
      averageOperationCount: totalOperations / activeTransactions.length,
      averageDuration: totalDuration / activeTransactions.length,
    };
  }
}