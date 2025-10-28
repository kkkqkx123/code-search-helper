import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { PriorityManager, StrategyContext } from './PriorityManager';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';

export interface FallbackResult {
  strategy: ISplitStrategy;
  success: boolean;
  chunks: any[];
  executionTime: number;
  error?: string;
  metadata?: any;
}

export interface FallbackOptions {
  maxAttempts?: number;
  timeoutPerStrategy?: number;
  skipSimilarStrategies?: boolean;
  preserveErrorContext?: boolean;
}

@injectable()
export class FallbackManager {
  private priorityManager: PriorityManager;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.PriorityManager) priorityManager: PriorityManager,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.priorityManager = priorityManager;
    this.logger = logger;
  }

  /**
   * 执行策略并处理降级
   */
  async executeWithFallback(
    primaryStrategy: ISplitStrategy,
    availableStrategies: ISplitStrategy[],
    context: StrategyContext,
    options: FallbackOptions = {}
  ): Promise<FallbackResult> {
    const maxAttempts = options.maxAttempts || 5;
    const timeoutPerStrategy = options.timeoutPerStrategy || 10000;
    
    // 构建降级路径
    const fallbackPath = this.buildFallbackPath(
      primaryStrategy.getName(),
      availableStrategies,
      context
    );

    let lastError: Error | undefined;
    let attemptCount = 0;

    for (const strategy of fallbackPath) {
      if (attemptCount >= maxAttempts) {
        break;
      }

      attemptCount++;
      this.logger?.debug(`Attempting strategy ${attemptCount}/${maxAttempts}: ${strategy.getName()}`);

      try {
        const result = await this.executeStrategyWithTimeout(
          strategy,
          context,
          timeoutPerStrategy
        );

        if (result.success && result.chunks.length > 0) {
          this.logger?.info(`Strategy ${strategy.getName()} succeeded after ${attemptCount} attempts`);
          
          // 更新性能统计
          this.priorityManager.updatePerformance(
            strategy.getName(),
            result.executionTime,
            true
          );

          return {
            strategy,
            success: true,
            chunks: result.chunks,
            executionTime: result.executionTime,
            metadata: {
              attemptCount,
              fallbackPath: fallbackPath.map(s => s.getName()),
              originalStrategy: primaryStrategy.getName()
            }
          };
        } else {
          this.logger?.warn(`Strategy ${strategy.getName()} returned no chunks`);
          lastError = new Error(`Strategy ${strategy.getName()} returned no chunks`);
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger?.error(`Strategy ${strategy.getName()} failed:`, lastError.message);

        // 更新失败统计
        this.priorityManager.updatePerformance(
          strategy.getName(),
          timeoutPerStrategy,
          false
        );

        // 如果是特定类型的错误，调整降级路径
        if (this.shouldAdjustFallbackPath(lastError.message)) {
          this.adjustFallbackPath(fallbackPath, strategy.getName(), lastError.message);
        }
      }
    }

    // 所有策略都失败了，返回最后的错误
    this.logger?.error(`All ${attemptCount} strategies failed`);
    
    return {
      strategy: primaryStrategy,
      success: false,
      chunks: [],
      executionTime: attemptCount * timeoutPerStrategy,
      error: lastError?.message || 'All strategies failed',
      metadata: {
        attemptCount,
        fallbackPath: fallbackPath.map(s => s.getName()),
        originalStrategy: primaryStrategy.getName(),
        allStrategiesFailed: true
      }
    };
  }

  /**
   * 构建降级路径
   */
  buildFallbackPath(
    failedStrategy: string,
    availableStrategies: ISplitStrategy[],
    context: StrategyContext
  ): ISplitStrategy[] {
    // 获取配置的降级路径
    const configuredPath = this.priorityManager.getFallbackPath(failedStrategy, '');
    
    // 创建策略名称到策略实例的映射
    const strategyMap = new Map<string, ISplitStrategy>();
    for (const strategy of availableStrategies) {
      strategyMap.set(strategy.getName(), strategy);
    }

    // 构建实际的降级路径
    const fallbackPath: ISplitStrategy[] = [];
    
    // 首先添加配置的降级策略
    for (const strategyName of configuredPath) {
      const strategy = strategyMap.get(strategyName);
      if (strategy && this.isStrategyApplicable(strategy, context)) {
        fallbackPath.push(strategy);
        strategyMap.delete(strategyName); // 避免重复添加
      }
    }

    // 然后添加其他可用的策略（按优先级排序）
    const remainingStrategies = Array.from(strategyMap.values())
      .filter(strategy => this.isStrategyApplicable(strategy, context))
      .sort((a, b) => {
        const priorityA = this.priorityManager.getPriority(a.getName(), context);
        const priorityB = this.priorityManager.getPriority(b.getName(), context);
        return priorityA - priorityB;
      });

    fallbackPath.push(...remainingStrategies);

    return fallbackPath;
  }

  /**
   * 获取推荐的降级策略
   */
  getRecommendedFallbackStrategies(
    failedStrategy: string,
    context: StrategyContext,
    count: number = 3
  ): ISplitStrategy[] {
    const allStrategies = this.getAllAvailableStrategies(); // 需要从外部获取
    const fallbackPath = this.buildFallbackPath(failedStrategy, allStrategies, context);
    
    return fallbackPath.slice(0, count);
  }

  /**
   * 分析失败原因并提供建议
   */
  analyzeFailure(
    strategyName: string,
    error: string,
    context: StrategyContext
  ): {
    failureType: string;
    recommendedActions: string[];
    alternativeStrategies: string[];
  } {
    const failureType = this.classifyFailure(error);
    const recommendedActions = this.getRecommendedActions(failureType, error);
    const alternativeStrategies = this.getAlternativeStrategies(strategyName, failureType, context);

    return {
      failureType,
      recommendedActions,
      alternativeStrategies
    };
  }

  private async executeStrategyWithTimeout(
    strategy: ISplitStrategy,
    context: StrategyContext,
    timeout: number
  ): Promise<{
    success: boolean;
    chunks: any[];
    executionTime: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          chunks: [],
          executionTime: timeout,
          error: `Strategy ${strategy.getName()} timed out after ${timeout}ms`
        });
      }, timeout);

      // 执行策略
      this.executeStrategy(strategy, context)
        .then(chunks => {
          clearTimeout(timeoutId);
          resolve({
            success: true,
            chunks,
            executionTime: Date.now() - startTime
          });
        })
        .catch(error => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            chunks: [],
            executionTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          });
        });
    });
  }

  private async executeStrategy(
    strategy: ISplitStrategy,
    context: StrategyContext
  ): Promise<any[]> {
    return await strategy.split(
      context.content || '',
      context.language || 'unknown',
      context.filePath,
      undefined, // options
      undefined, // nodeTracker
      undefined  // ast
    );
  }

  private isStrategyApplicable(strategy: ISplitStrategy, context: StrategyContext): boolean {
    // 检查语言支持
    if (context.language && !strategy.supportsLanguage(context.language)) {
      return false;
    }

    // 检查文件类型特定限制
    if (context.filePath) {
      const extension = context.filePath.split('.').pop()?.toLowerCase();
      
      // 某些策略不适用于特定文件类型
      const strategyName = strategy.getName().toLowerCase();
      
      // Markdown专用策略只适用于markdown文件
      if (strategyName.includes('markdown') && !['md', 'markdown'].includes(extension || '')) {
        return false;
      }
      
      // XML专用策略只适用于XML相关文件
      if (strategyName.includes('xml') && !['xml', 'html', 'xhtml', 'svg'].includes(extension || '')) {
        return false;
      }
    }

    return true;
  }

  private shouldAdjustFallbackPath(errorMessage: string): boolean {
    const adjustTriggers = [
      'AST',
      'TreeSitter',
      'parse',
      'syntax',
      'timeout',
      'memory'
    ];

    return adjustTriggers.some(trigger => 
      errorMessage.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  private adjustFallbackPath(
    fallbackPath: ISplitStrategy[],
    failedStrategyName: string,
    errorMessage: string
  ): void {
    const failedIndex = fallbackPath.findIndex(s => s.getName() === failedStrategyName);
    if (failedIndex === -1) return;

    // 根据错误类型调整后续策略
    if (errorMessage.includes('AST') || errorMessage.includes('TreeSitter')) {
      // 移除其他AST相关策略
      for (let i = failedIndex + 1; i < fallbackPath.length; i++) {
        const strategyName = fallbackPath[i].getName().toLowerCase();
        if (strategyName.includes('ast') || strategyName.includes('structure') || 
            strategyName.includes('syntax') || strategyName.includes('hierarchical')) {
          fallbackPath.splice(i, 1);
          i--; // 调整索引
        }
      }
    }

    if (errorMessage.includes('timeout')) {
      // 移除可能耗时的复杂策略
      for (let i = failedIndex + 1; i < fallbackPath.length; i++) {
        const strategyName = fallbackPath[i].getName().toLowerCase();
        if (strategyName.includes('ast') || strategyName.includes('semantic') || 
            strategyName.includes('intelligent')) {
          fallbackPath.splice(i, 1);
          i--; // 调整索引
        }
      }
    }
  }

  private classifyFailure(error: string): string {
    if (error.includes('AST') || error.includes('TreeSitter') || error.includes('parse')) {
      return 'parsing_error';
    }
    if (error.includes('timeout') || error.includes('time')) {
      return 'timeout_error';
    }
    if (error.includes('memory') || error.includes('Memory')) {
      return 'memory_error';
    }
    if (error.includes('language') || error.includes('support')) {
      return 'language_support_error';
    }
    if (error.includes('dependency') || error.includes('service')) {
      return 'dependency_error';
    }
    return 'unknown_error';
  }

  private getRecommendedActions(failureType: string, error: string): string[] {
    const actions: Record<string, string[]> = {
      parsing_error: [
        'Check if the file contains valid syntax',
        'Try using a simpler parsing strategy',
        'Verify language detection is correct'
      ],
      timeout_error: [
        'Increase timeout limit',
        'Try using a faster strategy',
        'Consider processing smaller chunks'
      ],
      memory_error: [
        'Reduce chunk size',
        'Use memory-efficient strategies',
        'Free up system memory'
      ],
      language_support_error: [
        'Verify language detection',
        'Check if language is supported',
        'Try universal strategies'
      ],
      dependency_error: [
        'Check required services are available',
        'Verify dependencies are installed',
        'Restart the service if needed'
      ],
      unknown_error: [
        'Check logs for detailed error information',
        'Try fallback strategies',
        'Report the issue if it persists'
      ]
    };

    return actions[failureType] || actions.unknown_error;
  }

  private getAlternativeStrategies(
    failedStrategy: string,
    failureType: string,
    context: StrategyContext
  ): string[] {
    const alternatives: Record<string, string[]> = {
      parsing_error: ['universal_line', 'universal_bracket', 'semantic'],
      timeout_error: ['universal_line', 'bracket', 'function'],
      memory_error: ['universal_line', 'minimal_fallback'],
      language_support_error: ['universal_line', 'semantic'],
      dependency_error: ['universal_line', 'minimal_fallback'],
      unknown_error: ['universal_line', 'minimal_fallback']
    };

    return alternatives[failureType] || alternatives.unknown_error;
  }

  private getAllAvailableStrategies(): ISplitStrategy[] {
    // 这个方法需要从外部获取所有可用策略
    // 在实际集成时，会通过依赖注入获取
    return [];
  }
}