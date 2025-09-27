import { EventEmitter } from 'events';
import { LSPError } from './LSPClient';

export interface ErrorHandlerConfig {
  maxRestarts: number;
  restartDelay: number;
  fallbackToTreesitter: boolean;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

export interface ErrorContext {
  workspaceRoot: string;
  language: string;
  method?: string;
  filePath?: string;
  timestamp: Date;
  error: Error | LSPError;
  retryCount?: number;
}

export interface ErrorMetrics {
  errorCounts: any;
  errorRate(errorRate: any): unknown;
  totalErrors: number;
  connectionErrors: number;
  timeoutErrors: number;
  parseErrors: number;
  otherErrors: number;
  restartCount: number;
  fallbackCount: number;
  lastError?: ErrorContext;
}

export class LSPErrorHandler extends EventEmitter {
  classifyError(error: any): string {
    if (this.isConnectionError(error)) {
      return 'connection';
    }
    if (this.isTimeoutError(error)) {
      return 'timeout';
    }
    if (this.isParseError(error)) {
      return 'parse';
    }
    if (this.isFatalError(error)) {
      return 'fatal';
    }
    return 'other';
  }

  async retryWithBackoff(operation: () => Promise<any>, maxRetries: number): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // 指数退避，最大10秒
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  getFallbackStrategy(error: any): string {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'connection':
        return 'treesitter';
      case 'timeout':
        return 'cache';
      case 'parse':
        return 'simple';
      case 'fatal':
        return 'skip';
      default:
        return 'treesitter';
    }
  }

  isCircuitOpen(): boolean {
    const healthStatus = this.getHealthStatus();
    return !healthStatus.healthy || healthStatus.errorRate > 0.1;
  }

  canProceed(): boolean {
    return !this.isCircuitOpen();
  }

