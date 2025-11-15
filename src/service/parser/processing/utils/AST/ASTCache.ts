/**
 * AST缓存管理器
 * 专门用于缓存AST解析结果，提高ASTCodeSplitter性能
 */

import { LRUCache } from '../../../../../utils/cache/LRUCache';
import { HashUtils } from '../../../../../utils/cache/HashUtils';
import { LoggerService } from '../../../../../utils/LoggerService';
import Parser from 'tree-sitter';

/**
 * AST缓存条目接口
 */
export interface ASTCacheEntry {
  /** AST解析结果 */
  ast: Parser.SyntaxNode;
  /** 解析时间戳 */
  timestamp: number;
  /** 内容哈希值 */
  contentHash: string;
  /** 语言类型 */
  language: string;
  /** 解析耗时（毫秒） */
  parseTime: number;
  /** AST节点数量 */
  nodeCount: number;
}

/**
 * AST缓存统计接口
 */
export interface ASTCacheStats {
  /** 缓存大小 */
  size: number;
  /** 最大缓存大小 */
  maxSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 驱逐次数 */
  evictions: number;
  /** 内存使用估算（字节） */
  memoryUsage: number;
  /** 总解析时间节省（毫秒） */
  totalParseTimeSaved: number;
  /** 平均解析时间（毫秒） */
  averageParseTime: number;
}

/**
 * AST缓存配置接口
 */
export interface ASTCacheConfig {
  /** 最大缓存条目数 */
  maxSize?: number;
  /** 默认TTL（毫秒），0表示永不过期 */
  defaultTTL?: number;
  /** 是否启用统计 */
  enableStats?: boolean;
  /** 是否启用内存监控 */
  enableMemoryMonitoring?: boolean;
  /** 内存使用阈值（字节），超过时触发清理 */
  memoryThreshold?: number;
  /** 自动清理间隔（毫秒） */
  cleanupInterval?: number;
}

/**
 * AST缓存管理器
 * 基于LRU缓存实现，专门优化AST解析结果的缓存
 */
export class ASTCache {
  private cache: LRUCache<string, ASTCacheEntry>;
  private config: Required<ASTCacheConfig>;
  private logger: LoggerService;
  private cleanupTimer?: NodeJS.Timeout;
  private stats: ASTCacheStats;
  private totalParseTimeSaved: number = 0;
  private totalParseTime: number = 0;
  private parseCount: number = 0;

  constructor(logger: LoggerService, config: ASTCacheConfig = {}) {
    this.logger = logger;
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 0,
      enableStats: config.enableStats !== false,
      enableMemoryMonitoring: config.enableMemoryMonitoring !== false,
      memoryThreshold: config.memoryThreshold || 50 * 1024 * 1024, // 50MB
      cleanupInterval: config.cleanupInterval || 5 * 60 * 1000 // 5分钟
    };

    this.cache = new LRUCache<string, ASTCacheEntry>(this.config.maxSize, {
      enableStats: this.config.enableStats,
      defaultTTL: this.config.defaultTTL
    });

    this.stats = {
      size: 0,
      maxSize: this.config.maxSize,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0,
      totalParseTimeSaved: 0,
      averageParseTime: 0
    };

