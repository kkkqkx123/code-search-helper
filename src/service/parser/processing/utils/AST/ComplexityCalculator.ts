/**
 * 统一复杂度计算器
 * 专门为ASTCodeSplitter优化的复杂度计算工具
 * 提供批量计算、缓存和性能监控功能
 */

import { ComplexityCalculator as BaseComplexityCalculator, ComplexityResult } from '../../../../../utils/parser/ComplexityCalculator';
import { ChunkType, CodeChunk } from '../../types/CodeChunk';
import { LRUCache } from '../../../../../utils/cache/LRUCache';
import { HashUtils } from '../../../../../utils/cache/HashUtils';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 复杂度计算配置接口
 */
export interface UnifiedComplexityConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 缓存TTL（毫秒） */
  cacheTTL?: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 批量计算时的并发数 */
  batchConcurrency?: number;
  /** 复杂度阈值配置 */
  thresholds?: {
    /** 最小复杂度阈值 */
    minComplexity?: number;
    /** 最大复杂度阈值 */
    maxComplexity?: number;
    /** 不同类型块的特定阈值 */
    typeSpecific?: {
      [key in ChunkType]?: {
        min?: number;
        max?: number;
      };
    };
  };
}

/**
 * 批量复杂度计算结果
 */
export interface BatchComplexityResult {
  /** 复杂度结果数组 */
  results: ComplexityResult[];
  /** 计算统计信息 */
  stats: {
    /** 总数量 */
    total: number;
    /** 缓存命中数量 */
    cacheHits: number;
    /** 缓存未命中数量 */
    cacheMisses: number;
    /** 计算耗时（毫秒） */
    duration: number;
    /** 平均复杂度 */
    averageComplexity: number;
    /** 复杂度分布 */
    distribution: {
      low: number;    // < 10
      medium: number; // 10-50
      high: number;   // > 50
    };
  };
}

/**
 * 复杂度缓存条目
 */
interface ComplexityCacheEntry {
  result: ComplexityResult;
  timestamp: number;
  contentHash: string;
}

/**
 * 统一复杂度计算器
 * 扩展基础复杂度计算器，添加缓存、批量处理和性能监控功能
 */
export class UnifiedComplexityCalculator {
  private config: Required<UnifiedComplexityConfig>;
  private logger: LoggerService;
  private cache: LRUCache<string, ComplexityCacheEntry>;
  private stats: {
    calculations: number;
    cacheHits: number;
    cacheMisses: number;
    totalTime: number;
  };

  constructor(logger: LoggerService, config: UnifiedComplexityConfig = {}) {
    this.logger = logger;
    this.config = {
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 10 * 60 * 1000, // 10分钟
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
      batchConcurrency: config.batchConcurrency || 10,
      thresholds: {
        minComplexity: config.thresholds?.minComplexity || 2,
        maxComplexity: config.thresholds?.maxComplexity || 500,
        typeSpecific: config.thresholds?.typeSpecific || {}
      }
    };

    this.cache = new LRUCache<string, ComplexityCacheEntry>(this.config.cacheSize, {
      enableStats: true,
      defaultTTL: this.config.cacheTTL
    });

    this.stats = {
      calculations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTime: 0
    };
  }

