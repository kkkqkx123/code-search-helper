import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk } from './Splitter';
import { TYPES } from '../../../types';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { LoggerService } from '../../../utils/LoggerService';
import { BalancedChunker } from './BalancedChunker';
import { ChunkingConfigManager } from './config/ChunkingConfigManager';
import { SplitStrategyFactory } from './core/SplitStrategyFactory';
import { ChunkingCoordinator } from './utils/ChunkingCoordinator';
import { UnifiedOverlapCalculator } from './utils/overlap/UnifiedOverlapCalculator';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from './types';
import { PerformanceOptimizer } from './utils/performance/PerformanceOptimizer';
import { IPerformanceMonitoringSystem } from './utils/performance/IPerformanceMonitoringSystem';
import { UnifiedPerformanceMonitoringSystem } from './utils/performance/UnifiedPerformanceMonitoringSystem';

/**
 * 重构后的AST代码分割器（完全替换旧实现）
 * 采用新的架构设计，使用工厂模式、策略模式和装饰器模式
 */
@injectable()
export class ASTCodeSplitter implements Splitter {
  private treeSitterService: TreeSitterService;
  private logger?: LoggerService;
  private balancedChunker: BalancedChunker;
  private configManager: ChunkingConfigManager;
  private strategyFactory: SplitStrategyFactory;
  private coordinator?: ChunkingCoordinator;
  private overlapCalculator?: UnifiedOverlapCalculator;
  private performanceOptimizer?: PerformanceOptimizer;
  private performanceMonitoring?: IPerformanceMonitoringSystem;
  private options: Required<ChunkingOptions>;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.treeSitterService = treeSitterService;
    this.logger = logger;
    this.balancedChunker = new BalancedChunker(logger);
    this.configManager = new ChunkingConfigManager();
    this.strategyFactory = new SplitStrategyFactory();
    this.options = { ...DEFAULT_CHUNKING_OPTIONS };

    this.initializeComponents();
  }

  /**
   * 初始化组件
   */
  private initializeComponents(): void {
    // 初始化性能监控系统
    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitoring = new UnifiedPerformanceMonitoringSystem(this.logger, {
        maxProcessingTime: 10000, // 10秒
        maxMemoryUsage: 300 * 1024 * 1024, // 300MB
        minCacheHitRate: 0.5,
        maxErrorRate: 0.05,
        slowOperationThreshold: 2000 // 2秒
      });
    }

    // 初始化性能优化器
    if (this.options.enablePerformanceOptimization) {
      this.performanceOptimizer = new PerformanceOptimizer(1000); // 可配置缓存大小
    }

    // 初始化协调器
    if (this.options.enableChunkingCoordination) {
      this.coordinator = new ChunkingCoordinator(
        {} as any, // AST节点跟踪器需要在这里创建
        this.options,
        this.logger
      );
    }

    // 初始化重叠计算器
    if (this.options.addOverlap) {
      this.overlapCalculator = new UnifiedOverlapCalculator({
        maxSize: this.options.overlapSize,
        minLines: 1,
        maxOverlapRatio: this.options.maxOverlapRatio,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
        enableNodeAwareOverlap: this.options.astNodeTracking,
        logger: this.logger
      });
    }
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    const startTime = Date.now();

    // 记录性能指标
    if (this.performanceMonitoring) {
      this.performanceMonitoring.recordOperation('ast_code_splitting_start', {
        duration: 0,
        operation: 'ast_code_splitting',
        success: true,
        metadata: { language, filePath, codeLength: code.length }
      });
    }

    // 处理空代码
    if (!code || code.trim() === '') {
      return [];
    }

    try {
      // 获取配置
      const config = this.configManager.getMergedConfig(language);

      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success && parseResult.ast) {
        const chunks = await this.processWithAST(code, parseResult, language, filePath, config);

        // 记录成功完成的性能指标
        if (this.performanceMonitoring) {
          const duration = Date.now() - startTime;
          this.performanceMonitoring.recordOperation('ast_code_splitting_complete', {
            duration,
            operation: 'ast_code_splitting',
            success: true,
            metadata: { language, filePath, chunksGenerated: chunks.length }
          });
        }

        return chunks;
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, using fallback strategy`);
        const chunks = await this.processWithFallback(code, language, filePath, config);

        // 记录fallback的性能指标
        if (this.performanceMonitoring) {
          const duration = Date.now() - startTime;
          this.performanceMonitoring.recordOperation('ast_code_splitting_fallback', {
            duration,
            operation: 'ast_code_splitting_fallback',
            success: true,
            metadata: { language, filePath, chunksGenerated: chunks.length }
          });
        }

        return chunks;
      }
    } catch (error) {
      this.logger?.error(`Code splitting failed: ${error}`);

      // 记录错误性能指标
      if (this.performanceMonitoring) {
        const duration = Date.now() - startTime;
        this.performanceMonitoring.recordOperation('ast_code_splitting_error', {
          duration,
          operation: 'ast_code_splitting_error',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metadata: { language, filePath }
        });
      }

      // 最终fallback：简单的文本分割
      return this.simpleTextSplit(code, language, filePath);
    }
  }

  /**
   * 使用AST进行处理
   */
  private async processWithAST(
    code: string,
    parseResult: any,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    let chunks: CodeChunk[];

    if (this.options.enableChunkingCoordination && this.coordinator) {
      // 使用协调器进行处理
      chunks = await this.coordinator.coordinate(code, language, filePath, parseResult.ast);
    } else {
      // 使用策略工厂创建策略链
      chunks = await this.processWithStrategyChain(code, parseResult, language, filePath, config);
    }

    // 应用性能优化
    if (this.performanceOptimizer && this.options.enablePerformanceOptimization) {
      const optimizationResult = this.performanceOptimizer.optimizeChunks(
        chunks,
        this.options as any, // 类型转换以适配EnhancedChunkingOptions
        undefined // ASTNodeTracker暂时未实现
      );

      this.logger?.debug('Performance optimization applied', {
        optimizations: optimizationResult.optimizationsApplied,
        metrics: optimizationResult.metrics
      });

      chunks = optimizationResult.optimizedChunks;
    }

    // 应用重叠
    if (this.options.addOverlap && this.overlapCalculator) {
      chunks = this.overlapCalculator.addOverlap(chunks, code);
    }

    return chunks;
  }

  setChunkSize(chunkSize: number): void {
    this.options.maxChunkSize = chunkSize;
    this.configManager.updateGlobalConfig({ maxChunkSize: chunkSize });
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.options.overlapSize = chunkOverlap;
    this.configManager.updateGlobalConfig({ overlapSize: chunkOverlap });

    // 重新初始化重叠计算器
    if (this.overlapCalculator) {
      this.overlapCalculator = new UnifiedOverlapCalculator({
        maxSize: chunkOverlap,
        minLines: 1,
        maxOverlapRatio: this.options.maxOverlapRatio,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
        enableNodeAwareOverlap: this.options.astNodeTracking,
        logger: this.logger
      });
    }
  }

  // 其他方法将在后续步骤中实现
  /**
   * 使用策略链进行处理
   */
  private async processWithStrategyChain(
    code: string,
    parseResult: any,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    // 简化实现，将在后续步骤中完善
    return [];
  }

  private async processWithFallback(
    code: string,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    // 简化实现，将在后续步骤中完善
    return this.simpleTextSplit(code, language, filePath);
  }

  private simpleTextSplit(code: string, language: string, filePath?: string): CodeChunk[] {
    // 简化实现，将在后续步骤中完善
    return [];
  }
}