import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ITransactionCoordinator } from '../connection/types';

interface TransactionInfo {
  id: string;
  participants: DatabaseType[];
  state: 'active' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  created: number;
  prepared: Map<DatabaseType, boolean>;
}

@injectable()
export class TransactionCoordinator implements ITransactionCoordinator {
  private logger: LoggerService;
  private transactions: Map<string, TransactionInfo>;
  private timeout: number;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.transactions = new Map();
    this.timeout = 30000; // 30秒超时
  }

  async beginTransaction(transactionId: string, participants: DatabaseType[]): Promise<void> {
    if (this.transactions.has(transactionId)) {
      throw new Error(`Transaction with id ${transactionId} already exists`);
    }

    const transactionInfo: TransactionInfo = {
      id: transactionId,
      participants,
      state: 'active',
      created: Date.now(),
      prepared: new Map()
    };

    this.transactions.set(transactionId, transactionInfo);
    
    this.logger.info('Started new transaction', {
      transactionId,
      participants
    });
  }

  async preparePhase(transactionId: string): Promise<Map<DatabaseType, boolean>> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction with id ${transactionId} not found`);
    }

    if (transaction.state !== 'active') {
      throw new Error(`Transaction ${transactionId} is not in active state`);
    }

    const results = new Map<DatabaseType, boolean>();
    let allPrepared = true;

    // 为每个参与者执行准备阶段
    for (const participant of transaction.participants) {
      try {
        // 模拟向参与者发送准备请求
        // 在实际实现中，这里会调用具体的数据库准备操作
        const prepared = await this.prepareParticipant(participant, transactionId);
        results.set(participant, prepared);
        
        if (!prepared) {
          allPrepared = false;
          this.logger.warn('Participant failed to prepare for transaction', {
            transactionId,
            participant
          });
        }
      } catch (error) {
        results.set(participant, false);
        allPrepared = false;
        this.logger.error('Error during prepare phase for participant', {
          transactionId,
          participant,
          error: (error as Error).message
        });
      }
    }

    // 更新事务状态
    if (allPrepared) {
      transaction.state = 'prepared';
      transaction.prepared = results;
      this.logger.info('Transaction prepared successfully', { transactionId });
    } else {
      transaction.state = 'failed';
      this.logger.warn('Transaction prepare phase failed', { transactionId });
    }

    return results;
  }

  async commitPhase(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction with id ${transactionId} not found`);
    }

    if (transaction.state !== 'prepared') {
      throw new Error(`Transaction ${transactionId} is not in prepared state`);
    }

    let allCommitted = true;

    // 为每个参与者执行提交操作
    for (const participant of transaction.participants) {
      try {
        // 模拟向参与者发送提交请求
        // 在实际实现中，这里会调用具体的数据库提交操作
        const committed = await this.commitParticipant(participant, transactionId);
        
        if (!committed) {
          allCommitted = false;
          this.logger.warn('Participant failed to commit transaction', {
            transactionId,
            participant
          });
        }
      } catch (error) {
        allCommitted = false;
        this.logger.error('Error during commit phase for participant', {
          transactionId,
          participant,
          error: (error as Error).message
        });
      }
    }

    if (allCommitted) {
      transaction.state = 'committed';
      this.logger.info('Transaction committed successfully', { transactionId });
    } else {
      transaction.state = 'failed';
      this.logger.warn('Transaction commit phase failed', { transactionId });
      
      // 尝试回滚已提交的参与者
      await this.rollback(transactionId);
      return false;
    }

    return allCommitted;
  }

  async rollback(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction with id ${transactionId} not found`);
    }

    this.logger.info('Initiating transaction rollback', { transactionId });

    // 为每个参与者执行回滚操作
    for (const participant of transaction.participants) {
      try {
        // 模拟向参与者发送回滚请求
        // 在实际实现中，这里会调用具体的数据库回滚操作
        await this.rollbackParticipant(participant, transactionId);
        this.logger.debug('Participant rolled back successfully', {
          transactionId,
          participant
        });
      } catch (error) {
        this.logger.error('Error during rollback phase for participant', {
          transactionId,
          participant,
          error: (error as Error).message
        });
      }
    }

    transaction.state = 'rolled_back';
    this.logger.info('Transaction rolled back successfully', { transactionId });
  }

  getTransactionStatus(transactionId: string): {
    state: 'active' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
    participants: Map<DatabaseType, boolean>;
    timestamp: number;
 } {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction with id ${transactionId} not found`);
    }

    // 检查是否超时
    if (Date.now() - transaction.created > this.timeout) {
      transaction.state = 'failed';
      this.logger.warn('Transaction timed out', { transactionId });
    }

    return {
      state: transaction.state,
      participants: transaction.prepared || new Map(),
      timestamp: transaction.created
    };
  }

  private async prepareParticipant(participant: DatabaseType, transactionId: string): Promise<boolean> {
    // 模拟参与者准备操作
    // 在实际实现中，这里会调用具体的数据库准备操作
    this.logger.debug('Preparing participant for transaction', {
      participant,
      transactionId
    });
    
    // 模拟操作成功
    return true;
  }

  private async commitParticipant(participant: DatabaseType, transactionId: string): Promise<boolean> {
    // 模拟参与者提交操作
    // 在实际实现中，这里会调用具体的数据库提交操作
    this.logger.debug('Committing participant for transaction', {
      participant,
      transactionId
    });
    
    // 模拟操作成功
    return true;
  }

  private async rollbackParticipant(participant: DatabaseType, transactionId: string): Promise<void> {
    // 模拟参与者回滚操作
    // 在实际实现中，这里会调用具体的数据库回滚操作
    this.logger.debug('Rolling back participant for transaction', {
      participant,
      transactionId
    });
  }
}