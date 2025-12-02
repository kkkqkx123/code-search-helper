/**
 * Parser模块统一导出
 * 提供代码解析和结构提取的核心功能
 */

// 核心解析服务 - 新的统一接口
export { ParserFacade } from './core/parse/ParserFacade';
export { ParserQueryService } from './core/parse/ParserQueryService';
export { ParserCacheService } from './core/parse/ParserCacheService';
export { DynamicParserManager } from './core/parse/DynamicParserManager';

// 旧接口（标记为废弃，将在后续版本中移除）
// @deprecated 使用 ParserFacade 替代
export { TreeSitterCoreService } from './core/parse/TreeSitterCoreService';
// @deprecated 使用 ParserQueryService 替代
export { CodeStructureService } from './structure/CodeStructureService';

// 语言检测服务
export { LanguageDetector } from './core/language-detection/LanguageDetector';

// 查询相关服务
export { TreeSitterQueryFacade } from './core/query/TreeSitterQueryFacade';
export { TreeSitterQueryEngine } from './core/query/TreeSitterQueryExecutor';
export { QueryRegistryImpl } from './core/query/QueryRegistry';

// 工具类
export { TreeSitterUtils } from './utils/TreeSitterUtils';
export { FallbackExtractor } from './utils/FallbackExtractor';
export { DynamicParserManager } from './core/parse/DynamicParserManager';

// 配置相关
export { languageExtensionMap } from './utils';