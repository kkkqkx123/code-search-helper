import { CodeChunk, ChunkingOptions, ASTNode, SplitStrategy } from '..';
import { ASTNodeTracker } from './AST/ASTNodeTracker';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';
import { SimilarityDetector } from './similarity/SimilarityDetector';
import { UnifiedOverlapCalculator } from './overlap/UnifiedOverlapCalculator';
import { PerformanceMonitor } from './performance/PerformanceMonitor';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 增强的分段策略协调器 - 统一管理所有分段策略的执行，支持重复检测
 */
export class ChunkingCoordinator {
  private nodeTracker: ASTNodeTracker;
  private strategies: Map<string, SplitStrategy> = new Map();
  private logger?: LoggerService;
  private options: Required<ChunkingOptions>;
  private performanceMonitor?: PerformanceMonitor;
  private unifiedOverlapCalculator?: UnifiedOverlapCalculator;
  private enableDeduplication: boolean;
  private similarityThreshold: number;

  // 分段策略优先级顺序
  private readonly strategyPriority: string[] = [
    'ImportSplitter',    // 处理导入语句（最高优先级）
    'ClassSplitter',     // 处理类和接口定义  
    'FunctionSplitter',  // 处理函数和方法
    'SyntaxAwareSplitter', // 语法感知分段
    'IntelligentSplitter', // 智能分段（后备方案）
    'SemanticSplitter'   // 语义分段（最后后备）
  ];

  constructor(
    nodeTracker: ASTNodeTracker,
    options: Required<ChunkingOptions>,
    logger?: LoggerService
  ) {
    this.nodeTracker = nodeTracker;
    this.options = options;
    this.logger = logger;

    // 配置重复检测参数
    this.enableDeduplication = options.enableChunkDeduplication ?? false;
    // 初始化性能监控器
    if (options.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor(logger);
    }
    this.similarityThreshold = options.deduplicationThreshold ?? 0.8;

    // 初始化统一重叠计算器（整合SmartOverlapController功能）
    if (this.enableDeduplication) {
      this.unifiedOverlapCalculator = new UnifiedOverlapCalculator({
        maxSize: options.overlapSize ?? 200,
        minLines: 1,
        maxOverlapRatio: options.maxOverlapRatio ?? 0.3,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: options.enableASTBoundaryDetection ?? false,
        enableNodeAwareOverlap: options.astNodeTracking ?? false, // 使用astNodeTracking代替
        enableSmartDeduplication: true,
        similarityThreshold: this.similarityThreshold,
        mergeStrategy: options.chunkMergeStrategy ?? 'conservative',
        nodeTracker: this.nodeTracker,
        logger: this.logger
      });
    }
  }

  /**
   * 注册分段策略
   */
  registerStrategy(strategy: SplitStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
    this.logger?.debug(`Registered splitting strategy: ${strategy.getName()}`);
  }

  /**
   * 协调执行分段策略（增强版）
   */
  async coordinate(
    content: string,
    language: string,
    filePath?: string,
    ast?: any
  ): Promise<CodeChunk[]> {
    const allChunks: CodeChunk[] = [];
    const startTime = Date.now();

    this.logger?.info(`Starting coordinated chunking for ${language} file: ${filePath || 'unknown'}`);

    // 重置节点跟踪器
    this.nodeTracker.clear();

    // 按优先级执行分段策略
    for (const strategyName of this.strategyPriority) {
      const strategy = this.strategies.get(strategyName);

      if (!strategy) {
        this.logger?.warn(`Strategy ${strategyName} not found, skipping`);
        continue;
      }

      if (!strategy.supportsLanguage(language)) {
        this.logger?.debug(`Strategy ${strategyName} does not support ${language}, skipping`);
        continue;
      }

      try {
        this.logger?.debug(`Executing strategy: ${strategyName}`);
        const strategyStartTime = Date.now();

        // 执行分段策略
        const chunks = await strategy.split(
          content,
          language,
          filePath,
          this.options,
          this.nodeTracker,
          ast
        );

        const strategyDuration = Date.now() - strategyStartTime;
        this.logger?.debug(`Strategy ${strategyName} generated ${chunks.length} chunks in ${strategyDuration}ms`);

        // 过滤冲突的代码块
        const filteredChunks = this.filterChunksWithTracker(chunks);

        // 标记节点为已使用
        this.markUsedNodesWithTracker(filteredChunks);

        allChunks.push(...filteredChunks);
        this.logger?.debug(`Strategy ${strategyName} contributed ${filteredChunks.length} unique chunks`);

      } catch (error) {
        this.logger?.warn(`Strategy ${strategyName} failed: ${error}`);
      }
    }

    // 后处理：合并相似块和智能重叠控制
    const processedChunks = this.postProcessChunks(allChunks, content);

    // 记录性能指标
    if (this.performanceMonitor) {
      this.performanceMonitor.record(startTime, content.split('\n').length, false);
    }
    const totalTime = Date.now() - startTime;
    const stats = this.nodeTracker.getStats();

    this.logger?.info(
      `Chunking coordination completed. ` +
      `Total chunks: ${processedChunks.length} (original: ${allChunks.length}), ` +
      `Used nodes: ${stats.usedNodes}/${stats.totalNodes}, ` +
      `Similarity hits: ${stats.similarityHits}, ` +
      `Hash collisions: ${stats.contentHashCollisions}, ` +
      `Duration: ${totalTime}ms`
    );

    return processedChunks;
  }

