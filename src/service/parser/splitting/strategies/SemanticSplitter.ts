import { SemanticSplitter as SemanticSplitterInterface, SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { LoggerService } from '../../../../utils/LoggerService';

export class SemanticSplitter implements SemanticSplitterInterface {
  private options: Required<ChunkingOptions>;
  private complexityCalculator?: ComplexityCalculator;
  private logger?: LoggerService;
  private maxLines: number = 10000; // 默认最大处理行数

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  setComplexityCalculator(complexityCalculator: ComplexityCalculator): void {
    this.complexityCalculator = complexityCalculator;
  }

  setMaxLines(maxLines: number): void {
    this.maxLines = maxLines;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const mergedOptions = { ...this.options, ...options };
    return this.createSemanticFallbackChunks(content, language, filePath, mergedOptions);
  }

  private createSemanticFallbackChunks(
    content: string,
    language: string,
    filePath?: string,
    options: Required<ChunkingOptions> = this.options
  ): CodeChunk[] {
    // 确保complexityCalculator已初始化
    if (!this.complexityCalculator) {
      this.complexityCalculator = new ComplexityCalculator();
    }

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let semanticScore = 0;

    // 添加内存保护：限制处理的行数，避免处理超大文件时内存占用过高
    const maxLines = Math.min(lines.length, this.maxLines);

    for (let i = 0; i < maxLines; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 计算语义分数
      const lineScore = this.complexityCalculator.calculateSemanticScore(trimmedLine);
      semanticScore += lineScore;

      // 决定是否分段
      const shouldSplit = semanticScore > this.options.maxChunkSize * 0.8 ||
        (trimmedLine === '' && currentChunk.length > 3) ||
        i === maxLines - 1;

      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.complexityCalculator.calculate(chunkContent);

        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language,
          filePath,
          type: 'semantic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });

        currentChunk = [];
        currentLine = i + 1;
        semanticScore = 0;
      }

      currentChunk.push(line);

      // 每处理1000行检查一次内存使用情况
      if (i > 0 && i % 1000 === 0) {
        const currentMemory = process.memoryUsage();
        if (currentMemory.heapUsed / currentMemory.heapTotal > 0.85) {
          this.logger?.warn(`High memory usage detected during semantic fallback chunking, stopping at line ${i}`);
          break; // 如果内存使用过高，停止处理
        }
      }
    }

    // 处理最后的chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.complexityCalculator.calculate(chunkContent);

      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language,
        filePath,
        type: 'semantic',
        complexity
      };

      chunks.push({
        content: chunkContent,
        metadata
      });
    }

    return chunks;
  }

  getName(): string {
    return 'SemanticSplitter';
  }

  supportsLanguage(language: string): boolean {
    return true; // 语义分段器支持所有语言
  }

  getPriority(): number {
    return 5; // 最低优先级（作为最后的后备方案）
  }
}