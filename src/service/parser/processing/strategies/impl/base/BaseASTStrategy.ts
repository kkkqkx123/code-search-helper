import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, ChunkingPreset } from '../../../types/splitting-types';
import { TreeSitterService } from '../../../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * 分割策略基类
 * 提供通用的功能和配置管理
 */
export abstract class BaseSplitStrategy implements ISplitStrategy {
  protected options: Required<ChunkingOptions>;
  protected logger?: LoggerService;
  protected treeSitterService?: TreeSitterService;

  constructor(options?: ChunkingOptions) {
    this.options = {
      preset: ChunkingPreset.BALANCED,
      basic: {
        maxChunkSize: options?.basic?.maxChunkSize ?? 1000,
        minChunkSize: options?.basic?.minChunkSize ?? 100,
        overlapSize: options?.basic?.overlapSize ?? 200,
        preserveFunctionBoundaries: options?.basic?.preserveFunctionBoundaries ?? true,
        preserveClassBoundaries: options?.basic?.preserveClassBoundaries ?? true,
        includeComments: options?.basic?.includeComments ?? false,
        extractSnippets: options?.basic?.extractSnippets ?? true,
        addOverlap: options?.basic?.addOverlap ?? false,
        optimizationLevel: options?.basic?.optimizationLevel ?? 'medium',
        maxLines: options?.basic?.maxLines ?? 10000
      },
      advanced: {
        adaptiveBoundaryThreshold: options?.advanced?.adaptiveBoundaryThreshold ?? false,
        contextAwareOverlap: options?.advanced?.contextAwareOverlap ?? false,
        semanticWeight: options?.advanced?.semanticWeight ?? 0.7,
        syntacticWeight: options?.advanced?.syntacticWeight ?? 0.3,
        enableASTBoundaryDetection: options?.advanced?.enableASTBoundaryDetection ?? false,
        astNodeTracking: options?.advanced?.astNodeTracking ?? false,
        enableChunkDeduplication: options?.advanced?.enableChunkDeduplication ?? false,
        maxOverlapRatio: options?.advanced?.maxOverlapRatio ?? 0.3,
        deduplicationThreshold: options?.advanced?.deduplicationThreshold ?? 0.8,
        chunkMergeStrategy: options?.advanced?.chunkMergeStrategy ?? 'conservative',
        minChunkSimilarity: options?.advanced?.minChunkSimilarity ?? 0.6,
        enableSmartDeduplication: options?.advanced?.enableSmartDeduplication ?? false,
        similarityThreshold: options?.advanced?.similarityThreshold ?? 0.8,
        overlapMergeStrategy: options?.advanced?.overlapMergeStrategy ?? 'conservative',
        maxOverlapLines: options?.advanced?.maxOverlapLines ?? 50,
        enableEnhancedBalancing: options?.advanced?.enableEnhancedBalancing ?? true,
        balancedChunkerThreshold: options?.advanced?.balancedChunkerThreshold ?? 100,
        enableIntelligentFiltering: options?.advanced?.enableIntelligentFiltering ?? true,
        minChunkSizeThreshold: options?.advanced?.minChunkSizeThreshold ?? 50,
        maxChunkSizeThreshold: options?.advanced?.maxChunkSizeThreshold ?? 2000,
        enableSmartRebalancing: options?.advanced?.enableSmartRebalancing ?? true,
        rebalancingStrategy: options?.advanced?.rebalancingStrategy ?? 'conservative',
        enableBoundaryOptimization: options?.advanced?.enableBoundaryOptimization ?? true,
        boundaryOptimizationThreshold: options?.advanced?.boundaryOptimizationThreshold ?? 0.7,
        enableAdvancedMerging: options?.advanced?.enableAdvancedMerging ?? true,
        mergeDecisionThreshold: options?.advanced?.mergeDecisionThreshold ?? 0.75
      },
      performance: {
        enablePerformanceOptimization: options?.performance?.enablePerformanceOptimization ?? false,
        enablePerformanceMonitoring: options?.performance?.enablePerformanceMonitoring ?? false,
        enableChunkingCoordination: options?.performance?.enableChunkingCoordination ?? false,
        strategyExecutionOrder: options?.performance?.strategyExecutionOrder ?? ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
        enableNodeTracking: options?.performance?.enableNodeTracking ?? false
      },
      quality: {
        boundaryScoring: options?.quality?.boundaryScoring ?? {
          enableSemanticScoring: true,
          minBoundaryScore: 0.5,
          maxSearchDistance: 10,
          languageSpecificWeights: true
        },
        overlapStrategy: options?.quality?.overlapStrategy ?? {
          preferredStrategy: 'semantic',
          enableContextOptimization: true,
          qualityThreshold: 0.7
        },
        functionSpecificOptions: options?.quality?.functionSpecificOptions ?? {
          preferWholeFunctions: true,
          minFunctionOverlap: 50,
          maxFunctionSize: 2000,
          maxFunctionLines: 30,
          minFunctionLines: 5,
          enableSubFunctionExtraction: true
        },
        classSpecificOptions: options?.quality?.classSpecificOptions ?? {
          keepMethodsTogether: true,
          classHeaderOverlap: 100,
          maxClassSize: 3000
        }
      },
      treeSitterService: options?.treeSitterService,
      universalTextStrategy: options?.universalTextStrategy
    };
  }

  /**
   * 设置TreeSitter服务
   */
  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
  }

  /**
   * 设置日志服务
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * 验证输入参数
   */
  protected validateInput(content: string, language: string): boolean {
    if (!content || content.trim() === '') {
      this.logger?.warn('Empty content provided to split strategy');
      return false;
    }

    if (!language || language.trim() === '') {
      this.logger?.warn('Empty language provided to split strategy');
      return false;
    }

    if (!this.supportsLanguage(language)) {
      this.logger?.debug(`Language ${language} not supported by ${this.getName()}`);
      return false;
    }

    return true;
  }

  /**
   * 创建代码块
   */
  protected createChunk(
    content: string,
    metadata: Partial<CodeChunk['metadata']>
  ): CodeChunk {
    return {
      content,
      metadata: {
        startLine: metadata.startLine || 1,
        endLine: metadata.endLine || 1,
        language: metadata.language || 'unknown',
        filePath: metadata.filePath,
        type: metadata.type || 'generic',
        functionName: metadata.functionName,
        className: metadata.className,
        complexity: metadata.complexity,
        nodeIds: metadata.nodeIds || []
      }
    };
  }

  /**
   * 检查代码块是否有效
   */
  protected isValidChunk(chunk: CodeChunk): boolean {
    if (!chunk.content || chunk.content.trim().length < (this.options.basic?.minChunkSize || 50)) {
      return false;
    }

    if (!chunk.metadata.startLine || !chunk.metadata.endLine) {
      return false;
    }

    if (chunk.metadata.endLine < chunk.metadata.startLine) {
      return false;
    }

    return true;
  }

  /**
   * 过滤无效的代码块
   */
  protected filterValidChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.filter(chunk => this.isValidChunk(chunk));
  }

  /**
   * 抽象方法：获取策略名称
   */
  abstract getName(): string;

  /**
   * 抽象方法：检查是否支持语言
   */
  abstract supportsLanguage(language: string): boolean;

  /**
   * 抽象方法：获取优先级
   */
  

  /**
   * 抽象方法：执行分割
   */
  abstract split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]>;
}