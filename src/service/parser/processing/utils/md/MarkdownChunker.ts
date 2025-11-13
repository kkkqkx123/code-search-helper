/**
 * Markdown 分块器
 * 基于Python参考实现优化的TypeScript版本
 * 提供智能的Markdown分段功能，基于标题层级进行智能分段
 */

import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { MarkdownChunkingConfig, HeaderConfig, DEFAULT_MARKDOWN_CONFIG } from './markdown-rules';

/**
 * Markdown 分块器
 */
export class MarkdownChunker {
  private config: MarkdownChunkingConfig;
  private headersToSplitOn: HeaderConfig[];
  private separators: string[];
  private compiledSeparators: RegExp[];

  constructor(config: Partial<MarkdownChunkingConfig> = {}) {
    this.config = { ...DEFAULT_MARKDOWN_CONFIG, ...config };
    this.headersToSplitOn = this.config.headersToSplitOn || [];
    this.separators = this.config.separators || [];
    this.compiledSeparators = [];
    
    this.initializeSeparators();
  }

  /**
   * 初始化分隔符
   */
  private initializeSeparators(): void {
    if (this.config.isSeparatorRegex) {
      // 如果分隔符是正则表达式，编译它们
      this.compiledSeparators = this.separators.map(sep => new RegExp(sep, 'g'));
    } else {
      // 如果分隔符是普通字符串，创建正则表达式
      this.compiledSeparators = this.separators.map(sep => 
        new RegExp(this.escapeRegExp(sep), 'g')
      );
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 主要的分块方法
   */
  async chunkMarkdown(content: string, filePath?: string): Promise<CodeChunk[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // 按行分割内容
    const lines = content.split('\n');
    
    // 使用标题层级进行分段
    const chunks = await this.chunkByHeaders(lines, filePath);
    
    // 对过大的块进行进一步分割
    const processedChunks = await this.processLargeChunks(chunks);
    
    return processedChunks;
  }

  /**
   * 基于标题层级进行分段
   */
  private async chunkByHeaders(lines: string[], filePath?: string): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentHeaderLevel = 0;
    let startLine = 1;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检查代码块状态
      if (trimmedLine.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      // 检查是否是标题行（不在代码块内）
      if (!inCodeBlock) {
        const headerMatch = this.matchHeader(trimmedLine);
        if (headerMatch) {
          // 如果当前块不为空，保存当前块
          if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join('\n');
            chunks.push(this.createChunk(chunkContent, startLine, i, filePath));
          }

          // 开始新块
          currentChunk = [line];
          currentHeaderLevel = headerMatch.level;
          startLine = i + 1;
          continue;
        }
      }

      // 添加到当前块
      currentChunk.push(line);

      // 检查是否需要分割（基于大小和行数）
      const currentSize = this.calculateLengthExcludingCode(currentChunk.join('\n'));
      const currentLines = currentChunk.length;
      
      if (currentSize > this.config.maxChunkSize || currentLines > this.config.maxLinesPerChunk) {
        // 找到最佳分割点
        const splitPoint = this.findBestSplitPoint(currentChunk);
        if (splitPoint > 0 && splitPoint < currentChunk.length - 1) {
          // 分割当前块
          const firstPart = currentChunk.slice(0, splitPoint);
          const secondPart = currentChunk.slice(splitPoint);

          const firstContent = firstPart.join('\n');
          chunks.push(this.createChunk(firstContent, startLine, startLine + firstPart.length - 1, filePath));

          currentChunk = secondPart;
          startLine = startLine + splitPoint;
          
          // 重新检查分割后的块大小和行数，如果仍然过大，继续分割
          const newSize = this.calculateLengthExcludingCode(currentChunk.join('\n'));
          const newLines = currentChunk.length;
          if (newSize > this.config.maxChunkSize || newLines > this.config.maxLinesPerChunk) {
            // 递归处理剩余内容
            i--; // 回退一行，重新处理
            continue;
          }
        }
      }
    }

    // 处理最后一个块
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push(this.createChunk(chunkContent, startLine, lines.length, filePath));
    }

