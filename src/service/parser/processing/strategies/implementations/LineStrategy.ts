/**
 * 行级分割策略
 * 基于行数进行代码分割的简单策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';

/**
 * 行级分割策略实现
 */
export class LineStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'line-strategy',
      priority: 100,
      supportedLanguages: ['*'],
      enabled: true,
      description: 'Line-based code splitting strategy',
      parameters: {
        maxLinesPerChunk: 50,
        minLinesPerChunk: 5,
        overlapLines: 5
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

    // 检查配置是否有效
    const maxLines = this.config.parameters?.maxLinesPerChunk || 50;
    if (maxLines <= 0) {
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
      const chunks = this.splitByLines(context);
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
   * 按行分割代码
   */
  private splitByLines(context: IProcessingContext): any[] {
    const { content, language, filePath } = context;
    const lines = content.split('\n');
    
    const maxLines = this.config.parameters?.maxLinesPerChunk || 50;
    const minLines = this.config.parameters?.minLinesPerChunk || 5;
    const overlapLines = this.config.parameters?.overlapLines || 5;

    const chunks: any[] = [];
    let currentLine = 0;

    while (currentLine < lines.length) {
      // 计算当前块的结束行
      let endLine = Math.min(currentLine + maxLines, lines.length);
      
      // 确保最小行数（除非到达文件末尾）
      if (endLine - currentLine < minLines && endLine < lines.length) {
        endLine = Math.min(currentLine + minLines, lines.length);
      }

      // 提取当前块的内容
      const chunkContent = lines.slice(currentLine, endLine).join('\n');
      
      // 计算复杂度
      const complexity = this.calculateComplexity(chunkContent);

      // 创建代码块
      const chunk = this.createChunk(
        chunkContent,
        currentLine + 1, // 转换为1基索引
        endLine,
        language,
        ChunkType.GENERIC,
        {
          filePath,
          complexity
        }
      );

      chunks.push(chunk);

      // 移动到下一块，考虑重叠
      currentLine = Math.max(currentLine + 1, endLine - overlapLines);
    }

    return chunks;
  }

  /**
   * 验证上下文是否有效
   */
  validateContext(context: IProcessingContext): boolean {
    if (!super.validateContext(context)) {
      return false;
    }

    // 检查内容是否包含足够的行数
    const lines = context.content.split('\n');
    const minLines = this.config.parameters?.minLinesPerChunk || 5;
    
    if (lines.length < minLines) {
      return false;
    }

    return true;
  }
}