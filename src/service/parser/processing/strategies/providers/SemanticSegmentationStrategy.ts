import { injectable, inject } from 'inversify';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../../../universal/types/SegmentationTypes';
import { CodeChunk, CodeChunkMetadata } from '../../../splitting';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 语义分段策略
 * 职责：基于语义边界进行分段
 */
@injectable()
export class SemanticSegmentationStrategy implements ISegmentationStrategy {
  private complexityCalculator: IComplexityCalculator;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
    this.logger?.debug('SemanticSegmentationStrategy initialized');
  }

  canHandle(context: SegmentationContext): boolean {
    // 小文件不使用语义分段
    if (context.metadata.isSmallFile) {
      return false;
    }

    // Markdown文件使用专门的策略
    if (context.metadata.isMarkdownFile) {
      return false;
    }

    // 需要启用语义检测
    return context.options.enableSemanticDetection;
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath, language } = context;
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
        const complexity = this.complexityCalculator.calculate(chunkContent);

        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'semantic',
            complexity
          }
        });

        currentChunk = [];
        currentLine = i + 1;
        semanticScore = 0;
      }

      currentChunk.push(line);
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
          language: language || 'unknown',
          filePath,
          type: 'semantic',
          complexity
        }
      });
    }

    this.logger?.debug(`Semantic segmentation created ${chunks.length} chunks`);
    return chunks;
  }

  getName(): string {
    return 'semantic';
  }

  getPriority(): number {
    return 3; // 中等优先级
  }

  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust'];
  }

  validateContext(context: SegmentationContext): boolean {
    // 验证上下文是否适合语义分段
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    if (context.metadata.lineCount < 5) {
      return false; // 太短的文件不适合语义分段
    }

    return true;
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
    if (semanticScore > 2000) { // 可配置的阈值
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
    if ((trimmedLine.match(/^\s*\//) || trimmedLine.match(/^\s*\/\*/) ||
      trimmedLine.match(/^\s*\*/) || trimmedLine.match(/^\s*#/)) &&
      currentChunk.length > 3) {
      return true;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
  }
}