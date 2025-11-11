import { injectable, inject } from 'inversify';
import { 
  IThresholdManager, 
  EarlyExitThresholds,
  SimilarityStrategyType,
  StrategyExecutionResult
} from './types/CoordinationTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 阈值管理器
 * 负责管理各种阈值，支持自适应调整
 */
@injectable()
export class ThresholdManager implements IThresholdManager {
  private earlyExitThresholds: Map<string, EarlyExitThresholds> = new Map();
  private strategyThresholds: Map<string, Map<SimilarityStrategyType, number>> = new Map();
  private adaptiveHistory: Map<string, StrategyExecutionResult[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.initializeDefaultThresholds();
  }

  getEarlyExitThresholds(contentType: string): EarlyExitThresholds {
    const thresholds = this.earlyExitThresholds.get(contentType);
    if (!thresholds) {
      this.logger.warn(`No early exit thresholds found for content type: ${contentType}, using defaults`);
      return this.getDefaultEarlyExitThresholds();
    }
    return thresholds;
  }

  getStrategyThreshold(strategy: SimilarityStrategyType, contentType: string): number {
    const contentTypeThresholds = this.strategyThresholds.get(contentType);
    if (!contentTypeThresholds) {
      this.logger.warn(`No strategy thresholds found for content type: ${contentType}, using defaults`);
      return this.getDefaultStrategyThreshold(strategy);
    }
    
    const threshold = contentTypeThresholds.get(strategy);
    if (threshold === undefined) {
      this.logger.warn(`No threshold found for strategy: ${strategy} in content type: ${contentType}, using default`);
      return this.getDefaultStrategyThreshold(strategy);
    }
    
    return threshold;
  }

  updateThreshold(
    type: 'earlyExit' | 'strategy',
    key: string | SimilarityStrategyType,
    threshold: number | EarlyExitThresholds,
    contentType: string = 'generic'
  ): void {
    if (type === 'earlyExit') {
      if (typeof threshold === 'number') {
        throw new Error('Early exit thresholds must be EarlyExitThresholds object');
      }
      this.earlyExitThresholds.set(contentType, threshold);
      this.logger.debug(`Updated early exit thresholds for content type: ${contentType}`);
    } else if (type === 'strategy') {
      if (typeof threshold !== 'number') {
        throw new Error('Strategy thresholds must be number');
      }
      
      let contentTypeThresholds = this.strategyThresholds.get(contentType);
      if (!contentTypeThresholds) {
        contentTypeThresholds = new Map();
        this.strategyThresholds.set(contentType, contentTypeThresholds);
      }
      
      contentTypeThresholds.set(key as SimilarityStrategyType, threshold);
      this.logger.debug(`Updated strategy threshold for ${key} in content type: ${contentType}`);
    }
  }

  adaptThresholds(
    strategy: SimilarityStrategyType,
    contentType: string,
    results: StrategyExecutionResult[]
  ): void {
    if (results.length === 0) {
      return;
    }
    
    // 获取历史记录
    const historyKey = `${contentType}:${strategy}`;
    let history = this.adaptiveHistory.get(historyKey);
    if (!history) {
      history = [];
      this.adaptiveHistory.set(historyKey, history);
    }
    
    // 添加新结果到历史记录
    history.push(...results);
    
    // 保持历史记录在合理范围内（最多1000个结果）
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    // 计算适应性调整
    this.performAdaptiveAdjustment(strategy, contentType, history);
  }

  private initializeDefaultThresholds(): void {
    // 初始化早期退出阈值
    const contentTypes = ['code', 'document', 'generic'];
    
    contentTypes.forEach(contentType => {
      this.earlyExitThresholds.set(contentType, this.getDefaultEarlyExitThresholds());
    });
    
    // 初始化策略阈值
    contentTypes.forEach(contentType => {
      const strategyThresholds = new Map<SimilarityStrategyType, number>();
      
      strategyThresholds.set('keyword', this.getDefaultStrategyThreshold('keyword'));
      strategyThresholds.set('levenshtein', this.getDefaultStrategyThreshold('levenshtein'));
      strategyThresholds.set('semantic', this.getDefaultStrategyThreshold('semantic'));
      strategyThresholds.set('hybrid', this.getDefaultStrategyThreshold('hybrid'));
      
      this.strategyThresholds.set(contentType, strategyThresholds);
    });
  }

  private getDefaultEarlyExitThresholds(): EarlyExitThresholds {
    return {
      high: 0.9,   // 高相似度阈值
      medium: 0.7, // 中相似度阈值
      low: 0.5     // 低相似度阈值
    };
  }

  private getDefaultStrategyThreshold(strategy: SimilarityStrategyType): number {
    switch (strategy) {
      case 'keyword':
        return 0.8; // 关键词相似度阈值较高
      case 'levenshtein':
        return 0.75; // 编辑距离相似度阈值中等
      case 'semantic':
        return 0.7; // 语义相似度阈值较低
      case 'hybrid':
        return 0.75; // 混合策略阈值中等
      default:
        return 0.75;
    }
  }

