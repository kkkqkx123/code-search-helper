import { CodeChunk, CodeChunkMetadata, OverlapCalculator, EnhancedChunkingOptions } from '../types';
import { SemanticBoundaryAnalyzer } from './SemanticBoundaryAnalyzer';
import { BalancedChunker } from '../BalancedChunker';
import { ContextAwareOverlapOptimizer, OverlapResult } from './ContextAwareOverlapOptimizer';
import { ASTNodeTracker, ASTNode } from './ASTNodeTracker';
import { Tree } from 'tree-sitter';

export type OverlapStrategy = 'semantic' | 'syntactic' | 'size-based' | 'hybrid' | 'ast-boundary';

export interface EnhancedOverlapOptions {
  maxSize: number;
  minLines: number;
  maxOverlapRatio: number;
  enableASTBoundaryDetection: boolean;
  nodeTracker?: ASTNodeTracker;
  ast?: any; // 或者使用 Parser.SyntaxNode，但我们使用 any 以保持灵活性
}

export interface EnhancedOverlapResult {
  content: string;
  lines: number;
  strategy: OverlapStrategy;
  quality: number;
  astNodesUsed: string[];
  overlapRatio: number;
}

/**
 * 增强的重叠计算器 - 实现AST边界感知和重复检测
 */
export class EnhancedOverlapCalculator implements OverlapCalculator {
  private semanticAnalyzer: SemanticBoundaryAnalyzer;
  private balancedChunker: BalancedChunker;
  private contextAnalyzer: ContextAwareOverlapOptimizer;
  private options: Required<EnhancedOverlapOptions>;
  private nodeTracker?: ASTNodeTracker;

  constructor(options: EnhancedOverlapOptions) {
    this.semanticAnalyzer = new SemanticBoundaryAnalyzer();
    this.balancedChunker = new BalancedChunker();
    this.contextAnalyzer = new ContextAwareOverlapOptimizer();
    this.options = {
      maxSize: options.maxSize ?? 200,
      minLines: options.minLines ?? 1,
      maxOverlapRatio: options.maxOverlapRatio ?? 0.3,
      enableASTBoundaryDetection: options.enableASTBoundaryDetection ?? false,
      nodeTracker: options.nodeTracker,
      ast: options.ast
    } as Required<EnhancedOverlapOptions>;
    this.nodeTracker = options.nodeTracker;
  }

  /**
   * 为代码块添加重叠内容
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];
    const options = {
      maxSize: this.options.maxSize,
      minLines: this.options.minLines,
      maxOverlapRatio: this.options.maxOverlapRatio,
      enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
      nodeTracker: this.nodeTracker,
      ast: this.options.ast
    };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 为除最后一个外的所有chunks添加重叠
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapResult = this.calculateEnhancedOverlap(chunk, nextChunk, originalCode, options);

        overlappedChunks.push({
          ...chunk,
          content: chunk.content + '\n' + overlapResult.content
        });
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
    const options = {
      maxSize: this.options.maxSize,
      minLines: this.options.minLines,
      maxOverlapRatio: this.options.maxOverlapRatio,
      enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
      nodeTracker: this.nodeTracker,
      ast: this.options.ast
    };

    const result = this.calculateEnhancedOverlap(currentChunk, nextChunk, originalCode, options);
    return result.content;
  }

  /**
   * 智能计算重叠
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[] {
    // 从后往前查找有意义的上下文
    const overlapLines: string[] = [];
    let size = 0;

    // 优先选择函数定义、类定义等重要行
    for (let i = currentChunk.length - 1; i >= 0; i--) {
      const line = currentChunk[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= this.options.maxSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return overlapLines;
  }

  /**
   * 增强的重叠计算方法
   */
  calculateEnhancedOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    // 1. 选择重叠策略
    const strategy = this.selectEnhancedOverlapStrategy(currentChunk, nextChunk, options);

    // 2. 根据策略计算重叠
    const baseOverlap = this.calculateBaseOverlap(strategy, currentChunk, nextChunk, originalCode, options);

