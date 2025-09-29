import Parser from 'tree-sitter';
import { ChunkingStrategy, StrategyExecutionResult, BaseChunkingStrategy } from './ChunkingStrategy';
import { TreeSitterQueryEngine, QueryResult } from '../query/TreeSitterQueryEngine';
import { LanguageConfigManager, LanguageConfiguration } from '../config/LanguageConfigManager';
import { CodeChunk } from '../types';

/**
 * 策略管理器配置
 */
export interface StrategyManagerConfig {
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;

  /** 是否启用缓存 */
  enableCaching: boolean;

  /** 缓存大小 */
  cacheSize: number;

  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;

  /** 是否启用并行处理 */
  enableParallel: boolean;
}

/**
 * 策略执行上下文
 */
export interface StrategyExecutionContext {
  /** 语言 */
  language: string;

  /** 源代码 */
  sourceCode: string;

  /** AST根节点 */
  ast: Parser.SyntaxNode;

  /** 文件路径 */
  filePath?: string;

  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 分段策略管理器
 * 负责管理和协调各种分段策略的执行
 */
export class ChunkingStrategyManager {
  private strategies: Map<string, ChunkingStrategy> = new Map();
  private queryEngine: TreeSitterQueryEngine;
  private configManager: LanguageConfigManager;
  private config: StrategyManagerConfig;
  private executionCache: Map<string, StrategyExecutionResult[]> = new Map();
  private performanceStats: Map<string, any> = new Map();

