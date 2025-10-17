import { IntelligentSplitter as IntelligentSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '..';
import { BalancedChunker } from '../BalancedChunker';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { SyntaxValidator } from '../utils/SyntaxValidator';
import { SemanticBoundaryAnalyzer } from '../utils/SemanticBoundaryAnalyzer';
import { UnifiedOverlapCalculator } from '../utils/overlap/UnifiedOverlapCalculator';
import { LanguageSpecificConfigManager } from '../config/LanguageSpecificConfigManager';
import { ChunkingPerformanceOptimizer } from '../utils/performance/ChunkingPerformanceOptimizer';

export class IntelligentSplitter implements IntelligentSplitterInterface {
  private options: Required<ChunkingOptions>;
  private balancedChunker?: BalancedChunker;
  private logger?: LoggerService;
  private optimizationLevel: 'low' | 'medium' | 'high' = 'medium';
  private complexityCalculator: ComplexityCalculator;
  private syntaxValidator: SyntaxValidator;
  private semanticBoundaryAnalyzer?: SemanticBoundaryAnalyzer;
  private unifiedOverlapCalculator?: UnifiedOverlapCalculator;
  private languageConfigManager: LanguageSpecificConfigManager;
  private performanceOptimizer: ChunkingPerformanceOptimizer;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
    this.complexityCalculator = new ComplexityCalculator();
    // 创建一个临时的balancedChunker用于syntaxValidator
    const tempBalancedChunker = new BalancedChunker();
    this.syntaxValidator = new SyntaxValidator(tempBalancedChunker);

    // 初始化新组件
    this.semanticBoundaryAnalyzer = new SemanticBoundaryAnalyzer();
    this.unifiedOverlapCalculator = new UnifiedOverlapCalculator({
      maxSize: this.options.overlapSize,
      minLines: 1,
      maxOverlapRatio: 0.3,
      enableASTBoundaryDetection: false
    });
    this.languageConfigManager = new LanguageSpecificConfigManager();
    this.performanceOptimizer = new ChunkingPerformanceOptimizer();
  }

  setBalancedChunker(balancedChunker: BalancedChunker): void {
    this.balancedChunker = balancedChunker;
    // 更新语法验证器使用的balancedChunker
    this.syntaxValidator = new SyntaxValidator(balancedChunker);
  }

  setOptimizationLevel(level: 'low' | 'medium' | 'high'): void {
    this.optimizationLevel = level;
  }

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  setSemanticBoundaryAnalyzer(analyzer: SemanticBoundaryAnalyzer): void {
    this.semanticBoundaryAnalyzer = analyzer;
  }

  setUnifiedOverlapCalculator(calculator: UnifiedOverlapCalculator): void {
    this.unifiedOverlapCalculator = calculator;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any
  ): Promise<CodeChunk[]> {
    const mergedOptions = { ...this.options, ...options };
    return this.createIntelligentChunks(content, language, filePath, mergedOptions, nodeTracker);
  }

  private createIntelligentChunks(
    content: string,
    language: string,
    filePath?: string,
    options: Required<ChunkingOptions> = this.options,
    nodeTracker?: any
  ): CodeChunk[] {
    const startTime = Date.now();
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let currentSize = 0;

    if (!this.balancedChunker) {
      this.balancedChunker = new BalancedChunker(this.logger);
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

    // 性能优化：预分析文件
    const preAnalysisResult = this.performanceOptimizer.preAnalyzeFile(content, language);

    // 获取语言特定配置
    const languageConfig = this.languageConfigManager.getConfig(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 更新符号跟踪
      this.balancedChunker.analyzeLineSymbols(line, i + 1);

      // 使用语义边界评分检查是否应该在逻辑边界处分段
      const shouldSplit = this.shouldSplitWithSemanticBoundary(
        line,
        currentChunk,
        currentSize,
        lineSize,
        this.options.maxChunkSize,
        language,
        lines,
        i
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

          // 使用统一重叠计算
          if (this.unifiedOverlapCalculator) {
            const overlapLines = this.unifiedOverlapCalculator.calculateSmartOverlap(
              currentChunk,
              content,
              currentLine
            );
            currentChunk = overlapLines;
            currentLine = i - overlapLines.length + 1;
            currentSize = overlapLines.join('\n').length;
          } else {
            // 回退到简单重叠（不应发生，因为现在统一使用unifiedOverlapCalculator）
            const simpleOverlapLines = currentChunk.slice(-3); // 取最后3行作为简单重叠
            currentChunk = simpleOverlapLines;
            currentLine = i - simpleOverlapLines.length + 1;
            currentSize = simpleOverlapLines.join('\n').length;
          }
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

    // 记录性能指标
    const endTime = Date.now();
    const duration = endTime - startTime;
    this.logger?.debug(`Performance metrics: processed ${lines.length} lines in ${duration}ms, generated ${chunks.length} chunks`);

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

  /**
   * 使用语义边界评分的分割决策
   */
  private shouldSplitWithSemanticBoundary(
    line: string,
    currentChunk: string[],
    currentSize: number,
    lineSize: number,
    maxChunkSize: number,
    language: string,
    allLines: string[],
    currentIndex: number
  ): boolean {
    // 大小限制检查（优先）
    if (currentSize + lineSize > maxChunkSize) {
      return true;
    }

    // 确保balancedChunker存在
    if (!this.balancedChunker) {
      this.balancedChunker = new BalancedChunker(this.logger);
    }

    // 符号平衡检查 - 只有在符号平衡时才允许分段
    if (!this.balancedChunker.canSafelySplit()) {
      return false;
    }

    // 使用语义边界评分
    if (this.semanticBoundaryAnalyzer) {
      const context = allLines.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
      const boundaryScore = this.semanticBoundaryAnalyzer.calculateBoundaryScore(line, context, language);

      // 如果边界评分足够高，允许分段
      if (boundaryScore.score > 0.7) {
        return currentSize > maxChunkSize * 0.3;
      }

      // 如果边界评分中等，需要更大的块大小
      if (boundaryScore.score > 0.5) {
        return currentSize > maxChunkSize * 0.5;
      }
    }

    // 如果没有语义边界分析器，使用简单的大小检查
    return currentSize > maxChunkSize * 0.8;
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