import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';

export interface ConflictResolutionStrategy {
  name: string;
  description: string;
  resolve: (conflict: Conflict) => Promise<ResolutionResult>;
}

export interface Conflict {
  id: string;
  type: 'data_conflict' | 'reference_conflict' | 'schema_conflict' | 'concurrency_conflict';
  entities: Array<{
    source: string; // 数据源标识，如 'database1', 'database2', 'cache' 等
    id: string;
    data: any;
    timestamp: number;
    version?: string;
  }>;
  context: {
    operation: string;
    projectPath?: string;
    [key: string]: any;
  };
}

export interface ResolutionResult {
  success: boolean;
  resolvedData: any;
  appliedTo: string[]; // 应用到的数据源
  conflictsResolved: number;
  errors: string[];
  strategy?: string; // 使用的策略名称
}

export interface ConflictResolutionOptions {
  strategy?: 'latest_wins' | 'merge' | 'custom' | 'rollback';
  maxRetries?: number;
  timeout?: number;
  fallbackStrategy?: string; // 回退策略
}

export interface ConflictResolverDelegate {
  resolveConflict: (conflict: Conflict, options?: ConflictResolutionOptions) => Promise<ResolutionResult>;
  applyResolution: (data: any, target: string) => Promise<boolean>;
}

@injectable()
export class ConflictResolver {
  private logger: LoggerService;
  private strategies: Map<string, ConflictResolutionStrategy> = new Map();
  private delegates: Map<string, ConflictResolverDelegate> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.logger.info('ConflictResolver initialized');
    
