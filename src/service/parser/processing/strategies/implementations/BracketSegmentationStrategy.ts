import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../core/types/ResultTypes';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { BRACKET_SEGMENTATION_SUPPORTED_LANGUAGES } from '../../../constants/StrategyPriorities';
import { ComplexityCalculator } from '../../../../../utils/parser/ComplexityCalculator';
import { ChunkFactory } from '../../../../../utils/parser/ChunkFactory';

/**
 * 括号分段策略配置
 */
export interface BracketStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最小块大小 */
  minChunkSize?: number;
  /** 最大不平衡括号数 */
  maxImbalance?: number;
  /** 是否启用括号平衡 */
  enableBracketBalance?: boolean;
}

/**
 * 括号分段策略
 * 基于括号和XML标签平衡的分段
 */
export class BracketSegmentationStrategy extends BaseStrategy {
  protected config: BracketStrategyConfig;
  private logger: Logger;

  constructor(config: BracketStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'bracket-segmentation',
      supportedLanguages: BRACKET_SEGMENTATION_SUPPORTED_LANGUAGES,
      enabled: true,
      description: 'Bracket Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxImbalance: 3,
      enableBracketBalance: true,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    // 如果禁用了括号平衡，则不处理
    if (!this.config.enableBracketBalance) {
      return false;
    }

    // 不处理Markdown文件
    if (context.language === 'markdown') {
      return false;
    }

    // 检查是否是代码文件
    return this.isCodeFile(context.language || 'unknown');
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
    this.logger.debug(`Starting bracket-based segmentation for ${context.filePath || 'unknown file'}`);

    try {
      // 验证上下文
      if (!this.validateContext(context)) {
        this.logger.warn('Context validation failed for bracket strategy, proceeding anyway');
      } else {
        this.logger.debug('Context validation passed for bracket strategy');
      }

      const chunks: CodeChunk[] = [];
      const lines = context.content.split('\n');
      let currentChunk: string[] = [];
      let currentLine = 1;
      let bracketDepth = 0;
      let xmlTagDepth = 0;

      // 内存保护：限制处理的行数
      const maxLines = Math.min(lines.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        currentChunk.push(line);

        // 更新括号深度
        bracketDepth += this.countOpeningBrackets(line);
        bracketDepth -= this.countClosingBrackets(line);

        // 更新XML标签深度
        xmlTagDepth += this.countOpeningXmlTags(line);
        xmlTagDepth -= this.countClosingXmlTags(line);

        // 分段条件：括号平衡且达到最小块大小，同时考虑块大小限制
        const chunkContent = currentChunk.join('\n');
        const shouldSplit = this.shouldSplit(
          bracketDepth,
          xmlTagDepth,
          currentChunk,
          chunkContent,
          i,
          lines.length
        );

        if (shouldSplit) {
          chunks.push(ChunkFactory.createBlockChunk(
            chunkContent,
            currentLine,
            currentLine + currentChunk.length - 1,
            context.language || 'unknown',
            {
              filePath: context.filePath,
              type: 'bracket'
            }
          ));

          currentChunk = [];
          currentLine = i + 1;
          bracketDepth = 0;
          xmlTagDepth = 0;
        }
      }

      // 处理剩余内容
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const endLine = context.content === '' ? 0 : currentLine + currentChunk.length - 1;
        chunks.push(ChunkFactory.createBlockChunk(
          chunkContent,
          currentLine,
          endLine,
          context.language || 'unknown',
          {
            filePath: context.filePath,
            type: 'bracket'
          }
        ));
      }

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Bracket segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Bracket segmentation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'xml'];
  }

  /**
   * 验证上下文是否适合括号分段
   */
  validateContext(context: IProcessingContext): boolean {
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    const lines = context.content.split('\n');
    if (lines.length < 3) {
      return false; // 太短的文件不适合括号分段
    }

    // 检查文件是否包含括号或标签
    const hasBrackets = /[{}()\[\]]/.test(context.content);
    const hasXmlTags = /<[^>]+>/.test(context.content);

    return hasBrackets || hasXmlTags;
  }

  /**
   * 判断是否应该分段
   */
  private shouldSplit(
    bracketDepth: number,
    xmlTagDepth: number,
    currentChunk: string[],
    chunkContent: string,
    currentIndex: number,
    totalLines: number
  ): boolean {
    // 括号平衡且达到最小块大小
    const isBalanced = bracketDepth === 0 && xmlTagDepth === 0;
    const hasMinSize = currentChunk.length >= 5 && chunkContent.length >= this.config.minChunkSize!;

    // 块大小限制
    const exceedsMaxSize = chunkContent.length >= this.config.maxChunkSize! ||
      currentChunk.length >= 50;

    // 到达文件末尾
    const isEndOfFile = currentIndex === totalLines - 1;

    // 括号不平衡超过阈值
    const isTooImbalanced = Math.abs(bracketDepth) > this.config.maxImbalance! ||
      Math.abs(xmlTagDepth) > this.config.maxImbalance!;

    return (isBalanced && hasMinSize) || exceedsMaxSize || isEndOfFile || isTooImbalanced;
  }

  /**
   * 计算开括号数量
   */
  private countOpeningBrackets(line: string): number {
    return (line.match(/\(/g) || []).length +
      (line.match(/\{/g) || []).length +
      (line.match(/\[/g) || []).length;
  }

  /**
   * 计算闭括号数量
   */
  private countClosingBrackets(line: string): number {
    return (line.match(/\)/g) || []).length +
      (line.match(/\}/g) || []).length +
      (line.match(/\]/g) || []).length;
  }

  /**
   * 计算开XML标签数量
   */
  private countOpeningXmlTags(line: string): number {
    const matches = line.match(/<[^\/][^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算闭XML标签数量
   */
  private countClosingXmlTags(line: string): number {
    const matches = line.match(/<\/[^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 检查是否为代码文件
   */
  private isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
      'scala', 'html', 'xml', 'json', 'yaml', 'yml'
    ];
    return codeLanguages.includes(language.toLowerCase());
  }


  /**
   * 获取策略配置
   */
  getConfig(): BracketStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<BracketStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}