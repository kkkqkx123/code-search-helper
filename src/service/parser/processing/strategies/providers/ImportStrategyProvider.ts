import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../splitting/interfaces/ISplitStrategy';
import { IStrategyProvider, ChunkingOptions } from '../../../splitting/interfaces/IStrategyProvider';
import { CodeChunk } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ImportSplitter } from '../../../splitting/strategies/ImportSplitter';

/**
 * 导入语句分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析来提取导入语句
 */
@injectable()
export class ImportStrategy implements ISplitStrategy {
  private importSplitter: ImportSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.importSplitter = new ImportSplitter();
    if (this.treeSitterService) {
      this.importSplitter.setTreeSitterService(this.treeSitterService);
    }
    if (this.logger) {
      this.importSplitter.setLogger(this.logger);
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
      // 使用ImportSplitter进行分割
      return await this.importSplitter.split(content, language, filePath, options, nodeTracker, ast);
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
    return this.importSplitter.supportsLanguage(language);
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
  ) {}

  getName(): string {
    return 'import_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new ImportStrategy(
      this.treeSitterService,
      this.logger
    );
    
    // 如果提供了选项，也应用到内部的ImportSplitter
    if (options) {
      const importSplitter = (strategy as any).importSplitter as ImportSplitter;
      // 重新创建ImportSplitter以应用选项
      const newImportSplitter = new ImportSplitter(options);
      if (this.treeSitterService) {
        newImportSplitter.setTreeSitterService(this.treeSitterService);
      }
      if (this.logger) {
        newImportSplitter.setLogger(this.logger);
      }
      (strategy as any).importSplitter = newImportSplitter;
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