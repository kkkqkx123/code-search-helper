// 统一处理层入口文件
// 整合了 universal、splitting、core/strategy 的功能

// 核心类型导出 - 从统一的类型系统导出
export type {
  // 代码块核心类型
  CodeChunk,
  ChunkMetadata,
  ChunkType,
  CodeChunkBuilder,
  CodeChunkUtils
} from './types/CodeChunk';

// 处理核心类型
export type {
  ProcessingResult,
  ProcessingStrategy,
  ProcessingOptions,
  ProcessingStatus,
  ProcessingTask,
  ProcessingStats,
  ProcessingResultBuilder,
  ProcessingUtils,
  ResultMetadata
} from './types/Processing';

// 上下文核心类型
export type {
  ProcessingContext,
  ContextMetadata,
  ContextBuilder,
  ContextUtils
} from './types/Context';

// 配置核心类型
export type {
  ProcessingConfig,
  ChunkingConfig,
  FeatureConfig,
  PerformanceConfig,
  LanguageConfig,
  PostProcessingConfig,
  BoundaryConfig,
  WeightConfig,
  LanguageChunkingConfig,
  DefaultConfigFactory,
  ConfigUtils,
  ConfigValidationResult,
  ConfigChangeListener
} from './types/Config';

// 后处理核心类型
export type {
  PostProcessor,
  PostProcessingMetadata,
  PostProcessingResult,
  PostProcessingStats,
  PostProcessingTask,
  PostProcessingTaskStatus,
  PostProcessingResultBuilder,
  PostProcessingContextBuilder,
  PostProcessingUtils,
  PostProcessorCoordinatorConfig
} from './types/PostProcessing';

// 策略核心类型
export type {
  StrategyConfig,
  StrategyResult,
  StrategyPerformanceStats,
  StrategySelectionCriteria,
  StrategyRegistration,
  IStrategy,
  StrategyUtils,
  StrategyConstructor,
  StrategyFactoryConfig,
  StrategySelectionResult
} from './types/Strategy';

// 工具核心类型
export type {
  FileFeatures,
  LanguageFeatures,
  ComplexityMetrics,
  CodeQualityMetrics,
  CodeQualityIssue,
  LineEndingType,
  IndentType,
  LanguageFamily,
  QualityIssueType,
  IssueSeverity,
  IFileFeatureDetector,
  IComplexityAnalyzer,
  ICodeQualityAnalyzer,
  FeatureUtils
} from './types/Utils';

// AST节点类型
export type { ASTNode } from './types/ASTNode';

// 分段相关类型
export type {
  ChunkingOptions,
  EnhancedChunkingOptions,
  ChunkingPreset,
  ChunkingPresetFactory,
  DEFAULT_CHUNKING_OPTIONS,
  DEFAULT_ENHANCED_CHUNKING_OPTIONS,
  UniversalChunkingOptions,
  SegmentationContext,
  ISegmentationProcessor,
  PerformanceStats,
  ITextSplitter,
  ISegmentationContextManager,
  IProtectionCoordinator,
  IConfigurationManager,
  IComplexityCalculator
} from './strategies/types/SegmentationTypes';

// 核心接口导出
export type {
  IProcessingStrategy,
  IStrategyFactory,
  IProcessingContext,
  IConfigManager,
  IOverlapCalculator,
  IPostProcessor
} from './core';

// 处理协调器导入和导出
export { ProcessingCoordinator, ProcessingRequest, ProcessingPerformanceStats } from './coordinator';

// 策略工厂导入和导出
export { StrategyFactory } from './factory';

// 检测服务导入和导出 - 从上级目录导入
export { 
  DetectionService as UnifiedDetectionService,
  DetectionResult,
  ProcessingStrategyType
} from '../detection/DetectionService';

// 重新导出检测相关的FileFeatures类型以避免冲突
export type { FileFeatures as DetectionFileFeatures } from '../detection/DetectionService';

// 语言检测信息
export type { LanguageDetectionInfo } from '../detection/DetectionService';

// 后处理器导出
export { ChunkPostProcessorCoordinator } from './post-processing/ChunkPostProcessorCoordinator';

// 后处理上下文类型 - 避免重复导出
export type { PostProcessingContext as ChunkPostProcessingContext } from './post-processing/IChunkPostProcessor';

// 工具函数导出
export * from './utils';

// 子模块导出
export * from './core';
export * from './strategies';

// 导入所需的类用于默认导出
import { ProcessingCoordinator } from './coordinator';
import { StrategyFactory } from './factory';
import { DetectionService } from '../detection/DetectionService';
import { ChunkPostProcessorCoordinator } from './post-processing/ChunkPostProcessorCoordinator';

// 默认导出
export default {
  // 主要类
  ProcessingCoordinator,
  StrategyFactory,
  UnifiedDetectionService: DetectionService,
  ChunkPostProcessorCoordinator,

  // 版本信息
  version: '1.0.0',
  
  // 模块信息
  moduleInfo: {
    name: 'processing-module',
    description: '统一代码处理模块',
    author: 'Code Search Helper Team'
  }
};