import { CodeChunk, CodeChunkMetadata, ChunkingOptions, ChunkingPreset } from '../../types/config-types';

// 重新导出基础类型以避免破坏现有导入
export {
  CodeChunk,
  CodeChunkMetadata,
  ChunkingOptions,
  ChunkingPreset,
};

// AST节点接口定义
export interface ASTNode {
  id: string;
  type: string;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  text: string;
  parent?: ASTNode;
  children?: ASTNode[];
  contentHash?: string; // 新增：内容哈希，用于相似性检测
  similarityGroup?: string; // 新增：相似性分组标识
}

// 代码分割器基础接口
export interface Splitter {
  /**
   * 分割代码
   * @param code 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   */
  split(code: string, language: string, filePath?: string): Promise<CodeChunk[]>;

  /**
   * 设置块大小
   * @param chunkSize 块大小
   */
  setChunkSize(chunkSize: number): void;

  /**
   * 设置块重叠大小
   * @param chunkOverlap 重叠大小
   */
  setChunkOverlap(chunkOverlap: number): void;
}

// 预设配置工厂
export class ChunkingPresetFactory {
  /**
   * 根据预设创建配置
   */
  static createPreset(preset: ChunkingPreset): ChunkingOptions {
    switch (preset) {
      case ChunkingPreset.FAST:
        return this.createFastPreset();
      case ChunkingPreset.BALANCED:
        return this.createBalancedPreset();
      case ChunkingPreset.QUALITY:
        return this.createQualityPreset();
      case ChunkingPreset.CUSTOM:
      default:
        return this.createCustomPreset();
    }
  }

  /**
   * 快速预设：性能优先，基础功能
   */
  private static createFastPreset(): ChunkingOptions {
    return {
      preset: ChunkingPreset.FAST,
      basic: {
        maxChunkSize: 2000,
        minChunkSize: 200,
        overlapSize: 100,
        preserveFunctionBoundaries: false,
        preserveClassBoundaries: false,
        includeComments: false,
        extractSnippets: false,
        addOverlap: false,
        optimizationLevel: 'low',
        maxLines: 5000
      },
      advanced: {
        enableASTBoundaryDetection: false,
        astNodeTracking: false,
        enableChunkDeduplication: false,
        enableSmartDeduplication: false,
        enableEnhancedBalancing: false,
        enableIntelligentFiltering: false,
        enableSmartRebalancing: false,
        enableBoundaryOptimization: false,
        enableAdvancedMerging: false
      },
      performance: {
        enablePerformanceOptimization: true,
        enablePerformanceMonitoring: false,
        enableChunkingCoordination: false,
        enableNodeTracking: false
      },
      quality: {
        boundaryScoring: {
          enableSemanticScoring: false,
          minBoundaryScore: 0.3,
          maxSearchDistance: 5,
          languageSpecificWeights: false
        },
        overlapStrategy: {
          preferredStrategy: 'line',
          enableContextOptimization: false,
          qualityThreshold: 0.5
        },
        functionSpecificOptions: {
          preferWholeFunctions: false,
          minFunctionOverlap: 20,
          maxFunctionSize: 1000,
          maxFunctionLines: 20,
          minFunctionLines: 3,
          enableSubFunctionExtraction: false
        },
        classSpecificOptions: {
          keepMethodsTogether: false,
          classHeaderOverlap: 50,
          maxClassSize: 1500
        }
      }
    };
  }

  /**
   * 平衡预设：功能与性能平衡
   */
  private static createBalancedPreset(): ChunkingOptions {
    return {
      preset: ChunkingPreset.BALANCED,
      basic: {
        maxChunkSize: 1000,
        minChunkSize: 100,
        overlapSize: 200,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: false,
        extractSnippets: true,
        addOverlap: false,
        optimizationLevel: 'medium',
        maxLines: 10000
      },
      advanced: {
        enableASTBoundaryDetection: true,
        astNodeTracking: false,
        enableChunkDeduplication: true,
        maxOverlapRatio: 0.3,
        deduplicationThreshold: 0.8,
        chunkMergeStrategy: 'conservative',
        minChunkSimilarity: 0.6,
        enableSmartDeduplication: false,
        similarityThreshold: 0.8,
        overlapMergeStrategy: 'conservative',
        maxOverlapLines: 50,
        enableEnhancedBalancing: true,
        balancedChunkerThreshold: 100,
        enableIntelligentFiltering: true,
        minChunkSizeThreshold: 50,
        maxChunkSizeThreshold: 2000,
        enableSmartRebalancing: true,
        rebalancingStrategy: 'conservative',
        enableBoundaryOptimization: true,
        boundaryOptimizationThreshold: 0.7,
        enableAdvancedMerging: false
      },
      performance: {
        enablePerformanceOptimization: true,
        enablePerformanceMonitoring: false,
        enableChunkingCoordination: false,
        enableNodeTracking: false
      },
      quality: {
        boundaryScoring: {
          enableSemanticScoring: true,
          minBoundaryScore: 0.5,
          maxSearchDistance: 10,
          languageSpecificWeights: true
        },
        overlapStrategy: {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.7
        },
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 2000,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        }
      }
    };
  }

  /**
   * 质量预设：最高质量，功能全面
   */
  private static createQualityPreset(): ChunkingOptions {
    return {
      preset: ChunkingPreset.QUALITY,
      basic: {
        maxChunkSize: 800,
        minChunkSize: 50,
        overlapSize: 200,
        preserveFunctionBoundaries: true,
        preserveClassBoundaries: true,
        includeComments: true,
        extractSnippets: true,
        addOverlap: true,
        optimizationLevel: 'high',
        maxLines: 15000
      },
      advanced: {
        enableASTBoundaryDetection: true,
        astNodeTracking: true,
        enableChunkDeduplication: true,
        maxOverlapRatio: 0.3,
        deduplicationThreshold: 0.8,
        chunkMergeStrategy: 'conservative',
        minChunkSimilarity: 0.6,
        enableSmartDeduplication: true,
        similarityThreshold: 0.8,
        overlapMergeStrategy: 'conservative',
        maxOverlapLines: 50,
        enableEnhancedBalancing: true,
        balancedChunkerThreshold: 100,
        enableIntelligentFiltering: true,
        minChunkSizeThreshold: 50,
        maxChunkSizeThreshold: 2000,
        enableSmartRebalancing: true,
        rebalancingStrategy: 'conservative',
        enableBoundaryOptimization: true,
        boundaryOptimizationThreshold: 0.7,
        enableAdvancedMerging: true,
        mergeDecisionThreshold: 0.75
      },
      performance: {
        enablePerformanceOptimization: true,
        enablePerformanceMonitoring: true,
        enableChunkingCoordination: true,
        strategyExecutionOrder: ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
        enableNodeTracking: true
      },
      quality: {
        boundaryScoring: {
          enableSemanticScoring: true,
          minBoundaryScore: 0.7,
          maxSearchDistance: 15,
          languageSpecificWeights: true
        },
        overlapStrategy: {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.8
        },
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 2000,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        }
      }
    };
  }

  /**
   * 自定义预设：用户完全控制
   */
  private static createCustomPreset(): ChunkingOptions {
    return {
      preset: ChunkingPreset.CUSTOM
    };
  }
}

