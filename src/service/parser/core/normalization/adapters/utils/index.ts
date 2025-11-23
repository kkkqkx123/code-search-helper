/**
 * 标准化适配器工具函数索引
 * 导出所有从BaseLanguageAdapter中提取的工具函数
 */

export * from './QueryResultUtils';
export {
  deduplicateResults,
  postProcessResults,
  createErrorResult,
  fallbackNormalization
} from './PostProcessingUtils';
export {
  BaseRelationshipExtractor,
  RelationshipMetadata,
  SymbolTable,
  RelationshipExtractorUtils
} from './RelationshipExtractorUtils';