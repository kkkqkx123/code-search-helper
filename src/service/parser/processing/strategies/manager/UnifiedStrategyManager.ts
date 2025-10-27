import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { UnifiedStrategyFactory } from '../factory/UnifiedStrategyFactory';
import { UnifiedConfigManager } from '../../../config/UnifiedConfigManager';
import { CodeChunk } from '../../types';

// 定义本地类型
interface StrategyExecutionResult {
  strategyName: string;
  chunks: CodeChunk[];
  executionTime: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

interface StrategyExecutionContext {
  language: string;
  sourceCode: string;
  filePath?: string;
  ast?: any;
  customParams?: any;
}

/**
 * 统一策略管理器
 * 整合了 StrategyManager 和 ChunkingStrategyManager 的功能
 */
@injectable()
export class UnifiedStrategyManager {
  private factory: UnifiedStrategyFactory;
  private configManager: UnifiedConfigManager;
  private logger?: LoggerService;
  private executionCache: Map<string, StrategyExecutionResult> = new Map();
  private performanceStats: Map<string, { count: number; totalTime: number; errors: number }> = new Map();
  private strategies: Map<string, ISplitStrategy> = new Map();
  private config: {
    enablePerformanceMonitoring: boolean;
    enableCaching: boolean;
    cacheSize: number;
    maxExecutionTime: number;
    enableParallel: boolean;
  };

