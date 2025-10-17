import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types/index';
import { ICleanupStrategy, ICleanupContext, ICleanupResult } from './ICleanupStrategy';

/**
 * 清理管理器
 * 统一管理各种清理策略，提供统一的清理接口
 */
@injectable()
export class CleanupManager {
  private strategies: Map<string, ICleanupStrategy> = new Map();
  private logger?: LoggerService;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  /**
   * 初始化清理管理器
   */
  initialize(): void {
    if (this.isInitialized) {
      this.logger?.warn('ProcessingGuard is already initialized');
      return;
    }

    try {
      this.isInitialized = true;
      this.logger?.info('CleanupManager initialized successfully');
    } catch (error) {
      this.logger?.error(`Failed to initialize CleanupManager: ${error}`);
      throw error;
    }
  }

  /**
   * 销毁清理管理器
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.strategies.clear();
      this.isInitialized = false;
      this.logger?.info('CleanupManager destroyed');
    } catch (error) {
      this.logger?.error(`Error during CleanupManager destruction: ${error}`);
    }
  }

  /**
   * 注册清理策略
   * @param strategy 清理策略
   */
  registerStrategy(strategy: ICleanupStrategy): void {
    if (!this.isInitialized) {
      throw new Error('CleanupManager is not initialized');
    }

    if (!strategy) {
      throw new Error('Strategy cannot be null or undefined');
    }

    if (!strategy.isAvailable()) {
      this.logger?.warn(`Strategy ${strategy.name} is not available, skipping registration`);
      return;
    }

    this.strategies.set(strategy.name, strategy);
    this.logger?.info(`Registered cleanup strategy: ${strategy.name} (priority: ${strategy.priority})`);
  }

  /**
   * 注销清理策略
   * @param strategyName 策略名称
   */
  unregisterStrategy(strategyName: string): void {
    if (!this.isInitialized) {
      throw new Error('CleanupManager is not initialized');
    }

    const removed = this.strategies.delete(strategyName);
    if (removed) {
      this.logger?.info(`Unregistered cleanup strategy: ${strategyName}`);
    } else {
      this.logger?.warn(`Strategy not found: ${strategyName}`);
    }
  }

