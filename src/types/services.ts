/**
 * 索引选项接口
 */
export interface IndexOptions {
  embedder?: string;
  batchSize?: number;
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * 索引结果接口
 */
export interface IndexResult {
  success: boolean;
  projectId: string;
  message?: string;
  error?: string;
}

/**
 * 协调结果接口
 */
export interface CoordinatedResult {
  success: boolean;
  projectId: string;
  vectors?: {
    success: boolean;
    message?: string;
    error?: string;
  };
  graph?: {
    success: boolean;
    message?: string;
    error?: string;
  };
  message?: string;
  error?: string;
}