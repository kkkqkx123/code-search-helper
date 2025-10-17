import { CodeChunk } from './splitting/types';

// 代码块类型定义
export interface SnippetChunk extends CodeChunk {
  snippetType?: string;
  parentId?: string;
  children?: SnippetChunk[];
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