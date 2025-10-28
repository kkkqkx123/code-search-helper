import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';

/**
 * AST策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class ASTSplitStrategy implements ISplitStrategy {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ) {
    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService not available, falling back to semantic strategy');
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

      // 提取函数和类定义
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast);

      this.logger?.debug(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: any[] = [];

      // 处理函数定义
      for (const func of functions) {
        const location = this.treeSitterService.getNodeLocation(func);
        const funcText = this.treeSitterService.getNodeText(func, content);

        chunks.push({
          id: `func_${Date.now()}_${chunks.length}`,
          content: funcText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: language,
            filePath: filePath,
            type: 'function',
            complexity: this.calculateComplexity(funcText)
          }
        });
      }

      // 处理类定义
      for (const cls of classes) {
        const location = this.treeSitterService.getNodeLocation(cls);
        const clsText = this.treeSitterService.getNodeText(cls, content);

        chunks.push({
          id: `class_${Date.now()}_${chunks.length}`,
          content: clsText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: language,
            filePath: filePath,
            type: 'class',
            complexity: this.calculateComplexity(clsText)
          }
        });
      }

      // 如果没有提取到任何函数或类，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No functions or classes found by TreeSitter');
        throw new Error('No functions or classes found by TreeSitter');
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`AST strategy failed: ${error}`);

      // 如果失败，返回一个简单的块
      return [{
        id: `fallback_${Date.now()}`,
        content,
        metadata: {
          startLine: 1,
          endLine: content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'fallback',
          fallback: true,
          error: (error as Error).message
        }
      }];
    }
  }

  getName(): string {
    return 'ASTStrategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract functions and classes';
  }

  supportsLanguage(language: string): boolean {
    // AST策略支持大多数编程语言
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    return supportedLanguages.includes(language.toLowerCase());
  }



  canHandleNode(language: string, node: any): boolean {
    return this.supportsLanguage(language) && node !== undefined;
  }

  private calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }
}

/**
 * AST策略提供者
 * 负责创建AST策略实例
 */
@injectable()
export class ASTStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'treesitter_ast';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ASTSplitStrategy(
      this.treeSitterService,
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
    return 'Provides AST-based code splitting using TreeSitter';
  }
}