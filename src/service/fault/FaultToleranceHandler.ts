import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { TransactionLogger } from '../transaction/TransactionLogger';
import { GraphMappingCache } from '../graph/caching/GraphMappingCache';

export interface FaultToleranceOptions {
  maxRetries: number;
  retryDelay: number; // 毫秒
  exponentialBackoff: boolean;
  circuitBreakerEnabled: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeout: number; // 毫秒
  fallbackStrategy: 'cache' | 'default' | 'error';
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  retries: number;
  circuitBreakerState?: CircuitBreakerState;
}

@injectable()
export class FaultToleranceHandler {
  private logger: LoggerService;
  private transactionLogger: TransactionLogger;
  private cache: GraphMappingCache;
  private options: FaultToleranceOptions;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.TransactionLogger) transactionLogger: TransactionLogger,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    options?: Partial<FaultToleranceOptions>
  ) {
    this.logger = logger;
    this.transactionLogger = transactionLogger;
    this.cache = cache;

    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      circuitBreakerFailureThreshold: 5,
      circuitBreakerTimeout: 3000,
      fallbackStrategy: 'cache',
      ...options
    };

    this.logger.info('FaultToleranceHandler initialized', { options: this.options });
  }

  /**
   * 执行带有容错机制的操作
   */
  async executeWithFaultTolerance<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: Error | null = null;

    // 检查断路器状态
    if (this.options.circuitBreakerEnabled) {
      const breakerState = this.getCircuitBreakerState(operationName);
      if (breakerState.state === 'OPEN') {
        // 断路器打开，尝试使用降级策略
        this.logger.warn('Circuit breaker is open, using fallback', { operationName });

        const fallbackResult = await this.getFallbackResult<T>(operationName, context);
        return {
          success: fallbackResult !== undefined,
          data: fallbackResult,
          error: new Error(`Circuit breaker is open for operation: ${operationName}`),
          retries: 0,
          circuitBreakerState: breakerState
        };
      } else if (breakerState.state === 'HALF_OPEN') {
        // 半开状态，尝试执行操作
        try {
          const result = await operation();
          this.onSuccess(operationName);
          return {
            success: true,
            data: result,
            retries: 0,
            circuitBreakerState: this.getCircuitBreakerState(operationName)
          };
        } catch (error) {
          this.onFailure(operationName, error as Error);
          const fallbackResult = await this.getFallbackResult<T>(operationName, context);
          return {
            success: false,
            error: error as Error,
            data: fallbackResult,
            retries: 0,
            circuitBreakerState: this.getCircuitBreakerState(operationName)
          };
        }
      }
    }

    // 执行带重试的操作
    while (retries <= this.options.maxRetries) {
      try {
        const result = await operation();

        // 操作成功，重置断路器
        if (this.options.circuitBreakerEnabled) {
          this.onSuccess(operationName);
        }

        this.logger.debug('Operation succeeded', {
          operationName,
          retries,
          duration: Date.now() - startTime
        });

        return {
          success: true,
          data: result,
          retries,
          circuitBreakerState: this.options.circuitBreakerEnabled
            ? this.getCircuitBreakerState(operationName)
            : undefined
        };
      } catch (error) {
        lastError = error as Error;
        retries++;

        this.logger.warn('Operation failed, scheduling retry', {
          operationName,
          retry: retries,
          maxRetries: this.options.maxRetries,
          error: (error as Error).message
        });

        // 记录事务日志
        await this.transactionLogger.logTransaction(
          `retry_${operationName}_${retries}`,
          operationName,
          'unknown' as any, // 实际中应根据具体情况设置
          'failed',
          {
            retryAttempt: retries,
            error: (error as Error).message,
            context
          },
          (error as Error).message
        );

        if (retries <= this.options.maxRetries) {
          // 计算延迟时间（支持指数退避）
          const delay = this.options.exponentialBackoff
            ? this.options.retryDelay * Math.pow(2, retries - 1)
            : this.options.retryDelay;

          await this.delay(delay);
        }
      }
    }

    // 所有重试都失败了
    if (this.options.circuitBreakerEnabled) {
      this.onFailure(operationName, lastError!);
    }

    // 尝试使用降级策略
    const fallbackResult = await this.getFallbackResult<T>(operationName, context);

    this.logger.error('All retry attempts failed', {
      operationName,
      error: lastError?.message
    });

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      data: fallbackResult,
      retries: this.options.maxRetries,
      circuitBreakerState: this.options.circuitBreakerEnabled
        ? this.getCircuitBreakerState(operationName)
        : undefined
    };
  }

  /**
   * 执行批量操作的容错处理
   */
  async executeBatchWithFaultTolerance<T>(
    operations: Array<() => Promise<T>>,
    operationName: string
  ): Promise<OperationResult<T>[]> {
    const results: OperationResult<T>[] = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const result = await this.executeWithFaultTolerance(
        operation,
        `${operationName}_batch_${i}`,
        { batchIndex: i, total: operations.length }
      );
      results.push(result);
    }

    const successfulCount = results.filter(r => r.success).length;
    const failedCount = results.length - successfulCount;

    this.logger.info('Batch operation completed', {
      operationName,
      totalOperations: operations.length,
      successful: successfulCount,
      failed: failedCount
    });

    return results;
  }

  /**
   * 获取断路器状态
   */
  getCircuitBreakerState(operationName: string): CircuitBreakerState {
    if (!this.options.circuitBreakerEnabled) {
      return {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
    }

    let state = this.circuitBreakers.get(operationName);
    if (!state) {
      state = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
      this.circuitBreakers.set(operationName, state);
    }

    // 检查是否应该从OPEN状态转换为HALF_OPEN状态
    if (state.state === 'OPEN' && state.nextAttemptTime && Date.now() >= state.nextAttemptTime) {
      state.state = 'HALF_OPEN';
      this.logger.debug('Circuit breaker transitioning to HALF_OPEN', { operationName });
    }

    return state;
  }

  /**
   * 手动打开断路器
   */
  openCircuitBreaker(operationName: string, reason: string): void {
    if (!this.options.circuitBreakerEnabled) return;

    const state: CircuitBreakerState = {
      state: 'OPEN',
      failureCount: this.options.circuitBreakerFailureThreshold, // 达到阈值
      lastFailureTime: Date.now(),
      nextAttemptTime: Date.now() + this.options.circuitBreakerTimeout
    };

    this.circuitBreakers.set(operationName, state);
    this.logger.warn('Circuit breaker manually opened', { operationName, reason });
  }

  /**
   * 重置断路器
   */
  resetCircuitBreaker(operationName: string): void {
    if (!this.options.circuitBreakerEnabled) return;

    this.circuitBreakers.set(operationName, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    });

    this.logger.debug('Circuit breaker reset', { operationName });
  }

  private onSuccess(operationName: string): void {
    if (!this.options.circuitBreakerEnabled) return;

    const state = this.circuitBreakers.get(operationName) || {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    // 成功时重置失败计数
    state.failureCount = 0;
    state.state = 'CLOSED';
    state.lastFailureTime = null;
    state.nextAttemptTime = null;

    this.circuitBreakers.set(operationName, state);
  }

  private onFailure(operationName: string, error: Error): void {
    if (!this.options.circuitBreakerEnabled) return;

    let state = this.circuitBreakers.get(operationName);
    if (!state) {
      state = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      };
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    // 检查是否超过失败阈值
    if (state.failureCount >= this.options.circuitBreakerFailureThreshold) {
      state.state = 'OPEN';
      state.nextAttemptTime = Date.now() + this.options.circuitBreakerTimeout;
      this.logger.warn('Circuit breaker opened due to failures', {
        operationName,
        failureCount: state.failureCount,
        error: error.message
      });
    }

    this.circuitBreakers.set(operationName, state);
  }

  private async getFallbackResult<T>(operationName: string, context?: any): Promise<T | undefined> {
    switch (this.options.fallbackStrategy) {
      case 'cache':
        // 尝试从缓存获取结果
        if (context && context.cacheKey) {
          try {
            const cachedResult = await this.cache.getFileAnalysis(context.cacheKey);
            if (cachedResult) {
              this.logger.debug('Using cached fallback result', { operationName, cacheKey: context.cacheKey });
              return cachedResult as T;
            }
          } catch (cacheError) {
            this.logger.warn('Cache fallback failed', {
              operationName,
              error: (cacheError as Error).message
            });
          }
        }
        return undefined;

      case 'default':
        // 返回默认值（根据操作类型返回合适的默认值）
        return undefined; // 实际实现中可能需要根据操作类型返回特定的默认值

      case 'error':
        // 不使用降级，直接抛出错误
        return undefined;

      default:
        return undefined;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取容错统计信息
   */
  getStats(): {
    circuitBreakers: Map<string, CircuitBreakerState>;
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
  } {
    // 实际实现中可能需要跟踪操作计数
    return {
      circuitBreakers: new Map(this.circuitBreakers),
      totalOperations: 0, // 需要实际实现计数逻辑
      successfulOperations: 0,
      failedOperations: 0
    };
  }
}