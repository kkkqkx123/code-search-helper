/**
 * AST代码分割器
 * 基于Tree-sitter的AST解析进行智能代码分段
 * 支持分层提取架构和多语言处理
 */

import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TreeSitterService } from '../../../../parser/core/parse/TreeSitterService';
import { DetectionService } from '../../../detection/DetectionService';
import { TYPES } from '../../../../../types';
import { ChunkFactory } from '../../../../../utils/processing/ChunkFactory';
import { ValidationUtils } from '../../../../../utils/processing/validation/ValidationUtils';
import { ContentAnalyzer } from '../../../../../utils/processing/ContentAnalyzer';
import { TypeMappingUtils } from '../../../../../utils/processing/TypeMappingUtils';
import { QueryResultConverter } from '../../../../../utils/processing/QueryResultConverter';
import { ComplexityCalculator } from '../../../../../utils/processing/ComplexityCalculator';
import { ICacheService } from '../../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../../infrastructure/monitoring/types';
import { SegmentationConfigService } from '../../../../../config/service/SegmentationConfigService';
import { HashUtils } from '../../../../../utils/cache/HashUtils';
import { SegmentationConfig } from '../../../../../config/ConfigTypes';
import { UnifiedContentAnalyzer } from '../../../core/normalization/ContentAnalyzer';

