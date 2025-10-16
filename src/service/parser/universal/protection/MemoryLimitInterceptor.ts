import { ProtectionInterceptor, ProtectionContext, ProtectionDecision } from './ProtectionInterceptor';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 内存限制配置
 */
export interface MemoryLimitConfig {
  maxMemoryMB: number;        // 最大内存使用限制（MB）
  checkInterval?: number;     // 检查间隔（处理多少行后检查一次）
  warningThreshold?: number;  // 警告阈值（内存使用达到多少百分比时警告）
}

/**
 * 内存限制拦截器
 * 监控内存使用情况，当超过限制时阻止操作
 */
export class MemoryLimitInterceptor implements ProtectionInterceptor {
  private config: MemoryLimitConfig;
  private logger?: LoggerService;
  private checkCounter: number = 0;

  constructor(config: MemoryLimitConfig, logger?: LoggerService) {
    this.config = {
      checkInterval: 1000,      // 默认每1000行检查一次
      warningThreshold: 0.8,    // 默认80%警告
      ...config
    };
    this.logger = logger;
  }

  getName(): string {
    return 'MemoryLimitInterceptor';
  }

  getPriority(): number {
    return 1; // 高优先级，内存保护应该最先检查
  }

  async intercept(context: ProtectionContext): Promise<ProtectionDecision> {
    // 只在特定操作中进行内存检查
    if (!this.shouldCheckMemory(context.operation)) {
      return { shouldProceed: true };
    }

    // 根据配置的检查间隔进行内存检查
    this.checkCounter++;
    if (this.checkCounter % (this.config.checkInterval || 1000) !== 0) {
      // 在间隔内，仍然返回当前的内存信息
      try {
        const currentMemory = process.memoryUsage();
        const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;
        const memoryLimitMB = this.config.maxMemoryMB;
        const usagePercentage = memoryUsageMB / memoryLimitMB;

        return {
          shouldProceed: true,
          metadata: {
            currentMemoryMB: memoryUsageMB,
            memoryLimitMB: memoryLimitMB,
            usagePercentage: usagePercentage,
            skippedDueToInterval: true
          }
        };
      } catch (error) {
        return { shouldProceed: true };
      }
    }

    try {
      const currentMemory = process.memoryUsage();
      const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;
      const memoryLimitMB = this.config.maxMemoryMB;
      const usagePercentage = memoryUsageMB / memoryLimitMB;

      this.logger?.debug(`Memory check: ${memoryUsageMB.toFixed(2)}MB / ${memoryLimitMB}MB (${(usagePercentage * 100).toFixed(1)}%)`);

      // 如果内存使用超过限制
      if (memoryUsageMB > memoryLimitMB) {
        const reason = `Memory limit exceeded: ${memoryUsageMB.toFixed(2)}MB > ${memoryLimitMB}MB`;
        this.logger?.warn(`[MemoryLimitInterceptor] ${reason}`);
        
        return {
          shouldProceed: false,
          reason,
          alternativeAction: 'stop_processing',
          metadata: {
            currentMemoryMB: memoryUsageMB,
            memoryLimitMB: memoryLimitMB,
            usagePercentage: usagePercentage
          }
        };
      }

      // 如果达到警告阈值
      if (usagePercentage > (this.config.warningThreshold || 0.8)) {
        this.logger?.warn(`[MemoryLimitInterceptor] Memory usage warning: ${(usagePercentage * 100).toFixed(1)}% of limit`);
      }

      return {
        shouldProceed: true,
        metadata: {
          currentMemoryMB: memoryUsageMB,
          memoryLimitMB: memoryLimitMB,
          usagePercentage: usagePercentage
        }
      };

    } catch (error) {
      this.logger?.error('[MemoryLimitInterceptor] Error checking memory usage:', error);
      // 内存检查出错时，默认允许继续执行，但记录错误
      return {
        shouldProceed: true,
        reason: 'Memory check failed, allowing to proceed',
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * 判断是否应该进行内存检查
   */
  private shouldCheckMemory(operation: string): boolean {
    // 只在处理大量数据的操作中进行内存检查
    const memorySensitiveOperations = [
      'chunk_text',
      'parse_file',
      'process_content',
      'semantic_chunk',
      'bracket_chunk',
      'line_chunk'
    ];

    return memorySensitiveOperations.includes(operation);
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemoryUsage(): number {
    try {
      const currentMemory = process.memoryUsage();
      return currentMemory.heapUsed / 1024 / 1024; // MB
    } catch (error) {
      this.logger?.error('Error getting current memory usage:', error);
      return 0;
    }
  }

  /**
   * 获取内存使用百分比
   */
  getMemoryUsagePercentage(): number {
    try {
      const currentMemoryMB = this.getCurrentMemoryUsage();
      return currentMemoryMB / this.config.maxMemoryMB;
    } catch (error) {
      this.logger?.error('Error getting memory usage percentage:', error);
      return 0;
    }
  }

  /**
   * 重置检查计数器
   */
  resetCheckCounter(): void {
    this.checkCounter = 0;
    this.logger?.debug('Memory check counter reset');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger?.debug(`Memory limit config updated: ${JSON.stringify(this.config)}`);
  }
}