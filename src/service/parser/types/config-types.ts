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



