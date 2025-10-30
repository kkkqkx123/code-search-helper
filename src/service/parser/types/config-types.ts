import { CodeChunk, CodeChunkMetadata } from './core-types';

// 重新导出基础类型
export { CodeChunk, CodeChunkMetadata };

// 配置预设枚举
export enum ChunkingPreset {
  FAST = 'fast',           // 快速模式：基础功能，性能优先
  BALANCED = 'balanced',   // 平衡模式：功能与性能平衡
  QUALITY = 'quality',     // 质量模式：最高质量，功能全面
  CUSTOM = 'custom'        // 自定义模式：用户完全控制
}

// 基础分段配置
export interface BasicChunkingConfig {
  maxChunkSize: number;
  minChunkSize: number;
  overlapSize: number;
  preserveFunctionBoundaries: boolean;
  preserveClassBoundaries: boolean;
  includeComments: boolean;
  extractSnippets: boolean;
  addOverlap: boolean;
  optimizationLevel: 'low' | 'medium' | 'high';
  maxLines: number;
}

// 高级分段配置
export interface AdvancedChunkingConfig {
  adaptiveBoundaryThreshold: boolean;
  contextAwareOverlap: boolean;
  semanticWeight: number;
  syntacticWeight: number;
  enableASTBoundaryDetection: boolean;
  astNodeTracking: boolean;
  enableChunkDeduplication: boolean;
  maxOverlapRatio: number;
  deduplicationThreshold: number;
  chunkMergeStrategy: 'aggressive' | 'conservative';
  minChunkSimilarity: number;
  enableSmartDeduplication: boolean;
  similarityThreshold: number;
  overlapMergeStrategy: 'aggressive' | 'conservative';
  maxOverlapLines: number;
  enableEnhancedBalancing: boolean;
  balancedChunkerThreshold: number;
  enableIntelligentFiltering: boolean;
  minChunkSizeThreshold: number;
  maxChunkSizeThreshold: number;
  enableSmartRebalancing: boolean;
  rebalancingStrategy: 'conservative' | 'aggressive';
  enableBoundaryOptimization: boolean;
  boundaryOptimizationThreshold: number;
  enableAdvancedMerging: boolean;
  mergeDecisionThreshold: number;
}

// 性能配置
export interface PerformanceConfig {
  enablePerformanceOptimization: boolean;
  enablePerformanceMonitoring: boolean;
  enableChunkingCoordination: boolean;
  strategyExecutionOrder: string[];
  enableNodeTracking: boolean;
}

// 质量配置
export interface QualityConfig {
  boundaryScoring: {
    enableSemanticScoring: boolean;
    minBoundaryScore: number;
    maxSearchDistance: number;
    languageSpecificWeights: boolean;
  };
  overlapStrategy: {
    preferredStrategy: 'semantic' | 'syntactic' | 'line' | 'overlap';
    enableContextOptimization: boolean;
    qualityThreshold: number;
  };
  functionSpecificOptions: {
    preferWholeFunctions: boolean;
    minFunctionOverlap: number;
    maxFunctionSize: number;
    maxFunctionLines: number;
    minFunctionLines: number;
    enableSubFunctionExtraction: boolean;
  };
  classSpecificOptions: {
    keepMethodsTogether: boolean;
    classHeaderOverlap: number;
    maxClassSize: number;
  };
}

// 统一的 ChunkingOptions 接口
export interface ChunkingOptions {
  // 配置预设
  preset?: ChunkingPreset;
  
  // 分层配置
  basic?: Partial<BasicChunkingConfig>;
  
  // 高级配置
  advanced?: Partial<AdvancedChunkingConfig>;
  
  // 性能配置
  performance?: Partial<PerformanceConfig>;
  
  // 质量配置
  quality?: Partial<QualityConfig>;
  
  // 策略提供者支持
  treeSitterService?: any;
  universalTextStrategy?: any;
}

