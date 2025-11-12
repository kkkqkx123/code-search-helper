import { injectable, inject } from 'inversify';
import {
  IBatchCalculatorFactory,
  IBatchSimilarityCalculator,
  BatchCalculatorType
} from './types/BatchCalculatorTypes';
import { ISimilarityStrategy } from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

// 导入具体的批处理计算器实现
import { GenericBatchCalculator } from './calculators/GenericBatchCalculator';
import { SemanticOptimizedBatchCalculator } from './calculators/SemanticOptimizedBatchCalculator';
import { HybridOptimizedBatchCalculator } from './calculators/HybridOptimizedBatchCalculator';
import { AdaptiveBatchCalculator } from './calculators/AdaptiveBatchCalculator';

/**
 * 批处理计算器工厂
 * 负责创建和管理不同类型的批处理计算器
 */
@injectable()
export class BatchCalculatorFactory implements IBatchCalculatorFactory {
  private calculators: Map<BatchCalculatorType, IBatchSimilarityCalculator> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    // 注入具体的计算器实现
    @inject(TYPES.GenericBatchCalculator) private genericCalculator?: GenericBatchCalculator,
    @inject(TYPES.SemanticOptimizedBatchCalculator) private semanticCalculator?: SemanticOptimizedBatchCalculator,
    @inject(TYPES.HybridOptimizedBatchCalculator) private hybridCalculator?: HybridOptimizedBatchCalculator,
    @inject(TYPES.AdaptiveBatchCalculator) private adaptiveCalculator?: AdaptiveBatchCalculator
  ) {
    this.initializeCalculators();
  }

  /**
   * 初始化可用的计算器
   */
  private initializeCalculators(): void {
    // 注册通用计算器
    if (this.genericCalculator) {
      this.calculators.set('generic', this.genericCalculator);
    }

    // 注册语义优化计算器
    if (this.semanticCalculator) {
      this.calculators.set('semantic-optimized', this.semanticCalculator);
    }

    // 注册混合优化计算器
    if (this.hybridCalculator) {
      this.calculators.set('hybrid-optimized', this.hybridCalculator);
    }

    // 注册自适应计算器
    if (this.adaptiveCalculator) {
      this.calculators.set('adaptive', this.adaptiveCalculator);
    }

    this.logger?.info('Batch calculator factory initialized', {
      availableCalculators: Array.from(this.calculators.keys())
    });
  }

  /**
   * 创建批处理计算器
   */
  createCalculator(type: BatchCalculatorType): IBatchSimilarityCalculator {
    const calculator = this.calculators.get(type);

    if (!calculator) {
      const availableTypes = Array.from(this.calculators.keys());
      throw new Error(
        `Batch calculator type '${type}' is not available. Available types: ${availableTypes.join(', ')}`
      );
    }

    this.logger?.debug(`Created batch calculator: ${type}`, {
      calculatorName: calculator.name
    });

    return calculator;
  }

  /**
   * 获取可用的计算器类型列表
   */
  getAvailableCalculators(): BatchCalculatorType[] {
    return Array.from(this.calculators.keys());
  }

  /**
   * 根据策略自动选择最优的计算器
   */
  selectOptimalCalculator(strategy: ISimilarityStrategy, contents: string[]): BatchCalculatorType {
    const strategyType = strategy.type;
    const contentCount = contents.length;
    const avgContentLength = contents.reduce((sum, content) => sum + content.length, 0) / contentCount;

    // 智能选择逻辑
    let recommendedType: BatchCalculatorType;

    if (strategyType === 'semantic') {
      // 语义相似度策略优先使用语义优化计算器
      if (this.calculators.has('semantic-optimized') && contentCount > 3) {
        recommendedType = 'semantic-optimized';
      } else {
        recommendedType = 'adaptive';
      }
    } else if (strategyType === 'hybrid') {
      // 混合策略优先使用混合优化计算器
      if (this.calculators.has('hybrid-optimized') && contentCount > 5) {
        recommendedType = 'hybrid-optimized';
      } else {
        recommendedType = 'adaptive';
      }
    } else if (strategyType === 'levenshtein' || strategyType === 'keyword') {
      // 本地计算策略使用通用计算器
      recommendedType = 'generic';
    } else {
      // 未知策略使用自适应计算器
      recommendedType = 'adaptive';
    }

    // 根据内容特征调整选择
    if (contentCount < 5) {
      // 小批量内容，通用计算器通常足够
      recommendedType = 'generic';
    } else if (contentCount > 100) {
      // 大批量内容，优先使用优化计算器
      if (this.calculators.has('adaptive')) {
        recommendedType = 'adaptive';
      }
    }

    // 验证推荐的计算器是否可用
    if (!this.calculators.has(recommendedType)) {
      this.logger?.warn(`Recommended calculator '${recommendedType}' is not available, falling back to generic`);
      recommendedType = 'generic';
    }

    this.logger?.debug(`Selected optimal batch calculator`, {
      strategyType,
      contentCount,
      avgContentLength,
      recommendedType,
      availableCalculators: Array.from(this.calculators.keys())
    });

    return recommendedType;
  }

  /**
   * 获取计算器的详细信息
   */
  getCalculatorInfo(type: BatchCalculatorType): {
    name: string;
    type: BatchCalculatorType;
    available: boolean;
    supportedStrategies?: string[];
  } | null {
    const calculator = this.calculators.get(type);

    if (!calculator) {
      return {
        name: 'Unknown',
        type,
        available: false
      };
    }

    return {
      name: calculator.name,
      type: calculator.type,
      available: true
    };
  }

  /**
   * 获取所有计算器的信息
   */
  getAllCalculatorInfo(): Array<{
    name: string;
    type: BatchCalculatorType;
    available: boolean;
  }> {
    const allTypes: BatchCalculatorType[] = ['generic', 'semantic-optimized', 'hybrid-optimized', 'adaptive'];

    return allTypes.map(type => this.getCalculatorInfo(type)!);
  }

  /**
   * 注册新的计算器
   */
  registerCalculator(type: BatchCalculatorType, calculator: IBatchSimilarityCalculator): void {
    this.calculators.set(type, calculator);
    this.logger?.info(`Registered batch calculator: ${type}`, {
      calculatorName: calculator.name
    });
  }

  /**
   * 注销计算器
   */
  unregisterCalculator(type: BatchCalculatorType): boolean {
    const removed = this.calculators.delete(type);
    if (removed) {
      this.logger?.info(`Unregistered batch calculator: ${type}`);
    }
    return removed;
  }

  /**
   * 检查计算器是否可用
   */
  isCalculatorAvailable(type: BatchCalculatorType): boolean {
    return this.calculators.has(type);
  }

  /**
   * 获取工厂统计信息
   */
  getFactoryStats(): {
    totalCalculators: number;
    availableTypes: BatchCalculatorType[];
    registeredCalculators: Array<{
      name: string;
      type: BatchCalculatorType;
    }>;
  } {
    return {
      totalCalculators: this.calculators.size,
      availableTypes: Array.from(this.calculators.keys()),
      registeredCalculators: Array.from(this.calculators.values()).map(calc => ({
        name: calc.name,
        type: calc.type
      }))
    };
  }
}