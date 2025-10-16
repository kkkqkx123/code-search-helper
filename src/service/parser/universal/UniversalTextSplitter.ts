import { injectable } from 'inversify';
import { CodeChunk, CodeChunkMetadata } from '../splitting/Splitter';
import { LoggerService } from '../../../utils/LoggerService';
import { DEFAULT_CONFIG, BLOCK_SIZE_LIMITS, SMALL_FILE_THRESHOLD, getDynamicBlockLimits } from './constants';
import { MarkdownTextSplitter } from './md/MarkdownTextSplitter';

/**
 * 通用分段选项
 */
export interface UniversalChunkingOptions {
  maxChunkSize: number;        // 最大块大小
  overlapSize: number;         // 重叠大小
  maxLinesPerChunk: number;    // 每块最大行数
  errorThreshold: number;      // 错误阈值
  memoryLimitMB: number;       // 内存限制(MB)
  enableBracketBalance: boolean; // 启用括号平衡检测
  enableSemanticDetection: boolean; // 启用语义检测
  enableCodeOverlap?: boolean; // 是否为代码文件启用重叠（新增）
  maxOverlapRatio?: number;    // 最大重叠比例（新增）
}

/**
 * 通用文本分段器
 * 提供多种分段策略，适用于各种文件类型和内容
 */
@injectable()
export class UniversalTextSplitter {
  private options: UniversalChunkingOptions;
  private logger?: LoggerService;
  private markdownSplitter: MarkdownTextSplitter;

  constructor(logger?: LoggerService) {
    this.logger = logger;
    this.options = { ...DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS };
    this.markdownSplitter = new MarkdownTextSplitter(logger);
  }

  /**
   * 设置分段选项
   */
  setOptions(options: Partial<UniversalChunkingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 过滤小块 - 基于kilocode经验
   * 过滤掉小于最小块大小的无意义片段
   */
  private filterSmallChunks(chunks: CodeChunk[]): CodeChunk[] {
    const validChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkSize = chunk.content.length;

      // 跳过过小的块
      if (chunkSize < BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS) {
        // 尝试合并到前一个块或后一个块
        if (validChunks.length > 0) {
          // 合并到前一个块
          const prevChunk = validChunks[validChunks.length - 1];
          prevChunk.content += '\n' + chunk.content;
          prevChunk.metadata.endLine = chunk.metadata.endLine;
          this.logger?.debug(`Merged small chunk (${chunkSize} chars) into previous chunk`);
        } else if (i < chunks.length - 1) {
          // 合并到后一个块（标记为待处理）
          const nextChunk = chunks[i + 1];
          nextChunk.content = chunk.content + '\n' + nextChunk.content;
          nextChunk.metadata.startLine = chunk.metadata.startLine;
          this.logger?.debug(`Merged small chunk (${chunkSize} chars) into next chunk`);
        } else {
          // 孤立的小块，丢弃
          this.logger?.warn(`Discarded small chunk (${chunkSize} chars): ${chunk.content.substring(0, 50)}...`);
        }
        continue;
      }

      validChunks.push(chunk);
    }

    return validChunks;
  }

  /**
   * 智能分块再平衡 - 基于kilocode经验
   * 防止产生过小的最后一块
   */
  private rebalanceChunks(chunks: CodeChunk[]): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const rebalancedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 检查是否是最后一块且过小
      if (i === chunks.length - 1 && chunk.content.length < BLOCK_SIZE_LIMITS.MIN_CHUNK_REMAINDER_CHARS) {
        // 尝试向前合并到前一个块
        if (rebalancedChunks.length > 0) {
          const prevChunk = rebalancedChunks[rebalancedChunks.length - 1];
          const combinedSize = prevChunk.content.length + chunk.content.length;

          // 确保合并后不超过最大限制
          if (combinedSize <= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR) {
            prevChunk.content += '\n' + chunk.content;
            prevChunk.metadata.endLine = chunk.metadata.endLine;
            this.logger?.info(`Rebalanced final small chunk (${chunk.content.length} chars) into previous chunk`);
            continue;
          }
        }
      }

