import { injectable, inject } from 'inversify';
import { LoggerService } from './LoggerService';
import { TYPES } from '../types';

/**
 * 错误报告接口
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  component: string;
  operation: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * 错误处理服务类
 * 提供统一的错误处理和报告功能
 */
@injectable()
export class ErrorHandlerService {
  private logger: LoggerService;
  private errorReports: Map<string, ErrorReport> = new Map();

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * 处理错误
   * @param error 错误对象
   * @param context 错误上下文信息
   * @returns 错误报告
   */
  handleError(error: Error, context: {
    component: string;
    operation: string;
    [key: string]: any;
  }): ErrorReport {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    const report: ErrorReport = {
      id: errorId,
      timestamp,
      component: context.component,
      operation: context.operation,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        // 移除已包含在报告中的字段
        component: undefined,
        operation: undefined,
      }
    };

    // 存储错误报告
    this.errorReports.set(errorId, report);

    // 记录错误日志
    this.logError(report);

    return report;
  }

  /**
   * 获取错误报告
   * @param errorId 错误ID
   * @returns 错误报告或null
   */
  getErrorReport(errorId: string): ErrorReport | null {
    return this.errorReports.get(errorId) || null;
  }

  /**
   * 获取所有错误报告
   * @returns 错误报告数组
   */
  getAllErrorReports(): ErrorReport[] {
    return Array.from(this.errorReports.values());
  }

  /**
   * 清除错误报告
   * @param errorId 错误ID
   * @returns 是否成功清除
   */
  clearErrorReport(errorId: string): boolean {
    return this.errorReports.delete(errorId);
  }

  /**
   * 清除所有错误报告
   */
  clearAllErrorReports(): void {
    this.errorReports.clear();
  }

  /**
   * 获取错误统计信息
   * @returns 错误统计信息
   */
  getErrorStats(): {
    total: number;
    byComponent: Record<string, number>;
    byOperation: Record<string, number>;
  } {
    const stats = {
      total: this.errorReports.size,
      byComponent: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
    };

    for (const report of this.errorReports.values()) {
      stats.byComponent[report.component] = (stats.byComponent[report.component] || 0) + 1;
      stats.byOperation[report.operation] = (stats.byOperation[report.operation] || 0) + 1;
    }

    return stats;
  }

  /**
   * 记录错误日志
   * @param report 错误报告
   */
  private logError(report: ErrorReport): void {
    const logMessage = `Error in ${report.component}.${report.operation}: ${report.message}`;
    const logMeta = {
      errorId: report.id,
      timestamp: report.timestamp.toISOString(),
      stack: report.stack,
      context: report.context,
    };

    this.logger.error(logMessage, logMeta).catch(err => {
      console.error('Failed to log error:', err);
    });
  }

  /**
   * 生成错误ID
   * @returns 错误ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }
}