/**
 * 保护上下文接口
 * 包含保护检查所需的所有上下文信息
 */
export interface IProtectionContext {
  /** 操作类型 */
  operationType: string;
  /** 文件路径 */
  filePath?: string;
  /** 文件内容 */
  content?: string;
  /** 文件大小 */
  fileSize?: number;
  /** 当前内存使用情况 */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers?: number;
  };
  /** 错误统计信息 */
  errorStats?: {
    count: number;
    lastErrorTime: number;
    errorRate: number;
  };
  /** 时间戳 */
  timestamp: Date;
  /** 额外的上下文数据 */
  metadata?: Record<string, any>;
}

/**
 * 保护决策接口
 * 描述保护检查的结果
 */
export interface IProtectionDecision {
  /** 是否允许操作继续 */
  allow: boolean;
  /** 决策原因 */
  reason: string;
  /** 建议的处理策略 */
  recommendedStrategy?: string;
  /** 是否需要降级处理 */
  shouldFallback: boolean;
  /** 额外的决策数据 */
  metadata?: Record<string, any>;
}

/**
 * 保护拦截器接口
 * 定义保护检查的统一契约
 */
export interface IProtectionInterceptor {
  /** 拦截器名称 */
  readonly name: string;
  
  /** 拦截器优先级（数字越小优先级越高） */
  readonly priority: number;
  
  /** 拦截器描述 */
  readonly description: string;
  
  /**
   * 执行保护检查
   * @param context 保护上下文
   * @returns 保护决策
   */
  intercept(context: IProtectionContext): Promise<IProtectionDecision>;
  
  /**
   * 检查拦截器是否适用于当前上下文
   * @param context 保护上下文
   * @returns 是否适用
   */
  isApplicable(context: IProtectionContext): boolean;
  
  /**
   * 检查拦截器是否可用（例如依赖的服务是否可用）
   * @returns 是否可用
   */
  isAvailable(): boolean;
}

/**
 * 保护拦截器链接口
 * 管理多个拦截器的执行顺序和结果聚合
 */
export interface IProtectionInterceptorChain {
  /** 添加拦截器到链中 */
  addInterceptor(interceptor: IProtectionInterceptor): void;
  
  /** 从链中移除拦截器 */
  removeInterceptor(interceptorName: string): void;
  
  /** 执行拦截器链 */
  execute(context: IProtectionContext): Promise<IProtectionDecision>;
  
  /** 获取所有拦截器 */
  getInterceptors(): IProtectionInterceptor[];
  
  /** 清空拦截器链 */
  clear(): void;
}