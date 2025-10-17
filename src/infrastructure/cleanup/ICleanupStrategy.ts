/**
 * 清理上下文接口
 * 包含清理操作所需的所有上下文信息
 */
export interface ICleanupContext {
  /** 触发清理的原因 */
  triggerReason: string;
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
 * 清理结果接口
 * 描述清理操作的执行结果
 */
export interface ICleanupResult {
  /** 清理是否成功 */
  success: boolean;
  /** 清理的缓存类型 */
  cleanedCaches: string[];
  /** 释放的内存大小（字节） */
  memoryFreed: number;
  /** 清理操作耗时（毫秒） */
  duration: number;
  /** 错误信息（如果清理失败） */
  error?: Error;
  /** 额外的结果数据 */
  metadata?: Record<string, any>;
}

/**
 * 清理策略接口
 * 定义各种清理策略的统一契约
 */
export interface ICleanupStrategy {
  /** 策略名称 */
  readonly name: string;
  
  /** 策略优先级（数字越小优先级越高） */
  readonly priority: number;
  
  /** 策略描述 */
  readonly description: string;
  
  /**
   * 检查策略是否适用于当前上下文
   * @param context 清理上下文
   * @returns 是否适用
   */
  isApplicable(context: ICleanupContext): boolean;
  
  /**
   * 执行清理操作
   * @param context 清理上下文
   * @returns 清理结果
   */
  cleanup(context: ICleanupContext): Promise<ICleanupResult>;
  
  /**
   * 估算清理效果
   * @param context 清理上下文
   * @returns 预估释放的内存大小（字节）
   */
  estimateCleanupImpact(context: ICleanupContext): number;
  
  /**
   * 检查策略是否可用（例如依赖的服务是否可用）
   * @returns 是否可用
   */
  isAvailable(): boolean;
}