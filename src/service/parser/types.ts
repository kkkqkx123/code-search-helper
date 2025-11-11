import { CodeChunk } from './processing/types/CodeChunk';
import { CodeChunkMetadata } from './core/types';
import { ChunkingOptions } from './processing/strategies/types/SegmentationTypes';

// 重新导出核心类型
export { CodeChunk, CodeChunkMetadata, ChunkingOptions };

// 解析选项
export interface ParseOptions {
  addOverlap?: boolean;
  overlapSize?: number;
  extractSnippets?: boolean;
  maxDepth?: number;
  extractRelationships?: boolean; // 是否提取关系节点
}

// 语言支持配置
export interface LanguageSupport {
  name: string;
  extensions: string[];
  supported: boolean;
  parser?: any;
}