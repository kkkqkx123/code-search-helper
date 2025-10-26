import { injectable, inject } from 'inversify';
import { IProtectionCoordinator, SegmentationContext } from '../../processing/strategies/types/SegmentationTypes';
import { ProtectionInterceptorChain, ProtectionContext } from './ProtectionInterceptor';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { SegmentationContextFactory } from '../context/SegmentationContext';

/**
 * 保护协调器
 * 职责：协调各种保护机制，在分段过程中执行保护检查
 */
@injectable()
export class ProtectionCoordinator implements IProtectionCoordinator {
  private protectionChain?: ProtectionInterceptorChain;
  private logger?: LoggerService;
  private protectionStats: {
    totalChecks: number;
    blockedOperations: number;
    allowedOperations: number;
    errors: number;
  };

  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
    this.protectionStats = {
      totalChecks: 0,
      blockedOperations: 0,
      allowedOperations: 0,
      errors: 0
    };
    this.logger?.debug('ProtectionCoordinator initialized');
  }

  /**
   * 设置保护拦截器链
   */
  setProtectionChain(chain: ProtectionInterceptorChain): void {
    this.protectionChain = chain;
    this.logger?.debug('Protection interceptor chain set for ProtectionCoordinator');
  }

  /**
   * 检查操作是否被允许
   */
  async checkProtection(context: ProtectionContext): Promise<boolean> {
    this.protectionStats.totalChecks++;

    if (!this.protectionChain) {
      this.protectionStats.allowedOperations++;
      return true; // 如果没有保护链，默认允许继续
    }

    try {
      const decision = await this.protectionChain.execute(context);

      if (decision.shouldProceed) {
        this.protectionStats.allowedOperations++;
        this.logger?.debug(`Protection check passed for operation: ${context.operation}`, {
          reason: decision.reason
        });
      } else {
        this.protectionStats.blockedOperations++;
        this.logger?.warn(`Protection check blocked operation: ${context.operation}`, {
          reason: decision.reason
        });
      }

      return decision.shouldProceed;
    } catch (error) {
      this.protectionStats.errors++;
      this.logger?.error('Error executing protection chain:', error);
      this.protectionStats.allowedOperations++;
      return true; // 保护检查出错时，默认允许继续执行
    }
  }

  /**
   * 创建保护上下文
   */
  createProtectionContext(
    operation: string,
    segmentationContext: SegmentationContext,
    additionalMetadata?: Record<string, any>
  ): ProtectionContext {
    return SegmentationContextFactory.createProtectionContext(
      operation,
      segmentationContext,
      additionalMetadata
    );
  }

  /**
   * 执行带保护的操作
   */
  async executeWithProtection<T>(
    operation: string,
    segmentationContext: SegmentationContext,
    operationFunc: () => Promise<T>,
    fallbackFunc?: () => Promise<T>
  ): Promise<T> {
    const protectionContext = this.createProtectionContext(
      operation,
      segmentationContext,
      { timestamp: Date.now() }
    );

    const isAllowed = await this.checkProtection(protectionContext);

    if (isAllowed) {
      try {
        return await operationFunc();
      } catch (error) {
        this.logger?.error(`Operation ${operation} failed:`, error);

        if (fallbackFunc) {
          this.logger?.info(`Executing fallback for operation: ${operation}`);
          return await fallbackFunc();
        }

        throw error;
      }
    } else {
      this.logger?.warn(`Operation ${operation} was blocked by protection mechanism`);

      if (fallbackFunc) {
        this.logger?.info(`Executing fallback for blocked operation: ${operation}`);
        return await fallbackFunc();
      }

      throw new Error(`Operation ${operation} was blocked by protection mechanism`);
    }
  }

  /**
   * 检查内存保护
   */
  async checkMemoryProtection(
    segmentationContext: SegmentationContext,
    currentMemoryUsage?: number
  ): Promise<boolean> {
    const protectionContext = this.createProtectionContext(
      'memory_check',
      segmentationContext,
      {
        currentMemoryUsage,
        memoryLimit: segmentationContext.options.memoryLimitMB * 1024 * 1024,
        checkType: 'memory'
      }
    );

    return await this.checkProtection(protectionContext);
  }

  /**
   * 检查错误阈值保护
   */
  async checkErrorThresholdProtection(
    segmentationContext: SegmentationContext,
    errorCount: number
  ): Promise<boolean> {
    const protectionContext = this.createProtectionContext(
      'error_threshold_check',
      segmentationContext,
      {
        errorCount,
        errorThreshold: segmentationContext.options.errorThreshold,
        checkType: 'error_threshold'
      }
    );

    return await this.checkProtection(protectionContext);
  }

  /**
   * 检查文件大小保护
   */
  async checkFileSizeProtection(
    segmentationContext: SegmentationContext
  ): Promise<boolean> {
    const protectionContext = this.createProtectionContext(
      'file_size_check',
      segmentationContext,
      {
        fileSize: segmentationContext.metadata.contentLength,
        checkType: 'file_size'
      }
    );

    return await this.checkProtection(protectionContext);
  }

  /**
   * 检查操作频率保护
   */
  async checkRateLimitProtection(
    segmentationContext: SegmentationContext,
    operationCount: number,
    timeWindow: number
  ): Promise<boolean> {
    const protectionContext = this.createProtectionContext(
      'rate_limit_check',
      segmentationContext,
      {
        operationCount,
        timeWindow,
        checkType: 'rate_limit'
      }
    );

    return await this.checkProtection(protectionContext);
  }

  /**
   * 获取保护统计信息
   */
  getProtectionStats(): {
    totalChecks: number;
    blockedOperations: number;
    allowedOperations: number;
    errors: number;
    blockRate: number;
  } {
    const { totalChecks, blockedOperations, allowedOperations, errors } = this.protectionStats;

    return {
      totalChecks,
      blockedOperations,
      allowedOperations,
      errors,
      blockRate: totalChecks > 0 ? blockedOperations / totalChecks : 0
    };
  }

  /**
   * 重置保护统计信息
   */
  resetProtectionStats(): void {
    this.protectionStats = {
      totalChecks: 0,
      blockedOperations: 0,
      allowedOperations: 0,
      errors: 0
    };

    this.logger?.debug('Protection statistics reset');
  }

  /**
   * 启用/禁用保护机制
   */
  setProtectionEnabled(enabled: boolean): void {
    if (!enabled) {
      this.logger?.warn('Protection mechanism disabled');
    } else {
      this.logger?.info('Protection mechanism enabled');
    }
  }

  /**
   * 设置保护级别
   */
  setProtectionLevel(level: 'low' | 'medium' | 'high'): void {
    this.logger?.debug(`Protection level set to: ${level}`);

    // 这里可以根据级别调整保护机制的严格程度
    // 例如，可以配置不同的拦截器或参数
  }

  /**
   * 创建自定义保护上下文
   */
  createCustomProtectionContext(
    operation: string,
    segmentationContext: SegmentationContext,
    customMetadata: Record<string, any>
  ): ProtectionContext {
    return this.createProtectionContext(operation, segmentationContext, customMetadata);
  }

  /**
   * 批量保护检查
   */
  async batchProtectionCheck(
    contexts: ProtectionContext[]
  ): Promise<boolean[]> {
    const results: boolean[] = [];

    for (const context of contexts) {
      const result = await this.checkProtection(context);
      results.push(result);
    }

    return results;
  }

  /**
   * 异步保护检查（非阻塞）
   */
  async asyncProtectionCheck(
    context: ProtectionContext,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    return Promise.race([
      this.checkProtection(context),
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          this.logger?.warn(`Protection check timed out for operation: ${context.operation}`);
          resolve(true); // 超时时默认允许
        }, timeoutMs);
      })
    ]);
  }

  /**
   * 条件保护检查
   */
  async conditionalProtectionCheck(
    context: ProtectionContext,
    condition: () => boolean
  ): Promise<boolean> {
    if (!condition()) {
      return true; // 条件不满足时，跳过保护检查
    }

    return await this.checkProtection(context);
  }

  /**
   * 缓存保护检查结果
   */
  private protectionCache: Map<string, { result: boolean; timestamp: number }> = new Map();

  async cachedProtectionCheck(
    context: ProtectionContext,
    cacheTtlMs: number = 60000 // 1分钟缓存
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.protectionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return cached.result;
    }

    const result = await this.checkProtection(context);

    this.protectionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(context: ProtectionContext): string {
    const keyParts = [
      context.operation,
      context.filePath || 'no-file',
      context.language || 'no-language',
      context.metadata?.contentLength?.toString() || '0',
      context.metadata?.lineCount?.toString() || '0'
    ];

    return keyParts.join(':');
  }

  /**
   * 清除保护缓存
   */
  clearProtectionCache(): void {
    this.protectionCache.clear();
    this.logger?.debug('Protection cache cleared');
  }

  /**
   * 获取保护缓存统计
   */
  getProtectionCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.protectionCache.size,
      keys: Array.from(this.protectionCache.keys())
    };
  }
}