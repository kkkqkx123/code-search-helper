/**
 * AST代码分割器 - 优化版本
 * 基于Tree-sitter的AST解析进行智能代码分段
 * 支持分层提取架构和多语言处理
 * 集成了AST缓存、统一复杂度计算和并行处理优化
 */

import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ChunkTypeMapper } from '../../../../../utils/parser/ChunkTypeMapper';
import { DynamicParserManager } from '../../../../parser/parsing/DynamicParserManager';
import { QueryExecutor } from '../../../../parser/parsing/QueryExecutor';
import { DetectionService } from '../../../parser/parsing/detection/DetectionService';
import { TYPES } from '../../../../../types';
import { ChunkFactory } from '../../../../../utils/parser/ChunkFactory';
import { ValidationUtils } from '../../../../../utils/parser/validation/ValidationUtils';
import { TypeMappingUtils } from '../../../../../utils/parser/TypeMappingUtils';
import { QueryResultConverter } from '../../../../../utils/parser/QueryResultConverter';
import { ICacheService } from '../../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../../infrastructure/monitoring/types';
import { SegmentationConfigService } from '../../../../../config/service/SegmentationConfigService';
import { SegmentationConfig } from '../../../../../config/ConfigTypes';
import { getValidationStrategy } from '../../../constants/ValidationStrategies';

// 导入新的优化工具类
import { ASTCache } from '../../utils/AST/ASTCache';
import { UnifiedComplexityCalculator } from '../../utils/AST/ComplexityCalculator';
import { ParallelProcessor } from '../../utils/AST/ParallelProcessor';

@injectable()
export class ASTCodeSplitter {
  // 新增：优化工具类实例
  private astCache: ASTCache;
  private complexityCalculator: UnifiedComplexityCalculator;
  private parallelProcessor: ParallelProcessor;
  private dynamicParserManager: DynamicParserManager;
  private queryExecutor: QueryExecutor;

