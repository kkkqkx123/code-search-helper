/**
 * 协调器模块导出
 * 统一导出协调器相关的类和接口
 */

// 主要类导出
export { ProcessingCoordinator } from './ProcessingCoordinator';

// 接口导出
export type { ProcessingRequest, ProcessingPerformanceStats } from './ProcessingCoordinator';

// 重新导出相关类型，方便外部使用
export type {
  ProcessingResult,
  ProcessingOptions
} from '../types/Processing';

export type {
  ProcessingContext,
  ContextMetadata
} from '../types/Context';

export type {
  FileFeatures
} from '../types/Utils';

export type {
  ProcessingConfig,
  ChunkingConfig,
  FeatureConfig,
  PerformanceConfig
} from '../types/Config';

export type {
  CodeChunk,
  ChunkMetadata
} from '../types/CodeChunk';

// 重新导出核心接口
export type {
  IProcessingStrategy,
  IStrategyFactory,
  IProcessingContext,
  IConfigManager
} from '../core';

// 默认导出
export { ProcessingCoordinator as default } from './ProcessingCoordinator';