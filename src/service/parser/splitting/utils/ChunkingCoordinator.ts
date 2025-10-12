import { CodeChunk, ChunkingOptions, ASTNode, SplitStrategy } from '../types';
import { ASTNodeTracker } from './ASTNodeTracker';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';
import { SimilarityDetector } from './SimilarityDetector';
import { SmartOverlapController } from './SmartOverlapController';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 增强的分段策略协调器 - 统一管理所有分段策略的执行，支持重复检测
 */
export class ChunkingCoordinator {
  private nodeTracker: ASTNodeTracker;
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
        
        // 增强过滤：检查重复和相似性
        const filteredChunks = this.filterSimilarAndUsedNodes(chunks, ast);
        
        // 标记节点为已使用
        this.markUsedNodes(filteredChunks, ast);
        
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
    const hashStats = this.nodeTracker.getContentHashStats();
    
    this.logger?.info(
      `Chunking coordination completed. ` +
      `Total chunks: ${processedChunks.length} (original: ${allChunks.length}), ` +
      `Used nodes: ${stats.usedNodes}/${stats.totalNodes}, ` +
      `Similarity hits: ${stats.similarityHits}, ` +
      `Hash collisions: ${stats.contentHashCollisions}, ` +
      `Content hash groups: ${hashStats.totalHashes}, ` +
      `Duration: ${totalTime}ms`
    );
    
    return processedChunks;
  }

  /**
   * 过滤相似和已使用的节点（增强版）
   */
  private filterSimilarAndUsedNodes(chunks: CodeChunk[], ast?: any): CodeChunk[] {
    const filteredChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      // 检查节点是否已被使用
      const chunkNodes = this.extractNodesFromChunk(chunk, ast);
      const hasUnusedNodes = chunkNodes.some(node => !this.nodeTracker.isUsed(node));
      
      if (!hasUnusedNodes) {
        continue;
      }
      
      // 检查内容相似性
      if (this.enableDeduplication && this.isContentSimilarToExisting(chunk, filteredChunks)) {
        continue;
      }
      
      filteredChunks.push(chunk);
    }
    
    return filteredChunks;
  }

  /**
   * 检查块是否与现有块内容相似
   */
  private isContentSimilarToExisting(newChunk: CodeChunk, existingChunks: CodeChunk[]): boolean {
    if (!this.enableDeduplication) {
      return false;
    }
    
    for (const existingChunk of existingChunks) {
      if (SimilarityDetector.isSimilar(newChunk.content, existingChunk.content, this.similarityThreshold)) {
        this.logger?.debug(`Filtered out similar chunk: ${newChunk.metadata.startLine}-${newChunk.metadata.endLine}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 标记代码块中的节点为已使用（增强版）
   */
  private markUsedNodes(chunks: CodeChunk[], ast?: any): void {
    for (const chunk of chunks) {
      const chunkNodes = this.extractNodesFromChunk(chunk, ast);
      
      for (const node of chunkNodes) {
        this.nodeTracker.markUsed(node);
      }
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
   * 从代码块中提取AST节点（增强版）
   */
  private extractNodesFromChunk(chunk: CodeChunk, ast?: any): ASTNode[] {
    if (!ast || !chunk.metadata.startLine || !chunk.metadata.endLine) {
      // 如果没有AST或元数据不完整，创建增强的基本节点
      const enhancedNode: ASTNode = {
        id: ContentHashIDGenerator.generateChunkId(
          chunk.content,
          chunk.metadata.startLine,
          chunk.metadata.endLine,
          chunk.metadata.type
        ),
        type: 'chunk',
        startByte: 0,
        endByte: 0,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        text: chunk.content,
        contentHash: this.enableDeduplication ? ContentHashIDGenerator.getContentHashPrefix(chunk.content) : undefined
      };
      return [enhancedNode];
    }
    
    const nodes: ASTNode[] = [];
    const startLine = chunk.metadata.startLine;
    const endLine = chunk.metadata.endLine;
    
    // 从AST中提取与代码块范围重叠的节点
    if (chunk.metadata.nodeIds && chunk.metadata.nodeIds.length > 0) {
      for (const nodeId of chunk.metadata.nodeIds) {
        const enhancedNode: ASTNode = {
          id: nodeId,
          type: 'ast_node',
          startByte: 0,
          endByte: 0,
          startLine: startLine,
          endLine: endLine,
          text: chunk.content,
          contentHash: this.enableDeduplication ? ContentHashIDGenerator.getContentHashPrefix(chunk.content) : undefined
        };
        nodes.push(enhancedNode);
      }
    } else {
      // 如果没有nodeIds，创建增强的基本chunk节点
      const enhancedNode: ASTNode = {
        id: ContentHashIDGenerator.generateChunkId(
          chunk.content,
          startLine,
          endLine,
          chunk.metadata.type
        ),
        type: 'chunk',
        startByte: 0,
        endByte: 0,
        startLine: startLine,
        endLine: endLine,
        text: chunk.content,
        contentHash: this.enableDeduplication ? ContentHashIDGenerator.getContentHashPrefix(chunk.content) : undefined
      };
      nodes.push(enhancedNode);
    }
    
    return nodes;
  }

  /**
   * 获取按优先级排序的分段策略
   */
  private getPrioritizedStrategies(): SplitStrategy[] {
    const strategies: SplitStrategy[] = [];
    
    for (const strategyName of this.strategyPriority) {
      const strategy = this.strategies.get(strategyName);
      if (strategy) {
        strategies.push(strategy);
      }
    }
    
    return strategies;
  }

  /**
   * 获取协调器统计信息（增强版）
   */
  getCoordinatorStats(): {
    registeredStrategies: number;
    nodeTrackerStats: any;
    contentHashStats: any;
    deduplicationEnabled: boolean;
    similarityThreshold: number;
  } {
    return {
      registeredStrategies: this.strategies.size,
      nodeTrackerStats: this.nodeTracker.getStats(),
      contentHashStats: this.nodeTracker.getContentHashStats(),
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
    this.smartOverlapController?.clearHistory();
  }
}