  constructor(
    @inject(TYPES.UnifiedStrategyFactory) factory: UnifiedStrategyFactory,
    @inject(TYPES.UnifiedConfigManager) configManager: UnifiedConfigManager,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.factory = factory;
    this.configManager = configManager;
    this.logger = logger;

    // 初始化配置
    this.config = {
      enablePerformanceMonitoring: true,
      enableCaching: true,
      cacheSize: 1000,
      maxExecutionTime: 10000,
      enableParallel: true
    };

    this.logger?.debug('UnifiedStrategyManager initialized');

    // 初始化默认策略
    this.initializeDefaultStrategies();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies(): void {
    try {
      // 注册一些默认策略实例
      const defaultStrategyTypes = [
        'universal_line',
        'universal_bracket',
        'universal_semantic',
        'universal_semantic_fine',
        'treesitter_ast',
        'markdown_specialized',
        'xml_specialized'
      ];

      for (const strategyType of defaultStrategyTypes) {
        try {
          const strategy = this.factory.createStrategyFromType(strategyType);
          this.registerStrategy(strategy);
        } catch (error) {
          this.logger?.warn(`Failed to create strategy ${strategyType}:`, error);
        }
      }
    } catch (error) {
      this.logger?.error('Failed to initialize default strategies:', error);
    }
  }

  /**
   * 智能策略选择（来自universal）
   */
  selectOptimalStrategy(
    language: string,
    content: string,
    filePath?: string,
    ast?: any,
    options?: any
  ): ISplitStrategy {
    // 1. 如果有AST，优先选择支持AST的策略
    if (ast) {
      const astStrategy = this.factory.createStrategyFromAST(language, ast, options);
      if (astStrategy) {
        this.logger?.debug(`Selected AST-based strategy for ${language}`);
        return astStrategy;
      }
    }

    // 2. 根据内容特征选择策略
    const contentFeatures = this.analyzeContent(content, language);

    // 3. 根据文件大小选择策略
    const fileSize = content.length;
    if (fileSize < 1000) {
      // 小文件使用简单策略，但根据语言选择不同类型
      const smallFileStrategies: Record<string, string> = {
        'javascript': 'universal_line',
        'typescript': 'universal_bracket',
        'python': 'universal_line',
        'java': 'universal_line',
        'go': 'universal_line',
        'rust': 'universal_line',
        'cpp': 'universal_line',
        'c': 'universal_line',
        'csharp': 'universal_line',
        'php': 'universal_line',
        'ruby': 'universal_line',
        'swift': 'universal_line',
        'kotlin': 'universal_line',
        'scala': 'universal_line',
        'markdown': 'markdown_specialized',
        'xml': 'xml_specialized',
        'html': 'xml_specialized',
        'css': 'universal_line',
        'json': 'universal_line',
        'yaml': 'universal_line'
      };

      const strategyType = smallFileStrategies[language] || 'universal_line';
      return this.factory.createStrategyFromType(strategyType, options);
    } else if (fileSize > 10000) {
      // 大文件使用高效策略
      return this.factory.createStrategyFromType('universal_semantic', options);
    }

    // 4. 根据语言特性选择策略
    if (this.isStructuredLanguage(language)) {
      return this.factory.createStrategyFromType('syntax_aware', options);
    }

    // 5. 默认选择语言特定策略
    return this.factory.createStrategyFromLanguage(language, options);
  }

  /**
   * 启发式策略选择（来自universal）
   */
  selectStrategyWithHeuristics(
    filePath: string,
    content: string,
    detection: any,
    dependencies: any = {}
  ): ISplitStrategy {
    const language = detection.language || 'unknown';

    // 启发式规则
    const heuristics = [
      // 规则1: 测试文件使用函数级分段
      {
        condition: () => filePath.includes('.test.') || filePath.includes('.spec.'),
        strategy: () => this.factory.createStrategyFromType('function', dependencies)
      },
      // 规则2: 配置文件使用行级分段
      {
        condition: () => this.isConfigFile(filePath),
        strategy: () => this.factory.createStrategyFromType('line_based', dependencies)
      },
      // 规则3: 大文件使用语义分段
      {
        condition: () => content.length > 50000,
        strategy: () => this.factory.createStrategyFromType('semantic', dependencies)
      },
      // 规则4: 包含复杂结构的文件使用语法感知分段
      {
        condition: () => this.hasComplexStructure(content, language),
        strategy: () => this.factory.createStrategyFromType('syntax_aware', dependencies)
      }
    ];

    // 应用启发式规则
    for (const heuristic of heuristics) {
      if (heuristic.condition()) {
        const strategy = heuristic.strategy();
        this.logger?.debug(`Applied heuristic rule for ${filePath}: ${strategy.getName()}`);
        return strategy;
      }
    }

    // 如果没有规则匹配，使用默认选择
    return this.selectOptimalStrategy(language, content, filePath, detection.ast);
  }

  /**
   * 获取降级路径（来自universal）
   */
  getFallbackPath(currentStrategyName: string): string[] {
    const fallbackPaths: Record<string, string[]> = {
      'treesitter_ast': ['universal_semantic', 'universal_semantic_fine', 'universal_bracket', 'universal_line'],
      'universal_semantic': ['universal_semantic_fine', 'universal_bracket', 'universal_line'],
      'universal_semantic_fine': ['universal_bracket', 'universal_line'],
      'universal_bracket': ['universal_line'],
      'universal_line': ['minimal_fallback'],
      'minimal_fallback': [],
      // 兼容旧名称
      'ast': ['syntax_aware', 'semantic', 'function', 'line_based'],
      'syntax_aware': ['semantic', 'function', 'line_based'],
      'semantic': ['function', 'line_based'],
      'function': ['line_based'],
      'line_based': ['minimal_fallback']
    };

    return fallbackPaths[currentStrategyName] || ['line_based'];
  }

  /**
   * 创建降级策略（来自universal）
   */
  createFallbackStrategy(
    detection: any,
    fallbackStrategyName: string,
    dependencies: any = {}
  ): ISplitStrategy {
    try {
      const strategy = this.factory.createStrategyFromType(fallbackStrategyName, dependencies);
      this.logger?.info(`Created fallback strategy: ${fallbackStrategyName}`);
      return strategy;
    } catch (error) {
      this.logger?.error(`Failed to create fallback strategy ${fallbackStrategyName}:`, error);
      return this.factory.createStrategyFromType('minimal_fallback', dependencies);
    }
  }

  /**
   * 执行策略（来自core/strategy）
   */
  async executeStrategy(
    strategy: ISplitStrategy,
    context: StrategyExecutionContext
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(strategy, context);

    // 检查缓存
    if (this.isCacheEnabled()) {
      const cached = this.executionCache.get(cacheKey);
      if (cached) {
        this.logger?.debug(`Cache hit for strategy: ${strategy.getName()}`);
        return cached;
      }
    }

    try {
      // 执行策略
      const chunks = await strategy.split(
        context.sourceCode,
        context.language,
        context.filePath,
        context.customParams,
        undefined,
        context.ast
      );

      const executionTime = Date.now() - startTime;
      const result: StrategyExecutionResult = {
        strategyName: strategy.getName(),
        chunks,
        executionTime,
        success: true,
        metadata: {
          language: context.language,
          filePath: context.filePath,
          chunkCount: chunks.length
        }
      };

      // 更新性能统计
      this.updatePerformanceStats(strategy.getName(), executionTime, false);

      // 缓存结果
      if (this.isCacheEnabled()) {
        this.executionCache.set(cacheKey, result);
      }

      this.logger?.debug(`Strategy ${strategy.getName()} executed successfully in ${executionTime}ms`);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 更新错误统计
      this.updatePerformanceStats(strategy.getName(), executionTime, true);

      const result: StrategyExecutionResult = {
        strategyName: strategy.getName(),
        chunks: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      this.logger?.error(`Strategy ${strategy.getName()} failed:`, error);
      return result;
    }
  }

  /**
   * 批量执行策略（来自core/strategy）
   */
  async executeStrategies(
    strategies: ISplitStrategy[],
    context: StrategyExecutionContext,
    options?: { stopOnFirstSuccess?: boolean }
  ): Promise<StrategyExecutionResult[]> {
    const results: StrategyExecutionResult[] = [];
    const stopOnFirstSuccess = options?.stopOnFirstSuccess ?? false;

    if (this.isParallelExecutionEnabled()) {
      // 并行执行
      const promises = strategies.map(strategy => this.executeStrategy(strategy, context));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } else {
      // 串行执行
      for (const strategy of strategies) {
        const result = await this.executeStrategy(strategy, context);
        results.push(result);

        // 如果策略失败，尝试下一个
        if (!result.success) {
          this.logger?.warn(`Strategy ${strategy.getName()} failed, trying next strategy`);
          continue;
        }

        // 如果策略成功且有结果，且设置了停止标志，则停止执行
        if (stopOnFirstSuccess && result.chunks.length > 0) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 获取可用的策略信息（来自universal）
   */
  getAvailableStrategies(): Array<{
    name: string;
    description: string;
    supportedLanguages: string[];
    priority: number;
    supportsAST: boolean;
  }> {
    const providers = this.factory.getAvailableProviders();

    return providers.map(providerName => {
      const provider = this.factory.getProviderDependencies(providerName);
      const strategy = this.factory.createStrategyFromType(providerName);

      return {
        name: strategy.getName(),
        description: strategy.getDescription?.() || '',
        supportedLanguages: [], // 需要从策略获取
        priority: strategy.getPriority(),
        supportsAST: strategy.canHandleNode !== undefined
      };
    });
  }

  /**
   * 分析内容特征
   */
  private analyzeContent(content: string, language: string): any {
    const lines = content.split('\n');
    const functions = this.countFunctions(content, language);
    const classes = this.countClasses(content, language);
    const complexity = this.calculateComplexity(content, language);

    return {
      lineCount: lines.length,
      functionCount: functions,
      classCount: classes,
      complexity,
      hasImports: this.hasImports(content),
      hasExports: this.hasExports(content)
    };
  }

  /**
   * 检查是否为结构化语言
   */
  private isStructuredLanguage(language: string): boolean {
    const structuredLanguages = [
      'typescript', 'javascript', 'java', 'c', 'cpp', 'csharp',
      'python', 'go', 'rust', 'kotlin', 'scala'
    ];
    return structuredLanguages.includes(language.toLowerCase());
  }

  /**
   * 检查是否为配置文件
   */
  private isConfigFile(filePath: string): boolean {
    const configExtensions = [
      '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
      '.config', '.env', '.properties'
    ];
    return configExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * 检查是否有复杂结构
   */
  private hasComplexStructure(content: string, language: string): boolean {
    // 简单的复杂度检测
    const nestedBrackets = (content.match(/\{[^{}]*\{[^{}]*\}/g) || []).length;
    const nestedFunctions = (content.match(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*function/g) || []).length;

    return nestedBrackets > 5 || nestedFunctions > 3;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(strategy: ISplitStrategy, context: StrategyExecutionContext): string {
    return `${strategy.getName()}_${context.language}_${context.filePath}_${context.sourceCode.length}`;
  }

  /**
   * 检查是否启用缓存
   */
  private isCacheEnabled(): boolean {
    const config = this.configManager.getUniversalConfig();
    return config.chunking.maxChunkSize > 0; // 简单的缓存启用检查
  }

  /**
   * 检查是否启用并行执行
   */
  private isParallelExecutionEnabled(): boolean {
    const config = this.configManager.getUniversalConfig();
    return config.memory.memoryLimitMB > 1000; // 简单的并行执行检查
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(strategyName: string, executionTime: number, isError: boolean): void {
    const stats = this.performanceStats.get(strategyName) || { count: 0, totalTime: 0, errors: 0 };
    stats.count++;
    stats.totalTime += executionTime;
    if (isError) {
      stats.errors++;
    }
    this.performanceStats.set(strategyName, stats);
  }

  /**
   * 辅助方法：计算函数数量
   */
  private countFunctions(content: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      javascript: /function\s+\w+|=>\s*{|const\s+\w+\s*=\s*\(/g,
      typescript: /function\s+\w+|=>\s*{|const\s+\w+\s*=\s*\(/g,
      python: /def\s+\w+/g,
      java: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*\w+\s*\([^)]*\)\s*\{/g,
      go: /func\s+\w+/g,
      rust: /fn\s+\w+/g
    };

    const pattern = patterns[language.toLowerCase()];
    if (!pattern) return 0;

    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * 辅助方法：计算类数量
   */
  private countClasses(content: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      javascript: /class\s+\w+/g,
      typescript: /class\s+\w+/g,
      python: /class\s+\w+/g,
      java: /(?:public\s+)?class\s+\w+/g,
      go: /type\s+\w+\s+struct/g,
      rust: /struct\s+\w+/g
    };

    const pattern = patterns[language.toLowerCase()];
    if (!pattern) return 0;

    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * 辅助方法：计算复杂度
   */
  private calculateComplexity(content: string, language: string): number {
    // 简单的复杂度计算
    const lines = content.split('\n');
    const nestedStructures = (content.match(/\{[^{}]*\{/g) || []).length;
    const controlStructures = (content.match(/if|for|while|switch|case/g) || []).length;

    return lines.length + nestedStructures * 2 + controlStructures;
  }

  /**
   * 辅助方法：检查是否有导入
   */
  private hasImports(content: string): boolean {
    return /import\s+|require\s*\(|#include|using\s+/g.test(content);
  }

  /**
   * 辅助方法：检查是否有导出
   */
  private hasExports(content: string): boolean {
    return /export\s+|module\.exports|exports\./g.test(content);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): Map<string, { count: number; totalTime: number; errors: number; averageTime: number }> {
    const stats = new Map();

    for (const [strategyName, data] of this.performanceStats) {
      stats.set(strategyName, {
        ...data,
        averageTime: data.count > 0 ? data.totalTime / data.count : 0
      });
    }

    return stats;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.executionCache.clear();
    this.logger?.debug('Strategy execution cache cleared');
  }

  /**
   * 清空性能统计
   */
  clearPerformanceStats(): void {
    this.performanceStats.clear();
    this.logger?.debug('Performance stats cleared');
  }

  // ========== ChunkingStrategyManager 集成方法 ==========

  /**
   * 注册策略（来自ChunkingStrategyManager）
   */
  registerStrategy(strategy: ISplitStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
    this.logger?.debug(`Registered strategy: ${strategy.getName()}`);
  }

  /**
   * 注销策略（来自ChunkingStrategyManager）
   */
  unregisterStrategy(strategyName: string): void {
    this.strategies.delete(strategyName);
    this.logger?.debug(`Unregistered strategy: ${strategyName}`);
  }

  /**
   * 获取策略（来自ChunkingStrategyManager）
   */
  getStrategy(strategyName: string): ISplitStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  /**
   * 获取所有策略（来自ChunkingStrategyManager）
   */
  getAllStrategies(): ISplitStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 获取适用于特定语言的策略（来自ChunkingStrategyManager）
   */
  getStrategiesForLanguage(language: string): ISplitStrategy[] {
    return Array.from(this.strategies.values()).filter(
      strategy => strategy.supportsLanguage(language)
    );
  }

  /**
   * 执行分层分段策略（来自ChunkingStrategyManager）
   */
  async executeHierarchicalStrategy(context: StrategyExecutionContext): Promise<CodeChunk[]> {
    const applicableStrategies = this.getStrategiesForLanguage(context.language);

    // 按优先级排序
    applicableStrategies.sort((a, b) => a.getPriority() - b.getPriority());

    const allChunks: CodeChunk[] = [];

    for (const strategy of applicableStrategies) {
      const result = await this.executeStrategy(strategy, context);
      if (result.success) {
        allChunks.push(...result.chunks);
      }
    }

    // 合并和优化分段
    return this.mergeAndOptimizeChunks(allChunks, context);
  }

  /**
   * 获取配置（来自ChunkingStrategyManager）
   */
  getConfig(): any {
    return { ...this.config };
  }

  /**
   * 更新配置（来自ChunkingStrategyManager）
   */
  updateConfig(updates: any): void {
    this.config = { ...this.config, ...updates };
    this.logger?.debug('Strategy manager config updated');
  }

  /**
   * 合并和优化分段（来自ChunkingStrategyManager）
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
   * 检查是否可以合并分段（来自ChunkingStrategyManager）
   */
  private canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, context: StrategyExecutionContext): boolean {
    const mergedSize = chunk1.content.length + chunk2.content.length;
    const maxChunkSize = context.customParams?.maxChunkSize || 2000;

    // 检查大小限制
    if (mergedSize > maxChunkSize) {
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
   * 合并分段（来自ChunkingStrategyManager）
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
}