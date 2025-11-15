import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../core/types/ResultTypes';
import { CodeChunk } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { MarkdownChunker } from '../../utils/md/MarkdownChunker';
import { MarkdownChunkingConfig } from '../../utils/md/markdown-rules';

/**
 * Markdown分段策略配置
 */
export interface MarkdownStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最小块大小 */
  minChunkSize?: number;
  /** 最大行数 */
  maxLinesPerChunk?: number;
  /** 是否启用智能合并 */
  enableSmartMerging?: boolean;
  /** 合并阈值 */
  mergeThreshold?: number;
  /** 是否排除代码块大小计算 */
  excludeCodeFromChunkSize?: boolean;
}

/**
 * Markdown分段策略
 * Markdown文件的特殊处理
 */
export class MarkdownSegmentationStrategy extends BaseStrategy {
  protected config: MarkdownStrategyConfig;
  private logger: Logger;
  private markdownChunker: MarkdownChunker;

  constructor(config: MarkdownStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'markdown-segmentation',
      supportedLanguages: ['markdown', 'md'],
      enabled: true,
      description: 'Markdown Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxChunkSize: 3000,
      minChunkSize: 100,
      maxLinesPerChunk: 100,
      enableSmartMerging: true,
      mergeThreshold: 1500,
      ...config
    };
    this.logger = Logger.getInstance();

    // 初始化MarkdownChunker，使用策略配置转换为MarkdownChunkingConfig
    const chunkerConfig: Partial<MarkdownChunkingConfig> = {
      maxChunkSize: this.config.maxChunkSize,
      maxLinesPerChunk: this.config.maxLinesPerChunk,
      enableSemanticMerge: this.config.enableSmartMerging,
      semanticSimilarityThreshold: 0.7, // 默认阈值
      preserveCodeBlocks: true,
      preserveTables: true,
      preserveLists: true,
      preserveStructureIntegrity: true,
      mergeWithHeading: true,
      mergeConsecutiveHeadings: true,
      mergeShortParagraphs: true,
      allowBackwardHeadingMerge: false,
      minChunkSize: 100,
      overlapSize: 200,
      enableOverlap: false // 默认不启用重叠，由策略控制
    };

    this.markdownChunker = new MarkdownChunker(chunkerConfig);
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    const { language, content } = context;

    // 检查是否为Markdown文件
    const isMarkdownByLanguage = !!(language && ['markdown', 'md'].includes(language.toLowerCase()));

    return isMarkdownByLanguage || this.hasMarkdownStructure(content);
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
    this.logger.debug(`Using Markdown segmentation strategy for ${context.filePath}`);

    try {
      // 处理空或null内容情况
      if (context.content === null || context.content === undefined) {
        throw new Error('Content cannot be null or undefined');
      }

      if (!context.content || context.content.trim().length === 0) {
        this.logger.warn('Empty content provided to markdown strategy');
        this.updatePerformanceStats(Date.now() - startTime, true, 0);
        return [];
      }

      // 验证上下文
      const validationResult = this.validateContext(context);
      if (!validationResult) {
        this.logger.warn('Context validation failed for markdown strategy, proceeding anyway');
      } else {
        this.logger.debug('Context validation passed for markdown strategy');
      }

      // 使用MarkdownChunker处理内容
      const chunks = await this.markdownChunker.chunkMarkdown(context.content, context.filePath);

      // MarkdownChunker已经包含了智能合并逻辑，不需要额外的合并步骤
      const finalChunks = chunks;

      this.updatePerformanceStats(Date.now() - startTime, true, finalChunks.length);
      this.logger.debug(`Markdown segmentation created ${finalChunks.length} chunks`);
      return finalChunks;
    } catch (error) {
      this.logger.error(`Markdown segmentation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['markdown', 'md'];
  }

  /**
   * 验证上下文是否适合Markdown分段
   */
  validateContext(context: IProcessingContext): boolean {
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 检查内容是否具有Markdown结构
   */
  private hasMarkdownStructure(content: string): boolean {
    const lines = content.split('\n');

    // 检查是否有Markdown特有的结构
    return lines.some(line => {
      const trimmed = line.trim();
      return /^#{1,6}\s/.test(trimmed) || // 标题
        /^\s*[-*+]\s/.test(trimmed) || // 列表
        /^\s*\d+\.\s/.test(trimmed) || // 有序列表
        /^```/.test(trimmed) || // 代码块
        /\|/.test(trimmed) || // 表格
        /^(-{3,}|_{3,}|\*{3,})\s*$/.test(trimmed); // 分割线
    });
  }

  // 合并相关功能已移至MarkdownChunker中，不再需要这些方法

  /**
   * 获取策略配置
   */
  getConfig(): MarkdownStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<MarkdownStrategyConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新MarkdownChunker的配置
    const chunkerConfig: Partial<MarkdownChunkingConfig> = {
      maxChunkSize: this.config.maxChunkSize,
      maxLinesPerChunk: this.config.maxLinesPerChunk,
      enableSemanticMerge: this.config.enableSmartMerging,
      minChunkSize: this.config.minChunkSize || 100,
      excludeCodeFromChunkSize: this.config.excludeCodeFromChunkSize
    };

    this.markdownChunker.updateConfig(chunkerConfig);
  }
}