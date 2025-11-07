/**
 * Parser模块统一导出
 * 提供代码解析和结构提取的核心功能
 */

// 核心解析服务
export { TreeSitterCoreService } from './core/parse/TreeSitterCoreService';
export { CodeStructureService } from './core/structure/CodeStructureService';

// 语言检测服务
export { LanguageDetector } from './core/language-detection/LanguageDetector';

// 查询相关服务
export { TreeSitterQueryFacade } from './core/query/TreeSitterQueryFacade';
export { TreeSitterQueryEngine } from './core/query/TreeSitterQueryExecutor';
export { QueryManager } from './core/query/QueryManager';
export { QueryRegistryImpl } from './core/query/QueryRegistry';
export { QueryEngineFactory } from './core/query/QueryEngineFactory';
export { GlobalQueryInitializer } from './core/query/GlobalQueryInitializer';

// 工具类
export { TreeSitterUtils } from './utils/TreeSitterUtils';
export { FallbackExtractor } from './utils/FallbackExtractor';
export { DynamicParserManager } from './core/parse/DynamicParserManager';

// 配置相关
export { languageExtensionMap } from './utils';