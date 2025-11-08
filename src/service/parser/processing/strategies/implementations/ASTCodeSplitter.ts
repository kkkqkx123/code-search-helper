/**
 * AST代码分割器
 * 基于Tree-sitter的AST解析进行智能代码分段
 */

import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { CodeChunk, ChunkMetadata, ChunkType } from '../../types/CodeChunk';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TreeSitterService } from '../../../../parser/core/parse/TreeSitterService';
import { LanguageDetectionService } from '../../../detection/LanguageDetectionService';
import { TYPES } from '../../../../../types';

interface ASTSplitterConfig {
  maxFunctionSize?: number;
  maxClassSize?: number;
  minFunctionLines?: number;
  minClassLines?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
}

@injectable()
export class ASTCodeSplitter {
  private config: ASTSplitterConfig;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LanguageDetectionService) private languageDetectionService: LanguageDetectionService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    config: ASTSplitterConfig = {}
  ) {
    this.config = {
      maxFunctionSize: 3000,
      maxClassSize: 5000,
      minFunctionLines: 3,
      minClassLines: 2,
      maxChunkSize: 1000,
      minChunkSize: 50,
      ...config
    };
  }

  /**
   * 分割代码内容
   */
  async split(content: string, filePath: string, language: string | undefined): Promise<CodeChunk[]> {
    try {
      // 检查语言支持
      if (!language || !this.languageDetectionService.isLanguageSupportedForAST(language)) {
        this.logger.debug(`Language ${language} not supported for AST splitting, skipping`);
        return [];
      }

      // 检查内容是否适合AST处理（至少有一些结构）
      const hasStructure = /(?:function|func|def|class|struct|interface)\s+\w+/i.test(content);
      if (!hasStructure) {
        this.logger.debug(`Content doesn't have AST-recognizable structure for ${filePath}`);
        return [];
      }

      // 使用Tree-sitter解析AST
      const ast = await this.treeSitterService.parseCode(content, language);
      if (!ast) {
        this.logger.warn(`Failed to parse AST for ${filePath}`);
        return [];
      }

      // 提取代码块
      const chunks = this.extractChunksFromAST(ast.ast, content, filePath, language);

      this.logger.debug(`ASTCodeSplitter produced ${chunks.length} chunks for ${filePath}`);
      return chunks;
    } catch (error) {
      this.logger.error(`ASTCodeSplitter failed for ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * 从AST中提取代码块
   */
  private extractChunksFromAST(ast: Parser.SyntaxNode, content: string, filePath: string, language: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    try {
      // 提取函数和类定义
      const functions = this.extractFunctions(ast, language);
      const classes = this.extractClasses(ast, language);

      this.logger.debug(`Extracted ${functions.length} functions and ${classes.length} classes`);

      // 处理函数定义
      for (const func of functions) {
        try {
          const location = func.location;
          const funcText = func.text;

          if (funcText && funcText.trim().length > 0) {
            chunks.push(this.createChunk(
              funcText,
              location.startLine,
              location.endLine,
              language,
              ChunkType.FUNCTION,
              {
                filePath,
                complexity: this.calculateComplexity(funcText),
                functionName: func.name,
                strategy: 'ast-splitter'
              }
            ));
          }
        } catch (error) {
          this.logger.warn(`Failed to process function node: ${error}`);
          continue;
        }
      }

      // 处理类定义
      for (const cls of classes) {
        try {
          const location = cls.location;
          const clsText = cls.text;

          if (clsText && clsText.trim().length > 0) {
            chunks.push(this.createChunk(
              clsText,
              location.startLine,
              location.endLine,
              language,
              ChunkType.CLASS,
              {
                filePath,
                complexity: this.calculateComplexity(clsText),
                className: cls.name,
                strategy: 'ast-splitter'
              }
            ));
          }
        } catch (error) {
          this.logger.warn(`Failed to process class node: ${error}`);
          continue;
        }
      }

      // 如果没有提取到任何函数或类，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger.info('No functions or classes found by AST, returning full content as single chunk');
        chunks.push(this.createChunk(
          content,
          1,
          lines.length,
          language,
          ChunkType.GENERIC,
          {
            filePath,
            complexity: this.calculateComplexity(content),
            reason: 'no_functions_or_classes_found',
            strategy: 'ast-splitter'
          }
        ));
      }

      return chunks;
    } catch (error) {
      this.logger.error(`Failed to extract chunks from AST: ${error}`);

      // 降级到简单分段
      return [this.createChunk(
        content,
        1,
        lines.length,
        language,
        ChunkType.GENERIC,
        {
          filePath,
          fallback: true,
          strategy: 'ast-splitter'
        }
      )];
    }
  }

  /**
   * 提取函数（基于AST节点遍历）
   */
  private extractFunctions(ast: Parser.SyntaxNode, language: string): Array<{
    name: string;
    text: string;
    location: { startLine: number; endLine: number };
  }> {
    const functions: Array<{
      name: string;
      text: string;
      location: { startLine: number; endLine: number };
    }> = [];

    // 根据语言定义不同的函数查询模式
    const functionQueries = this.getFunctionQueries(language);

    for (const query of functionQueries) {
      try {
        const matches = query.matches(ast);
        for (const match of matches) {
          for (const node of match.captures) {
            if (node.node.type.includes('function') || node.node.type.includes('method')) {
              const name = this.extractFunctionName(node.node);
              const text = node.node.text;
              const location = {
                startLine: node.node.startPosition.row + 1,
                endLine: node.node.endPosition.row + 1
              };

              if (name && text && this.isValidFunction(text, location)) {
                functions.push({ name, text, location });
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Function query failed for language ${language}: ${error}`);
      }
    }

    return functions;
  }

  /**
   * 提取类（基于AST节点遍历）
   */
  private extractClasses(ast: Parser.SyntaxNode, language: string): Array<{
    name: string;
    text: string;
    location: { startLine: number; endLine: number };
  }> {
    const classes: Array<{
      name: string;
      text: string;
      location: { startLine: number; endLine: number };
    }> = [];

    // 根据语言定义不同的类查询模式
    const classQueries = this.getClassQueries(language);

    for (const query of classQueries) {
      try {
        const matches = query.matches(ast);
        for (const match of matches) {
          for (const node of match.captures) {
            if (node.node.type.includes('class') || node.node.type.includes('interface') || node.node.type.includes('struct')) {
              const name = this.extractClassName(node.node);
              const text = node.node.text;
              const location = {
                startLine: node.node.startPosition.row + 1,
                endLine: node.node.endPosition.row + 1
              };

              if (name && text && this.isValidClass(text, location)) {
                classes.push({ name, text, location });
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Class query failed for language ${language}: ${error}`);
      }
    }

    return classes;
  }

  /**
   * 获取函数查询模式
   */
  private getFunctionQueries(language: string): Parser.Query[] {
    // 这里应该根据语言返回不同的查询模式
    // 简化实现，实际应该使用Tree-sitter查询语言
    return [];
  }

  /**
   * 获取类查询模式
   */
  private getClassQueries(language: string): Parser.Query[] {
    // 这里应该根据语言返回不同的查询模式
    // 简化实现，实际应该使用Tree-sitter查询语言
    return [];
  }

  /**
   * 提取函数名称
   */
  private extractFunctionName(node: Parser.SyntaxNode): string {
    // 简化实现，实际应该遍历AST节点找到函数名
    return 'function';
  }

  /**
   * 提取类名称
   */
  private extractClassName(node: Parser.SyntaxNode): string {
    // 简化实现，实际应该遍历AST节点找到类名
    return 'class';
  }

  /**
   * 验证函数是否有效
   */
  private isValidFunction(text: string, location: { startLine: number; endLine: number }): boolean {
    const lineCount = location.endLine - location.startLine + 1;
    const size = text.length;

    return (
      lineCount >= this.config.minFunctionLines! &&
      size <= this.config.maxFunctionSize! &&
      size >= this.config.minChunkSize!
    );
  }

  /**
   * 验证类是否有效
   */
  private isValidClass(text: string, location: { startLine: number; endLine: number }): boolean {
    const lineCount = location.endLine - location.startLine + 1;
    const size = text.length;

    return (
      lineCount >= this.config.minClassLines! &&
      size <= this.config.maxClassSize! &&
      size >= this.config.minChunkSize!
    );
  }

  /**
   * 创建代码块
   */
  private createChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    type: ChunkType,
    additionalMetadata: any = {}
  ): CodeChunk {
    const metadata: ChunkMetadata = {
      startLine,
      endLine,
      language,
      type,
      size: content.length,
      lineCount: endLine - startLine + 1,
      timestamp: Date.now(),
      ...additionalMetadata
    };

    return {
      content,
      metadata
    };
  }

  /**
   * 计算复杂度
   */
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

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ASTSplitterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): ASTSplitterConfig {
    return { ...this.config };
  }
}