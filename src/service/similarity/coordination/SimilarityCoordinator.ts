import { injectable, inject } from 'inversify';
import { 
  ISimilarityCoordinator,
  SimilarityCoordinationResult,
  ExecutionPlan,
  ExecutionDetails,
  StrategyExecutionResult,
  CoordinatorStats,
  SimilarityOptions
} from './types/CoordinationTypes';
import { 
  IContentAnalyzer,
  IExecutionPlanGenerator,
  IThresholdManager
} from './types/CoordinationTypes';
import { ISimilarityStrategy } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 相似度策略协调器
 * 实现逐级降级的相似度计算策略
 */
@injectable()
export class SimilarityCoordinator implements ISimilarityCoordinator {
  private strategies: Map<string, ISimilarityStrategy> = new Map();
  private stats: CoordinatorStats = {
    totalCalculations: 0,
    averageExecutionTime: 0,
    earlyExitRate: 0,
    cacheHitRate: 0,
    strategyUsage: new Map(),
    errorRate: 0,
    lastUpdated: new Date()
  };
  private executionHistory: SimilarityCoordinationResult[] = [];

  constructor(
    @inject('IContentAnalyzer') private contentAnalyzer: IContentAnalyzer,
    @inject('IExecutionPlanGenerator') private planGenerator: IExecutionPlanGenerator,
    @inject('IThresholdManager') private thresholdManager: IThresholdManager,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  async calculateSimilarity(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<SimilarityCoordinationResult> {
    const startTime = Date.now();
    this.stats.totalCalculations++;
    
    try {
      this.logger?.debug(`Starting coordinated similarity calculation`, {
        content1Length: content1.length,
        content2Length: content2.length,
        strategy: options?.strategy
      });

      // 快速检查完全相同
      if (content1 === content2) {
        return this.createImmediateResult(1.0, options, startTime, 'identical_content');
      }

      // 生成执行计划
      const executionPlan = await this.planGenerator.generatePlan(
        await this.contentAnalyzer.analyzeContent(content1, content2, options),
        options
      );

      // 执行策略序列
      const { finalSimilarity, strategyResults, executionDetails } = await this.executeStrategySequence(
        content1,
        content2,
        executionPlan,
        options
      );

      // 构建结果
      const threshold = options?.threshold || this.getDefaultThreshold(executionPlan.contentAnalysis.contentType);
      const result: SimilarityCoordinationResult = {
        similarity: finalSimilarity,
        isSimilar: finalSimilarity >= threshold,
        threshold,
        executionPlan,
        executionDetails,
        strategyResults
      };

      // 更新统计信息
      this.updateStats(result, Date.now() - startTime);
      
      // 记录执行历史
      this.recordExecution(result);

      // 自适应调整阈值
      this.thresholdManager.adaptThresholds(
        executionPlan.strategySequence[0]?.strategy || 'hybrid',
        executionPlan.contentAnalysis.contentType,
        strategyResults
      );

      this.logger?.debug(`Coordinated similarity calculation completed`, {
        similarity: finalSimilarity.toFixed(3),
        isSimilar: result.isSimilar,
        executionTime: executionDetails.totalExecutionTime,
        strategiesExecuted: executionDetails.executedStrategies,
        earlyExit: executionDetails.earlyExit
      });

      return result;
    } catch (error) {
      this.stats.errorRate = (this.stats.errorRate * (this.stats.totalCalculations - 1) + 1) / this.stats.totalCalculations;
      this.logger?.error('Error in coordinated similarity calculation:', error);
      throw error;
    }
  }

  async generateExecutionPlan(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<ExecutionPlan> {
    const contentAnalysis = await this.contentAnalyzer.analyzeContent(content1, content2, options);
    return await this.planGenerator.generatePlan(contentAnalysis, options);
  }

  getCoordinatorStats(): CoordinatorStats {
    return { ...this.stats };
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: ISimilarityStrategy): void {
    this.strategies.set(strategy.type, strategy);
    this.logger?.debug(`Registered similarity strategy: ${strategy.name} (${strategy.type})`);
  }

  /**
   * 执行策略序列
   */
  private async executeStrategySequence(
    content1: string,
    content2: string,
    executionPlan: ExecutionPlan,
    options?: SimilarityOptions
  ): Promise<{
    finalSimilarity: number;
    strategyResults: StrategyExecutionResult[];
    executionDetails: ExecutionDetails;
  }> {
    const strategyResults: StrategyExecutionResult[] = [];
    let totalExecutionTime = 0;
    let earlyExit = false;
    let exitReason: string | undefined;
    let cacheHits = 0;
    const errors: string[] = [];

    // 按顺序执行策略
    for (const step of executionPlan.strategySequence) {
      const strategy = this.strategies.get(step.strategy);
      if (!strategy) {
        const error = `Strategy not found: ${step.strategy}`;
        errors.push(error);
        this.logger?.warn(error);
        continue;
      }

      // 检查执行条件
      if (step.condition && !this.shouldExecuteStrategy(step.condition, strategyResults)) {
        this.logger?.debug(`Skipping strategy ${step.strategy} due to execution condition`);
        continue;
      }

      // 执行策略
      const result = await this.executeStrategy(
        strategy,
        content1,
        content2,
        step,
        options
      );

      strategyResults.push(result);
      totalExecutionTime += result.executionTime;

      if (result.cacheHit) {
        cacheHits++;
      }

      if (!result.success) {
        errors.push(result.error || `Strategy ${step.strategy} failed`);
        continue;
      }

      // 更新策略使用统计
      const currentUsage = this.stats.strategyUsage.get(step.strategy) || 0;
      this.stats.strategyUsage.set(step.strategy, currentUsage + 1);

      // 检查早期退出条件
      const earlyExitCheck = this.checkEarlyExit(
        result.similarity,
        executionPlan.earlyExitThresholds,
        step,
        executionPlan.strategySequence
      );

      if (earlyExitCheck.shouldExit) {
        earlyExit = true;
        exitReason = earlyExitCheck.reason;
        this.logger?.debug(`Early exit after strategy ${step.strategy}: ${exitReason}`);
        break;
      }
    }

    // 计算最终相似度
    const finalSimilarity = this.calculateFinalSimilarity(strategyResults);

    const executionDetails: ExecutionDetails = {
      totalExecutionTime,
      executedStrategies: strategyResults.length,
      earlyExit,
      exitReason,
      cacheHits,
      errors: errors.length > 0 ? errors : undefined
    };

    return {
      finalSimilarity,
      strategyResults,
      executionDetails
    };
  }

  /**
   * 执行单个策略
   */
  private async executeStrategy(
    strategy: ISimilarityStrategy,
    content1: string,
    content2: string,
    step: any,
    options?: SimilarityOptions
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    let similarity = 0;
    let success = false;
    let error: string | undefined;
    let cacheHit = false;

    try {
      // 检查缓存（这里简化处理，实际应该集成缓存管理器）
      // cacheHit = await this.checkCache(strategy, content1, content2, options);

      if (!cacheHit) {
        similarity = await strategy.calculate(content1, content2, options);
      }

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      this.logger?.warn(`Strategy ${strategy.name} execution failed:`, error);
    }

    const executionTime = Date.now() - startTime;

    return {
      strategy: strategy.type,
      similarity,
      executionTime,
      success,
      error,
      cacheHit,
      weight: step.weight || 1.0
    };
  }

  /**
   * 检查是否应该执行策略
   */
  private shouldExecuteStrategy(
    condition: any,
    previousResults: StrategyExecutionResult[]
  ): boolean {
    if (condition.minSimilarity !== undefined) {
      const lastResult = previousResults[previousResults.length - 1];
      if (!lastResult || lastResult.similarity < condition.minSimilarity) {
        return false;
      }
    }

    if (condition.maxSimilarity !== undefined) {
      const lastResult = previousResults[previousResults.length - 1];
      if (!lastResult || lastResult.similarity > condition.maxSimilarity) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查早期退出条件
   */
  private checkEarlyExit(
    similarity: number,
    thresholds: any,
    currentStep: any,
    allSteps: any[]
  ): { shouldExit: boolean; reason?: string } {
    // 高相似度早期退出
    if (similarity >= thresholds.high) {
      return {
        shouldExit: true,
        reason: `High similarity (${similarity.toFixed(3)}) >= ${thresholds.high}`
      };
    }

    // 如果是最后一个策略，不退出
    if (currentStep.order === allSteps.length - 1) {
      return { shouldExit: false };
    }

    // 中等相似度且后续策略成本高
    if (similarity >= thresholds.medium) {
      const remainingCost = allSteps
        .slice(currentStep.order + 1)
        .reduce((sum: number, step: any) => sum + step.cost.total, 0);
      
      if (remainingCost > 0.7) {
        return {
          shouldExit: true,
          reason: `Medium similarity (${similarity.toFixed(3)}) with high remaining cost (${remainingCost.toFixed(3)})`
        };
      }
    }

    // 低相似度且后续策略成本很高
    if (similarity >= thresholds.low) {
      const remainingCost = allSteps
        .slice(currentStep.order + 1)
        .reduce((sum: number, step: any) => sum + step.cost.total, 0);
      
      if (remainingCost > 0.9) {
        return {
          shouldExit: true,
          reason: `Low similarity (${similarity.toFixed(3)}) with very high remaining cost (${remainingCost.toFixed(3)})`
        };
      }
    }

    return { shouldExit: false };
  }

  /**
   * 计算最终相似度
   */
  private calculateFinalSimilarity(results: StrategyExecutionResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    if (results.length === 1) {
      return results[0].similarity;
    }

    // 加权平均计算
    const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
    const weightedSum = results.reduce((sum, result) => sum + result.similarity * result.weight, 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * 创建立即结果（用于完全相同的内容）
   */
  private createImmediateResult(
    similarity: number,
    options?: SimilarityOptions,
    startTime?: number,
    exitReason?: string
  ): SimilarityCoordinationResult {
    const threshold = options?.threshold || 0.8;
    const executionTime = startTime ? Date.now() - startTime : 0;
    
    return {
      similarity,
      isSimilar: similarity >= threshold,
      threshold,
      executionPlan: {
        id: 'immediate',
        contentAnalysis: {
          contentType: 'generic',
          contentLength: 0,
          complexity: { score: 0, level: 'low', factors: [] },
          features: [],
          recommendedStrategies: []
        },
        strategySequence: [],
        earlyExitThresholds: { high: 0.9, medium: 0.7, low: 0.5 },
        estimatedExecutionTime: 0,
        createdAt: new Date()
      },
      executionDetails: {
        totalExecutionTime: executionTime,
        executedStrategies: 0,
        earlyExit: true,
        exitReason: exitReason || 'immediate_identical',
        cacheHits: 0
      },
      strategyResults: []
    };
  }

  /**
   * 获取默认阈值
   */
  private getDefaultThreshold(contentType: string): number {
    return this.thresholdManager.getStrategyThreshold('hybrid', contentType);
  }

  /**
   * 更新统计信息
   */
  private updateStats(result: SimilarityCoordinationResult, executionTime: number): void {
    // 更新平均执行时间
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime * (this.stats.totalCalculations - 1) + executionTime) / 
      this.stats.totalCalculations;

    // 更新早期退出率
    if (result.executionDetails.earlyExit) {
      this.stats.earlyExitRate = 
        (this.stats.earlyExitRate * (this.stats.totalCalculations - 1) + 1) / 
        this.stats.totalCalculations;
    } else {
      this.stats.earlyExitRate = 
        (this.stats.earlyExitRate * (this.stats.totalCalculations - 1)) / 
        this.stats.totalCalculations;
    }

    // 更新缓存命中率
    if (result.executionDetails.cacheHits > 0) {
      this.stats.cacheHitRate = 
        (this.stats.cacheHitRate * (this.stats.totalCalculations - 1) + 
         (result.executionDetails.cacheHits / result.executionDetails.executedStrategies)) / 
        this.stats.totalCalculations;
    } else {
      this.stats.cacheHitRate = 
        (this.stats.cacheHitRate * (this.stats.totalCalculations - 1)) / 
        this.stats.totalCalculations;
    }

    this.stats.lastUpdated = new Date();
  }

  /**
   * 记录执行历史
   */
  private recordExecution(result: SimilarityCoordinationResult): void {
    this.executionHistory.push(result);
    
    // 保持历史记录在合理范围内
    if (this.executionHistory.length > 1000) {
      this.executionHistory.splice(0, this.executionHistory.length - 1000);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.executionHistory = [];
    this.stats = {
      totalCalculations: 0,
      averageExecutionTime: 0,
      earlyExitRate: 0,
      cacheHitRate: 0,
      strategyUsage: new Map(),
      errorRate: 0,
      lastUpdated: new Date()
    };
    this.logger?.info('SimilarityCoordinator cleaned up');
  }
}