@injectable()
export class ASTCodeSplitter {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.DetectionService) private detectionService: DetectionService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.SegmentationConfigService) private segmentationConfigService: SegmentationConfigService,
    @inject(TYPES.UnifiedContentAnalyzer) private unifiedContentAnalyzer: UnifiedContentAnalyzer,
    @inject(TYPES.CacheService) private cacheService?: ICacheService,
    @inject(TYPES.PerformanceMonitor) private performanceMonitor?: IPerformanceMonitor
  ) {
  }

  /**
   * 获取当前配置
   */
  private get config(): SegmentationConfig {
    return this.segmentationConfigService.getConfig();
  }

  /**
   * 分割代码内容
   * 实现分层提取架构
   */
  async split(content: string, filePath: string, language: string | undefined): Promise<CodeChunk[]> {
    const startTime = Date.now();

    try {
      // 检查缓存
      if (this.config.performance?.enableCaching) {
        const cacheKey = this.generateCacheKey(content, language, filePath);
        let cached: CodeChunk[] | undefined;
        try {
          cached = this.cacheService?.getFromCache<CodeChunk[]>(cacheKey);
        } catch (error) {
          this.logger.warn(`Cache get error for key ${cacheKey}:`, error);
        }
        if (cached) {
          this.logger.debug(`Using cached result for ${filePath}`);
          return cached;
        }
      }

      // 检查语言支持
      if (!language || !ValidationUtils.isCodeFile(language)) {
        this.logger.debug(`Language ${language} not supported for AST splitting, skipping`);
        return [];
      }

      // 语言特定配置现在由SegmentationConfigService处理
      // 无需在这里手动合并

      // 检查内容是否适合AST处理
      if (!this.hasValidStructure(content, language)) {
        this.logger.debug(`Content doesn't have AST-recognizable structure for ${filePath}`);
        return [];
      }

      // 使用Tree-sitter解析AST
      const ast = await this.treeSitterService.parseCode(content, language);
      if (!ast) {
        this.logger.warn(`Failed to parse AST for ${filePath}`);
        throw new Error(`AST parsing failed for ${filePath}`);
      }

      // 提取代码块（分层提取）
      const chunks = await this.extractChunksFromAST(ast.ast, content, filePath, language);

      // 使用ComplexityCalculator计算每个块的复杂度
      const enhancedChunks = chunks.map(chunk => {
        const chunkComplexity = ComplexityCalculator.calculateComplexityByType(
          chunk.content,
          chunk.metadata.type,
          this.config
        );

        // 将复杂度信息添加到元数据中
        chunk.metadata = {
          ...chunk.metadata,
          complexity: chunkComplexity.score,
          complexityAnalysis: chunkComplexity.analysis
        };

        return chunk;
      });

      // 缓存结果
      if (this.config.performance?.enableCaching && enhancedChunks.length > 0) {
        const cacheKey = this.generateCacheKey(content, language, filePath);
        try {
          this.cacheService?.setCache(cacheKey, enhancedChunks, 300000);
        } catch (error) {
          this.logger.warn(`Cache set error for key ${cacheKey}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`ASTCodeSplitter produced ${enhancedChunks.length} chunks for ${filePath} in ${duration}ms`);

      // 记录性能统计
      try {
        this.performanceMonitor?.recordQueryExecution(duration);
        this.performanceMonitor?.updateBatchSize(enhancedChunks.length);
      } catch (error) {
        this.logger.warn('Performance recording error:', error);
      }
      this.logger.debug(`Performance: ${duration}ms for ${enhancedChunks.length} chunks, ${content.length} chars`);

      return enhancedChunks;
    } catch (error) {
      this.logger.error(`ASTCodeSplitter failed for ${filePath}: ${error}`);
      throw error;
    }
  }

  /**
   * 从AST中提取代码块
   * 实现分层提取架构
   */
  private async extractChunksFromAST(ast: Parser.SyntaxNode, content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    try {
      // 使用统一内容分析器提取所有结构
      const extractionResult = await this.unifiedContentAnalyzer.extractAllStructures(content, language, {
        includeTopLevel: true,
        includeNested: this.config.nesting.enableNestedExtraction,
        includeInternal: false, // 内部结构通常不需要作为单独的块
        maxNestingLevel: this.config.nesting.maxNestingLevel || 5,
        enableCache: this.config.performance?.enableCaching,
        enablePerformanceMonitoring: true
      });

      // 处理顶级结构
      for (const structure of extractionResult.topLevelStructures) {
        if (ValidationUtils.isValidStructure(structure)) {
          // 验证结构
          const location = structure.location;
          const isValid = this.validateStructure(structure.type, structure.content, location);

          if (isValid) {
            // 转换为分层结构
            const hierarchicalStructure = TypeMappingUtils.convertTopLevelToHierarchical(structure);

            // 转换为代码块
            const chunk = QueryResultConverter.convertSingleHierarchicalStructure(
              hierarchicalStructure,
              'ast-splitter',
              filePath
            );

            chunks.push(chunk);
          }
        }
      }

      // 处理嵌套结构
      for (const structure of extractionResult.nestedStructures) {
        if (ValidationUtils.isValidStructure(structure)) {
          // 验证结构
          const location = structure.location;
          const isValid = this.validateStructure(structure.type, structure.content, location);

          if (isValid) {
            // 转换为分层结构
            const hierarchicalStructure = TypeMappingUtils.convertNestedToHierarchical(structure);

            // 转换为代码块
            const chunk = QueryResultConverter.convertSingleHierarchicalStructure(
              hierarchicalStructure,
              'ast-splitter',
              filePath
            );

            chunks.push(chunk);
          }
        }
      }

      // 如果没有提取到任何结构，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger.info('No structures found by AST, returning full content as single chunk');
        chunks.push(ChunkFactory.createGenericChunk(
          content,
          1,
          lines.length,
          language,
          {
            filePath,
            reason: 'no_structures_found',
            strategy: 'ast-splitter'
          }
        ));
      }

      this.logger.debug(`使用统一内容分析器提取到 ${extractionResult.stats.totalStructures} 个结构，生成 ${chunks.length} 个代码块`);

      return chunks;
    } catch (error) {
      this.logger.error(`Failed to extract chunks from AST: ${error}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`AST extraction failed: ${errorMessage}`);
    }
  }

  /**
   * 提取嵌套结构
   */
  private async extractNestedStructures(
    parentStructure: any,
    content: string,
    filePath: string,
    language: string,
    level: number,
    ast?: Parser.SyntaxNode
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    if (!this.config.nesting.maxNestingLevel || level > this.config.nesting.maxNestingLevel) {
      return chunks;
    }

    try {
      const nestedStructures = await ContentAnalyzer.extractNestedStructures(
        content,
        parentStructure.node,
        level,
        ast,
        language
      );

      for (const nested of nestedStructures) {
        // 验证嵌套级别
        if (nested.level > this.config.nesting.maxNestingLevel) {
          continue;
        }

        // 根据配置决定是否保留完整实现
        const shouldPreserve = this.shouldPreserveNestedStructure(nested.type);

        let chunk: CodeChunk | CodeChunk[] | null = null;
        if (shouldPreserve) {
          const hierarchicalStructure = TypeMappingUtils.convertNestedToHierarchical(nested);
          chunk = QueryResultConverter.convertSingleHierarchicalStructure(
            hierarchicalStructure,
            'ast-splitter',
            filePath
          );
        } else {
          // 只保留签名
          chunk = this.createSignatureChunk(nested, filePath, language);
        }

        if (chunk) {
          // 如果是数组，处理每个元素
          const chunkArray = Array.isArray(chunk) ? chunk : [chunk];

          for (const c of chunkArray) {
            if (c) {
              // 计算复杂度并添加到元数据
              const nestedComplexity = ComplexityCalculator.calculateComplexityByType(
                c.content,
                c.metadata.type,
                this.config
              );

              c.metadata = {
                ...c.metadata,
                complexity: nestedComplexity.score,
                complexityAnalysis: nestedComplexity.analysis,
                nestingLevel: level
              };

              chunks.push(c);
            }
          }
        }

        // 递归提取更深层的嵌套结构
        if (level < this.config.nesting.maxNestingLevel) {
          const deeperChunks = await this.extractNestedStructures(
            nested,
            content,
            filePath,
            language,
            level + 1,
            ast
          );
          chunks.push(...deeperChunks);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to extract nested structures at level ${level}: ${error}`);
    }

    return chunks;
  }

  /**
   * 验证结构是否有效
   */
  private validateStructure(type: string, content: string, location: { startLine: number; endLine: number }): boolean {
    // 使用配置系统中的统一验证参数
    const validationConfig = {
      minChars: this.config.global.minChunkSize,
      maxChars: this.config.global.maxChunkSize,
      minLines: this.config.global.minLinesPerChunk
    };

    // 根据类型进行验证
    let isValid = this.validateByType(type, content, location, validationConfig);

    // 如果基础验证通过，进一步使用复杂度验证
    if (isValid) {
      isValid = this.validateComplexity(type, content);
    }

    return isValid;
  }

  /**
   * 根据类型进行验证
   */
  private validateByType(
    type: string,
    content: string,
    location: { startLine: number; endLine: number },
    config: { minChars: number; maxChars: number; minLines: number }
  ): boolean {
    switch (type) {
      case 'function':
        return ValidationUtils.isValidFunction(content, location, config);
      case 'class':
        return ValidationUtils.isValidClass(content, location, config);
      case 'namespace':
        return ValidationUtils.isValidNamespace(content, location, config);
      case 'template':
        return ValidationUtils.isValidTemplate(content, location, config);
      case 'import':
        return ValidationUtils.isValidImport(content, location);
      default:
        return content.length >= this.config.global.minChunkSize &&
          content.length <= this.config.global.maxChunkSize;
    }
  }

  /**
   * 验证复杂度
   */
  private validateComplexity(type: string, content: string): boolean {
    // 计算内容复杂度
    const chunkType = this.mapStringToChunkType(type);
    const structureComplexity = ComplexityCalculator.calculateComplexityByType(content, chunkType, this.config);

    // 设置复杂度阈值，过滤过于简单或过于复杂的块
    const minComplexity = 2; // 最小复杂度阈值
    const maxComplexity = 500; // 最大复杂度阈值

    const complexityValid = structureComplexity.score >= minComplexity && structureComplexity.score <= maxComplexity;

    if (!complexityValid) {
      this.logger.debug(`Structure of type ${type} failed complexity validation: score ${structureComplexity.score} (min: ${minComplexity}, max: ${maxComplexity})`);
    }

    return complexityValid;
  }

  /**
   * 将字符串类型映射到ChunkType枚举
   */
  private mapStringToChunkType(type: string): ChunkType {
    switch (type.toLowerCase()) {
      case 'function':
        return ChunkType.FUNCTION;
      case 'class':
        return ChunkType.CLASS;
      case 'method':
        return ChunkType.METHOD;
      case 'import':
        return ChunkType.IMPORT;
      case 'export':
        return ChunkType.EXPORT;
      case 'comment':
        return ChunkType.COMMENT;
      case 'documentation':
        return ChunkType.DOCUMENTATION;
      case 'variable':
        return ChunkType.VARIABLE;
      case 'interface':
        return ChunkType.INTERFACE;
      case 'type':
        return ChunkType.TYPE;
      case 'enum':
        return ChunkType.ENUM;
      case 'module':
        return ChunkType.MODULE;
      case 'block':
        return ChunkType.BLOCK;
      case 'line':
        return ChunkType.LINE;
      case 'control-flow':
        return ChunkType.CONTROL_FLOW;
      case 'expression':
        return ChunkType.EXPRESSION;
      case 'config-item':
        return ChunkType.CONFIG_ITEM;
      case 'section':
        return ChunkType.SECTION;
      case 'key':
        return ChunkType.KEY;
      case 'value':
        return ChunkType.VALUE;
      case 'array':
        return ChunkType.ARRAY;
      case 'table':
        return ChunkType.TABLE;
      case 'dependency':
        return ChunkType.DEPENDENCY;
      case 'type-def':
        return ChunkType.TYPE_DEF;
      case 'call':
        return ChunkType.CALL;
      case 'data-flow':
        return ChunkType.DATA_FLOW;
      case 'parameter-flow':
        return ChunkType.PARAMETER_FLOW;
      case 'union':
        return ChunkType.UNION;
      case 'annotation':
        return ChunkType.ANNOTATION;
      default:
        return ChunkType.GENERIC;
    }
  }

  /**
   * 将TypeMappingUtils返回的字符串转换为ChunkType枚举
   */
  private mapTypeMappingStringToChunkType(typeString: string): ChunkType {
    return this.mapStringToChunkType(typeString);
  }

  /**
   * 检查是否应该保留嵌套结构的完整实现
   */
  private shouldPreserveNestedStructure(type: string): boolean {
    switch (type) {
      case 'method':
        return true; // 方法通常保留完整实现
      case 'function':
        return false; // 嵌套函数通常只保留签名
      case 'class':
        return false; // 嵌套类通常只保留签名
      case 'control-flow':
        return true; // 控制流结构保留完整实现
      case 'expression':
        return false; // 表达式通常只保留签名
      case 'config-item':
        return true; // 配置项保留完整实现
      case 'section':
        return true; // 配置节保留完整实现
      case 'key':
        return false; // 键通常只保留签名
      case 'value':
        return false; // 值通常只保留签名
      case 'array':
        return true; // 数组保留完整实现
      case 'table':
        return true; // 表/对象保留完整实现
      case 'dependency':
        return true; // 依赖项保留完整实现
      case 'type-def':
        return true; // 类型定义保留完整实现
      case 'call':
        return false; // 函数调用通常只保留签名
      case 'data-flow':
        return true; // 数据流保留完整实现
      case 'parameter-flow':
        return false; // 参数流通常只保留签名
      case 'union':
        return true; // 联合类型保留完整实现
      case 'annotation':
        return true; // 注解保留完整实现
      default:
        return false;
    }
  }

  /**
   * 创建签名代码块
   */
  private createSignatureChunk(
    structure: any,
    filePath: string,
    language: string
  ): CodeChunk | null {
    try {
      // 提取签名（简化实现）
      const lines = structure.content.split('\n');
      const signatureLines = lines.slice(0, 1); // 只取第一行作为签名

      if (signatureLines.length === 0) return null;

      const signature = signatureLines[0].trim();
      if (!signature) return null;

      const chunk = ChunkFactory.createCodeChunk(
        signature,
        structure.location.startLine,
        structure.location.startLine,
        language,
        this.mapTypeMappingStringToChunkType(TypeMappingUtils.mapStructureTypeToChunkType(structure.type as any)),
        {
          filePath,
          strategy: 'ast-splitter',
          isSignatureOnly: true,
          originalStructure: structure.type,
          nestingLevel: structure.level
        }
      );

      // 计算复杂度并添加到元数据
      const signatureComplexity = ComplexityCalculator.calculateComplexityByType(
        chunk.content,
        chunk.metadata.type,
        this.config
      );

      chunk.metadata = {
        ...chunk.metadata,
        complexity: signatureComplexity.score,
        complexityAnalysis: signatureComplexity.analysis
      };

      return chunk;
    } catch (error) {
      this.logger.warn(`Failed to create signature chunk: ${error}`);
      return null;
    }
  }


  /**
   * 检查内容是否有有效结构
   */
  private hasValidStructure(content: string, language: string): boolean {
    // 使用ContentAnalyzer检测结构
    const structureResult = ContentAnalyzer.detectCodeStructure(content);

    // 检查是否有足够的结构
    if (structureResult.structureCount === 0) {
      return false;
    }

    // 检查置信度
    if (structureResult.confidence < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string, language: string | undefined, filePath: string): string {
    const contentHash = HashUtils.fnv1aHash(content);
    return `${filePath}:${language || 'unknown'}:${contentHash}`;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SegmentationConfig>): void {
    this.segmentationConfigService.updateConfig(config);
  }

  /**
   * 获取配置
   */
  getConfig(): SegmentationConfig {
    return this.segmentationConfigService.getConfig();
  }

  /**
  * 清除缓存
  */
  clearCache(): void {
    try {
      this.cacheService?.clearAllCache();
    } catch (error) {
      this.logger.warn('Cache clear error:', error);
    }
  }

  /**
  * 获取缓存统计
  */
  getCacheStats(): { size: number; maxSize: number } {
    try {
      const stats = this.cacheService?.getCacheStats();
      return {
        size: stats?.totalEntries || 0,
        maxSize: this.config.performance.maxCacheSize
      };
    } catch (error) {
      this.logger.warn('Cache stats error:', error);
      return {
        size: 0,
        maxSize: this.config.performance?.maxCacheSize || 10000
      };
    }
  }
}