    // 启动自动清理
    if (this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * 生成缓存键
   * 基于内容哈希、语言和文件路径生成唯一键
   */
  generateCacheKey(content: string, language: string, filePath?: string): string {
    const contentHash = HashUtils.fnv1aHash(content);
    const normalizedPath = filePath ? HashUtils.fnv1aHash(filePath) : 'no-path';
    return `${language}:${contentHash}:${normalizedPath}`;
  }

  /**
   * 获取AST缓存
   */
  get(content: string, language: string, filePath?: string): Parser.SyntaxNode | null {
    const cacheKey = this.generateCacheKey(content, language, filePath);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // 验证内容哈希（防止哈希冲突）
    const currentHash = HashUtils.fnv1aHash(content);
    if (entry.contentHash !== currentHash) {
      this.logger.warn(`AST cache hash mismatch for ${filePath || 'unknown file'}`);
      this.cache.delete(cacheKey);
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    if (this.config.enableStats) {
      this.stats.hits++;
      this.totalParseTimeSaved += entry.parseTime;
      this.updateHitRate();
    }

    this.logger.debug(`AST cache hit for ${filePath || 'unknown file'} (${language})`);
    return entry.ast;
  }

  /**
   * 设置AST缓存
   */
  set(
    content: string,
    language: string,
    ast: Parser.SyntaxNode,
    parseTime: number,
    filePath?: string
  ): void {
    const cacheKey = this.generateCacheKey(content, language, filePath);
    const contentHash = HashUtils.fnv1aHash(content);

    // 计算AST节点数量
    const nodeCount = this.countNodes(ast);

    const entry: ASTCacheEntry = {
      ast,
      timestamp: Date.now(),
      contentHash,
      language,
      parseTime,
      nodeCount
    };

    this.cache.set(cacheKey, entry);

    // 更新统计信息
    if (this.config.enableStats) {
      this.totalParseTime += parseTime;
      this.parseCount++;
      this.stats.averageParseTime = this.totalParseTime / this.parseCount;
    }

    // 检查内存使用
    if (this.config.enableMemoryMonitoring) {
      this.checkMemoryUsage();
    }

    this.logger.debug(`AST cached for ${filePath || 'unknown file'} (${language}, ${nodeCount} nodes, ${parseTime}ms)`);
  }

  /**
   * 删除缓存条目
   */
  delete(content: string, language: string, filePath?: string): boolean {
    const cacheKey = this.generateCacheKey(content, language, filePath);
    return this.cache.delete(cacheKey);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
    this.logger.debug('AST cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): ASTCacheStats {
    const cacheStats = this.cache.getStats();

    return {
      size: this.cache.size(),
      maxSize: this.config.maxSize,
      hits: cacheStats?.hits || 0,
      misses: cacheStats?.misses || 0,
      hitRate: this.stats.hitRate,
      evictions: cacheStats?.evictions || 0,
      memoryUsage: this.estimateMemoryUsage(),
      totalParseTimeSaved: this.totalParseTimeSaved,
      averageParseTime: this.stats.averageParseTime
    };
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const removed = this.cache.cleanup();
    if (removed > 0) {
      this.logger.debug(`AST cache cleanup: removed ${removed} expired entries`);
    }
    return removed;
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    this.logger.debug('AST cache manager destroyed');
  }

  /**
   * 计算AST节点数量
   */
  private countNodes(node: Parser.SyntaxNode): number {
    let count = 1;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    // 简化的内存估算：每个条目约1KB + AST节点数量 * 100字节
    const size = this.cache.size();
    let totalNodes = 0;

    for (const key of this.cache.keys()) {
      const entry = this.cache.get(key);
      if (entry) {
        totalNodes += entry.nodeCount;
      }
    }

    return size * 1024 + totalNodes * 100;
  }

  /**
   * 检查内存使用并触发清理
   */
  private checkMemoryUsage(): void {
    const memoryUsage = this.estimateMemoryUsage();
    if (memoryUsage > this.config.memoryThreshold) {
      this.logger.warn(`AST cache memory usage (${memoryUsage} bytes) exceeds threshold (${this.config.memoryThreshold} bytes)`);

      // 清理过期条目
      const removed = this.cleanup();

      // 如果仍然超过阈值，清理最旧的条目
      if (this.estimateMemoryUsage() > this.config.memoryThreshold) {
        const targetSize = Math.floor(this.cache.size() * 0.8); // 清理20%的条目
        while (this.cache.size() > targetSize) {
          const keys = this.cache.keys();
          if (keys.length > 0) {
            this.cache.delete(keys[0]);
          } else {
            break;
          }
        }
        this.logger.debug(`AST cache emergency cleanup: reduced size to ${this.cache.size()}`);
      }
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      size: 0,
      maxSize: this.config.maxSize,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0,
      totalParseTimeSaved: 0,
      averageParseTime: 0
    };
    this.totalParseTimeSaved = 0;
    this.totalParseTime = 0;
    this.parseCount = 0;
  }

  /**
   * 启动自动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}