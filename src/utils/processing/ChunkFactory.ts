/**
 * 代码块工厂类
 * 统一代码块创建逻辑，提供多种创建方法和配置选项
 */

import { CodeChunk, ChunkType, ChunkMetadata, CodeChunkBuilder } from '../../service/parser/processing/types/CodeChunk';
import { ComplexityCalculator, ComplexityResult } from './ComplexityCalculator';
import { ContentHashUtils } from '../ContentHashUtils';

/**
 * 代码块创建配置接口
 */
export interface ChunkCreationConfig {
  /** 是否自动计算复杂度 */
  autoCalculateComplexity?: boolean;
  /** 是否自动生成哈希 */
  autoGenerateHash?: boolean;
  /** 默认策略名称 */
  defaultStrategy?: string;
  /** 是否验证必需字段 */
  validateRequired?: boolean;
  /** 复杂度计算配置 */
  complexityConfig?: any;
}

/**
 * 扩展元数据接口
 */
export interface ExtendedChunkMetadata extends ChunkMetadata {
  /** 内容哈希值 */
  contentHash?: string;
  /** 创建时间戳 */
  createdAt?: number;
  /** 最后修改时间 */
  lastModified?: number;
  /** 版本号 */
  version?: string;
  /** 标签 */
  tags?: string[];
  /** 优先级 */
  priority?: number;
  /** 父块ID */
  parentChunkId?: string;
  /** 子块ID列表 */
  childChunkIds?: string[];
  /** 相关块ID列表 */
  relatedChunkIds?: string[];
}

/**
 * 代码块工厂类
 */
export class ChunkFactory {
  private static defaultConfig: ChunkCreationConfig = {
    autoCalculateComplexity: true,
    autoGenerateHash: true,
    defaultStrategy: 'unknown',
    validateRequired: true
  };

  /**
   * 创建标准代码块
   */
  static createCodeChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    type: ChunkType,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    const finalConfig = { ...this.defaultConfig, ...config };

    // 验证输入参数
    if (finalConfig.validateRequired) {
      this.validateBasicInputs(content, startLine, endLine, language, type);
    }

    // 使用CodeChunkBuilder创建代码块
    const builder = new CodeChunkBuilder(content)
      .setStartLine(startLine)
      .setEndLine(endLine)
      .setLanguage(language)
      .setType(type)
      .setStrategy(finalConfig.defaultStrategy || 'unknown');

    // 添加额外元数据
    Object.keys(additionalMetadata).forEach(key => {
      builder.addMetadata(key, additionalMetadata[key]);
    });

    // 自动计算复杂度
    if (finalConfig.autoCalculateComplexity && !additionalMetadata.complexity) {
      const complexityResult = ComplexityCalculator.calculateComplexityByType(content, type, finalConfig.complexityConfig);
      builder.setComplexity(complexityResult.score);
    }

    // 自动生成哈希
    if (finalConfig.autoGenerateHash && !additionalMetadata.hash) {
      builder.setHash(ContentHashUtils.generateContentHash(content));
    }

