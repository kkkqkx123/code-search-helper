import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { SemanticSplitter } from '../impl/SemanticStrategy';
import { ComplexityCalculator } from '../../../splitting/utils/ComplexityCalculator';

/**
 * 语义分段策略实现
 * 实现ISplitStrategy接口，使用语义分数进行后备分割
 */
@injectable()
export class SemanticStrategy implements ISplitStrategy {
  private semanticSplitter: SemanticSplitter;

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.semanticSplitter = new SemanticSplitter();
    // 通过直接赋值来设置logger
    (this.semanticSplitter as any).logger = this.logger;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    try {
      // 使用SemanticSplitter进行分割
      return await this.semanticSplitter.split(content, language, filePath, options);
    } catch (error) {
      this.logger?.error(`Semantic strategy failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'semantic_strategy';
  }

  getDescription(): string {
    return 'Uses semantic scoring as a fallback strategy for code splitting';
  }

  supportsLanguage(language: string): boolean {
    return this.semanticSplitter.supportsLanguage(language);
  }

  getPriority(): number {
    return 5; // 最低优先级（作为最后的后备方案）
  }
}

/**
 * 语义策略提供者
 * 负责创建语义策略实例
 */
@injectable()
export class SemanticStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'semantic_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new SemanticStrategy(
      this.logger
    );

    return strategy;
  }

  getDependencies(): string[] {
    return ['LoggerService']; // SemanticSplitter主要依赖内部组件
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 5; // 最低优先级（作为最后的后备方案）
  }

  getDescription(): string {
    return 'Provides semantic-based fallback code splitting';
  }
}