import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk, CodeChunkMetadata } from './Splitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TYPES } from '../../../types';
import { createHash } from 'crypto';
import { LoggerService } from '../../../utils/LoggerService';
import { BalancedChunker } from './BalancedChunker';

// 导入重构后的模块
import { SyntaxAwareSplitter } from './strategies/SyntaxAwareSplitter';
import { FunctionSplitter } from './strategies/FunctionSplitter';
import { EnhancedFunctionSplitter } from './strategies/EnhancedFunctionSplitter';
import { ClassSplitter } from './strategies/ClassSplitter';
import { ImportSplitter } from './strategies/ImportSplitter';
import { IntelligentSplitter } from './strategies/IntelligentSplitter';
import { SemanticSplitter } from './strategies/SemanticSplitter';
import { ChunkOptimizer } from './utils/ChunkOptimizer';
import { ComplexityCalculator } from './utils/ComplexityCalculator';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from './types';

// 导入新的优化组件
import { SemanticBoundaryAnalyzer } from './utils/SemanticBoundaryAnalyzer';
import { UnifiedOverlapCalculator } from './utils/UnifiedOverlapCalculator';
import { LanguageSpecificConfigManager } from './config/LanguageSpecificConfigManager';
import { ChunkingPerformanceOptimizer } from './utils/ChunkingPerformanceOptimizer';
// 导入新的重复问题解决方案组件
import { ASTNodeTracker } from './utils/ASTNodeTracker';
import { ChunkMerger } from './utils/ChunkMerger';
import { EnhancedOverlapCalculator } from './utils/EnhancedOverlapCalculator';
import { PerformanceOptimizer } from './utils/PerformanceOptimizer';
// 导入ChunkingCoordinator
import { ChunkingCoordinator } from './utils/ChunkingCoordinator';
// 导入NodeAwareOverlapCalculator
import { NodeAwareOverlapCalculator } from './utils/NodeAwareOverlapCalculator';

// Simple fallback implementation for unsupported languages
class SimpleCodeSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

 constructor(chunkSize: number = 2500, chunkOverlap: number = 300) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  split(code: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let position = 0;

    while (position < code.length) {
      const endPosition = Math.min(position + this.chunkSize, code.length);
      const chunkContent = code.substring(position, endPosition);

      // Calculate line numbers
      // When splitting a string by \n, we get an array with one more element than the number of \n characters
      // So if we have "line1\nline2\nline3", we get ["line1", "line2", "line3"] - 3 elements, meaning we're at line 3
      // If we have "line1\nline2" (no trailing newline), we get ["line1", "line2"] - 2 elements, meaning we're at line 2
      const linesBefore = position === 0 ? 0 : code.substring(0, position).split('\n').length - 1;
      const startLine = linesBefore + 1; // Convert to 1-based line numbers
      const chunkLines = chunkContent.split('\n').length;

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: startLine,
          endLine: startLine + chunkLines - 1,
          language: 'unknown'
        }
      });

      // Move position with overlap
      position = endPosition - this.chunkOverlap;
      if (position <= 0 || position >= code.length) break;
    }

    return chunks;
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
  }
}

@injectable()
export class ASTCodeSplitter implements Splitter {
  private chunkSize: number = 250;
  private chunkOverlap: number = 300;
  private treeSitterService: TreeSitterService;
  private simpleFallback: SimpleCodeSplitter;
  private options: Required<ChunkingOptions>;
  private logger?: LoggerService;
  private balancedChunker: BalancedChunker;

