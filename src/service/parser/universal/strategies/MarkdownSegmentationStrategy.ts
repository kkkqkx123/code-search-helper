import { injectable, inject } from 'inversify';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../types/SegmentationTypes';
import { CodeChunk, CodeChunkMetadata } from '../../splitting';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * Markdown分段策略
 * 职责：Markdown文件的特殊处理
 */
@injectable()
export class MarkdownSegmentationStrategy implements ISegmentationStrategy {
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
    // 只处理Markdown文件
    return context.metadata.isMarkdownFile;
  }
  
  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath } = context;
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
        const complexity = this.complexityCalculator.calculate(chunkContent);
        
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: 'markdown',
            filePath,
            type: this.getChunkType(currentSection, inCodeBlock),
            complexity,
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
      const complexity = this.complexityCalculator.calculate(chunkContent);
      
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: 'markdown',
          filePath,
          type: this.getChunkType(currentSection, inCodeBlock),
          complexity,
          section: currentSection || undefined,
          codeLanguage: codeBlockLang || undefined
        }
      });
    }
    
    this.logger?.debug(`Markdown segmentation created ${chunks.length} chunks`);
    return chunks;
  }
  
  getName(): string {
    return 'markdown';
  }
  
  getPriority(): number {
    return 1; // 最高优先级，专门处理Markdown文件
  }
  
  getSupportedLanguages(): string[] {
    return ['markdown'];
  }
  
  validateContext(context: SegmentationContext): boolean {
    // 验证上下文是否适合Markdown分段
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }
    
    return context.metadata.isMarkdownFile;
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
    if (chunkContent.length > 3000) { // Markdown可以有较大的块
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
    if (chunk1.metadata.type === 'code' && chunk2.metadata.type === 'code') {
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
    const complexity = this.complexityCalculator.calculate(mergedContent);
    
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