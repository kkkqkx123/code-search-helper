import { IntelligentSplitter as IntelligentSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { BalancedChunker } from '../BalancedChunker';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { SyntaxValidator } from '../utils/SyntaxValidator';
import { IntelligentSplitterOptimizer } from '../utils/IntelligentSplitterOptimizer';

export class IntelligentSplitter implements IntelligentSplitterInterface {
  private options: Required<ChunkingOptions>;
  private balancedChunker?: BalancedChunker;
  private logger?: LoggerService;
  private optimizationLevel: 'low' | 'medium' | 'high' = 'medium';
  private complexityCalculator: ComplexityCalculator;
  private syntaxValidator: SyntaxValidator;
  private optimizer: IntelligentSplitterOptimizer;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
    this.complexityCalculator = new ComplexityCalculator();
    // 创建一个临时的balancedChunker用于syntaxValidator
    const tempBalancedChunker = new BalancedChunker();
    this.syntaxValidator = new SyntaxValidator(tempBalancedChunker);
    this.optimizer = new IntelligentSplitterOptimizer(tempBalancedChunker);
  }

  setBalancedChunker(balancedChunker: BalancedChunker): void {
    this.balancedChunker = balancedChunker;
    // 更新语法验证器和优化器使用的balancedChunker
    this.syntaxValidator = new SyntaxValidator(balancedChunker);
    this.optimizer = new IntelligentSplitterOptimizer(balancedChunker, this.logger);
  }

  setOptimizationLevel(level: 'low' | 'medium' | 'high'): void {
    this.optimizationLevel = level;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const mergedOptions = { ...this.options, ...options };
    return this.createIntelligentChunks(content, language, filePath, mergedOptions);
  }

  private createIntelligentChunks(
    content: string,
    language: string,
    filePath?: string,
    options: Required<ChunkingOptions> = this.options
  ): CodeChunk[] {
    const startTime = Date.now();
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let currentSize = 0;

    if (!this.balancedChunker) {
      this.balancedChunker = new BalancedChunker(this.logger);
      // 更新optimizer的balancedChunker
      this.optimizer = new IntelligentSplitterOptimizer(this.balancedChunker, this.logger);
    }

    // 获取优化级别
    const optimizationLevel = this.getOptimizationLevel(content);
    this.logger?.debug(`Using optimization level: ${optimizationLevel}`);

    // 重置符号跟踪器
    this.balancedChunker.reset();

    // 根据优化级别决定是否预缓存
    if (optimizationLevel !== 'low') {
      this.balancedChunker.preCacheCommonPatterns();
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 更新符号跟踪
      this.balancedChunker.analyzeLineSymbols(line, i + 1);

      // 检查是否需要在逻辑边界处分段
      const shouldSplit = this.optimizer.shouldSplitAtLineWithSymbols(
        line,
        currentChunk,
        currentSize,
        lineSize,
        this.options.maxChunkSize
      );

      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');

        // 验证分段语法
        if (this.syntaxValidator.validate(chunkContent, language)) {
          const complexity = this.complexityCalculator.calculate(chunkContent);

          const metadata: CodeChunkMetadata = {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language,
            filePath,
            type: 'generic',
            complexity
          };

          chunks.push({
            content: chunkContent,
            metadata
          });

          // 应用智能重叠
          const overlapLines = this.optimizer.calculateSmartOverlap(
            currentChunk,
            content,
            this.options.overlapSize
          );
          currentChunk = overlapLines;
          currentLine = i - overlapLines.length + 1;
          currentSize = overlapLines.join('\n').length;
        } else {
          this.logger?.warn(`Skipping chunk due to syntax validation failure at line ${currentLine}`);
          // 如果验证失败，尝试在下一个安全点分段
          continue;
        }
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // 处理最后的chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');

      // 验证最后一段的语法
      if (this.syntaxValidator.validate(chunkContent, language)) {
        const complexity = this.complexityCalculator.calculate(chunkContent);

        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language,
          filePath,
          type: 'generic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });
      }
    }

    return chunks;
  }

  /**
   * 获取优化级别
   */
  private getOptimizationLevel(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const complexity = this.complexityCalculator.estimate(content);

    if (lines < 100 && complexity < 50) {
      return 'low'; // 使用基本符号跟踪
    } else if (lines < 1000 && complexity < 200) {
      return 'medium'; // 使用缓存优化
    } else {
      return 'high'; // 使用完整优化策略
    }
  }

  getName(): string {
    return 'IntelligentSplitter';
  }

  supportsLanguage(language: string): boolean {
    return true; // 智能分段器支持所有语言
  }

  getPriority(): number {
    return 4; // 较低优先级（作为后备方案）
  }
}