import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ErrorClassifier, ErrorType, ErrorContext } from './ErrorClassifier';
import { TYPES } from '../../types';

export interface OperationContext {
  operationType: string;
  resourceName: string;
  timeout?: number;
  retryOptions?: RetryOptions;
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

export interface OperationResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  duration: number;
}

/**
 * 可靠性管理器 - 集中管理重试、熔断器等可靠性策略
 */
@injectable()
export class ReliabilityManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryManager: RetryManager;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.retryManager = new RetryManager();
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * 执行带可靠性保护的操作
   */
  async executeWithReliability<T>(
    operation: () => Promise<T>,
    context: OperationContext
  ): Promise<T> {
    const startTime = Date.now();
    const circuitBreaker = this.getOrCreateCircuitBreaker(context.resourceName, context.circuitBreakerOptions);
    
    try {
      // 通过熔断器执行操作
      const result = await circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(operation, context);
      });

      // 记录成功指标
      this.performanceMonitor.recordSuccess(context.operationType, Date.now() - startTime);
      
      return result;
    } catch (error) {
      // 记录失败指标
      this.performanceMonitor.recordFailure(context.operationType, Date.now() - startTime);
      
      // 处理错误
      await this.handleOperationError(error as Error, context);
      throw error;
    }
  }

  /**
   * 获取或创建熔断器
   */
  private getOrCreateCircuitBreaker(resourceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.circuitBreakers.has(resourceName)) {
      this.circuitBreakers.set(resourceName, new CircuitBreaker(
        this.logger,
        resourceName,
        options
      ));
    }
    return this.circuitBreakers.get(resourceName)!;
  }

  /**
   * 处理操作错误
   */
  private async handleOperationError(error: Error, context: OperationContext): Promise<void> {
    const errorReport = ErrorClassifier.createErrorReport(error, {
      component: 'ReliabilityManager',
      operation: context.operationType,
      metadata: { resourceName: context.resourceName }
    });

    this.logger.warn('Operation failed with reliability protection', {
      errorType: errorReport.type,
      operation: context.operationType,
      resourceName: context.resourceName,
      retryable: errorReport.retryable,
      maxRetries: errorReport.maxRetries
    });

    // 使用错误处理服务处理错误
    this.errorHandler.handleError(error, {
      component: 'ReliabilityManager',
      operation: context.operationType,
      metadata: {
        resourceName: context.resourceName,
        errorType: errorReport.type,
        retryable: errorReport.retryable
      }
    });
  }

  /**
   * 获取可靠性统计
   */
  getReliabilityStats(): {
    circuitBreakers: Map<string, CircuitBreakerState>;
    performance: {
      totalOperations: number;
      successRate: number;
      averageDuration: number;
    };
  } {
    const circuitBreakerStats = new Map<string, CircuitBreakerState>();
    
    for (const [name, breaker] of this.circuitBreakers) {
      circuitBreakerStats.set(name, breaker.getState());
    }

    return {
      circuitBreakers: circuitBreakerStats,
      performance: this.performanceMonitor.getStats()
    };
  }

  /**
   * 重置所有熔断器
   */
  resetAllCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
    this.logger.info('All circuit breakers have been reset');
  }

  /**
   * 重置特定资源的熔断器
   */
  resetCircuitBreaker(resourceName: string): void {
    const breaker = this.circuitBreakers.get(resourceName);
    if (breaker) {
      breaker.reset();
      this.logger.info(`Circuit breaker for ${resourceName} has been reset`);
    }
  }
}

/**
 * 重试管理器
 */
class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: OperationContext
  ): Promise<T> {
    const retryOptions = context.retryOptions || {};
    const maxAttempts = retryOptions.maxAttempts || 3;
    const baseDelay = retryOptions.baseDelay || 1000;
    const maxDelay = retryOptions.maxDelay || 30000;
    const backoffMultiplier = retryOptions.backoffMultiplier || 2;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxAttempts) {
          break; // 最后一次尝试，不再重试
        }

        // 检查是否可重试
        if (!ErrorClassifier.isRetryable(lastError)) {
          break;
        }

        // 计算延迟
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * 熔断器
 */
class CircuitBreaker {
  private logger: LoggerService;
  private resourceName: string;
  private options: Required<CircuitBreakerOptions>;
  private state: CircuitBreakerState;

  constructor(
    logger: LoggerService,
    resourceName: string,
    options?: CircuitBreakerOptions
  ) {
    this.logger = logger;
    this.resourceName = resourceName;
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      recoveryTimeout: options?.recoveryTimeout || 60000,
      monitoringPeriod: options?.monitoringPeriod || 10000
    };

    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailureTime > this.options.recoveryTimeout) {
        this.state.state = 'HALF_OPEN';
        this.state.successCount = 0;
        this.logger.info(`Circuit breaker for ${this.resourceName} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.resourceName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failureCount = 0;
    
    if (this.state.state === 'HALF_OPEN') {
      this.state.successCount++;
      if (this.state.successCount >= 3) { // 连续3次成功后关闭熔断器
        this.state.state = 'CLOSED';
        this.logger.info(`Circuit breaker for ${this.resourceName} closed after successful recovery`);
      }
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.options.failureThreshold) {
      this.state.state = 'OPEN';
      this.logger.warn(`Circuit breaker for ${this.resourceName} opened due to ${this.state.failureCount} failures`);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0
    };
    this.logger.info(`Circuit breaker for ${this.resourceName} has been reset`);
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private operations: Map<string, { success: number; failure: number; totalDuration: number }> = new Map();

  recordSuccess(operationType: string, duration: number): void {
    const stats = this.operations.get(operationType) || { success: 0, failure: 0, totalDuration: 0 };
    stats.success++;
    stats.totalDuration += duration;
    this.operations.set(operationType, stats);
  }

  recordFailure(operationType: string, duration: number): void {
    const stats = this.operations.get(operationType) || { success: 0, failure: 0, totalDuration: 0 };
    stats.failure++;
    stats.totalDuration += duration;
    this.operations.set(operationType, stats);
  }

  getStats(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
  } {
    let totalOperations = 0;
    let totalSuccesses = 0;
    let totalDuration = 0;

    for (const stats of this.operations.values()) {
      totalOperations += stats.success + stats.failure;
      totalSuccesses += stats.success;
      totalDuration += stats.totalDuration;
    }

    return {
      totalOperations,
      successRate: totalOperations > 0 ? totalSuccesses / totalOperations : 0,
      averageDuration: totalOperations > 0 ? totalDuration / totalOperations : 0
    };
  }
}