  /**
   * 使用节点跟踪器过滤代码块
   */
  private filterChunksWithTracker(chunks: CodeChunk[]): CodeChunk[] {
    const filteredChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      // 使用节点跟踪器检查冲突
      if (this.isChunkConflicting(chunk)) {
        this.logger?.debug(`Filtered out conflicting chunk: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
        continue;
      }

      filteredChunks.push(chunk);
    }

    return filteredChunks;
  }

  /**
   * 使用节点跟踪器标记已使用的节点
   */
  private markUsedNodesWithTracker(chunks: CodeChunk[]): void {
    for (const chunk of chunks) {
      // 为每个代码块创建临时AST节点并标记为已使用
      if (chunk.metadata.startLine && chunk.metadata.endLine) {
        const tempNode: ASTNode = {
          id: `chunk-${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
          type: chunk.metadata.type || 'chunk',
          startByte: 0,
          endByte: 0,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          text: chunk.content,
          contentHash: ContentHashIDGenerator.getContentHashPrefix(chunk.content)
        };

        this.nodeTracker.markUsed(tempNode);
      }
    }
  }

  /**
   * 检查代码块是否与已使用的节点冲突
   */
  private isChunkConflicting(chunk: CodeChunk): boolean {
    if (!chunk.metadata.startLine || !chunk.metadata.endLine) return false;

    // 为代码块创建临时AST节点
    const tempNode: ASTNode = {
      id: `chunk-${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
      type: chunk.metadata.type || 'chunk',
      startByte: 0,
      endByte: 0,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      text: chunk.content,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(chunk.content)
    };

    return this.nodeTracker.isUsed(tempNode) || this.nodeTracker.hasOverlap(tempNode);
  }

  /**
   * 后处理：合并相似块和智能重叠控制
   */
  private postProcessChunks(chunks: CodeChunk[], originalContent: string): CodeChunk[] {
    if (!this.enableDeduplication || chunks.length <= 1) {
      return chunks;
    }

    // 第一步：基于内容相似度过滤重复块
    const deduplicatedChunks = SimilarityDetector.filterSimilarChunks(
      chunks,
      this.similarityThreshold
    );

    this.logger?.debug(`Deduplication: ${chunks.length} -> ${deduplicatedChunks.length} chunks`);

    // 第二步：智能合并相似且相邻的块（使用统一重叠计算器）
    if (this.unifiedOverlapCalculator) {
      const mergedChunks = this.unifiedOverlapCalculator.mergeSimilarChunks(deduplicatedChunks);

      this.logger?.debug(`Smart merge: ${deduplicatedChunks.length} -> ${mergedChunks.length} chunks`);

      return mergedChunks;
    }

    return deduplicatedChunks;
  }

  /**
   * 获取协调器统计信息（增强版）
   */
  getCoordinatorStats(): {
    registeredStrategies: number;
    nodeTrackerStats: any;
    deduplicationEnabled: boolean;
    similarityThreshold: number;
  } {
    return {
      registeredStrategies: this.strategies.size,
      nodeTrackerStats: this.nodeTracker.getStats(),
      deduplicationEnabled: this.enableDeduplication,
      similarityThreshold: this.similarityThreshold
    };
  }

  /**
   * 设置分段选项（增强版）
   */
  setOptions(options: Required<ChunkingOptions>): void {
    this.options = options;

    // 更新重复检测参数
    this.enableDeduplication = options.enableChunkDeduplication ?? false;
    this.similarityThreshold = options.deduplicationThreshold ?? 0.8;

    // 重新初始化统一重叠计算器（整合SmartOverlapController功能）
    if (this.enableDeduplication) {
      this.unifiedOverlapCalculator = new UnifiedOverlapCalculator({
        maxSize: options.overlapSize ?? 200,
        minLines: 1,
        maxOverlapRatio: options.maxOverlapRatio ?? 0.3,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: options.enableASTBoundaryDetection ?? false,
        enableNodeAwareOverlap: options.astNodeTracking ?? false, // 使用astNodeTracking代替
        enableSmartDeduplication: true,
        similarityThreshold: this.similarityThreshold,
        mergeStrategy: options.chunkMergeStrategy ?? 'conservative',
        nodeTracker: this.nodeTracker,
        logger: this.logger
      });
    } else {
      this.unifiedOverlapCalculator = undefined;
    }
  }

  /**
   * 获取分段选项
   */
  getOptions(): Required<ChunkingOptions> {
    return this.options;
  }

  /**
   * 清理控制器状态
   */
  clear(): void {
    this.nodeTracker.clear();
    this.unifiedOverlapCalculator?.clearHistory();
  }
}