import { ISplitStrategy } from '../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../types/splitting-types';
import { IOverlapCalculator } from '../../interfaces/IOverlapCalculator';

/**
 * 重叠装饰器 - 使用装饰器模式添加重叠功能
 */
export class OverlapDecorator implements ISplitStrategy {
  constructor(
    private strategy: ISplitStrategy,
    private overlapCalculator: IOverlapCalculator
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    // 首先执行基础分割策略
    const chunks = await this.strategy.split(content, language, filePath, options, nodeTracker, ast);

    // 如果没有块或只有一个块，不需要重叠
    if (chunks.length <= 1) {
      return chunks;
    }

    // 检查是否为代码文件（非markdown）
    const isCodeFile = this.isCodeFile(language, filePath);

    // 代码文件：只有在块大小超过限制时才使用重叠
    if (isCodeFile) {
      // 检查是否有块超过最大大小限制
      const hasOversizedChunks = chunks.some(chunk => {
        const maxSize = options?.maxChunkSize || 2000;
        return chunk.content.length > maxSize;
      });

      // 如果有超大块，需要应用重叠策略进行重新处理
      if (hasOversizedChunks) {
        return this.overlapCalculator.addOverlap(chunks, content);
      }

      // 否则返回原始块（无重叠）
      return chunks;
    }

    // 非代码文件：添加重叠内容
    return this.overlapCalculator.addOverlap(chunks, content);
  }

  getName(): string {
    return `${this.strategy.getName()}_with_overlap`;
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }

  getDescription(): string {
    return `Overlap decorator for ${this.strategy.getDescription?.() || this.strategy.getName()}`;
  }

  extractNodesFromChunk(chunk: CodeChunk, ast: any): any[] {
    if (this.strategy.extractNodesFromChunk) {
      return this.strategy.extractNodesFromChunk(chunk, ast);
    }
    return [];
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (this.strategy.hasUsedNodes) {
      return this.strategy.hasUsedNodes(chunk, nodeTracker, ast);
    }
    return false;
  }

  /**
   * 检查是否为代码文件（非markdown）
   */
  private isCodeFile(language?: string, filePath?: string): boolean {
    if (language === 'markdown' || (filePath && filePath.endsWith('.md'))) {
      return false;
    }
    // 检查是否在代码语言列表中
    const codeLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
      'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
      'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
      'visualbasic', 'powershell', 'batch'];

    return language ? codeLanguages.includes(language) : false;
  }
}

/**
 * 性能监控装饰器
 */
export class PerformanceMonitorDecorator implements ISplitStrategy {
  private splitCount = 0;
  private totalTime = 0;
  private totalChunks = 0;

  constructor(
    private strategy: ISplitStrategy,
    private logger?: any
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.splitCount++;

    try {
      const chunks = await this.strategy.split(content, language, filePath, options, nodeTracker, ast);

      const endTime = Date.now();
      const duration = endTime - startTime;
      this.totalTime += duration;
      this.totalChunks += chunks.length;

      this.logPerformance(language, chunks.length, duration);

      return chunks;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger?.error(`Strategy ${this.strategy.getName()} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  getName(): string {
    return `${this.strategy.getName()}_monitored`;
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }

  getDescription(): string {
    return `Cache decorator for ${this.strategy.getDescription?.() || this.strategy.getName()}`;
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): {
    splitCount: number;
    totalTime: number;
    averageTime: number;
    totalChunks: number;
    averageChunksPerSplit: number;
  } {
    return {
      splitCount: this.splitCount,
      totalTime: this.totalTime,
      averageTime: this.splitCount > 0 ? this.totalTime / this.splitCount : 0,
      totalChunks: this.totalChunks,
      averageChunksPerSplit: this.splitCount > 0 ? this.totalChunks / this.splitCount : 0
    };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.splitCount = 0;
    this.totalTime = 0;
    this.totalChunks = 0;
  }

  private logPerformance(language: string, chunkCount: number, duration: number): void {
    if (this.logger) {
      this.logger.debug(
        `Strategy ${this.strategy.getName()} split ${language} file ` +
        `into ${chunkCount} chunks in ${duration}ms ` +
        `(avg: ${(duration / Math.max(chunkCount, 1)).toFixed(2)}ms per chunk)`
      );
    }
  }
}

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

/**
 * 装饰器构建器
 */
export class SplitStrategyDecoratorBuilder {
  private strategy: ISplitStrategy;

  constructor(strategy: ISplitStrategy) {
    this.strategy = strategy;
  }

  /**
   * 添加重叠装饰器
   */
  withOverlap(overlapCalculator: IOverlapCalculator): SplitStrategyDecoratorBuilder {
    this.strategy = new OverlapDecorator(this.strategy, overlapCalculator);
    return this;
  }

  /**
   * 添加性能监控装饰器
   */
  withPerformanceMonitor(logger?: any): SplitStrategyDecoratorBuilder {
    this.strategy = new PerformanceMonitorDecorator(this.strategy, logger);
    return this;
  }

  /**
   * 添加缓存装饰器
   */
  withCache(maxCacheSize?: number, ttl?: number): SplitStrategyDecoratorBuilder {
    this.strategy = new CacheDecorator(this.strategy, maxCacheSize, ttl);
    return this;
  }

  /**
   * 构建最终策略
   */
  build(): ISplitStrategy {
    return this.strategy;
  }
}