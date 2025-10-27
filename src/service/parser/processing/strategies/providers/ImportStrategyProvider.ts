import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions, CodeChunk } from '../../../interfaces/ISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ImportStrategy as ImplImportStrategy, ImportStrategy } from '../impl/ImportStrategy';

/**
 * 导入语句分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析来提取导入语句
 */
@injectable()
export class ImportSplitStrategy implements ISplitStrategy {
  private importStrategy: ImplImportStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.importStrategy = new ImplImportStrategy();
    if (this.treeSitterService) {
      this.importStrategy.setTreeSitterService(this.treeSitterService);
    }
    if (this.logger) {
      this.importStrategy.setLogger(this.logger);
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
      this.logger?.warn('TreeSitterService not available, skipping import strategy');
      return [];
    }

    try {
      // 使用ImportStrategy进行分割
      return await this.importStrategy.split(content, language, filePath, options, nodeTracker, ast);
    } catch (error) {
      this.logger?.error(`Import strategy failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'import_strategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract import/require statements';
  }

  supportsLanguage(language: string): boolean {
    return this.importStrategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 3; // 中等优先级
  }
}

/**
 * 导入策略提供者
 * 负责创建导入策略实例
 */
@injectable()
export class ImportStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'import_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new ImportSplitStrategy(
      this.treeSitterService,
      this.logger
    );

    // 如果提供了选项，也应用到内部的ImportStrategy
    if (options) {
      const importStrategy = (strategy as any).importStrategy as ImportStrategy;
      // 重新创建ImportStrategy以应用选项
      const newImportStrategy = new ImportStrategy(this.logger, this.treeSitterService);
      if (this.treeSitterService) {
        newImportStrategy.setTreeSitterService(this.treeSitterService);
      }
      if (this.logger) {
        newImportStrategy.setLogger(this.logger);
      }
      (strategy as any).importStrategy = newImportStrategy;
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
    return 3; // 中等优先级
  }

  getDescription(): string {
    return 'Provides import/require statement-based code splitting using TreeSitter';
  }
}