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
  StrategyConfiguration
} from '../interfaces/ISplitStrategy';

export {
  IStrategyProvider as IStrategyProviderInterface
} from '../interfaces/IStrategyProvider';

// 配置管理导入和导出
import { UnifiedConfigManager, UnifiedConfig, UniversalProcessingConfig } from '../config/UnifiedConfigManager';
export { UnifiedConfigManager, UnifiedConfig, UniversalProcessingConfig };

// 策略工厂导入和导出
import { UnifiedStrategyFactory } from './strategies/factory/UnifiedStrategyFactory';
export { UnifiedStrategyFactory };

// 策略管理器导入和导出
import { UnifiedStrategyManager } from './strategies/manager/UnifiedStrategyManager';
export { UnifiedStrategyManager };

// 检测服务导入和导出
import { UnifiedDetectionService, DetectionResult, FileFeatures, LanguageDetectionInfo } from './detection/UnifiedDetectionService';
export { UnifiedDetectionService, DetectionResult, FileFeatures, LanguageDetectionInfo };

// 处理协调器导入和导出
import { UnifiedProcessingCoordinator, ProcessingResult, ProcessingContext } from './coordination/UnifiedProcessingCoordinator';
export { UnifiedProcessingCoordinator, ProcessingResult, ProcessingContext };

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
  
  // 接口（作为类型导出，不作为值）
  
  // 类型
  // 注意：这些是类型，不能作为值使用
};