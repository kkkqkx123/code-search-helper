import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import {
  ISegmentationStrategy,
  SegmentationContext,
  CodeChunk
} from '../types/SegmentationTypes';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../../core/parse/TreeSitterCoreService';

/**
 * AST分段策略
 * 使用TreeSitter进行AST解析来分段代码
 */
@injectable()
export class ASTSegmentationStrategy implements ISegmentationStrategy {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'treesitter_ast';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract functions and classes for segmentation';
  }

  getSupportedLanguages(): string[] {
    // AST策略支持大多数编程语言
    return [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, language, filePath } = context;
    
    // 确保语言不为空
    const lang = language || 'unknown';
    
    try {
      this.logger?.debug(`Starting AST segmentation for language: ${lang}, file: ${filePath}`);

      // 检查语言是否支持
      if (!this.supportsLanguage(lang)) {
        this.logger?.warn(`Language ${lang} not supported by AST strategy`);
        return this.createFallbackChunks(context);
      }

      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(content, lang);
      
      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`TreeSitter parsing failed for ${lang}`);
        return this.createFallbackChunks(context);
      }

      // 提取函数和类定义
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast, lang);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast, lang);

      this.logger?.debug(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: CodeChunk[] = [];

      // 处理函数定义
      for (const func of functions) {
        try {
          const location = this.treeSitterService.getNodeLocation(func);
          const funcText = this.treeSitterService.getNodeText(func, content);
          
          if (funcText && funcText.trim().length > 0) {
            chunks.push({
              id: `func_${Date.now()}_${chunks.length}`,
              content: funcText,
              metadata: {
                startLine: location.startLine,
                endLine: location.endLine,
                language: lang,
                filePath: filePath,
                type: 'function',
                complexity: this.calculateComplexity(funcText)
              }
            });
          }
        } catch (error) {
          this.logger?.warn(`Failed to process function node: ${error}`);
          continue;
        }
      }

      // 处理类定义
      for (const cls of classes) {
        try {
          const location = this.treeSitterService.getNodeLocation(cls);
          const clsText = this.treeSitterService.getNodeText(cls, content);
          
          if (clsText && clsText.trim().length > 0) {
            chunks.push({
              id: `class_${Date.now()}_${chunks.length}`,
              content: clsText,
              metadata: {
                startLine: location.startLine,
                endLine: location.endLine,
                language: lang,
                filePath: filePath,
                type: 'class',
                complexity: this.calculateComplexity(clsText)
              }
            });
          }
        } catch (error) {
          this.logger?.warn(`Failed to process class node: ${error}`);
          continue;
        }
      }

      // 如果没有提取到任何函数或类，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger?.info('No functions or classes found by TreeSitter, returning full content as single chunk');
        chunks.push({
          id: `full_content_${Date.now()}`,
          content: content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: lang,
            filePath: filePath,
            type: 'full_content',
            complexity: this.calculateComplexity(content),
            reason: 'no_functions_or_classes_found'
          }
        });
      }

      this.logger?.debug(`Successfully created ${chunks.length} chunks from AST segmentation`);
      return chunks;
    } catch (error) {
      this.logger?.error(`AST segmentation failed: ${error}`);
      
      // 如果失败，返回一个简单的块
      return this.createFallbackChunks(context);
    }
  }

  canHandle(context: SegmentationContext): boolean {
    const { language, content } = context;
    
    // 确保语言不为空
    const lang = language || 'unknown';
    
    // 检查语言是否支持
    if (!this.supportsLanguage(lang)) {
      return false;
    }
    
    // 检查内容是否适合AST处理（至少有一些结构）
    const hasStructure = /(?:function|func|def|class|struct|interface)\s+\w+/i.test(content);
    return hasStructure;
  }

  validateContext(context: SegmentationContext): boolean {
    return !!context.content && !!context.language;
  }

  private supportsLanguage(language: string): boolean {
    const supportedLanguages = this.getSupportedLanguages();
    return supportedLanguages.includes(language.toLowerCase());
  }

  private createFallbackChunks(context: SegmentationContext): CodeChunk[] {
    const { content, language, filePath } = context;
    const lang = language || 'unknown';
    
    return [{
      id: `fallback_${Date.now()}`,
      content,
      metadata: {
        startLine: 1,
        endLine: content.split('\n').length,
        language: lang,
        filePath: filePath,
        type: 'fallback',
        fallback: true
      }
    }];
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