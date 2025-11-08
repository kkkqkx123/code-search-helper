/**
 * 括号平衡策略
 * 基于括号平衡进行代码分割的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';
import { BRACKET_STRATEGY_SUPPORTED_LANGUAGES } from '../../../constants/StrategyPriorities';

/**
 * 括号平衡策略实现
 */
export class BracketStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'bracket-strategy',
      supportedLanguages: BRACKET_STRATEGY_SUPPORTED_LANGUAGES,
      enabled: true,
      description: 'Bracket balance-based code splitting strategy',
      parameters: {
        maxChunkSize: 1500,
        minChunkSize: 100,
        bracketPairs: ['{}', '()', '[]'],
        enableBracketBalance: true,
        enableLineBalance: true,
        maxImbalance: 2
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

    // 检查内容是否包含括号
    const bracketPairs = this.config.parameters?.bracketPairs || ['{}', '()', '[]'];
    const hasBrackets = bracketPairs.some((pair: { split: (arg0: string) => [any, any]; }) => {
      const [open, close] = pair.split('');
      return context.content.includes(open) && context.content.includes(close);
    });

    if (!hasBrackets) {
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
      const chunks = this.splitByBracketBalance(context);
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
   * 基于括号平衡分割代码
   */
  private splitByBracketBalance(context: IProcessingContext): any[] {
    const { content, language, filePath } = context;
    const lines = content.split('\n');

    const maxChunkSize = this.config.parameters?.maxChunkSize || 1500;
    const minChunkSize = this.config.parameters?.minChunkSize || 100;
    const bracketPairs = this.config.parameters?.bracketPairs || ['{}', '()', '[]'];
    const enableBracketBalance = this.config.parameters?.enableBracketBalance !== false;
    const enableLineBalance = this.config.parameters?.enableLineBalance !== false;
    const maxImbalance = this.config.parameters?.maxImbalance || 2;

    const chunks: any[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let currentLine = 1;
    let bracketBalance: Record<string, number> = {};

    // 初始化括号平衡计数器
    bracketPairs.forEach((pair: { split: (arg0: string) => [any, any]; }) => {
      const [open, close] = pair.split('');
      bracketBalance[open] = 0;
      bracketBalance[close] = 0;
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 更新括号平衡
      if (enableBracketBalance) {
        this.updateBracketBalance(line, bracketBalance, bracketPairs);
      }

      // 计算当前不平衡度
      const imbalance = this.calculateImbalance(bracketBalance, bracketPairs);

      // 决定是否在此处分段
      const shouldSplit = (
        currentSize + line.length > maxChunkSize && currentSize >= minChunkSize
      ) || (
          enableBracketBalance && imbalance <= maxImbalance && currentSize >= minChunkSize
        ) || (
          enableLineBalance && this.isGoodLineBoundary(line, currentChunk) && currentSize >= minChunkSize
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
            bracketBalance: { ...bracketBalance },
            imbalance
          }
        );

        chunks.push(chunk);

        // 开始新块
        currentChunk = [];
        currentSize = 0;
        currentLine = i + 1;

        // 重置括号平衡计数器
        if (enableBracketBalance) {
          bracketPairs.forEach((pair: { split: (arg0: string) => [any, any]; }) => {
            const [open, close] = pair.split('');
            bracketBalance[open] = 0;
            bracketBalance[close] = 0;
          });
        }
      }

      currentChunk.push(line);
      currentSize += line.length + 1; // +1 for newline character
    }

    // 处理最后的块
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);
      const imbalance = this.calculateImbalance(bracketBalance, bracketPairs);

      const chunk = this.createChunk(
        chunkContent,
        currentLine,
        currentLine + currentChunk.length - 1,
        language,
        this.detectChunkType(chunkContent),
        {
          filePath,
          complexity,
          bracketBalance: { ...bracketBalance },
          imbalance
        }
      );

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * 更新括号平衡计数
   */
  private updateBracketBalance(
    line: string,
    bracketBalance: Record<string, number>,
    bracketPairs: string[]
  ): void {
    bracketPairs.forEach(pair => {
      const [open, close] = pair.split('');

      // 计算开括号数量
      const openCount = (line.match(new RegExp('\\' + open, 'g')) || []).length;
      bracketBalance[open] = (bracketBalance[open] || 0) + openCount;

      // 计算闭括号数量
      const closeCount = (line.match(new RegExp('\\' + close, 'g')) || []).length;
      bracketBalance[close] = (bracketBalance[close] || 0) + closeCount;
    });
  }

  /**
   * 计算不平衡度
   */
  private calculateImbalance(
    bracketBalance: Record<string, number>,
    bracketPairs: string[]
  ): number {
    let totalImbalance = 0;

    bracketPairs.forEach(pair => {
      const [open, close] = pair.split('');
      const openCount = bracketBalance[open] || 0;
      const closeCount = bracketBalance[close] || 0;
      totalImbalance += Math.abs(openCount - closeCount);
    });

    return totalImbalance;
  }

  /**
   * 判断是否为良好的行边界
   */
  private isGoodLineBoundary(line: string, currentChunk: string[]): boolean {
    const trimmedLine = line.trim();

    // 空行是良好的边界
    if (trimmedLine === '') {
      return true;
    }

    // 注释行是良好的边界
    if (/^\s*\/\*|^\s*\*|^\s*\/\//.test(trimmedLine)) {
      return true;
    }

    // 包含大括号的行可能是良好的边界
    if (trimmedLine.includes('{') || trimmedLine.includes('}')) {
      return true;
    }

    // 函数或类定义行是良好的边界
    if (/^\s*(function|def|class|interface)\s+\w+/.test(trimmedLine)) {
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