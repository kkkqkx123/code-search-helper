import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../types/SegmentationTypes';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionService';
import { CodeChunk, CodeChunkMetadata } from '../../../types/core-types';
import { BLOCK_SIZE_LIMITS } from '../../constants';

/**
 * 括号分段策略
 * 职责：基于括号和XML标签平衡的分段
 */
@injectable()
export class BracketSegmentationStrategy implements ISegmentationStrategy, IProcessingStrategy {
  private logger?: LoggerService;
  private complexityCalculator?: IComplexityCalculator;

  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator?: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
  }

  canHandle(context: SegmentationContext): boolean {
    // 如果禁用了括号平衡，则不处理
    if (!context.options.enableBracketBalance) {
      return false;
    }

    // 不处理Markdown文件
    if (context.metadata.isMarkdownFile) {
      return false;
    }

    // 检查是否是代码文件
    return context.metadata.isCodeFile;
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    this.logger?.debug(`Starting bracket-based segmentation for ${context.filePath || 'unknown file'}`);

    // 验证上下文
    if (this.validateContext && !this.validateContext(context)) {
      this.logger?.warn('Context validation failed for bracket strategy, proceeding anyway');
    } else {
      this.logger?.debug('Context validation passed for bracket strategy');
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
      const shouldSplit = (bracketDepth === 0 && xmlTagDepth === 0 && currentChunk.length >= 5) ||
        currentChunk.length >= context.options.maxLinesPerChunk ||
        chunkContent.length >= context.options.maxChunkSize ||
        chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR;

      if (shouldSplit) {
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: context.language || 'unknown',
            filePath: context.filePath || '',
            type: 'bracket',
            complexity: this.calculateComplexity(chunkContent)
          }
        });

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
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: endLine,
          language: context.language || 'unknown',
          filePath: context.filePath || '',
          type: 'bracket',
          complexity: this.calculateComplexity(chunkContent)
        }
      });
    }

    this.logger?.debug(`Bracket segmentation created ${chunks.length} chunks`);
    return chunks;
  }

  getName(): string {
    return 'bracket';
  }

  getPriority(): number {
    return 4;
  }

  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'xml'];
  }

  /**
   * 验证上下文是否适合括号分段
   */
  validateContext(context: SegmentationContext): boolean {
    // 验证上下文是否适合括号分段
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
   * 检查括号是否平衡
   */
  private isBracketBalanced(content: string): boolean {
    let bracketDepth = 0;
    let xmlTagDepth = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      bracketDepth += this.countOpeningBrackets(line);
      bracketDepth -= this.countClosingBrackets(line);

      xmlTagDepth += this.countOpeningXmlTags(line);
      xmlTagDepth -= this.countClosingXmlTags(line);

      // 如果深度变为负数，说明括号不匹配
      if (bracketDepth < 0 || xmlTagDepth < 0) {
        return false;
      }
    }

    return bracketDepth === 0 && xmlTagDepth === 0;
  }

  /**
   * 找到下一个括号平衡点
   */
  private findNextBalancePoint(
    lines: string[],
    startIndex: number,
    initialBracketDepth: number,
    initialXmlTagDepth: number
  ): number {
    let bracketDepth = initialBracketDepth;
    let xmlTagDepth = initialXmlTagDepth;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      bracketDepth += this.countOpeningBrackets(line);
      bracketDepth -= this.countClosingBrackets(line);

      xmlTagDepth += this.countOpeningXmlTags(line);
      xmlTagDepth -= this.countClosingXmlTags(line);

      if (bracketDepth === 0 && xmlTagDepth === 0) {
        return i;
      }
    }

    return -1; // 没有找到平衡点
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
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

  // IProcessingStrategy implementation
  async execute(filePath: string, content: string, detection: DetectionResult): Promise<{
    chunks: CodeChunk[];
    metadata?: any;
  }> {
    this.logger?.debug(`Executing bracket segmentation strategy for ${filePath}`);

    // Create segmentation context
    const context: SegmentationContext = {
      content,
      filePath,
      language: detection.language,
      options: {
        maxChunkSize: 2000,
        overlapSize: 100,
        maxLinesPerChunk: 50,
        enableBracketBalance: true,
        enableSemanticDetection: false,
        enableCodeOverlap: false,
        enableStandardization: false,
        standardizationFallback: false,
        maxOverlapRatio: 0.1,
        errorThreshold: 1000,
        memoryLimitMB: 100,
        filterConfig: {
          enableSmallChunkFilter: false,
          enableChunkRebalancing: false,
          minChunkSize: 100,
          maxChunkSize: 2000,
        },
        protectionConfig: {
          enableProtection: false,
          protectionLevel: 'low',
        },
      },
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: content.length < 1000,
        isCodeFile: true,
        isMarkdownFile: false,
      },
    };

    const chunks = await this.segment(context);

    return {
      chunks,
      metadata: { strategy: 'BracketSegmentationStrategy' }
    };
  }

  getDescription(): string {
    return 'Uses bracket and XML tag balancing for code segmentation';
  }
}