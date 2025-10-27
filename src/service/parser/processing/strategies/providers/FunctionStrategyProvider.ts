import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import Parser from 'tree-sitter';
import { FunctionChunkingStrategy } from '../FunctionChunkingStrategy';

/**
 * 函数分段策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class FunctionSplitStrategy implements ISplitStrategy {
  private functionChunkingStrategy: FunctionChunkingStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.functionChunkingStrategy = new FunctionChunkingStrategy();
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

      // 使用原有的FunctionChunkingStrategy提取函数
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast);
      this.logger?.debug(`TreeSitter extracted ${functions.length} functions`);

      // 将AST节点转换为CodeChunk
      const chunks: CodeChunk[] = [];

      // 处理函数定义
      for (const func of functions) {
        // 使用原有的策略来处理函数节点
        if (this.functionChunkingStrategy.canHandle(language, func)) {
          const funcChunks = this.functionChunkingStrategy.chunk(func, content);
          // 转换类型以匹配ISplitStrategy接口
          for (const chunk of funcChunks) {
            const convertedChunk: CodeChunk = {
              id: `func_${Date.now()}_${chunks.length}`,
              content: chunk.content,
              metadata: {
                startLine: chunk.metadata.startLine,
                endLine: chunk.metadata.endLine,
                language: chunk.metadata.language,
                type: 'function',
                functionName: chunk.metadata.functionName,
                complexity: chunk.metadata.complexity,
                nestingLevel: chunk.metadata.nestingLevel,
                hasSideEffects: chunk.metadata.hasSideEffects
              }
            };
            chunks.push(convertedChunk);
          }
        }
      }

      // 如果没有提取到任何函数，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No functions found by TreeSitter');
        throw new Error('No functions found by TreeSitter');
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Function strategy failed: ${error}`);

      // 如果失败，抛出错误让工厂选择其他策略
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
    return this.functionChunkingStrategy.supportedLanguages.includes(language.toLowerCase());
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean {
    return this.functionChunkingStrategy.canHandle(language, node);
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return this.functionChunkingStrategy.getSupportedNodeTypes(language);
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