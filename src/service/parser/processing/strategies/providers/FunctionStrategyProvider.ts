import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import Parser from 'tree-sitter';
import { FunctionStrategy as ImportedFunctionStrategy } from '../impl/FunctionStrategy';

/**
 * 函数分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class FunctionSplitStrategy implements ISplitStrategy {
  private functionStrategy: ImportedFunctionStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.functionStrategy = new ImportedFunctionStrategy(this.logger, this.treeSitterService);
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
      this.logger?.warn('TreeSitterService not available, falling back to basic function strategy');
      throw new Error('TreeSitterService not available');
    }

    try {
      // 直接使用FunctionStrategy进行分割
      return await this.functionStrategy.split(content, language, filePath, options, nodeTracker, ast);
    } catch (error) {
      this.logger?.error(`Function strategy failed: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return 'function_split_strategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract function definitions';
  }

  supportsLanguage(language: string): boolean {
    return this.functionStrategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean {
    return this.functionStrategy.supportsLanguage(language);
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return new Set(['function_declaration', 'method_definition']);
  }
}

/**
 * 函数策略提供者
 * 负责创建函数策略实例
 */
@injectable()
export class FunctionStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'function_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new FunctionSplitStrategy(
      options?.treeSitterService || this.treeSitterService,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  getDescription(): string {
    return 'Provides function-based code splitting using TreeSitter';
  }
}