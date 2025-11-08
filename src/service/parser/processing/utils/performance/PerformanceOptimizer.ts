import { CodeChunk } from '../../types/CodeChunk';
import { EnhancedChunkingOptions } from '../../strategies/types/SegmentationTypes';
import { ASTNodeTracker } from '../AST/ASTNodeTracker';
import { BasePerformanceTracker } from '../base/BasePerformanceTracker';

export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  processingTime: number;
  nodeTrackingStats: {
    totalNodes: number;
    usedNodes: number;
    reuseCount: number;
  };
  cacheHitRate: number;
}

export interface OptimizationResult {
  optimizedChunks: CodeChunk[];
  metrics: PerformanceMetrics;
  optimizationsApplied: string[];
}

/**
 * 性能优化器 - 管理内存使用和性能优化
 */
export class PerformanceOptimizer extends BasePerformanceTracker {
  private cache: Map<string, any> = new Map();
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  private maxCacheSize: number = 1000;

  constructor(maxCacheSize: number = 1000) {
    super();
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * 优化代码块集合的性能
   */
  optimizeChunks(
    chunks: CodeChunk[],
    options: EnhancedChunkingOptions,
    nodeTracker?: ASTNodeTracker
  ): OptimizationResult {
    const startTime = Date.now();
    const optimizationsApplied: string[] = [];
    let optimizedChunks = [...chunks];

    // 1. 内存优化：清理未使用的AST节点
    if (nodeTracker && options.advanced?.astNodeTracking) {
      optimizedChunks = this.optimizeMemoryUsage(optimizedChunks, nodeTracker);
      optimizationsApplied.push('memory-optimization');
    }

    // 2. 缓存优化：缓存重复计算结果
    if (this.shouldUseCache(chunks)) {
      optimizedChunks = this.applyCacheOptimization(optimizedChunks);
      optimizationsApplied.push('cache-optimization');
    }

    // 3. 批量处理优化
    optimizedChunks = this.optimizeBatchProcessing(optimizedChunks, options);
    optimizationsApplied.push('batch-optimization');

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const metrics: PerformanceMetrics = {
      memoryUsage: process.memoryUsage(),
      processingTime,
      nodeTrackingStats: nodeTracker ? nodeTracker.getStats() : {
        totalNodes: 0,
        usedNodes: 0,
        reuseCount: 0
      },
      cacheHitRate: this.calculateCacheHitRate()
    };

    return {
      optimizedChunks,
      metrics,
      optimizationsApplied
    };
  }

  /**
   * 优化内存使用
   */
  private optimizeMemoryUsage(chunks: CodeChunk[], nodeTracker: ASTNodeTracker): CodeChunk[] {
    // 清理不再需要的AST节点引用
    const stats = nodeTracker.getStats();

    // 如果使用率过低，考虑清理部分缓存
    if (stats.usedNodes / stats.totalNodes < 0.1 && stats.totalNodes > 1000) {
      // 保留最近使用的节点，清理旧的节点
      const usedNodes = nodeTracker.getUsedNodes();
      const recentNodes = usedNodes.slice(-500); // 保留最近500个使用的节点

      nodeTracker.clear();
      recentNodes.forEach(node => nodeTracker.markUsed(node));
    }

    // 优化块内容，移除不必要的空白字符
    return chunks.map(chunk => ({
      ...chunk,
      content: chunk.content.trim()
    }));
  }

  /**
   * 应用缓存优化
   */
  private applyCacheOptimization(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.map(chunk => {
      const cacheKey = this.generateCacheKey(chunk);

      if (this.cache.has(cacheKey)) {
        this.cacheHits++;
        return this.cache.get(cacheKey) || chunk;
      } else {
        this.cacheMisses++;
        this.cache.set(cacheKey, chunk);
        this.ensureCacheSize();
        return chunk;
      }
    });
  }

  /**
   * 批量处理优化
   */
  private optimizeBatchProcessing(
    chunks: CodeChunk[],
    options: EnhancedChunkingOptions
  ): CodeChunk[] {
    // 如果块数量很大，分批处理
    if (chunks.length > 100) {
      const batchSize = 50;
      const optimizedBatches: CodeChunk[][] = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        optimizedBatches.push(this.processBatch(batch, options));
      }

      return optimizedBatches.flat();
    }

    return chunks;
  }

  /**
   * 处理单个批次
   */
  private processBatch(batch: CodeChunk[], options: EnhancedChunkingOptions): CodeChunk[] {
    // 应用批量优化逻辑
    return batch.map(chunk => {
      // 移除多余的空白行
      const optimizedContent = chunk.content
        .split('\n')
        .filter((line: string) => line.trim() !== '' || batch.length <= 10)
        .join('\n');

      return {
        ...chunk,
        content: optimizedContent
      };
    });
  }

  /**
   * 判断是否应该使用缓存
   */
  private shouldUseCache(chunks: CodeChunk[]): boolean {
    // 只有在块数量适中且内容较长时才使用缓存
    return chunks.length > 5 && chunks.length < 1000;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(chunk: CodeChunk): string {
    // 使用内容哈希和元数据生成缓存键
    const contentHash = this.simpleHash(chunk.content);
    const metadataHash = this.simpleHash(JSON.stringify(chunk.metadata));
    return `${contentHash}-${metadataHash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * 确保缓存大小在限制范围内
   */
  private ensureCacheSize(): void {
    if (this.cache.size > this.maxCacheSize) {
      // 简单的LRU策略：删除最早的条目
      const keys = Array.from(this.cache.keys());
      const keysToRemove = keys.slice(0, keys.length - this.maxCacheSize);

      for (const key of keysToRemove) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 计算缓存命中率
   */
  protected calculateCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * 监控内存使用情况
   */
  monitorMemoryUsage(): {
    current: NodeJS.MemoryUsage;
    threshold: number;
    isHighUsage: boolean;
  } {
    // 使用基类的内存监控方法
    return super.monitorMemoryUsage();
  }

  /**
   * 建议性能优化措施
   */
  suggestOptimizations(metrics: PerformanceMetrics): string[] {
    const suggestions: string[] = [];

    // 内存使用建议
    if (metrics.memoryUsage.heapUsed > 300 * 1024 * 1024) { // 300MB
      suggestions.push('Consider reducing maxCacheSize or enabling more aggressive cleanup');
    }

    // 缓存命中率建议
    if (metrics.cacheHitRate < 0.3) {
      suggestions.push('Cache hit rate is low, consider adjusting cache strategy');
    }

    // 节点跟踪效率建议
    const reuseRate = metrics.nodeTrackingStats.reuseCount / Math.max(metrics.nodeTrackingStats.totalNodes, 1);
    if (reuseRate < 0.1) {
      suggestions.push('Node tracking reuse rate is low, consider optimizing node tracking logic');
    }

    // 处理时间建议
    if (metrics.processingTime > 5000) { // 5秒
      suggestions.push('Processing time is high, consider enabling batch processing or reducing chunk size');
    }

    return suggestions;
  }
}