import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions, CodeChunk } from '../../../interfaces/CoreISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { SemanticStrategy as ImportedSemanticStrategy } from '../impl/SemanticStrategy';
import { ComplexityCalculator } from '../../utils/calculation/ComplexityCalculator';

/**
 * 语义分段策略实现
 * 实现ISplitStrategy接口，使用语义分数进行后备分割
 */
@injectable()
export class SemanticSplitStrategy implements ISplitStrategy {
  private semanticStrategy: ImportedSemanticStrategy;

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.semanticStrategy = new ImportedSemanticStrategy();
    // 通过直接赋值来设置logger
    (this.semanticStrategy as any).logger = this.logger;
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
      // 使用SemanticStrategy进行分割
      return await this.semanticStrategy.split(content, language, filePath, options);
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
    return this.semanticStrategy.supportsLanguage(language);
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
    const strategy = new SemanticSplitStrategy(
      this.logger
    );

    return strategy;
  }

  getDependencies(): string[] {
    return ['LoggerService']; // SemanticStrategy主要依赖内部组件
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return 'Provides semantic-based fallback code splitting';
  }
}