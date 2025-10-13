import { CodeChunk, ChunkingOptions, ASTNode, SplitStrategy } from '../types';
import { ASTNodeTracker } from './ASTNodeTracker';
import { EnhancedASTNodeTracker } from './EnhancedASTNodeTracker';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';
import { SimilarityDetector } from './SimilarityDetector';
import { SmartOverlapController } from './SmartOverlapController';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 增强的分段策略协调器 - 统一管理所有分段策略的执行，支持重复检测
 */
export class ChunkingCoordinator {
  private nodeTracker: ASTNodeTracker;
  private enhancedNodeTracker: EnhancedASTNodeTracker;
  private strategies: Map<string, SplitStrategy> = new Map();
  private logger?: LoggerService;
  private options: Required<ChunkingOptions>;
  private smartOverlapController?: SmartOverlapController;
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
    this.similarityThreshold = options.deduplicationThreshold ?? 0.8;
    
    // 初始化增强的节点跟踪器
    this.enhancedNodeTracker = new EnhancedASTNodeTracker({
      similarityThreshold: this.similarityThreshold,
      enableContentHash: true,
      enableLineRangeTracking: true
    }, logger);
    
    // 初始化智能重叠控制器
    if (this.enableDeduplication) {
      this.smartOverlapController = new SmartOverlapController(
        this.similarityThreshold,
        options.chunkMergeStrategy ?? 'conservative',
        options.maxOverlapRatio ?? 0.3
      );
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
    this.enhancedNodeTracker.clear();
    
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
        
        // 增强过滤：使用增强的节点跟踪器检查冲突
        const filteredChunks = this.filterChunksWithEnhancedTracker(chunks);
        
        // 标记节点为已使用
        this.markUsedNodesWithEnhancedTracker(filteredChunks);
        
        allChunks.push(...filteredChunks);
        this.logger?.debug(`Strategy ${strategyName} contributed ${filteredChunks.length} unique chunks`);
        
      } catch (error) {
        this.logger?.warn(`Strategy ${strategyName} failed: ${error}`);
      }
    }
    
    // 后处理：合并相似块和智能重叠控制
    const processedChunks = this.postProcessChunks(allChunks, content);
    
    const totalTime = Date.now() - startTime;
    const stats = this.nodeTracker.getStats();
    const enhancedStats = this.enhancedNodeTracker.getStats();
    
    this.logger?.info(
      `Chunking coordination completed. ` +
      `Total chunks: ${processedChunks.length} (original: ${allChunks.length}), ` +
      `Used nodes: ${stats.usedNodes}/${stats.totalNodes}, ` +
      `Enhanced tracker hits: ${enhancedStats.similarityHits + enhancedStats.lineRangeConflicts}, ` +
      `Similarity hits: ${stats.similarityHits}, ` +
      `Hash collisions: ${stats.contentHashCollisions}, ` +
      `Duration: ${totalTime}ms`
    );
    
    return processedChunks;
  }

  /**
   * 使用增强的节点跟踪器过滤代码块
   */
  private filterChunksWithEnhancedTracker(chunks: CodeChunk[]): CodeChunk[] {
    const filteredChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      // 使用增强的节点跟踪器检查冲突
      if (this.enhancedNodeTracker.isChunkConflicting(chunk)) {
        this.logger?.debug(`Filtered out conflicting chunk: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
        continue;
      }
      
      filteredChunks.push(chunk);
    }
    
    return filteredChunks;
  }

  /**
   * 使用增强的节点跟踪器标记已使用的节点
   */
  private markUsedNodesWithEnhancedTracker(chunks: CodeChunk[]): void {
    for (const chunk of chunks) {
      this.enhancedNodeTracker.markChunkUsed(chunk);
    }
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
    
    // 第二步：智能合并相似且相邻的块
    if (this.smartOverlapController) {
      const mergedChunks = this.smartOverlapController.mergeSimilarChunks(deduplicatedChunks);
      
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
    enhancedNodeTrackerStats: any;
    deduplicationEnabled: boolean;
    similarityThreshold: number;
  } {
    return {
      registeredStrategies: this.strategies.size,
      nodeTrackerStats: this.nodeTracker.getStats(),
      enhancedNodeTrackerStats: this.enhancedNodeTracker.getStats(),
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
    
    // 更新增强的节点跟踪器
    this.enhancedNodeTracker = new EnhancedASTNodeTracker({
      similarityThreshold: this.similarityThreshold,
      enableContentHash: true,
      enableLineRangeTracking: true
    }, this.logger);
    
    // 重新初始化智能重叠控制器
    if (this.enableDeduplication) {
      this.smartOverlapController = new SmartOverlapController(
        this.similarityThreshold,
        options.chunkMergeStrategy ?? 'conservative',
        options.maxOverlapRatio ?? 0.3
      );
    } else {
      this.smartOverlapController = undefined;
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
    this.enhancedNodeTracker.clear();
    this.smartOverlapController?.clearHistory();
  }
}