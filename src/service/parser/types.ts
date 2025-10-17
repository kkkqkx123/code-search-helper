import { CodeChunk, CodeChunkMetadata } from './types';

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

// 重新导出核心类型，提供统一入口
export {
  CodeChunk,
  CodeChunkMetadata,
  ChunkingOptions,
  EnhancedChunkingOptions,
  Splitter,
  ASTNode,
  SplitStrategy,
  ComplexityCalculator,
  SyntaxValidator,
  ChunkOptimizer,
  OverlapCalculator,
  PerformanceStats,
  PerformanceMonitor,
  DEFAULT_CHUNKING_OPTIONS,
  DEFAULT_ENHANCED_CHUNKING_OPTIONS
} from './splitting';