  private performAdaptiveAdjustment(
    strategy: SimilarityStrategyType,
    contentType: string,
    history: StrategyExecutionResult[]
  ): void {
    if (history.length < 10) {
      // 需要足够的历史数据才能进行适应性调整
      return;
    }
    
    // 分析最近的执行结果
    const recentResults = history.slice(-50); // 最近50个结果
    const successRate = recentResults.filter(r => r.success).length / recentResults.length;
    const averageSimilarity = recentResults.reduce((sum, r) => sum + r.similarity, 0) / recentResults.length;
    const averageExecutionTime = recentResults.reduce((sum, r) => sum + r.executionTime, 0) / recentResults.length;
    
    // 获取当前阈值
    const currentThreshold = this.getStrategyThreshold(strategy, contentType);
    let newThreshold = currentThreshold;
    
    // 基于成功率调整
    if (successRate < 0.8) {
      // 成功率低，可能阈值过高
      newThreshold *= 0.95; // 降低5%
    } else if (successRate > 0.95) {
      // 成功率很高，可能阈值过低
      newThreshold *= 1.02; // 提高2%
    }
    
    // 基于平均相似度调整
    if (averageSimilarity < 0.3 && currentThreshold > 0.6) {
      // 平均相似度很低但阈值很高，降低阈值
      newThreshold *= 0.9;
    } else if (averageSimilarity > 0.8 && currentThreshold < 0.8) {
      // 平均相似度很高但阈值很低，提高阈值
      newThreshold *= 1.1;
    }
    
    // 基于执行时间调整
    if (averageExecutionTime > 1000) { // 超过1秒
      // 执行时间过长，可以适当降低阈值以减少后续计算
      newThreshold *= 0.98;
    }
    
    // 确保阈值在合理范围内
    newThreshold = Math.max(0.3, Math.min(0.95, newThreshold));
    
    // 如果调整幅度超过5%，应用新阈值
    if (Math.abs(newThreshold - currentThreshold) > 0.05) {
      this.updateThreshold('strategy', strategy, newThreshold, contentType);
      this.logger.info(`Adapted threshold for ${strategy} (${contentType}): ${currentThreshold.toFixed(3)} -> ${newThreshold.toFixed(3)}`, {
        successRate,
        averageSimilarity,
        averageExecutionTime
      });
    }
  }

  /**
   * 获取阈值统计信息
   */
  getThresholdStats(): {
    earlyExitThresholds: Record<string, EarlyExitThresholds>;
    strategyThresholds: Record<string, Record<SimilarityStrategyType, number>>;
    adaptiveHistorySize: number;
  } {
    const earlyExitThresholds: Record<string, EarlyExitThresholds> = {};
    const strategyThresholds: Record<string, Record<SimilarityStrategyType, number>> = {};
    
    // 转换早期退出阈值
    this.earlyExitThresholds.forEach((thresholds, contentType) => {
      earlyExitThresholds[contentType] = thresholds;
    });
    
    // 转换策略阈值
    this.strategyThresholds.forEach((thresholds, contentType) => {
      strategyThresholds[contentType] = {} as Record<SimilarityStrategyType, number>;
      thresholds.forEach((threshold, strategy) => {
        strategyThresholds[contentType][strategy] = threshold;
      });
    });
    
    // 计算自适应历史记录大小
    let adaptiveHistorySize = 0;
    this.adaptiveHistory.forEach(history => {
      adaptiveHistorySize += history.length;
    });
    
    return {
      earlyExitThresholds,
      strategyThresholds,
      adaptiveHistorySize
    };
  }

  /**
   * 重置阈值为默认值
   */
  resetToDefaults(): void {
    this.earlyExitThresholds.clear();
    this.strategyThresholds.clear();
    this.adaptiveHistory.clear();
    this.initializeDefaultThresholds();
    this.logger.info('Thresholds reset to default values');
  }

  /**
   * 清理过期的自适应历史记录
   */
  cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let totalCleaned = 0;
    
    this.adaptiveHistory.forEach((history, key) => {
      const originalLength = history.length;
      
      // 移除过期的记录（这里假设结果有时间戳，如果没有则需要其他方式）
      // 由于StrategyExecutionResult没有时间戳，这里暂时不实现
      // 实际使用时可能需要扩展StrategyExecutionResult接口
      
      if (history.length < originalLength) {
        totalCleaned += originalLength - history.length;
        this.logger.debug(`Cleaned ${originalLength - history.length} old records for ${key}`);
      }
    });
    
    if (totalCleaned > 0) {
      this.logger.info(`Cleaned up ${totalCleaned} expired adaptive history records`);
    }
  }
}