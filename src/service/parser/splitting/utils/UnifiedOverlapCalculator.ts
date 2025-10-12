import { CodeChunk, CodeChunkMetadata, OverlapCalculator } from '../types';
import { SemanticBoundaryAnalyzer } from './SemanticBoundaryAnalyzer';
import { BalancedChunker } from '../BalancedChunker';
import { ContextAwareOverlapOptimizer } from './ContextAwareOverlapOptimizer';

export type OverlapStrategy = 'semantic' | 'syntactic' | 'size-based' | 'hybrid';

export interface OverlapOptions {
  maxSize: number;
  minLines: number;
  preferredStrategy?: OverlapStrategy;
  enableContextOptimization?: boolean;
  qualityThreshold?: number;
}

export interface OverlapResult {
  content: string;
  lines: number;
  strategy: OverlapStrategy;
  quality: number;
}

export interface AdaptiveChunkingOptions {
  // 动态调整参数
  adaptiveBoundaryThreshold?: boolean;
  contextAwareOverlap?: boolean;
  semanticWeight?: number;
  syntacticWeight?: number;

  // 语义边界评分配置
  boundaryScoring?: {
    enableSemanticScoring: boolean;
    minBoundaryScore: number;
    maxSearchDistance: number;
    languageSpecificWeights: boolean;
  };

  // 重叠策略配置
  overlapStrategy?: {
    preferredStrategy: OverlapStrategy;
    enableContextOptimization: boolean;
    qualityThreshold: number;
  };

  // 针对不同代码类型的专门配置
  functionSpecificOptions?: {
    preferWholeFunctions: boolean;
    minFunctionOverlap: number;
    maxFunctionSize: number;
  };

  classSpecificOptions?: {
    keepMethodsTogether: boolean;
    classHeaderOverlap: number;
    maxClassSize: number;
  };
}

export class UnifiedOverlapCalculator implements OverlapCalculator {
  private semanticAnalyzer: SemanticBoundaryAnalyzer;
  private balancedChunker: BalancedChunker;
  private contextAnalyzer: ContextAwareOverlapOptimizer;
  private options: Required<OverlapOptions>;

  constructor(options?: OverlapOptions) {
    this.semanticAnalyzer = new SemanticBoundaryAnalyzer();
    this.balancedChunker = new BalancedChunker();
    this.contextAnalyzer = new ContextAwareOverlapOptimizer();
    this.options = {
      maxSize: 200,
      minLines: 1,
      preferredStrategy: 'semantic',
      enableContextOptimization: true,
      qualityThreshold: 0.7,
      ...options
    };
  }

  /**
   * 为代码块添加重叠内容
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];
    const options = {
      maxSize: this.options.maxSize,
      minLines: this.options.minLines
    };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 为除最后一个外的所有chunks添加重叠
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapResult = this.calculateOptimalOverlap(chunk, nextChunk, originalCode, options);

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
      minLines: this.options.minLines
    };

    const result = this.calculateOptimalOverlap(currentChunk, nextChunk, originalCode, options);
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
   * 统一的重叠计算方法
   */
  calculateOptimalOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
    // 1. 选择重叠策略
    const strategy = this.selectOverlapStrategy(currentChunk, nextChunk, options);

    // 2. 根据策略计算重叠
    const baseOverlap = this.calculateBaseOverlap(strategy, currentChunk, nextChunk, originalCode, options);

    // 3. 上下文感知优化
    if (options.enableContextOptimization) {
      return this.contextAnalyzer.optimizeOverlapForContext(
        baseOverlap, currentChunk, nextChunk
      );
    }

    return baseOverlap;
  }

  private selectOverlapStrategy(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    options: OverlapOptions
  ): OverlapStrategy {
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

    return options.preferredStrategy || 'hybrid';
  }

  private isSequentialFunctions(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查是否是连续的函数定义
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const lastLineOfCurrent = currentLines[currentLines.length - 1]?.trim() || '';
    const firstLineOfNext = nextLines[0]?.trim() || '';

    // 检查当前块是否以函数结束，下一块是否以函数开始
    return (lastLineOfCurrent.endsWith('}') &&
      (firstLineOfNext.startsWith('function') ||
        !!firstLineOfNext.match(/^\w+\s*\([^)]*\)\s*{/)));
  }

  private isComplexStructure(chunk: CodeChunk): boolean {
    // 检查是否是复杂的嵌套结构
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
    // 检查是否是简单代码（如变量定义、简单语句等）
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

  private calculateBaseOverlap(
    strategy: OverlapStrategy,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
    switch (strategy) {
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

  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    // 从当前块末尾向前搜索，优先选择语义边界
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      if (overlapLines.join('\n').length >= options.maxSize) break;

      const line = lines[i];
      const boundaryScore = this.semanticAnalyzer.calculateBoundaryScore(line, [], currentChunk.metadata.language);

      // 高评分的边界更有可能被包含在重叠中
      if (boundaryScore.score > 0.6 || overlapLines.length < options.minLines) {
        overlapLines.unshift(line);
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'semantic',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk)
    };
  }

  private calculateSyntacticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
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
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'syntactic',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk)
    };
  }

  private calculateSizeBasedOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
    const overlapLines: string[] = [];
    const lines = originalCode.split('\n');

    // 简单按大小计算重叠
    let size = 0;
    for (let i = currentChunk.metadata.endLine - 1; i >= currentChunk.metadata.startLine - 1; i--) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= options.maxSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return {
      content: overlapLines.join('\n'),
      lines: overlapLines.length,
      strategy: 'size-based',
      quality: this.calculateOverlapQuality(overlapLines, currentChunk, nextChunk)
    };
  }

  private calculateHybridOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string,
    options: OverlapOptions
  ): OverlapResult {
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

  private calculateOverlapQuality(
    overlapLines: string[],
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): number {
    // 计算重叠质量评分
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
}