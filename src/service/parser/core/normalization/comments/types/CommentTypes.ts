/**
 * 注释分类枚举
 */
export enum CommentCategory {
  DOCUMENTATION = 'documentation',
  TODO = 'todo',
  LICENSE = 'license',
  INLINE = 'inline',
  CONFIG = 'config',
  DEBUG = 'debug',
  TEMPORARY = 'temporary',
  WARNING = 'warning',
  EXAMPLE = 'example',
  OTHER = 'other'
}

/**
 * 处理后的注释接口
 */
export interface ProcessedComment {
 id: string;
  text: string;
  startPosition: Position;
  endPosition: Position;
  semanticType: string;        // tree-sitter捕获名称
  category: CommentCategory;   // 标准分类
  language: string;
  metadata: CommentMetadata;
}

/**
 * 位置信息
 */
export interface Position {
  row: number;
  column: number;
}

/**
 * 注释元数据
 */
export interface CommentMetadata {
  captureName: string;
  confidence: number;
  attributes: Record<string, any>;
}

/**
 * 查询捕获接口
 */
export interface QueryCapture {
  name: string;
  node: any;
  text: string;
  startPosition: Position;
  endPosition: Position;
}

/**
 * 查询结果接口
 */
export interface QueryResult {
  captures: QueryCapture[];
  filePath?: string;
}