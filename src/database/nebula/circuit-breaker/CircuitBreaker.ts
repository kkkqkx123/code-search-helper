import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';

// 断路器状态
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',    // 正常状态，允许请求通过
  OPEN = 'OPEN',        // 断开状态，拒绝所有请求
  HALF_OPEN = 'HALF_OPEN' // 半开状态，允许一个请求通过以测试服务是否恢复
}

// 断路器配置
export interface CircuitBreakerConfig {
  failureThreshold: number;    // 失败次数阈值，超过此值断路器打开
  successThreshold: number;    // 成功次数阈值，达到此值断路器关闭
  timeout: number;             // 断路器打开后等待的时间（毫秒）
  expectedErrorRate: number;   // 预期错误率（0-1之间）
}

// 断路器接口
export interface ICircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getState(): CircuitBreakerState;
  forceOpen(): void;
  forceClose(): void;
  forceHalfOpen(): void;
}

// 默认断路器配置
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 60秒
  expectedErrorRate: 0.5
};

/**
 * 断路器实现
 * 为Nebula Graph操作提供断路器保护
 */
@injectable()
export class CircuitBreaker implements ICircuitBreaker {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: NebulaConfigService;
  private config: CircuitBreakerConfig;
  
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };

    this.logger.info('CircuitBreaker initialized', {
      failureThreshold: this.config.failureThreshold,
      successThreshold: this.config.successThreshold,
      timeout: this.config.timeout,
      expectedErrorRate: this.config.expectedErrorRate
    });
  }

  /**
   * 执行操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 检查是否应该打开断路器
    this.checkAndTransitionState();

    switch (this.state) {
      case CircuitBreakerState.OPEN:
        this.logger.warn('Circuit breaker is OPEN, rejecting operation');
        throw new Error('Circuit breaker is OPEN');
      
      case CircuitBreakerState.HALF_OPEN:
        this.logger.debug('Circuit breaker is HALF_OPEN, allowing single operation');
        // 在半开状态下，只允许一个操作通过
        return this.executeOperationInHalfOpen(operation);
      
      case CircuitBreakerState.CLOSED:
      default:
        this.logger.debug('Circuit breaker is CLOSED, executing operation');
        return this.executeOperationInClosed(operation);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitBreakerState {
    // 检查并转换状态
    this.checkAndTransitionState();
    return this.state;
  }

  /**
   * 强制打开断路器
   */
  forceOpen(): void {
    this.logger.warn('Forcing circuit breaker to OPEN state');
    this.transitionToState(CircuitBreakerState.OPEN);
  }

  /**
   * 强制关闭断路器
   */
  forceClose(): void {
    this.logger.info('Forcing circuit breaker to CLOSED state');
    this.transitionToState(CircuitBreakerState.CLOSED);
  }

  /**
   * 强制半开断路器
   */
  forceHalfOpen(): void {
    this.logger.info('Forcing circuit breaker to HALF_OPEN state');
    this.transitionToState(CircuitBreakerState.HALF_OPEN);
  }

  /**
   * 在关闭状态下执行操作
   */
  private async executeOperationInClosed<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      
      // 操作成功，重置失败计数
      this.onSuccess();
      
      return result;
    } catch (error) {
      // 操作失败，增加失败计数
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * 在半开状态下执行操作
   */
  private async executeOperationInHalfOpen<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      
      // 操作成功，重置计数并关闭断路器
      this.onSuccess();
      this.transitionToState(CircuitBreakerState.CLOSED);
      
      return result;
    } catch (error) {
      // 操作失败，增加失败计数并保持打开状态
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * 操作成功处理
   */
  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0; // 重置失败计数
    
    this.logger.debug('Operation succeeded', {
      successCount: this.successCount,
      failureCount: this.failureCount
    });
    
    // 如果成功次数达到阈值，关闭断路器
    if (this.state === CircuitBreakerState.HALF_OPEN && this.successCount >= this.config.successThreshold) {
      this.logger.info('Success threshold reached, closing circuit breaker');
      this.transitionToState(CircuitBreakerState.CLOSED);
    }
  }

  /**
   * 操作失败处理
   */
  private onFailure(error: any): void {
    this.failureCount++;
    this.successCount = 0; // 重置成功计数
    
    this.lastFailureTime = Date.now();
    
    this.logger.warn('Operation failed', {
      failureCount: this.failureCount,
      error: error instanceof Error ? error.message : String(error),
      failureThreshold: this.config.failureThreshold
    });
    
    // 如果失败次数达到阈值，打开断路器
    if (this.failureCount >= this.config.failureThreshold) {
      this.logger.warn('Failure threshold reached, opening circuit breaker');
      this.transitionToState(CircuitBreakerState.OPEN);
    }
  }

  /**
   * 检查并转换状态
   */
  private checkAndTransitionState(): void {
    if (this.state === CircuitBreakerState.OPEN && this.lastFailureTime) {
      const timeElapsed = Date.now() - this.lastFailureTime;
      
      if (timeElapsed >= this.config.timeout) {
        this.logger.info('Timeout elapsed, transitioning to HALF_OPEN state');
        this.transitionToState(CircuitBreakerState.HALF_OPEN);
      }
    }
  }

  /**
   * 转换到指定状态
   */
  private transitionToState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    
    if (oldState === newState) {
      return; // 已经是目标状态
    }
    
    this.logger.info('Circuit breaker state transition', {
      from: oldState,
      to: newState
    });
    
    // 清除之前的定时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.state = newState;
    
    // 根据新状态执行特定操作
    switch (newState) {
      case CircuitBreakerState.OPEN:
        // 记录最后失败时间
        this.lastFailureTime = Date.now();
        break;
        
      case CircuitBreakerState.HALF_OPEN:
        // 重置成功计数
        this.successCount = 0;
        break;
        
      case CircuitBreakerState.CLOSED:
        // 重置所有计数
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        break;
    }
    
    // 发布状态变更事件
    this.logger.debug('Circuit breaker state changed', {
      state: newState,
      failureCount: this.failureCount,
      successCount: this.successCount
    });
  }

  /**
   * 获取断路器统计信息
   */
  getStats(): { 
    state: CircuitBreakerState; 
    failureCount: number; 
    successCount: number; 
    lastFailureTime: number | null 
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}