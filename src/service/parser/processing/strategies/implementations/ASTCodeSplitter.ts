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
import { QueryResultNormalizer } from '../../../../parser/core/normalization/QueryResultNormalizer';
import { StandardizedQueryResult } from '../../../../parser/core/normalization/types';
import { TYPES } from '../../../../../types';
import { ComplexityCalculator } from '../../../../../utils/processing/ComplexityCalculator';
import { ChunkFactory } from '../../../../../utils/processing/ChunkFactory';

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
      const chunks = await this.extractChunksFromAST(ast.ast, content, filePath, language);

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
  private async extractChunksFromAST(ast: Parser.SyntaxNode, content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    try {
      // 使用QueryResultNormalizer获取标准化结果
      const normalizer = new QueryResultNormalizer();
      const standardizedResults = await normalizer.normalize(ast, language, ['functions', 'classes']);

      this.logger.debug(`Extracted ${standardizedResults.length} standardized results`);

      // 将StandardizedQueryResult转换为CodeChunk
      for (const result of standardizedResults) {
        try {
          if (result.content && result.content.trim().length > 0) {
            const chunkType = this.mapStandardizedTypeToChunkType(result.type);
            const chunkName = result.metadata?.extra?.name || result.name;

            chunks.push(ChunkFactory.createCodeChunk(
              result.content,
              result.startLine,
              result.endLine,
              language,
              chunkType,
              {
                filePath,
                [this.getEntityKey(result.type)]: chunkName,
                strategy: 'ast-splitter',
                nodeId: result.nodeId
              }
            ));
          }
        } catch (error) {
          this.logger.warn(`Failed to process standardized result: ${error}`);
          continue;
        }
      }

      // 如果没有提取到任何函数或类，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger.info('No functions or classes found by AST, returning full content as single chunk');
        chunks.push(ChunkFactory.createGenericChunk(
          content,
          1,
          lines.length,
          language,
          {
            filePath,
            reason: 'no_functions_or_classes_found',
            strategy: 'ast-splitter'
          }
        ));
      }

      return chunks;
    } catch (error) {
      this.logger.error(`Failed to extract chunks from AST: ${error}`);

      // 降级到简单分段
      return [ChunkFactory.createFallbackChunk(
        content,
        1,
        lines.length,
        language,
        'ast_processing_failed',
        {
          filePath,
          strategy: 'ast-splitter'
        }
      )];
    }
  }

  /**
   * 将StandardizedQueryResult类型映射到ChunkType
   */
  private mapStandardizedTypeToChunkType(type: StandardizedQueryResult['type']): ChunkType {
    switch (type) {
      case 'function':
        return ChunkType.FUNCTION;
      case 'class':
        return ChunkType.CLASS;
      case 'method':
        return ChunkType.FUNCTION; // 方法也作为函数类型处理
      case 'interface':
        return ChunkType.INTERFACE;
      case 'type':
      case 'type-def':
        return ChunkType.TYPE;
      default:
        return ChunkType.GENERIC;
    }
  }

  /**
   * 获取实体键名（用于元数据）
   */
  private getEntityKey(type: StandardizedQueryResult['type']): string {
    switch (type) {
      case 'function':
        return 'functionName';
      case 'class':
        return 'className';
      case 'method':
        return 'methodName';
      case 'interface':
        return 'interfaceName';
      case 'type':
      case 'type-def':
        return 'typeName';
      default:
        return 'entityName';
    }
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