      rebalancedChunks.push(chunk);
    }

    return rebalancedChunks;
  }

  /**
   * 检查是否是小文件，应该直接作为一个块处理
   */
  private isSmallFile(content: string): boolean {
    const lines = content.split('\n');
    return content.length <= SMALL_FILE_THRESHOLD.CHARS || lines.length <= SMALL_FILE_THRESHOLD.LINES;
  }

  /**
   * 小文件处理 - 整个文件作为一个块，无重叠
   */
  private chunkSmallFile(content: string, filePath?: string, language?: string): CodeChunk[] {
    const lines = content.split('\n');
    const complexity = this.calculateComplexity(content);

    const metadata: CodeChunkMetadata = {
      startLine: 1,
      endLine: lines.length,
      language: language || 'unknown',
      filePath,
      type: 'semantic',
      complexity
    };

    this.logger?.info(`Small file detected (${content.length} chars, ${lines.length} lines), using single chunk`);

    return [{
      content: content,
      metadata
    }];
  }

  /**
   * 检查是否为代码文件（非markdown）
   */
  private isCodeFile(language?: string, filePath?: string): boolean {
    if (language === 'markdown' || (filePath && filePath.endsWith('.md'))) {
      return false;
    }
    // 检查是否在代码语言列表中
    const codeLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
      'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
      'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
      'visualbasic', 'powershell', 'batch'];

    return language ? codeLanguages.includes(language) : false;
  }

  /**
   * 智能块大小检查和拆分 - 当块超过最大限制时使用重叠策略
   */
  private splitLargeChunkWithOverlap(chunk: CodeChunk, maxSize: number, overlapSize: number): CodeChunk[] {
    const content = chunk.content;
    if (content.length <= maxSize) {
      return [chunk];
    }

    this.logger?.info(`大分块检测到 (${content.length} 字符), 使用重叠策略进行拆分`);

    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let currentLine = chunk.metadata.startLine;

    // 计算最大允许重叠大小（考虑比例限制）
    const maxOverlapRatio = this.options.maxOverlapRatio || 0.3;
    const maxOverlapSize = Math.min(overlapSize, Math.floor(maxSize * maxOverlapRatio));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查是否应该分割 - 考虑重叠空间
      const projectedSize = currentSize + lineSize;
      const needsSplit = projectedSize > (maxSize - maxOverlapSize) && currentChunk.length > 0;

      if (needsSplit || i === lines.length - 1) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: chunk.metadata.language,
            filePath: chunk.metadata.filePath,
            type: chunk.metadata.type || 'semantic',
            complexity
          }
        });

        // 为下一块计算重叠内容
        const overlapLines = this.calculateSmartOverlapLines(currentChunk, maxOverlapSize);

        currentChunk = [...overlapLines];
        currentSize = overlapLines.join('\n').length;
        currentLine = chunk.metadata.startLine + i - overlapLines.length + 1;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // 处理剩余的最后一小块
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: chunk.metadata.language,
          filePath: chunk.metadata.filePath,
          type: chunk.metadata.type || 'semantic',
          complexity
        }
      });
    }

    this.logger?.info(`大分块被拆分为 ${chunks.length} 个较小的分块，带有重叠`);
    return chunks;
  }

  /**
   * 计算智能重叠行 - 基于语义边界
   */
  private calculateSmartOverlapLines(lines: string[], maxOverlapSize: number): string[] {
    const overlapLines: string[] = [];
    let size = 0;

    // 从后往前计算重叠，优先选择语义边界
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lineSize = line.length + 1;

      if (size + lineSize <= maxOverlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    // 如果重叠太小，至少包含最后一行
    if (overlapLines.length === 0 && lines.length > 0) {
      overlapLines.unshift(lines[lines.length - 1]);
    }

    return overlapLines;
  }

  /**
   * 基于语义边界的分段
   * 优先在逻辑边界处分段，如函数、类、代码块等
   * 对 Markdown 文件使用专门的分段策略
   */
  chunkBySemanticBoundaries(content: string, filePath?: string, language?: string): CodeChunk[] {
    // 对小文件直接作为一个块处理，无重叠
    if (this.isSmallFile(content)) {
      return this.chunkSmallFile(content, filePath, language);
    }
    // 对 Markdown 文件使用专门的分段器
    if (language === 'markdown' || (filePath && filePath.endsWith('.md'))) {
      this.logger?.info(`使用专门的markdown分块策略处理 ${filePath}`);
      const mdChunks = this.markdownSplitter.chunkMarkdown(content, filePath);
      // 为markdown分块添加重叠
      return this.addOverlapToChunks(mdChunks, content, language, filePath);
    }
    try {
      const chunks: CodeChunk[] = [];
      const lines = content.split('\n');
      let currentChunk: string[] = [];
      let currentLine = 1;
      let semanticScore = 0;

      // 内存保护：限制处理的行数
      const maxLines = Math.min(lines.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 计算语义分数
        const lineScore = this.calculateSemanticScore(trimmedLine, language);
        semanticScore += lineScore;

        // 决定是否分段
        const shouldSplit = this.shouldSplitAtSemanticBoundary(
          trimmedLine,
          currentChunk,
          semanticScore,
          i,
          maxLines
        );

        if (shouldSplit && currentChunk.length > 0) {
          const chunkContent = currentChunk.join('\n');
          const complexity = this.calculateComplexity(chunkContent);

          const metadata: CodeChunkMetadata = {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'semantic',
            complexity
          };

          chunks.push({
            content: chunkContent,
            metadata
          });

          // 代码文件：检查是否需要重叠（仅当块过大时）
          if (this.isCodeFile(language, filePath)) {
            // 检查当前块是否过大，需要后续处理
            if (chunkContent.length > this.options.maxChunkSize * 0.9) {
              this.logger?.debug(`大语义分块检测到 (${chunkContent.length} 字符), 将在需要时使用重叠处理`);
            }
            // 重置当前块，不保留重叠（除非块过大）
            currentChunk = [];
            currentLine = i + 1;
          } else {
            // 非代码文件：应用重叠
            const overlapLines = this.calculateOverlapLines(currentChunk);
            currentChunk = overlapLines;
            currentLine = i - overlapLines.length + 1;
          }
          semanticScore = 0;
        }

        currentChunk.push(line);

        // 内存检查
        if (i > 0 && i % 1000 === 0) {
          if (this.isMemoryLimitExceeded()) {
            this.logger?.warn(`语义分块过程中内存限制超出，在第 ${i} 行停止`);
            break;
          }
        }
      }

      // 处理最后的chunk
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);

        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'semantic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });
      }

      // 应用过滤和再平衡逻辑
      const filteredChunks = this.filterSmallChunks(chunks);
      const rebalancedChunks = this.rebalanceChunks(filteredChunks);

      // 对代码文件进行智能处理：检查是否需要重叠拆分
      if (this.isCodeFile(language, filePath)) {
        const finalChunks: CodeChunk[] = [];
        for (const chunk of rebalancedChunks) {
          // 检查块是否过大需要重叠拆分
          if (chunk.content.length > this.options.maxChunkSize) {
            const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, this.options.maxChunkSize, this.options.overlapSize);
            finalChunks.push(...overlappedChunks);
          } else {
            finalChunks.push(chunk);
          }
        }
        this.logger?.info(`分块优化: ${chunks.length} -> ${finalChunks.length} 分块 (代码文件，仅大分块使用重叠)`);
        return finalChunks;
      }

      this.logger?.info(`分块优化: ${chunks.length} -> ${rebalancedChunks.length} 分块`);
      return rebalancedChunks;
    } catch (error) {
      this.logger?.error(`语义分块错误: ${error}`);
      return this.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 为分块添加重叠（用于非代码文件）
   */
  private addOverlapToChunks(chunks: CodeChunk[], originalContent: string, language?: string, filePath?: string): CodeChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i < chunks.length - 1) {
        // 计算重叠内容
        const overlapContent = this.calculateOverlapContent(chunk, chunks[i + 1], originalContent);

        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        // 最后一个分块
        overlappedChunks.push(chunk);
      }
    }

    return overlappedChunks;
  }

  /**
   * 计算两个分块之间的重叠内容
   */
  private calculateOverlapContent(currentChunk: CodeChunk, nextChunk: CodeChunk, originalContent: string): string {
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    if (currentEndLine >= nextStartLine) {
      return ''; // 已经重叠或相邻
    }

    const lines = originalContent.split('\n');
    const overlapLines = [];
    const maxOverlapLines = Math.min(3, Math.floor((currentEndLine - currentChunk.metadata.startLine + 1) * 0.3));

    // 从当前分块的末尾获取重叠内容
    for (let i = Math.max(0, currentEndLine - maxOverlapLines); i < currentEndLine; i++) {
      if (i < lines.length) {
        overlapLines.push(lines[i]);
      }
    }

    return overlapLines.join('\n');
  }

  /**
   * 基于括号和行数的智能分段
   * 适用于代码文件，保持代码块的完整性
   */
  chunkByBracketsAndLines(content: string, filePath?: string, language?: string): CodeChunk[] {
    try {
      if (!this.options.enableBracketBalance) {
        return this.chunkByLines(content, filePath, language);
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
          currentChunk.length >= this.options.maxLinesPerChunk ||
          chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR;

        if (shouldSplit) {
          const complexity = this.calculateComplexity(chunkContent);

          const metadata: CodeChunkMetadata = {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'bracket',
            complexity
          };

          chunks.push({
            content: chunkContent,
            metadata
          });

          // 代码文件：重置当前块，不保留重叠（除非块过大）
          if (this.isCodeFile(language, filePath)) {
            // 检查当前块是否过大
            if (chunkContent.length > this.options.maxChunkSize * 0.9) {
              this.logger?.debug(`大括号分块检测到 (${chunkContent.length} 字符)`);
            }
            currentChunk = [];
            currentLine = i + 1;
          } else {
            // 非代码文件：应用重叠
            const overlapLines = this.calculateOverlapLines(currentChunk);
            currentChunk = overlapLines;
            currentLine = i - overlapLines.length + 1;
          }
          bracketDepth = 0;
          xmlTagDepth = 0;
        }

        // 内存检查
        if (i > 0 && i % 1000 === 0) {
          if (this.isMemoryLimitExceeded()) {
            this.logger?.warn(`括号分块过程中内存限制超出，在第 ${i} 行停止`);
            break;
          }
        }
      }

      // 处理剩余内容
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);

        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'bracket',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });
      }

      // 应用过滤和再平衡逻辑
      const filteredChunks = this.filterSmallChunks(chunks);
      const rebalancedChunks = this.rebalanceChunks(filteredChunks);

      // 对代码文件进行智能处理
      if (this.isCodeFile(language, filePath)) {
        const finalChunks: CodeChunk[] = [];
        for (const chunk of rebalancedChunks) {
          // 检查块是否过大需要重叠拆分
          if (chunk.content.length > this.options.maxChunkSize) {
            const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, this.options.maxChunkSize, this.options.overlapSize);
            finalChunks.push(...overlappedChunks);
          } else {
            finalChunks.push(chunk);
          }
        }
        return finalChunks;
      }

      return rebalancedChunks;
    } catch (error) {
      this.logger?.error(`括号分块错误: ${error}`);
      return this.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 简单的行数分段
   * 基于行数的简单分段，作为最终的降级方案
   */
  chunkByLines(content: string, filePath?: string, language?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    // 内存保护：限制处理的行数
    const maxLines = Math.min(lines.length, 10000);

    for (let i = 0; i < maxLines; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 检查是否应该分段，同时考虑块大小限制
      const chunkContent = currentChunk.join('\n');
      const shouldSplit = currentChunk.length >= this.options.maxLinesPerChunk ||
        chunkContent.length >= this.options.maxChunkSize ||
        chunkContent.length >= BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS * BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR ||
        i === maxLines - 1;

      if (shouldSplit) {
        const complexity = this.calculateComplexity(chunkContent);

        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'line',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });

        // 代码文件：重置当前块，不保留重叠（除非块过大）
        if (this.isCodeFile(language, filePath)) {
          // 检查当前块是否过大
          if (chunkContent.length > this.options.maxChunkSize * 0.9) {
            this.logger?.debug(`大行分块检测到 (${chunkContent.length} 字符)`);
          }
          currentChunk = [];
          currentLine = i + 2;
        } else {
          // 非代码文件：应用重叠
          const overlapLines = this.calculateOverlapLines(currentChunk);
          currentChunk = overlapLines;
          currentLine = i - overlapLines.length + 2;
        }
      }

      // 内存检查
      if (i > 0 && i % 1000 === 0) {
        if (this.isMemoryLimitExceeded()) {
          this.logger?.warn(`行数分块过程中内存限制超出，在第 ${i} 行停止`);
          break;
        }
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);

      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language: language || 'unknown',
        filePath,
        type: 'line',
        complexity
      };

      chunks.push({
        content: chunkContent,
        metadata
      });
    }

    // 应用过滤和再平衡逻辑
    const filteredChunks = this.filterSmallChunks(chunks);
    const rebalancedChunks = this.rebalanceChunks(filteredChunks);

    // 对代码文件进行智能处理
    if (this.isCodeFile(language, filePath)) {
      const finalChunks: CodeChunk[] = [];
      for (const chunk of rebalancedChunks) {
        // 检查块是否过大需要重叠拆分
        if (chunk.content.length > this.options.maxChunkSize) {
          const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, this.options.maxChunkSize, this.options.overlapSize);
          finalChunks.push(...overlappedChunks);
        } else {
          finalChunks.push(chunk);
        }
      }
      return finalChunks;
    }

    return rebalancedChunks;
  }

  /**
   * 计算语义分数
   */
  private calculateSemanticScore(line: string, language?: string): number {
    let score = line.length; // 基础分数

    // 语言特定的关键字权重
    if (language === 'typescript' || language === 'javascript') {
      if (line.match(/\b(function|class|interface|const|let|var|import|export)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
      if (line.match(/\b(return|break|continue|throw|new)\b/)) score += 4;
    } else if (language === 'python') {
      if (line.match(/\b(def|class|import|from|if|else|elif|for|while|try|except|finally)\b/)) score += 8;
      if (line.match(/\b(return|break|continue|raise|yield|async|await)\b/)) score += 4;
    } else if (language === 'java') {
      if (line.match(/\b(public|private|protected|static|final|class|interface)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
    }

    // 通用结构复杂度
    score += (line.match(/[{}]/g) || []).length * 3;
    score += (line.match(/[()]/g) || []).length * 2;
    score += (line.match(/[\[\]]/g) || []).length * 1.5;

    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) score *= 0.3;
    if (line.trim() === '') score = 1;

    return score;
  }

  /**
   * 判断是否应该在语义边界处分段
   */
  private shouldSplitAtSemanticBoundary(
    line: string,
    currentChunk: string[],
    semanticScore: number,
    currentIndex: number,
    maxLines: number
  ): boolean {
    // 大小限制检查
    if (semanticScore > this.options.maxChunkSize * 0.8) {
      return true;
    }

    // 逻辑边界检查
    const trimmedLine = line.trim();

    // 函数/类定义结束
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > 5) {
      return true;
    }

    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/) && currentChunk.length > 3) {
      return true;
    }

    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > 5) {
      return true;
    }

    // 注释行作为分割点
    if (trimmedLine.match(/^\s*\/\//) || trimmedLine.match(/^\s*\/\*/) ||
      trimmedLine.match(/^\s*\*/) || trimmedLine.match(/^\s*#/)) {
      return currentChunk.length > 3;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
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
   * 计算重叠行数（用于非代码文件）
   */
  private calculateOverlapLines(lines: string[]): string[] {
    const overlapSize = this.options.overlapSize;
    let overlapLines: string[] = [];
    let size = 0;

    // 从后往前计算重叠，但限制最大行数避免过度重叠
    const maxOverlapLines = Math.min(3, Math.floor(lines.length * 0.3)); // 最多3行或30%的行数
    let linesAdded = 0;

    for (let i = lines.length - 1; i >= 0 && linesAdded < maxOverlapLines; i--) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= overlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
        linesAdded++;
      } else {
        break;
      }
    }

    return overlapLines;
  }

  /**
   * 计算代码复杂度
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

  /**
   * 检查内存限制是否超出
   */
  private isMemoryLimitExceeded(): boolean {
    try {
      const currentMemory = process.memoryUsage();
      const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;
      return memoryUsageMB > this.options.memoryLimitMB;
    } catch (error) {
      this.logger?.warn(`检查内存使用失败: ${error}`);
      return false;
    }
  }
}