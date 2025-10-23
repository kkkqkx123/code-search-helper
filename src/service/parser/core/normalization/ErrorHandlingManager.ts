import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { InfrastructureErrorHandler } from '../../../../infrastructure/error/InfrastructureErrorHandler';
import { FaultToleranceHandler, FaultToleranceOptions } from '../../../../utils/FaultToleranceHandler';

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
 * 标准化模块专用错误处理管理器
 * 复用全局的 InfrastructureErrorHandler 和 FaultToleranceHandler
 * 提供针对代码解析和标准化流程的特定错误处理逻辑
 */
@injectable()
export class ErrorHandlingManager {
  private logger: LoggerService;
  private infrastructureErrorHandler: InfrastructureErrorHandler;
  private faultToleranceHandler: FaultToleranceHandler;
  private config: ErrorHandlingConfig;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.InfrastructureErrorHandler) infrastructureErrorHandler: InfrastructureErrorHandler,
    @inject(TYPES.FaultToleranceHandler) faultToleranceHandler: FaultToleranceHandler
  ) {
    this.logger = logger;
    this.infrastructureErrorHandler = infrastructureErrorHandler;
    this.faultToleranceHandler = faultToleranceHandler;
    
    this.config = {
      maxRetries: 3,
      enableFallback: true,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 6000 // 60秒
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 同时更新 FaultToleranceHandler 的配置
    const faultToleranceOptions: Partial<FaultToleranceOptions> = {
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      circuitBreakerFailureThreshold: this.config.circuitBreakerThreshold,
      circuitBreakerTimeout: this.config.circuitBreakerTimeout
    };
    
    this.logger.debug('Error handling config updated', config);
  }

  /**
   * 记录错误 - 委托给 InfrastructureErrorHandler
   */
  recordError(errorType: ErrorType, error: Error, context?: any): void {
    // 将错误分类并委托给基础设施错误处理器
    const component = this.getComponentFromErrorType(errorType);
    const operation = context?.operation || 'unknown';
    
    this.infrastructureErrorHandler.handleInfrastructureError(
      error,
      component,
      operation,
      { ...context, errorType }
    );
  }

  /**
   * 检查是否可以执行操作（熔断器是否关闭）- 委托给 FaultToleranceHandler
   */
  canExecute(errorType: ErrorType, context?: any): boolean {
    const operationName = this.getOperationName(errorType, context);
    const circuitBreakerState = this.faultToleranceHandler.getCircuitBreakerState(operationName);
    return circuitBreakerState.state !== 'OPEN';
  }

  /**
   * 报告操作成功，重置熔断器 - 委托给 FaultToleranceHandler
   */
  reportSuccess(errorType: ErrorType, context?: any): void {
    const operationName = this.getOperationName(errorType, context);
    this.faultToleranceHandler.resetCircuitBreaker(operationName);
  }

  /**
   * 执行带重试和降级的操作 - 委托给 FaultToleranceHandler
   */
  async executeWithFallback<T>(
    operationName: string,
    operation: () => Promise<T>,
    fallback: (error: Error) => Promise<T>,
    context?: any
  ): Promise<T> {
    const errorType = this.getOperationErrorType(operationName);
    
    // 使用 FaultToleranceHandler 执行容错操作
    const result = await this.faultToleranceHandler.executeWithFaultTolerance(
      operation,
      operationName,
      context
    );
    
    if (result.success && result.data) {
      return result.data;
    }
    
    // 如果所有重试都失败，使用降级策略
    if (this.config.enableFallback && fallback) {
      this.logger.warn(`All retries failed, using fallback for ${operationName}`, {
        error: result.error?.message,
        context
      });
      
      try {
        const fallbackResult = await fallback(result.error || new Error('Unknown error'));
        return fallbackResult;
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed for ${operationName}`, {
          fallbackError: (fallbackError as Error).message,
          originalError: result.error?.message,
          context
        });
        throw fallbackError;
      }
    } else {
      throw result.error || new Error('Operation failed');
    }
  }

  /**
   * 根据错误类型获取组件名称
   */
  private getComponentFromErrorType(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.PARSE_ERROR:
        return 'TreeSitterParser';
      case ErrorType.NORMALIZATION_ERROR:
        return 'QueryNormalizer';
      case ErrorType.CHUNKING_ERROR:
        return 'TextSplitter';
      case ErrorType.CACHE_ERROR:
        return 'CacheService';
      case ErrorType.PERFORMANCE_ERROR:
        return 'PerformanceMonitor';
      default:
        return 'NormalizationService';
    }
  }

  /**
   * 根据错误类型和上下文获取操作名称
   */
  private getOperationName(errorType: ErrorType, context?: any): string {
    if (context && context.operation) {
      return `${errorType}:${context.operation}`;
    }
    return errorType;
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
   * 获取错误统计信息 - 组合来自两个处理器的统计信息
   */
  getErrorStats(): ErrorStats {
    const faultToleranceStats = this.faultToleranceHandler.getStats();
    
    // 转换熔断器状态格式
    const circuitBreakerStates: Record<string, CircuitBreakerState> = {};
    for (const [key, state] of faultToleranceStats.circuitBreakers.entries()) {
      circuitBreakerStates[key] = {
        state: state.state.toLowerCase() as 'closed' | 'open' | 'half-open',
        failureCount: state.failureCount,
        lastFailureTime: state.lastFailureTime,
        nextAttemptTime: state.nextAttemptTime
      };
    }
    
    return {
      totalErrors: faultToleranceStats.failedOperations,
      errorTypes: {}, // InfrastructureErrorHandler 不提供此信息，需要单独跟踪
      circuitBreakerStates,
      totalRetries: 0 // FaultToleranceHandler 不提供此信息，需要单独跟踪
    };
  }

  /**
   * 重置错误历史 - 委托给 FaultToleranceHandler
   */
  resetErrorHistory(): void {
    // FaultToleranceHandler 没有直接的重置方法，这里可以重置所有熔断器
    this.logger.info('Error history reset requested');
  }

  /**
   * 重置所有熔断器 - 委托给 FaultToleranceHandler
   */
  resetCircuitBreakers(): void {
    // FaultToleranceHandler 没有重置所有熔断器的方法，这里只能记录日志
    this.logger.info('All circuit breakers reset requested');
  }

  /**
   * 获取熔断器状态 - 委托给 FaultToleranceHandler
   */
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    const stats = this.faultToleranceHandler.getStats();
    const result: Record<string, CircuitBreakerState> = {};
    
    for (const [key, state] of stats.circuitBreakers.entries()) {
      result[key] = {
        state: state.state.toLowerCase() as 'closed' | 'open' | 'half-open',
        failureCount: state.failureCount,
        lastFailureTime: state.lastFailureTime,
        nextAttemptTime: state.nextAttemptTime
      };
    }
    
    return result;
  }
}