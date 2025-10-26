import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../../splitting';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';

/**
 * 行级策略实现
 * 实现ISplitStrategy接口，使用简单的行分段
 */
@injectable()
export class LineSplitStrategy implements ISplitStrategy {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    this.logger?.debug(`Using line strategy for ${filePath}`);

    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, returning single chunk');
      // 如果没有UniversalTextSplitter，返回一个包含全部内容的简单块
      return [{
        id: `line_fallback_${Date.now()}`,
        content,
        metadata: {
          startLine: 1,
          endLine: content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'line' as const,
          fallback: true
        }
      }];
    }

    try {
      const chunks = await this.universalTextSplitter.chunkByLines(content, filePath || '', language);

      // 为每个块添加ID并确保类型正确
      return chunks.map((chunk, index) => ({
        id: `line_${Date.now()}_${index}`,
        content: typeof chunk === 'string' ? chunk : chunk.content,
        metadata: {
          startLine: chunk.metadata?.startLine || 1,
          endLine: chunk.metadata?.endLine || content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'line' as const,
          ...(typeof chunk === 'object' ? chunk.metadata : {})
        }
      }));
    } catch (error) {
      this.logger?.error(`Line strategy failed: ${error}`);
      
      // 如果失败，返回一个包含整个内容的单一块
      return [{
        id: `emergency_${Date.now()}`,
        content,
        metadata: {
          startLine: 1,
          endLine: content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'line' as const, // 使用line类型而不是emergency
          fallback: true,
          error: (error as Error).message
        }
      }];
    }
  }

  getName(): string {
    return 'LineStrategy';
  }

  getDescription(): string {
    return 'Uses simple line-based splitting as a reliable fallback';
  }

  supportsLanguage(language: string): boolean {
    // 行级策略支持所有语言
    return true;
  }

  getPriority(): number {
    return 10; // 最低优先级，作为最后的降级选项
  }
}

/**
 * 行级策略提供者
 */
@injectable()
export class LineStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  getName(): string {
    return 'universal_line';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new LineSplitStrategy(
      options?.universalTextSplitter || this.universalTextSplitter,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['UniversalTextSplitter'];
  }

  supportsLanguage(language: string): boolean {
    return true; // 支持所有语言
  }

  getPriority(): number {
    return 10; // 最低优先级
  }

  getDescription(): string {
    return 'Provides simple line-based code splitting as a fallback';
  }
}