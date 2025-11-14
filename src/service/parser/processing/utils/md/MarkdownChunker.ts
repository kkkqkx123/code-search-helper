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
   * 评估分块质量
   */
  evaluateChunkQuality(chunks: CodeChunk[], originalContent: string): {
    semanticCohesion: number;
    structuralIntegrity: number;
    sizeDistribution: number;
    codeBlockPreservation: number;
    overallScore: number;
  } {
    // 计算语义连贯性 - 基于标题层级的一致性
    const semanticCohesion = this.calculateSemanticCohesion(chunks);

    // 计算结构完整性 - 基于代码块和表格的完整性
    const structuralIntegrity = this.calculateStructuralIntegrity(chunks, originalContent);

    // 计算大小分布 - 基于块大小的均匀性
    const sizeDistribution = this.calculateSizeDistribution(chunks);

    // 计算代码块保持性 - 基于代码块是否被正确分割
    const codeBlockPreservation = this.calculateCodeBlockPreservation(chunks, originalContent);

    // 计算总体评分
    const overallScore = (
      semanticCohesion * 0.3 +
      structuralIntegrity * 0.3 +
      sizeDistribution * 0.2 +
      codeBlockPreservation * 0.2
    );

    return {
      semanticCohesion,
      structuralIntegrity,
      sizeDistribution,
      codeBlockPreservation,
      overallScore
    };
  }

  /**
   * 计算语义连贯性
   */
  private calculateSemanticCohesion(chunks: CodeChunk[]): number {
    if (chunks.length === 0) return 0;

    let totalCohesion = 0;
    let validChunks = 0;

    for (const chunk of chunks) {
      const headingLevel = chunk.metadata.headingLevel;
      if (headingLevel !== undefined) {
        // 检查块内标题层级的一致性
        const lines = chunk.content.split('\n');
        const headingLevels: number[] = [];

        for (const line of lines) {
          const match = line.match(/^(#{1,6})\s/);
          if (match) {
            headingLevels.push(match[1].length);
          }
        }

        if (headingLevels.length > 0) {
          // 计算标题层级的标准差，标准差越小，连贯性越好
          const mean = headingLevels.reduce((sum, level) => sum + level, 0) / headingLevels.length;
          const variance = headingLevels.reduce((sum, level) => sum + Math.pow(level - mean, 2), 0) / headingLevels.length;
          const stdDev = Math.sqrt(variance);

          // 将标准差转换为0-1的连贯性分数
          const cohesion = Math.max(0, 1 - (stdDev / 6)); // 6是最大可能的标题层级差
          totalCohesion += cohesion;
          validChunks++;
        }
      } else {
        // 没有标题的块给予中等连贯性分数
        totalCohesion += 0.5;
        validChunks++;
      }
    }

    return validChunks > 0 ? totalCohesion / validChunks : 0;
  }

  /**
   * 计算结构完整性
   */
  private calculateStructuralIntegrity(chunks: CodeChunk[], originalContent: string): number {
    // 检查原始内容中的代码块和表格数量
    const originalCodeBlocks = (originalContent.match(/```[\s\S]*?```/g) || []).length;
    const originalTables = (originalContent.match(/\|.*\|/g) || []).length;

    // 检查分块后的代码块和表格数量
    let chunkedCodeBlocks = 0;
    let chunkedTables = 0;

    for (const chunk of chunks) {
      chunkedCodeBlocks += (chunk.content.match(/```[\s\S]*?```/g) || []).length;
      chunkedTables += (chunk.content.match(/\|.*\|/g) || []).length;
    }

    // 计算完整性分数
    const codeBlockIntegrity = originalCodeBlocks > 0 ? chunkedCodeBlocks / originalCodeBlocks : 1;
    const tableIntegrity = originalTables > 0 ? chunkedTables / originalTables : 1;

    return (codeBlockIntegrity + tableIntegrity) / 2;
  }

  /**
   * 计算大小分布
   */
  private calculateSizeDistribution(chunks: CodeChunk[]): number {
    if (chunks.length === 0) return 0;

    const sizes = chunks.map(chunk => chunk.content.length);
    const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);

    // 计算变异系数 (CV = stdDev / mean)
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    // 将变异系数转换为0-1的分布分数，CV越小，分布越均匀
    const distributionScore = Math.max(0, 1 - Math.min(coefficientOfVariation, 1));

    return distributionScore;
  }

  /**
   * 计算代码块保持性
   */
  private calculateCodeBlockPreservation(chunks: CodeChunk[], originalContent: string): number {
    // 提取原始内容中的所有代码块
    const originalCodeBlocks = originalContent.match(/```[\s\S]*?```/g) || [];

    if (originalCodeBlocks.length === 0) return 1; // 没有代码块，完美保持

    let preservedBlocks = 0;

    for (const originalBlock of originalCodeBlocks) {
      // 检查每个原始代码块是否在某个分块中完整存在
      for (const chunk of chunks) {
        if (chunk.content.includes(originalBlock)) {
          preservedBlocks++;
          break;
        }
      }
    }

    return preservedBlocks / originalCodeBlocks.length;
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