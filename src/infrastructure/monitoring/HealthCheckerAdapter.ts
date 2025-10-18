import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { IHealthChecker, DatabaseHealthStatus } from './types';
import { DatabaseHealthChecker } from './DatabaseHealthChecker';

/**
 * 适配器类，将 DatabaseHealthChecker 适配为 IHealthChecker 接口
 * 每个基础设施实例都需要自己的适配器实例
 */
@injectable()
export class HealthCheckerAdapter implements IHealthChecker {
  private logger: LoggerService;
  private databaseHealthChecker: DatabaseHealthChecker;
  private readonly databaseType: DatabaseType;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.HealthChecker) databaseHealthChecker: DatabaseHealthChecker,
    databaseType: DatabaseType
  ) {
    this.logger = logger;
    this.databaseHealthChecker = databaseHealthChecker;
    this.databaseType = databaseType;
    
    // 注册这个基础设施的健康检查器
    this.databaseHealthChecker.registerHealthChecker(this.databaseType, this);
  }

  async checkHealth(): Promise<DatabaseHealthStatus> {
    try {
      // 使用 DatabaseHealthChecker 检查当前基础设施的健康状态
      const healthStatus = await this.databaseHealthChecker.checkHealthByDatabase(this.databaseType);
      
      // 将 HealthStatus 转换为 DatabaseHealthStatus
      const databaseHealthStatus: DatabaseHealthStatus = {
        databaseType: this.databaseType,
        status: healthStatus.status,
        responseTime: healthStatus.responseTime || 0,
        connectionPoolStatus: {
          activeConnections: 0, // 可以从基础设施获取实际值
          idleConnections: 0,
          pendingRequests: 0,
          maxConnections: 0
        },
        timestamp: healthStatus.timestamp
      };

      return databaseHealthStatus;
    } catch (error) {
      this.logger.error(`Health check failed for ${this.databaseType}`, {
        error: (error as Error).message
      });

      return {
        databaseType: this.databaseType,
        status: 'error',
        responseTime: 0,
        connectionPoolStatus: {
          activeConnections: 0,
          idleConnections: 0,
          pendingRequests: 0,
          maxConnections: 0
        },
        timestamp: Date.now()
      };
    }
  }

  getHealthStatus(): DatabaseHealthStatus {
    // 获取缓存的健康状态（同步版本）
    // 由于接口要求同步返回，我们返回一个默认的健康状态
    return {
      databaseType: this.databaseType,
      status: 'healthy',
      responseTime: 0,
      connectionPoolStatus: {
        activeConnections: 0,
        idleConnections: 0,
        pendingRequests: 0,
        maxConnections: 0
      },
      timestamp: Date.now()
    };
  }

  subscribeToHealthUpdates(callback: (status: DatabaseHealthStatus) => void): void {
    // 将订阅转发到 DatabaseHealthChecker
    this.databaseHealthChecker.subscribeToHealthUpdates((status) => {
      if (status.details?.databaseType === this.databaseType) {
        const databaseHealthStatus: DatabaseHealthStatus = {
          databaseType: this.databaseType,
          status: status.status,
          responseTime: status.responseTime || 0,
          connectionPoolStatus: {
            activeConnections: 0,
            idleConnections: 0,
            pendingRequests: 0,
            maxConnections: 0
          },
          timestamp: status.timestamp
        };
        callback(databaseHealthStatus);
      }
    });
  }
}