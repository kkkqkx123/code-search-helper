import { ISplitStrategy } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';

/**
 * 缓存装饰器
 */
export class CacheDecorator implements ISplitStrategy {
  private cache = new Map<string, CodeChunk[]>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private strategy: ISplitStrategy,
    private maxCacheSize = 100,
    private ttl = 300000 // 5分钟
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    const cacheKey = this.generateCacheKey(content, language, filePath, options);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return this.deepCloneChunks(cached);
    }

    this.cacheMisses++;

    // 执行实际分割
    const chunks = await this.strategy.split(content, language, filePath, options, nodeTracker, ast);

    // 添加到缓存
    this.addToCache(cacheKey, chunks);

    return chunks;
  }

  getName(): string {
    return `${this.strategy.getName()}_cached`;
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return `Cache decorator for ${this.strategy.getDescription?.() || this.strategy.getName()}`;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    maxCacheSize: number;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  private generateCacheKey(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): string {
    const contentHash = this.hashContent(content);
    const optionsHash = this.hashOptions(options);

    return `${contentHash}_${language}_${filePath || ''}_${optionsHash}`;
  }

  private hashContent(content: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  private hashOptions(options?: ChunkingOptions): string {
    if (!options) return 'default';
    return JSON.stringify(options);
  }

  private addToCache(key: string, chunks: CodeChunk[]): void {
    // 如果缓存已满，移除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // 深度克隆块以避免引用问题
    this.cache.set(key, this.deepCloneChunks(chunks));
  }

  private deepCloneChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      metadata: { ...chunk.metadata }
    }));
  }
}