    // 注册默认策略
    this.registerDefaultStrategies();
  }

  /**
   * 注册冲突解决策略
   */
  registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.debug('Registered conflict resolution strategy', { strategyName: strategy.name });
  }

  /**
   * 注册冲突解决委托
   */
  registerDelegate(name: string, delegate: ConflictResolverDelegate): void {
    this.delegates.set(name, delegate);
    this.logger.debug('Registered conflict resolution delegate', { delegateName: name });
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflict: Conflict,
    options?: ConflictResolutionOptions
  ): Promise<ResolutionResult> {
    const opts: ConflictResolutionOptions = {
      strategy: 'latest_wins',
      maxRetries: 3,
      timeout: 30000,
      fallbackStrategy: 'rollback',
      ...options
    };

    this.logger.info('Resolving conflict', {
      conflictId: conflict.id,
      conflictType: conflict.type,
      strategy: opts.strategy,
      entities: conflict.entities.length
    });

    let retries = 0;
    let lastError: Error | null = null;

    while (retries < (opts.maxRetries || 3)) {
      try {
        let strategy: ConflictResolutionStrategy | undefined;

        if (opts.strategy === 'custom' && conflict.type) {
          // 根据冲突类型选择策略
          strategy = this.strategies.get(conflict.type);
        } else if (opts.strategy) {
          strategy = this.strategies.get(opts.strategy);
        }

        if (!strategy) {
          strategy = this.strategies.get('latest_wins'); // 默认策略
        }

        if (!strategy) {
          throw new Error(`No strategy found for conflict resolution: ${opts.strategy}`);
        }

        const result = await this.executeWithTimeout(
          strategy.resolve(conflict),
          opts.timeout || 30000,
          `Conflict resolution timeout after ${(opts.timeout || 30000)}ms`
        );

        this.logger.info('Conflict resolved successfully', {
          conflictId: conflict.id,
          appliedTo: result.appliedTo,
          strategy: strategy.name
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        retries++;
        this.logger.warn('Conflict resolution attempt failed', {
          conflictId: conflict.id,
          retry: retries,
          error: (error as Error).message
        });

        if (retries < (opts.maxRetries || 3)) {
          // 等待一段时间后重试
          await this.delay(Math.pow(2, retries) * 1000); // 指数退避
        }
      }
    }

    // 所有重试都失败了，尝试回退策略
    if (opts.fallbackStrategy) {
      this.logger.info('Trying fallback strategy', {
        conflictId: conflict.id,
        fallbackStrategy: opts.fallbackStrategy
      });

      const fallbackStrategy = this.strategies.get(opts.fallbackStrategy);
      if (fallbackStrategy) {
        try {
          const result = await fallbackStrategy.resolve(conflict);
          result.strategy = opts.fallbackStrategy;
          return result;
        } catch (error) {
          this.logger.error('Fallback strategy also failed', {
            conflictId: conflict.id,
            error: (error as Error).message
          });
        }
      }
    }

    // 所有重试和回退策略都失败了
    this.logger.error('All conflict resolution attempts failed', {
      conflictId: conflict.id,
      error: lastError?.message
    });

    return {
      success: false,
      resolvedData: null,
      appliedTo: [],
      conflictsResolved: 0,
      errors: [lastError?.message || 'Unknown error during conflict resolution']
    };
  }

  /**
   * 批量解决冲突
   */
  async resolveConflicts(
    conflicts: Conflict[],
    options?: ConflictResolutionOptions
  ): Promise<ResolutionResult[]> {
    this.logger.info('Resolving multiple conflicts', { conflictCount: conflicts.length });

    const results: ResolutionResult[] = [];

    for (const conflict of conflicts) {
      const result = await this.resolveConflict(conflict, options);
      results.push(result);
    }

    const successfulResolutions = results.filter(r => r.success).length;
    const failedResolutions = results.filter(r => !r.success).length;

    this.logger.info('Batch conflict resolution completed', {
      totalConflicts: conflicts.length,
      successfulResolutions,
      failedResolutions
    });

    return results;
  }

  /**
   * 应用冲突解决结果
   */
  async applyResolution(result: ResolutionResult, target: string): Promise<boolean> {
    const delegate = this.delegates.get(target);
    if (!delegate) {
      this.logger.error('No delegate found for target', { target });
      return false;
    }

    try {
      return await delegate.applyResolution(result.resolvedData, target);
    } catch (error) {
      this.logger.error('Failed to apply resolution', {
        target,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 检测冲突
   */
  async detectConflicts(projectPath: string, operationContext?: any): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    this.logger.debug('Detecting conflicts', { projectPath });

    // 这里应该实现实际的冲突检测逻辑
    // 例如：检查相同ID的数据在不同数据源中的差异
    // 检查引用完整性等

    return conflicts;
  }

  /**
   * 获取可用的解决策略
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 获取已注册的委托
   */
  getRegisteredDelegates(): string[] {
    return Array.from(this.delegates.keys());
  }

  private registerDefaultStrategies(): void {
    // 最新数据获胜策略
    this.registerStrategy({
      name: 'latest_wins',
      description: '选择时间戳最新的数据',
      resolve: async (conflict) => {
        // 选择时间戳最新的数据
        const latestEntity = conflict.entities.reduce((prev, current) =>
          prev.timestamp > current.timestamp ? prev : current
        );

        return {
          success: true,
          resolvedData: latestEntity.data,
          appliedTo: [latestEntity.source],
          conflictsResolved: 1,
          errors: [],
          strategy: 'latest_wins'
        };
      }
    });

    // 合并策略
    this.registerStrategy({
      name: 'merge',
      description: '合并不同数据源中的数据',
      resolve: async (conflict) => {
        // 简单的合并策略 - 合并所有数据字段
        const mergedData: any = {};
        const sources: string[] = [];

        // 合并所有实体的数据
        for (const entity of conflict.entities) {
          Object.assign(mergedData, entity.data);
          sources.push(entity.source);
        }

        return {
          success: true,
          resolvedData: mergedData,
          appliedTo: sources,
          conflictsResolved: 1,
          errors: [],
          strategy: 'merge'
        };
      }
    });

    // 回滚策略
    this.registerStrategy({
      name: 'rollback',
      description: '回滚到之前的一致状态',
      resolve: async (conflict) => {
        // 回滚策略 - 选择最旧的版本作为回退
        const oldestEntity = conflict.entities.reduce((prev, current) =>
          prev.timestamp < current.timestamp ? prev : current
        );

        return {
          success: true,
          resolvedData: oldestEntity.data,
          appliedTo: [oldestEntity.source],
          conflictsResolved: 1,
          errors: [],
          strategy: 'rollback'
        };
      }
    });

    // 优先级策略
    this.registerStrategy({
      name: 'priority_based',
      description: '根据数据源优先级选择',
      resolve: async (conflict) => {
        // 定义数据源优先级
        const priorityOrder = ['primary_database', 'cache', 'secondary_database'];
        
        // 按优先级排序
        const sortedEntities = conflict.entities.sort((a, b) => {
          const aPriority = priorityOrder.indexOf(a.source);
          const bPriority = priorityOrder.indexOf(b.source);
          return aPriority - bPriority;
        });

        const selectedEntity = sortedEntities[0];

        return {
          success: true,
          resolvedData: selectedEntity.data,
          appliedTo: [selectedEntity.source],
          conflictsResolved: 1,
          errors: [],
          strategy: 'priority_based'
        };
      }
    });
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeout);
    });
    
    try {
      return await Promise.race([
        promise,
        timeoutPromise
      ]);
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}