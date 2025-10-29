import { injectable, inject } from 'inversify';
import { CodeChunk, CodeChunkMetadata } from '../../../types/core-types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import {
  MarkdownChunkingConfig,
  MarkdownBlockType,
  DEFAULT_MARKDOWN_CONFIG,
  MARKDOWN_SEMANTIC_WEIGHTS,
  MARKDOWN_PATTERNS,
  isMarkdownFile,
  getMarkdownBlockType,
  getHeadingLevel,
  isCodeBlockDelimiter,
  isTableRow,
  isTableSeparator,
  isListItem,
  calculateSemanticSimilarity
} from './markdown-rules';

/**
 * Markdown 专用文本分段器
 * 针对 Markdown 文件的特殊结构和语义进行优化的分段策略
 */
@injectable()
export class MarkdownTextStrategy {
  private config: MarkdownChunkingConfig;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject('unmanaged') config?: Partial<MarkdownChunkingConfig>
  ) {
    this.logger = logger;
    this.config = { ...DEFAULT_MARKDOWN_CONFIG, ...config };
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<MarkdownChunkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): MarkdownChunkingConfig {
    return { ...this.config };
  }

  /**
   * Markdown 专用分段方法
   */
  chunkMarkdown(content: string, filePath?: string): CodeChunk[] {
    try {
      if (!isMarkdownFile(filePath || '')) {
        this.logger?.warn(`File ${filePath} is not recognized as markdown, using generic markdown processing`);
      }

      const blocks = this.parseMarkdownBlocks(content);
      const mergedBlocks = this.mergeRelatedBlocks(blocks);
      const chunks = this.blocksToChunks(mergedBlocks, filePath);

      this.logger?.info(`Markdown chunking completed: ${blocks.length} blocks -> ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger?.error(`Error in markdown chunking: ${error}`);
      // 降级到通用分段方法
      return this.fallbackChunking(content, filePath);
    }
  }

  /**
   * 解析 Markdown 块结构
   */
  private parseMarkdownBlocks(content: string): MarkdownBlock[] {
    const lines = content.split('\n');
    const blocks: MarkdownBlock[] = [];
    let currentBlock: MarkdownBlock | null = null;
    let inCodeBlock = false;
    let inTable = false;
    let lineNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检查代码块状态
      if (isCodeBlockDelimiter(line, inCodeBlock)) {
        inCodeBlock = !inCodeBlock;
      }

      // 检查表格状态
      if (!inCodeBlock && isTableRow(line)) {
        if (!inTable && i > 0 && !isTableSeparator(lines[i - 1])) {
          // 可能是表格的开始
          inTable = true;
        }
      } else if (inTable && !isTableRow(line) && trimmedLine !== '') {
        // 表格结束
        inTable = false;
      }

      // 确定块类型
      const blockType = getMarkdownBlockType(line, inCodeBlock);

      // 如果是空行，结束当前块（除非是代码块或表格）
      if (blockType === MarkdownBlockType.EMPTY && !inCodeBlock && !inTable) {
        if (currentBlock && currentBlock.lines.length > 0) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      // 根据块类型和配置决定是否开始新块
      const shouldStartNewBlock = this.shouldStartNewBlock(blockType, currentBlock, line, i, lines);

      if (shouldStartNewBlock) {
        if (currentBlock && currentBlock.lines.length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: blockType,
          lines: [line],
          startLine: lineNumber,
          endLine: lineNumber,
          content: line
        };
      } else if (currentBlock) {
        // 继续当前块
        currentBlock.lines.push(line);
        currentBlock.endLine = lineNumber;
        currentBlock.content = currentBlock.lines.join('\n');
      } else {
        // 开始新块
        currentBlock = {
          type: blockType,
          lines: [line],
          startLine: lineNumber,
          endLine: lineNumber,
          content: line
        };
      }

      lineNumber++;
    }

    // 处理最后一个块
    if (currentBlock && currentBlock.lines.length > 0) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * 判断是否开始新块
   */
  private shouldStartNewBlock(
    blockType: MarkdownBlockType,
    currentBlock: MarkdownBlock | null,
    line: string,
    lineIndex: number,
    allLines: string[]
  ): boolean {
    if (!currentBlock) return true;

    const currentType = currentBlock.type;

    // 代码块内部不分割
    if (currentType === MarkdownBlockType.CODE_BLOCK) {
      return !isCodeBlockDelimiter(line, true);
    }

    // 表格内部不分割
    if (currentType === MarkdownBlockType.TABLE) {
      return !isTableRow(line) && line.trim() !== '';
    }

    // 标题级别变化时开始新块
    if (blockType === MarkdownBlockType.HEADING) {
      const currentLevel = currentType === MarkdownBlockType.HEADING ?
        getHeadingLevel(currentBlock.lines[0]) : 0;
      const newLevel = getHeadingLevel(line);

      // 同级或更高级别的标题开始新块
      return newLevel <= currentLevel;
    }

    // 不同块类型通常开始新块
    if (blockType !== currentType) {
      // 但段落之间可以合并
      if (blockType === MarkdownBlockType.PARAGRAPH &&
        currentType === MarkdownBlockType.PARAGRAPH) {
        return false;
      }

      // 如果当前块太小，考虑不开始新块，让合并逻辑处理
      const currentLength = currentBlock.lines.join('\n').length;
      if (currentLength < this.config.minChunkSize) {
        return false;
      }

      return true;
    }

    // 同类型块的合并策略
    switch (blockType) {
      case MarkdownBlockType.PARAGRAPH:
        // 检查是否到达段落长度限制
        const currentLength = currentBlock.lines.join('\n').length;
        return currentLength > this.config.maxChunkSize * 0.8;

      case MarkdownBlockType.LIST:
        // 列表项之间可以合并，但不要太长
        const listLength = currentBlock.lines.join('\n').length;
        return listLength > this.config.maxChunkSize * 0.6;

      default:
        return false;
    }
  }

  /**
   * 合并相关块
   */
  private mergeRelatedBlocks(blocks: MarkdownBlock[]): MarkdownBlock[] {
    if (blocks.length === 0) return blocks;

    let currentBlocks = [...blocks]; // 创建副本以避免修改原始数组
    let merged = false;

    // 迭代合并直到没有更多块可以合并
    do {
      merged = false;
      const newBlocks: MarkdownBlock[] = [];
      let i = 0;

      while (i < currentBlocks.length) {
        if (i < currentBlocks.length - 1) {
          const currentBlock = currentBlocks[i];
          const nextBlock = currentBlocks[i + 1];

          // 检查是否可以合并当前块和下一个块
          if (this.shouldMergeBlocks(currentBlock, nextBlock,
            i + 2 < currentBlocks.length ? currentBlocks[i + 2] : null)) {
            // 合并块
            const mergedBlock: MarkdownBlock = {
              type: this.determineMergedBlockType(currentBlock, nextBlock),
              lines: [...currentBlock.lines, ...nextBlock.lines],
              content: currentBlock.content + '\n' + nextBlock.content,
              startLine: currentBlock.startLine,
              endLine: nextBlock.endLine
            };

            newBlocks.push(mergedBlock);
            i += 2; // 跳过下一个块，因为它已经被合并
            merged = true;
          } else {
            newBlocks.push(currentBlock);
            i++;
          }
        } else {
          // 最后一个块，无法合并，直接添加
          newBlocks.push(currentBlocks[i]);
          i++;
        }
      }

      currentBlocks = newBlocks;
    } while (merged); // 继续合并直到没有更多合并发生

    return currentBlocks;
  }

  /**
   * 确定合并后块的类型
   */
  private determineMergedBlockType(currentBlock: MarkdownBlock, nextBlock: MarkdownBlock): MarkdownBlockType {
    // 如果任一块是代码块或表格，优先保留这些特殊类型
    if (currentBlock.type === MarkdownBlockType.CODE_BLOCK || nextBlock.type === MarkdownBlockType.CODE_BLOCK) {
      return MarkdownBlockType.CODE_BLOCK;
    }
    if (currentBlock.type === MarkdownBlockType.TABLE || nextBlock.type === MarkdownBlockType.TABLE) {
      return MarkdownBlockType.TABLE;
    }
    // 如果当前块是标题，优先使用标题类型
    if (currentBlock.type === MarkdownBlockType.HEADING) {
      return MarkdownBlockType.HEADING;
    }
    // 否则使用当前块的类型
    return currentBlock.type;
  }

  /**
   * 判断是否应该合并块
   */
  private shouldMergeBlocks(
    currentBlock: MarkdownBlock,
    nextBlock: MarkdownBlock,
    blockAfterNext: MarkdownBlock | null
  ): boolean {
    const currentType = currentBlock.type;
    const nextType = nextBlock.type;

    const currentSize = currentBlock.content.length;
    const nextSize = nextBlock.content.length;
    const totalSize = currentSize + nextSize;

    // 大小限制检查
    if (totalSize > this.config.maxChunkSize) return false;
    if (currentBlock.lines.length + nextBlock.lines.length > this.config.maxLinesPerChunk) return false;

    // 标题与内容合并
    if (this.config.mergeWithHeading && currentType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 连续标题合并
    if (this.config.mergeConsecutiveHeadings &&
      currentType === MarkdownBlockType.HEADING &&
      nextType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 如果当前块太小，尝试合并不同层级的标题
    if (currentSize < this.config.minChunkSize &&
      currentType === MarkdownBlockType.HEADING &&
      nextType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 代码块保持完整，但如果当前块太小则允许合并
    if (this.config.preserveCodeBlocks &&
      (currentType === MarkdownBlockType.CODE_BLOCK || nextType === MarkdownBlockType.CODE_BLOCK)) {
      // 如果当前块太小，仍然允许合并
      if (currentSize < this.config.minChunkSize) {
        return true;
      }
      return false;
    }

    // 表格保持完整
    if (this.config.preserveTables &&
      (currentType === MarkdownBlockType.TABLE || nextType === MarkdownBlockType.TABLE)) {
      // 如果当前块太小，仍然允许合并
      if (currentSize < this.config.minChunkSize) {
        return true;
      }
      return false;
    }

    // 短段落合并
    if (this.config.mergeShortParagraphs &&
      currentType === MarkdownBlockType.PARAGRAPH &&
      nextType === MarkdownBlockType.PARAGRAPH &&
      currentSize < this.config.minChunkSize) {
      return true;
    }

    // 如果当前块太小，合并标题和段落
    if (currentSize < this.config.minChunkSize &&
      currentType === MarkdownBlockType.HEADING &&
      nextType === MarkdownBlockType.PARAGRAPH) {
      return true;
    }

    // 如果当前块太小，合并段落和标题
    if (currentSize < this.config.minChunkSize &&
      currentType === MarkdownBlockType.PARAGRAPH &&
      nextType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 语义相似性合并
    if (this.config.enableSemanticMerge &&
      currentType === MarkdownBlockType.PARAGRAPH &&
      nextType === MarkdownBlockType.PARAGRAPH) {
      const similarity = calculateSemanticSimilarity(currentBlock.content, nextBlock.content);
      return similarity >= this.config.semanticSimilarityThreshold;
    }

    // 默认不合并不同类型
    return false;
  }

  /**
   * 将块转换为分段
   */
  private blocksToChunks(blocks: MarkdownBlock[], filePath?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    for (const block of blocks) {
      const complexity = this.calculateBlockComplexity(block);

      // 将 MarkdownBlockType 映射到 CodeChunkMetadata 的 type
      const chunkType = this.mapMarkdownTypeToChunkType(block.type);

      const metadata: CodeChunkMetadata = {
        startLine: block.startLine,
        endLine: block.endLine,
        language: 'markdown',
        filePath,
        type: chunkType,
        complexity
      };

      chunks.push({
        content: block.content,
        metadata
      });
    }

    return chunks;
  }

  /**
   * 将 Markdown 块类型映射到 CodeChunk 类型
   */
  private mapMarkdownTypeToChunkType(markdownType: MarkdownBlockType): CodeChunkMetadata['type'] {
    const typeMap: Record<MarkdownBlockType, CodeChunkMetadata['type']> = {
      [MarkdownBlockType.HEADING]: 'heading',
      [MarkdownBlockType.PARAGRAPH]: 'semantic',
      [MarkdownBlockType.CODE_BLOCK]: 'code',
      [MarkdownBlockType.TABLE]: 'code',
      [MarkdownBlockType.LIST]: 'semantic',
      [MarkdownBlockType.BLOCKQUOTE]: 'semantic',
      [MarkdownBlockType.HORIZONTAL_RULE]: 'semantic',
      [MarkdownBlockType.HTML]: 'code',
      [MarkdownBlockType.EMPTY]: undefined
    };

    return typeMap[markdownType] || 'semantic';
  }

  /**
   * 计算块复杂度
   */
  private calculateBlockComplexity(block: MarkdownBlock): number {
    let complexity = MARKDOWN_SEMANTIC_WEIGHTS[block.type] || 1;

    // 基于内容长度调整
    const contentLength = block.content.length;
    complexity += Math.log10(contentLength + 1);

    // 基于行数调整
    const lineCount = block.lines.length;
    complexity += Math.log10(lineCount + 1) * 2;

    // 特殊元素加分
    if (block.type === MarkdownBlockType.HEADING) {
      const level = getHeadingLevel(block.lines[0]);
      complexity += (7 - level) * 2; // H1 最高权重
    }

    if (block.type === MarkdownBlockType.CODE_BLOCK) {
      // 代码块按语言类型加权
      const firstLine = block.lines[0].trim();
      const langMatch = firstLine.match(/^```(\w+)$/);
      if (langMatch && langMatch[1]) {
        complexity += 5; // 有明确语言的代码块
      }
    }

    return Math.round(complexity);
  }

  /**
   * 降级分段方法
   */
  private fallbackChunking(content: string, filePath?: string): CodeChunk[] {
    this.logger?.warn('Using fallback chunking for markdown');

    // 简单的段落分段
    const paragraphs = content.split(/\n\n+/);
    const chunks: CodeChunk[] = [];
    let lineNumber = 1;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      const lines = paragraph.split('\n');
      const complexity = this.calculateFallbackComplexity(paragraph);

      chunks.push({
        content: paragraph,
        metadata: {
          startLine: lineNumber,
          endLine: lineNumber + lines.length - 1,
          language: 'markdown',
          filePath: filePath,
          type: 'semantic',
          complexity
        }
      });

      lineNumber += lines.length + 1; // +1 for empty line
    }

    return chunks;
  }

  /**
   * 计算降级分段的复杂度
   */
  private calculateFallbackComplexity(content: string): number {
    let complexity = 1;

    // 基于长度
    complexity += Math.log10(content.length + 1);

    // 基于标题
    const headingMatches = content.match(/^#{1,6}\s+/gm);
    if (headingMatches) {
      complexity += headingMatches.length * 5;
    }

    // 基于代码块
    if (content.includes('```')) {
      complexity += 3;
    }

    return Math.round(complexity);
  }
}

/**
 * Markdown 块结构
 */
interface MarkdownBlock {
  type: MarkdownBlockType;
  lines: string[];
  content: string;
  startLine: number;
  endLine: number;
}