import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟时间（毫秒） */
  baseDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 退避因子 */
  backoffFactor: number;
  /** 是否启用抖动 */
  enableJitter: boolean;
  /** 重试条件函数 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * 重试结果接口
 */
export interface RetryResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  result?: T;
  /** 错误信息 */
  error?: Error;
  /** 尝试次数 */
  attempts: number;
  /** 总耗时 */
  totalDuration: number;
}

/**
 * Graph模块重试服务
 * 提供智能重试机制，支持指数退避和抖动
 */
@injectable()
export class GraphRetryService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    operationName: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        this.logger.debug(`Executing operation ${operationName}`, {
          operationName,
          attempt,
          maxRetries: config.maxRetries
        });

        const result = await operation();
        const duration = Date.now() - startTime;

        if (attempt > 1) {
          this.logger.info(`Operation ${operationName} succeeded after ${attempt} attempts`, {
            operationName,
            attempts: attempt,
            duration
          });
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration: duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        this.logger.warn(`Operation ${operationName} failed on attempt ${attempt}`, {
          operationName,
          attempt,
          error: lastError.message,
          errorType: lastError.constructor.name
        });

        // 检查是否应该重试
        if (attempt > config.maxRetries || !this.shouldRetry(lastError, attempt, config)) {
          break;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt - 1, config);
        
        this.logger.debug(`Waiting ${delay}ms before retry`, {
          operationName,
          attempt,
          delay
        });

        await this.sleep(delay);
      }
    }

    const duration = Date.now() - startTime;
    
    this.logger.error(`Operation ${operationName} failed after ${config.maxRetries + 1} attempts`, {
      operationName,
      attempts: config.maxRetries + 1,
      duration,
      finalError: lastError?.message
    });

    return {
      success: false,
      error: lastError,
      attempts: config.maxRetries + 1,
      totalDuration: duration
    };
  }

  /**
   * 批量重试操作
   */
  async executeBatchWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    config: RetryConfig,
    operationName: string
  ): Promise<{
    results: Array<RetryResult<R>>;
    successCount: number;
    failureCount: number;
  }> {
    const results: Array<RetryResult<R>> = [];
    let successCount = 0;
    let failureCount = 0;

    this.logger.info(`Starting batch retry operation ${operationName}`, {
      operationName,
      itemCount: items.length,
      maxRetries: config.maxRetries
    });

    for (const item of items) {
      const result = await this.executeWithRetry(
        () => processor(item),
        config,
        `${operationName} (item: ${JSON.stringify(item).substring(0, 100)})`
      );

      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    this.logger.info(`Completed batch retry operation ${operationName}`, {
      operationName,
      itemCount: items.length,
      successCount,
      failureCount,
      successRate: items.length > 0 ? (successCount / items.length) * 100 : 0
    });

    return {
      results,
      successCount,
      failureCount
    };
  }

  /**
   * 并发批量重试操作
   */
  async executeConcurrentBatchWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    config: RetryConfig,
    operationName: string,
    concurrency: number = 3
  ): Promise<{
    results: Array<RetryResult<R>>;
    successCount: number;
    failureCount: number;
  }> {
    const results: Array<RetryResult<R>> = [];
    
    this.logger.info(`Starting concurrent batch retry operation ${operationName}`, {
      operationName,
      itemCount: items.length,
      concurrency,
      maxRetries: config.maxRetries
    });

    // 分批处理
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (item) => {
        return this.executeWithRetry(
          () => processor(item),
          config,
          `${operationName} (item: ${JSON.stringify(item).substring(0, 100)})`
        );
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          results.push({
            success: false,
            error: promiseResult.reason instanceof Error ? promiseResult.reason : new Error(String(promiseResult.reason)),
            attempts: config.maxRetries + 1,
            totalDuration: 0
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    this.logger.info(`Completed concurrent batch retry operation ${operationName}`, {
      operationName,
      itemCount: items.length,
      concurrency,
      successCount,
      failureCount,
      successRate: items.length > 0 ? (successCount / items.length) * 100 : 0
    });

    return {
      results,
      successCount,
      failureCount
    };
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error, attempt: number, config: RetryConfig): boolean {
    // 如果有自定义重试条件，使用它
    if (config.shouldRetry) {
      return config.shouldRetry(error, attempt);
    }

    // 默认重试条件
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_ERROR'
    ];

    const errorMessage = error.message.toUpperCase();
    const errorName = error.constructor.name.toUpperCase();

    // 检查是否为可重试的错误
    const isRetryableError = retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError) || errorName.includes(retryableError)
    );

    // 检查是否为特定的错误类型
    const isRetryableType = 
      error.name === 'TypeError' ||
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      (error as any).code === 'ECONNRESET' ||
      (error as any).code === 'ETIMEDOUT';

    return isRetryableError || isRetryableType;
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // 指数退避
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    
    // 限制最大延迟
    delay = Math.min(delay, config.maxDelay);
    
    // 添加抖动
    if (config.enableJitter) {
      const jitter = delay * 0.1 * Math.random(); // 10% 抖动
      delay += jitter;
    }
    
    return Math.round(delay);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取默认重试配置
   */
  getDefaultRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      enableJitter: true
    };
  }

  /**
   * 获取快速重试配置（用于快速失败场景）
   */
  getFastRetryConfig(): RetryConfig {
    return {
      maxRetries: 1,
      baseDelay: 500,
      maxDelay: 2000,
      backoffFactor: 1.5,
      enableJitter: false
    };
  }

  /**
   * 获取慢速重试配置（用于重要操作）
   */
  getSlowRetryConfig(): RetryConfig {
    return {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffFactor: 2,
      enableJitter: true
    };
  }

  /**
   * 创建自定义重试配置
   */
  createRetryConfig(overrides: Partial<RetryConfig>): RetryConfig {
    const defaultConfig = this.getDefaultRetryConfig();
    return { ...defaultConfig, ...overrides };
  }
}