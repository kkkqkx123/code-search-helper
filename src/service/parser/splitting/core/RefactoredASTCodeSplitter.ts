import { injectable, inject } from 'inversify';
import { ISplitter } from '../interfaces/ISplitter';
import { CodeChunk } from '../types';
import { TYPES } from '../../../../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { BalancedChunker } from '../BalancedChunker';
import { ChunkingConfigManager } from '../config/ChunkingConfigManager';
import { SplitStrategyFactory } from './SplitStrategyFactory';
import { SplitStrategyDecoratorBuilder } from './OverlapDecorator';
import { ChunkingCoordinator } from '../utils/ChunkingCoordinator';
import { UnifiedOverlapCalculator } from '../utils/UnifiedOverlapCalculator';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';

/**
 * 重构后的AST代码分割器
 * 使用新的架构和模式
 */
@injectable()
export class RefactoredASTCodeSplitter implements ISplitter {
  private treeSitterService: TreeSitterService;
  private logger?: LoggerService;
  private balancedChunker: BalancedChunker;
  private configManager: ChunkingConfigManager;
  private strategyFactory: SplitStrategyFactory;
  private coordinator?: ChunkingCoordinator;
  private overlapCalculator?: UnifiedOverlapCalculator;
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
    // 初始化协调器
    if (this.options.enableChunkingCoordination) {
      this.coordinator = new ChunkingCoordinator(
        // AST节点跟踪器需要在这里创建
        // 这里简化处理，实际需要创建ASTNodeTracker实例
        {} as any,
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
        return await this.processWithAST(code, parseResult, language, filePath, config);
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, using fallback strategy`);
        return await this.processWithFallback(code, language, filePath, config);
      }
    } catch (error) {
      this.logger?.error(`Code splitting failed: ${error}`);
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

    // 应用重叠
    if (this.options.addOverlap && this.overlapCalculator) {
      chunks = this.overlapCalculator.addOverlap(chunks, code);
    }

    return chunks;
  }

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
    const allChunks: CodeChunk[] = [];
    const processedRanges: Array<{startLine: number, endLine: number}> = [];

    // 按优先级顺序执行策略
    const strategyTypes = this.options.strategyExecutionOrder || [
      'ImportSplitter',
      'ClassSplitter', 
      'FunctionSplitter',
      'SyntaxAwareSplitter',
      'IntelligentSplitter'
    ];

    for (const strategyType of strategyTypes) {
      try {
        if (!this.strategyFactory.supportsStrategy(strategyType)) {
          this.logger?.debug(`Strategy ${strategyType} not registered, skipping`);
          continue;
        }

        // 创建策略实例
        const strategy = this.strategyFactory.create(strategyType, config);
        
        // 设置依赖服务
        this.configureStrategy(strategy);

        // 执行策略
        const strategyChunks = await strategy.split(code, language, filePath, config, null, parseResult.ast);
        
        // 过滤掉已处理的区域
        const newChunks = this.filterUnprocessedChunks(strategyChunks, processedRanges);
        
        allChunks.push(...newChunks);
        this.updateProcessedRanges(newChunks, processedRanges);

        this.logger?.debug(`Strategy ${strategyType} generated ${newChunks.length} new chunks`);

      } catch (error) {
        this.logger?.warn(`Strategy ${strategyType} failed: ${error}`);
      }
    }

    // 处理剩余未分割的代码
    const remainingChunks = await this.processRemainingCode(code, language, filePath, processedRanges);
    allChunks.push(...remainingChunks);

    return allChunks;
  }

  /**
   * 配置策略依赖
   */
  private configureStrategy(strategy: any): void {
    if (typeof strategy.setTreeSitterService === 'function') {
      strategy.setTreeSitterService(this.treeSitterService);
    }
    
    if (typeof strategy.setLogger === 'function' && this.logger) {
      strategy.setLogger(this.logger);
    }
    
    if (typeof strategy.setBalancedChunker === 'function') {
      strategy.setBalancedChunker(this.balancedChunker);
    }
  }

  /**
   * 过滤未处理的代码块
   */
  private filterUnprocessedChunks(
    chunks: CodeChunk[], 
    processedRanges: Array<{startLine: number, endLine: number}>
  ): CodeChunk[] {
    return chunks.filter(chunk => {
      const chunkRange = {
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine
      };
      
      return !this.isRangeProcessed(chunkRange, processedRanges);
    });
  }

  /**
   * 检查范围是否已处理
   */
  private isRangeProcessed(
    range: {startLine: number, endLine: number}, 
    processedRanges: Array<{startLine: number, endLine: number}>
  ): boolean {
    return processedRanges.some(processed => 
      (range.startLine >= processed.startLine && range.startLine <= processed.endLine) ||
      (range.endLine >= processed.startLine && range.endLine <= processed.endLine) ||
      (range.startLine <= processed.startLine && range.endLine >= processed.endLine)
    );
  }

  /**
   * 更新已处理范围
   */
  private updateProcessedRanges(
    chunks: CodeChunk[], 
    processedRanges: Array<{startLine: number, endLine: number}>
  ): void {
    for (const chunk of chunks) {
      processedRanges.push({
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine
      });
    }
  }

  /**
   * 处理剩余未分割的代码
   */
  private async processRemainingCode(
    code: string,
    language: string,
    filePath?: string,
    processedRanges?: Array<{startLine: number, endLine: number}>
  ): Promise<CodeChunk[]> {
    if (!processedRanges || processedRanges.length === 0) {
      // 如果没有已处理的区域，使用智能分割
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', this.options);
      this.configureStrategy(intelligentStrategy);
      return await intelligentStrategy.split(code, language, filePath, this.options);
    }

    // 识别未处理的代码区域
    const lines = code.split('\n');
    const unprocessedRanges = this.calculateUnprocessedRanges(lines.length, processedRanges);
    
    const remainingChunks: CodeChunk[] = [];

    for (const range of unprocessedRanges) {
      if (range.endLine < range.startLine) continue;
      
      const remainingContent = lines.slice(range.startLine - 1, range.endLine).join('\n');
      if (remainingContent.trim().length === 0) continue;

      // 对每个未处理区域使用智能分割
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', this.options);
      this.configureStrategy(intelligentStrategy);
      
      const chunks = await intelligentStrategy.split(remainingContent, language, filePath, this.options);
      
      // 调整行号
      const adjustedChunks = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          startLine: chunk.metadata.startLine + range.startLine - 1,
          endLine: chunk.metadata.endLine + range.startLine - 1
        }
      }));

      remainingChunks.push(...adjustedChunks);
    }

    return remainingChunks;
  }

  /**
   * 计算未处理的范围
   */
  private calculateUnprocessedRanges(
    totalLines: number,
    processedRanges: Array<{startLine: number, endLine: number}>
  ): Array<{startLine: number, endLine: number}> {
    if (processedRanges.length === 0) {
      return [{ startLine: 1, endLine: totalLines }];
    }

    // 排序处理范围
    const sortedRanges = [...processedRanges].sort((a, b) => a.startLine - b.startLine);
    
    const unprocessedRanges: Array<{startLine: number, endLine: number}> = [];
    let currentLine = 1;

    for (const range of sortedRanges) {
      if (currentLine < range.startLine) {
        unprocessedRanges.push({
          startLine: currentLine,
          endLine: range.startLine - 1
        });
      }
      currentLine = Math.max(currentLine, range.endLine + 1);
    }

    // 添加最后一个未处理范围
    if (currentLine <= totalLines) {
      unprocessedRanges.push({
        startLine: currentLine,
        endLine: totalLines
      });
    }

    return unprocessedRanges;
  }

  /**
   * 使用fallback策略进行处理
   */
  private async processWithFallback(
    code: string,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    try {
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', config);
      this.configureStrategy(intelligentStrategy);
      
      let chunks = await intelligentStrategy.split(code, language, filePath, config);
      
      // 应用重叠
      if (this.options.addOverlap && this.overlapCalculator) {
        chunks = this.overlapCalculator.addOverlap(chunks, code);
      }
      
      return chunks;
    } catch (error) {
      this.logger?.warn(`Intelligent splitter failed: ${error}`);
      return this.simpleTextSplit(code, language, filePath);
    }
  }

  /**
   * 简单的文本分割（最终fallback）
   */
  private simpleTextSplit(code: string, language: string, filePath?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = code.split('\n');
    const chunkSize = Math.max(10, Math.floor(lines.length / 5)); // 至少分成5块
    
    let position = 0;
    let chunkIndex = 0;

    while (position < lines.length) {
      const endPosition = Math.min(position + chunkSize, lines.length);
      const chunkLines = lines.slice(position, endPosition);
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: position + 1,
            endLine: endPosition,
            language,
            filePath,
            type: 'generic',
            chunkIndex: chunkIndex++
          }
        });
      }

      position = endPosition;
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

  /**
   * 获取配置管理器
   */
  getConfigManager(): ChunkingConfigManager {
    return this.configManager;
  }

  /**
   * 获取策略工厂
   */
  getStrategyFactory(): SplitStrategyFactory {
    return this.strategyFactory;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    configManager: any;
    strategyFactory: any;
    coordinator?: any;
    overlapCalculator?: any;
  } {
    return {
      configManager: this.configManager.getConfigStats(),
      strategyFactory: this.strategyFactory.getFactoryStats(),
      coordinator: this.coordinator?.getCoordinatorStats(),
      overlapCalculator: this.overlapCalculator?.getStats()
    };
  }
}