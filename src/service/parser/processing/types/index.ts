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

// 工具类型
export * from './Utils';

// 重新导出常用类型，方便使用
export {
  // 代码块核心类型
  CodeChunk,
  ChunkMetadata,
  ChunkType,
  CodeChunkBuilder,
  CodeChunkUtils,
  
  // 处理核心类型
  ProcessingResult,
  ProcessingStrategy,
  ProcessingOptions,
  ProcessingStatus,
  ProcessingTask,
  ProcessingStats,
  ProcessingResultBuilder,
  ProcessingUtils,
  
  // 上下文核心类型
  ProcessingContext,
  ContextMetadata,
  ContextBuilder,
  ContextUtils,
  
  // 配置核心类型
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
  
  // 后处理核心类型
  PostProcessor,
  PostProcessingContext,
  PostProcessingMetadata,
  PostProcessingResult,
  PostProcessingStats,
  PostProcessingTask,
  PostProcessingTaskStatus,
  PostProcessingResultBuilder,
  PostProcessingContextBuilder,
  PostProcessingUtils,
  
  // 策略核心类型
  StrategyConfig,
  StrategyResult,
  StrategyPerformanceStats,
  StrategySelectionCriteria,
  StrategyRegistration,
  IStrategy,
  StrategyUtils,
  
  // 工具核心类型
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
} from './CodeChunk';

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

/**
 * 类型验证工具
 */
export class TypeValidator {
  /**
   * 验证代码块
   */
  static validateCodeChunk(chunk: any): boolean {
    return chunk && 
           typeof chunk.content === 'string' && 
           chunk.metadata && 
           typeof chunk.metadata.startLine === 'number' &&
           typeof chunk.metadata.endLine === 'number' &&
           typeof chunk.metadata.language === 'string' &&
           typeof chunk.metadata.strategy === 'string' &&
           typeof chunk.metadata.type === 'string';
  }

  /**
   * 验证处理结果
   */
  static validateProcessingResult(result: any): boolean {
    return result && 
           Array.isArray(result.chunks) &&
           typeof result.success === 'boolean' &&
           typeof result.executionTime === 'number' &&
           typeof result.strategy === 'string';
  }

  /**
   * 验证处理上下文
   */
  static validateProcessingContext(context: any): boolean {
    return context && 
           typeof context.content === 'string' &&
           typeof context.language === 'string' &&
           context.config &&
           context.features &&
           context.metadata;
  }

  /**
   * 验证处理配置
   */
  static validateProcessingConfig(config: any): boolean {
    return config && 
           config.chunking &&
           config.features &&
           config.performance &&
           config.languages &&
           config.postProcessing;
  }

  /**
   * 验证后处理器
   */
  static validatePostProcessor(processor: any): boolean {
    return processor && 
           typeof processor.name === 'string' &&
           typeof processor.priority === 'number' &&
           typeof processor.shouldApply === 'function' &&
           typeof processor.process === 'function';
  }

  /**
   * 验证策略
   */
  static validateStrategy(strategy: any): boolean {
    return strategy && 
           typeof strategy.name === 'string' &&
           typeof strategy.priority === 'number' &&
           Array.isArray(strategy.supportedLanguages) &&
           typeof strategy.canHandle === 'function' &&
           typeof strategy.execute === 'function';
  }

  /**
   * 验证文件特征
   */
  static validateFileFeatures(features: any): boolean {
    return features && 
           typeof features.size === 'number' &&
           typeof features.lineCount === 'number' &&
           typeof features.characterCount === 'number' &&
           typeof features.isBinary === 'boolean' &&
           typeof features.isText === 'boolean' &&
           typeof features.isCode === 'boolean';
  }

  /**
   * 验证复杂度指标
   */
  static validateComplexityMetrics(metrics: any): boolean {
    return metrics && 
           typeof metrics.cyclomaticComplexity === 'number' &&
           typeof metrics.cognitiveComplexity === 'number' &&
           typeof metrics.nestingDepth === 'number' &&
           typeof metrics.functionCount === 'number' &&
           typeof metrics.classCount === 'number';
  }
}

/**
 * 类型转换工具
 */
export class TypeConverter {
  /**
   * 将旧类型转换为新类型
   */
  static convertLegacyChunk(legacyChunk: any): CodeChunk {
    // 这里提供从旧类型到新类型的转换逻辑
    // 具体实现需要根据旧类型的结构来定义
    return {
      content: legacyChunk.content || '',
      metadata: {
        startLine: legacyChunk.startLine || 0,
        endLine: legacyChunk.endLine || 0,
        language: legacyChunk.language || 'unknown',
        strategy: legacyChunk.strategy || 'unknown',
        timestamp: Date.now(),
        type: legacyChunk.type || 'generic',
        ...legacyChunk.metadata
      }
    };
  }

  /**
   * 将旧配置转换为新配置
   */
  static convertLegacyConfig(legacyConfig: any): ProcessingConfig {
    // 这里提供从旧配置到新配置的转换逻辑
    // 具体实现需要根据旧配置的结构来定义
    return {
      chunking: {
        maxChunkSize: legacyConfig.maxChunkSize || 2000,
        minChunkSize: legacyConfig.minChunkSize || 100,
        overlapSize: legacyConfig.overlapSize || 50,
        maxLinesPerChunk: legacyConfig.maxLinesPerChunk || 100,
        minLinesPerChunk: legacyConfig.minLinesPerChunk || 5,
        maxOverlapRatio: legacyConfig.maxOverlapRatio || 0.2,
        defaultStrategy: legacyConfig.defaultStrategy || 'hybrid',
        availableStrategies: legacyConfig.availableStrategies || ['line', 'semantic', 'ast', 'bracket', 'hybrid'],
        enableAdaptiveStrategy: legacyConfig.enableAdaptiveStrategy !== false
      },
      features: {
        enableAST: legacyConfig.enableAST !== false,
        enableSemanticDetection: legacyConfig.enableSemanticDetection !== false,
        enableBracketBalance: legacyConfig.enableBracketBalance !== false,
        enableCodeOverlap: legacyConfig.enableCodeOverlap !== false,
        enableStandardization: legacyConfig.enableStandardization !== false,
        standardizationFallback: legacyConfig.standardizationFallback !== false,
        enableComplexityAnalysis: legacyConfig.enableComplexityAnalysis !== false,
        enableDependencyAnalysis: legacyConfig.enableDependencyAnalysis || false
      },
      performance: {
        memoryLimitMB: legacyConfig.memoryLimitMB || 512,
        maxExecutionTime: legacyConfig.maxExecutionTime || 30000,
        enableCaching: legacyConfig.enableCaching !== false,
        cacheSizeLimit: legacyConfig.cacheSizeLimit || 1000,
        enablePerformanceMonitoring: legacyConfig.enablePerformanceMonitoring !== false,
        concurrencyLimit: legacyConfig.concurrencyLimit || 4,
        enableBatchProcessing: legacyConfig.enableBatchProcessing || false,
        batchSize: legacyConfig.batchSize || 10
      },
      languages: legacyConfig.languages || {},
      postProcessing: {
        enabled: legacyConfig.enablePostProcessing !== false,
        enabledProcessors: legacyConfig.enabledProcessors || [],
        processorConfigs: legacyConfig.processorConfigs || {},
        maxProcessingRounds: legacyConfig.maxProcessingRounds || 3,
        enableParallelProcessing: legacyConfig.enableParallelProcessing || false
      },
      version: legacyConfig.version || '1.0.0',
      createdAt: legacyConfig.createdAt || Date.now(),
      updatedAt: legacyConfig.updatedAt || Date.now()
    };
  }
}