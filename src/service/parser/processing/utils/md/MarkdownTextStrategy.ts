import { injectable, inject } from 'inversify';
import { CodeChunk } from '../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { SimilarityUtils } from '../../../../similarity/utils/SimilarityUtils';
import {
  MarkdownChunkingConfig,
  MarkdownBlockType,
  DEFAULT_MARKDOWN_CONFIG,
  MARKDOWN_SEMANTIC_WEIGHTS,
  isMarkdownFile,
  getMarkdownBlockType,
  getHeadingLevel,
  isCodeBlockDelimiter,
  isTableRow,
  isTableSeparator,
  isListItem,
  calculateSemanticSimilarity
} from './markdown-rules';
import { BracketSegmentationStrategy } from '../../strategies/implementations/BracketSegmentationStrategy';
import { OverlapCalculator } from '../overlap/OverlapCalculator';

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
  async chunkMarkdown(content: string, filePath?: string): Promise<CodeChunk[]> {
    try {
      if (!isMarkdownFile(filePath || '')) {
        this.logger?.warn(`File ${filePath} is not recognized as markdown, using generic markdown processing`);
      }

      const blocks = this.parseMarkdownBlocks(content);
      const mergedBlocks = await this.mergeRelatedBlocks(blocks);

      // 检查并拆分大块
      const processedBlocks = await this.splitLargeBlocks(mergedBlocks);

      const chunks = this.blocksToChunks(processedBlocks, filePath);

      // 应用重叠处理
      const finalChunks = this.config.enableOverlap ?
        await this.applyOverlap(chunks, content) : chunks;

      this.logger?.info(`Markdown chunking completed: ${blocks.length} blocks -> ${processedBlocks.length} processed blocks -> ${finalChunks.length} chunks`);
      return finalChunks;
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
      const shouldStartNew = newLevel <= currentLevel;

      this.logger?.debug(`Heading level change: current H${currentLevel} -> new H${newLevel}, start new block: ${shouldStartNew}`);

      return shouldStartNew;
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
  private async mergeRelatedBlocks(blocks: MarkdownBlock[]): Promise<MarkdownBlock[]> {
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
          if (await this.shouldMergeBlocks(currentBlock, nextBlock,
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
   *
   * 规则优先级（从高到低）：
   * 1. 硬性限制（大小、行数）- 不可违反(最小约束没有单独实现)
   * 2. 结构完整性保护 - 不可违反
   * 3. 标题单向合并规则 - 高优先级，但可被minChunkSize覆盖
   * 4. 语义和内容相关规则 - 可被更高优先级规则覆盖
   */
  private async shouldMergeBlocks(
    currentBlock: MarkdownBlock,
    nextBlock: MarkdownBlock,
    blockAfterNext: MarkdownBlock | null
  ): Promise<boolean> {
    const currentType = currentBlock.type;
    const nextType = nextBlock.type;

    const currentSize = currentBlock.content.length;
    const nextSize = nextBlock.content.length;
    const totalSize = currentSize + nextSize;

    // 优先级1：硬性限制检查（不可违反）
    if (totalSize > this.config.maxChunkSize) return false;
    if (currentBlock.lines.length + nextBlock.lines.length > this.config.maxLinesPerChunk) return false;

    // 优先级2：结构完整性保护（不可违反）
    if (this.config.preserveStructureIntegrity) {
      // 代码块保持完整
      if (this.config.preserveCodeBlocks &&
        (currentType === MarkdownBlockType.CODE_BLOCK || nextType === MarkdownBlockType.CODE_BLOCK)) {
        // 如果当前块太小，仍然允许合并
        if (currentSize >= this.config.minChunkSize) {
          return false;
        }
      }

      // 表格保持完整
      if (this.config.preserveTables &&
        (currentType === MarkdownBlockType.TABLE || nextType === MarkdownBlockType.TABLE)) {
        // 如果当前块太小，仍然允许合并
        if (currentSize >= this.config.minChunkSize) {
          return false;
        }
      }

      // 列表保持完整
      if (this.config.preserveLists &&
        (currentType === MarkdownBlockType.LIST || nextType === MarkdownBlockType.LIST)) {
        // 如果当前块太小，仍然允许合并
        if (currentSize >= this.config.minChunkSize) {
          return false;
        }
      }
    }

    // 优先级3：标题单向合并规则（高优先级，但可被minChunkSize覆盖）
    // 注意：这个规则在minChunkSize检查之前，确保标题的单向合并优先级
    if (!this.shouldAllowForwardMerge(currentBlock, nextBlock)) {
      // 但是如果当前块太小，我们需要违反这个规则来满足最小大小要求
      if (currentSize >= this.config.minChunkSize) {
        return false;
      }
    }

    // 优先级4：语义和内容相关规则
    // 连续标题合并（高级标题向低级标题合并）- 优先于标题与内容合并
    if (this.config.mergeConsecutiveHeadings &&
      currentType === MarkdownBlockType.HEADING &&
      nextType === MarkdownBlockType.HEADING) {
      // 检查是否允许高级标题向低级标题合并
      if (this.shouldAllowHeadingLevelMerge(currentBlock, nextBlock)) {
        return true;
      }
    }

    // 标题与内容合并（仅向前合并）
    if (this.config.mergeWithHeading && currentType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 短段落合并
    if (this.config.mergeShortParagraphs &&
      currentType === MarkdownBlockType.PARAGRAPH &&
      nextType === MarkdownBlockType.PARAGRAPH &&
      currentSize < this.config.minChunkSize) {
      return true;
    }

    // 语义相似性合并
    if (this.config.enableSemanticMerge &&
      currentType === MarkdownBlockType.PARAGRAPH &&
      nextType === MarkdownBlockType.PARAGRAPH) {
      // 使用新的相似度服务
      const similarity = await this.calculateSemanticSimilarity(currentBlock.content, nextBlock.content);
      return similarity >= this.config.semanticSimilarityThreshold;
    }

    // 优先级5：最小大小保证（最低优先级，确保内容不会过小）
    // 这个规则可以覆盖优先级3的标题单向合并规则
    if (currentSize < this.config.minChunkSize) {
      // 如果当前块太小，尝试与下一个块合并
      // 即使违反标题单向合并规则也要合并，以避免产生过小的块
      return true;
    }

    // 默认不合并不同类型
    return false;
  }

  /**
   * 判断是否允许向前合并（标题块单向合并）
   *
   * 合并规则说明：
   * - "向前合并"指的是当前块与下一个块合并
   * - 标题块可以与后面的内容合并（标题 -> 内容）
   * - 其他块不能与标题块合并（内容 -> 标题），除非配置允许
   * - 高级标题可以与低级标题合并（H1 -> H2），但低级标题不能与高级标题合并（H2 -> H1）
   */
  private shouldAllowForwardMerge(currentBlock: MarkdownBlock, nextBlock: MarkdownBlock): boolean {
    const currentType = currentBlock.type;
    const nextType = nextBlock.type;

    // 标题块可以与后面的内容合并（标题 -> 内容）
    if (currentType === MarkdownBlockType.HEADING) {
      return true;
    }

    // 其他块不能与标题块向前合并（内容 -> 标题），除非配置允许
    if (!this.config.allowBackwardHeadingMerge && nextType === MarkdownBlockType.HEADING) {
      return false;
    }

    return true;
  }

  /**
   * 检查标题层级权重差异是否过大
   */
  private isHeadingLevelDifferenceTooLarge(currentBlock: MarkdownBlock, nextBlock: MarkdownBlock): boolean {
    if (currentBlock.type !== MarkdownBlockType.HEADING || nextBlock.type !== MarkdownBlockType.HEADING) {
      return false;
    }

    const currentLevel = getHeadingLevel(currentBlock.lines[0]);
    const nextLevel = getHeadingLevel(nextBlock.lines[0]);

    // 检查权重差异
    if (currentLevel > 0 && nextLevel > 0 && this.config.headingLevelWeights) {
      const currentWeight = this.config.headingLevelWeights[currentLevel - 1] || 1;
      const nextWeight = this.config.headingLevelWeights[nextLevel - 1] || 1;

      // 权重差异超过2倍认为差异过大
      const ratio = Math.max(currentWeight, nextWeight) / Math.min(currentWeight, nextWeight);
      const isTooLarge = ratio > 2;

      // 添加调试日志
      this.logger?.debug(`Heading weight check: H${currentLevel}(${currentWeight}) vs H${nextLevel}(${nextWeight}), ratio: ${ratio}, too large: ${isTooLarge}`);

      return isTooLarge;
    }

    return false;
  }

  /**
   * 判断是否允许标题层级合并（高级标题向低级标题合并）
   *
   * 规则：
   * - 高级标题（如H1）可以向低级标题（如H2）合并
   * - 低级标题（如H2）不能向高级标题（如H1）合并
   * - 同级标题可以合并
   * - 权重差异过大的标题不能合并
   */
  private shouldAllowHeadingLevelMerge(currentBlock: MarkdownBlock, nextBlock: MarkdownBlock): boolean {
    if (currentBlock.type !== MarkdownBlockType.HEADING || nextBlock.type !== MarkdownBlockType.HEADING) {
      return false;
    }

    const currentLevel = getHeadingLevel(currentBlock.lines[0]);
    const nextLevel = getHeadingLevel(nextBlock.lines[0]);

    // 检查权重差异是否过大
    if (this.isHeadingLevelDifferenceTooLarge(currentBlock, nextBlock)) {
      this.logger?.debug(`Heading merge blocked due to weight difference: H${currentLevel} vs H${nextLevel}`);
      return false;
    }

    // 高级标题可以向低级标题合并（H1 -> H2, H2 -> H3, 等）
    // 同级标题也可以合并（H2 -> H2）
    // 低级标题不能向高级标题合并（H2 -> H1 不允许）
    const allowMerge = currentLevel <= nextLevel;

    this.logger?.debug(`Heading level merge check: H${currentLevel} -> H${nextLevel}, allowed: ${allowMerge}`);

    return allowMerge;
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

      const metadata: any = {
        startLine: block.startLine,
        endLine: block.endLine,
        language: 'markdown',
        filePath,
        type: chunkType,
        complexity,
        strategy: 'markdown',
        timestamp: Date.now(),
        size: block.content.length,
        lineCount: block.lines.length
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
  private mapMarkdownTypeToChunkType(markdownType: MarkdownBlockType): any {
    const typeMap: Record<MarkdownBlockType, any> = {
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
          complexity,
          strategy: 'markdown',
          timestamp: Date.now(),
          size: paragraph.length,
          lineCount: lines.length
        } as any
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

  /**
   * 拆分大块
   */
  private async splitLargeBlocks(blocks: MarkdownBlock[]): Promise<MarkdownBlock[]> {
    const result: MarkdownBlock[] = [];

    for (const block of blocks) {
      // 检查是否需要拆分
      if (this.shouldSplitBlock(block)) {
        const splitBlocks = await this.splitBlock(block);
        result.push(...splitBlocks);
      } else {
        result.push(block);
      }
    }

    return result;
  }

  /**
   * 判断是否需要拆分块
   */
  private shouldSplitBlock(block: MarkdownBlock): boolean {
    // 检查大小限制
    if (block.content.length > this.config.maxChunkSize) {
      return true;
    }

    // 检查行数限制
    if (block.lines.length > this.config.maxLinesPerChunk) {
      return true;
    }

    // 对于代码块，如果内容超过最大大小的80%，也考虑拆分
    if (block.type === MarkdownBlockType.CODE_BLOCK &&
      block.content.length > this.config.maxChunkSize * 0.8) {
      return true;
    }

    this.logger?.debug(`Block does not need splitting: size=${block.content.length}, lines=${block.lines.length}, type=${block.type}`);
    return false;
  }

  /**
   * 拆分块
   */
  private async splitBlock(block: MarkdownBlock): Promise<MarkdownBlock[]> {
    switch (block.type) {
      case MarkdownBlockType.CODE_BLOCK:
        return await this.splitCodeBlock(block);
      case MarkdownBlockType.TABLE:
        return this.splitTableBlock(block);
      case MarkdownBlockType.LIST:
        return this.splitListBlock(block);
      default:
        return this.splitGenericBlock(block);
    }
  }

  /**
   * 拆分代码块（复用BracketSegmentationStrategy）
   */
  private async splitCodeBlock(block: MarkdownBlock): Promise<MarkdownBlock[]> {
    try {
      // 提取代码内容（去除```标记）
      const lines = block.lines;
      let contentLines = lines;
      let language = '';

      // 检查是否有语言标记
      if (lines.length > 0 && lines[0].trim().startsWith('```')) {
        const langMatch = lines[0].trim().match(/^```(\w*)$/);
        if (langMatch) {
          language = langMatch[1];
          contentLines = lines.slice(1, -1); // 去除首尾的```标记
        }
      }

      const content = contentLines.join('\n');

      // 创建BracketStrategyConfig配置
      const bracketConfig = {
        name: 'bracket-segmentation',
        supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'xml'],
        enabled: true,
        maxChunkSize: this.config.maxChunkSize * 0.8,
        minChunkSize: this.config.minChunkSize,
        maxImbalance: 3,
        enableBracketBalance: true
      };

      // 使用BracketSegmentationStrategy进行拆分
      const bracketSegmentationStrategy = new BracketSegmentationStrategy(bracketConfig);

      // 创建上下文并执行策略
      const context = {
        content,
        language: language || 'text',
        filePath: undefined,
        metadata: {
          isStructuredFile: true,
          isCodeFile: true
        },
        config: {
          basic: {
            maxChunkSize: this.config.maxChunkSize * 0.8,
            minChunkSize: this.config.minChunkSize
          }
        }
      } as any;

      const strategyChunks = await bracketSegmentationStrategy.process(context);

      // 转换回MarkdownBlock格式
      const result: MarkdownBlock[] = [];
      let currentLine = block.startLine + 1; // 跳过开头的```

      for (const chunk of strategyChunks) {
        const chunkLines = chunk.content.split('\n');
        const blockContent = '```' + (language ? language : '') + '\n' +
          chunk.content + '\n```';

        result.push({
          type: MarkdownBlockType.CODE_BLOCK,
          lines: ['```' + (language ? language : ''), ...chunkLines, '```'],
          content: blockContent,
          startLine: currentLine,
          endLine: currentLine + chunkLines.length + 1
        });

        currentLine += chunkLines.length + 2; // +2 for ``` markers
      }

      return result;
    } catch (error) {
      this.logger?.error(`Error splitting code block: ${error}`);
      return [block]; // 返回原块作为降级
    }
  }

  /**
   * 拆分表格块
   */
  private splitTableBlock(block: MarkdownBlock): MarkdownBlock[] {
    const lines = block.lines;
    const result: MarkdownBlock[] = [];

    // 找到表格分隔符位置
    let separatorIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (isTableSeparator(lines[i])) {
        separatorIndex = i;
        break;
      }
    }

    if (separatorIndex === -1) {
      return [block]; // 没有找到分隔符，返回原块
    }

    // 保留表头和分隔符
    const headerLines = lines.slice(0, separatorIndex + 1);
    const dataLines = lines.slice(separatorIndex + 1);

    // 计算每个子块的大小
    const maxRowsPerChunk = Math.floor(this.config.maxLinesPerChunk / 2); // 预留空间
    const chunkSize = Math.min(maxRowsPerChunk, Math.ceil(dataLines.length / Math.ceil(dataLines.length / maxRowsPerChunk)));

    let currentLine = block.startLine;
    let currentChunk = 0;

    while (currentChunk < dataLines.length) {
      const chunkDataLines = dataLines.slice(currentChunk, currentChunk + chunkSize);
      const chunkLines = [...headerLines, ...chunkDataLines];
      const chunkContent = chunkLines.join('\n');

      result.push({
        type: MarkdownBlockType.TABLE,
        lines: chunkLines,
        content: chunkContent,
        startLine: currentLine,
        endLine: currentLine + chunkLines.length - 1
      });

      currentLine += chunkLines.length;
      currentChunk += chunkSize;
    }

    return result;
  }

  /**
   * 拆分列表块
   */
  private splitListBlock(block: MarkdownBlock): MarkdownBlock[] {
    const lines = block.lines;
    const result: MarkdownBlock[] = [];

    // 按列表项分组
    const listItems: string[][] = [];
    let currentItem: string[] = [];

    for (const line of lines) {
      if (isListItem(line)) {
        if (currentItem.length > 0) {
          listItems.push(currentItem);
        }
        currentItem = [line];
      } else {
        // 续行
        currentItem.push(line);
      }
    }

    if (currentItem.length > 0) {
      listItems.push(currentItem);
    }

    // 计算每个子块的大小
    const maxItemsPerChunk = Math.ceil(this.config.maxLinesPerChunk / 2); // 预留空间
    let currentLine = block.startLine;

    for (let i = 0; i < listItems.length; i += maxItemsPerChunk) {
      const chunkItems = listItems.slice(i, i + maxItemsPerChunk);
      const chunkLines = chunkItems.flat();
      const chunkContent = chunkLines.join('\n');

      result.push({
        type: MarkdownBlockType.LIST,
        lines: chunkLines,
        content: chunkContent,
        startLine: currentLine,
        endLine: currentLine + chunkLines.length - 1
      });

      currentLine += chunkLines.length;
    }

    return result.length > 0 ? result : [block];
  }

  /**
   * 拆分通用块
   */
  private splitGenericBlock(block: MarkdownBlock): MarkdownBlock[] {
    const lines = block.lines;
    const result: MarkdownBlock[] = [];

    const maxLinesPerChunk = this.config.maxLinesPerChunk;
    let currentLine = block.startLine;

    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, i + maxLinesPerChunk);
      const chunkContent = chunkLines.join('\n');

      result.push({
        type: block.type,
        lines: chunkLines,
        content: chunkContent,
        startLine: currentLine,
        endLine: currentLine + chunkLines.length - 1
      });

      currentLine += chunkLines.length;
    }

    return result;
  }

  /**
   * 应用重叠处理
   */
  private async applyOverlap(chunks: CodeChunk[], originalContent: string): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    try {
      const overlapCalculator = new OverlapCalculator({
        maxSize: this.config.overlapSize || 200,
        minLines: 1,
        maxOverlapRatio: 0.3,
        enableASTBoundaryDetection: false, // Markdown不需要AST边界检测
        logger: this.logger
      });

      // 应用重叠，但保护标题块
      const result: CodeChunk[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const currentChunk = chunks[i];
        const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : null;

        if (nextChunk && this.shouldAddOverlap(currentChunk, nextChunk)) {
          // 计算重叠
          const overlapResult = await overlapCalculator.calculateOptimalOverlap(
            currentChunk,
            nextChunk,
            originalContent,
            {
              maxSize: this.config.overlapSize || 200,
              similarityThreshold: 0.8
            }
          );

          // 添加重叠内容到当前块
          if (overlapResult.content && overlapResult.content.trim()) {
            const overlappedChunk = {
              ...currentChunk,
              content: currentChunk.content + '\n' + overlapResult.content,
              metadata: {
                ...currentChunk.metadata,
                endLine: currentChunk.metadata.endLine + overlapResult.lines
              }
            };
            result.push(overlappedChunk);
          } else {
            result.push(currentChunk);
          }
        } else {
          result.push(currentChunk);
        }
      }

      return result;
    } catch (error) {
      this.logger?.error(`Error applying overlap: ${error}`);
      return chunks; // 返回原始块作为降级
    }
  }

  /**
   * 判断是否应该添加重叠（标题块保护）
   */
  private shouldAddOverlap(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 如果下一个块是标题，不添加重叠
    if (nextChunk.metadata.type === ('heading' as any) || nextChunk.metadata.type === ('function' as any) || nextChunk.metadata.type === ('class' as any)) {
      return false;
    }

    // 如果当前块是标题且配置不允许向后合并，不添加重叠
    if ((currentChunk.metadata.type === ('heading' as any) || currentChunk.metadata.type === ('function' as any) || currentChunk.metadata.type === ('class' as any)) && !this.config.allowBackwardHeadingMerge) {
      return false;
    }

    return true;
  }

  /**
   * 计算语义相似度（使用新的相似度服务）
   */
  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // 使用新的相似度服务，指定文档类型
      const similarityUtils = SimilarityUtils.getInstance();
      if (!similarityUtils) {
        throw new Error('SimilarityUtils instance not available. Please ensure it has been properly initialized.');
      }
      return await similarityUtils.calculateSimilarity(text1, text2, {
        contentType: 'document',
        strategy: 'keyword' // 对于Markdown，使用关键词策略更合适
      });
    } catch (error) {
      // 如果新服务失败，回退到原始实现
      this.logger?.warn('Failed to use new similarity service, falling back to original implementation:', error);
      return calculateSemanticSimilarity(text1, text2);
    }
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