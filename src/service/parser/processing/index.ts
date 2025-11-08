// 统一处理层入口文件
// 整合了 universal、splitting、core/strategy 的功能

// 接口导出 - 从迁移的splitting接口
export {
  ISplitStrategy,
  IStrategyProvider,
  StrategyConfiguration,
  ChunkingOptions
} from './interfaces/ISplitStrategy';

export {
  IStrategyProvider as IStrategyProviderInterface
} from './interfaces/IStrategyProvider';

// 从各个类型文件导出所有类型
export { CodeChunk, CodeChunkMetadata, ChunkType } from './types/CodeChunk';
export { ChunkingOptions, EnhancedChunkingOptions, ChunkingPreset, ChunkingPresetFactory, DEFAULT_CHUNKING_OPTIONS, DEFAULT_ENHANCED_CHUNKING_OPTIONS } from './strategies/types/SegmentationTypes';

// 重新导出处理相关类型
export {
  ProcessingResult,
  ProcessingStrategy,
  ProcessingOptions,
  ProcessingStatus,
  ProcessingTask,
  ProcessingStats
} from './core/types/ResultTypes';

// 重新导出配置相关类型
export {
  ProcessingConfig,
  ChunkingConfig,
  FeatureConfig,
  PerformanceConfig,
  LanguageConfig,
  PostProcessingConfig,
  BoundaryConfig,
  WeightConfig,
  LanguageChunkingConfig
} from './core/types/ConfigTypes';

// 配置管理导入和导出
import { UnifiedConfigManager, UnifiedConfig, UniversalProcessingConfig } from '../config/UnifiedConfigManager';
export { UnifiedConfigManager, UnifiedConfig, UniversalProcessingConfig };

// 策略工厂导入和导出
// import { UnifiedStrategyFactory } from './strategies/factory/UnifiedStrategyFactory';
// export { UnifiedStrategyFactory };

// 策略管理器导入和导出
// import { UnifiedStrategyManager } from './strategies/manager/UnifiedStrategyManager';
// export { UnifiedStrategyManager };

// 检测服务导入和导出
import { UnifiedDetectionService, DetectionResult, FileFeatures, LanguageDetectionInfo } from './detection/UnifiedDetectionService';
export { UnifiedDetectionService, DetectionResult, FileFeatures, LanguageDetectionInfo };

// 处理协调器导入和导出
import { ProcessingCoordinator, ProcessingRequest, ProcessingPerformanceStats } from './coordinator';
export { ProcessingCoordinator, ProcessingRequest, ProcessingPerformanceStats };

// 重新导出协调器相关类型
export type {
  ProcessingContext,
  ContextMetadata
} from './types/Context';

export type {
  FileFeatures
} from './types/Utils';

// 工具函数导出
export * from './utils';

// 子模块导出
export * from './config';
export * from './detection';
export * from './utils/quality';

// 默认导出
export default {
  // 主要类
  UnifiedConfigManager,
  // UnifiedStrategyFactory,
  // UnifiedStrategyManager,
  UnifiedDetectionService,
  ProcessingCoordinator,

  // 接口（作为类型导出，不作为值）
};