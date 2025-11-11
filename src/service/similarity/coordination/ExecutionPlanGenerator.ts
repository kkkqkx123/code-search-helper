import { injectable, inject } from 'inversify';
import { 
  IExecutionPlanGenerator, 
  ExecutionPlan,
  ContentAnalysisResult,
  StrategyExecutionStep,
  StrategyCost,
  ExecutionCondition,
  SimilarityOptions,
  SimilarityStrategyType
} from './types/CoordinationTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 执行计划生成器
 * 根据内容分析结果生成最优的执行计划
 */
@injectable()
export class ExecutionPlanGenerator implements IExecutionPlanGenerator {
  private strategyCosts: Map<SimilarityStrategyType, StrategyCost> = new Map();
  private costHistory: Map<SimilarityStrategyType, number[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.initializeStrategyCosts();
  }

  async generatePlan(
    contentAnalysis: ContentAnalysisResult,
    options?: SimilarityOptions
  ): Promise<ExecutionPlan> {
    const startTime = Date.now();
    
    try {
      // 生成策略执行序列
      const strategySequence = this.generateStrategySequence(contentAnalysis, options);
      
      // 计算早期退出阈值
      const earlyExitThresholds = this.calculateEarlyExitThresholds(contentAnalysis);
      
      // 估算执行时间
      const estimatedExecutionTime = this.estimateExecutionTime(strategySequence);
      
      const plan: ExecutionPlan = {
        id: this.generatePlanId(contentAnalysis, options),
        contentAnalysis,
        strategySequence,
        earlyExitThresholds,
        estimatedExecutionTime,
        createdAt: new Date()
      };
      
      this.logger.debug(`Execution plan generated in ${Date.now() - startTime}ms`, {
        planId: plan.id,
        strategyCount: strategySequence.length,
        estimatedTime: estimatedExecutionTime
      });
      
      return plan;
    } catch (error) {
      this.logger.error('Error generating execution plan:', error);
      throw error;
    }
  }

  getStrategyCosts(): Map<SimilarityStrategyType, StrategyCost> {
    return new Map(this.strategyCosts);
  }

  updateStrategyCost(strategy: SimilarityStrategyType, cost: Partial<StrategyCost>): void {
    const existingCost = this.strategyCosts.get(strategy);
    if (!existingCost) {
      this.logger.warn(`Attempted to update cost for unknown strategy: ${strategy}`);
      return;
    }
    
    // 更新成本信息
    const updatedCost: StrategyCost = {
      computational: cost.computational ?? existingCost.computational,
      memory: cost.memory ?? existingCost.memory,
      time: cost.time ?? existingCost.time,
      total: 0 // 将在下面重新计算
    };
    
    // 重新计算总成本
    updatedCost.total = (
      updatedCost.computational * 0.4 +
      updatedCost.memory * 0.3 +
      (updatedCost.time / 1000) * 0.3 // 时间成本标准化到0-1范围
    );
    
    this.strategyCosts.set(strategy, updatedCost);
    
    // 记录成本历史
    let history = this.costHistory.get(strategy);
    if (!history) {
      history = [];
      this.costHistory.set(strategy, history);
    }
    history.push(updatedCost.total);
    
    // 保持历史记录在合理范围内
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.logger.debug(`Updated cost for strategy ${strategy}`, updatedCost);
  }

  private initializeStrategyCosts(): void {
    // 初始化各策略的成本信息
    this.strategyCosts.set('keyword', {
      computational: 0.2,  // 低计算成本
      memory: 0.1,         // 低内存使用
      time: 50,            // 约50ms
      total: 0.2
    });
    
    this.strategyCosts.set('levenshtein', {
      computational: 0.5,  // 中等计算成本
      memory: 0.3,         // 中等内存使用
      time: 200,           // 约200ms
      total: 0.5
    });
    
    this.strategyCosts.set('semantic', {
      computational: 0.9,  // 高计算成本
      memory: 0.7,         // 高内存使用
      time: 1000,          // 约1000ms
      total: 0.9
    });
    
    this.strategyCosts.set('hybrid', {
      computational: 0.8,  // 高计算成本（包含多个策略）
      memory: 0.6,         // 高内存使用
      time: 800,           // 约800ms
      total: 0.8
    });
  }

