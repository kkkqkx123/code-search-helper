import { DatabaseType } from '../types';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  details: {
    [key: string]: any;
  };
  timestamp: number;
  responseTime?: number;
}

export interface AggregateHealthStatus {
  overallStatus: 'healthy' | 'degraded' | 'error';
  databaseStatuses: Map<DatabaseType, HealthStatus>;
  timestamp: number;
  summary: {
    healthy: number;
    degraded: number;
    error: number;
    total: number;
  };
}

export interface IDatabaseHealthChecker {
  /**
   * 检查单个数据库类型的健康状态
   */
  checkHealth(databaseType: DatabaseType): Promise<HealthStatus>;

  /**
   * 检查所有数据库的健康状态
   */
  checkAllHealth(): Promise<AggregateHealthStatus>;

  /**
   * 获取特定数据库的健康状态
   */
 getHealthStatus(databaseType: DatabaseType): Promise<HealthStatus | null>;

  /**
   * 获取所有数据库的健康状态
   */
  getAllHealthStatus(): Promise<Map<DatabaseType, HealthStatus>>;

 /**
   * 开始健康检查监控
   */
  startMonitoring(): void;

  /**
   * 停止健康检查监控
   */
  stopMonitoring(): void;

  /**
   * 设置健康检查间隔
   */
  setCheckInterval(interval: number): void;

  /**
   * 获取当前健康检查间隔
   */
  getCheckInterval(): number;
}