import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { NebulaQueryResult } from '../NebulaTypes';

// 内存优化配置
export interface MemoryOptimizerConfig {
  enableObjectPooling: boolean;
  maxPoolSize: number;
  enableResultSetOptimization: boolean;
  maxResultSetSize: number;
  enableSmartCacheEviction: boolean;
  cacheEvictionThreshold: number;
  enableMemoryMonitoring: boolean;
  memoryCheckInterval: number;
  gcThreshold: number;
}

// 对象池配置
export interface ObjectPoolConfig {
  maxSize: number;
  objectFactory: () => any;
  resetFunction?: (obj: any) => void;
  validateFunction?: (obj: any) => boolean;
}

// 内存使用统计
export interface MemoryUsageStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  percentage: number;
  objectPoolSize: number;
  cachedResultSets: number;
  lastGcRun: Date | null;
}

// 默认内存优化配置
const DEFAULT_MEMORY_OPTIMIZER_CONFIG: MemoryOptimizerConfig = {
  enableObjectPooling: true,
  maxPoolSize: 100,
  enableResultSetOptimization: true,
  maxResultSetSize: 1000000, // 1MB
  enableSmartCacheEviction: true,
  cacheEvictionThreshold: 0.8, // 80%内存使用率
  enableMemoryMonitoring: true,
  memoryCheckInterval: 5000, // 5秒
  gcThreshold: 0.75 // 75%内存使用率触发GC
};

/**
 * 内存优化器
 * 优化内存使用，实现对象池、结果集优化和智能缓存淘汰
 */
@injectable()
export class MemoryOptimizer extends EventEmitter {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private performanceMonitor: PerformanceMonitor;
  private config: MemoryOptimizerConfig;
  private objectPools: Map<string, any[]> = new Map();
  private memoryCheckTimer: NodeJS.Timeout | null = null;
  private lastGcRun: Date | null = null;
  private cachedResultSets: Map<string, { data: any; size: number; timestamp: Date }> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.performanceMonitor = performanceMonitor;
    this.config = { ...DEFAULT_MEMORY_OPTIMIZER_CONFIG };
    
    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * 更新内存优化配置
   */
  updateConfig(config: Partial<MemoryOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Memory optimizer config updated', { config: this.config });
  }

  /**
   * 获取对象池
   */
  getObjectPool<T>(poolName: string, config: ObjectPoolConfig): T[] {
    if (!this.config.enableObjectPooling) {
      return [];
    }

    if (!this.objectPools.has(poolName)) {
      this.objectPools.set(poolName, []);
    }

    const pool = this.objectPools.get(poolName)!;

    // 如果池中有可用对象，返回一个
    if (pool.length > 0) {
      const obj = pool.pop();
      if (config.validateFunction && !config.validateFunction(obj)) {
        // 对象无效，重新创建
        return config.objectFactory();
      }
      return obj;
    }

    // 池为空，创建新对象
    return config.objectFactory();
  }

  /**
   * 释放对象回池
   */
  releaseObjectToPool<T>(poolName: string, obj: T, resetFunction?: (obj: T) => void): void {
    if (!this.config.enableObjectPooling) {
      return;
    }

    const pool = this.objectPools.get(poolName) || [];
    
    // 重置对象状态
    if (resetFunction) {
      resetFunction(obj);
    }

    // 检查池大小限制
    if (pool.length < this.config.maxPoolSize) {
      pool.push(obj);
      this.objectPools.set(poolName, pool);
      this.emit('objectReleased', { poolName, poolSize: pool.length });
    } else {
      // 池已满，丢弃对象
      this.logger.debug('Object pool is full, discarding object', { poolName });
    }
  }

