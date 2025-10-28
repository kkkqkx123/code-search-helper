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

// 从splitting-types.ts导出所有类型
export {
  CodeChunk,
  CodeChunkMetadata,
  ASTNode,
  Splitter,
  ComplexityCalculator,
  SyntaxValidator,
  ChunkOptimizer,
  OverlapCalculator,
  PerformanceStats,
  PerformanceMonitor,
  DEFAULT_CHUNKING_OPTIONS,
  DEFAULT_ENHANCED_CHUNKING_OPTIONS,
  SplitStrategy,
  EnhancedChunkingOptions
} from './types/splitting-types';

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
  UnifiedStrategyFactory,
  UnifiedStrategyManager,
  UnifiedDetectionService,
  UnifiedProcessingCoordinator,

  // 接口（作为类型导出，不作为值）
};