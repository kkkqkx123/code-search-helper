import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult, ChunkType } from '../../core/types/ResultTypes';
import { CodeChunk } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * Markdown分段策略配置
 */
export interface MarkdownStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最大行数 */
  maxLinesPerChunk?: number;
  /** 是否启用智能合并 */
  enableSmartMerging?: boolean;
  /** 合并阈值 */
  mergeThreshold?: number;
}

/**
 * Markdown分段策略
 * Markdown文件的特殊处理
 */
export class MarkdownSegmentationStrategy extends BaseStrategy {
  protected config: MarkdownStrategyConfig;
  private logger: Logger;

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
      maxLinesPerChunk: 100,
      enableSmartMerging: true,
      mergeThreshold: 1500,
      ...config
    };
    this.logger = Logger.getInstance();
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

      const chunks: CodeChunk[] = [];
      const lines = context.content.split('\n');

      let currentChunk: string[] = [];
      let currentLine = 1;
      let currentSection = '';
      let inCodeBlock = false;
      let codeBlockLang = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 检查代码块开始/结束
        if (trimmedLine.startsWith('```')) {
          if (!inCodeBlock) {
            // 代码块开始
            inCodeBlock = true;
            codeBlockLang = trimmedLine.substring(3).trim();
          } else {
            // 代码块结束
            inCodeBlock = false;
            codeBlockLang = '';
          }
        }

        // 检查这一行本身是否超过限制
        if (line.length > this.config.maxChunkSize!) {
          // 这一行本身太长，先保存当前accumulated chunk（如果有的话）
          if (currentChunk.length > 0) {
            const contentToSave = currentChunk.join('\n');
            if (contentToSave.trim().length > 0) {
              chunks.push(this.createChunk(
                contentToSave,
                currentLine,
                currentLine + currentChunk.length - 1,
                context.language || 'markdown',
                this.getChunkType(currentSection, inCodeBlock),
                {
                  filePath: context.filePath,
                  complexity: this.calculateComplexity(contentToSave),
                  section: currentSection || undefined,
                  codeLanguage: codeBlockLang || undefined
                }
              ));
            }
            currentLine += currentChunk.length;
          }
          // 强制分割这个很长的行
          const parts = this.splitLongLine(line, this.config.maxChunkSize!);
          for (const part of parts) {
            if (part.trim().length > 0) {
              chunks.push(this.createChunk(
                part,
                i + 1,
                i + 1,
                context.language || 'markdown',
                this.getChunkType(currentSection, inCodeBlock),
                {
                  filePath: context.filePath,
                  complexity: this.calculateComplexity(part),
                  section: currentSection || undefined,
                  codeLanguage: codeBlockLang || undefined
                }
              ));
            }
          }
          currentChunk = [];
          currentLine = i + 2;
        } else {
          // 首先检查添加当前行是否会超过限制
          const testChunk = [...currentChunk, line];
          const testContent = testChunk.join('\n');
          const wouldExceedSize = testContent.length > this.config.maxChunkSize!;
          const wouldExceedLines = testChunk.length > this.config.maxLinesPerChunk!;

          // 如果会超过限制，先保存当前chunk
          if ((wouldExceedSize || wouldExceedLines) && currentChunk.length > 0) {
            const contentToSave = currentChunk.join('\n');
            if (contentToSave.trim().length > 0) {
              chunks.push(this.createChunk(
                contentToSave,
                currentLine,
                currentLine + currentChunk.length - 1,
                context.language || 'markdown',
                this.getChunkType(currentSection, inCodeBlock),
                {
                  filePath: context.filePath,
                  complexity: this.calculateComplexity(contentToSave),
                  section: currentSection || undefined,
                  codeLanguage: codeBlockLang || undefined
                }
              ));
            }
            currentChunk = [line];
            currentLine = i + 1;
          } else {
            // 添加当前行
            currentChunk.push(line);

            // 检查是否应该分段（基于markdown结构）
            const shouldSplit = this.shouldSplitMarkdown(
              trimmedLine,
              currentChunk,
              inCodeBlock,
              i,
              lines.length
            );

            if (shouldSplit && currentChunk.length > 0) {
              const chunkContent = currentChunk.join('\n');
              // 如果在Markdown边界处分段且不超过限制，保存chunk
              if (chunkContent.trim().length > 0) {
                chunks.push(this.createChunk(
                  chunkContent,
                  currentLine,
                  currentLine + currentChunk.length - 1,
                  context.language || 'markdown',
                  this.getChunkType(currentSection, inCodeBlock),
                  {
                    filePath: context.filePath,
                    complexity: this.calculateComplexity(chunkContent),
                    section: currentSection || undefined,
                    codeLanguage: codeBlockLang || undefined
                  }
                ));
              }
              currentChunk = [];
              currentLine = i + 1;
            } else if (currentChunk.length > this.config.maxLinesPerChunk!) {
              // chunk已经达到最大行数，强制分段
              // 移除最后添加的行，保存chunk，然后从该行重新开始
              currentChunk.pop();
              const contentToSave = currentChunk.join('\n');
              if (contentToSave.trim().length > 0) {
                chunks.push(this.createChunk(
                  contentToSave,
                  currentLine,
                  currentLine + currentChunk.length - 1,
                  context.language || 'markdown',
                  this.getChunkType(currentSection, inCodeBlock),
                  {
                    filePath: context.filePath,
                    complexity: this.calculateComplexity(contentToSave),
                    section: currentSection || undefined,
                    codeLanguage: codeBlockLang || undefined
                  }
                ));
              }
              currentChunk = [line];
              currentLine = i;
            }
          }
        }

        // 更新当前章节
        if (this.isSectionHeader(trimmedLine) && currentChunk.length === 1) {
          currentSection = this.extractSectionTitle(trimmedLine);
        }
      }

      // 处理最后的chunk
      let lastChunkStartLine = currentLine;
      while (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const exceedsSize = chunkContent.length > this.config.maxChunkSize!;
        const exceedsLines = currentChunk.length > this.config.maxLinesPerChunk!;

        if (!exceedsSize && !exceedsLines) {
          // chunk符合限制，保存它
          if (chunkContent.trim().length > 0) {
            chunks.push(this.createChunk(
              chunkContent,
              lastChunkStartLine,
              lastChunkStartLine + currentChunk.length - 1,
              context.language || 'markdown',
              this.getChunkType(currentSection, inCodeBlock),
              {
                filePath: context.filePath,
                complexity: this.calculateComplexity(chunkContent),
                section: currentSection || undefined,
                codeLanguage: codeBlockLang || undefined
              }
            ));
          }
          break;
        } else if (currentChunk.length > 1) {
          // 超过限制且有多行，移除最后一行
          const lastLine = currentChunk.pop()!;
          const contentToSave = currentChunk.join('\n');
          if (contentToSave.trim().length > 0) {
            chunks.push(this.createChunk(
              contentToSave,
              lastChunkStartLine,
              lastChunkStartLine + currentChunk.length - 1,
              context.language || 'markdown',
              this.getChunkType(currentSection, inCodeBlock),
              {
                filePath: context.filePath,
                complexity: this.calculateComplexity(contentToSave),
                section: currentSection || undefined,
                codeLanguage: codeBlockLang || undefined
              }
            ));
          }
          lastChunkStartLine += currentChunk.length;
          currentChunk = [lastLine];
        } else {
          // 只有一行
          const singleLine = currentChunk[0];
          if (singleLine.length > this.config.maxChunkSize!) {
            // 这一行本身超过限制，需要强制分割
            const parts = this.splitLongLine(singleLine, this.config.maxChunkSize!);
            for (const part of parts) {
              if (part.trim().length > 0) {
                chunks.push(this.createChunk(
                  part,
                  lastChunkStartLine,
                  lastChunkStartLine,
                  context.language || 'markdown',
                  this.getChunkType(currentSection, inCodeBlock),
                  {
                    filePath: context.filePath,
                    complexity: this.calculateComplexity(part),
                    section: currentSection || undefined,
                    codeLanguage: codeBlockLang || undefined
                  }
                ));
              }
            }
          } else {
            // 单行且符合限制，保存它
            if (chunkContent.trim().length > 0) {
              chunks.push(this.createChunk(
                chunkContent,
                lastChunkStartLine,
                lastChunkStartLine,
                context.language || 'markdown',
                this.getChunkType(currentSection, inCodeBlock),
                {
                  filePath: context.filePath,
                  complexity: this.calculateComplexity(chunkContent),
                  section: currentSection || undefined,
                  codeLanguage: codeBlockLang || undefined
                }
              ));
            }
          }
          break;
        }
      }

      // 智能合并相关内容
      let finalChunks = chunks;
      if (this.config.enableSmartMerging && chunks.length > 0) {
        finalChunks = this.mergeRelatedChunks(chunks);
      }

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

  /**
   * 判断是否应该在Markdown边界处分段
   */
  private shouldSplitMarkdown(
    line: string,
    currentChunk: string[],
    inCodeBlock: boolean,
    currentIndex: number,
    maxLines: number
  ): boolean {
    // 当前chunk为空，不需要分段
    if (currentChunk.length === 0) {
      return false;
    }

    // 在代码块内部不进行结构性分段
    if (inCodeBlock) {
      return false;
    }

    // 检查章节标题（# ## ### 等）
    if (this.isSectionHeader(line) && currentChunk.length > 0) {
      return true;
    }

    // 检查水平分割线
    if (this.isHorizontalRule(line) && currentChunk.length > 3) {
      return true;
    }

    // 检查列表项之间的空行
    if (line === '' && currentChunk.length > 5 && this.hasListItems(currentChunk)) {
      return true;
    }

    // 检查表格结束
    if (this.isTableRow(line) && this.isTableEnd(currentChunk) && currentChunk.length > 3) {
      return true;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为章节标题
   */
  private isSectionHeader(line: string): boolean {
    return /^#{1,6}\s+/.test(line);
  }

  /**
   * 提取章节标题
   */
  private extractSectionTitle(line: string): string {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    return match ? match[1].trim() : '';
  }

  /**
   * 判断是否为水平分割线
   */
  private isHorizontalRule(line: string): boolean {
    return /^(-{3,}|_{3,}|\*{3,})\s*$/.test(line);
  }

  /**
   * 检查是否包含列表项
   */
  private hasListItems(lines: string[]): boolean {
    return lines.some(line => {
      const trimmed = line.trim();
      return /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
    });
  }

  /**
   * 判断是否为表格行
   */
  private isTableRow(line: string): boolean {
    return /\|/.test(line);
  }

  /**
   * 判断是否为表格结束
   */
  private isTableEnd(lines: string[]): boolean {
    if (lines.length < 2) return false;
    const lastLine = lines[lines.length - 1].trim();
    const secondLastLine = lines[lines.length - 2].trim();

    // 检查是否有表格分隔符行
    return /^\|[\s\|:-]+\|$/.test(secondLastLine) && this.isTableRow(lastLine);
  }

  /**
   * 获取分块类型
   */
  private getChunkType(section: string, inCodeBlock: boolean): ChunkType {
    if (inCodeBlock) {
      return ChunkType.BLOCK;
    }

    if (section) {
      return ChunkType.DOCUMENTATION;
    }

    return ChunkType.DOCUMENTATION;
  }

  /**
   * 分割过长的单行
   */
  private splitLongLine(line: string, maxSize: number): string[] {
    if (line.length <= maxSize) {
      return [line];
    }

    const parts: string[] = [];
    let currentPos = 0;

    while (currentPos < line.length) {
      let endPos = Math.min(currentPos + maxSize, line.length);

      // 尝试在空格处分割
      if (endPos < line.length) {
        // 向后查找空格
        let spacePos = endPos;
        while (spacePos > currentPos && line[spacePos] !== ' ') {
          spacePos--;
        }

        // 如果找到空格，就在空格处分割
        if (spacePos > currentPos) {
          endPos = spacePos;
        }
      }

      parts.push(line.substring(currentPos, endPos).trim());
      currentPos = endPos;

      // 跳过空格
      while (currentPos < line.length && line[currentPos] === ' ') {
        currentPos++;
      }
    }

    return parts.filter(p => p.length > 0);
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于内容长度计算基础复杂度
    complexity += content.length * 0.01;

    // 基于Markdown结构计算复杂度
    complexity += (content.match(/^#{1,6}\s+/gm) || []).length * 2; // 标题
    complexity += (content.match(/```/g) || []).length * 3; // 代码块
    complexity += (content.match(/\|/g) || []).length * 0.5; // 表格
    complexity += (content.match(/^[-*+]\s+/gm) || []).length * 1; // 列表

    // 基于行数调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 智能合并相关内容
   */
  private mergeRelatedChunks(chunks: CodeChunk[]): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const mergedChunks: CodeChunk[] = [];
    let currentMerge: CodeChunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const lastChunk = currentMerge[currentMerge.length - 1];

      // 检查是否应该合并
      const shouldMerge = this.shouldMergeChunks(lastChunk, currentChunk);

      if (shouldMerge) {
        currentMerge.push(currentChunk);
      } else {
        // 完成当前合并，开始新的合并组
        if (currentMerge.length > 0) {
          mergedChunks.push(this.mergeChunkGroup(currentMerge));
        }
        currentMerge = [currentChunk];
      }
    }

    // 处理最后的合并组
    if (currentMerge.length > 0) {
      mergedChunks.push(this.mergeChunkGroup(currentMerge));
    }

    return mergedChunks;
  }

  /**
   * 判断是否应该合并两个分块
   */
  private shouldMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    // 如果都是代码块，且总大小不太大，则合并
    if (chunk1.metadata?.type === ChunkType.BLOCK && chunk2.metadata?.type === ChunkType.BLOCK) {
      const combinedSize = chunk1.content.length + chunk2.content.length;
      return combinedSize < this.config.mergeThreshold!;
    }

    // 如果是同一章节的小块，则合并
    if (chunk1.metadata?.section === chunk2.metadata?.section) {
      const combinedSize = chunk1.content.length + chunk2.content.length;
      return combinedSize < this.config.mergeThreshold! * 0.8;
    }

    return false;
  }

  /**
   * 合并分块组
   */
  private mergeChunkGroup(chunks: CodeChunk[]): CodeChunk {
    if (chunks.length === 1) return chunks[0];

    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];
    const mergedContent = chunks.map(c => c.content).join('\n\n');
    const complexity = this.calculateComplexity(mergedContent);

    return this.createChunk(
      mergedContent,
      firstChunk.metadata?.startLine || 1,
      lastChunk.metadata?.endLine || 1,
      firstChunk.metadata?.language || 'markdown',
      firstChunk.metadata?.type || ChunkType.GENERIC,
      {
        filePath: firstChunk.metadata?.filePath,
        complexity,
        section: firstChunk.metadata?.section,
        codeLanguage: firstChunk.metadata?.codeLanguage
      }
    );
  }

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
  }
}