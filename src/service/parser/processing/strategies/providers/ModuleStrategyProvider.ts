import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk } from '../../../types/core-types';
import { TreeSitterService, SyntaxNode } from '../../../core/parse/TreeSitterService';
import { ModuleStrategy as ImportedModuleStrategy } from '../impl/ModuleStrategy';

/**
 * 模块分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class ModuleSplitStrategy implements ISplitStrategy {
  private moduleStrategy: ImportedModuleStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.moduleStrategy = new ImportedModuleStrategy(this.logger, this.treeSitterService);
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
      this.logger?.warn('TreeSitterService not available, falling back to basic module strategy');
      throw new Error('TreeSitterService not available');
    }

    try {
      // 如果提供了AST，直接使用
      let parseResult = ast ? { success: true, ast } : null;

      // 如果没有提供AST，尝试解析
      if (!parseResult) {
        const detectedLanguage = await this.treeSitterService.detectLanguage(filePath || '');
        if (!detectedLanguage) {
          this.logger?.warn(`Language not supported by TreeSitter for ${filePath}`);
          throw new Error(`Language not supported by TreeSitter for ${filePath}`);
        }

        this.logger?.info(`Using TreeSitter AST parsing for ${detectedLanguage.name}`);
        parseResult = await this.treeSitterService.parseCode(content, detectedLanguage.name);
      }

      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`TreeSitter parsing failed for ${filePath}`);
        throw new Error(`TreeSitter parsing failed for ${filePath}`);
      }

      // 使用ModuleStrategy提取模块信息
      const chunks = await this.moduleStrategy.extractModuleInfo(content, parseResult.ast, language, filePath, nodeTracker);

      this.logger?.debug(`ModuleStrategy extracted ${chunks.length} chunks`);

      // 如果没有提取到任何模块信息，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No module information found by TreeSitter');
        throw new Error('No module information found by TreeSitter');
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Module strategy failed: ${error}`);

      // 如果失败，抛出错误让工厂选择其他策略
      throw error;
    }
  }

  getName(): string {
    return 'module_split_strategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract module-level information';
  }

  supportsLanguage(language: string): boolean {
    return this.moduleStrategy.supportsLanguage(language);
  }



  canHandleNode?(language: string, node: SyntaxNode): boolean {
    return this.moduleStrategy.supportsLanguage(language);
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return new Set(['import_statement', 'export_statement']);
  }
}

/**
 * 模块策略提供者
 * 负责创建模块策略实例
 */
@injectable()
export class ModuleStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'module_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ModuleSplitStrategy(
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



  getDescription(): string {
    return 'Provides module-based code splitting using TreeSitter';
  }
}