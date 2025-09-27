import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { NebulaConnectionManager } from './NebulaConnectionManager';
import { TYPES } from '../../types';

/**
 * NebulaGraph会话监控服务
 * 定期检查会话状态、清理空闲会话、监控使用率
 */
@injectable()
export class NebulaSessionMonitor {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private connectionManager: NebulaConnectionManager;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(
    @inject(TYPES.NebulaConnectionManager) connectionManager: NebulaConnectionManager,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  /**
   * 启动会话监控
   * @param intervalMinutes 监控间隔（分钟）
   */
  startMonitoring(intervalMinutes: number = 2): void {
    if (this.isMonitoring) {
      this.logger.warn('Session monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        this.errorHandler.handleError(
          new Error(
            `Session monitoring failed: ${error instanceof Error ? error.message : String(error)}`
          ),
          { component: 'NebulaSessionMonitor', operation: 'monitoringCycle' }
        );
      }
    }, intervalMs);

    this.logger.info(
      `Started NebulaGraph session monitoring with ${intervalMinutes} minute interval (optimized for high-concurrency)`
    );

    // 立即执行一次监控
    this.performMonitoringCycle().catch(error => {
      this.errorHandler.handleError(error, {
        component: 'NebulaSessionMonitor',
        operation: 'initialMonitoring',
      });
    });
  }

  /**
   * 停止会话监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.logger.info('Stopped NebulaGraph session monitoring');
  }

  /**
   * 执行监控周期
   */
  private async performMonitoringCycle(): Promise<void> {
    if (!this.connectionManager.isConnectedToDatabase()) {
      this.logger.warn('Skipping session monitoring - not connected to NebulaGraph');
      return;
    }

    try {
      // 1. 获取会话使用率统计
      const usageStats = await this.connectionManager.getSessionUsageStats();

      // 2. 记录监控信息
      this.logSessionUsage(usageStats);

      // 3. 检查容量告警
      if (!usageStats.hasCapacity) {
        this.triggerCapacityAlert(usageStats);
      }

      // 4. 清理空闲会话（每1分钟清理一次，针对高并发环境优化）
      const now = new Date();
      if (now.getMinutes() % 1 === 0) {
        // 每1分钟清理一次，更频繁的清理以适应高并发环境
        const cleanedCount = await this.connectionManager.cleanupIdleSessions(2); // 清理空闲超过2分钟的会话
        if (cleanedCount > 0) {
          this.logger.info(`Cleaned ${cleanedCount} idle sessions during monitoring cycle (high-concurrency mode)`);
        }
      }

      // 5. 如果使用率超过70%，立即清理空闲超过30秒的会话（针对高并发环境优化）
      if (usageStats.usagePercentage > 70) {
        const cleanedCount = await this.connectionManager.cleanupIdleSessions(0.5); // 清理空闲超过30秒的会话
        if (cleanedCount > 0) {
          this.logger.warn(`High session usage detected (${usageStats.usagePercentage.toFixed(1)}%), aggressively cleaned ${cleanedCount} idle sessions (high-concurrency mode)`);
        }
      }

      // 6. 如果使用率超过90%，立即清理空闲超过10秒的会话（针对高并发环境优化）
      if (usageStats.usagePercentage > 90) {
        const cleanedCount = await this.connectionManager.cleanupIdleSessions(0.17); // 清理空闲超过10秒的会话
        if (cleanedCount > 0) {
          this.logger.error(`Critical session usage detected (${usageStats.usagePercentage.toFixed(1)}%), emergency cleaned ${cleanedCount} idle sessions (high-concurrency mode)`);
        }
      }

      // 7. 获取详细会话信息（调试用）
      if (usageStats.usagePercentage > 50) {
        const activeSessions = await this.connectionManager.getActiveSessions();
        this.logDetailedSessionInfo(activeSessions);
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Monitoring cycle failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaSessionMonitor', operation: 'performMonitoringCycle' }
      );
    }
  }

  /**
   * 记录会话使用率
   */
  private logSessionUsage(usageStats: {
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }): void {
    if (!usageStats.hasCapacity) {
      this.logger.warn(
        `NebulaGraph会话使用率: ${usageStats.totalSessions}/${usageStats.maxSessions} ` +
        `(${usageStats.usagePercentage.toFixed(1)}%)` +
        ' - 容量告警!'
      );
    } else if (usageStats.usagePercentage > 70) {
      // For high-concurrency, log more frequently at debug level
      this.logger.debug(
        `NebulaGraph会话使用率: ${usageStats.totalSessions}/${usageStats.maxSessions} ` +
        `(${usageStats.usagePercentage.toFixed(1)}%)`
      );
    } else {
      this.logger.info(
        `NebulaGraph会话使用率: ${usageStats.totalSessions}/${usageStats.maxSessions} ` +
        `(${usageStats.usagePercentage.toFixed(1)}%)`
      );
    }
  }

  /**
   * 触发容量告警
   */
  private triggerCapacityAlert(usageStats: {
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }): void {
    this.logger.error(
      `NebulaGraph会话容量告警! 当前使用率: ${usageStats.usagePercentage.toFixed(1)}% ` +
      `(${usageStats.totalSessions}/${usageStats.maxSessions} sessions)`
    );

    // 这里可以添加告警通知逻辑，如发送邮件、Slack消息等
    // this.sendAlertNotification(usageStats);
  }

  /**
   * 记录详细会话信息
   */
  private logDetailedSessionInfo(sessionsInfo: any): void {
    if (sessionsInfo.allSessions && sessionsInfo.allSessions.length > 0) {
      this.logger.debug(
        `当前活跃会话详情: ${JSON.stringify(sessionsInfo.allSessions.slice(0, 5))}`
      );
    }

    if (sessionsInfo.localSessions && sessionsInfo.localSessions.length > 0) {
      this.logger.debug(`本地会话详情: ${JSON.stringify(sessionsInfo.localSessions.slice(0, 3))}`);
    }
  }

  /**
   * 手动执行一次监控检查
   */
 async manualCheck(): Promise<{
    usageStats: any;
    cleanedCount?: number;
  }> {
    if (!this.connectionManager.isConnectedToDatabase()) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      const usageStats = await this.connectionManager.getSessionUsageStats();
      const cleanedCount = await this.connectionManager.cleanupIdleSessions(10); // 针对单用户环境优化

      this.logSessionUsage(usageStats);
      if (cleanedCount > 0) {
        this.logger.info(`手动清理了 ${cleanedCount} 个空闲会话`);
      }

      return { usageStats, cleanedCount };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Manual check failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaSessionMonitor', operation: 'manualCheck' }
      );
      throw error;
    }
  }
}
