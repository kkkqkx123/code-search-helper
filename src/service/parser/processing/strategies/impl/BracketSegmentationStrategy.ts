import { injectable, inject } from 'inversify';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../types/SegmentationTypes';
import { CodeChunk, CodeChunkMetadata } from '../../../splitting';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BLOCK_SIZE_LIMITS } from '../../../universal/constants';

/**
 * 括号分段策略
 * 职责：基于括号和XML标签平衡的分段
 */
@injectable()
export class BracketSegmentationStrategy implements ISegmentationStrategy {
  private complexityCalculator: IComplexityCalculator;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
  }

  canHandle(context: SegmentationContext): boolean {
    // 小文件不使用括号分段
    if (context.metadata.isSmallFile) {
      return false;
    }

    // Markdown文件不使用括号分段
    if (context.metadata.isMarkdownFile) {
      return false;
    }

    // 需要启用括号平衡检测
    return context.options.enableBracketBalance;
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath, language } = context;
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
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
        chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR;

      if (shouldSplit) {
        const complexity = this.complexityCalculator.calculate(chunkContent);

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'bracket',
            complexity
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
      const complexity = this.complexityCalculator.calculate(chunkContent);

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'bracket',
          complexity
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
    return 4; // 较低优先级
  }

  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'html', 'xml', 'vue', 'svelte'];
  }

  validateContext(context: SegmentationContext): boolean {
    // 验证上下文是否适合括号分段
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    if (context.metadata.lineCount < 3) {
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
}