  async handleWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canProceed()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      return await operation();
    } catch (error) {
      // 记录错误并重新评估电路状态
      const context = this.createErrorContext(
        error as Error,
        '',
        '',
        'circuit_breaker_operation'
      );
      this.recordError(context);
      
      throw error;
    }
  }
  private config: ErrorHandlerConfig;
  private errorLog: ErrorContext[] = [];
  private restartCounts = new Map<string, number>();
  private metrics: ErrorMetrics = {
    errorCounts: {},
    errorRate: (errorRate: any) => 0,
    totalErrors: 0,
    connectionErrors: 0,
    timeoutErrors: 0,
    parseErrors: 0,
    otherErrors: 0,
    restartCount: 0,
    fallbackCount: 0,
  };

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = {
      maxRestarts: config.maxRestarts || 5,
      restartDelay: config.restartDelay || 2000,
      fallbackToTreesitter: config.fallbackToTreesitter ?? true,
      logLevel: config.logLevel || 'INFO',
    };
  }

  async handleError(context: ErrorContext): Promise<ErrorAction> {
    this.recordError(context);

    const action = await this.determineAction(context);

    this.emit('errorHandled', { context, action });

    return action;
  }

  private recordError(context: ErrorContext): void {
    this.errorLog.push(context);
    this.metrics.totalErrors++;
    this.metrics.lastError = context;

    // 分类错误
    if (this.isConnectionError(context.error)) {
      this.metrics.connectionErrors++;
    } else if (this.isTimeoutError(context.error)) {
      this.metrics.timeoutErrors++;
    } else if (this.isParseError(context.error)) {
      this.metrics.parseErrors++;
    } else {
      this.metrics.otherErrors++;
    }

    // 限制错误日志大小
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-500);
    }

    this.logError(context);
  }

  private async determineAction(context: ErrorContext): Promise<ErrorAction> {
    const key = this.getErrorKey(context);
    const restartCount = this.restartCounts.get(key) || 0;

    // 检查是否应该重启
    if (this.shouldRestart(context, restartCount)) {
      this.restartCounts.set(key, restartCount + 1);
      this.metrics.restartCount++;

      return {
        type: 'restart',
        delay: this.config.restartDelay,
        retryCount: restartCount + 1,
      };
    }

    // 检查是否应该降级
    if (this.config.fallbackToTreesitter && this.shouldFallback(context)) {
      this.metrics.fallbackCount++;

      return {
        type: 'fallback',
        reason: 'LSP unavailable, falling back to Tree-sitter',
      };
    }

    // 默认跳过
    return {
      type: 'skip',
      reason: 'Error handled, continuing without LSP',
    };
  }

  private shouldRestart(context: ErrorContext, restartCount: number): boolean {
    if (restartCount >= this.config.maxRestarts) {
      return false;
    }

    // 连接错误应该重启
    if (this.isConnectionError(context.error)) {
      return true;
    }

    // 超时错误在重试次数内可以重启
    if (this.isTimeoutError(context.error) && restartCount < 3) {
      return true;
    }

    return false;
  }

  private shouldFallback(context: ErrorContext): boolean {
    // 致命错误应该降级
    if (this.isFatalError(context.error)) {
      return true;
    }

    // 连续错误应该降级
    const key = this.getErrorKey(context);
    const restartCount = this.restartCounts.get(key) || 0;

    return restartCount >= this.config.maxRestarts;
  }

  private isConnectionError(error: Error): boolean {
    return (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOENT') ||
      error.message.includes('spawn') ||
      error.message.includes('connection')
    );
  }

  private isTimeoutError(error: Error): boolean {
    return error.message.includes('timeout') || error.message.includes('Timeout');
  }

  private isParseError(error: Error): boolean {
    return error.message.includes('parse') || error.message.includes('JSON');
  }

  private isFatalError(error: Error): boolean {
    return (
      error.message.includes('fatal') ||
      error.message.includes('crash') ||
      error.message.includes('abort')
    );
  }

  private getErrorKey(context: ErrorContext): string {
    return `${context.workspaceRoot}:${context.language}`;
  }

  private logError(context: ErrorContext): void {
    const logLevel = this.config.logLevel;
    const message = this.formatErrorMessage(context);

    switch (logLevel) {
      case 'ERROR':
        console.error(message);
        break;
      case 'WARN':
        console.warn(message);
        break;
      case 'INFO':
        console.info(message);
        break;
      case 'DEBUG':
        console.debug(message);
        break;
    }
  }

  private formatErrorMessage(context: ErrorContext): string {
    const parts = [
      `[LSP Error] ${context.error.message}`,
      `Language: ${context.language}`,
      `Workspace: ${context.workspaceRoot}`,
    ];

    if (context.method) {
      parts.push(`Method: ${context.method}`);
    }

    if (context.filePath) {
      parts.push(`File: ${context.filePath}`);
    }

    if (context.retryCount) {
      parts.push(`Retry: ${context.retryCount}`);
    }

    return parts.join(' | ');
  }

  getMetrics(): ErrorMetrics {
    return {
      ...this.metrics,
      errorRate: (errorRate: any) => {
        const totalOperations = this.metrics.totalErrors + 100;
        return this.metrics.totalErrors / totalOperations;
      },
    };
  }

  getRecentErrors(limit: number = 10): ErrorContext[] {
    return this.errorLog.slice(-limit);
  }

  getErrorsByLanguage(language: string): ErrorContext[] {
    return this.errorLog.filter(error => error.language === language);
  }

  getErrorsByWorkspace(workspaceRoot: string): ErrorContext[] {
    return this.errorLog.filter(error => error.workspaceRoot === workspaceRoot);
  }

  resetMetrics(): void {
    this.metrics = {
      errorCounts: {},
      errorRate: (errorRate: any) => 0,
      totalErrors: 0,
      connectionErrors: 0,
      timeoutErrors: 0,
      parseErrors: 0,
      otherErrors: 0,
      restartCount: 0,
      fallbackCount: 0,
    };
    this.restartCounts.clear();
    this.errorLog = [];
  }

  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getHealthStatus(): {
    healthy: boolean;
    errorRate: number;
    restartRate: number;
    lastError?: Date;
  } {
    const totalOperations = this.metrics.totalErrors + 100; // 假设基础操作数
    const errorRate = this.metrics.totalErrors / totalOperations;
    const restartRate = this.metrics.restartCount / totalOperations;

    return {
      healthy: errorRate < 0.05 && restartRate < 0.01,
      errorRate,
      restartRate,
      lastError: this.metrics.lastError?.timestamp,
    };
  }

  createErrorContext(
    error: Error,
    workspaceRoot: string,
    language: string,
    method?: string,
    filePath?: string
  ): ErrorContext {
    return {
      error,
      workspaceRoot,
      language,
      method,
      filePath,
      timestamp: new Date(),
      retryCount:
        this.restartCounts.get(
          this.getErrorKey({
            error: new Error(''),
            workspaceRoot,
            language,
            timestamp: new Date(),
          })
        ) || 0,
    };
  }
}

export interface ErrorAction {
  type: 'restart' | 'fallback' | 'skip' | 'retry';
  delay?: number;
  reason?: string;
  retryCount?: number;
}

// 全局错误处理器实例
export const globalErrorHandler = new LSPErrorHandler();