// 兼容性接口（用于旧代码）
export interface LegacyChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
  addOverlap?: boolean;
  optimizationLevel?: 'low' | 'medium' | 'high';
  maxLines?: number;
  adaptiveBoundaryThreshold?: boolean;
  contextAwareOverlap?: boolean;
  semanticWeight?: number;
  syntacticWeight?: number;
  boundaryScoring?: {
    enableSemanticScoring: boolean;
    minBoundaryScore: number;
    maxSearchDistance: number;
    languageSpecificWeights: boolean;
  };
  overlapStrategy?: {
    preferredStrategy: 'semantic' | 'syntactic' | 'line' | 'overlap';
    enableContextOptimization: boolean;
    qualityThreshold: number;
  };
  functionSpecificOptions?: {
    preferWholeFunctions: boolean;
    minFunctionOverlap: number;
    maxFunctionSize: number;
    maxFunctionLines: number;
    minFunctionLines: number;
    enableSubFunctionExtraction: boolean;
  };
  classSpecificOptions?: {
    keepMethodsTogether: boolean;
    classHeaderOverlap: number;
    maxClassSize: number;
  };
  enableASTBoundaryDetection?: boolean;
  enableChunkDeduplication?: boolean;
  maxOverlapRatio?: number;
  deduplicationThreshold?: number;
  astNodeTracking?: boolean;
  chunkMergeStrategy?: 'aggressive' | 'conservative';
  minChunkSimilarity?: number;
  enablePerformanceOptimization?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableChunkingCoordination?: boolean;
  strategyExecutionOrder?: string[];
  enableNodeTracking?: boolean;
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  overlapMergeStrategy?: 'aggressive' | 'conservative';
  maxOverlapLines?: number;
  enableEnhancedBalancing?: boolean;
  balancedChunkerThreshold?: number;
  enableIntelligentFiltering?: boolean;
  minChunkSizeThreshold?: number;
  maxChunkSizeThreshold?: number;
  enableSmartRebalancing?: boolean;
  rebalancingStrategy?: 'conservative' | 'aggressive';
  enableBoundaryOptimization?: boolean;
  boundaryOptimizationThreshold?: number;
  enableAdvancedMerging?: boolean;
  mergeDecisionThreshold?: number;
  treeSitterService?: any;
  universalTextStrategy?: any;
}

