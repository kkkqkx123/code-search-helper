import { inject, injectable } from 'inversify';
import { 
  ISimilarityService, 
  ISimilarityStrategy, 
  SimilarityOptions, 
  SimilarityResult, 
  BatchSimilarityResult,
  AdvancedSimilarityOptions,
  SimilarityStrategyType,
  SimilarityError,
  ISimilarityCacheManager,
  ISimilarityPerformanceMonitor
} from './types/SimilarityTypes';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { LevenshteinSimilarityStrategy } from './strategies/LevenshteinSimilarityStrategy';
import { SemanticSimilarityStrategy } from './strategies/SemanticSimilarityStrategy';
import { KeywordSimilarityStrategy } from './strategies/KeywordSimilarityStrategy';
import { HybridSimilarityStrategy } from './strategies/HybridSimilarityStrategy';

/**
 * 相似度服务主类
 * 提供统一的相似度计算接口和策略管理
 */
@injectable()
export class SimilarityService implements ISimilarityService {
  private strategies: Map<SimilarityStrategyType, ISimilarityStrategy> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.SimilarityCacheManager) private cacheManager?: ISimilarityCacheManager,
    @inject(TYPES.SimilarityPerformanceMonitor) private performanceMonitor?: ISimilarityPerformanceMonitor,
    @inject(LevenshteinSimilarityStrategy) levenshteinStrategy?: LevenshteinSimilarityStrategy,
    @inject(SemanticSimilarityStrategy) semanticStrategy?: SemanticSimilarityStrategy,
    @inject(KeywordSimilarityStrategy) keywordStrategy?: KeywordSimilarityStrategy,
    @inject(HybridSimilarityStrategy) hybridStrategy?: HybridSimilarityStrategy
  ) {
    // 注册策略
    if (levenshteinStrategy) {
      this.strategies.set('levenshtein', levenshteinStrategy);
    }
    if (semanticStrategy) {
      this.strategies.set('semantic', semanticStrategy);
    }
    if (keywordStrategy) {
      this.strategies.set('keyword', keywordStrategy);
    }
    if (hybridStrategy) {
      this.strategies.set('hybrid', hybridStrategy);
    }

    this.logger?.info('SimilarityService initialized with strategies:', 
      Array.from(this.strategies.keys()));
  }

  async calculateSimilarity(
    content1: string, 
    content2: string, 
    options?: SimilarityOptions
  ): Promise<SimilarityResult> {
    const endTimer = this.performanceMonitor?.startTimer() || (() => 0);
    
    try {
      // 验证输入
      this.validateInput(content1, content2, options);

      // 选择策略
      const strategy = this.selectStrategy(options);
      
      // 生成缓存键
      const cacheKey = this.cacheManager ? 
        this.generateCacheKey(content1, content2, strategy.type, options) : null;

      // 检查缓存
      let similarity: number | undefined;
      let cacheHit = false;
      
      if (cacheKey && this.cacheManager) {
        const cachedResult = await this.cacheManager.get(cacheKey);
        if (cachedResult !== null) {
          similarity = cachedResult;
          cacheHit = true;
          this.logger?.debug(`Cache hit for similarity calculation`);
        }
      }

      // 如果缓存未命中，计算相似度
      if (similarity === undefined) {
        similarity = await strategy.calculate(content1, content2, options);
        
        // 缓存结果
        if (cacheKey && this.cacheManager) {
          await this.cacheManager.set(cacheKey, similarity);
        }
      }

      // 记录性能指标
      const executionTime = endTimer();
      this.performanceMonitor?.recordCalculation(strategy.type, executionTime, cacheHit);

      // 构建结果
      const threshold = options?.threshold || strategy.getDefaultThreshold();
      const result: SimilarityResult = {
        similarity,
        isSimilar: similarity >= threshold,
        threshold,
        strategy: strategy.type,
        details: {
          executionTime,
          cacheHit
        }
      };

      this.logger?.debug(`Similarity calculated: ${similarity.toFixed(3)} using ${strategy.name}`);
      return result;
    } catch (error) {
      this.logger?.error('Error calculating similarity:', error);
      throw new SimilarityError(
        'Failed to calculate similarity',
        'CALCULATION_ERROR',
        { content1Length: content1.length, content2Length: content2.length, options }
      );
    }
  }

  async calculateBatchSimilarity(
    contents: string[],
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const startTime = Date.now();
    let cacheHits = 0;

    try {
      if (contents.length < 2) {
        throw new SimilarityError(
          'At least 2 contents are required for batch similarity calculation',
          'INSUFFICIENT_INPUT',
          { count: contents.length }
        );
      }

      const strategy = this.selectStrategy(options);
      const matrix: number[][] = [];
      const pairs: Array<{
        index1: number;
        index2: number;
        similarity: number;
        isSimilar: boolean;
      }> = [];

      // 计算相似度矩阵
      for (let i = 0; i < contents.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < contents.length; j++) {
          if (i === j) {
            matrix[i][j] = 1.0;
          } else if (i > j) {
            // 利用对称性
            matrix[i][j] = matrix[j][i];
          } else {
            const result = await this.calculateSimilarity(contents[i], contents[j], options);
            matrix[i][j] = result.similarity;
            
            if (result.details?.cacheHit) {
              cacheHits++;
            }

            // 记录对
            pairs.push({
              index1: i,
              index2: j,
              similarity: result.similarity,
              isSimilar: result.isSimilar
            });
          }
        }
      }

      const executionTime = Date.now() - startTime;
      
      this.logger?.info(`Batch similarity calculation completed: ${contents.length} items, ${executionTime}ms`);
      
      return {
        matrix,
        pairs,
        executionTime,
        cacheHits
      };
    } catch (error) {
      this.logger?.error('Error in batch similarity calculation:', error);
      throw error;
    }
  }

  async calculateAdvancedSimilarity(
    content1: string,
    content2: string,
    options: AdvancedSimilarityOptions
  ): Promise<SimilarityResult> {
    // 使用混合策略进行高级相似度计算
    const hybridStrategy = this.strategies.get('hybrid');
    if (!hybridStrategy) {
      throw new SimilarityError(
        'Hybrid strategy not available for advanced similarity calculation',
        'STRATEGY_NOT_AVAILABLE',
        { strategy: 'hybrid' }
      );
    }

    return this.calculateSimilarity(content1, content2, options);
  }

  async isSimilar(
    content1: string,
    content2: string,
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<boolean> {
    const result = await this.calculateSimilarity(content1, content2, {
      ...options,
      threshold
    });
    return result.isSimilar;
  }

  async filterSimilarItems<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }

    const uniqueItems: T[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      const currentId = currentItem.id || String(i);
      
      if (processed.has(currentId)) {
        continue;
      }

      let isDuplicate = false;
      
      // 检查与已处理项目的相似度
      for (const uniqueItem of uniqueItems) {
        const similarity = await this.calculateSimilarity(
          currentItem.content, 
          uniqueItem.content, 
          { ...options, threshold }
        );
        
        if (similarity.isSimilar) {
          isDuplicate = true;
          processed.add(currentId);
          break;
        }
      }

      if (!isDuplicate) {
        uniqueItems.push(currentItem);
        processed.add(currentId);
      }
    }

    this.logger?.info(`Filtered ${items.length} items to ${uniqueItems.length} unique items`);
    return uniqueItems;
  }

  async findSimilarityGroups<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<Map<string, T[]>> {
    const groups = new Map<string, T[]>();
    const processed = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      const currentId = currentItem.id || String(i);
      
      if (processed.has(currentId)) {
        continue;
      }

      const group: T[] = [currentItem];
      processed.add(currentId);

      // 查找相似项目
      for (let j = i + 1; j < items.length; j++) {
        const otherItem = items[j];
        const otherId = otherItem.id || String(j);
        
        if (processed.has(otherId)) {
          continue;
        }

        const similarity = await this.calculateSimilarity(
          currentItem.content,
          otherItem.content,
          { ...options, threshold }
        );

        if (similarity.isSimilar) {
          group.push(otherItem);
          processed.add(otherId);
        }
      }

      // 只有包含多个项目的组才被添加
      if (group.length > 1) {
        groups.set(currentId, group);
      }
    }

    this.logger?.info(`Found ${groups.size} similarity groups from ${items.length} items`);
    return groups;
  }

  /**
   * 选择合适的策略
   */
  private selectStrategy(options?: SimilarityOptions): ISimilarityStrategy {
    const strategyType = options?.strategy || 'hybrid';
    const strategy = this.strategies.get(strategyType);
    
    if (!strategy) {
      throw new SimilarityError(
        `Strategy not found: ${strategyType}`,
        'STRATEGY_NOT_FOUND',
        { strategy: strategyType, available: Array.from(this.strategies.keys()) }
      );
    }

    // 检查策略是否支持当前内容类型
    if (!strategy.isSupported(options?.contentType || 'generic', options?.language)) {
      this.logger?.warn(`Strategy ${strategy.name} may not support content type: ${options?.contentType}`);
    }

    return strategy;
  }

  /**
   * 验证输入参数
   */
  private validateInput(content1: string, content2: string, options?: SimilarityOptions): void {
    if (!content1 || !content2) {
      throw new SimilarityError(
        'Content cannot be empty',
        'INVALID_INPUT',
        { content1: !!content1, content2: !!content2 }
      );
    }

    if (options?.threshold !== undefined && (options.threshold < 0 || options.threshold > 1)) {
      throw new SimilarityError(
        'Threshold must be between 0 and 1',
        'INVALID_THRESHOLD',
        { threshold: options.threshold }
      );
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    content1: string,
    content2: string,
    strategy: SimilarityStrategyType,
    options?: SimilarityOptions
  ): string {
    if (this.cacheManager && 'generateCacheKey' in this.cacheManager) {
      return (this.cacheManager as any).generateCacheKey(content1, content2, strategy, options);
    }
    
    // 简单的缓存键生成
    const hash1 = this.simpleHash(content1);
    const hash2 = this.simpleHash(content2);
    const optionsHash = options ? this.simpleHash(JSON.stringify(options)) : '';
    
    return `${strategy}:${hash1}:${hash2}:${optionsHash}`;
  }

  /**
   * 简单的哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取可用策略列表
   */
  getAvailableStrategies(): SimilarityStrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 获取服务统计信息
   */
  async getServiceStats(): Promise<{
    strategies: SimilarityStrategyType[];
    cacheStats?: any;
    performanceStats?: any;
  }> {
    const stats: any = {
      strategies: this.getAvailableStrategies()
    };

    if (this.cacheManager) {
      stats.cacheStats = await this.cacheManager.getStats();
    }

    if (this.performanceMonitor) {
      stats.performanceStats = this.performanceMonitor.getMetrics();
    }

    return stats;
  }
}