import { CodeChunk } from './splitting/Splitter';

// 代码块类型定义
export interface SnippetChunk extends CodeChunk {
  snippetType?: string;
  parentId?: string;
  children?: SnippetChunk[];
}

// 代码块元数据
export interface CodeChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  snippetType?: string;
  functionName?: string;
  className?: string;
  startByte?: number;
  endByte?: number;
  imports?: string[];
  exports?: string[];
  complexity?: number;
  nestingLevel?: number;
  [key: string]: any;
}

// 解析选项
export interface ParseOptions {
  addOverlap?: boolean;
  overlapSize?: number;
  extractSnippets?: boolean;
  maxDepth?: number;
}

// 语言支持配置
export interface LanguageSupport {
  name: string;
  extensions: string[];
  supported: boolean;
  parser?: any;
}