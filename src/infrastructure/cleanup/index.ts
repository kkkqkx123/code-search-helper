/**
 * Cleanup基础设施模块索引文件
 * 提供清理功能的统一导出
 */

export { CleanupManager } from './CleanupManager';
export { ICleanupStrategy, ICleanupContext, ICleanupResult } from './ICleanupStrategy';
export { LRUCacheCleanupStrategy } from './strategies/LRUCacheCleanupStrategy';
export { TreeSitterCacheCleanupStrategy } from './strategies/TreeSitterCacheCleanupStrategy';
export { GarbageCollectionStrategy } from './strategies/GarbageCollectionStrategy';