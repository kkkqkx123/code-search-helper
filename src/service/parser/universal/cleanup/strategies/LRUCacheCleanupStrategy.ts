import { ICleanupStrategy, ICleanupContext, ICleanupResult } from '../interfaces/ICleanupStrategy';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * LRU缓存清理策略
 * 负责清理LRU缓存，释放内存
 */
export class LRUCacheCleanupStrategy implements ICleanupStrategy {
  public readonly name = 'LRUCacheCleanup';
  public readonly priority = 2; // 中等优先级
  public readonly description = '清理LRU缓存，释放内存';
  
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 检查策略是否适用于当前上下文
   */
  isApplicable(context: ICleanupContext): boolean {
    // 适用于内存压力较大或需要清理缓存的情况
    const memoryPressure = context.memoryUsage && 
      context.memoryUsage.heapUsed > 0 && 
      context.memoryUsage.heapTotal > 0 &&
      (context.memoryUsage.heapUsed / context.memoryUsage.heapTotal) > 0.6;

    const cacheRelated = context.triggerReason.includes('cache') || 
                        context.triggerReason.includes('memory') ||
                        context.triggerReason.includes('cleanup');

    return memoryPressure || cacheRelated;
  }

  /**
   * 检查策略是否可用
   */
  isAvailable(): boolean {
    try {
      // 检查是否存在LRU缓存
      return this.hasLRUCache();
    } catch (error) {
      this.logger?.debug(`LRU cache check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 估算清理影响
   */
  estimateCleanupImpact(context: ICleanupContext): number {
    try {
      // 基础估算LRU缓存大小
      const baseEstimate = 20 * 1024 * 1024; // 基础估算20MB
      
      // 根据内存使用情况调整估算
      if (context.memoryUsage && context.memoryUsage.heapUsed > 0) {
        const memoryRatio = context.memoryUsage.heapUsed / context.memoryUsage.heapTotal;
        // LRU缓存通常占用总内存的5-15%
        return Math.floor(baseEstimate * Math.min(memoryRatio * 0.1, 1.0));
      }
      
      return baseEstimate;
    } catch (error) {
      this.logger?.warn(`Failed to estimate LRU cache impact: ${error}`);
      return 0;
    }
  }

  /**
   * 执行清理操作
   */
  async cleanup(context: ICleanupContext): Promise<ICleanupResult> {
    const startTime = Date.now();
    this.logger?.info(`Starting LRU cache cleanup, reason: ${context.triggerReason}`);

    try {
      // 获取清理前的内存状态
      const beforeCleanup = process.memoryUsage();
      
      // 清理LRU缓存
      const cleanupResults = await this.performLRUCacheCleanup();
      
      if (cleanupResults.length === 0) {
        this.logger?.warn('No LRU caches found to clean');
        return {
          success: true,
          cleanedCaches: [],
          memoryFreed: 0,
          duration: Date.now() - startTime,
          metadata: {
            message: 'No LRU caches found',
            cacheType: 'LRU'
          }
        };
      }

      // 获取清理后的内存状态
      const afterCleanup = process.memoryUsage();
      const memoryFreed = Math.max(0, beforeCleanup.heapUsed - afterCleanup.heapUsed);

      const duration = Date.now() - startTime;
      
      this.logger?.info(`LRU cache cleanup completed, cleaned ${cleanupResults.length} caches, freed ${this.formatBytes(memoryFreed)} in ${duration}ms`);

      return {
        success: true,
        cleanedCaches: cleanupResults,
        memoryFreed,
        duration,
        metadata: {
          beforeHeapUsed: beforeCleanup.heapUsed,
          afterHeapUsed: afterCleanup.heapUsed,
          cacheType: 'LRU',
          cleanedCacheCount: cleanupResults.length,
          cleanedCaches: cleanupResults
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`LRU cache cleanup failed: ${error}`);
      
      return {
        success: false,
        cleanedCaches: [],
        memoryFreed: 0,
        duration,
        error: error as Error,
        metadata: {
          cacheType: 'LRU',
          errorContext: 'cleanup_execution'
        }
      };
    }
  }

  /**
   * 执行LRU缓存清理
   */
  private async performLRUCacheCleanup(): Promise<string[]> {
    const cleanedCaches: string[] = [];
    
    try {
      // 清理全局LRU缓存
      if (this.clearGlobalLRUCache()) {
        cleanedCaches.push('global');
      }

      // 清理模块级别的LRU缓存
      const moduleCaches = this.clearModuleLRUCaches();
      cleanedCaches.push(...moduleCaches);

      // 等待一小段时间让清理生效
      if (cleanedCaches.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return cleanedCaches;
    } catch (error) {
      this.logger?.warn(`LRU cache cleanup error: ${(error as Error).message}`);
      return cleanedCaches;
    }
  }

  /**
   * 检查是否存在LRU缓存
   */
  private hasLRUCache(): boolean {
    try {
      // 检查全局LRU缓存
      if (typeof global !== 'undefined' && (global as any).LRUCache) {
        return true;
      }

      // 检查常见的LRU缓存模块
      const commonLRUModules = ['lru-cache', 'quick-lru', 'tiny-lru'];
      for (const moduleName of commonLRUModules) {
        try {
          require.resolve(moduleName);
          return true;
        } catch {
          // 模块不存在，继续检查下一个
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理全局LRU缓存
   */
  private clearGlobalLRUCache(): boolean {
    try {
      if (typeof global !== 'undefined' && (global as any).LRUCache) {
        const globalCache = (global as any).LRUCache;
        
        if (typeof globalCache.clearAll === 'function') {
          globalCache.clearAll();
          this.logger?.debug('Global LRU cache cleared');
          return true;
        } else if (typeof globalCache.clear === 'function') {
          globalCache.clear();
          this.logger?.debug('Global LRU cache cleared');
          return true;
        } else if (typeof globalCache.reset === 'function') {
          globalCache.reset();
          this.logger?.debug('Global LRU cache reset');
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger?.debug(`Could not clear global LRU cache: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 清理模块级别的LRU缓存
   */
  private clearModuleLRUCaches(): string[] {
    const cleanedModules: string[] = [];
    
    try {
      // 尝试清理常见的LRU缓存实例
      const cacheInstances = this.findLRUCacheInstances();
      
      for (const [name, cache] of cacheInstances) {
        try {
          if (typeof cache.clear === 'function') {
            cache.clear();
            cleanedModules.push(name);
            this.logger?.debug(`${name} LRU cache cleared`);
          } else if (typeof cache.reset === 'function') {
            cache.reset();
            cleanedModules.push(name);
            this.logger?.debug(`${name} LRU cache reset`);
          } else if (typeof cache.clearAll === 'function') {
            cache.clearAll();
            cleanedModules.push(name);
            this.logger?.debug(`${name} LRU cache cleared`);
          }
        } catch (error) {
          this.logger?.debug(`Could not clear ${name} cache: ${(error as Error).message}`);
        }
      }
      
      return cleanedModules;
    } catch (error) {
      this.logger?.debug(`Module LRU cache cleanup error: ${(error as Error).message}`);
      return cleanedModules;
    }
  }

  /**
   * 查找LRU缓存实例
   */
  private findLRUCacheInstances(): Map<string, any> {
    const instances = new Map<string, any>();
    
    try {
      // 这里可以扩展以查找更多的LRU缓存实例
      // 例如从require.cache中查找，或者从全局对象中查找
      
      // 检查require.cache中的缓存实例
      if (typeof require !== 'undefined' && require.cache) {
        for (const [path, module] of Object.entries(require.cache)) {
          if (module && module.exports) {
            // 检查模块导出是否包含LRU缓存
            this.checkModuleForLRUCache(module.exports, path, instances);
          }
        }
      }
      
      return instances;
    } catch (error) {
      this.logger?.debug(`Error finding LRU cache instances: ${(error as Error).message}`);
      return instances;
    }
  }

  /**
   * 检查模块是否包含LRU缓存
   */
  private checkModuleForLRUCache(moduleExport: any, modulePath: string, instances: Map<string, any>): void {
    try {
      // 简化的检查逻辑，可以根据实际需要扩展
      if (moduleExport && typeof moduleExport === 'object') {
        // 检查是否有常见的LRU缓存方法
        const lruMethods = ['clear', 'reset', 'clearAll', 'purgeStale'];
        
        for (const method of lruMethods) {
          if (typeof moduleExport[method] === 'function') {
            // 进一步检查是否有LRU特征属性
            const lruProperties = ['max', 'maxAge', 'length', 'itemCount'];
            const hasLruProperty = lruProperties.some(prop => moduleExport.hasOwnProperty(prop));
            
            if (hasLruProperty) {
              const cacheName = this.extractModuleName(modulePath);
              instances.set(cacheName, moduleExport);
              break;
            }
          }
        }
      }
    } catch (error) {
      // 忽略检查错误
    }
  }

  /**
   * 提取模块名称
   */
  private extractModuleName(modulePath: string): string {
    try {
      const path = require('path');
      const baseName = path.basename(modulePath, '.js');
      const dirName = path.basename(path.dirname(modulePath));
      
      return `${dirName}/${baseName}`;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Math.abs(bytes);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}