  constructor(config?: Partial<StrategyManagerConfig>) {
    this.config = {
      enablePerformanceMonitoring: true,
      enableCaching: true,
      cacheSize: 1000,
      maxExecutionTime: 10000,
      enableParallel: true,
      ...config
    };

    this.queryEngine = new TreeSitterQueryEngine();
    this.configManager = new LanguageConfigManager();

    this.initializeDefaultStrategies();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies(): void {
    // 这里将在后续实现具体的策略类
    // 目前先注册占位符
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: ChunkingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * 注销策略
   */
  unregisterStrategy(strategyName: string): void {
    this.strategies.delete(strategyName);
  }

  /**
   * 获取策略
   */
  getStrategy(strategyName: string): ChunkingStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  /**
   * 获取所有策略
   */
  getAllStrategies(): ChunkingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 获取适用于特定语言的策略
   */
  getStrategiesForLanguage(language: string): ChunkingStrategy[] {
    return Array.from(this.strategies.values()).filter(
      strategy => strategy.canHandle(language, {} as Parser.SyntaxNode)
    );
  }

  /**
   * 执行分段策略
   */
  async executeStrategy(
    strategyName: string,
    context: StrategyExecutionContext
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    let cacheKey = '';

    try {
      const strategy = this.getStrategy(strategyName);
      if (!strategy) {
        throw new Error(`Strategy '${strategyName}' not found`);
      }

      // 检查策略是否可以处理
      if (!strategy.canHandle(context.language, context.ast)) {
        throw new Error(`Strategy '${strategyName}' cannot handle language '${context.language}'`);
      }

      // 检查缓存
      if (this.config.enableCaching) {
        cacheKey = this.generateCacheKey(strategyName, context);
        const cached = this.executionCache.get(cacheKey);
        if (cached) {
          return cached[0];
        }
      }

      // 执行策略
      const chunks = strategy.chunk(context.ast, context.sourceCode);

      // 验证分段结果
      const isValid = strategy.validateChunks(chunks);
      if (!isValid) {
        throw new Error(`Strategy '${strategyName}' produced invalid chunks`);
      }

      // 执行后处理
      const processedChunks = await this.postProcessChunks(chunks, context);

      const result: StrategyExecutionResult = {
        chunks: processedChunks,
        executionTime: Date.now() - startTime,
        processedNodes: this.countProcessedNodes(context.ast),
        strategyName: strategyName,
        success: true
      };

      // 缓存结果
      if (this.config.enableCaching) {
        this.executionCache.set(cacheKey, [result]);
        this.cleanupCache();
      }

      // 更新性能统计
      if (this.config.enablePerformanceMonitoring) {
        this.updatePerformanceStats(strategyName, result);
      }

      return result;
    } catch (error) {
      const result: StrategyExecutionResult = {
        chunks: [],
        executionTime: Date.now() - startTime,
        processedNodes: 0,
        strategyName: strategyName,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      return result;
    }
  }

  /**
   * 执行多个策略
   */
  async executeMultipleStrategies(
    strategyNames: string[],
    context: StrategyExecutionContext
  ): Promise<StrategyExecutionResult[]> {
    if (this.config.enableParallel && strategyNames.length > 1) {
      // 并行执行
      const promises = strategyNames.map(name => this.executeStrategy(name, context));
      return Promise.all(promises);
    } else {
      // 串行执行
      const results: StrategyExecutionResult[] = [];
      for (const name of strategyNames) {
        const result = await this.executeStrategy(name, context);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * 执行最佳策略
   */
  async executeBestStrategy(context: StrategyExecutionContext): Promise<StrategyExecutionResult> {
    const applicableStrategies = this.getStrategiesForLanguage(context.language);

    if (applicableStrategies.length === 0) {
      throw new Error(`No strategies available for language '${context.language}'`);
    }

    // 按优先级排序
    applicableStrategies.sort((a, b) => a.priority - b.priority);

    // 尝试执行策略，直到找到成功的
    for (const strategy of applicableStrategies) {
      const result = await this.executeStrategy(strategy.name, context);
      if (result.success && result.chunks.length > 0) {
        return result;
      }
    }

    // 如果所有策略都失败，返回最后一个策略的结果
    const lastStrategy = applicableStrategies[applicableStrategies.length - 1];
    return await this.executeStrategy(lastStrategy.name, context);
  }

  /**
   * 执行分层分段策略
   */
  async executeHierarchicalStrategy(context: StrategyExecutionContext): Promise<CodeChunk[]> {
    const applicableStrategies = this.getStrategiesForLanguage(context.language);

    // 按优先级排序
    applicableStrategies.sort((a, b) => a.priority - b.priority);

    const allChunks: CodeChunk[] = [];

    for (const strategy of applicableStrategies) {
      const result = await this.executeStrategy(strategy.name, context);
      if (result.success) {
        allChunks.push(...result.chunks);
      }
    }

    // 合并和优化分段
    return this.mergeAndOptimizeChunks(allChunks, context);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(strategyName?: string): any {
    if (strategyName) {
      return this.performanceStats.get(strategyName);
    }
    return Object.fromEntries(this.performanceStats);
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.performanceStats.clear();
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.executionCache.clear();
  }

  /**
   * 获取配置
   */
  getConfig(): StrategyManagerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<StrategyManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(strategyName: string, context: StrategyExecutionContext): string {
    const contentHash = this.hashContent(context.sourceCode);
    return `${strategyName}:${context.language}:${contentHash}`;
  }

  /**
   * 计算内容哈希
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 计算处理的节点数量
   */
  private countProcessedNodes(ast: Parser.SyntaxNode): number {
    let count = 0;
    const traverse = (node: Parser.SyntaxNode) => {
      count++;
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };
    traverse(ast);
    return count;
  }

  /**
   * 后处理分段
   */
  private async postProcessChunks(chunks: CodeChunk[], context: StrategyExecutionContext): Promise<CodeChunk[]> {
    const processedChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      // 添加语言信息
      if (!chunk.metadata.language) {
        chunk.metadata.language = context.language;
      }

      // 添加文件路径
      if (!chunk.metadata.filePath && context.filePath) {
        chunk.metadata.filePath = context.filePath;
      }

      // 添加复杂度信息
      if (!chunk.metadata.complexity) {
        chunk.metadata.complexity = this.calculateComplexity(chunk.content);
      }

      processedChunks.push(chunk);
    }

    return processedChunks;
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\btry\b/g,
      /\bcatch\b/g,
      /\?\./g,
      /\|\|/g,
      /&&/g,
    ];

    let complexity = 1;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return Math.min(complexity, 50);
  }

  /**
   * 合并和优化分段
   */
  private mergeAndOptimizeChunks(chunks: CodeChunk[], context: StrategyExecutionContext): CodeChunk[] {
    // 按开始位置排序
    chunks.sort((a, b) => a.metadata.startLine - b.metadata.startLine);

    const optimizedChunks: CodeChunk[] = [];
    let currentChunk: CodeChunk | null = null;

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = chunk;
      } else {
        // 检查是否可以合并
        if (this.canMergeChunks(currentChunk, chunk, context)) {
          currentChunk = this.mergeChunks(currentChunk, chunk);
        } else {
          optimizedChunks.push(currentChunk);
          currentChunk = chunk;
        }
      }
    }

    if (currentChunk) {
      optimizedChunks.push(currentChunk);
    }

    return optimizedChunks;
  }

  /**
   * 检查是否可以合并分段
   */
  private canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, context: StrategyExecutionContext): boolean {
    const config = this.configManager.getDefaultConfiguration(context.language);
    const mergedSize = chunk1.content.length + chunk2.content.length;

    // 检查大小限制
    if (mergedSize > config.maxChunkSize) {
      return false;
    }

    // 检查是否相邻
    const lineGap = chunk2.metadata.startLine - chunk1.metadata.endLine;
    if (lineGap > 5) {
      return false;
    }

    return true;
  }

  /**
   * 合并分段
   */
  private mergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    return {
      content: chunk1.content + '\n' + chunk2.content,
      metadata: {
        ...chunk1.metadata,
        endLine: chunk2.metadata.endLine,
        complexity: Math.max(chunk1.metadata.complexity || 0, chunk2.metadata.complexity || 0)
      }
    };
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(strategyName: string, result: StrategyExecutionResult): void {
    let stats = this.performanceStats.get(strategyName);

    if (!stats) {
      stats = {
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0,
        successCount: 0,
        failureCount: 0,
        totalChunks: 0,
        averageChunks: 0
      };
    }

    stats.executionCount++;
    stats.totalExecutionTime += result.executionTime;
    stats.averageExecutionTime = stats.totalExecutionTime / stats.executionCount;
    stats.maxExecutionTime = Math.max(stats.maxExecutionTime, result.executionTime);
    stats.minExecutionTime = stats.minExecutionTime === 0 ? result.executionTime : Math.min(stats.minExecutionTime, result.executionTime);

    if (result.success) {
      stats.successCount++;
      stats.totalChunks += result.chunks.length;
      stats.averageChunks = stats.totalChunks / stats.successCount;
    } else {
      stats.failureCount++;
    }

    this.performanceStats.set(strategyName, stats);
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    if (this.executionCache.size > this.config.cacheSize) {
      // 简单的LRU策略：删除最旧的条目
      const keys = Array.from(this.executionCache.keys());
      const toDelete = keys.slice(0, keys.length - this.config.cacheSize);

      for (const key of toDelete) {
        this.executionCache.delete(key);
      }
    }
  }
}

/**
 * 策略管理器工厂
 */
export class StrategyManagerFactory {
  private static instance: ChunkingStrategyManager;

  static getInstance(config?: Partial<StrategyManagerConfig>): ChunkingStrategyManager {
    if (!this.instance) {
      this.instance = new ChunkingStrategyManager(config);
    }
    return this.instance;
  }
}