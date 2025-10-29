import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionService';
import { CodeChunk, CodeChunkMetadata } from '../../../types/core-types';

/**
 * 语义分段策略
 * 职责：基于语义边界进行分段，支持普通和精细两种模式
 */
@injectable()
export class SemanticSegmentationStrategy implements IProcessingStrategy {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
    this.logger?.debug('SemanticSegmentationStrategy initialized');
  }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Semantic segmentation strategy for ${filePath}`);

    // 验证上下文
    const validationResult = this.validateContext(content, detection.language);
    if (!validationResult) {
      this.logger?.warn('Context validation failed for semantic strategy, proceeding anyway');
    } else {
      this.logger?.debug('Context validation passed for semantic strategy');
    }

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    let currentChunk: string[] = [];
    let currentLine = 1;
    let semanticScore = 0;

    // 检查是否使用精细模式
    const isFineMode = this.isFineMode(content, detection.language);

    // 根据模式设置参数
    const maxChunkSize = isFineMode ? 800 : 2000;
    const maxLinesPerChunk = isFineMode ? 20 : 50;
    const semanticThreshold = isFineMode ? 1000 : 2000;
    const minChunkLines = isFineMode ? 3 : 5;

    // 内存保护：限制处理的行数
    const maxLines = Math.min(lines.length, 10000);

    for (let i = 0; i < maxLines; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 计算语义分数
      const lineScore = this.calculateSemanticScore(trimmedLine, detection.language);
      semanticScore += lineScore;

      // 决定是否分段
      const shouldSplit = this.shouldSplitAtSemanticBoundary(
        trimmedLine,
        currentChunk,
        semanticScore,
        i,
        maxLines,
        maxChunkSize,
        maxLinesPerChunk,
        semanticThreshold,
        minChunkLines
      );

      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: detection.language || 'unknown',
            filePath,
            type: 'semantic',
            complexity: this.calculateComplexity(chunkContent),
            fineMode: isFineMode
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
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: detection.language || 'unknown',
          filePath,
          type: 'semantic',
          complexity: this.calculateComplexity(chunkContent),
          fineMode: isFineMode
        }
      });
    }

    this.logger?.debug(`Semantic segmentation (${isFineMode ? 'fine' : 'normal'} mode) created ${chunks.length} chunks`);
    return { chunks, metadata: { strategy: 'SemanticSegmentationStrategy', fineMode: isFineMode } };
  }

  getName(): string {
    return 'SemanticSegmentationStrategy';
  }

  getDescription(): string {
    return 'Uses semantic boundary detection for code splitting with fine-grained mode support';
  }

  /**
   * 验证上下文是否适合语义分段
   */
  private validateContext(content: string, language?: string): boolean {
    // 验证上下文是否适合语义分段
    if (!content || content.trim().length === 0) {
      return false;
    }

    const lineCount = content.split('\n').length;
    if (lineCount < 5) {
      return false; // 太短的文件不适合语义分段
    }

    return true;
  }

  /**
   * 检查是否应该使用精细模式
   */
  private isFineMode(content: string, language?: string): boolean {
    // 根据文件大小自动决定：中等大小文件使用精细模式
    const lineCount = content.split('\n').length;
    return lineCount >= 50 && lineCount <= 500;
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
    maxLines: number,
    maxChunkSize: number,
    maxLinesPerChunk: number,
    semanticThreshold: number,
    minChunkLines: number
  ): boolean {
    // 大小限制检查
    if (semanticScore > semanticThreshold) {
      return true;
    }

    // 块大小限制检查
    const chunkContent = currentChunk.join('\n');
    if (chunkContent.length > maxChunkSize || currentChunk.length > maxLinesPerChunk) {
      return true;
    }

    // 逻辑边界检查
    const trimmedLine = line.trim();

    // 函数/类定义结束
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > minChunkLines) {
      return true;
    }

    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/) && currentChunk.length > Math.max(3, minChunkLines - 2)) {
      return true;
    }

    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > minChunkLines) {
      return true;
    }

    // 注释行作为分割点
    if ((trimmedLine.match(/^\s*\//) || trimmedLine.match(/^\s*\/\*/) ||
      trimmedLine.match(/^\s*\*/) || trimmedLine.match(/^\s*#/)) &&
      currentChunk.length > Math.max(3, minChunkLines - 2)) {
      return true;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
  }

  /**
   * 计算复杂度
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
}