  // 重构后的模块实例
  private syntaxAwareSplitter: SyntaxAwareSplitter;
  private functionSplitter: FunctionSplitter;
  private enhancedFunctionSplitter: EnhancedFunctionSplitter;
  private classSplitter: ClassSplitter;
  private importSplitter: ImportSplitter;
  private intelligentSplitter: IntelligentSplitter;
  private semanticSplitter: SemanticSplitter;
  private chunkOptimizer: ChunkOptimizer;
  private complexityCalculator: ComplexityCalculator;
  private performanceMonitor: PerformanceMonitor;
  // 新增优化组件
  private semanticBoundaryAnalyzer: SemanticBoundaryAnalyzer;
   private unifiedOverlapCalculator: UnifiedOverlapCalculator;
   private languageConfigManager: LanguageSpecificConfigManager;
  private performanceOptimizer: ChunkingPerformanceOptimizer;
  // 新增重复问题解决方案组件
  private astNodeTracker: ASTNodeTracker;
  private chunkMerger: ChunkMerger;
  private enhancedOverlapCalculator: EnhancedOverlapCalculator;
 private duplicateResolutionPerformanceOptimizer: PerformanceOptimizer;
  // 新增协调机制组件
  private chunkingCoordinator: ChunkingCoordinator;
  private nodeAwareOverlapCalculator: NodeAwareOverlapCalculator;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.treeSitterService = treeSitterService;
    this.logger = logger;
    this.simpleFallback = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
    this.balancedChunker = new BalancedChunker(logger);
    this.options = { ...DEFAULT_CHUNKING_OPTIONS };

    // 初始化重构后的模块
    this.syntaxAwareSplitter = new SyntaxAwareSplitter(this.options);
    this.functionSplitter = new FunctionSplitter(this.options);
    this.enhancedFunctionSplitter = new EnhancedFunctionSplitter({
      ...this.options,
      functionSpecificOptions: {
        ...this.options.functionSpecificOptions,
        maxFunctionLines: 30,  // 最大函数行数阈值
        minFunctionLines: 5,   // 最小函数行数
        enableSubFunctionExtraction: true  // 启用子函数提取
      },
      enableChunkDeduplication: true
    });
    this.classSplitter = new ClassSplitter(this.options);
    this.importSplitter = new ImportSplitter(this.options);
    this.intelligentSplitter = new IntelligentSplitter(this.options);
    this.semanticSplitter = new SemanticSplitter(this.options);
    this.chunkOptimizer = new ChunkOptimizer(this.options);
    this.complexityCalculator = new ComplexityCalculator();
    this.performanceMonitor = new PerformanceMonitor(logger);
    // 初始化新的优化组件
    this.semanticBoundaryAnalyzer = new SemanticBoundaryAnalyzer();
    this.unifiedOverlapCalculator = new UnifiedOverlapCalculator({
      maxSize: this.options.overlapSize,
      minLines: 1
    });
    this.languageConfigManager = new LanguageSpecificConfigManager();
    this.performanceOptimizer = new ChunkingPerformanceOptimizer();
    
    // 初始化重复问题解决方案组件
    this.astNodeTracker = new ASTNodeTracker();
    this.chunkMerger = new ChunkMerger(this.options as any, this.astNodeTracker);
    this.enhancedOverlapCalculator = new EnhancedOverlapCalculator({
      maxSize: this.options.overlapSize,
      minLines: 1,
      maxOverlapRatio: 0.3,
      enableASTBoundaryDetection: true,
      nodeTracker: this.astNodeTracker
    });
    this.duplicateResolutionPerformanceOptimizer = new PerformanceOptimizer();
    
    // 初始化协调机制组件
    this.chunkingCoordinator = new ChunkingCoordinator(
      this.astNodeTracker,
      this.options,
      this.logger
    );
    this.nodeAwareOverlapCalculator = new NodeAwareOverlapCalculator(
      this.astNodeTracker,
      {
        maxOverlapRatio: this.options.maxOverlapRatio,
        maxOverlapLines: 50
      },
      this.logger
    );

