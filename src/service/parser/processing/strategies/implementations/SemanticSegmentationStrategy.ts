import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../types/Processing';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * 语义分段策略配置
 */
export interface SemanticStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最小块大小 */
  minChunkSize?: number;
  /** 语义阈值 */
  semanticThreshold?: number;
  /** 最大行数 */
  maxLinesPerChunk?: number;
  /** 最小行数 */
  minLinesPerChunk?: number;
  /** 是否启用精细模式 */
  enableFineMode?: boolean;
}

/**
 * 语义分段策略
 * 基于语义边界进行分段，支持普通和精细两种模式
 */
export class SemanticSegmentationStrategy extends BaseStrategy {
  protected config: SemanticStrategyConfig;
  private logger: Logger;

  constructor(config: SemanticStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'semantic-segmentation',
      priority: 40,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'Semantic Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxChunkSize: 2000,
      minChunkSize: 200,
      semanticThreshold: 2000,
      maxLinesPerChunk: 50,
      minLinesPerChunk: 5,
      enableFineMode: true,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    const { content } = context;

    // 验证内容是否适合语义分段
    if (!content || content.trim().length === 0) {
      return false;
    }

    const lineCount = content.split('\n').length;
    if (lineCount < 5) {
      return false; // 太短的文件不适合语义分段
    }

    return true;
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Using Semantic segmentation strategy for ${context.filePath}`);

    try {
      // 验证上下文
      const validationResult = this.validateContext(context);
      if (!validationResult) {
        this.logger.warn('Context validation failed for semantic strategy, proceeding anyway');
      } else {
        this.logger.debug('Context validation passed for semantic strategy');
      }

      const chunks: CodeChunk[] = [];
      const lines = context.content.split('\n');

      let currentChunk: string[] = [];
      let currentLine = 1;
      let semanticScore = 0;

      // 检查是否使用精细模式
      const isFineMode = this.isFineMode(context.content, context.language);

      // 根据模式设置参数
      const maxChunkSize = isFineMode ? 800 : this.config.maxChunkSize!;
      const maxLinesPerChunk = isFineMode ? 20 : this.config.maxLinesPerChunk!;
      const semanticThreshold = isFineMode ? 1000 : this.config.semanticThreshold!;
      const minChunkLines = isFineMode ? 3 : this.config.minLinesPerChunk!;

      // 内存保护：限制处理的行数
      const maxLines = Math.min(lines.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 计算语义分数
        const lineScore = this.calculateSemanticScore(trimmedLine, context.language);
        semanticScore += lineScore;

        // 决定是否分段
        const shouldSplit = this.shouldSplitAtSemanticBoundary(
          trimmedLine,
          currentChunk,
          semanticScore,
          i,
          maxLines,
          maxChunkSize,
          maxLinesPerChunk,
          semanticThreshold,
          minChunkLines
        );

        if (shouldSplit && currentChunk.length > 0) {
          const chunkContent = currentChunk.join('\n');
          chunks.push(this.createChunk(
            chunkContent,
            currentLine,
            currentLine + currentChunk.length - 1,
            context.language || 'unknown',
            ChunkType.GENERIC,
            {
              filePath: context.filePath,
              complexity: this.calculateComplexity(chunkContent),
              fineMode: isFineMode,
              type: 'semantic'
            }
          ));

          currentChunk = [];
          currentLine = i + 1;
          semanticScore = 0;
        }

        currentChunk.push(line);
      }

      // 处理最后的chunk
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        chunks.push(this.createChunk(
          chunkContent,
          currentLine,
          currentLine + currentChunk.length - 1,
          context.language || 'unknown',
          ChunkType.GENERIC,
          {
            filePath: context.filePath,
            complexity: this.calculateComplexity(chunkContent),
            fineMode: isFineMode,
            type: 'semantic'
          }
        ));
      }

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Semantic segmentation (${isFineMode ? 'fine' : 'normal'} mode) created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Semantic segmentation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    // 语义策略支持大多数编程语言
    return [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
  }

  /**
   * 验证上下文是否适合语义分段
   */
  validateContext(context: IProcessingContext): boolean {
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    const lineCount = context.content.split('\n').length;
    if (lineCount < 5) {
      return false; // 太短的文件不适合语义分段
    }

    return true;
  }

  /**
   * 检查是否应该使用精细模式
   */
  private isFineMode(content: string, language?: string): boolean {
    if (!this.config.enableFineMode) {
      return false;
    }

    // 根据文件大小自动决定：中等大小文件使用精细模式
    const lineCount = content.split('\n').length;
    return lineCount >= 50 && lineCount <= 500;
  }

  /**
   * 计算语义分数
   */
  private calculateSemanticScore(line: string, language?: string): number {
    let score = line.length; // 基础分数

    // 语言特定的关键字权重
    if (language === 'typescript' || language === 'javascript') {
      if (line.match(/\b(function|class|interface|const|let|var|import|export)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
      if (line.match(/\b(return|break|continue|throw|new)\b/)) score += 4;
    } else if (language === 'python') {
      if (line.match(/\b(def|class|import|from|if|else|elif|for|while|try|except|finally)\b/)) score += 8;
      if (line.match(/\b(return|break|continue|raise|yield|async|await)\b/)) score += 4;
    } else if (language === 'java') {
      if (line.match(/\b(public|private|protected|static|final|class|interface)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
    }

    // 通用结构复杂度
    score += (line.match(/[{}]/g) || []).length * 3;
    score += (line.match(/[()]/g) || []).length * 2;
    score += (line.match(/[\[\]]/g) || []).length * 1.5;

    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) score *= 0.3;
    if (line.trim() === '') score = 1;

    return score;
  }

  /**
   * 判断是否应该在语义边界处分段
   */
  private shouldSplitAtSemanticBoundary(
    line: string,
    currentChunk: string[],
    semanticScore: number,
    currentIndex: number,
    maxLines: number,
    maxChunkSize: number,
    maxLinesPerChunk: number,
    semanticThreshold: number,
    minChunkLines: number
  ): boolean {
    // 大小限制检查
    if (semanticScore > semanticThreshold) {
      return true;
    }

    // 块大小限制检查
    const chunkContent = currentChunk.join('\n');
    if (chunkContent.length > maxChunkSize || currentChunk.length > maxLinesPerChunk) {
      return true;
    }

    // 逻辑边界检查
    const trimmedLine = line.trim();

    // 函数/类定义结束
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > minChunkLines) {
      return true;
    }

    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/) && currentChunk.length > Math.max(3, minChunkLines - 2)) {
      return true;
    }

    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > minChunkLines) {
      return true;
    }

    // 注释行作为分割点
    if ((trimmedLine.match(/^\s*\//) || trimmedLine.match(/^\s*\/\*/) ||
      trimmedLine.match(/^\s*\*/) || trimmedLine.match(/^\s*#/)) &&
      currentChunk.length > Math.max(3, minChunkLines - 2)) {
      return true;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 获取策略配置
   */
  getConfig(): SemanticStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<SemanticStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}