import { CodeChunk, ASTNode, OverlapCalculator } from '../../../splitting';
import { ASTNodeTracker } from '../AST/ASTNodeTracker';
import { SemanticBoundaryAnalyzer } from '../SemanticBoundaryAnalyzer';
import { BalancedChunker } from '../../../splitting/BalancedChunker';
import { ContextAwareOverlapOptimizer, OverlapResult } from './ContextAwareOverlapOptimizer';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ContentHashIDGenerator } from '../ContentHashIDGenerator';
import { SimilarityDetector } from '../similarity/SimilarityDetector';
import { CodeQualityAssessmentUtils } from '../CodeQualityAssessmentUtils';
import { OverlapStrategyUtils } from './OverlapStrategyUtils';
import { ChunkSimilarityUtils } from '../chunk-processing/ChunkSimilarityUtils';

export type OverlapStrategy = 'semantic' | 'syntactic' | 'size-based' | 'hybrid' | 'ast-boundary' | 'node-aware' | 'smart-deduplication';

export interface UnifiedOverlapOptions {
  maxSize: number;
  minLines: number;
  maxOverlapRatio: number;
  maxOverlapLines?: number;
  enableASTBoundaryDetection: boolean;
  enableNodeAwareOverlap?: boolean;
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  mergeStrategy?: 'aggressive' | 'conservative';
  nodeTracker?: ASTNodeTracker;
  ast?: any;
  logger?: LoggerService;
}

export interface UnifiedOverlapResult {
  content: string;
  lines: number;
  strategy: OverlapStrategy;
  quality: number;
  astNodesUsed: string[];
  overlapRatio: number;
  isDuplicate?: boolean;
}

/**
 * 统一的重叠计算器 - 整合所有重叠计算策略
 * 合并了EnhancedOverlapCalculator、NodeAwareOverlapCalculator和SmartOverlapController的功能
 */
export class UnifiedOverlapCalculator implements OverlapCalculator {
  private semanticAnalyzer: SemanticBoundaryAnalyzer;
  private balancedChunker: BalancedChunker;
  private contextAnalyzer: ContextAwareOverlapOptimizer;
  private options: Required<UnifiedOverlapOptions>;
  private nodeTracker?: ASTNodeTracker;
  private logger?: LoggerService;

  // SmartOverlapController 功能集成
  private processedChunks: Map<string, CodeChunk>;
  private overlapHistory: Map<string, string[]>; // 记录每个位置的重叠历史

  constructor(options: UnifiedOverlapOptions) {
    this.semanticAnalyzer = new SemanticBoundaryAnalyzer();
    this.balancedChunker = new BalancedChunker();
    this.contextAnalyzer = new ContextAwareOverlapOptimizer();
    this.options = {
      maxSize: options.maxSize ?? 200,
      minLines: options.minLines ?? 1,
      maxOverlapRatio: options.maxOverlapRatio ?? 0.3,
      maxOverlapLines: options.maxOverlapLines ?? 50,
      enableASTBoundaryDetection: options.enableASTBoundaryDetection ?? false,
      enableNodeAwareOverlap: options.enableNodeAwareOverlap ?? false,
      enableSmartDeduplication: options.enableSmartDeduplication ?? false,
      similarityThreshold: options.similarityThreshold ?? 0.8,
      mergeStrategy: options.mergeStrategy ?? 'conservative',
      nodeTracker: options.nodeTracker,
      ast: options.ast,
      logger: options.logger
    } as Required<UnifiedOverlapOptions>;
    this.nodeTracker = options.nodeTracker;
    this.logger = options.logger;

    // 初始化 SmartOverlapController 相关功能
    this.processedChunks = new Map();
    this.overlapHistory = new Map();
  }

