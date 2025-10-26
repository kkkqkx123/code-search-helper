// 统一处理层入口文件
// 整合了 universal、splitting、core/strategy 的功能

// 接口导出
export {
  ISplitStrategy,
  IStrategyProvider,
  ChunkingOptions,
  CodeChunk,
  CodeChunkMetadata,
  ASTNode,
  StrategyConfiguration,
  StrategyManagerConfig,
  StrategyExecutionContext,
  StrategyExecutionResult
} from '../interfaces/ISplitStrategy';

export {
  IStrategyProvider as IStrategyProviderInterface
} from '../interfaces/IStrategyProvider';

// 配置管理导出
export {
  UnifiedConfigManager,
  UnifiedConfig,
  UniversalProcessingConfig
} from '../config/UnifiedConfigManager';

// 策略工厂导出
export {
  UnifiedStrategyFactory
} from './strategies/factory/UnifiedStrategyFactory';

// 策略管理器导出
export {
  UnifiedStrategyManager
} from './strategies/manager/UnifiedStrategyManager';

// 检测服务导出
export {
  UnifiedDetectionService,
  DetectionResult,
  FileFeatures,
  LanguageDetectionInfo
} from './detection/UnifiedDetectionService';

// 处理协调器导出
export {
  UnifiedProcessingCoordinator,
  ProcessingResult,
  ProcessingContext
} from './coordination/UnifiedProcessingCoordinator';

// 类型定义导出
export * from './types';

// 工具函数导出
export * from './utils';

// 重新导出核心类型以保持向后兼容
export type {
  SplitStrategy as LegacySplitStrategy,
  ChunkingOptions as LegacyChunkingOptions,
  CodeChunk as LegacyCodeChunk,
  CodeChunkMetadata as LegacyCodeChunkMetadata
} from '../splitting';

// 默认导出
export default {
  // 主要类
  UnifiedConfigManager,
  UnifiedStrategyFactory,
  UnifiedStrategyManager,
  UnifiedDetectionService,
  UnifiedProcessingCoordinator,
  
  // 接口
  ISplitStrategy,
  IStrategyProvider,
  
  // 类型
  ChunkingOptions,
  CodeChunk,
  DetectionResult,
  ProcessingResult,
  ProcessingContext
};