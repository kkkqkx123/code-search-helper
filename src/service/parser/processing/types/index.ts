/**
* 类型系统模块统一导出
* 提供所有处理模块相关的类型定义
*/

// 代码块类型
export * from './CodeChunk';

// 处理相关类型
export * from './Processing';

// 上下文类型
export * from './Context';

// 配置类型
export * from './Config';

// 后处理类型
export * from './PostProcessing';

// 策略类型
export * from './Strategy';

// 工具类型已迁移到 IProcessingContext

// 重新导出常用类型，方便使用
export {
    // 代码块核心类型
    CodeChunk,
    ChunkMetadata,
    ChunkType,
    CodeChunkBuilder,
    CodeChunkUtils
} from './CodeChunk';

// 处理核心类型
export {
    ProcessingResult,
    ProcessingStrategy,
    ProcessingOptions,
    ProcessingStatus,
    ProcessingTask,
    ProcessingStats,
    ProcessingResultBuilder,
    ProcessingUtils
} from './Processing';

// 上下文核心类型
export {
    ProcessingContext,
    ContextMetadata,
    ContextBuilder,
    ContextUtils
} from './Context';

// 配置核心类型
export {
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
    ConfigUtils
} from './Config';

// 后处理核心类型
export {
    PostProcessor,
    PostProcessingContext,
    PostProcessingMetadata,
    PostProcessingResult,
    PostProcessingStats,
    PostProcessingTask,
    PostProcessingTaskStatus,
    PostProcessingResultBuilder,
    PostProcessingContextBuilder,
    PostProcessingUtils
} from './PostProcessing';

// 策略核心类型
export {
    StrategyConfig,
    StrategyResult,
    StrategyPerformanceStats,
    StrategySelectionCriteria,
    StrategyRegistration,
    IStrategy,
    StrategyUtils
} from './Strategy';

// 工具核心类型（从IProcessingContext导入）
export {
    DetailedFileFeatures,
    LanguageFeatures,
    ComplexityMetrics,
    LineEndingType,
    IndentType,
    CommentSyntax,
    StringSyntax,
    FeatureUtils
} from '../core/interfaces/IProcessingContext';
export { LanguageFamily } from '../../constants/language-family';
export { LanguageClassificationUtils } from '../../constants/language-classification';
export { CommentSyntaxUtils } from '../../constants/comment-syntax';

// AST节点类型
export { ASTNode } from './ASTNode';

// 重新导出处理相关类型
export {
    ResultMetadata
} from './Processing';

// 重新导出配置相关类型
export {
    ConfigValidationResult,
    ConfigChangeListener
} from './Config';

// 重新导出后处理相关类型
export {
    PostProcessorCoordinatorConfig
} from './PostProcessing';

// 重新导出策略相关类型
export {
    StrategyConstructor,
    StrategyFactoryConfig,
    StrategySelectionResult
} from './Strategy';

/**
 * 类型系统版本信息
 */
export const TYPES_VERSION = '1.0.0';

/**
 * 类型系统模块信息
 */
export const TYPES_MODULE_INFO = {
    name: 'processing-types',
    version: TYPES_VERSION,
    description: 'Unified type system for code processing module',
    author: 'Code Search Helper Team',
    created: new Date().toISOString(),
    modules: [
        'CodeChunk',
        'Processing',
        'Context',
        'Config',
        'PostProcessing',
        'Strategy',
        'Utils'
    ]
};