    return chunks;
  }

  /**
   * 匹配标题行
   */
  private matchHeader(line: string): { level: number; text: string } | null {
    for (const headerConfig of this.headersToSplitOn) {
      const regex = new RegExp(headerConfig.pattern);
      const match = line.match(regex);
      if (match) {
        return {
          level: headerConfig.level,
          text: match[2] || match[1] || ''
        };
      }
    }
    return null;
  }

  /**
   * 计算排除代码块的文本长度
   */
  private calculateLengthExcludingCode(text: string): number {
    if (this.config.excludeCodeFromChunkSize) {
      // 移除代码块内容
      const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, '');
      // 移除行内代码
      const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');
      
      if (this.config.lengthFunction) {
        return this.config.lengthFunction(withoutInlineCode);
      }
      return withoutInlineCode.length;
    }
    
    if (this.config.lengthFunction) {
      return this.config.lengthFunction(text);
    }
    return text.length;
  }

  /**
   * 找到最佳分割点
   */
  private findBestSplitPoint(lines: string[]): number {
    // 从后向前查找最佳分割点
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 优先在空行处分割
      if (trimmedLine === '') {
        return i;
      }

      // 检查是否包含分隔符
      for (const separator of this.compiledSeparators) {
        if (separator.test(line)) {
          return i + 1; // 在分隔符后分割
        }
      }
    }

    // 如果没有找到合适的分割点，返回中间位置
    return Math.floor(lines.length / 2);
  }

  /**
   * 处理过大的块
   */
  private async processLargeChunks(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    const result: CodeChunk[] = [];

    for (const chunk of chunks) {
      const size = this.calculateLengthExcludingCode(chunk.content);
      
      if (size > this.config.maxChunkSize) {
        // 分割大块
        const splitChunks = await this.splitLargeChunk(chunk);
        result.push(...splitChunks);
      } else {
        result.push(chunk);
      }
    }

    return result;
  }

  /**
   * 分割大块
   */
  private async splitLargeChunk(chunk: CodeChunk): Promise<CodeChunk[]> {
    const lines = chunk.content.split('\n');
    const result: CodeChunk[] = [];
    let currentLines: string[] = [];
    let currentStartLine = chunk.metadata?.startLine || 1;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLines.push(line);

      // 检查代码块状态
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      // 检查是否需要分割
      const currentSize = this.calculateLengthExcludingCode(currentLines.join('\n'));
      if (currentSize >= this.config.maxChunkSize || i === lines.length - 1) {
        // 如果在代码块内，尽量不分割
        if (inCodeBlock && i < lines.length - 1) {
          continue;
        }

        // 创建新块
        const content = currentLines.join('\n');
        const endLine = currentStartLine + currentLines.length - 1;
        
        result.push(this.createChunk(content, currentStartLine, endLine, chunk.metadata?.filePath));
        
        currentLines = [];
        currentStartLine = endLine + 1;
      }
    }

    return result.length > 0 ? result : [chunk];
  }

  /**
   * 创建代码块
   */
  private createChunk(content: string, startLine: number, endLine: number, filePath?: string): CodeChunk {
    const complexity = this.calculateComplexity(content);
    const headingLevel = this.extractHeadingLevel(content);

    return {
      content,
      metadata: {
        startLine,
        endLine,
        language: 'markdown',
        filePath,
        type: ChunkType.GENERIC,
        complexity,
        strategy: 'markdown-chunker',
        timestamp: Date.now(),
        size: content.length,
        lineCount: content.split('\n').length,
        headingLevel
      }
    };
  }

  /**
   * 计算内容复杂度
   */
  private calculateComplexity(content: string): number {
    let complexity = 1;

    // 基于内容长度
    complexity += Math.log10(content.length + 1);

    // 基于标题数量
    const headingMatches = content.match(/^#{1,6}\s+/gm);
    if (headingMatches) {
      complexity += headingMatches.length * 3;
    }

    // 基于代码块数量
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    if (codeBlockMatches) {
      complexity += codeBlockMatches.length * 2;
    }

    // 基于表格
    if (content.includes('|')) {
      complexity += 2;
    }

    // 基于列表
    if (content.match(/^[\s]*[-*+]\s+/gm)) {
      complexity += 1;
    }

    return Math.round(complexity);
  }

  /**
   * 提取标题级别
   */
  private extractHeadingLevel(content: string): number | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s/);
      if (match) {
        return match[1].length;
      }
    }
    return undefined;
  }

  

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MarkdownChunkingConfig>): void {
    this.config = { ...this.config, ...config };
    this.headersToSplitOn = this.config.headersToSplitOn || [];
    this.separators = this.config.separators || [];
    this.initializeSeparators();
  }

  /**
   * 获取当前配置
   */
  getConfig(): MarkdownChunkingConfig {
    return { ...this.config };
  }
}