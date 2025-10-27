import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionCenter';
import { CodeChunk, CodeChunkMetadata } from '../../types';

/**
 * Markdown分段策略
 * 职责：Markdown文件的特殊处理
 */
@injectable()
export class MarkdownSegmentationStrategy implements IProcessingStrategy {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Markdown segmentation strategy for ${filePath}`);

    // 验证上下文
    const validationResult = this.validateContext(content, detection.language);
    if (!validationResult) {
      this.logger?.warn('Context validation failed for markdown strategy, proceeding anyway');
    } else {
      this.logger?.debug('Context validation passed for markdown strategy');
    }

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

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

      // 检查是否应该分段
      const shouldSplit = this.shouldSplitMarkdown(
        trimmedLine,
        currentChunk,
        inCodeBlock,
        i,
        lines.length
      );

      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: 'markdown',
            filePath,
            type: this.getChunkType(currentSection, inCodeBlock),
            complexity: this.calculateComplexity(chunkContent),
            section: currentSection || undefined,
            codeLanguage: codeBlockLang || undefined
          }
        });

        currentChunk = [];
        currentLine = i + 1;

        // 更新当前章节
        if (this.isSectionHeader(trimmedLine)) {
          currentSection = this.extractSectionTitle(trimmedLine);
        }
      }

      currentChunk.push(line);

      // 更新当前章节
      if (this.isSectionHeader(trimmedLine) && currentChunk.length === 1) {
        currentSection = this.extractSectionTitle(trimmedLine);
      }
    }

    // 处理最后的chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: 'markdown',
          filePath,
          type: this.getChunkType(currentSection, inCodeBlock),
          complexity: this.calculateComplexity(chunkContent),
          section: currentSection || undefined,
          codeLanguage: codeBlockLang || undefined
        }
      });
    } else if (content.trim() === '') {
      // 对于完全空的内容，创建一个空块
      chunks.push({
        content: '',
        metadata: {
          startLine: 1,
          endLine: 0,
          language: 'markdown',
          filePath,
          type: 'paragraph',
          complexity: 0,
          section: undefined,
          codeLanguage: undefined
        }
      });
    }

    // 智能合并相关内容
    const mergedChunks = this.mergeRelatedChunks(chunks);

    this.logger?.debug(`Markdown segmentation created ${mergedChunks.length} chunks`);
    return { chunks: mergedChunks, metadata: { strategy: 'MarkdownSegmentationStrategy' } };
  }

  getName(): string {
    return 'MarkdownSegmentationStrategy';
  }

  getDescription(): string {
    return 'Uses Markdown-specific segmentation to preserve document structure';
  }

  /**
   * 验证上下文是否适合Markdown分段
   */
  private validateContext(content: string, language?: string): boolean {
    // 验证上下文是否适合Markdown分段
    if (!content || content.trim().length === 0) {
      return false;
    }

    // 检查是否为Markdown文件
    const isMarkdownByLanguage = !!(language && ['markdown', 'md'].includes(language));

    return isMarkdownByLanguage || this.hasMarkdownStructure(content);
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
    // 在代码块内部不分段
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

    // 大小限制检查
    const chunkContent = currentChunk.join('\n');
    if (chunkContent.length > 3000) {
      return true;
    }

    // 行数限制
    if (currentChunk.length > 100) {
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
  private getChunkType(section: string, inCodeBlock: boolean): CodeChunkMetadata['type'] {
    if (inCodeBlock) {
      return 'code_block';
    }

    if (section) {
      return 'heading';
    }

    return 'paragraph';
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
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
    if (chunk1.metadata.type === 'code_block' && chunk2.metadata.type === 'code_block') {
      const combinedSize = chunk1.content.length + chunk2.content.length;
      return combinedSize < 2000;
    }

    // 如果是同一章节的小块，则合并
    if (chunk1.metadata.section === chunk2.metadata.section) {
      const combinedSize = chunk1.content.length + chunk2.content.length;
      return combinedSize < 1500;
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

    return {
      content: mergedContent,
      metadata: {
        startLine: firstChunk.metadata.startLine,
        endLine: lastChunk.metadata.endLine,
        language: 'markdown',
        filePath: firstChunk.metadata.filePath,
        type: firstChunk.metadata.type,
        complexity,
        section: firstChunk.metadata.section,
        codeLanguage: firstChunk.metadata.codeLanguage
      }
    };
  }
}