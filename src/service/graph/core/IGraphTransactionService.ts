import { TransactionOperation } from '../../../database/core/TransactionManager';
import { GraphTransactionConfig } from './GraphTransactionService';

export interface IGraphTransactionService {
  executeInTransaction<T>(
    operations: TransactionOperation[],
    callback: (results: any[]) => Promise<T>
  ): Promise<T>;

  executeBatchInTransaction<T>(
    operations: TransactionOperation[],
    callback: (results: any[]) => Promise<T>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<T>;

  createProjectSpace(projectId: string, options?: any): Promise<boolean>;

  deleteProjectSpace(projectId: string): Promise<boolean>;

  projectSpaceExists(projectId: string): Promise<boolean>;

  getTransactionStats(): Promise<{
    activeTransactions: number;
    averageOperationCount: number;
    averageDuration: number;
    successRate: number;
  }>;

  isServiceInitialized(): boolean;

  updateConfig(config: Partial<GraphTransactionConfig>): void;

  getConfig(): GraphTransactionConfig;

  close(): Promise<void>;
}