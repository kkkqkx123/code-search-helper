import { injectable, inject } from 'inversify';
import { CodeChunk, ChunkType, CodeChunkBuilder } from '../processing/types/CodeChunk';
import { ChunkingOptions, ChunkingPreset, DEFAULT_CHUNKING_OPTIONS } from '../processing/strategies/types/SegmentationTypes';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { OverlapCalculator } from '../processing/utils/overlap/OverlapCalculator';
import { LoggerService } from '../../../utils/LoggerService';
import { ASTNodeTracker } from '../processing/utils/AST/ASTNodeTracker';
import { TYPES } from '../../../types';
import { DeduplicationUtils } from '../processing/utils/overlap/DeduplicationUtils';

/**
 * 重叠后处理器
 * 集成OverlapProcessor和UnifiedOverlapCalculator的功能
 * 为大型代码块和纯文本文件提供重叠支持
 */
@injectable()
export class OverlapPostProcessor implements IChunkPostProcessor {
  private logger?: LoggerService;
  private unifiedOverlapCalculator?: OverlapCalculator;
  private nodeTracker?: ASTNodeTracker;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ASTNodeTracker) nodeTracker?: ASTNodeTracker
  ) {
    this.logger = logger;
    this.nodeTracker = nodeTracker;
  }

  getName(): string {
    return 'overlap-post-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 应用条件：
    // 1. 有多个代码块
    // 2. 配置了重叠大小
    return chunks.length > 1 && (context.options.overlapSize || 0) > 0;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    this.logger?.debug(`Starting overlap processing for ${chunks.length} chunks`);

    try {
      // 使用默认配置合并用户提供的选项
      const completeOptions: Required<ChunkingOptions> = {
        ...DEFAULT_CHUNKING_OPTIONS,
        ...context.options
      };

      // 初始化统一重叠计算器
      this.initializeOverlapCalculator(completeOptions);

      // 判断文件类型并应用相应的重叠策略
      const isCodeFile = this.isCodeFile(context.language);
      const hasLargeChunks = chunks.some(chunk => chunk.content.length > (completeOptions.maxChunkSize || 1000));

      this.logger?.debug(`File type: ${context.language}, isCodeFile: ${isCodeFile}, hasLargeChunks: ${hasLargeChunks}`);

      let processedChunks: CodeChunk[];

      if (isCodeFile && !hasLargeChunks) {
        // 代码文件且没有大块：只对过大的块进行重叠拆分，不添加重叠
        this.logger?.debug('Processing code file chunks (no large chunks)');
        processedChunks = this.processCodeFileChunks(chunks, context);
      } else if (!isCodeFile) {
        // 纯文本文件：应用完整的重叠处理
        this.logger?.debug('Processing text file chunks');
        processedChunks = this.processTextFileChunks(chunks, context);
      } else {
        // 代码文件且有大块：应用代码文件处理（会拆分大块）
        this.logger?.debug('Processing large code file chunks');
        processedChunks = this.processCodeFileChunks(chunks, context);
      }

      // 使用统一重叠计算器进行智能合并（如果启用去重）
      if (completeOptions.customParams?.enableChunkDeduplication && this.unifiedOverlapCalculator) {
        // 转换为UnifiedOverlapCalculator期望的格式
        const convertedChunks = this.convertToUnifiedFormat(processedChunks);
        const mergedChunks = this.unifiedOverlapCalculator.mergeSimilarChunks(convertedChunks);
        // 转换回我们的格式
        processedChunks = this.convertFromUnifiedFormat(mergedChunks);
      }

      this.logger?.debug(`Overlap processing completed: ${chunks.length} -> ${processedChunks.length} chunks`);
      return processedChunks;

    } catch (error) {
      this.logger?.error('Error during overlap processing:', error);
      // 如果重叠处理失败，返回原始块
      return chunks;
    }
  }

  /**
   * 转换为UnifiedOverlapCalculator期望的格式
   */
  private convertToUnifiedFormat(chunks: CodeChunk[]): any[] {
    return chunks.map(chunk => ({
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        size: chunk.content.length,
        lineCount: chunk.metadata.endLine - chunk.metadata.startLine + 1
      }
    }));
  }

  /**
   * 从UnifiedOverlapCalculator格式转换回我们的格式
   */
  private convertFromUnifiedFormat(chunks: any[]): CodeChunk[] {
    return chunks.map(chunk => new CodeChunkBuilder()
      .setContent(chunk.content)
      .setStartLine(chunk.metadata.startLine)
      .setEndLine(chunk.metadata.endLine)
      .setLanguage(chunk.metadata.language)
      .setFilePath(chunk.metadata.filePath || '')
      .setStrategy(chunk.metadata.strategy)
      .setType(chunk.metadata.type || ChunkType.GENERIC)
      .setComplexity(chunk.metadata.complexity || 0)
      .build());
  }

  /**
   * 初始化统一重叠计算器
   */
  private initializeOverlapCalculator(options: Required<ChunkingOptions>): void {
    if (!options.customParams?.enableChunkDeduplication) {
      return;
    }

    this.unifiedOverlapCalculator = new OverlapCalculator({
      maxSize: options.overlapSize || 200,
      minLines: 1,
      maxOverlapRatio: options.customParams?.maxOverlapRatio || 0.3,
      maxOverlapLines: options.customParams?.maxOverlapLines || 50,
      enableASTBoundaryDetection: options.customParams?.enableASTBoundaryDetection || false,
      enableNodeAwareOverlap: options.customParams?.astNodeTracking || false,
      enableSmartDeduplication: true,
      similarityThreshold: options.customParams?.deduplicationThreshold || 0.8,
      mergeStrategy: options.customParams?.chunkMergeStrategy || 'conservative',
      nodeTracker: this.nodeTracker,
      logger: this.logger
    });
  }

  /**
   * 判断是否为代码文件
   */
  private isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r',
      'html', 'css', 'scss', 'less', 'xml', 'json', 'yaml', 'yml'
    ];
    return codeLanguages.includes(language.toLowerCase());
  }

  /**
   * 处理代码文件分块
   * 只对过大的块进行重叠拆分
   */
  private processCodeFileChunks(
    chunks: CodeChunk[],
    context: PostProcessingContext
  ): CodeChunk[] {
    const finalChunks: CodeChunk[] = [];
    const maxChunkSize = context.options.maxChunkSize || 1000;

    for (const chunk of chunks) {
      // 只对过大的块进行重叠拆分
      if (chunk.content.length > maxChunkSize) {
        const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, context);
        // 对拆分后的块进行去重
        const deduplicatedChunks = DeduplicationUtils.deduplicateChunks(overlappedChunks);
        finalChunks.push(...deduplicatedChunks);
        this.logger?.debug(`Split large code chunk (${chunk.content.length} chars) into ${overlappedChunks.length} parts, deduplicated to ${deduplicatedChunks.length} parts`);
      } else {
        // 检查是否与已处理的块重复
        let isDuplicate = false;
        for (const existingChunk of finalChunks) {
          if (DeduplicationUtils.isDuplicateChunk(chunk, existingChunk)) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          finalChunks.push(chunk);
        } else {
          this.logger?.debug(`Skipping duplicate code chunk at lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
        }
      }
    }

    return finalChunks;
  }

  /**
   * 处理文本文件分块
   * 为所有块添加重叠内容
   */
  private processTextFileChunks(
    chunks: CodeChunk[],
    context: PostProcessingContext
  ): CodeChunk[] {
    const overlappedChunks: CodeChunk[] = [];
    const overlapSize = context.options.overlapSize || 200;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 检查是否与已处理的块重复
      let isDuplicate = false;
      for (const existingChunk of overlappedChunks) {
        if (DeduplicationUtils.isDuplicateChunk(chunk, existingChunk)) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        this.logger?.debug(`Skipping duplicate text chunk at lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
        continue;
      }

      if (i < chunks.length - 1) {
        const overlapContent = this.calculateOverlapContent(
          chunk,
          chunks[i + 1],
          context.originalContent,
          overlapSize
        );

        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }

    // 对最终结果进行去重
    const deduplicatedChunks = DeduplicationUtils.deduplicateChunks(overlappedChunks);
    if (deduplicatedChunks.length < overlappedChunks.length) {
      this.logger?.debug(`Deduplicated text chunks: ${overlappedChunks.length} -> ${deduplicatedChunks.length}`);
    }

    return deduplicatedChunks;
  }

  /**
   * 带重叠的大块拆分
   */
  private splitLargeChunkWithOverlap(
    chunk: CodeChunk,
    context: PostProcessingContext
  ): CodeChunk[] {
    const content = chunk.content;
    const maxChunkSize = context.options.maxChunkSize || 1000;
    const overlapSize = context.options.overlapSize || 200;
    const maxOverlapRatio = context.options.customParams?.maxOverlapRatio || 0.3;

    // 调试信息
    this.logger?.debug(`Splitting chunk: content length=${content.length}, maxChunkSize=${maxChunkSize}`);

    // 计算最大允许重叠大小
    const maxOverlapSize = Math.min(
      overlapSize,
      Math.floor(maxChunkSize * maxOverlapRatio)
    );

    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let currentLine = chunk.metadata.startLine;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查是否应该分割 - 考虑重叠空间
      const projectedSize = currentSize + lineSize;
      const needsSplit = projectedSize > (maxChunkSize - maxOverlapSize) && currentChunk.length > 0;

      if (needsSplit) {
        // 创建当前块
        const chunkContent = currentChunk.join('\n');
        chunks.push(this.createSubChunk(chunk, chunkContent, currentLine, currentLine + currentChunk.length - 1));

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
      chunks.push(this.createSubChunk(chunk, chunkContent, currentLine, currentLine + currentChunk.length - 1));
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查是否应该分割 - 考虑重叠空间
      const projectedSize = currentSize + lineSize;
      const needsSplit = projectedSize > (maxChunkSize - maxOverlapSize) && currentChunk.length > 0;

      if (needsSplit || i === lines.length - 1) {
        // 创建当前块
        const chunkContent = currentChunk.join('\n');
        chunks.push(this.createSubChunk(chunk, chunkContent, currentLine, currentLine + currentChunk.length - 1));

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
      chunks.push(this.createSubChunk(chunk, chunkContent, currentLine, currentLine + currentChunk.length - 1));
    }

    this.logger?.debug(`Split result: ${chunks.length} chunks created`);
    return chunks;
  }

  /**
   * 计算智能重叠行
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
   * 计算重叠内容
   */
  private calculateOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string,
    overlapSize: number
  ): string {
    const currentEndLine = currentChunk.metadata.endLine;
    const nextStartLine = nextChunk.metadata.startLine;

    // 如果块相邻或重叠，不添加重叠内容
    if (currentEndLine >= nextStartLine) {
      return '';
    }

    // 如果原始内容为空，返回空字符串
    if (!originalContent) {
      return '';
    }

    const lines = originalContent.split('\n');
    const overlapLines = [];

    // 计算最大重叠行数
    const estimatedLineLength = 50; // 假设平均每行50字符
    const maxOverlapLinesBySize = Math.floor(overlapSize / estimatedLineLength);
    const maxOverlapLinesByContext = Math.max(1, Math.floor((currentEndLine - currentChunk.metadata.startLine + 1) * 0.3));
    const maxOverlapLines = Math.min(maxOverlapLinesBySize, maxOverlapLinesByContext);

    // 确保至少有一行重叠（除非是最后一行）
    const effectiveMaxOverlapLines = Math.max(1, maxOverlapLines);

    // 从下一个块的开始获取重叠内容
    for (let i = currentEndLine; i < Math.min(lines.length, currentEndLine + effectiveMaxOverlapLines); i++) {
      if (i < lines.length) {
        overlapLines.push(lines[i]);
      }
    }

    return overlapLines.join('\n');
  }

  /**
   * 智能重叠计算（基于语义边界）
   */
  private calculateSemanticOverlap(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalContent: string
  ): string {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    // 寻找语义边界
    const semanticBoundary = this.findSemanticBoundary(currentLines, nextLines);

    if (semanticBoundary) {
      return semanticBoundary;
    }

    // 如果没有找到语义边界，使用简单的重叠
    return this.calculateOverlapContent(currentChunk, nextChunk, originalContent, 200);
  }

  /**
   * 寻找语义边界
   */
  private findSemanticBoundary(currentLines: string[], nextLines?: string[]): string | null {
    // 检查当前块的末尾是否有完整的语义单元
    const lastLines = currentLines.slice(-5); // 检查最后5行

    // 首先检查是否有函数定义
    for (let i = 0; i < lastLines.length; i++) {
      const line = lastLines[i].trim();

      // 查找函数定义
      if (line.startsWith('function ') || line.includes('function ')) {
        // 找到函数开始，返回从这一行开始的内容
        return lastLines.slice(i).join('\n');
      }
    }

    // 如果没有找到函数定义，检查其他语义边界
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i].trim();

      // 如果找到完整的函数/类结束，可以作为重叠点
      if (line.match(/^[}\)]\s*$/) || line.match(/^\s*(end|endif|endforeach|endforeach)\b/i)) {
        return lastLines.slice(i).join('\n');
      }

      // 如果找到空行，也可以作为重叠点
      if (line === '') {
        return lastLines.slice(i).join('\n');
      }
    }

    return null;
  }

  /**
   * 创建子块
   */
  private createSubChunk(
    parentChunk: CodeChunk,
    content: string,
    startLine: number,
    endLine: number
  ): CodeChunk {
    return new CodeChunkBuilder()
      .setContent(content)
      .setStartLine(startLine)
      .setEndLine(endLine)
      .setLanguage(parentChunk.metadata.language)
      .setFilePath(parentChunk.metadata.filePath || '')
      .setStrategy(parentChunk.metadata.strategy)
      .setType(parentChunk.metadata.type || ChunkType.GENERIC)
      .setComplexity(parentChunk.metadata.complexity || 0)
      .addMetadata('functionName', parentChunk.metadata.functionName)
      .addMetadata('className', parentChunk.metadata.className)
      .build();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.unifiedOverlapCalculator?.clearHistory();
  }
}