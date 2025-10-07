import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ITransactionCoordinator, TransactionParticipant, TransactionStatus } from './ITransactionCoordinator';

@injectable()
export class TransactionCoordinator implements ITransactionCoordinator {
  private logger: LoggerService;
  private transactions: Map<string, TransactionStatus> = new Map();
  private participants: Map<string, Map<DatabaseType, TransactionParticipant>> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly defaultTimeout = 30000; // 30秒默认超时

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  async beginTransaction(): Promise<string> {
    const transactionId = this.generateTransactionId();
    const timestamp = Date.now();
    
    const transactionStatus: TransactionStatus = {
      id: transactionId,
      state: 'active',
      participants: new Map<DatabaseType, boolean>(),
      timestamp,
      timeout: this.defaultTimeout
    };

    this.transactions.set(transactionId, transactionStatus);
    this.participants.set(transactionId, new Map<DatabaseType, TransactionParticipant>());
    
    this.logger.info('Started new distributed transaction', { transactionId });
    
    return transactionId;
  }

 async registerParticipant(transactionId: string, participant: TransactionParticipant): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.state !== 'active') {
      throw new Error(`Cannot register participant in transaction with state: ${transaction.state}`);
    }

    const participantMap = this.participants.get(transactionId);
    if (!participantMap) {
      throw new Error(`Participants map not found for transaction: ${transactionId}`);
    }

    participantMap.set(participant.databaseType, participant);
    transaction.participants.set(participant.databaseType, false);

    this.logger.debug('Registered participant in transaction', {
      transactionId,
      databaseType: participant.databaseType
    });
 }

  async preparePhase(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.state !== 'active') {
      throw new Error(`Transaction is not in active state: ${transaction.state}`);
    }

    const participantMap = this.participants.get(transactionId);
    if (!participantMap) {
      throw new Error(`Participants map not found for transaction: ${transactionId}`);
    }

    this.logger.info('Starting prepare phase for transaction', { transactionId });

    try {
      // 准备所有参与者
      const preparePromises: Promise<boolean>[] = [];
      for (const [dbType, participant] of participantMap) {
        preparePromises.push(
          this.executeWithTimeout(
            participant.prepare(),
            this.defaultTimeout,
            `Prepare timeout for ${dbType}`
          )
        );
      }

      const results = await Promise.all(preparePromises);

      // 检查所有参与者是否准备成功
      const allPrepared = results.every(result => result);
      
      if (allPrepared) {
        transaction.state = 'prepared';
        this.logger.info('Prepare phase completed successfully', { transactionId });
        return true;
      } else {
        this.logger.error('Prepare phase failed', { transactionId, results });
        await this.rollbackTransaction(transactionId);
        return false;
      }
    } catch (error) {
      this.logger.error('Prepare phase failed with error', { 
        transactionId, 
        error: (error as Error).message 
      });
      await this.rollbackTransaction(transactionId);
      return false;
    }
  }

  async commitPhase(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.state !== 'prepared') {
      throw new Error(`Transaction is not in prepared state: ${transaction.state}`);
    }

    const participantMap = this.participants.get(transactionId);
    if (!participantMap) {
      throw new Error(`Participants map not found for transaction: ${transactionId}`);
    }

    this.logger.info('Starting commit phase for transaction', { transactionId });

    try {
      // 提交所有参与者
      const commitPromises: Promise<boolean>[] = [];
      for (const [dbType, participant] of participantMap) {
        commitPromises.push(
          this.executeWithTimeout(
            participant.commit(),
            this.defaultTimeout,
            `Commit timeout for ${dbType}`
          )
        );
      }

      const results = await Promise.all(commitPromises);
      const allCommitted = results.every(result => result);

      if (allCommitted) {
        transaction.state = 'committed';
        this.logger.info('Commit phase completed successfully', { transactionId });
        return true;
      } else {
        this.logger.error('Commit phase failed', { transactionId, results });
        return false;
      }
    } catch (error) {
      this.logger.error('Commit phase failed with error', { 
        transactionId, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  async executeTwoPhaseCommit(
    participants: TransactionParticipant[],
    operation: () => Promise<any>
  ): Promise<boolean> {
    const transactionId = await this.beginTransaction();

    try {
      // 注册所有参与者
      for (const participant of participants) {
        await this.registerParticipant(transactionId, participant);
      }

      // 执行业务操作
      await operation();

      // 执行准备阶段
      const prepared = await this.preparePhase(transactionId);
      if (!prepared) {
        return false;
      }

      // 执行提交阶段
      const committed = await this.commitPhase(transactionId);
      return committed;
    } catch (error) {
      this.logger.error('Two-phase commit operation failed', { 
        transactionId, 
        error: (error as Error).message 
      });
      await this.rollbackTransaction(transactionId);
      return false;
    } finally {
      await this.cleanupTransaction(transactionId);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const participantMap = this.participants.get(transactionId);
    if (!participantMap) {
      throw new Error(`Participants map not found for transaction: ${transactionId}`);
    }

    this.logger.info('Starting rollback for transaction', { transactionId });

    try {
      // 回滚所有参与者
      const rollbackPromises: Promise<boolean>[] = [];
      for (const [dbType, participant] of participantMap) {
        rollbackPromises.push(
          this.executeWithTimeout(
            participant.rollback(),
            this.defaultTimeout,
            `Rollback timeout for ${dbType}`
          )
        );
      }

      const results = await Promise.all(rollbackPromises);
      const allRolledBack = results.every(result => result);

      transaction.state = 'rolled_back';
      
      this.logger.info('Rollback completed', { 
        transactionId, 
        allRolledBack,
        results 
      });

      return allRolledBack;
    } catch (error) {
      this.logger.error('Rollback failed', { 
        transactionId, 
        error: (error as Error).message 
      });
      transaction.state = 'failed';
      return false;
    }
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus | null> {
    return this.transactions.get(transactionId) || null;
  }

 async cleanupTransaction(transactionId: string): Promise<void> {
    this.transactions.delete(transactionId);
    this.participants.delete(transactionId);
    
    this.logger.debug('Cleaned up transaction', { transactionId });
  }

  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Transaction monitoring already started');
      return;
    }

    this.logger.info('Starting transaction monitoring');
    
    this.monitoringInterval = setInterval(() => {
      this.checkForTimedOutTransactions();
    }, 5000); // 每5秒检查一次超时事务
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped transaction monitoring');
    }
  }

 private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

 private async executeWithTimeout<T>(
    promise: Promise<T>, 
    timeout: number, 
    errorMessage: string
 ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }

 private checkForTimedOutTransactions(): void {
    const now = Date.now();
    for (const [transactionId, transaction] of this.transactions) {
      if (now - transaction.timestamp > (transaction.timeout || this.defaultTimeout)) {
        this.logger.warn('Detected timed-out transaction, initiating rollback', { transactionId });
        this.rollbackTransaction(transactionId)
          .catch(error => {
            this.logger.error('Failed to rollback timed-out transaction', { 
              transactionId, 
              error: (error as Error).message 
            });
          });
      }
    }
  }
}