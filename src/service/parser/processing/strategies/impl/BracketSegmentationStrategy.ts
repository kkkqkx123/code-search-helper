import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult } from '../../../universal/UnifiedDetectionCenter';
import { CodeChunk, CodeChunkMetadata } from '../../../splitting';
import { BLOCK_SIZE_LIMITS } from '../../../universal/constants';

/**
 * 括号分段策略
 * 职责：基于括号和XML标签平衡的分段
 */
@injectable()
export class BracketSegmentationStrategy implements IProcessingStrategy {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Bracket segmentation strategy for ${filePath}`);
    
    // 验证上下文
    const validationResult = this.validateContext(content, detection.language);
    if (!validationResult) {
      this.logger?.warn('Context validation failed for bracket strategy, proceeding anyway');
    } else {
      this.logger?.debug('Context validation passed for bracket strategy');
    }
    
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
        currentChunk.length >= 50 ||
        chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR;

      if (shouldSplit) {
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: detection.language || 'unknown',
            filePath,
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
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: detection.language || 'unknown',
          filePath,
          type: 'bracket',
          complexity: this.calculateComplexity(chunkContent)
        }
      });
    }

    this.logger?.debug(`Bracket segmentation created ${chunks.length} chunks`);
    return { chunks, metadata: { strategy: 'BracketSegmentationStrategy' } };
  }

  getName(): string {
    return 'BracketSegmentationStrategy';
  }

  getDescription(): string {
    return 'Uses bracket and XML tag balance for code segmentation';
  }

  /**
   * 验证上下文是否适合括号分段
   */
  private validateContext(content: string, language?: string): boolean {
    // 验证上下文是否适合括号分段
    if (!content || content.trim().length === 0) {
      return false;
    }

    const lines = content.split('\n');
    if (lines.length < 3) {
      return false; // 太短的文件不适合括号分段
    }

    // 检查文件是否包含括号或标签
    const hasBrackets = /[{}()\[\]]/.test(content);
    const hasXmlTags = /<[^>]+>/.test(content);

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
}