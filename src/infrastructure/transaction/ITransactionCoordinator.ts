import { DatabaseType } from '../types';

export interface TransactionParticipant {
  databaseType: DatabaseType;
  prepare(): Promise<boolean>;
  commit(): Promise<boolean>;
  rollback(): Promise<boolean>;
  isPrepared(): Promise<boolean>;
}

export interface TransactionStatus {
  id: string;
  state: 'active' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  participants: Map<DatabaseType, boolean>;
  timestamp: number;
  timeout?: number;
}

export interface ITransactionCoordinator {
  /**
   * 开始分布式事务
   */
  beginTransaction(): Promise<string>;

  /**
   * 注册事务参与者
   */
  registerParticipant(transactionId: string, participant: TransactionParticipant): Promise<void>;

  /**
   * 准备阶段 - 两阶段提交的第一阶段
   */
  preparePhase(transactionId: string): Promise<boolean>;

  /**
   * 提交阶段 - 两阶段提交的第二阶段
   */
  commitPhase(transactionId: string): Promise<boolean>;

  /**
   * 执行完整的两阶段提交事务
   */
  executeTwoPhaseCommit(
    participants: TransactionParticipant[],
    operation: () => Promise<any>
  ): Promise<boolean>;

  /**
   * 回滚事务
   */
  rollbackTransaction(transactionId: string): Promise<boolean>;

  /**
   * 检查事务状态
   */
  getTransactionStatus(transactionId: string): Promise<TransactionStatus | null>;

  /**
   * 清理已完成的事务
   */
  cleanupTransaction(transactionId: string): Promise<void>;

  /**
   * 启动事务监控
   */
  startMonitoring(): void;

  /**
   * 停止事务监控
   */
  stopMonitoring(): void;
}