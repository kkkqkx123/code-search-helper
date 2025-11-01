import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ConnectionPoolEvent, ConnectionPoolStatistics, ConnectionQueueItem } from './types';
import { IDatabaseConnection } from './DatabaseConnectionAbstractions';
import { ConnectionPoolConfig } from './ConnectionPoolConfig';

// 避免循环依赖，定义本地PoolInfo接口
interface PoolInfo {
  config: ConnectionPoolConfig;
  idleConnections: IDatabaseConnection[];
  activeConnections: Set<IDatabaseConnection>;
  waitQueue: ConnectionQueueItem[];
  statistics: ConnectionPoolStatistics;
  createdAt: Date;
  lastActivityTime: Date;
 eventListeners: Map<string, Set<Function>>;
  healthCheckInterval?: NodeJS.Timeout;
  monitoringInterval?: NodeJS.Timeout;
  statisticsInterval?: NodeJS.Timeout;
  isInitialized: boolean;
  isClosing: boolean;
}

export interface IConnectionPoolEventEmitter {
  /**
   * 触发事件
   */
  emitEvent(databaseType: DatabaseType, poolInfo: PoolInfo, event: string, ...args: any[]): void;
}

@injectable()
export class ConnectionPoolEventEmitter implements IConnectionPoolEventEmitter {
  private logger: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
  }

  /**
   * 触发事件
   */
  emitEvent(databaseType: DatabaseType, poolInfo: PoolInfo, event: string, ...args: any[]): void {
    const listeners = poolInfo.eventListeners.get(event);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          this.logger.error('Error in event listener', {
            databaseType,
            event,
            error
          });
        }
      });
    }
  }
}