    // 设置依赖关系
    this.syntaxAwareSplitter.setTreeSitterService(treeSitterService);
    this.functionSplitter.setTreeSitterService(treeSitterService);
    this.enhancedFunctionSplitter.setTreeSitterService(treeSitterService);
    this.classSplitter.setTreeSitterService(treeSitterService);
    this.importSplitter.setTreeSitterService(treeSitterService);
    this.intelligentSplitter.setBalancedChunker(this.balancedChunker);
    this.intelligentSplitter.setSemanticBoundaryAnalyzer(this.semanticBoundaryAnalyzer);
    this.intelligentSplitter.setUnifiedOverlapCalculator(this.unifiedOverlapCalculator);

    // 设置日志服务
    if (logger) {
      this.syntaxAwareSplitter.setLogger(logger);
      this.functionSplitter.setLogger(logger);
      this.enhancedFunctionSplitter.setLogger(logger);
      this.classSplitter.setLogger(logger);
      this.importSplitter.setLogger(logger);
      this.intelligentSplitter.setLogger(logger);
    }
    
    // 注册分段策略到协调器
    this.chunkingCoordinator.registerStrategy(this.importSplitter);
    this.chunkingCoordinator.registerStrategy(this.classSplitter);
    this.chunkingCoordinator.registerStrategy(this.enhancedFunctionSplitter);
    this.chunkingCoordinator.registerStrategy(this.syntaxAwareSplitter);
    this.chunkingCoordinator.registerStrategy(this.intelligentSplitter);
    this.chunkingCoordinator.registerStrategy(this.semanticSplitter);
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    // 处理空代码
    if (!code || code.trim() === '') {
      return [];
    }
    
    // 重置AST节点跟踪器
    this.astNodeTracker.clear();
    
    // 性能优化：预分析文件
    const preAnalysisResult = await this.performanceOptimizer.preAnalyzeFile(code, language);
    
    // 获取语言特定配置
    const languageConfig = this.languageConfigManager.getConfig(language);
    const adaptiveOptions = this.mergeAdaptiveOptions(this.options, languageConfig);

