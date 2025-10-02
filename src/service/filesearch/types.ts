/**
 * 文件搜索服务类型定义
 */

// 文件向量索引结构
export interface FileVectorIndex {
  id: string;                    // 文件唯一ID
  projectId: string;            // 项目ID
  filePath: string;              // 完整路径
  fileName: string;              // 文件名（不含路径）
  directory: string;             // 目录路径
  extension: string;             // 文件扩展名
  
  // 向量表示
  nameVector: number[];          // 文件名语义向量
  pathVector: number[];          // 路径语义向量
  combinedVector: number[];      // 路径+名称组合向量
  
  // 元数据
  semanticDescription: string;   // AI生成的语义描述
  lastModified: Date;            // 修改时间
  fileSize: number;              // 文件大小
  fileType: 'file' | 'directory'; // 文件类型
}

// 文件搜索结果
export interface FileSearchResult {
  filePath: string;
  fileName: string;
  directory: string;
  relevanceScore: number;
  semanticDescription: string;
  extension?: string;
  fileSize?: number;
  lastModified?: Date;
}

// 查询类型
export type FileQueryType = 
  | 'EXACT_FILENAME'      // 精确文件名匹配，如：config.json
  | 'SEMANTIC_DESCRIPTION' // 语义描述搜索，如：认证相关的配置文件
  | 'PATH_PATTERN'        // 路径模式搜索，如：src/services下的文件
  | 'EXTENSION_SEARCH'    // 扩展名搜索，如：所有.ts文件
  | 'HYBRID_QUERY';       // 混合查询，结合多种条件

// 文件搜索选项
export interface FileSearchOptions {
  maxResults?: number;           // 最大结果数，默认100
  fileTypes?: string[];          // 文件类型过滤，如['.ts', '.js']
  pathPattern?: string;        // 路径模式过滤
  projectId?: string;          // 项目ID过滤
  minScore?: number;          // 最小相关性分数，默认0.7
  includeDirectories?: boolean; // 是否包含目录，默认false
  caseSensitive?: boolean;    // 是否区分大小写，默认false
}

// 文件搜索请求（从ref目录迁移）
export interface FileSearchRequest {
  query: string;              // 搜索查询
  projectId?: string;         // 项目ID
  options?: FileSearchOptions;
}

// 文件搜索响应
export interface FileSearchResponse {
  results: FileSearchResult[];
  total: number;
  queryType: FileQueryType;
  processingTime: number;
  hasMore: boolean;
}

// 向量搜索参数
export interface VectorSearchParams {
  vector: number[];
  collectionName: string;
  limit: number;
  scoreThreshold: number;
  filter?: any;
}

// 索引构建选项
export interface IndexingOptions {
  batchSize?: number;         // 批处理大小，默认100
  reindexExisting?: boolean; // 是否重新索引已存在的文件，默认false
  includePatterns?: string[]; // 包含的文件模式，如['*.ts', '*.js']
  excludePatterns?: string[]; // 排除的文件模式，如['node_modules/**', '*.log']
  continueOnError?: boolean; // 遇到错误时是否继续处理，默认false
}

// 查询意图分类结果
export interface QueryIntentClassification {
  type: FileQueryType;
  confidence: number;
  extractedKeywords: string[];
  context: {
    hasPathPattern: boolean;
    hasSemanticTerms: boolean;
    hasExtensionFilter: boolean;
    hasTimeConstraint: boolean;
  };
}

// 缓存配置
export interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
}

// 缓存搜索结果
export interface CachedSearchResult {
  results: FileSearchResult[];
  expiresAt: number;
  createdAt: number;
}