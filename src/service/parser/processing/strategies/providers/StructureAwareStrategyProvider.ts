import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions, CodeChunk } from '../../../interfaces/ISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { StructureAwareStrategy as ImplStructureAwareStrategy, StructureAwareStrategy } from '../impl/StructureAwareStrategy';
import { IQueryResultNormalizer } from '../../../core/normalization/types';

/**
 * 结构感知分段策略实现
 * 实现ISplitStrategy接口，使用标准化查询结果进行智能分割
 */
@injectable()
export class StructureAwareSplitStrategy implements ISplitStrategy {
  private structureAwareStrategy: ImplStructureAwareStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.QueryResultNormalizer) private queryResultNormalizer?: IQueryResultNormalizer
  ) {
    this.structureAwareStrategy = new ImplStructureAwareStrategy();
    if (this.logger) {
      this.structureAwareStrategy.setLogger(this.logger);
    }
    if (this.queryResultNormalizer) {
      this.structureAwareStrategy.setQueryNormalizer(this.queryResultNormalizer);
    }
    // 如果有TreeSitterCoreService，也需要设置
    if (this.treeSitterService) {
      // 这里需要适配TreeSitterService到TreeSitterCoreService
      (this.structureAwareStrategy as any).treeSitterService = this.treeSitterService;
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
    try {
      // 使用StructureAwareStrategy进行分割
      return await this.structureAwareStrategy.split(content, language, filePath, options, nodeTracker, ast);
    } catch (error) {
      this.logger?.error(`Structure-aware strategy failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'structure_aware_strategy';
  }

  getDescription(): string {
    return 'Uses standardized query results for intelligent structure-aware code segmentation';
  }

  supportsLanguage(language: string): boolean {
    return this.structureAwareStrategy.supportsLanguage(language);
  }

  
}

/**
 * 结构感知策略提供者
 * 负责创建结构感知策略实例
 */
@injectable()
export class StructureAwareStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.QueryResultNormalizer) private queryResultNormalizer?: IQueryResultNormalizer
  ) { }

  getName(): string {
    return 'structure_aware_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new StructureAwareSplitStrategy(
      this.treeSitterService,
      this.logger,
      this.queryResultNormalizer
    );

    // 如果提供了选项，也应用到内部的StructureAwareStrategy
    if (options) {
      const structureStrategy = (strategy as any).structureAwareStrategy as StructureAwareStrategy;
      // StructureAwareStrategy构造函数不接受options参数，只接受logger和treeSitterService
      const newStructureStrategy = new StructureAwareStrategy(this.logger, this.treeSitterService);
      if (this.queryResultNormalizer) {
        newStructureStrategy.setQueryNormalizer(this.queryResultNormalizer);
      }
      (strategy as any).structureAwareStrategy = newStructureStrategy;
    }

    return strategy;
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'QueryResultNormalizer', 'LoggerService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  

  getDescription(): string {
    return 'Provides structure-aware code splitting using standardized query results';
  }

  getSupportedLanguages(): string[] {
    // 支持所有有语言适配器的语言
    return [
      'typescript',
      'javascript',
      'tsx',
      'jsx',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c',
      'c-sharp',
      'kotlin',
      'swift',
      'php',
      'ruby',
      'lua',
      'toml',
      'yaml',
      'json',
      'html',
      'css',
      'vue'
    ];
  }
}