    try {
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success && parseResult.ast) {
        let chunks: CodeChunk[];
        
        // 根据配置选择使用协调机制还是原有逻辑
        if (this.options.enableChunkingCoordination) {
          // 使用ChunkingCoordinator进行协调分段
          chunks = await this.chunkingCoordinator.coordinate(
            code, 
            language, 
            filePath, 
            parseResult.ast
          );
        } else {
          // 使用原有的增强语法感知分段器
          chunks = await this.enhancedSyntaxAwareSplit(code, parseResult, language, filePath, adaptiveOptions);
        }
        
        // 应用智能块合并（如果启用）
        if (this.options.enableChunkDeduplication) {
          chunks = this.chunkMerger.mergeOverlappingChunks(chunks);
        }
        
        // 应用性能优化
        const optimizationResult = this.duplicateResolutionPerformanceOptimizer.optimizeChunks(
          chunks, 
          adaptiveOptions as any, 
          this.astNodeTracker
        );
        chunks = optimizationResult.optimizedChunks;
        
        // 应用重叠计算（根据配置选择计算器）
        if (this.options.addOverlap) {
          if (this.options.enableASTBoundaryDetection && parseResult.ast) {
            // 使用节点感知的重叠计算器
            this.nodeAwareOverlapCalculator = new NodeAwareOverlapCalculator(
              this.astNodeTracker,
              {
                maxOverlapRatio: this.options.maxOverlapRatio,
                maxOverlapLines: 50
              },
              this.logger
            );
            return this.nodeAwareOverlapCalculator.addOverlap(chunks, code);
          } else {
            // 使用原有的统一重叠计算器
            return this.unifiedOverlapCalculator.addOverlap(chunks, code);
          }
        }
        return chunks;
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, falling back to intelligent splitting`);
        let chunks = await this.intelligentSplitter.split(code, language, filePath, adaptiveOptions, this.astNodeTracker);
        
        // 应用智能块合并（如果启用）
        if (this.options.enableChunkDeduplication) {
          chunks = this.chunkMerger.mergeOverlappingChunks(chunks);
        }
        
        // 应用性能优化
        const optimizationResult = this.duplicateResolutionPerformanceOptimizer.optimizeChunks(
          chunks, 
          adaptiveOptions as any, 
          this.astNodeTracker
        );
        chunks = optimizationResult.optimizedChunks;
        
        // 应用统一重叠计算（如果启用）
        if (this.options.addOverlap) {
          return this.unifiedOverlapCalculator.addOverlap(chunks, code);
        }
        return chunks;
      }
    } catch (error) {
      this.logger?.warn(`TreeSitterService failed with error: ${error}, using intelligent fallback`);
      // 如果智能分段失败，使用语义分段作为后备
      try {
        let chunks = await this.intelligentSplitter.split(code, language, filePath, adaptiveOptions, this.astNodeTracker);
        
        // 应用智能块合并（如果启用）
        if (this.options.enableChunkDeduplication) {
          chunks = this.chunkMerger.mergeOverlappingChunks(chunks);
        }
        
        // 应用性能优化
        const optimizationResult = this.duplicateResolutionPerformanceOptimizer.optimizeChunks(
          chunks, 
          adaptiveOptions as any, 
          this.astNodeTracker
        );
        chunks = optimizationResult.optimizedChunks;
        
        // 应用统一重叠计算（如果启用）
        if (this.options.addOverlap) {
          return this.unifiedOverlapCalculator.addOverlap(chunks, code);
        }
        return chunks;
      } catch (intelligentError) {
        this.logger?.warn(`Intelligent splitter failed, using semantic fallback: ${intelligentError}`);
        let chunks = await this.semanticSplitter.split(code, language, filePath, adaptiveOptions);
        
        // 应用智能块合并（如果启用）
        if (this.options.enableChunkDeduplication) {
          chunks = this.chunkMerger.mergeOverlappingChunks(chunks);
        }
        
        // 应用性能优化
        const optimizationResult = this.duplicateResolutionPerformanceOptimizer.optimizeChunks(
          chunks, 
          adaptiveOptions as any, 
          this.astNodeTracker
        );
        chunks = optimizationResult.optimizedChunks;
        
        // 应用统一重叠计算（如果启用）
        if (this.options.addOverlap) {
          return this.unifiedOverlapCalculator.addOverlap(chunks, code);
        }
        return chunks;
      }
    }
  }

  private async enhancedSyntaxAwareSplit(
    code: string,
    parseResult: any,
    language: string,
    filePath: string | undefined,
    options: Required<ChunkingOptions>
  ): Promise<CodeChunk[]> {
    // 使用增强的语法感知分段逻辑
    return await this.syntaxAwareSplitter.split(code, language, filePath, options);
 }

  private mergeAdaptiveOptions(
    baseOptions: Required<ChunkingOptions>,
    languageConfig: any
  ): Required<ChunkingOptions> {
    // 合并基础选项和语言特定配置
    return {
      ...baseOptions,
      maxChunkSize: languageConfig.chunking.defaultMaxSize,
      overlapSize: languageConfig.chunking.defaultOverlap,
      // 添加自适应选项
      adaptiveBoundaryThreshold: true,
      contextAwareOverlap: true,
      semanticWeight: baseOptions.semanticWeight,
      syntacticWeight: baseOptions.syntacticWeight,
      boundaryScoring: baseOptions.boundaryScoring,
      overlapStrategy: baseOptions.overlapStrategy,
      functionSpecificOptions: baseOptions.functionSpecificOptions,
      classSpecificOptions: baseOptions.classSpecificOptions
    };
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
    this.simpleFallback.setChunkSize(chunkSize);
    this.options.maxChunkSize = chunkSize;
    // 更新相关模块的配置
    this.chunkOptimizer = new ChunkOptimizer(this.options);
    this.intelligentSplitter = new IntelligentSplitter(this.options);
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
    this.simpleFallback.setChunkOverlap(chunkOverlap);
    this.options.overlapSize = chunkOverlap;
  }
}