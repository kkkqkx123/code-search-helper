/**
 * 处理上下文接口
 * 定义了代码处理过程中所需的上下文信息
 */
export interface IProcessingContext {
  /** 要处理的代码内容 */
  content: string;

  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 处理配置 */
  config: ProcessingConfig;

  /** 文件特征信息 */
  features: FileFeatures;

  /** 上下文元数据 */
  metadata: ContextMetadata;

  /** AST节点（如果可用） */
  ast?: any;

  /** 节点跟踪器（如果可用） */
  nodeTracker?: any;

  /** 额外的上下文数据 */
  [key: string]: any;
}

/**
 * 文件特征接口
 */
export interface FileFeatures {
  /** 文件大小（字节） */
  size: number;

  /** 行数 */
  lineCount: number;

  /** 是否为小文件 */
  isSmallFile: boolean;

  /** 是否为代码文件 */
  isCodeFile: boolean;

  /** 是否为结构化文件 */
  isStructuredFile: boolean;

  /** 复杂度评分 */
  complexity: number;

  /** 是否包含导入语句 */
  hasImports: boolean;

  /** 是否包含导出语句 */
  hasExports: boolean;

  /** 是否包含函数定义 */
  hasFunctions: boolean;

  /** 是否包含类定义 */
  hasClasses: boolean;

  /** 语言特定特征 */
  languageFeatures?: Record<string, any>;
}

/**
 * 上下文元数据接口
 */
export interface ContextMetadata {
  /** 内容长度 */
  contentLength: number;

  /** 行数 */
  lineCount: number;

  /** 文件大小 */
  size: number;

  /** 是否为小文件 */
  isSmallFile: boolean;

  /** 是否为代码文件 */
  isCodeFile: boolean;

  /** 是否为结构化文件 */
  isStructuredFile: boolean;

  /** 复杂度 */
  complexity: number;

  /** 是否有导入 */
  hasImports: boolean;

  /** 是否有导出 */
  hasExports: boolean;

  /** 是否有函数 */
  hasFunctions: boolean;

  /** 是否有类 */
  hasClasses: boolean;

  /** 创建时间戳 */
  timestamp: number;

  /** 额外的元数据 */
  [key: string]: any;
}

// 导入相关类型，避免循环依赖
import type { ProcessingConfig } from '../types/ConfigTypes';