  /**
   * 为代码块添加重叠内容
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];

        // 检查是否为重复块（节点感知功能）
        if (this.options.enableNodeAwareOverlap && this.nodeTracker) {
          const isDuplicate = this.isDuplicateChunk(chunk, nextChunk);
          if (isDuplicate) {
            this.logger?.debug(`Skipping duplicate chunk at lines ${nextChunk.metadata.startLine}-${nextChunk.metadata.endLine}`);
            continue;
          }
        }

        // 智能重叠控制（SmartOverlapController 功能）
        if (this.options.enableSmartDeduplication) {
          const overlapContent = this.createSmartOverlap(chunk, nextChunk, originalCode, chunks);
          if (overlapContent) {
            overlappedChunks.push({
              ...chunk,
              content: chunk.content + '\n' + overlapContent
            });
          } else {
            overlappedChunks.push(chunk);
          }
        } else {
          const overlapResult = this.calculateUnifiedOverlap(chunk, nextChunk, originalCode);
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapResult.content
          });
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }

    return overlappedChunks;
  }

  /**
   * 提取重叠内容
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string {
    const overlapResult = this.calculateUnifiedOverlap(currentChunk, nextChunk, originalCode);
    return overlapResult.content;
  }
  /**
   * 计算最优重叠 - 公共接口方法
   */
  calculateOptimalOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options?: Partial<UnifiedOverlapOptions>
  ): UnifiedOverlapResult {
    // 如果提供了选项，临时更新选项
    const originalOptions = { ...this.options };
    if (options) {
      this.options = { ...this.options, ...options } as Required<UnifiedOverlapOptions>;
    }

    const result = this.calculateUnifiedOverlap(currentChunk, nextChunk, originalCode);

    // 恢复原始选项
    if (options) {
      this.options = originalOptions;
    }

    return result;
  }


  /**
   * 智能计算重叠
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[] {
    const currentCodeChunk: CodeChunk = {
      content: currentChunk.join('\n'),
      metadata: {
        startLine: startLine,
        endLine: startLine + currentChunk.length - 1,
        language: 'unknown'
      }
    };

    const nextCodeChunk: CodeChunk = {
      content: '',
      metadata: {
        startLine: startLine + currentChunk.length,
        endLine: startLine + currentChunk.length,
        language: 'unknown'
      }
    };

    const overlapResult = this.calculateUnifiedOverlap(
      currentCodeChunk,
      nextCodeChunk,
      originalCode
    );

    return overlapResult.content.split('\n');
  }

  /**
   * 智能重叠生成 - 防止生成过于相似的重叠块（SmartOverlapController 功能）
   */
  createSmartOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    allChunks: CodeChunk[]
  ): string {
    const overlapSize = this.calculateOptimalOverlapSize(currentChunk, nextChunk);

    if (overlapSize <= 0) {
      return '';
    }

    // 从原始内容中提取重叠区域
    const overlapContent = this.extractOverlapContentFromOriginal(
      currentChunk,
      nextChunk,
      originalContent,
      overlapSize
    );

    if (!overlapContent) {
      return '';
    }

    // 创建临时的重叠块进行相似度检查
    const tempOverlapChunk: CodeChunk = {
      content: overlapContent,
      metadata: {
        startLine: currentChunk.metadata.endLine - overlapSize + 1,
        endLine: currentChunk.metadata.endLine,
        language: currentChunk.metadata.language,
        filePath: currentChunk.metadata.filePath,
        type: 'overlap'
      }
    };

    // 检查是否应该创建这个重叠块
    if (!this.shouldCreateOverlap(tempOverlapChunk, allChunks, originalContent)) {
      // 尝试生成不同的重叠内容
      return this.generateAlternativeOverlap(currentChunk, nextChunk, originalContent, allChunks);
    }

    // 记录重叠历史
    this.recordOverlapHistory(tempOverlapChunk);

    return overlapContent;
  }

  /**
   * 智能合并相似的块（SmartOverlapController 功能）
   */
  mergeSimilarChunks(chunks: CodeChunk[]): CodeChunk[] {
    const merged: CodeChunk[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      let currentChunk = chunks[i];
      processed.add(i);

      // 查找可以合并的相似块
      for (let j = i + 1; j < chunks.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const otherChunk = chunks[j];

        // 检查是否相似且相邻或重叠
        if (this.canMergeChunks(currentChunk, otherChunk)) {
          currentChunk = this.mergeTwoChunks(currentChunk, otherChunk);
          processed.add(j);
        }
      }

      merged.push(currentChunk);
    }

    return merged;
  }

  /**
   * 清理历史记录（内存管理）
   */
  clearHistory(): void {
    this.processedChunks.clear();
    this.overlapHistory.clear();
  }

  /**
   * 获取控制器统计信息
   */
  getStats(): {
    processedChunks: number;
    overlapHistoryEntries: number;
    similarityThreshold: number;
    mergeStrategy: string;
  } {
    return {
      processedChunks: this.processedChunks.size,
      overlapHistoryEntries: this.overlapHistory.size,
      similarityThreshold: this.options.similarityThreshold,
      mergeStrategy: this.options.mergeStrategy
    };
  }

  /**
   * 统一的重叠计算核心方法
   */
  private calculateUnifiedOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    // 1. 选择重叠策略
    const strategy = this.selectUnifiedOverlapStrategy(currentChunk, nextChunk);

    // 2. 根据策略计算重叠
    const baseOverlap = this.calculateBaseOverlap(strategy, currentChunk, nextChunk, originalCode);

    // 3. 上下文感知优化
    const overlapResult: OverlapResult = {
      content: baseOverlap.content,
      lines: baseOverlap.lines,
      strategy: baseOverlap.strategy as 'semantic' | 'syntactic' | 'size-based' | 'hybrid',
      quality: baseOverlap.quality
    };

    const optimizedOverlap = this.contextAnalyzer.optimizeOverlapForContext(
      overlapResult, currentChunk, nextChunk
    );

    // 4. 转换回统一结果格式
    const unifiedOptimizedOverlap: UnifiedOverlapResult = {
      content: optimizedOverlap.content,
      lines: optimizedOverlap.lines,
      strategy: optimizedOverlap.strategy as OverlapStrategy,
      quality: optimizedOverlap.quality,
      astNodesUsed: baseOverlap.astNodesUsed,
      overlapRatio: baseOverlap.overlapRatio
    };

    // 5. AST边界检测和重复检测
    const finalOverlap = this.applyFinalOptimizations(unifiedOptimizedOverlap, currentChunk, nextChunk);

    return finalOverlap;
  }

  /**
   * 选择统一的重叠策略
   */
  private selectUnifiedOverlapStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): OverlapStrategy {
    // 使用新的工具类方法
    return OverlapStrategyUtils.selectUnifiedOverlapStrategy(currentChunk, nextChunk, this.options);
  }

  /**
   * 判断是否应使用智能去重策略
   */
  private shouldUseSmartDeduplicationStrategy(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 使用新的工具类方法
    return OverlapStrategyUtils.shouldUseSmartDeduplicationStrategy(currentChunk, nextChunk, this.options);
  }

  /**
   * 判断是否应使用节点感知策略
   */
  private shouldUseNodeAwareStrategy(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 使用新的工具类方法
    return OverlapStrategyUtils.shouldUseNodeAwareStrategy(currentChunk, nextChunk);
  }

  /**
   * 计算基础重叠
   */
  private calculateBaseOverlap(
    strategy: OverlapStrategy,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    switch (strategy) {
      case 'smart-deduplication':
        return this.calculateSmartDeduplicationOverlap(currentChunk, nextChunk, originalCode);
      case 'node-aware':
        return this.calculateNodeAwareOverlap(currentChunk, nextChunk, originalCode);
      case 'ast-boundary':
        return this.calculateASTBoundaryOverlap(currentChunk, nextChunk, originalCode);
      case 'semantic':
        return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
      case 'syntactic':
        return this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode);
      case 'size-based':
        return this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode);
      default:
        return this.calculateHybridOverlap(currentChunk, nextChunk, originalCode);
    }
  }

  /**
   * 智能去重重叠计算（SmartOverlapController 功能）
   */
  private calculateSmartDeduplicationOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    // 首先尝试语义重叠
    const semanticResult = this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);

    // 检查是否应该创建这个重叠块
    const tempChunk: CodeChunk = {
      content: semanticResult.content,
      metadata: {
        startLine: currentChunk.metadata.endLine - semanticResult.lines + 1,
        endLine: currentChunk.metadata.endLine,
        language: currentChunk.metadata.language,
        filePath: currentChunk.metadata.filePath,
        type: 'overlap'
      }
    };

    if (!this.shouldCreateOverlap(tempChunk, [], originalCode)) {
      // 尝试生成替代的重叠内容
      const alternativeOverlap = this.generateAlternativeOverlap(currentChunk, nextChunk, originalCode, []);
      if (alternativeOverlap) {
        return {
          content: alternativeOverlap,
          lines: alternativeOverlap.split('\n').length,
          strategy: 'smart-deduplication',
          quality: 0.7,
          astNodesUsed: [],
          overlapRatio: alternativeOverlap.length / currentChunk.content.length
        };
      }
    }

    this.recordOverlapHistory(tempChunk);
    return semanticResult;
  }

  /**
   * 节点感知重叠计算
   */
  private calculateNodeAwareOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    if (!this.nodeTracker) {
      return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
    }

    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;
    const gapLines = nextStartLine - currentEndLine - 1;

    if (gapLines <= 0) {
      return { content: '', lines: 0, strategy: 'node-aware', quality: 0, astNodesUsed: [], overlapRatio: 0 };
    }

    const maxPossibleOverlap = Math.min(gapLines, this.options.maxOverlapLines);
    if (maxPossibleOverlap <= 0) {
      return { content: '', lines: 0, strategy: 'node-aware', quality: 0, astNodesUsed: [], overlapRatio: 0 };
    }

    const overlapContent = this.extractOverlapFromOriginal(
      originalCode,
      currentEndLine + 1,
      nextStartLine - 1
    );

    const overlapNodes = this.extractNodesFromContent(
      overlapContent,
      currentEndLine + 1,
      nextStartLine - 1
    );

    const unusedNodes = overlapNodes.filter(node => !this.nodeTracker!.isUsed(node));

    if (unusedNodes.length === 0) {
      const reducedOverlap = this.findReducedOverlap(overlapContent, originalCode, currentEndLine);
      return {
        content: reducedOverlap,
        lines: reducedOverlap.split('\n').length,
        strategy: 'node-aware',
        quality: reducedOverlap ? 0.5 : 0,
        astNodesUsed: [],
        overlapRatio: reducedOverlap.length / currentChunk.content.length
      };
    }

    unusedNodes.forEach(node => this.nodeTracker!.markUsed(node));

    return {
      content: overlapContent,
      lines: overlapContent.split('\n').length,
      strategy: 'node-aware',
      quality: CodeQualityAssessmentUtils.calculateOverlapQuality(overlapContent.split('\n'), currentChunk, nextChunk),
      astNodesUsed: unusedNodes.map(n => n.id),
      overlapRatio: overlapContent.length / currentChunk.content.length
    };
  }

  /**
   * AST边界感知重叠计算
   */
  private calculateASTBoundaryOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    if (!this.options.ast || !this.nodeTracker) {
      return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
    }

    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');
    const astNodesUsed: string[] = [];

    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= this.options.maxSize) break;

      const line = lines[i];
      const lineNodes = this.filterUnusedNodesFromTree(
        this.options.ast, i + 1, i + 1
      );

      if (lineNodes.length > 0 && !this.hasUsedNodes(lineNodes)) {
        const boundaryScore = this.semanticAnalyzer.calculateBoundaryScore(line, [], currentChunk.metadata.language);

        if (boundaryScore.score > 0.6 || overlapLines.length < this.options.minLines) {
          overlapLines.unshift(line);
          lineNodes.forEach(node => this.nodeTracker!.markUsed(node));
          astNodesUsed.push(...lineNodes.map(n => n.type));
        }
      }

      const currentOverlapRatio = overlapLines.join('\n').length / currentChunk.content.length;
      if (currentOverlapRatio > this.options.maxOverlapRatio) {
        break;
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'ast-boundary',
      quality: CodeQualityAssessmentUtils.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
      astNodesUsed,
      overlapRatio: overlapLines.join('\n').length / currentChunk.content.length
    };
  }

  /**
   * 语义重叠计算
   */
  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= this.options.maxSize) break;

      const line = lines[i];
      const boundaryScore = this.semanticAnalyzer.calculateBoundaryScore(line, [], currentChunk.metadata.language);
      const isFunctionSignature = CodeQualityAssessmentUtils.isFunctionSignature(line);

      const tentativeOverlap = [line, ...overlapLines].join('\n');
      const tentativeRatio = tentativeOverlap.length / currentChunk.content.length;

      const shouldAdd = boundaryScore.score > 0.6 ||
        overlapLines.length < this.options.minLines ||
        (isFunctionSignature && tentativeRatio <= this.options.maxOverlapRatio);

      if (shouldAdd && tentativeRatio <= this.options.maxOverlapRatio) {
        overlapLines.unshift(line);
      } else if (shouldAdd && overlapLines.length === 0) {
        overlapLines.unshift(line);
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'semantic',
      quality: CodeQualityAssessmentUtils.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
      astNodesUsed: [],
      overlapRatio: overlapLines.join('\n').length / currentChunk.content.length
    };
  }

  /**
   * 语法重叠计算
   */
  private calculateSyntacticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');
    let balance = 0;

    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= this.options.maxSize) break;

      const line = lines[i];
      overlapLines.unshift(line);

      const originalState = this.balancedChunker.getCurrentState();
      this.balancedChunker.analyzeLineSymbols(line);
      const currentState = this.balancedChunker.getCurrentState();
      const lineBalance = {
        brackets: currentState.brackets - originalState.brackets,
        braces: currentState.braces - originalState.braces,
        squares: currentState.squares - originalState.squares,
        templates: currentState.templates - originalState.templates
      };
      balance += (lineBalance.brackets + lineBalance.braces + lineBalance.squares + lineBalance.templates);
      this.balancedChunker.setCurrentState(currentState);

      const currentOverlapRatio = overlapLines.join('\n').length / currentChunk.content.length;
      if (currentOverlapRatio > this.options.maxOverlapRatio) {
        break;
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'syntactic',
      quality: CodeQualityAssessmentUtils.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
      astNodesUsed: [],
      overlapRatio: overlapLines.join('\n').length / currentChunk.content.length
    };
  }

  /**
   * 大小基础重叠计算
   */
  private calculateSizeBasedOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');
    let size = 0;

    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      const line = lines[i];
      const lineSize = line.length + 1;

      if (size + lineSize <= this.options.maxSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }

      const currentOverlapRatio = size / currentChunk.content.length;
      if (currentOverlapRatio > this.options.maxOverlapRatio) {
        break;
      }
    }

    const overlapContent = overlapLines.join('\n');

    return {
      content: overlapContent,
      lines: overlapLines.length,
      strategy: 'size-based',
      quality: CodeQualityAssessmentUtils.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
      astNodesUsed: [],
      overlapRatio: overlapContent.length / currentChunk.content.length
    };
  }

  /**
   * 混合重叠计算
   */
  private calculateHybridOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): UnifiedOverlapResult {
    const semanticResult = this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode);
    const syntacticResult = this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode);
    const sizeResult = this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode);

    const results = [semanticResult, syntacticResult, sizeResult];
    return results.reduce((best, current) =>
      current.quality > best.quality ? current : best
    );
  }

  /**
   * 应用最终优化
   */
  private applyFinalOptimizations(
    overlap: UnifiedOverlapResult,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): UnifiedOverlapResult {
    // 检查重叠内容是否包含已使用的AST节点
    if (this.options.enableASTBoundaryDetection && this.nodeTracker && overlap.content) {
      const lines = overlap.content.split('\n');
      const hasUsedNodes = this.hasUsedNodesInOverlap(lines, currentChunk, nextChunk);

      if (hasUsedNodes && overlap.lines > 1) {
        // 减少重叠行数
        const reducedLines = lines.slice(0, -1);
        return {
          ...overlap,
          content: reducedLines.join('\n'),
          lines: reducedLines.length,
          quality: overlap.quality * 0.8
        };
      }
    }

    return overlap;
  }

  // SmartOverlapController 功能相关方法
  /**
   * 智能重叠控制 - 检查新的重叠块是否与已有块过于相似
   */
  private shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    originalContent: string
  ): boolean {
    // 使用新的工具类方法
    return ChunkSimilarityUtils.shouldCreateOverlap(newChunk, existingChunks, this.options.similarityThreshold);
  }

  /**
   * 从原始内容中提取重叠内容（SmartOverlapController 功能）
   */
  private extractOverlapContentFromOriginal(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    overlapSize: number
  ): string {
    const lines = originalContent.split('\n');

    // 计算重叠区域
    const overlapStartLine = Math.max(0, currentChunk.metadata.endLine - overlapSize);
    const overlapEndLine = currentChunk.metadata.endLine;

    if (overlapStartLine >= lines.length || overlapEndLine > lines.length) {
      return '';
    }

    const overlapLines = lines.slice(overlapStartLine, overlapEndLine);
    return overlapLines.join('\n');
  }

  /**
   * 计算最佳重叠大小（SmartOverlapController 功能）
   */
  private calculateOptimalOverlapSize(chunk1: CodeChunk, chunk2: CodeChunk): number {
    const chunk1Size = chunk1.metadata.endLine - chunk1.metadata.startLine + 1;
    const chunk2Size = chunk2.metadata.endLine - chunk2.metadata.startLine + 1;

    // 基于块大小和最大重叠比例计算
    const maxOverlap = Math.min(chunk1Size, chunk2Size) * this.options.maxOverlapRatio;

    // 保守策略：使用较小的重叠
    // 激进策略：使用较大的重叠
    const overlapMultiplier = this.options.mergeStrategy === 'conservative' ? 0.7 : 1.0;

    return Math.max(1, Math.floor(maxOverlap * overlapMultiplier));
  }

  /**
   * 生成替代的重叠内容（当原始重叠太相似时）（SmartOverlapController 功能）
   */
  private generateAlternativeOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    allChunks: CodeChunk[]
  ): string {
    const lines = originalContent.split('\n');
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    // 尝试不同的重叠策略
    const strategies = [
      // 策略1：减少重叠大小
      () => {
        const smallerOverlap = Math.max(1, Math.floor((currentEndLine - currentChunk.metadata.startLine + 1) * this.options.maxOverlapRatio * 0.5));
        return this.extractOverlapContentFromOriginal(currentChunk, nextChunk, originalContent, smallerOverlap);
      },

      // 策略2：调整重叠起始位置
      () => {
        const offset = Math.max(0, currentEndLine - 2);
        const availableLines = lines.slice(Math.max(0, offset - 1), currentEndLine);
        return availableLines.join('\n');
      },

      // 策略3：使用语义边界（增强实现）
      () => {
        // 增强的语义边界检测，支持更多边界模式
        const boundaryPatterns = [
          /^\s*}\s*$/,           // 闭合花括号
          /^\s*\)\s*$/,          // 闭合圆括号
          /^\s*\]\s*$/,          // 闭合方括号
          /^\s*return\b/,        // return语句
          /^\s*break\b/,         // break语句
          /^\s*continue\b/,      // continue语句
          /^\s*throw\b/,         // throw语句
          /^\s*$/,               // 空行
          /^\s*\/\/\s*---/,      // 分隔注释
          /^\s*#\s*---/,         // 分隔注释（其他语言）
          /^\s*\/\*\s*---/,      // 块注释分隔
          /^\s*end\s*$/,         // Ruby/Basic结束
          /^\s*endif\s*$/,       // Basic条件结束
          /^\s*endfunction\s*$/, // Basic函数结束
        ];

        // 扩大搜索范围到12行，提高找到合适边界的概率
        const searchRange = Math.min(12, currentEndLine - currentChunk.metadata.startLine);

        for (let i = currentEndLine - 1; i >= Math.max(0, currentEndLine - searchRange); i--) {
          const line = lines[i];
          if (boundaryPatterns.some(pattern => pattern.test(line))) {
            const overlapLines = lines.slice(i, currentEndLine);
            return overlapLines.join('\n');
          }
        }

        // 回退到原始简化逻辑
        for (let i = currentEndLine - 1; i >= Math.max(0, currentEndLine - 5); i--) {
          const line = lines[i];
          if (line.includes('}') || line.includes('return') || line.trim() === '') {
            const overlapLines = lines.slice(i, currentEndLine);
            return overlapLines.join('\n');
          }
        }
        return '';
      }
    ];

    // 尝试每种策略，直到找到不相似的重叠
    for (const strategy of strategies) {
      const alternativeOverlap = strategy();

      if (alternativeOverlap) {
        const tempChunk: CodeChunk = {
          content: alternativeOverlap,
          metadata: {
            startLine: currentEndLine - alternativeOverlap.split('\n').length,
            endLine: currentEndLine,
            language: currentChunk.metadata.language,
            filePath: currentChunk.metadata.filePath,
            type: 'overlap'
          }
        };

        if (this.shouldCreateOverlap(tempChunk, allChunks, originalContent)) {
          this.recordOverlapHistory(tempChunk);
          return alternativeOverlap;
        }
      }
    }

    // 如果所有策略都失败，返回空字符串（表示不创建重叠）
    return '';
  }

  /**
   * 记录重叠历史（SmartOverlapController 功能）
   */
  private recordOverlapHistory(chunk: CodeChunk): void {
    const overlapKey = `${chunk.metadata.startLine}-${chunk.metadata.endLine}`;
    const contentHash = ContentHashIDGenerator.getContentHashPrefix(chunk.content);

    if (!this.overlapHistory.has(overlapKey)) {
      this.overlapHistory.set(overlapKey, []);
    }

    const history = this.overlapHistory.get(overlapKey)!;
    history.push(contentHash);

    // 限制历史记录大小
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 检查两个块是否可以合并（SmartOverlapController 功能）
   */
  private canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 使用新的工具类方法
    return ChunkSimilarityUtils.canMergeChunks(chunk1, chunk2, this.options.similarityThreshold);
  }

  /**
   * 合并两个块（SmartOverlapController 功能）
   */
  private mergeTwoChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    // 使用新的工具类方法
    return ChunkSimilarityUtils.mergeTwoChunks(chunk1, chunk2);
  }

  /**
   * 智能合并内容（处理重叠）（SmartOverlapController 功能）
   */
  private mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    // 使用新的工具类方法
    return ChunkSimilarityUtils.mergeContents(content1, content2, startLine1, startLine2);
  }

  // 辅助方法
  private isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 使用新的工具类方法
    return ChunkSimilarityUtils.isDuplicateChunk(chunk1, chunk2);
  }

  private extractOverlapFromOriginal(
    originalCode: string,
    startLine: number,
    endLine: number
  ): string {
    const lines = originalCode.split('\n');
    const overlapLines = lines.slice(startLine - 1, endLine);
    return overlapLines.join('\n');
  }

  private extractNodesFromContent(
    content: string,
    startLine: number,
    endLine: number
  ): ASTNode[] {
    return [];
  }

  private findReducedOverlap(
    originalOverlap: string,
    originalCode: string,
    currentEndLine: number
  ): string {
    const lines = originalOverlap.split('\n');

    for (let i = lines.length - 1; i >= 0; i--) {
      const testOverlap = lines.slice(0, i + 1).join('\n');
      const testStartLine = currentEndLine + 1;
      const testEndLine = currentEndLine + i + 1;

      const testNodes = this.extractNodesFromContent(testOverlap, testStartLine, testEndLine);
      const unusedNodes = testNodes.filter(node => !this.nodeTracker!.isUsed(node));

      if (unusedNodes.length > 0) {
        unusedNodes.forEach(node => this.nodeTracker!.markUsed(node));
        return testOverlap;
      }
    }

    return '';
  }

  private filterUnusedNodesFromTree(tree: any, startLine: number, endLine: number): ASTNode[] {
    return [];
  }

  private hasUsedNodes(nodes: ASTNode[]): boolean {
    if (!this.nodeTracker) return false;
    return nodes.some(node => this.nodeTracker!.isUsed(node));
  }

  private hasUsedNodesInOverlap(lines: string[], currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    return false;
  }

}