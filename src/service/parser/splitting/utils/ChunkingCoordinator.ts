import { CodeChunk, ChunkingOptions, ASTNode, SplitStrategy } from '../types';
import { ASTNodeTracker } from './ASTNodeTracker';

import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 分段策略协调器 - 统一管理所有分段策略的执行
 */
export class ChunkingCoordinator {
  private nodeTracker: ASTNodeTracker;
  private strategies: Map<string, SplitStrategy> = new Map();
  private logger?: LoggerService;
  private options: Required<ChunkingOptions>;

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
  }

  /**
   * 注册分段策略
   */
  registerStrategy(strategy: SplitStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
    this.logger?.debug(`Registered splitting strategy: ${strategy.getName()}`);
  }

  /**
   * 协调执行分段策略
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
        
        // 过滤已使用的节点
        const filteredChunks = this.filterUsedNodes(chunks, ast);
        
        // 标记节点为已使用
        this.markUsedNodes(filteredChunks, ast);
        
        allChunks.push(...filteredChunks);
        this.logger?.debug(`Strategy ${strategyName} contributed ${filteredChunks.length} unique chunks`);
        
      } catch (error) {
        this.logger?.warn(`Strategy ${strategyName} failed: ${error}`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    const stats = this.nodeTracker.getStats();
    
    this.logger?.info(
      `Chunking coordination completed. ` +
      `Total chunks: ${allChunks.length}, ` +
      `Used nodes: ${stats.usedNodes}/${stats.totalNodes}, ` +
      `Reuse count: ${stats.reuseCount}, ` +
      `Duration: ${totalTime}ms`
    );
    
    return allChunks;
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
   * 过滤已使用节点的代码块
   */
  private filterUsedNodes(chunks: CodeChunk[], ast?: any): CodeChunk[] {
    const filteredChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      const chunkNodes = this.extractNodesFromChunk(chunk, ast);
      const hasUnusedNodes = chunkNodes.some(node => !this.nodeTracker.isUsed(node));
      
      if (hasUnusedNodes) {
        filteredChunks.push(chunk);
      }
    }
    
    return filteredChunks;
  }

  /**
   * 标记代码块中的节点为已使用
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
   * 从代码块中提取AST节点
   */
  private extractNodesFromChunk(chunk: CodeChunk, ast?: any): ASTNode[] {
    if (!ast || !chunk.metadata.startLine || !chunk.metadata.endLine) {
      // 如果没有AST或元数据不完整，返回一个基本节点表示整个chunk
      return [{
        id: `chunk-${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
        type: 'chunk',
        startByte: 0,
        endByte: 0,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        text: chunk.content
      }];
    }
    
    const nodes: ASTNode[] = [];
    const startLine = chunk.metadata.startLine;
    const endLine = chunk.metadata.endLine;
    
    // 从AST中提取与代码块范围重叠的节点
    // 简化实现：如果chunk有nodeIds，使用它们创建基本节点
    if (chunk.metadata.nodeIds && chunk.metadata.nodeIds.length > 0) {
      for (const nodeId of chunk.metadata.nodeIds) {
        nodes.push({
          id: nodeId,
          type: 'ast_node',
          startByte: 0,
          endByte: 0,
          startLine: startLine,
          endLine: endLine,
          text: chunk.content
        });
      }
    } else {
      // 如果没有nodeIds，创建一个基本的chunk节点
      nodes.push({
        id: `chunk-${startLine}-${endLine}`,
        type: 'chunk',
        startByte: 0,
        endByte: 0,
        startLine: startLine,
        endLine: endLine,
        text: chunk.content
      });
    }
    
    return nodes;
  }

  /**
   * 获取协调器统计信息
   */
  getCoordinatorStats(): {
    registeredStrategies: number;
    nodeTrackerStats: any;
  } {
    return {
      registeredStrategies: this.strategies.size,
      nodeTrackerStats: this.nodeTracker.getStats()
    };
  }

  /**
   * 设置分段选项
   */
  setOptions(options: Required<ChunkingOptions>): void {
    this.options = options;
  }

  /**
   * 获取分段选项
   */
  getOptions(): Required<ChunkingOptions> {
    return this.options;
  }
}