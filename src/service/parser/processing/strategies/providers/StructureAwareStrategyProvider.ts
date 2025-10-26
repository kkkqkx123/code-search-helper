import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../splitting/interfaces/ISplitStrategy';
import { IStrategyProvider, ChunkingOptions } from '../../../splitting/interfaces/IStrategyProvider';
import { CodeChunk } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { StructureAwareSplitter } from '../../../splitting/strategies/StructureAwareSplitter';
import { IQueryResultNormalizer } from '../../../core/normalization/types';

/**
 * 结构感知分段策略实现
 * 实现ISplitStrategy接口，使用标准化查询结果进行智能分割
 */
@injectable()
export class StructureAwareStrategy implements ISplitStrategy {
  private structureAwareSplitter: StructureAwareSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.QueryResultNormalizer) private queryResultNormalizer?: IQueryResultNormalizer
  ) {
    this.structureAwareSplitter = new StructureAwareSplitter();
    if (this.logger) {
      this.structureAwareSplitter.setLogger(this.logger);
    }
    if (this.queryResultNormalizer) {
      this.structureAwareSplitter.setQueryNormalizer(this.queryResultNormalizer);
    }
    // 如果有TreeSitterCoreService，也需要设置
    if (this.treeSitterService) {
      // 这里需要适配TreeSitterService到TreeSitterCoreService
      (this.structureAwareSplitter as any).treeSitterService = this.treeSitterService;
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
      // 使用StructureAwareSplitter进行分割
      return await this.structureAwareSplitter.split(content, language, filePath, options, nodeTracker, ast);
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
    return this.structureAwareSplitter.supportsLanguage(language);
 }

  getPriority(): number {
    return 1; // 最高优先级
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
  ) {}

  getName(): string {
    return 'structure_aware_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new StructureAwareStrategy(
      this.treeSitterService,
      this.logger,
      this.queryResultNormalizer
    );
    
    // 如果提供了选项，也应用到内部的StructureAwareSplitter
    if (options) {
      const structureSplitter = (strategy as any).structureAwareSplitter as StructureAwareSplitter;
      // 重新创建StructureAwareSplitter以应用选项
      const newStructureSplitter = new StructureAwareSplitter(options);
      if (this.logger) {
        newStructureSplitter.setLogger(this.logger);
      }
      if (this.queryResultNormalizer) {
        newStructureSplitter.setQueryNormalizer(this.queryResultNormalizer);
      }
      if (this.treeSitterService) {
        (newStructureSplitter as any).treeSitterService = this.treeSitterService;
      }
      (strategy as any).structureAwareSplitter = newStructureSplitter;
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

  getPriority(): number {
    return 1; // 最高优先级
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