  /**
   * 获取所有已注册的策略
   * @returns 策略列表
   */
  getRegisteredStrategies(): ICleanupStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 获取指定策略
   * @param strategyName 策略名称
   * @returns 策略实例
   */
  getStrategy(strategyName: string): ICleanupStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  /**
   * 执行清理操作
   * @param context 清理上下文
   * @returns 清理结果
   */
  async performCleanup(context: ICleanupContext): Promise<ICleanupResult> {
    if (!this.isInitialized) {
      throw new Error('CleanupManager is not initialized');
    }

    const startTime = Date.now();
    this.logger?.info(`Starting cleanup operation, reason: ${context.triggerReason}`);

    try {
      // 获取适用的策略并按优先级排序
      const applicableStrategies = this.getApplicableStrategies(context);

      if (applicableStrategies.length === 0) {
        this.logger?.warn('No applicable cleanup strategies found');
        return this.createEmptyResult(startTime);
      }

      // 执行策略
      const results = await this.executeStrategies(applicableStrategies, context);

      // 聚合结果
      const aggregatedResult = this.aggregateResults(results, startTime);

      this.logger?.info(`Cleanup operation completed successfully, freed ${aggregatedResult.memoryFreed} bytes in ${aggregatedResult.duration}ms`);

      return aggregatedResult;
    } catch (error) {
      this.logger?.error(`Cleanup operation failed: ${error}`);

      return {
        success: false,
        cleanedCaches: [],
        memoryFreed: 0,
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * 估算清理影响
   * @param context 清理上下文
   * @returns 预估释放的内存大小
   */
  estimateCleanupImpact(context: ICleanupContext): number {
    if (!this.isInitialized) {
      return 0;
    }

    try {
      const applicableStrategies = this.getApplicableStrategies(context);
      let totalImpact = 0;

      for (const strategy of applicableStrategies) {
        try {
          const impact = strategy.estimateCleanupImpact(context);
          totalImpact += impact;
          this.logger?.debug(`Strategy ${strategy.name} estimated impact: ${impact} bytes`);
        } catch (error) {
          this.logger?.warn(`Failed to estimate impact for strategy ${strategy.name}: ${error}`);
        }
      }

      this.logger?.info(`Total estimated cleanup impact: ${totalImpact} bytes`);
      return totalImpact;
    } catch (error) {
      this.logger?.error(`Failed to estimate cleanup impact: ${error}`);
      return 0;
    }
  }

  /**
   * 获取适用的策略并按优先级排序
   * @param context 清理上下文
   * @returns 适用的策略列表
   */
  private getApplicableStrategies(context: ICleanupContext): ICleanupStrategy[] {
    const applicable: ICleanupStrategy[] = [];

    for (const strategy of this.strategies.values()) {
      try {
        if (strategy.isApplicable(context) && strategy.isAvailable()) {
          applicable.push(strategy);
        }
      } catch (error) {
        this.logger?.warn(`Failed to check applicability for strategy ${strategy.name}: ${error}`);
      }
    }

    // 按优先级排序（数字越小优先级越高）
    return applicable.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 执行策略
   * @param strategies 策略列表
   * @param context 清理上下文
   * @returns 执行结果列表
   */
  private async executeStrategies(strategies: ICleanupStrategy[], context: ICleanupContext): Promise<ICleanupResult[]> {
    const results: ICleanupResult[] = [];

    for (const strategy of strategies) {
      try {
        this.logger?.info(`Executing cleanup strategy: ${strategy.name}`);
        const result = await strategy.cleanup(context);
        results.push(result);

        if (result.success) {
          this.logger?.info(`Strategy ${strategy.name} completed successfully, freed ${result.memoryFreed} bytes`);
        } else {
          this.logger?.warn(`Strategy ${strategy.name} failed: ${result.error?.message}`);
        }
      } catch (error) {
        this.logger?.error(`Strategy ${strategy.name} execution failed: ${error}`);
        results.push({
          success: false,
          cleanedCaches: [],
          memoryFreed: 0,
          duration: 0,
          error: error as Error
        });
      }
    }

    return results;
  }

  /**
   * 聚合多个清理结果
   * @param results 清理结果列表
   * @param startTime 开始时间
   * @returns 聚合结果
   */
  private aggregateResults(results: ICleanupResult[], startTime: number): ICleanupResult {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    const cleanedCaches = successfulResults.flatMap(r => r.cleanedCaches);
    const memoryFreed = successfulResults.reduce((sum, r) => sum + r.memoryFreed, 0);
    const duration = Date.now() - startTime;

    let error: Error | undefined;
    if (failedResults.length > 0) {
      const errorMessages = failedResults.map(r => r.error?.message).filter(Boolean).join('; ');
      error = new Error(`Some cleanup strategies failed: ${errorMessages}`);
    }

    return {
      success: failedResults.length === 0,
      cleanedCaches,
      memoryFreed,
      duration,
      error,
      metadata: {
        totalStrategies: results.length,
        successfulStrategies: successfulResults.length,
        failedStrategies: failedResults.length
      }
    };
  }

  /**
   * 创建空的清理结果
   * @param startTime 开始时间
   * @returns 空结果
   */
  private createEmptyResult(startTime: number): ICleanupResult {
    return {
      success: true,
      cleanedCaches: [],
      memoryFreed: 0,
      duration: Date.now() - startTime,
      metadata: {
        message: 'No applicable cleanup strategies found'
      }
    };
  }

  /**
   * 获取清理管理器状态
   * @returns 状态信息
   */
  getStatus(): {
    isInitialized: boolean;
    registeredStrategies: string[];
    totalStrategies: number;
  } {
    return {
      isInitialized: this.isInitialized,
      registeredStrategies: Array.from(this.strategies.keys()),
      totalStrategies: this.strategies.size
    };
  }

  /**
   * 重置清理管理器状态
   */
  reset(): void {
    if (!this.isInitialized) {
      return;
    }

    this.logger?.info('Resetting CleanupManager');

    // 不清除策略注册，只重置内部状态
    this.logger?.info('CleanupManager reset completed');
  }
}