import { injectable, inject } from 'inversify';
import { IVectorCacheManager } from './IVectorCacheManager';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { Vector, SearchResult, CacheStats } from '../types/VectorTypes';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 向量缓存管理器实现
 */
@injectable()
export class VectorCacheManager implements IVectorCacheManager {
  private vectorCache: Map<string, CacheEntry<Vector>>;
  private searchCache: Map<string, CacheEntry<SearchResult[]>>;
  private defaultTTL = 300000; // 5分钟
  private stats = { hitCount: 0, missCount: 0 };

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.vectorCache = new Map();
    this.searchCache = new Map();
    this.startCleanup();
  }

  async getVector(key: string): Promise<Vector | null> {
    const entry = this.vectorCache.get(key);
    if (entry && !this.isExpired(entry)) {
      this.stats.hitCount++;
      return entry.data;
    }
    this.stats.missCount++;
    return null;
  }

  async setVector(key: string, vector: Vector, ttl?: number): Promise<void> {
    this.vectorCache.set(key, {
      data: vector,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  async getSearchResult(key: string): Promise<SearchResult[] | null> {
    const entry = this.searchCache.get(key);
    if (entry && !this.isExpired(entry)) {
      this.stats.hitCount++;
      return entry.data;
    }
    this.stats.missCount++;
    return null;
  }

  async setSearchResult(key: string, results: SearchResult[], ttl?: number): Promise<void> {
    this.searchCache.set(key, {
      data: results,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  async delete(key: string): Promise<void> {
    this.vectorCache.delete(key);
    this.searchCache.delete(key);
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    for (const key of this.vectorCache.keys()) {
      if (regex.test(key)) this.vectorCache.delete(key);
    }
    for (const key of this.searchCache.keys()) {
      if (regex.test(key)) this.searchCache.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.vectorCache.clear();
    this.searchCache.clear();
  }

  async getStats(): Promise<CacheStats> {
    const total = this.stats.hitCount + this.stats.missCount;
    return {
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate: total > 0 ? this.stats.hitCount / total : 0,
      totalEntries: this.vectorCache.size + this.searchCache.size,
      memoryUsage: 0
    };
  }

  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.vectorCache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.vectorCache.delete(key);
        }
      }
      for (const [key, entry] of this.searchCache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.searchCache.delete(key);
        }
      }
    }, 60000);
  }
}