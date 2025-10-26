import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../splitting/interfaces/ISplitStrategy';
import { IStrategyProvider, ChunkingOptions } from '../../../splitting/interfaces/IStrategyProvider';
import { CodeChunk } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { SyntaxAwareSplitter } from '../impl/SyntaxAwareStrategy';

/**
 * 语法感知分段策略实现
 * 实现ISplitStrategy接口，使用多种子分割器组合进行智能分割
 */
@injectable()
export class SyntaxAwareStrategy implements ISplitStrategy {
  private syntaxAwareSplitter: SyntaxAwareSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.syntaxAwareSplitter = new SyntaxAwareSplitter();
    if (this.treeSitterService) {
      this.syntaxAwareSplitter.setTreeSitterService(this.treeSitterService);
    }
    if (this.logger) {
      this.syntaxAwareSplitter.setLogger(this.logger);
    }
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService not available, skipping syntax-aware strategy');
      return [];
    }

    try {
      // 使用SyntaxAwareSplitter进行分割
      return await this.syntaxAwareSplitter.split(content, language, filePath, options);
    } catch (error) {
      this.logger?.error(`Syntax-aware strategy failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'syntax_aware_strategy';
  }

  getDescription(): string {
    return 'Uses multiple sub-strategies (function, class, import) for syntax-aware code splitting';
  }

  supportsLanguage(language: string): boolean {
    return this.syntaxAwareSplitter.supportsLanguage(language);
  }

  getPriority(): number {
    return 1; // 高优先级
  }
}

/**
 * 语法感知策略提供者
 * 负责创建语法感知策略实例
 */
@injectable()
export class SyntaxAwareStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'syntax_aware_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new SyntaxAwareStrategy(
      this.treeSitterService,
      this.logger
    );

    // 如果提供了选项，也应用到内部的SyntaxAwareSplitter
    if (options) {
      const syntaxSplitter = (strategy as any).syntaxAwareSplitter as SyntaxAwareSplitter;
      // 重新创建SyntaxAwareSplitter以应用选项
      const newSyntaxSplitter = new SyntaxAwareSplitter(options);
      if (this.treeSitterService) {
        newSyntaxSplitter.setTreeSitterService(this.treeSitterService);
      }
      if (this.logger) {
        newSyntaxSplitter.setLogger(this.logger);
      }
      (strategy as any).syntaxAwareSplitter = newSyntaxSplitter;
    }

    return strategy;
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  getDescription(): string {
    return 'Provides syntax-aware code splitting using multiple sub-strategies';
  }
}