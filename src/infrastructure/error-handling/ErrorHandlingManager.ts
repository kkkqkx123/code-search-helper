import { injectable } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';

export enum ErrorType {
  PARSE_ERROR = 'parse_error',
  NORMALIZATION_ERROR = 'normalization_error',
  CHUNKING_ERROR = 'chunking_error',
  CACHE_ERROR = 'cache_error',
  PERFORMANCE_ERROR = 'performance_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface ErrorHandlingConfig {
  maxRetries: number;
  enableFallback: boolean;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
 lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export interface ErrorStats {
  totalErrors: number;
 errorTypes: Record<string, number>;
  circuitBreakerStates: Record<string, CircuitBreakerState>;
  totalRetries: number;
}

/**
 * 错误处理和降级管理器
 * 提供错误处理、重试机制、熔断器和降级策略
 */
@injectable()
export class ErrorHandlingManager {
  private logger: LoggerService;
  private config: ErrorHandlingConfig;
  private errorHistory: Array<{
    error: Error;
    type: ErrorType;
    timestamp: number;
    context: any;
  }>;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private retryCounters: Map<string, number>;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.config = {
      maxRetries: 3,
      enableFallback: true,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 6000 // 60秒
    };
    this.errorHistory = [];
    this.circuitBreakers = new Map();
    this.retryCounters = new Map();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Error handling config updated', config);
 }

  /**
   * 记录错误
   */
  recordError(errorType: ErrorType, error: Error, context?: any): void {
    this.errorHistory.push({
      error,
      type: errorType,
      timestamp: Date.now(),
      context
    });

    // 限制错误历史记录大小
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-500); // 保留最近500个错误
    }

    this.logger.error(`Error recorded: ${errorType}`, {
      message: error.message,
      stack: error.stack,
      context
    });

    // 更新熔断器状态
    this.updateCircuitBreaker(errorType, error, context);
  }

  /**
   * 更新熔断器状态
   */
  private updateCircuitBreaker(errorType: ErrorType, error: Error, context?: any): void {
    const key = this.getCircuitBreakerKey(errorType, context);
    let state = this.circuitBreakers.get(key) || {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    // 增加失败计数
    state.failureCount++;
    state.lastFailureTime = Date.now();

    // 如果失败次数超过阈值，打开熔断器
    if (state.failureCount >= this.config.circuitBreakerThreshold) {
      state.state = 'open';
      state.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
      this.logger.warn(`Circuit breaker opened for ${key}`, { errorType, context });
    }

    this.circuitBreakers.set(key, state);
  }

  /**
   * 检查是否可以执行操作（熔断器是否关闭）
   */
  canExecute(errorType: ErrorType, context?: any): boolean {
    const key = this.getCircuitBreakerKey(errorType, context);
    const state = this.circuitBreakers.get(key);

    if (!state) {
      return true; // 没有熔断器记录，可以执行
    }

    // 如果是开启状态，检查是否可以尝试
    if (state.state === 'open') {
      if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime) {
        // 进入半开状态，允许一次尝试
        state.state = 'half-open';
        this.logger.info(`Circuit breaker in half-open state for ${key}`);
        return true;
      }
      return false; // 仍然开启，不能执行
    }

    return true; // 熔断器关闭，可以执行
  }

  /**
   * 报告操作成功，重置熔断器
   */
  reportSuccess(errorType: ErrorType, context?: any): void {
    const key = this.getCircuitBreakerKey(errorType, context);
    const state = this.circuitBreakers.get(key);

    if (state && state.state !== 'closed') {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureTime = null;
      state.nextAttemptTime = null;
      this.logger.info(`Circuit breaker closed for ${key}`);
    }
  }

 /**
   * 获取熔断器键
   */
  private getCircuitBreakerKey(errorType: ErrorType, context?: any): string {
    if (context && context.operation) {
      return `${errorType}:${context.operation}`;
    }
    return errorType;
  }

  /**
   * 执行带重试和降级的操作
   */
  async executeWithFallback<T>(
    operationName: string,
    operation: () => Promise<T>,
    fallback: (error: Error) => Promise<T>,
    context?: any
  ): Promise<T> {
    const errorType = this.getOperationErrorType(operationName);
    const retryKey = `${operationName}:${JSON.stringify(context || {})}`;

    // 检查熔断器
    if (!this.canExecute(errorType, context)) {
      this.logger.warn(`Circuit breaker is open, using fallback for ${operationName}`, { context });
      return await fallback(new Error(`Circuit breaker is open for ${operationName}`));
    }

    let lastError: Error | null = null;

    // 执行重试逻辑
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.reportSuccess(errorType, context);
        this.retryCounters.delete(retryKey); // 重置重试计数
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordError(errorType, lastError, { ...context, attempt });

        // 如果是最后一次尝试，执行降级策略
        if (attempt === this.config.maxRetries) {
          break;
        }

        // 更新重试计数
        const currentRetryCount = this.retryCounters.get(retryKey) || 0;
        this.retryCounters.set(retryKey, currentRetryCount + 1);

        // 等待后重试
        await this.delay(this.config.retryDelay * Math.pow(2, attempt)); // 指数退避
      }
    }

    // 如果启用了降级且有降级函数，使用降级
    if (this.config.enableFallback && fallback) {
      this.logger.warn(`All retries failed, using fallback for ${operationName}`, {
        error: lastError?.message,
        context
      });
      try {
        const fallbackResult = await fallback(lastError!);
        return fallbackResult;
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed for ${operationName}`, {
          fallbackError: (fallbackError as Error).message,
          originalError: lastError?.message,
          context
        });
        throw fallbackError;
      }
    } else {
      throw lastError;
    }
  }

 /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 根据操作名称获取错误类型
   */
  private getOperationErrorType(operationName: string): ErrorType {
    if (operationName.includes('parse') || operationName.includes('tree-sitter')) {
      return ErrorType.PARSE_ERROR;
    } else if (operationName.includes('normalize') || operationName.includes('query')) {
      return ErrorType.NORMALIZATION_ERROR;
    } else if (operationName.includes('chunk') || operationName.includes('split')) {
      return ErrorType.CHUNKING_ERROR;
    } else if (operationName.includes('cache')) {
      return ErrorType.CACHE_ERROR;
    } else if (operationName.includes('performance') || operationName.includes('monitor')) {
      return ErrorType.PERFORMANCE_ERROR;
    } else {
      return ErrorType.UNKNOWN_ERROR;
    }
 }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): ErrorStats {
    const errorTypes: Record<string, number> = {};
    let totalErrors = 0;

    for (const errorRecord of this.errorHistory) {
      const type = errorRecord.type;
      errorTypes[type] = (errorTypes[type] || 0) + 1;
      totalErrors++;
    }

    let totalRetries = 0;
    for (const count of this.retryCounters.values()) {
      totalRetries += count;
    }

    return {
      totalErrors,
      errorTypes,
      circuitBreakerStates: Object.fromEntries(this.circuitBreakers.entries()),
      totalRetries
    };
 }

  /**
   * 重置错误历史
   */
  resetErrorHistory(): void {
    this.errorHistory = [];
    this.logger.info('Error history reset');
  }

 /**
   * 重置所有熔断器
   */
  resetCircuitBreakers(): void {
    for (const [key, state] of this.circuitBreakers.entries()) {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureTime = null;
      state.nextAttemptTime = null;
      this.circuitBreakers.set(key, state);
    }
    this.logger.info('All circuit breakers reset');
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.circuitBreakers.entries());
  }
}