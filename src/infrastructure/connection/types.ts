import { DatabaseType, TransactionStatus, PoolStatus } from '../types';

export interface IDatabaseConnectionPool {
 getConnection(databaseType: DatabaseType): Promise<any>; // 实际上应该是数据库连接类型
 releaseConnection(connection: any): Promise<void>;
  getPoolStatus(databaseType: DatabaseType): PoolStatus;
  optimizePoolSize(databaseType: DatabaseType, loadFactor: number): Promise<void>;
}

export interface ITransactionCoordinator {
  beginTransaction(transactionId: string, participants: DatabaseType[]): Promise<void>;
  preparePhase(transactionId: string): Promise<Map<DatabaseType, boolean>>;
  commitPhase(transactionId: string): Promise<boolean>;
  rollback(transactionId: string): Promise<void>;
  getTransactionStatus(transactionId: string): TransactionStatus;
}