  /**
   * 优化查询结果集
   */
  optimizeResultSet<T extends NebulaQueryResult>(resultSet: T): T {
    if (!this.config.enableResultSetOptimization) {
      return resultSet;
    }

    try {
      // 检查结果集大小
      const size = this.calculateObjectSize(resultSet);
      
      if (size > this.config.maxResultSetSize) {
        this.logger.warn('Large result set detected, applying optimization', {
          size,
          maxResultSetSize: this.config.maxResultSetSize
        });

        // 实现结果集分页或流式处理
        return this.applyResultSetOptimization(resultSet);
      }

      return resultSet;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Result set optimization failed'),
        { component: 'MemoryOptimizer', operation: 'optimizeResultSet' }
      );
      return resultSet; // 返回原始结果集
    }
  }

  /**
   * 缓存结果集
   */
  cacheResultSet(key: string, resultSet: any): void {
    if (!this.config.enableSmartCacheEviction) {
      return;
    }

    const size = this.calculateObjectSize(resultSet);
    const timestamp = new Date();

    this.cachedResultSets.set(key, { data: resultSet, size, timestamp });

    // 检查是否需要执行缓存淘汰
    this.checkCacheEviction();
  }

  /**
   * 获取缓存的结果集
   */
  getCachedResultSet(key: string): any | null {
    const cached = this.cachedResultSets.get(key);
    if (!cached) {
      return null;
    }

    // 更新访问时间
    cached.timestamp = new Date();
    this.cachedResultSets.set(key, cached);

    return cached.data;
  }

  /**
   * 手动触发垃圾回收
   */
  triggerGarbageCollection(): void {
    if (typeof global.gc === 'function') {
      global.gc();
      this.lastGcRun = new Date();
      this.logger.info('Manual garbage collection triggered');
      this.emit('gcTriggered', { timestamp: this.lastGcRun });
    } else {
      this.logger.warn('Manual garbage collection not available');
    }
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): MemoryUsageStats {
    const memoryUsage = process.memoryUsage();
    const totalHeap = memoryUsage.heapTotal;
    const usedHeap = memoryUsage.heapUsed;
    const percentage = totalHeap > 0 ? (usedHeap / totalHeap) * 100 : 0;

    return {
      heapUsed: usedHeap,
      heapTotal: totalHeap,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      percentage,
      objectPoolSize: this.getObjectPoolTotalSize(),
      cachedResultSets: this.cachedResultSets.size,
      lastGcRun: this.lastGcRun
    };
  }

  /**
   * 开始内存监控
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.memoryCheckInterval);

    if (this.memoryCheckTimer.unref) {
      this.memoryCheckTimer.unref();
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    
    // 记录内存使用指标
    this.recordMemoryMetrics(stats);

    // 检查是否需要触发GC
    if (stats.percentage > this.config.gcThreshold * 100) {
      this.logger.warn('High memory usage detected, triggering GC', {
        percentage: stats.percentage,
        threshold: this.config.gcThreshold * 100
      });
      this.triggerGarbageCollection();
    }

    this.emit('memoryCheck', stats);
  }

  /**
   * 检查缓存淘汰
   */
  private checkCacheEviction(): void {
    if (!this.config.enableSmartCacheEviction) {
      return;
    }

    const stats = this.getMemoryStats();
    
    if (stats.percentage > this.config.cacheEvictionThreshold * 100) {
      this.logger.info('Memory threshold exceeded, starting cache eviction', {
        percentage: stats.percentage,
        threshold: this.config.cacheEvictionThreshold * 100
      });

      this.performCacheEviction();
    }
  }

  /**
   * 执行缓存淘汰
   */
  private performCacheEviction(): void {
    const entries = Array.from(this.cachedResultSets.entries());
    
    // 按访问时间排序（LRU策略）
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    // 移除最早访问的20%缓存项
    const evictionCount = Math.floor(entries.length * 0.2);
    
    for (let i = 0; i < evictionCount; i++) {
      const [key] = entries[i];
      this.cachedResultSets.delete(key);
      this.logger.debug('Cache item evicted', { key });
    }

    this.emit('cacheEvicted', { 
      evictionCount, 
      remainingCount: this.cachedResultSets.size 
    });
  }

  /**
   * 应用结果集优化
   */
  private applyResultSetOptimization<T>(resultSet: T): T {
    // 这里可以实现具体的结果集优化策略
    // 例如：分页、流式处理、数据压缩等
    return resultSet;
  }

  /**
   * 计算对象大小
   */
  private calculateObjectSize(obj: any): number {
    try {
      return JSON.stringify(obj).length;
    } catch (error) {
      this.logger.error('Failed to calculate object size', { error });
      return 0;
    }
  }

  /**
   * 获取对象池总大小
   */
  private getObjectPoolTotalSize(): number {
    let total = 0;
    for (const pool of this.objectPools.values()) {
      total += pool.length;
    }
    return total;
  }

  /**
   * 记录内存指标
   */
  private recordMemoryMetrics(stats: MemoryUsageStats): void {
    const operationId = this.performanceMonitor.startOperation('memory_usage', {
      heapUsed: stats.heapUsed,
      heapTotal: stats.heapTotal,
      percentage: stats.percentage,
      objectPoolSize: stats.objectPoolSize,
      cachedResultSets: stats.cachedResultSets
    });

    this.performanceMonitor.endOperation(operationId, {
      success: true,
      metadata: {
        external: stats.external,
        rss: stats.rss,
        lastGcRun: stats.lastGcRun
      }
    });
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = null;
    }
    
    this.objectPools.clear();
    this.cachedResultSets.clear();
    this.removeAllListeners();
  }

  /**
   * 获取内存优化统计信息
   */
  getStats(): any {
    return {
      config: this.config,
      memoryUsage: this.getMemoryStats(),
      objectPools: Array.from(this.objectPools.keys()).map(name => ({
        name,
        size: this.objectPools.get(name)?.length || 0
      })),
      cachedResultSets: this.cachedResultSets.size
    };
  }
}