    // 3. 上下文感知优化
    // 将 EnhancedOverlapResult 转换为 OverlapResult
    const overlapResult: OverlapResult = {
      content: baseOverlap.content,
      lines: baseOverlap.lines,
      strategy: baseOverlap.strategy as 'semantic' | 'syntactic' | 'size-based' | 'hybrid',
      quality: baseOverlap.quality
    };
    
    const optimizedOverlap = this.contextAnalyzer.optimizeOverlapForContext(
      overlapResult, currentChunk, nextChunk
    );
    
    // 将优化后的结果转换回 EnhancedOverlapResult
    const enhancedOptimizedOverlap: EnhancedOverlapResult = {
      content: optimizedOverlap.content,
      lines: optimizedOverlap.lines,
      strategy: optimizedOverlap.strategy as OverlapStrategy,
      quality: optimizedOverlap.quality,
      astNodesUsed: baseOverlap.astNodesUsed,
      overlapRatio: baseOverlap.overlapRatio
    };

    // 4. AST边界检测和重复检测
    const finalOverlap = this.applyASTBoundaryDetection(optimizedOverlap, currentChunk, nextChunk, options);

    return finalOverlap;
  }

  /**
   * 选择增强的重叠策略
   */
  private selectEnhancedOverlapStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: EnhancedOverlapOptions
  ): OverlapStrategy {
    // 如果启用了AST边界检测，优先使用AST边界策略
    if (options.enableASTBoundaryDetection && options.ast && options.nodeTracker) {
      return 'ast-boundary';
    }

    // 根据块类型和内容选择最适合的重叠策略
    if (this.isSequentialFunctions(currentChunk, nextChunk)) {
      return 'semantic';
    }

    if (this.isComplexStructure(currentChunk)) {
      return 'syntactic';
    }

    if (this.isSimpleCode(currentChunk, nextChunk)) {
      return 'size-based';
    }

    return 'hybrid';
  }

  /**
   * 计算基础重叠
   */
  private calculateBaseOverlap(
    strategy: OverlapStrategy,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    switch (strategy) {
      case 'ast-boundary':
        return this.calculateASTBoundaryOverlap(currentChunk, nextChunk, originalCode, options);
      case 'semantic':
        return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode, options);
      case 'syntactic':
        return this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode, options);
      case 'size-based':
        return this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode, options);
      default:
        return this.calculateHybridOverlap(currentChunk, nextChunk, originalCode, options);
    }
  }

  /**
   * AST边界感知重叠计算
   */
  private calculateASTBoundaryOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    if (!options.ast || !options.nodeTracker) {
      // 回退到语义重叠
      return this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode, options);
    }

    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');
    const astNodesUsed: string[] = [];

    // 从当前块末尾向前搜索，优先选择AST边界
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= options.maxSize) break;

      const line = lines[i];
      
      // 检查该行对应的AST节点是否已被使用
      const lineNodes = options.nodeTracker.filterUnusedNodesFromTree(
        options.ast, i + 1, i + 1
      );

      // 如果该行包含尚未使用的AST节点，则考虑包含在重叠中
      if (lineNodes.length > 0 && !this.hasUsedNodes(lineNodes, options.nodeTracker)) {
        const boundaryScore = this.semanticAnalyzer.calculateBoundaryScore(line, [], currentChunk.metadata.language);

        // 高评分的边界更有可能被包含在重叠中
        if (boundaryScore.score > 0.6 || overlapLines.length < options.minLines) {
          overlapLines.unshift(line);
          
          // 标记这些节点为已使用
          lineNodes.forEach(node => options.nodeTracker!.markUsed(node));
          astNodesUsed.push(...lineNodes.map(n => n.type));
        }
      }

      // 检查重叠比例限制
      const currentOverlapRatio = overlapLines.join('\n').length / currentChunk.content.length;
      if (currentOverlapRatio > options.maxOverlapRatio) {
        break;
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'ast-boundary',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
      astNodesUsed,
      overlapRatio: overlapLines.join('\n').length / currentChunk.content.length
    };
  }

  /**
   * 检查节点是否已被使用
   */
  private hasUsedNodes(nodes: ASTNode[], nodeTracker: ASTNodeTracker): boolean {
    return nodes.some(node => nodeTracker.isUsed(node));
  }

  /**
   * 语义重叠计算
   */
  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    // 从当前块末尾向前搜索，优先选择语义边界
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= options.maxSize) break;

      const line = lines[i];
      const boundaryScore = this.semanticAnalyzer.calculateBoundaryScore(line, [], currentChunk.metadata.language);

      // 高评分的边界更有可能被包含在重叠中
      // 特殊处理：如果是函数签名且当前重叠较少，则包含它
      const isFunctionSignature = this.isFunctionSignature(line);
      
      // 先检查添加这行是否会超过重叠比例限制
      const tentativeOverlap = [line, ...overlapLines].join('\n');
      const tentativeRatio = tentativeOverlap.length / currentChunk.content.length;
      
      // 根据条件决定是否添加这行
      const shouldAdd = boundaryScore.score > 0.6 || 
                       overlapLines.length < options.minLines ||
                       (isFunctionSignature && tentativeRatio <= options.maxOverlapRatio);
      
      if (shouldAdd && tentativeRatio <= options.maxOverlapRatio) {
        // 只有在不超过重叠比例限制时才添加
        overlapLines.unshift(line);
      } else if (shouldAdd && overlapLines.length === 0) {
        // 如果这是第一行且会超过限制，仍然添加（至少保证有一些重叠）
        overlapLines.unshift(line);
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'semantic',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
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
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    // 从当前块末尾向前搜索，确保语法符号平衡
    let balance = 0;
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= options.maxSize) break;

      const line = lines[i];
      overlapLines.unshift(line);

      // 检查符号平衡
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

      // 检查重叠比例限制
      const currentOverlapRatio = overlapLines.join('\n').length / currentChunk.content.length;
      if (currentOverlapRatio > options.maxOverlapRatio) {
        break;
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'syntactic',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
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
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    // 简单按大小计算重叠
    let size = 0;
    // 从当前块的末尾开始，向前查找重叠内容
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= options.maxSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }

      // 检查重叠比例限制
      const currentOverlapRatio = size / currentChunk.content.length;
      if (currentOverlapRatio > options.maxOverlapRatio) {
        break;
      }
    }

    const overlapContent = overlapLines.join('\n');

    return {
      content: overlapContent,
      lines: overlapLines.length,
      strategy: 'size-based',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk),
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
    originalCode: string,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    // 结合多种策略的混合方法
    const semanticResult = this.calculateSemanticOverlap(currentChunk, nextChunk, originalCode, options);
    const syntacticResult = this.calculateSyntacticOverlap(currentChunk, nextChunk, originalCode, options);
    const sizeResult = this.calculateSizeBasedOverlap(currentChunk, nextChunk, originalCode, options);

    // 选择质量最高的结果
    const results = [semanticResult, syntacticResult, sizeResult];
    return results.reduce((best, current) =>
      current.quality > best.quality ? current : best
    );
  }

  /**
   * 应用AST边界检测
   */
  private applyASTBoundaryDetection(
    overlap: OverlapResult,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: EnhancedOverlapOptions
  ): EnhancedOverlapResult {
    if (!options.enableASTBoundaryDetection || !options.nodeTracker) {
      // 将 OverlapResult 转换为 EnhancedOverlapResult
      const overlapRatio = overlap.content.length > 0 ? overlap.content.length / currentChunk.content.length : 0;
      
      return {
        content: overlap.content,
        lines: overlap.lines,
        strategy: overlap.strategy as OverlapStrategy,
        quality: overlap.quality,
        astNodesUsed: [],
        overlapRatio
      };
    }

    // 检查重叠内容是否包含已使用的AST节点
    const overlapContent = overlap.content;
    const lines = overlapContent.split('\n');

    // 这里可以添加更复杂的AST边界优化逻辑
    // 例如：确保重叠边界在AST节点边界上

    // 将 OverlapResult 转换为 EnhancedOverlapResult
    return {
      content: overlap.content,
      lines: overlap.lines,
      strategy: overlap.strategy as OverlapStrategy,
      quality: overlap.quality,
      astNodesUsed: [],
      overlapRatio: overlap.content.length > 0 ? overlap.content.length / currentChunk.content.length : 0
    };
  }

  /**
   * 计算重叠质量
   */
  private calculateOverlapQuality(
    overlapLines: string[],
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): number {
    if (overlapLines.length === 0) return 0;

    let quality = 0;
    const firstLine = overlapLines[0]?.trim() || '';
    const lastLine = overlapLines[overlapLines.length - 1]?.trim() || '';

    // 检查第一行是否是重要的语义边界
    if (this.isFunctionStart(firstLine) || this.isClassStart(firstLine)) {
      quality += 0.3;
    }

    // 检查最后一行是否是语法闭合符号
    if (lastLine.match(/^[}\])];?]?$/)) {
      quality += 0.2;
    }

    // 检查是否有注释
    if (firstLine.match(/^\/\//) || firstLine.match(/^\/\*/)) {
      quality += 0.1;
    }

    // 检查重叠行数是否合理
    if (overlapLines.length > 0 && overlapLines.length < 10) {
      quality += 0.2;
    }

    // 检查是否包含有意义的内容（非空行和注释）
    const meaningfulLines = overlapLines.filter(line =>
      line.trim() !== '' &&
      !line.trim().match(/^\/\//) &&
      !line.trim().match(/^\/\*/)
    );

    if (meaningfulLines.length / overlapLines.length > 0.5) {
      quality += 0.2;
    }

    return Math.min(quality, 1.0);
  }

  // 以下是辅助方法，需要从原UnifiedOverlapCalculator中复制
  private isSequentialFunctions(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const lastLineOfCurrent = currentLines[currentLines.length - 1]?.trim() || '';
    const firstLineOfNext = nextLines[0]?.trim() || '';

    return (lastLineOfCurrent.endsWith('}') &&
      (firstLineOfNext.startsWith('function') ||
        !!firstLineOfNext.match(/^\w+\s*\([^)]*\)\s*{/)));
  }

  private isComplexStructure(chunk: CodeChunk): boolean {
    const lines = chunk.content.split('\n');
    let braceDepth = 0;
    let maxDepth = 0;

    for (const line of lines) {
      for (const char of line) {
        if (char === '{') {
          braceDepth++;
          maxDepth = Math.max(maxDepth, braceDepth);
        } else if (char === '}') {
          braceDepth--;
        }
      }
    }

    return maxDepth > 2;
  }

  private isSimpleCode(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const allLines = [...currentLines, ...nextLines];
    return allLines.every(line =>
      line.trim().startsWith('const') ||
      line.trim().startsWith('let') ||
      line.trim().startsWith('var') ||
      line.trim().startsWith('import') ||
      line.trim().startsWith('export') ||
      line.trim().match(/^\w+\s*=/)
    );
  }

  private isFunctionStart(line: string): boolean {
    return /^function\s+\w+\s*\(/.test(line) ||
      /^\w+\s*=\s*\([^)]*\)\s*=>/.test(line) ||
      /^\s*async\s+function/.test(line) ||
      /^\s*static\s+\w+\s*\(/.test(line) ||
      /^\s*\w+\s*\([^)]*\)\s*\{/.test(line);
  }

  private isClassStart(line: string): boolean {
    return /^class\s+\w+/.test(line) ||
      /^export\s+default\s+class/.test(line) ||
      /^export\s+class/.test(line);
  }

  private isFunctionSignature(line: string): boolean {
    const trimmed = line.trim();
    return /^function\s+\w+\s*\(/.test(trimmed) ||
           /^\w+\s*=\s*\([^)]*\)\s*=>/.test(trimmed) ||
           /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/.test(trimmed) ||
           /^\s*\w+\s*:\s*\([^)]*\)\s*=>/.test(trimmed);
  }
}