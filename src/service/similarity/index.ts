/**
 * 相似度服务模块统一导出
 */

// 主服务类
export { SimilarityService } from './SimilarityService';

// 类型定义
export * from './types/SimilarityTypes';

// 策略实现
export { BaseSimilarityStrategy } from './strategies/BaseSimilarityStrategy';
export { LevenshteinSimilarityStrategy } from './strategies/LevenshteinSimilarityStrategy';
export { SemanticSimilarityStrategy } from './strategies/SemanticSimilarityStrategy';
export { KeywordSimilarityStrategy } from './strategies/KeywordSimilarityStrategy';
export { HybridSimilarityStrategy } from './strategies/HybridSimilarityStrategy';

// 缓存管理
export { SimilarityCacheManager } from './cache/SimilarityCacheManager';

// 性能监控
export { SimilarityPerformanceMonitor } from './monitoring/SimilarityPerformanceMonitor';

// 工具类（重构为异步）
export { SimilarityUtils } from './utils/SimilarityUtils';
export { SimilarityDetector } from './utils/SimilarityDetector';

// 初始化器
export { SimilarityServiceInitializer } from './initializer/SimilarityServiceInitializer';

// 服务注册器
export { SimilarityServiceRegistrar } from '../../core/registrars/SimilarityServiceRegistrar';