// 配置转换工具
export class ChunkingOptionsConverter {
  /**
   * 将旧配置转换为新配置
   */
  static fromLegacy(legacy: LegacyChunkingOptions): ChunkingOptions {
    const options: ChunkingOptions = {};
    
    // 转换基础配置
    if (legacy.maxChunkSize || legacy.minChunkSize || legacy.overlapSize || 
        legacy.preserveFunctionBoundaries || legacy.preserveClassBoundaries ||
        legacy.includeComments || legacy.extractSnippets || legacy.addOverlap ||
        legacy.optimizationLevel || legacy.maxLines) {
      options.basic = {
        maxChunkSize: legacy.maxChunkSize ?? 1000,
        minChunkSize: legacy.minChunkSize ?? 100,
        overlapSize: legacy.overlapSize ?? 200,
        preserveFunctionBoundaries: legacy.preserveFunctionBoundaries ?? true,
        preserveClassBoundaries: legacy.preserveClassBoundaries ?? true,
        includeComments: legacy.includeComments ?? false,
        extractSnippets: legacy.extractSnippets ?? true,
        addOverlap: legacy.addOverlap ?? false,
        optimizationLevel: legacy.optimizationLevel ?? 'medium',
        maxLines: legacy.maxLines ?? 10000
      };
    }
    
    // 转换高级配置
    if (legacy.adaptiveBoundaryThreshold || legacy.contextAwareOverlap ||
        legacy.semanticWeight || legacy.syntacticWeight ||
        legacy.enableASTBoundaryDetection || legacy.astNodeTracking ||
        legacy.enableChunkDeduplication || legacy.maxOverlapRatio ||
        legacy.deduplicationThreshold || legacy.chunkMergeStrategy ||
        legacy.minChunkSimilarity || legacy.enableSmartDeduplication ||
        legacy.similarityThreshold || legacy.overlapMergeStrategy ||
        legacy.maxOverlapLines || legacy.enableEnhancedBalancing ||
        legacy.balancedChunkerThreshold || legacy.enableIntelligentFiltering ||
        legacy.minChunkSizeThreshold || legacy.maxChunkSizeThreshold ||
        legacy.enableSmartRebalancing || legacy.rebalancingStrategy ||
        legacy.enableBoundaryOptimization || legacy.boundaryOptimizationThreshold ||
        legacy.enableAdvancedMerging || legacy.mergeDecisionThreshold) {
      options.advanced = {
        adaptiveBoundaryThreshold: legacy.adaptiveBoundaryThreshold ?? false,
        contextAwareOverlap: legacy.contextAwareOverlap ?? false,
        semanticWeight: legacy.semanticWeight ?? 0.7,
        syntacticWeight: legacy.syntacticWeight ?? 0.3,
        enableASTBoundaryDetection: legacy.enableASTBoundaryDetection ?? false,
        astNodeTracking: legacy.astNodeTracking ?? false,
        enableChunkDeduplication: legacy.enableChunkDeduplication ?? false,
        maxOverlapRatio: legacy.maxOverlapRatio ?? 0.3,
        deduplicationThreshold: legacy.deduplicationThreshold ?? 0.8,
        chunkMergeStrategy: legacy.chunkMergeStrategy ?? 'conservative',
        minChunkSimilarity: legacy.minChunkSimilarity ?? 0.6,
        enableSmartDeduplication: legacy.enableSmartDeduplication ?? false,
        similarityThreshold: legacy.similarityThreshold ?? 0.8,
        overlapMergeStrategy: legacy.overlapMergeStrategy ?? 'conservative',
        maxOverlapLines: legacy.maxOverlapLines ?? 50,
        enableEnhancedBalancing: legacy.enableEnhancedBalancing ?? true,
        balancedChunkerThreshold: legacy.balancedChunkerThreshold ?? 100,
        enableIntelligentFiltering: legacy.enableIntelligentFiltering ?? true,
        minChunkSizeThreshold: legacy.minChunkSizeThreshold ?? 50,
        maxChunkSizeThreshold: legacy.maxChunkSizeThreshold ?? 2000,
        enableSmartRebalancing: legacy.enableSmartRebalancing ?? true,
        rebalancingStrategy: legacy.rebalancingStrategy ?? 'conservative',
        enableBoundaryOptimization: legacy.enableBoundaryOptimization ?? true,
        boundaryOptimizationThreshold: legacy.boundaryOptimizationThreshold ?? 0.7,
        enableAdvancedMerging: legacy.enableAdvancedMerging ?? true,
        mergeDecisionThreshold: legacy.mergeDecisionThreshold ?? 0.75
      };
    }
    
    // 转换性能配置
    if (legacy.enablePerformanceOptimization || legacy.enablePerformanceMonitoring ||
        legacy.enableChunkingCoordination || legacy.strategyExecutionOrder ||
        legacy.enableNodeTracking) {
      options.performance = {
        enablePerformanceOptimization: legacy.enablePerformanceOptimization ?? false,
        enablePerformanceMonitoring: legacy.enablePerformanceMonitoring ?? false,
        enableChunkingCoordination: legacy.enableChunkingCoordination ?? false,
        strategyExecutionOrder: legacy.strategyExecutionOrder ?? ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
        enableNodeTracking: legacy.enableNodeTracking ?? false
      };
    }
    
    // 转换质量配置
    if (legacy.boundaryScoring || legacy.overlapStrategy ||
        legacy.functionSpecificOptions || legacy.classSpecificOptions) {
      options.quality = {
        boundaryScoring: legacy.boundaryScoring ?? {
          enableSemanticScoring: true,
          minBoundaryScore: 0.5,
          maxSearchDistance: 10,
          languageSpecificWeights: true
        },
        overlapStrategy: legacy.overlapStrategy ?? {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.7
        },
        functionSpecificOptions: legacy.functionSpecificOptions ?? {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 2000,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: legacy.classSpecificOptions ?? {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        }
      };
    }
    
    // 转换其他属性
    if (legacy.treeSitterService || legacy.universalTextStrategy) {
      options.treeSitterService = legacy.treeSitterService;
      options.universalTextStrategy = legacy.universalTextStrategy;
    }
    
    return options;
  }
  
  /**
   * 将新配置转换为旧配置（用于兼容性）
   */
  static toLegacy(options: ChunkingOptions): LegacyChunkingOptions {
    const legacy: LegacyChunkingOptions = {};
    
    // 从基础配置转换
    if (options.basic) {
      legacy.maxChunkSize = options.basic.maxChunkSize;
      legacy.minChunkSize = options.basic.minChunkSize;
      legacy.overlapSize = options.basic.overlapSize;
      legacy.preserveFunctionBoundaries = options.basic.preserveFunctionBoundaries;
      legacy.preserveClassBoundaries = options.basic.preserveClassBoundaries;
      legacy.includeComments = options.basic.includeComments;
      legacy.extractSnippets = options.basic.extractSnippets;
      legacy.addOverlap = options.basic.addOverlap;
      legacy.optimizationLevel = options.basic.optimizationLevel;
      legacy.maxLines = options.basic.maxLines;
    }
    
    // 从高级配置转换
    if (options.advanced) {
      legacy.adaptiveBoundaryThreshold = options.advanced.adaptiveBoundaryThreshold;
      legacy.contextAwareOverlap = options.advanced.contextAwareOverlap;
      legacy.semanticWeight = options.advanced.semanticWeight;
      legacy.syntacticWeight = options.advanced.syntacticWeight;
      legacy.enableASTBoundaryDetection = options.advanced.enableASTBoundaryDetection;
      legacy.astNodeTracking = options.advanced.astNodeTracking;
      legacy.enableChunkDeduplication = options.advanced.enableChunkDeduplication;
      legacy.maxOverlapRatio = options.advanced.maxOverlapRatio;
      legacy.deduplicationThreshold = options.advanced.deduplicationThreshold;
      legacy.chunkMergeStrategy = options.advanced.chunkMergeStrategy;
      legacy.minChunkSimilarity = options.advanced.minChunkSimilarity;
      legacy.enableSmartDeduplication = options.advanced.enableSmartDeduplication;
      legacy.similarityThreshold = options.advanced.similarityThreshold;
      legacy.overlapMergeStrategy = options.advanced.overlapMergeStrategy;
      legacy.maxOverlapLines = options.advanced.maxOverlapLines;
      legacy.enableEnhancedBalancing = options.advanced.enableEnhancedBalancing;
      legacy.balancedChunkerThreshold = options.advanced.balancedChunkerThreshold;
      legacy.enableIntelligentFiltering = options.advanced.enableIntelligentFiltering;
      legacy.minChunkSizeThreshold = options.advanced.minChunkSizeThreshold;
      legacy.maxChunkSizeThreshold = options.advanced.maxChunkSizeThreshold;
      legacy.enableSmartRebalancing = options.advanced.enableSmartRebalancing;
      legacy.rebalancingStrategy = options.advanced.rebalancingStrategy;
      legacy.enableBoundaryOptimization = options.advanced.enableBoundaryOptimization;
      legacy.boundaryOptimizationThreshold = options.advanced.boundaryOptimizationThreshold;
      legacy.enableAdvancedMerging = options.advanced.enableAdvancedMerging;
      legacy.mergeDecisionThreshold = options.advanced.mergeDecisionThreshold;
    }
    
    // 从性能配置转换
    if (options.performance) {
      legacy.enablePerformanceOptimization = options.performance.enablePerformanceOptimization;
      legacy.enablePerformanceMonitoring = options.performance.enablePerformanceMonitoring;
      legacy.enableChunkingCoordination = options.performance.enableChunkingCoordination;
      legacy.strategyExecutionOrder = options.performance.strategyExecutionOrder;
      legacy.enableNodeTracking = options.performance.enableNodeTracking;
    }
    
    // 从质量配置转换
    if (options.quality) {
      legacy.boundaryScoring = options.quality.boundaryScoring;
      legacy.overlapStrategy = options.quality.overlapStrategy;
      legacy.functionSpecificOptions = options.quality.functionSpecificOptions;
      legacy.classSpecificOptions = options.quality.classSpecificOptions;
    }
    
    // 转换其他属性
    legacy.treeSitterService = options.treeSitterService;
    legacy.universalTextStrategy = options.universalTextStrategy;
    
    return legacy;
  }
}