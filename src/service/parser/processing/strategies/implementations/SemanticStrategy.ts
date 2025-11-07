
/**
 * 语义分割策略
 * 基于语义分析进行代码分割的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../types/Processing';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';

/**
 * 语义分割策略实现
 */
export class SemanticStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'semantic-strategy',
      priority: 80,
      supportedLanguages: ['*'],
      enabled: true,
      description: 'Semantic-based code splitting strategy',
      parameters: {
        maxChunkSize: 1000,
        minChunkSize: 100,
        semanticThreshold: 0.7,
        enableFunctionBoundary: true,
        enableClassBoundary: true,
        enableImportBoundary: true
      }
    };

    super({ ...defaultConfig, ...config });
  }

  /**
   * 判断是否可以处理给定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    if (!this.validateContext(context)) {
      return false;
    }

    // 检查是否支持该语言
    if (!this.supportsLanguage(context.language)) {
      return false;
    }

    // 检查文件是否为结构化文件
    if (!context.metadata.isStructuredFile) {
      return false;
    }

    // 检查文件是否为代码文件
    if (!context.metadata.isCodeFile) {
      return false;
    }

    return true;
  }

  /**
   * 执行代码分割策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const chunks = this.splitBySemanticBoundaries(context);
      const executionTime = Date.now() - startTime;

      return this.createSuccessResult(
        chunks,
        executionTime,
        {
          language: context.language,
          filePath: context.filePath,
          strategy: this.name,
          chunkCount: chunks.length,
          averageChunkSize: chunks.length > 0
            ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length
            : 0,
          totalSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0)
        }
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return this.createFailureResult(executionTime, errorMessage);
    }
  }

  /**
   * 基于语义边界分割代码
   */
  private splitBySemanticBoundaries(context: IProcessingContext): any[] {
    const { content, language, filePath } = context;
    const lines = content.split('\n');

    const maxChunkSize = this.config.parameters?.maxChunkSize || 1000;
    const minChunkSize = this.config.parameters?.minChunkSize || 100;
    const semanticThreshold = this.config.parameters?.semanticThreshold || 0.7;
    const enableFunctionBoundary = this.config.parameters?.enableFunctionBoundary !== false;
    const enableClassBoundary = this.config.parameters?.enableClassBoundary !== false;
    const enableImportBoundary = this.config.parameters?.enableImportBoundary !== false;

    const chunks: any[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineScore = this.calculateSemanticScore(line);

      // 检查是否为语义边界
      const isSemanticBoundary = this.isSemanticBoundary(
        line,
        enableFunctionBoundary,
        enableClassBoundary,
        enableImportBoundary
      );

      // 决定是否在此处分段
      const shouldSplit = (
        currentSize + line.length > maxChunkSize && currentSize >= minChunkSize
      ) || (
          isSemanticBoundary && currentSize >= minChunkSize && lineScore > semanticThreshold
        ) || (
          i === lines.length - 1 // 到达文件末尾
        );

      if (shouldSplit && currentChunk.length > 0) {
        // 创建当前块
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);

        const chunk = this.createChunk(
          chunkContent,
          currentLine,
          currentLine + currentChunk.length - 1,
          language,
          this.detectChunkType(chunkContent),
          {
            filePath,
            complexity,
            semanticScore: this.calculateAverageSemanticScore(currentChunk)
          }
        );

        chunks.push(chunk);

        // 开始新块
        currentChunk = [];
        currentSize = 0;
        currentLine = i + 1;
      }

      currentChunk.push(line);
      currentSize += line.length + 1; // +1 for newline character
    }

    // 处理最后的块
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);

      const chunk = this.createChunk(
        chunkContent,
        currentLine,
        currentLine + currentChunk.length - 1,
        language,
        this.detectChunkType(chunkContent),
        {
          filePath,
          complexity,
          semanticScore: this.calculateAverageSemanticScore(currentChunk)
        }
      );

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * 计算行的语义分数
   */
  private calculateSemanticScore(line: string): number {
    let score = 0;
    const trimmedLine = line.trim();

    // 函数定义
    if (/^\s*(function|def|func|method)\s+\w+/.test(trimmedLine)) {
      score += 0.9;
    }

    // 类定义
    if (/^\s*(class|interface|struct)\s+\w+/.test(trimmedLine)) {
      score += 0.9;
    }

    // 导入语句
    if (/^\s*(import|require|include|using)\s+/.test(trimmedLine)) {
      score += 0.8;
    }

    // 导出语句
    if (/^\s*export\s+/.test(trimmedLine)) {
      score += 0.8;
    }

    // 控制结构
    if (/^\s*(if|else|for|while|switch|case|try|catch|finally)\s/.test(trimmedLine)) {
      score += 0.6;
    }

    // 注释
    if (/^\s*\/\*|^\s*\*|^\s*\/\//.test(trimmedLine)) {
      score += 0.3;
    }

    // 空行
    if (trimmedLine === '') {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * 判断是否为语义边界
   */
  private isSemanticBoundary(
    line: string,
    enableFunctionBoundary: boolean,
    enableClassBoundary: boolean,
    enableImportBoundary: boolean
  ): boolean {
    const trimmedLine = line.trim();

    if (enableFunctionBoundary && /^\s*(function|def|func|method)\s+\w+/.test(trimmedLine)) {
      return true;
    }

    if (enableClassBoundary && /^\s*(class|interface|struct)\s+\w+/.test(trimmedLine)) {
      return true;
    }

    if (enableImportBoundary && /^\s*(import|require|include|using)\s+/.test(trimmedLine)) {
      return true;
    }

    return false;
  }

  /**
   * 检测代码块类型
   */
  private detectChunkType(content: string): ChunkType {
    const trimmedContent = content.trim();

    if (/^\s*(import|require|include|using)\s+/.test(trimmedContent)) {
      return ChunkType.IMPORT;
    }

    if (/^\s*export\s+/.test(trimmedContent)) {
      return ChunkType.EXPORT;
    }

    if (/^\s*(function|def|func|method)\s+\w+/.test(trimmedContent)) {
      return ChunkType.FUNCTION;
    }

    if (/^\s*(class|interface|struct)\s+\w+/.test(trimmedContent)) {
      return ChunkType.CLASS;
    }

    if (/^\s*\/\*\*|^\s*\*|^\s*\/\//.test(trimmedContent)) {
      return ChunkType.DOCUMENTATION;
    }

    return ChunkType.GENERIC;
  }

  /**
   * 计算多行的平均语义分数
   */
  private calculateAverageSemanticScore(lines: string[]): number {
    if (lines.length === 0) return 0;

    const totalScore = lines.reduce((sum, line) => sum + this.calculateSemanticScore(line), 0);
    return totalScore / lines.length;
  }

  /**
   * 验证上下文是否有效
   */
  validateContext(context: IProcessingContext): boolean {
    if (!super.validateContext(context)) {
      return false;
    }

    // 检查内容大小
    const contentSize = context.content.length;
    const minChunkSize = this.config.parameters?.minChunkSize || 100;

    if (contentSize < minChunkSize) {
      return false;
    }

    return true;
  }
}