/**
 * 查询结果转换器
 * 将标准化查询结果转换为代码块
 */

import { CodeChunk, ChunkType } from '../../service/parser/processing/types/CodeChunk';
import { StandardizedQueryResult } from '../../service/parser/core/normalization/types';
import { ChunkFactory } from './ChunkFactory';
import { TypeMappingUtils, StructureType, HierarchicalStructure, NestingInfo } from './TypeMappingUtils';
import { TopLevelStructure, NestedStructure, InternalStructure } from './ContentAnalyzer';

/**
 * 转换配置接口
 */
export interface ConversionConfig {
  /** 是否自动计算复杂度 */
  autoCalculateComplexity?: boolean;
  /** 是否自动生成哈希 */
  autoGenerateHash?: boolean;
  /** 默认策略名称 */
  defaultStrategy?: string;
  /** 是否验证输入 */
  validateInput?: boolean;
  /** 自定义元数据 */
  customMetadata?: Record<string, any>;
}

/**
 * 转换结果接口
 */
export interface ConversionResult {
  /** 转换的代码块 */
  chunks: CodeChunk[];
  /** 转换统计 */
  statistics: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings?: string[];
}

/**
 * 查询结果到代码块的转换器
 */
export class QueryResultToChunkConverter {
  /**
   * 将标准化查询结果转换为代码块
   */
  static convertToChunk(
    result: StandardizedQueryResult,
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk {
    const {
      autoCalculateComplexity = true,
      autoGenerateHash = true,
      defaultStrategy = strategy,
      validateInput = true,
      customMetadata = {}
    } = config;

    // 验证输入
    if (validateInput) {
      this.validateStandardizedResult(result);
    }

    // 映射类型
    const chunkType = TypeMappingUtils.mapStandardizedTypeToChunkType(result.type);
    const entityKey = TypeMappingUtils.getEntityKey(result.type);
    const chunkName = result.metadata?.extra?.name || result.name;

    // 创建元数据
    const metadata = {
      filePath: filePath || result.metadata?.filePath || '',
      [entityKey]: chunkName,
      strategy: defaultStrategy,
      nodeId: result.nodeId,
      originalType: result.type,
      language: result.metadata?.language,
      complexity: result.metadata?.complexity,
      ...customMetadata
    };

    // 使用ChunkFactory创建代码块
    return ChunkFactory.createCodeChunk(
      result.content,
      result.startLine,
      result.endLine,
      result.metadata?.language || 'unknown',
      chunkType,
      metadata,
      {
        autoCalculateComplexity,
        autoGenerateHash,
        defaultStrategy
      }
    );
  }

  /**
   * 将分层结构转换为代码块
   */
  static convertHierarchicalStructure(
    structure: HierarchicalStructure,
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 转换主结构
    const mainChunk = this.convertSingleHierarchicalStructure(structure, strategy, filePath, config);
    chunks.push(mainChunk);

    // 递归转换子结构
    if (structure.children && structure.children.length > 0) {
      for (const child of structure.children) {
        const childChunks = this.convertHierarchicalStructure(child, strategy, filePath, config);
        chunks.push(...childChunks);
      }
    }

    return chunks;
  }

  /**
   * 带嵌套信息的转换
   */
  static convertWithNestingInfo(
    result: StandardizedQueryResult,
    nestingInfo: NestingInfo,
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk {
    const chunk = this.convertToChunk(result, strategy, filePath, config);

    // 添加嵌套信息到元数据
    chunk.metadata.nesting = {
      level: nestingInfo.level,
      parentType: nestingInfo.parentType,
      parentName: nestingInfo.parentName,
      path: nestingInfo.path.join('.'),
      isNested: nestingInfo.level > 1
    };

    return chunk;
  }

  /**
   * 批量转换
   */
  static convertBatch(
    results: StandardizedQueryResult[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): ConversionResult {
    const chunks: CodeChunk[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      try {
        // 验证结果
        if (!this.isValidStandardizedResult(result)) {
          warnings.push(`Skipping invalid result at index ${i}`);
          skipped++;
          continue;
        }

        // 转换
        const chunk = this.convertToChunk(result, strategy, filePath, config);
        chunks.push(chunk);
        successful++;

      } catch (error) {
        errors.push(`Failed to convert result at index ${i}: ${error}`);
        failed++;
      }
    }

    return {
      chunks,
      statistics: {
        total: results.length,
        successful,
        failed,
        skipped
      },
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 转换顶级结构
   */
  static convertTopLevelStructures(
    structures: TopLevelStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertTopLevelToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 转换嵌套结构
   */
  static convertNestedStructures(
    structures: NestedStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertNestedToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 转换内部结构
   */
  static convertInternalStructures(
    structures: InternalStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertInternalToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 创建转换管道
   */
  static createConversionPipeline(
    ...processors: Array<(chunk: CodeChunk) => CodeChunk>
  ): (results: StandardizedQueryResult[], strategy: string, filePath?: string) => CodeChunk[] {
    return (results: StandardizedQueryResult[], strategy: string, filePath?: string) => {
      const chunks = results.map(result => 
        this.convertToChunk(result, strategy, filePath)
      );

      return processors.reduce((processedChunks, processor) => {
        return processedChunks.map(processor);
      }, chunks);
    };
  }

  /**
   * 创建过滤器
   */
  static createFilter(predicate: (chunk: CodeChunk) => boolean): (chunks: CodeChunk[]) => CodeChunk[] {
    return (chunks: CodeChunk[]) => chunks.filter(predicate);
  }

  /**
   * 创建转换器
   */
  static createTransformer(
    transformer: (chunk: CodeChunk) => CodeChunk
  ): (chunks: CodeChunk[]) => CodeChunk[] {
    return (chunks: CodeChunk[]) => chunks.map(transformer);
  }

  /**
   * 创建聚合器
   */
  static createAggregator(
    aggregator: (chunks: CodeChunk[]) => CodeChunk[]
  ): (chunks: CodeChunk[]) => CodeChunk[] {
    return aggregator;
  }

  /**
   * 验证转换结果
   */
  static validateConversionResult(
    originalResults: StandardizedQueryResult[],
    convertedChunks: CodeChunk[]
  ): {
    isValid: boolean;
    mismatches: Array<{
      originalIndex: number;
      issue: string;
    }>;
  } {
    const mismatches: Array<{ originalIndex: number; issue: string }> = [];

    if (originalResults.length !== convertedChunks.length) {
      mismatches.push({
        originalIndex: -1,
        issue: `Count mismatch: ${originalResults.length} originals vs ${convertedChunks.length} chunks`
      });
    }

    for (let i = 0; i < Math.min(originalResults.length, convertedChunks.length); i++) {
      const original = originalResults[i];
      const converted = convertedChunks[i];

      // 检查内容
      if (original.content !== converted.content) {
        mismatches.push({
          originalIndex: i,
          issue: 'Content mismatch'
        });
      }

      // 检查位置
      if (original.startLine !== converted.metadata.startLine ||
          original.endLine !== converted.metadata.endLine) {
        mismatches.push({
          originalIndex: i,
          issue: 'Location mismatch'
        });
      }

      // 检查类型映射
      const expectedType = TypeMappingUtils.mapStandardizedTypeToChunkType(original.type);
      if (expectedType !== converted.metadata.type) {
        mismatches.push({
          originalIndex: i,
          issue: `Type mapping mismatch: ${original.type} -> ${expectedType}, got ${converted.metadata.type}`
        });
      }
    }

    return {
      isValid: mismatches.length === 0,
      mismatches
    };
  }

  // 私有辅助方法

  /**
   * 转换单个分层结构
   */
  private static convertSingleHierarchicalStructure(
    structure: HierarchicalStructure,
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk {
    const chunkType = TypeMappingUtils.mapStructureTypeToChunkType(structure.type);
    const metadata = TypeMappingUtils.createHierarchicalMetadata(structure);

    // 添加转换配置
    const finalMetadata = {
      filePath: filePath || '',
      strategy,
      ...metadata,
      ...config.customMetadata
    };

    return ChunkFactory.createCodeChunk(
      structure.content,
      structure.location.startLine,
      structure.location.endLine,
      metadata.language || 'unknown',
      chunkType,
      finalMetadata,
      {
        autoCalculateComplexity: config.autoCalculateComplexity,
        autoGenerateHash: config.autoGenerateHash,
        defaultStrategy: config.defaultStrategy || strategy
      }
    );
  }

  /**
   * 验证标准化结果
   */
  private static validateStandardizedResult(result: StandardizedQueryResult): void {
    if (!result) {
      throw new Error('Result is null or undefined');
    }

    if (!result.content || typeof result.content !== 'string') {
      throw new Error('Result content is required and must be a string');
    }

    if (!result.type || typeof result.type !== 'string') {
      throw new Error('Result type is required and must be a string');
    }

    if (!Number.isInteger(result.startLine) || result.startLine < 1) {
      throw new Error('Result startLine must be a positive integer');
    }

    if (!Number.isInteger(result.endLine) || result.endLine < result.startLine) {
      throw new Error('Result endLine must be a positive integer >= startLine');
    }
  }

  /**
   * 检查标准化结果是否有效
   */
  private static isValidStandardizedResult(result: StandardizedQueryResult): boolean {
    try {
      this.validateStandardizedResult(result);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 预定义的转换处理器
 */
export class ConversionProcessors {
  /**
   * 复杂度增强处理器
   */
  static complexityEnhancer = (chunk: CodeChunk): CodeChunk => {
    if (!chunk.metadata.complexity) {
      // 基于内容计算复杂度
      const complexity = this.calculateContentComplexity(chunk.content);
      chunk.metadata.complexity = complexity;
    }
    return chunk;
  };

  /**
   * 元数据增强处理器
   */
  static metadataEnhancer = (additionalMetadata: Record<string, any>) => 
    (chunk: CodeChunk): CodeChunk => {
      Object.assign(chunk.metadata, additionalMetadata);
      return chunk;
    };

  /**
   * 类型规范化处理器
   */
  static typeNormalizer = (chunk: CodeChunk): CodeChunk => {
    // 确保类型是有效的ChunkType
    if (!Object.values(ChunkType).includes(chunk.metadata.type as ChunkType)) {
      chunk.metadata.type = ChunkType.GENERIC;
    }
    return chunk;
  };

  /**
   * 大小过滤器
   */
  static sizeFilter = (minSize: number, maxSize: number) => 
    (chunk: CodeChunk): boolean => {
      const size = chunk.content.length;
      return size >= minSize && size <= maxSize;
    };

  /**
   * 类型过滤器
   */
  static typeFilter = (...allowedTypes: ChunkType[]) => 
    (chunk: CodeChunk): boolean => {
      return allowedTypes.includes(chunk.metadata.type as ChunkType);
    };

  /**
   * 计算内容复杂度
   */
  private static calculateContentComplexity(content: string): number {
    let complexity = 1; // 基础复杂度

    // 基于行数
    const lines = content.split('\n');
    complexity += Math.log10(lines.length + 1);

    // 基于关键字
    const keywords = content.match(/\b(if|else|for|while|function|class|return)\b/g) || [];
    complexity += keywords.length * 0.5;

    // 基于嵌套
    const openBraces = (content.match(/\{/g) || []).length;
    complexity += openBraces * 0.3;

    return Math.round(Math.max(1, complexity));
  }
}