  constructor(
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    @inject(TYPES.DetectionService) private detectionService: DetectionService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.SegmentationConfigService) private segmentationConfigService: SegmentationConfigService,
    @inject(TYPES.UnifiedContentAnalyzer) private unifiedContentAnalyzer: any,
    @inject(TYPES.PerformanceMonitor) private performanceMonitor?: IPerformanceMonitor
  ) {
    // 创建底层服务实例
    this.dynamicParserManager = new DynamicParserManager(cacheService);
    this.queryExecutor = QueryExecutor.getInstance();
    // 初始化优化工具类
    this.astCache = new ASTCache(this.logger, {
      maxSize: this.config.performance?.maxCacheSize || 1000,
      defaultTTL: 10 * 60 * 1000, // 10分钟
      enableStats: true,
      enableMemoryMonitoring: true,
      memoryThreshold: 50 * 1024 * 1024, // 50MB
      cleanupInterval: 5 * 60 * 1000 // 5分钟
    });

    // 使用 ChunkTypeMapper 获取复杂度阈值配置
    const complexityThresholds = ChunkTypeMapper.getAllComplexityThresholds();

    this.complexityCalculator = new UnifiedComplexityCalculator(this.logger, {
      enableCache: true,
      cacheSize: 1000,
      cacheTTL: 10 * 60 * 1000, // 10分钟
      enablePerformanceMonitoring: true,
      batchConcurrency: 10,
      thresholds: {
        minComplexity: complexityThresholds.default.minComplexity,
        maxComplexity: complexityThresholds.default.maxComplexity,
        typeSpecific: complexityThresholds.typeSpecific
      }
    });

    this.parallelProcessor = new ParallelProcessor(this.logger, {
      maxConcurrency: Math.max(1, require('os').cpus().length - 1),
      taskTimeout: 30000 // 30秒
    });
  }

  /**
   * 获取当前配置
   */
  private get config(): SegmentationConfig {
    return this.segmentationConfigService.getConfig();
  }

  /**
   * 分割代码内容 - 优化版本
   * 实现分层提取架构，集成缓存和并行处理
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

      // 检查内容是否适合AST处理
      if (!(await this.hasValidStructure(content, language))) {
        this.logger.debug(`Content doesn't have AST-recognizable structure for ${filePath}`);
        return [];
      }

      // 优化：使用AST缓存检查是否已解析过
      let ast = this.astCache.get(content, language, filePath);
      let parseTime = 0;

      if (!ast) {
        // 缓存未命中，执行AST解析
        const parseStartTime = Date.now();
        const parseResult = await this.dynamicParserManager.parseCode(content, language);
        parseTime = Date.now() - parseStartTime;

        if (!parseResult) {
          this.logger.warn(`Failed to parse AST for ${filePath}`);
          throw new Error(`AST parsing failed for ${filePath}`);
        }

        ast = parseResult.ast;

        // 缓存AST解析结果
        this.astCache.set(content, language, ast, parseTime, filePath);
      } else {
        this.logger.debug(`AST cache hit for ${filePath}`);
      }

      // 优化：使用并行处理提取代码块
      const chunks = await this.extractChunksFromASTParallel(ast, content, filePath, language);

      // 优化：使用统一复杂度计算器批量计算复杂度
      const enhancedChunks = await this.calculateComplexityBatch(chunks);

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
   * 从AST中提取代码块 - 并行处理版本
   * 实现分层提取架构，使用并行处理优化性能
   */
  private async extractChunksFromASTParallel(
    ast: Parser.SyntaxNode,
    content: string,
    filePath: string,
    language: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    try {
      // 使用统一内容分析器提取所有结构
      const extractionResult = await this.unifiedContentAnalyzer.extractAllStructures(content, language, {
        includeTopLevel: true,
        includeNested: this.config.nesting.enableNestedExtraction,
        includeInternal: false,
        maxNestingLevel: this.config.nesting.maxNestingLevel || 5,
        enableCache: this.config.performance?.enableCaching,
        enablePerformanceMonitoring: true
      });

      // 处理顶级结构
      for (const structure of extractionResult.topLevelStructures) {
        if (ValidationUtils.isValidStructure(structure)) {
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
        const lines = content.split('\n');
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

      this.logger.debug(`使用并行处理提取到 ${extractionResult.stats.totalStructures} 个结构，生成 ${chunks.length} 个代码块`);

      return chunks;
    } catch (error) {
      this.logger.error(`Failed to extract chunks from AST: ${error}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`AST extraction failed: ${errorMessage}`);
    }
  }

  /**
   * 批量计算复杂度 - 优化版本
   * 使用统一复杂度计算器进行批量计算
   */
  private async calculateComplexityBatch(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    try {
      // 使用统一复杂度计算器批量计算
      const result = await this.complexityCalculator.calculateBatchComplexityFromChunks(chunks);

      // 过滤复杂度有效的chunks
      const validChunks = this.complexityCalculator.filterValidChunks(chunks);

      this.logger.debug(`批量复杂度计算完成: ${result.stats.total} 个chunks, ${result.stats.cacheHits} 次缓存命中`);

      return validChunks;
    } catch (error) {
      this.logger.warn(`批量复杂度计算失败，回退到单个计算: ${error}`);

      // 回退到单个计算
      return chunks.map(chunk => {
        const chunkComplexity = this.complexityCalculator.calculateComplexity(
          chunk.content,
          chunk.metadata.type,
          chunk.metadata.language,
          this.config
        );

        chunk.metadata = {
          ...chunk.metadata,
          complexity: chunkComplexity.score,
          complexityAnalysis: chunkComplexity.analysis
        };

        return chunk;
      });
    }
  }

  /**
   * 提取嵌套结构 - 优化版本
   * 使用并行处理优化嵌套结构提取
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
      const extractionResult = await this.unifiedContentAnalyzer.extractAllStructures(content, language, {
        includeNested: true,
        maxNestingLevel: this.config.nesting.maxNestingLevel
      });
      const nestedStructures = extractionResult.nestedStructures;

      // 优化：使用并行处理嵌套结构
      const tasks = nestedStructures.map((nested: any, index: number) => ({
        id: `nested-structure-${index}`,
        task: async () => {
          // 验证嵌套级别
          if (nested.level > this.config.nesting.maxNestingLevel) {
            return null;
          }

          // 根据配置决定是否保留完整实现
          const structureType = TypeMappingUtils.mapStringToStructureType(nested.type);
          const chunkType = TypeMappingUtils.mapStructureTypeToChunkTypeDirect(structureType);
          const shouldPreserve = this.shouldPreserveNestedStructure(chunkType);

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
            const processedChunks = [];

            for (const c of chunkArray) {
              if (c) {
                // 使用统一复杂度计算器计算复杂度
                const nestedComplexity = this.complexityCalculator.calculateComplexity(
                  c.content,
                  c.metadata.type,
                  c.metadata.language
                );

                c.metadata = {
                  ...c.metadata,
                  complexity: nestedComplexity.score,
                  complexityAnalysis: nestedComplexity.analysis,
                  nestingLevel: level
                };

                processedChunks.push(c);
              }
            }

            return processedChunks;
          }

          return null;
        },
        priority: level,
        description: `Process nested ${nested.type} at level ${level}`
      }));

      // 递归提取更深层的嵌套结构
      if (level < this.config.nesting.maxNestingLevel) {
        for (const nested of nestedStructures) {
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
    // 早期将字符串类型转换为 ChunkType 枚举
    const structureType = TypeMappingUtils.mapStringToStructureType(type);
    const chunkType = TypeMappingUtils.mapStructureTypeToChunkTypeDirect(structureType);

    // 使用配置系统中的统一验证参数
    const validationConfig = {
      minChars: this.config.global.minChunkSize,
      maxChars: this.config.global.maxChunkSize,
      minLines: this.config.global.minLinesPerChunk
    };

    // 使用验证策略进行验证
    let isValid = this.validateByChunkType(chunkType, content, location, validationConfig);

    // 如果基础验证通过，进一步使用复杂度验证
    if (isValid) {
      isValid = this.validateComplexity(chunkType, content);
    }

    return isValid;
  }

  /**
   * 根据ChunkType枚举进行验证
   */
  private validateByChunkType(
    chunkType: ChunkType,
    content: string,
    location: { startLine: number; endLine: number },
    config: { minChars: number; maxChars: number; minLines: number }
  ): boolean {
    // 获取对应的验证策略
    const strategy = getValidationStrategy(chunkType);

    // 合并默认配置和传入配置
    const validationConfig = {
      ...strategy.config,
      ...config
    };

    // 如果有特定验证器，使用它
    if (strategy.validator) {
      return strategy.validator(content, location, validationConfig) || false;
    }

    // 对于没有特定验证器的类型，使用大小验证
    return content.length >= config.minChars && content.length <= config.maxChars;
  }

  /**
   * 验证复杂度 - 优化版本
   * 使用统一复杂度计算器进行验证
   */
  private validateComplexity(chunkType: ChunkType, content: string): boolean {
    const structureComplexity = this.complexityCalculator.calculateComplexity(
      content,
      chunkType
    );

    // 使用统一复杂度计算器的验证功能
    return this.complexityCalculator.validateComplexity(structureComplexity.score, chunkType);
  }



  /**
   * 检查是否应该保留嵌套结构的完整实现
   * @param type 代码块类型
   * @returns 是否保留完整实现
   */
  private shouldPreserveNestedStructure(type: ChunkType): boolean {
    return ChunkTypeMapper.shouldPreserveNestedStructure(type);
  }

  /**
   * 创建签名代码块 - 优化版本
   * 使用统一复杂度计算器计算复杂度
   * 利用结构元信息智能提取签名
   */
  private createSignatureChunk(
    structure: any,
    filePath: string,
    language: string
  ): CodeChunk | null {
    try {
      // 使用元信息智能提取签名
      const signature = this.extractSignatureFromStructure(structure, language);
      if (!signature) return null;

      const structureType = TypeMappingUtils.mapStringToStructureType(structure.type);
      const chunkType = TypeMappingUtils.mapStructureTypeToChunkTypeDirect(structureType);
      const chunk = ChunkFactory.createCodeChunk(
        signature.content,
        structure.location.startLine,
        structure.location.startLine + (signature.lineCount - 1),
        language,
        chunkType,
        {
          filePath,
          strategy: 'ast-splitter',
          isSignatureOnly: true,
          originalStructure: structure.type,
          nestingLevel: structure.level,
          // 添加更多元信息
          structureName: structure.name,
          structureType: structure.type,
          confidence: structure.metadata?.confidence || 0,
          signatureExtractionMethod: signature.extractionMethod
        }
      );

      // 使用统一复杂度计算器计算复杂度
      const signatureComplexity = this.complexityCalculator.calculateComplexity(
        chunk.content,
        chunk.metadata.type,
        chunk.metadata.language
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
   * 基于结构元信息智能提取签名
   */
  private extractSignatureFromStructure(structure: any, language: string): { content: string; lineCount: number; extractionMethod: string } | null {
    const lines = structure.content.split('\n');
    if (lines.length === 0) return null;

    const structureType = structure.type?.toLowerCase() || '';
    const structureName = structure.name || '';

    // 根据不同结构类型使用不同的签名提取策略
    switch (structureType) {
      case 'function':
      case 'method':
        return this.extractFunctionSignature(lines, language, structureName);

      case 'class':
      case 'interface':
      case 'struct':
        return this.extractClassSignature(lines, language, structureName);

      case 'variable':
      case 'const':
      case 'let':
        return this.extractVariableSignature(lines, language, structureName);

      case 'import':
      case 'export':
        return this.extractImportExportSignature(lines, language);

      case 'enum':
        return this.extractEnumSignature(lines, language, structureName);

      case 'type':
      case 'type_alias':
        return this.extractTypeSignature(lines, language, structureName);

      default:
        // 通用策略：尝试找到包含结构名称的行，否则使用第一行
        return this.extractGenericSignature(lines, structureName);
    }
  }

  /**
   * 提取函数/方法签名
   */
  private extractFunctionSignature(lines: string[], language: string, functionName: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 查找包含函数名的行
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.includes(functionName) && (line.includes('(') || line.includes('=>') || line.includes('function'))) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'function-name-matching'
        };
      }
    }

    // 如果没找到，查找包含函数关键字的行
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.includes('function') || line.includes('=>') || line.includes('(')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'function-keyword-matching'
        };
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 提取类/接口/结构体签名
   */
  private extractClassSignature(lines: string[], language: string, className: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 查找包含类名的行
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.includes(className) && (line.includes('class') || line.includes('interface') || line.includes('struct'))) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'class-name-matching'
        };
      }
    }

    // 查找包含类关键字的行
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.includes('class') || line.includes('interface') || line.includes('struct')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'class-keyword-matching'
        };
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 提取变量声明签名
   */
  private extractVariableSignature(lines: string[], language: string, variableName: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 查找包含变量名的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes(variableName) && (line.includes('=') || line.includes(':') || line.includes('const') || line.includes('let') || line.includes('var'))) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'variable-name-matching'
        };
      }
    }

    // 查找包含变量关键字的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes('const') || line.includes('let') || line.includes('var')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'variable-keyword-matching'
        };
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 提取导入/导出签名
   */
  private extractImportExportSignature(lines: string[], language: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 导入/导出语句通常在第一行
    const firstLine = lines[0].trim();
    if (firstLine.includes('import') || firstLine.includes('export')) {
      return {
        content: firstLine,
        lineCount: 1,
        extractionMethod: 'import-export-direct'
      };
    }

    // 查找包含导入/导出关键字的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes('import') || line.includes('export')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'import-export-search'
        };
      }
    }

    // 回退到第一行
    return {
      content: firstLine,
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 提取枚举签名
   */
  private extractEnumSignature(lines: string[], language: string, enumName: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 查找包含枚举名的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes(enumName) && line.includes('enum')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'enum-name-matching'
        };
      }
    }

    // 查找包含enum关键字的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes('enum')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'enum-keyword-matching'
        };
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 提取类型定义签名
   */
  private extractTypeSignature(lines: string[], language: string, typeName: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 查找包含类型名的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes(typeName) && (line.includes('type') || line.includes('interface') || line.includes('typedef'))) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'type-name-matching'
        };
      }
    }

    // 查找包含类型关键字的行
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.includes('type') || line.includes('interface') || line.includes('typedef')) {
        return {
          content: line,
          lineCount: 1,
          extractionMethod: 'type-keyword-matching'
        };
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 通用签名提取策略
   */
  private extractGenericSignature(lines: string[], structureName: string): { content: string; lineCount: number; extractionMethod: string } | null {
    // 如果有结构名称，尝试查找包含名称的行
    if (structureName) {
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        if (line.includes(structureName)) {
          return {
            content: line,
            lineCount: 1,
            extractionMethod: 'generic-name-matching'
          };
        }
      }
    }

    // 回退到第一行
    return {
      content: lines[0].trim(),
      lineCount: 1,
      extractionMethod: 'first-line-fallback'
    };
  }

  /**
   * 检查内容是否有有效结构
   */
  private async hasValidStructure(content: string, language: string): Promise<boolean> {
    // 使用ContentAnalyzer检测结构
    const extractionResult = await this.unifiedContentAnalyzer.extractAllStructures(content, language, {
      includeTopLevel: true,
      includeNested: true,
      includeInternal: true
    });

    // 即使没有结构，也应该继续处理，以便可以返回完整的fallback chunk
    // 根据结构数量来判断是否有有效结构
    if (extractionResult.stats.totalStructures === 0) {
      return false;
    }

    return true;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string, language: string | undefined, filePath: string): string {
    const contentHash = require('../../../../utils/cache/HashUtils').HashUtils.fnv1aHash(content);
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
   * 清除缓存 - 优化版本
   * 清除所有缓存（包括新的AST缓存和复杂度计算缓存）
   */
  clearCache(): void {
    try {
      this.cacheService?.clearAllCache();
      this.astCache.clear();
      this.complexityCalculator.clearCache();
    } catch (error) {
      this.logger.warn('Cache clear error:', error);
    }
  }

  /**
   * 销毁实例 - 新增方法
   * 清理所有资源
   */
  destroy(): void {
    try {
      this.astCache.destroy();
      this.complexityCalculator.destroy();
      this.logger.debug('ASTCodeSplitter destroyed');
    } catch (error) {
      this.logger.warn('Error during destroy:', error);
    }
  }
}