    return builder.build();
  }

  /**
   * 基于元数据创建代码块
   */
  static createChunkWithMetadata(
    content: string,
    baseMetadata: ChunkMetadata,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    const finalConfig = { ...this.defaultConfig, ...config };

    // 使用CodeChunkBuilder创建代码块
    const builder = new CodeChunkBuilder(content)
      .setStartLine(baseMetadata.startLine)
      .setEndLine(baseMetadata.endLine)
      .setLanguage(baseMetadata.language)
      .setType(baseMetadata.type)
      .setStrategy(baseMetadata.strategy);

    // 设置基础元数据
    if (baseMetadata.filePath) builder.setFilePath(baseMetadata.filePath);
    if (baseMetadata.complexity) builder.setComplexity(baseMetadata.complexity);
    if (baseMetadata.hash) builder.setHash(baseMetadata.hash);

    // 添加额外元数据
    Object.keys(additionalMetadata).forEach(key => {
      builder.addMetadata(key, additionalMetadata[key]);
    });

    // 自动计算复杂度
    if (finalConfig.autoCalculateComplexity && !baseMetadata.complexity && !additionalMetadata.complexity) {
      const complexityResult = ComplexityCalculator.calculateComplexityByType(content, baseMetadata.type, finalConfig.complexityConfig);
      builder.setComplexity(complexityResult.score);
    }

    // 自动生成哈希
    if (finalConfig.autoGenerateHash && !baseMetadata.hash && !additionalMetadata.hash) {
      builder.setHash(ContentHashUtils.generateContentHash(content));
    }

    return builder.build();
  }

  /**
   * 创建函数代码块
   */
  static createFunctionChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    functionName: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.FUNCTION,
      {
        functionName,
        hasFunctions: true,
        ...additionalMetadata
      },
      config
    );
  }

  /**
   * 创建类代码块
   */
  static createClassChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    className: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.CLASS,
      {
        className,
        hasClasses: true,
        ...additionalMetadata
      },
      config
    );
  }

  /**
   * 创建文档代码块
   */
  static createDocumentationChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    section?: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.DOCUMENTATION,
      {
        section,
        ...additionalMetadata
      },
      config
    );
  }

  /**
   * 创建通用代码块
   */
  static createGenericChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.GENERIC,
      additionalMetadata,
      config
    );
  }

  /**
   * 创建行代码块
   */
  static createLineChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.LINE,
      additionalMetadata,
      config
    );
  }

  /**
   * 创建块代码块
   */
  static createBlockChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.BLOCK,
      additionalMetadata,
      config
    );
  }

  /**
   * 批量创建代码块
   */
  static createBatchChunks(
    chunksData: Array<{
      content: string;
      startLine: number;
      endLine: number;
      language: string;
      type: ChunkType;
      additionalMetadata?: any;
    }>,
    config: ChunkCreationConfig = {}
  ): CodeChunk[] {
    return chunksData.map(data => 
      this.createCodeChunk(
        data.content,
        data.startLine,
        data.endLine,
        data.language,
        data.type,
        data.additionalMetadata,
        config
      )
    );
  }

  /**
   * 从现有代码块创建新代码块（复制并修改）
   */
  static createFromExisting(
    existingChunk: CodeChunk,
    modifications: {
      content?: string;
      startLine?: number;
      endLine?: number;
      language?: string;
      type?: ChunkType;
      additionalMetadata?: any;
    } = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    const content = modifications.content || existingChunk.content;
    const startLine = modifications.startLine || existingChunk.metadata.startLine;
    const endLine = modifications.endLine || existingChunk.metadata.endLine;
    const language = modifications.language || existingChunk.metadata.language;
    const type = modifications.type || existingChunk.metadata.type;

    // 复制现有元数据并应用修改
    const baseMetadata = { ...existingChunk.metadata };
    delete (baseMetadata as any).startLine;
    delete (baseMetadata as any).endLine;
    delete (baseMetadata as any).language;
    delete (baseMetadata as any).type;

    const additionalMetadata = {
      ...baseMetadata,
      ...modifications.additionalMetadata
    };

    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      type,
      additionalMetadata,
      config
    );
  }

  /**
   * 创建合并的代码块
   */
  static createMergedChunk(
    chunks: CodeChunk[],
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    if (chunks.length === 0) {
      throw new Error('Cannot create merged chunk from empty array');
    }

    if (chunks.length === 1) {
      return chunks[0];
    }

    // 按起始行排序
    const sortedChunks = chunks.sort((a, b) => a.metadata.startLine - b.metadata.startLine);

    // 合并内容
    const mergedContent = sortedChunks.map(chunk => chunk.content).join('\n');

    // 计算合并后的行范围
    const startLine = sortedChunks[0].metadata.startLine;
    const endLine = sortedChunks[sortedChunks.length - 1].metadata.endLine;

    // 使用第一个块的语言和类型
    const language = sortedChunks[0].metadata.language;
    const type = sortedChunks[0].metadata.type;

    // 合并元数据
    const mergedMetadata = {
      // 保留第一个块的基础元数据
      ...sortedChunks[0].metadata,
      // 更新行范围
      startLine,
      endLine,
      // 添加合并信息
      mergedFrom: chunks.map(chunk => ({
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        type: chunk.metadata.type
      })),
      chunkCount: chunks.length,
      ...additionalMetadata
    };

    return this.createChunkWithMetadata(mergedContent, mergedMetadata as ChunkMetadata, {}, config);
  }

  /**
   * 创建降级代码块
   */
  static createFallbackChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    reason: string,
    additionalMetadata: any = {},
    config: ChunkCreationConfig = {}
  ): CodeChunk {
    return this.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      ChunkType.GENERIC,
      {
        fallback: true,
        fallbackReason: reason,
        ...additionalMetadata
      },
      config
    );
  }

  /**
   * 验证基础输入参数
   */
  private static validateBasicInputs(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    type: ChunkType
  ): void {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    if (!Number.isInteger(startLine) || startLine < 1) {
      throw new Error('Start line must be a positive integer');
    }

    if (!Number.isInteger(endLine) || endLine < startLine) {
      throw new Error('End line must be a positive integer greater than or equal to start line');
    }

    if (!language || typeof language !== 'string') {
      throw new Error('Language must be a non-empty string');
    }

    if (!Object.values(ChunkType).includes(type)) {
      throw new Error(`Invalid chunk type: ${type}`);
    }
  }

  /**
   * 设置默认配置
   */
  static setDefaultConfig(config: Partial<ChunkCreationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * 获取默认配置
   */
  static getDefaultConfig(): ChunkCreationConfig {
    return { ...this.defaultConfig };
  }
}