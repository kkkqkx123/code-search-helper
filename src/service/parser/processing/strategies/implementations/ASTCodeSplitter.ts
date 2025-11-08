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

@injectable()
export class ASTCodeSplitter {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LanguageDetectionService) private languageDetectionService: LanguageDetectionService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) { }

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

    // 简单的实现：按函数和类分割
    // 这里应该使用更复杂的AST遍历逻辑
    // 暂时返回整个文件作为一个块作为占位符
    const metadata: ChunkMetadata = {
      startLine: 1,
      endLine: lines.length,
      language,
      filePath,
      strategy: 'ast-splitter',
      timestamp: Date.now(),
      type: ChunkType.GENERIC,
      size: content.length,
      lineCount: lines.length
    };

    chunks.push({
      content,
      metadata
    });

    return chunks;
  }
}
