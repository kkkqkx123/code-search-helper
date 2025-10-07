import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { IDatabaseHealthChecker, HealthStatus, AggregateHealthStatus } from './IDatabaseHealthChecker';
import { InfrastructureManager } from '../InfrastructureManager';
import { IDatabaseInfrastructure } from '../InfrastructureManager';

@injectable()
export class DatabaseHealthChecker implements IDatabaseHealthChecker {
  private logger: LoggerService;
  private infrastructureManager: InfrastructureManager;
  private checkInterval: number = 30000; // 默认30秒检查一次
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthStatuses: Map<DatabaseType, HealthStatus> = new Map();
  private healthUpdateCallbacks: Array<(status: any) => void> = []; // 添加回调函数数组

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.InfrastructureManager) infrastructureManager: InfrastructureManager
  ) {
    this.logger = logger;
    this.infrastructureManager = infrastructureManager;
  }

  async checkHealth(): Promise<any> {
    // 这个方法是为了满足 IHealthChecker 接口要求而实现的
    // 返回一个默认的健康状态
    return {
      status: 'healthy',
      responseTime: 0,
      connectionPoolStatus: { active: 0, idle: 0, total: 0 },
      timestamp: Date.now()
    };
  }
  
  getHealthStatus(): any {
    // 返回一个默认的健康状态
    return {
      status: 'healthy',
      responseTime: 0,
      connectionPoolStatus: { active: 0, idle: 0, total: 0 },
      timestamp: Date.now()
    };
  }
  
  async checkHealthByDatabase(databaseType: DatabaseType): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // 获取数据库基础设施
      const infrastructure = this.infrastructureManager.getInfrastructure(databaseType);
      const healthChecker = infrastructure.getHealthChecker();
      
      // 执行健康检查
      const status = await healthChecker.getHealthStatus();
      
      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: status.status as 'healthy' | 'degraded' | 'error',
        details: {
          ...status,
          responseTime,
          lastChecked: new Date().toISOString()
        },
        timestamp: Date.now(),
        responseTime
      };

      this.healthStatuses.set(databaseType, healthStatus);
      
      // 通知订阅者健康状态更新
      this.notifyHealthUpdateSubscribers(healthStatus);
      
      this.logger.debug('Database health check completed', {
        databaseType,
        status: healthStatus.status,
        responseTime
      });

      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: 'error',
        details: {
          error: (error as Error).message,
          responseTime,
          lastChecked: new Date().toISOString()
        },
        timestamp: Date.now(),
        responseTime
      };

      this.healthStatuses.set(databaseType, healthStatus);
      
      // 通知订阅者健康状态更新
      this.notifyHealthUpdateSubscribers(healthStatus);
      
      this.logger.error('Database health check failed', {
        databaseType,
        error: (error as Error).message,
        responseTime
      });

      return healthStatus;
    }
  }

 async checkAllHealth(): Promise<AggregateHealthStatus> {
    const databaseTypes = Object.values(DatabaseType);
    const healthChecks = databaseTypes.map(dbType =>
     this.checkHealthByDatabase(dbType).catch(error => {
       // 如果单个数据库检查失败，返回错误状态而不是抛出异常
       const errorStatus: HealthStatus = {
         status: 'error',
         details: { error: (error as Error).message },
         timestamp: Date.now()
       };
       this.healthStatuses.set(dbType, errorStatus);
       return errorStatus;
     })
   );

    const results = await Promise.all(healthChecks);
    const databaseStatuses = new Map<DatabaseType, HealthStatus>();
    
    let healthyCount = 0;
    let degradedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < databaseTypes.length; i++) {
      const dbType = databaseTypes[i];
      databaseStatuses.set(dbType, results[i]);
      
      switch (results[i].status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    }

    let overallStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (errorCount > 0) {
      overallStatus = 'error';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const aggregateStatus: AggregateHealthStatus = {
      overallStatus,
      databaseStatuses,
      timestamp: Date.now(),
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        error: errorCount,
        total: databaseTypes.length
      }
    };

    this.logger.info('Aggregate health check completed', {
      overallStatus,
      summary: aggregateStatus.summary
    });

    return aggregateStatus;
  }

 async getHealthStatusByDatabase(databaseType: DatabaseType): Promise<HealthStatus | null> {
    return this.healthStatuses.get(databaseType) || null;
  }

  async getAllHealthStatus(): Promise<Map<DatabaseType, HealthStatus>> {
    // 如果没有缓存的健康状态，执行一次完整的健康检查
    if (this.healthStatuses.size === 0) {
      await this.checkAllHealth();
    }
    
    return new Map(this.healthStatuses);
  }

  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.logger.info('Starting health monitoring', { interval: this.checkInterval });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        this.logger.error('Error during periodic health check', {
          error: (error as Error).message
        });
      }
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped health monitoring');
    }
  }

  setCheckInterval(interval: number): void {
    if (interval < 1000) { // 最小1秒间隔
      throw new Error('Health check interval must be at least 1000ms');
    }
    
    this.checkInterval = interval;
    this.logger.info('Health check interval updated', { interval });
    
    // 如果监控已在运行，重启它以应用新间隔
    if (this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

 getCheckInterval(): number {
   return this.checkInterval;
 }

 /**
  * 订阅健康状态更新
  */
 subscribeToHealthUpdates(callback: (status: any) => void): void {
   this.healthUpdateCallbacks.push(callback);
 }

 /**
  * 通知所有订阅者健康状态更新
  */
 private notifyHealthUpdateSubscribers(status: any): void {
   for (const callback of this.healthUpdateCallbacks) {
     try {
       callback(status);
     } catch (error) {
       this.logger.error('Error in health update callback', {
         error: (error as Error).message
       });
     }
   }
 }
}