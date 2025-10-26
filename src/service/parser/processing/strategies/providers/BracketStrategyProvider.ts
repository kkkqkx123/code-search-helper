import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';

/**
 * 括号平衡策略实现
 * 实现ISplitStrategy接口，使用括号和行分段
 */
@injectable()
export class BracketSplitStrategy implements ISplitStrategy {
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
  ) {
    this.logger?.debug(`Using bracket strategy for ${filePath}`);
    
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to line strategy');
      throw new Error('UniversalTextSplitter not available');
    }

    try {
      const chunks = await this.universalTextSplitter.chunkByBracketsAndLines(content, filePath || '', language);

      // 为每个块添加ID
      return chunks.map((chunk, index) => ({
        id: `bracket_${Date.now()}_${index}`,
        ...chunk
      }));
    } catch (error) {
      this.logger?.error(`Bracket strategy failed: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return 'BracketStrategy';
  }

  getDescription(): string {
    return 'Uses bracket and line-based splitting for structured content';
  }

  supportsLanguage(language: string): boolean {
    // 括号策略支持大多数结构化编程语言
    const structuredLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala',
      'json', 'yaml', 'toml'
    ];
    return structuredLanguages.includes(language.toLowerCase());
  }

  getPriority(): number {
    return 4; // 中等优先级
  }
}

/**
 * 括号策略提供者
 */
@injectable()
export class BracketStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  getName(): string {
    return 'universal_bracket';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new BracketSplitStrategy(
      options?.universalTextSplitter || this.universalTextSplitter,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['UniversalTextSplitter'];
  }

  supportsLanguage(language: string): boolean {
    const structuredLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala',
      'json', 'yaml', 'toml'
    ];
    return structuredLanguages.includes(language.toLowerCase());
  }

  getPriority(): number {
    return 4; // 中等优先级
  }

  getDescription(): string {
    return 'Provides bracket-balanced code splitting for structured content';
  }
}