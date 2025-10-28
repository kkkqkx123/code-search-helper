import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk } from '../../types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import Parser from 'tree-sitter';
import { ClassStrategy as ImportedClassStrategy } from '../impl/ClassStrategy';

/**
 * 类分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class ClassSplitStrategy implements ISplitStrategy {
  private classStrategy: ImportedClassStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.classStrategy = new ImportedClassStrategy(this.logger, this.treeSitterService);
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
      this.logger?.warn('TreeSitterService not available, falling back to basic class strategy');
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

      // 使用ClassStrategy提取类
      const classes = await this.treeSitterService.extractClasses(parseResult.ast);
      this.logger?.debug(`TreeSitter extracted ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: CodeChunk[] = [];

      // 处理类定义
      for (const cls of classes) {
        // 使用ClassStrategy来处理类节点
        const classChunks = await this.classStrategy.extractClasses(content, cls, language, filePath, nodeTracker);
        chunks.push(...classChunks);
      }

      // 如果没有提取到任何类，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No classes found by TreeSitter');
        throw new Error('No classes found by TreeSitter');
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Class strategy failed: ${error}`);

      // 如果失败，抛出错误让工厂选择其他策略
      throw error;
    }
  }

  getName(): string {
    return 'class_split_strategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract class definitions';
  }

  supportsLanguage(language: string): boolean {
    return this.classStrategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 2; // 中等优先级
  }

  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean {
    return this.classStrategy.supportsLanguage(language);
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return new Set(['class_declaration', 'interface_declaration']);
  }
}

/**
 * 类策略提供者
 * 负责创建类策略实例
 */
@injectable()
export class ClassStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'class_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ClassSplitStrategy(
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
    return 2; // 中等优先级
  }

  getDescription(): string {
    return 'Provides class-based code splitting using TreeSitter';
  }
}