  /**
   * 计算单个内容的复杂度
   */
  calculateComplexity(
    content: string,
    chunkType: ChunkType,
    language?: string,
    config?: any
  ): ComplexityResult {
    const startTime = Date.now();

    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(content, chunkType, language);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        // 验证内容哈希
        const currentHash = HashUtils.fnv1aHash(content);
        if (cached.contentHash === currentHash) {
          this.stats.cacheHits++;
          if (this.config.enablePerformanceMonitoring) {
            this.logger.debug(`Complexity calculation cache hit for ${chunkType}`);
          }
          return cached.result;
        } else {
          // 哈希不匹配，删除缓存
          this.cache.delete(cacheKey);
        }
      }
    }

    // 执行计算
    const result = BaseComplexityCalculator.calculateComplexityByTypeWithLanguage(
      content,
      chunkType,
      language,
      config
    );

    // 缓存结果
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(content, chunkType, language);
      const entry: ComplexityCacheEntry = {
        result,
        timestamp: Date.now(),
        contentHash: HashUtils.fnv1aHash(content)
      };
      this.cache.set(cacheKey, entry);
    }

    // 更新统计
    this.stats.calculations++;
    this.stats.cacheMisses++;
    const duration = Date.now() - startTime;
    this.stats.totalTime += duration;

    if (this.config.enablePerformanceMonitoring) {
      this.logger.debug(`Complexity calculated for ${chunkType}: ${result.score} (${duration}ms)`);
    }

    return result;
  }

  /**
   * 批量计算复杂度
   */
  async calculateBatchComplexity(
    items: Array<{
      content: string;
      chunkType: ChunkType;
      language?: string;
      config?: any;
    }>
  ): Promise<BatchComplexityResult> {
    const startTime = Date.now();
    const results: ComplexityResult[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // 分批处理以控制并发
    const batches = this.createBatches(items, this.config.batchConcurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(item => {
        return new Promise<ComplexityResult>((resolve) => {
          const result = this.calculateComplexity(
            item.content,
            item.chunkType,
            item.language,
            item.config
          );

          // 更新缓存统计
          if (this.config.enableCache) {
            const cacheKey = this.generateCacheKey(item.content, item.chunkType, item.language);
            if (this.cache.get(cacheKey)) {
              cacheHits++;
            } else {
              cacheMisses++;
            }
          }

          resolve(result);
        });
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const duration = Date.now() - startTime;
    const averageComplexity = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    // 计算复杂度分布
    const distribution = this.calculateDistribution(results);

    const batchResult: BatchComplexityResult = {
      results,
      stats: {
        total: items.length,
        cacheHits,
        cacheMisses,
        duration,
        averageComplexity,
        distribution
      }
    };

    if (this.config.enablePerformanceMonitoring) {
      this.logger.debug(`Batch complexity calculation completed: ${items.length} items in ${duration}ms`);
    }

    return batchResult;
  }

  /**
   * 批量计算CodeChunk复杂度
   */
  async calculateBatchComplexityFromChunks(chunks: CodeChunk[]): Promise<BatchComplexityResult> {
    const items = chunks.map(chunk => ({
      content: chunk.content,
      chunkType: chunk.metadata.type,
      language: chunk.metadata.language,
      config: undefined
    }));

    const result = await this.calculateBatchComplexity(items);

    // 将复杂度信息添加到原始chunks中
    chunks.forEach((chunk, index) => {
      if (result.results[index]) {
        chunk.metadata.complexity = result.results[index].score;
        chunk.metadata.complexityAnalysis = result.results[index].analysis;
      }
    });

    return result;
  }

  /**
   * 验证复杂度是否在有效范围内
   */
  validateComplexity(
    complexity: number,
    chunkType: ChunkType,
    customThresholds?: { min?: number; max?: number }
  ): boolean {
    const typeThresholds = this.config.thresholds.typeSpecific?.[chunkType];
    const thresholds = customThresholds || typeThresholds;
    const min = (thresholds?.min ?? this.config.thresholds.minComplexity) as number;
    const max = (thresholds?.max ?? this.config.thresholds.maxComplexity) as number;

    return complexity >= min && complexity <= max;
  }

  /**
   * 过滤复杂度有效的chunks
   */
  filterValidChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.filter(chunk => {
      const complexity = chunk.metadata.complexity;
      if (complexity === undefined) return true; // 未计算复杂度的chunks保持有效

      return this.validateComplexity(complexity, chunk.metadata.type);
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    calculations: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    averageCalculationTime: number;
    cacheStats?: any;
  } {
    const cacheStats = this.cache.getStats();
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;

    return {
      calculations: this.stats.calculations,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0,
      averageCalculationTime: this.stats.calculations > 0 ? this.stats.totalTime / this.stats.calculations : 0,
      cacheStats
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Complexity calculator cache cleared');
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): number {
    const removed = this.cache.cleanup();
    if (removed > 0) {
      this.logger.debug(`Complexity calculator cache cleanup: removed ${removed} expired entries`);
    }
    return removed;
  }

  /**
   * 销毁计算器
   */
  destroy(): void {
    this.cache.clear();
    this.logger.debug('Unified complexity calculator destroyed');
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string, chunkType: ChunkType, language?: string): string {
    const contentHash = HashUtils.fnv1aHash(content);
    const lang = language || 'unknown';
    return `${chunkType}:${lang}:${contentHash}`;
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 计算复杂度分布
   */
  private calculateDistribution(results: ComplexityResult[]): { low: number; medium: number; high: number } {
    const distribution = { low: 0, medium: 0, high: 0 };

    for (const result of results) {
      if (result.score < 10) {
        distribution.low++;
      } else if (result.score <= 50) {
        distribution.medium++;
      } else {
        distribution.high++;
      }
    }

    return distribution;
  }
}