  private generateStrategySequence(
    contentAnalysis: ContentAnalysisResult,
    options?: SimilarityOptions
  ): StrategyExecutionStep[] {
    const sequence: StrategyExecutionStep[] = [];
    const { contentType, complexity, recommendedStrategies } = contentAnalysis;
    
    // 根据内容类型和复杂度确定策略顺序
    let strategies: SimilarityStrategyType[] = [];
    
    // 逐级降级策略：快速检查 -> 关键词 -> Levenshtein -> 语义
    if (contentType === 'code') {
      strategies = ['keyword', 'levenshtein', 'semantic'];
    } else if (contentType === 'document') {
      strategies = ['keyword', 'semantic', 'levenshtein'];
    } else {
      strategies = ['levenshtein', 'keyword', 'semantic'];
    }
    
    // 如果用户指定了策略，优先使用
    if (options?.strategy && strategies.includes(options.strategy)) {
      const userStrategy = options.strategy;
      strategies = strategies.filter(s => s !== userStrategy);
      strategies.unshift(userStrategy);
    }
    
    // 生成执行步骤
    strategies.forEach((strategy, index) => {
      const cost = this.strategyCosts.get(strategy);
      if (!cost) {
        this.logger.warn(`No cost information for strategy: ${strategy}`);
        return;
      }
      
      const step: StrategyExecutionStep = {
        strategy,
        order: index,
        cost,
        required: index === 0, // 第一个策略是必需的
        condition: this.generateExecutionCondition(strategy, index, contentAnalysis),
        weight: this.calculateStrategyWeight(strategy, contentAnalysis)
      };
      
      sequence.push(step);
    });
    
    return sequence;
  }

  private generateExecutionCondition(
    strategy: SimilarityStrategyType,
    order: number,
    contentAnalysis: ContentAnalysisResult
  ): ExecutionCondition | undefined {
    if (order === 0) {
      return undefined; // 第一个策略无条件执行
    }
    
    // 根据策略类型和内容特征生成执行条件
    const conditions: ExecutionCondition = {};
    
    // 基于内容复杂度的条件
    if (contentAnalysis.complexity.level === 'low' && strategy === 'semantic') {
      // 低复杂度内容可能不需要语义分析
      conditions.minSimilarity = 0.3;
    }
    
    // 基于内容长度的条件
    if (contentAnalysis.contentLength < 100 && strategy === 'semantic') {
      // 短内容可能不需要语义分析
      conditions.minSimilarity = 0.4;
    }
    
    // 基于策略类型的条件
    if (strategy === 'semantic') {
      // 语义分析通常在前面的策略给出中等相似度时执行
      conditions.minSimilarity = 0.5;
    }
    
    return Object.keys(conditions).length > 0 ? conditions : undefined;
  }

  private calculateStrategyWeight(
    strategy: SimilarityStrategyType,
    contentAnalysis: ContentAnalysisResult
  ): number {
    const { contentType, complexity } = contentAnalysis;
    
    // 基础权重
    let weight = 1.0;
    
    // 根据内容类型调整权重
    switch (contentType) {
      case 'code':
        if (strategy === 'keyword') weight = 1.2;
        if (strategy === 'semantic') weight = 0.8;
        break;
      case 'document':
        if (strategy === 'semantic') weight = 1.3;
        if (strategy === 'levenshtein') weight = 0.7;
        break;
      case 'generic':
        if (strategy === 'levenshtein') weight = 1.1;
        break;
    }
    
    // 根据复杂度调整权重
    switch (complexity.level) {
      case 'low':
        if (strategy === 'keyword') weight *= 1.2;
        if (strategy === 'semantic') weight *= 0.6;
        break;
      case 'high':
        if (strategy === 'semantic') weight *= 1.3;
        if (strategy === 'keyword') weight *= 0.8;
        break;
    }
    
    return weight;
  }

