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
import { LanguageDetectionService } from '../../../detection/LanguageDetectionService';
import { QueryResultNormalizer } from '../../../../parser/core/normalization/QueryResultNormalizer';
import { TYPES } from '../../../../../types';
import { ChunkFactory } from '../../../../../utils/processing/ChunkFactory';
import { ValidationUtils } from '../../../../../utils/processing/validation/ValidationUtils';
import { ContentAnalyzer } from '../../../../../utils/processing/ContentAnalyzer';
import { TypeMappingUtils } from '../../../../../utils/processing/TypeMappingUtils';
import { QueryResultToChunkConverter } from '../../../../../utils/processing/QueryResultConverter';
import { ComplexityCalculator } from '../../../../../utils/processing/ComplexityCalculator';
import { ICacheService } from '../../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../../infrastructure/monitoring/types';
import { SegmentationConfigService } from '../../../../../config/service/SegmentationConfigService';
import { SegmentationConfig } from '../../../../../config/ConfigTypes';

@injectable()
export class ASTCodeSplitter {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LanguageDetectionService) private languageDetectionService: LanguageDetectionService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.SegmentationConfigService) private segmentationConfigService: SegmentationConfigService,
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
      // 第一层：顶级结构提取
      const topLevelStructures = ContentAnalyzer.extractTopLevelStructures(content, language);

      for (const structure of topLevelStructures) {
        if (ValidationUtils.isValidStructure(structure)) {
          // 验证结构
          const location = structure.location;
          const isValid = this.validateStructure(structure.type, structure.content, location);

          if (isValid) {
            // 转换为分层结构
            const hierarchicalStructure = TypeMappingUtils.convertTopLevelToHierarchical(structure);

            // 转换为代码块
            const chunk = QueryResultToChunkConverter.convertHierarchicalStructure(
              hierarchicalStructure,
              'ast-splitter',
              filePath
            );

            chunks.push(...chunk);

            // 第二层：嵌套结构提取（如果启用）
            if (this.config.nesting.enableNestedExtraction && this.config.nesting.maxNestingLevel && this.config.nesting.maxNestingLevel >= 2) {
              const nestedChunks = await this.extractNestedStructures(
                structure,
                content,
                filePath,
                language,
                2
              );
              chunks.push(...nestedChunks);
            }
          }
        }
      }

      // 注意：新的SegmentationConfig没有extraction.structureTypes
      // 如果需要，可以从languageSpecific配置中获取
      // 暂时禁用此功能
      if (false) { // 暂时禁用，因为新配置结构中没有这个字段
        const normalizer = new QueryResultNormalizer();
        const standardizedResults = await normalizer.normalize(ast, language, ['function', 'class', 'method']);

        for (const result of standardizedResults) {
          if (result.content && result.content.trim().length > 0) {
            const chunk = QueryResultToChunkConverter.convertToChunk(
              result,
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
    level: number
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    if (!this.config.nesting.maxNestingLevel || level > this.config.nesting.maxNestingLevel) {
      return chunks;
    }

    try {
      const nestedStructures = ContentAnalyzer.extractNestedStructures(
        content,
        parentStructure.node,
        level
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
          chunk = QueryResultToChunkConverter.convertHierarchicalStructure(
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
            level + 1
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
    // 首先使用原有的验证逻辑
    let isValid = false;
    switch (type) {
      case 'function':
        isValid = ValidationUtils.isValidFunction(content, location, {
          minLines: 3, // 默认值，新配置中没有这个字段
          maxChars: 1000, // 默认值，新配置中没有这个字段
          minChars: this.config.global.minChunkSize
        });
        break;
      case 'class':
        isValid = ValidationUtils.isValidClass(content, location, {
          minLines: 2, // 默认值，新配置中没有这个字段
          maxChars: 2000, // 默认值，新配置中没有这个字段
          minChars: this.config.global.minChunkSize
        });
        break;
      case 'namespace':
        isValid = ValidationUtils.isValidNamespace(content, location, {
          maxChars: 3000, // 默认值，新配置中没有这个字段
          minChars: this.config.global.minChunkSize
        });
        break;
      case 'template':
        isValid = ValidationUtils.isValidTemplate(content, location, {
          minChars: this.config.global.minChunkSize,
          maxChars: this.config.global.maxChunkSize
        });
        break;
      case 'import':
        isValid = ValidationUtils.isValidImport(content, location);
        break;
      default:
        isValid = content.length >= this.config.global.minChunkSize &&
          content.length <= this.config.global.maxChunkSize;
        break;
    }
    
    // 如果基础验证通过，进一步使用复杂度验证
    if (isValid) {
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
    
    return isValid;
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
      default:
        return ChunkType.GENERIC;
    }
  }

  /**
   * 检查是否应该保留嵌套结构的完整实现
   */
  private shouldPreserveNestedStructure(type: string): boolean {
    switch (type) {
      case 'method':
        return true; // 默认值，新配置中没有这个字段
      case 'function':
        return false; // 默认值，新配置中没有这个字段
      case 'class':
        return false; // 默认值，新配置中没有这个字段
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
        TypeMappingUtils.mapStructureTypeToChunkType(structure.type as any),
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
    const contentHash = this.hashContent(content);
    return `${filePath}:${language || 'unknown'}:${contentHash}`;
  }

  /**
   * 哈希内容
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
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