// 配置合并工具
export class ChunkingOptionsMerger {
  /**
   * 合并配置选项
   */
  static merge(base: ChunkingOptions, override: ChunkingOptions): ChunkingOptions {
    const result: ChunkingOptions = { ...base };

    // 合并预设
    if (override.preset) {
      result.preset = override.preset;
    }

    // 合并分层配置
    if (override.basic) {
      result.basic = { ...base.basic, ...override.basic };
    }

    if (override.advanced) {
      result.advanced = { ...base.advanced, ...override.advanced };
    }

    if (override.performance) {
      result.performance = { ...base.performance, ...override.performance };
    }

    if (override.quality) {
      result.quality = { ...base.quality, ...override.quality };
    }

    // 合并其他属性
    if (override.treeSitterService) {
      result.treeSitterService = override.treeSitterService;
    }

    if (override.universalTextStrategy) {
      result.universalTextStrategy = override.universalTextStrategy;
    }

    return result;
  }
}

// 默认配置（向后兼容）
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = ChunkingPresetFactory.createPreset(ChunkingPreset.BALANCED);

// 向后兼容的别名
export const DEFAULT_ENHANCED_CHUNKING_OPTIONS = DEFAULT_CHUNKING_OPTIONS;

// 向后兼容的类型别名
export type EnhancedChunkingOptions = ChunkingOptions;

// 增强的SplitStrategy接口，支持节点跟踪
export interface SplitStrategy {
  /**
   * 执行代码分段
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   * @param nodeTracker AST节点跟踪器（可选）
   * @param ast AST树（可选）
   */
  split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]>;

  /**
   * 获取策略名称（用于日志和调试）
   */
  getName(): string;

  /**
   * 检查是否支持该语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 提取代码块关联的AST节点（新增）
   * @param chunk 代码块
   * @param ast AST树
   */
  extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

  /**
   * 检查代码块是否包含已使用的节点（新增）
   * @param chunk 代码块
   * @param nodeTracker 节点跟踪器
   * @param ast AST树
   */
  hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

export interface ComplexityCalculator {
  /**
   * 计算代码复杂度
   * @param content 代码内容
   */
  calculate(content: string): number;

  /**
   * 快速估算复杂度（用于性能优化）
   * @param content 代码内容
   */
  estimate(content: string): number;

  /**
   * 计算语义分数
   * @param line 单行代码
   */
  calculateSemanticScore(line: string): number;
}

export interface SyntaxValidator {
  /**
   * 验证代码段语法完整性
   * @param content 代码内容
   * @param language 编程语言
   */
  validate(content: string, language: string): boolean;

  /**
   * 检查符号平衡（使用BalancedChunker）
   * @param content 代码内容
   */
  checkSymbolBalance(content: string): boolean;
}

export interface ChunkOptimizer {
  /**
   * 优化块大小
   * @param chunks 代码块数组
   * @param originalCode 原始代码（用于上下文）
   */
  optimize(chunks: CodeChunk[], originalCode: string): CodeChunk[];

  /**
   * 检查是否应该合并两个块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk): boolean;

  /**
   * 合并两个代码块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  merge(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk;
}

export interface OverlapCalculator {
  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[];

  /**
   * 提取重叠内容
   * @param currentChunk 当前块
   * @param nextChunk 下一个块
   * @param originalCode 原始代码
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string;

  /**
   * 智能计算重叠
   * @param currentChunk 当前块的行数组
   * @param originalCode 原始代码
   * @param startLine 起始行号
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[];
}

/**
 * 重叠计算器接口（用于装饰器模式）
 */
export interface IOverlapCalculator {
  addOverlap(chunks: CodeChunk[], content: string): Promise<CodeChunk[]>;
}

export interface PerformanceStats {
  totalLines: number;
  totalTime: number;
  averageTimePerLine: number;
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export interface PerformanceMonitor {
  /**
   * 记录性能指标
   * @param startTime 开始时间
   * @param linesProcessed 处理的行数
   * @param cacheHit 是否缓存命中
   */
  record(startTime: number, linesProcessed: number, cacheHit: boolean): void;

  /**
   * 获取性能统计
   */
  getStats(): PerformanceStats;

  /**
   * 重置性能统计
   */
  reset(): void;
}