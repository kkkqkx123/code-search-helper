import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions, CodeChunk } from '../../../interfaces/ISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';

/**
 * 语法感知分段策略实现
 * 实现ISplitStrategy接口，使用多种子分割器组合进行智能分割
 */
@injectable()
export class SyntaxAwareStrategy implements ISplitStrategy {
  private syntaxAwareStrategy: SyntaxAwareStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.syntaxAwareStrategy = new SyntaxAwareStrategy();
    if (this.treeSitterService) {
      this.syntaxAwareStrategy.setTreeSitterService(this.treeSitterService);
    }
    if (this.logger) {
      this.syntaxAwareStrategy.setLogger(this.logger);
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
      // 使用SyntaxAwareStrategy进行分割
      return await this.syntaxAwareStrategy.split(content, language, filePath, options);
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
    return this.syntaxAwareStrategy.supportsLanguage(language);
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

    // 如果提供了选项，也应用到内部的SyntaxAwareStrategy
    if (options) {
      const syntaxStrategy = (strategy as any).syntaxAwareStrategy as SyntaxAwareStrategy;
      // 重新创建SyntaxAwareStrategy以应用选项
      const newSyntaxStrategy = new SyntaxAwareStrategy(options);
      if (this.treeSitterService) {
        newSyntaxStrategy.setTreeSitterService(this.treeSitterService);
      }
      if (this.logger) {
        newSyntaxStrategy.setLogger(this.logger);
      }
      (strategy as any).syntaxAwareStrategy = newSyntaxStrategy;
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