import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 保护拦截器上下文
 */
export interface ProtectionContext {
  operation: string;           // 操作名称
  filePath?: string;          // 文件路径
  content?: string;           // 内容
  language?: string;          // 语言类型
  metadata?: Record<string, any>; // 元数据
}

/**
 * 保护决策结果
 */
export interface ProtectionDecision {
  shouldProceed: boolean;     // 是否应该继续执行
  reason?: string;           // 决策原因
  alternativeAction?: string; // 替代操作
  metadata?: Record<string, any>; // 决策元数据
}

/**
 * 保护拦截器接口
 */
export interface ProtectionInterceptor {
  /**
   * 拦截并检查操作
   */
  intercept(context: ProtectionContext): Promise<ProtectionDecision> | ProtectionDecision;
  
  /**
   * 获取拦截器名称
   */
  getName(): string;
  
  /**
   * 获取拦截器优先级（数字越小优先级越高）
   */
  getPriority(): number;
}

/**
 * 保护拦截器链
 */
export class ProtectionInterceptorChain {
  private interceptors: ProtectionInterceptor[] = [];
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 添加拦截器
   */
  addInterceptor(interceptor: ProtectionInterceptor): void {
    this.interceptors.push(interceptor);
    // 按优先级排序
    this.interceptors.sort((a, b) => a.getPriority() - b.getPriority());
    this.logger?.debug(`Added protection interceptor: ${interceptor.getName()} (priority: ${interceptor.getPriority()})`);
  }

  /**
   * 移除拦截器
   */
  removeInterceptor(interceptor: ProtectionInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index !== -1) {
      this.interceptors.splice(index, 1);
      this.logger?.debug(`Removed protection interceptor: ${interceptor.getName()}`);
    }
  }

  /**
   * 执行拦截器链
   */
  async execute(context: ProtectionContext): Promise<ProtectionDecision> {
    this.logger?.debug(`Executing protection interceptor chain for operation: ${context.operation}`);
    
    for (const interceptor of this.interceptors) {
      try {
        const decision = await interceptor.intercept(context);
        this.logger?.debug(`Interceptor ${interceptor.getName()} decision: ${decision.shouldProceed ? 'PROCEED' : 'BLOCK'}${decision.reason ? ` - ${decision.reason}` : ''}`);
        
        if (!decision.shouldProceed) {
          // 如果有拦截器阻止，立即返回
          return decision;
        }
      } catch (error) {
        this.logger?.error(`Error in protection interceptor ${interceptor.getName()}:`, error);
        // 拦截器出错时，默认允许继续执行，但记录错误
        continue;
      }
    }
    
    // 所有拦截器都通过，允许继续执行
    return {
      shouldProceed: true,
      reason: 'All protection checks passed'
    };
  }

  /**
   * 获取所有拦截器
   */
  getInterceptors(): ProtectionInterceptor[] {
    return [...this.interceptors];
  }

  /**
   * 清空所有拦截器
   */
  clear(): void {
    this.interceptors = [];
    this.logger?.debug('Cleared all protection interceptors');
  }
}