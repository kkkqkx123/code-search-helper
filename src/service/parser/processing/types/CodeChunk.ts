import { ContentHashUtils } from '../../../../utils/ContentHashUtils';

/**
 * 代码块核心类型定义
 * 提供统一的代码块结构和元数据定义
 */

/**
 * 代码块类型枚举
 */
export enum ChunkType {
  FUNCTION = 'function',
  CLASS = 'class',
  METHOD = 'method',
  IMPORT = 'import',
  EXPORT = 'export',
  GENERIC = 'generic',
  COMMENT = 'comment',
  DOCUMENTATION = 'documentation',
  VARIABLE = 'variable',
  INTERFACE = 'interface',
  TYPE = 'type',
  ENUM = 'enum',
  MODULE = 'module',
  BLOCK = 'block',
  LINE = 'line'
}

/**
 * 代码块元数据接口
 */
export interface ChunkMetadata {
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 编程语言 */
  language: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** 使用的分割策略 */
  strategy: string;
  /** 复杂度评分（可选） */
  complexity?: number;
  /** 内容哈希值（可选） */
  hash?: string;
  /** 创建时间戳 */
  timestamp: number;
  /** 代码块类型 */
  type: ChunkType;
  /** 代码块大小（字符数） */
  size: number;
  /** 代码块行数 */
  lineCount: number;
  /** 是否包含导入语句 */
  hasImports?: boolean;
  /** 是否包含导出语句 */
  hasExports?: boolean;
  /** 是否包含函数定义 */
  hasFunctions?: boolean;
  /** 是否包含类定义 */
  hasClasses?: boolean;
  /** 语义边界信息（可选） */
  semanticBoundary?: any;
  /** AST节点信息（可选） */
  astNodes?: any[];
  /** 重叠信息（可选） */
  overlapInfo?: any;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 代码块核心接口
 */
export interface CodeChunk {
  /** 代码内容 */
  content: string;
  /** 元数据 */
  metadata: ChunkMetadata;
}

/**
 * 代码块构建器类
 */
export class CodeChunkBuilder {
  private chunk: Partial<CodeChunk> = {};

  constructor(content?: string) {
    if (content) {
      this.chunk.content = content;
    }
  }

  setContent(content: string): CodeChunkBuilder {
    this.chunk.content = content;
    return this;
  }

  setStartLine(startLine: number): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.startLine = startLine;
    return this;
  }

  setEndLine(endLine: number): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.endLine = endLine;
    return this;
  }

  setLanguage(language: string): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.language = language;
    return this;
  }

  setFilePath(filePath: string): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.filePath = filePath;
    return this;
  }

  setStrategy(strategy: string): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.strategy = strategy;
    return this;
  }

  setComplexity(complexity: number): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.complexity = complexity;
    return this;
  }

  setHash(hash: string): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.hash = hash;
    return this;
  }

  setType(type: ChunkType): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata.type = type;
    return this;
  }

  addMetadata(key: string, value: any): CodeChunkBuilder {
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    this.chunk.metadata[key] = value;
    return this;
  }

  build(): CodeChunk {
    // 验证必需字段
    if (!this.chunk.content) {
      throw new Error('CodeChunk content is required');
    }

    // 设置默认时间戳
    if (!this.chunk.metadata) {
      this.chunk.metadata = {} as ChunkMetadata;
    }
    if (!this.chunk.metadata.timestamp) {
      this.chunk.metadata.timestamp = Date.now();
    }
    // 设置 size 和 lineCount
    if (!this.chunk.metadata.size) {
      this.chunk.metadata.size = this.chunk.content.length;
    }
    if (!this.chunk.metadata.lineCount) {
      this.chunk.metadata.lineCount = this.chunk.content.split('\n').length;
    }

    if (!this.chunk.metadata.startLine || !this.chunk.metadata.endLine) {
      throw new Error('CodeChunk startLine and endLine are required');
    }
    if (!this.chunk.metadata.language) {
      throw new Error('CodeChunk language is required');
    }
    if (!this.chunk.metadata.strategy) {
      throw new Error('CodeChunk strategy is required');
    }
    if (!this.chunk.metadata.type) {
      throw new Error('CodeChunk type is required');
    }

    return this.chunk as CodeChunk;
  }
}

/**
 * 代码块工具函数
 */
export class CodeChunkUtils {
  /**
   * 计算代码块的行数
   */
  static getLineCount(chunk: CodeChunk): number {
    return chunk.metadata.endLine - chunk.metadata.startLine + 1;
  }

  /**
   * 计算代码块的大小（字符数）
   */
  static getSize(chunk: CodeChunk): number {
    return chunk.content.length;
  }

  /**
   * 检查代码块是否为空
   */
  static isEmpty(chunk: CodeChunk): boolean {
    return !chunk.content || chunk.content.trim().length === 0;
  }

  /**
   * 检查两个代码块是否重叠
   */
  static isOverlapping(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    return !(chunk1.metadata.endLine < chunk2.metadata.startLine || 
             chunk2.metadata.endLine < chunk1.metadata.startLine);
  }

  /**
   * 合并两个重叠的代码块
   */
  static mergeOverlappingChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    if (!this.isOverlapping(chunk1, chunk2)) {
      throw new Error('Chunks do not overlap and cannot be merged');
    }

    const startLine = Math.min(chunk1.metadata.startLine, chunk2.metadata.startLine);
    const endLine = Math.max(chunk1.metadata.endLine, chunk2.metadata.endLine);
    
    // 使用优先级更高的策略（这里简单使用第一个的策略）
    const strategy = chunk1.metadata.strategy;
    const language = chunk1.metadata.language;
    const type = chunk1.metadata.type;

    return new CodeChunkBuilder()
      .setContent(chunk1.content) // 简化处理，实际应该按行合并
      .setStartLine(startLine)
      .setEndLine(endLine)
      .setLanguage(language)
      .setStrategy(strategy)
      .setType(type)
      .addMetadata('mergedFrom', [chunk1, chunk2])
      .build();
  }

  /**
   * 生成代码块的内容哈希
   */
  static generateHash(chunk: CodeChunk): string {
    const content = chunk.content + chunk.metadata.startLine + chunk.metadata.endLine;
    return ContentHashUtils.generateContentHash(content);
  }
}