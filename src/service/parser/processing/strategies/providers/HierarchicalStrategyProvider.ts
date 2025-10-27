import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import Parser from 'tree-sitter';
import { HierarchicalStrategy } from '../impl/HierarchicalStrategy';

/**
 * 分层分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class HierarchicalSplitStrategy implements ISplitStrategy {
  private HierarchicalStrategy: HierarchicalStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.HierarchicalStrategy = new HierarchicalStrategy();
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
      this.logger?.warn('TreeSitterService not available, falling back to basic hierarchical strategy');
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

      // 使用原有的HierarchicalStrategy提取分层信息
      const rootNode = parseResult.ast.rootNode;
      this.logger?.debug(`TreeSitter processing hierarchical structure`);

      // 将AST节点转换为CodeChunk
      const chunks: CodeChunk[] = [];

      // 使用原有的策略来处理分层结构
      if (this.HierarchicalStrategy.supportsLanguage(language)) {
        const hierarchicalChunks = await this.HierarchicalStrategy.split(content, language, filePath);
        // 转换类型以匹配ISplitStrategy接口
        for (const chunk of hierarchicalChunks) {
          const convertedChunk: CodeChunk = {
            id: `hierarchical_${Date.now()}_${chunks.length}`,
            content: chunk.content,
            metadata: {
              startLine: chunk.metadata.startLine,
              endLine: chunk.metadata.endLine,
              language: chunk.metadata.language,
              type: chunk.metadata.type as any || 'code',
              complexity: chunk.metadata.complexity
            }
          };
          chunks.push(convertedChunk);
        }
      }

      // 如果没有提取到任何分层信息，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No hierarchical structure found by TreeSitter');
        throw new Error('No hierarchical structure found by TreeSitter');
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Hierarchical strategy failed: ${error}`);

      // 如果失败，抛出错误让工厂选择其他策略
      throw error;
    }
  }

  getName(): string {
    return 'hierarchical_split_strategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract hierarchical code structure';
  }

  supportsLanguage(language: string): boolean {
    return this.HierarchicalStrategy.supportedLanguages.includes(language.toLowerCase());
  }

  getPriority(): number {
    return 0; // 最高优先级
  }

  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean {
    return this.HierarchicalStrategy.supportsLanguage(language);
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return this.HierarchicalStrategy.getSupportedNodeTypes(language);
  }
}

/**
 * 分层策略提供者
 * 负责创建分层策略实例
 */
@injectable()
export class HierarchicalStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'hierarchical_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new HierarchicalSplitStrategy(
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
    return 0; // 最高优先级
  }

  getDescription(): string {
    return 'Provides hierarchical code splitting using TreeSitter';
  }
}