  private calculateEarlyExitThresholds(contentAnalysis: ContentAnalysisResult) {
    const { contentType, complexity } = contentAnalysis;
    
    // 基础阈值
    let thresholds = {
      high: 0.9,
      medium: 0.7,
      low: 0.5
    };
    
    // 根据内容类型调整
    switch (contentType) {
      case 'code':
        thresholds.high = 0.85;
        thresholds.medium = 0.65;
        break;
      case 'document':
        thresholds.high = 0.9;
        thresholds.medium = 0.75;
        break;
    }
    
    // 根据复杂度调整
    switch (complexity.level) {
      case 'low':
        thresholds.high *= 0.95;
        thresholds.medium *= 0.9;
        break;
      case 'high':
        thresholds.high *= 1.05;
        thresholds.medium *= 1.1;
        break;
    }
    
    // 确保阈值在合理范围内
    thresholds.high = Math.min(0.95, Math.max(0.8, thresholds.high));
    thresholds.medium = Math.min(0.85, Math.max(0.6, thresholds.medium));
    thresholds.low = Math.min(0.6, Math.max(0.4, thresholds.low));
    
    return thresholds;
  }

  private estimateExecutionTime(strategySequence: StrategyExecutionStep[]): number {
    // 基于策略成本和历史数据估算执行时间
    let totalTime = 0;
    
    strategySequence.forEach(step => {
      let estimatedTime = step.cost.time;
      
      // 考虑历史执行时间
      const history = this.costHistory.get(step.strategy);
      if (history && history.length > 0) {
        const avgHistoricalTime = history.reduce((sum, cost) => sum + cost, 0) / history.length;
        // 混合使用基础时间和历史时间
        estimatedTime = (estimatedTime + avgHistoricalTime * 1000) / 2;
      }
      
      // 考虑早期退出的可能性（后续策略可能不会执行）
      const earlyExitProbability = Math.max(0, 1 - step.order * 0.3);
      totalTime += estimatedTime * earlyExitProbability;
    });
    
    return Math.round(totalTime);
  }

  private generatePlanId(
    contentAnalysis: ContentAnalysisResult,
    options?: SimilarityOptions
  ): string {
    const parts = [
      contentAnalysis.contentType,
      contentAnalysis.complexity.level,
      contentAnalysis.contentLength.toString(),
      options?.strategy || 'auto',
      Date.now().toString(36)
    ];
    
    return parts.join('_');
  }

  /**
   * 获取执行计划统计信息
   */
  getPlanStats(): {
    strategyCosts: Record<SimilarityStrategyType, StrategyCost>;
    costHistorySize: number;
    averageCosts: Record<SimilarityStrategyType, number>;
  } {
    const strategyCosts: Record<SimilarityStrategyType, StrategyCost> = {} as Record<SimilarityStrategyType, StrategyCost>;
    const averageCosts: Record<SimilarityStrategyType, number> = {} as Record<SimilarityStrategyType, number>;
    let totalHistorySize = 0;
    
    // 转换策略成本
    this.strategyCosts.forEach((cost, strategy) => {
      strategyCosts[strategy] = cost;
      
      // 计算平均成本
      const history = this.costHistory.get(strategy);
      if (history && history.length > 0) {
        averageCosts[strategy] = history.reduce((sum, cost) => sum + cost, 0) / history.length;
        totalHistorySize += history.length;
      } else {
        averageCosts[strategy] = cost.total;
      }
    });
    
    return {
      strategyCosts,
      costHistorySize: totalHistorySize,
      averageCosts
    };
  }

  /**
   * 重置成本信息为默认值
   */
  resetToDefaults(): void {
    this.strategyCosts.clear();
    this.costHistory.clear();
    this.initializeStrategyCosts();
    this.logger.info('Strategy costs reset to default values');
  }
}