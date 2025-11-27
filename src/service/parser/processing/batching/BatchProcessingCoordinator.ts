import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { BatchProcessingService } from '../../../../infrastructure/batching/BatchProcessingService';
import { ProcessingResult, ProcessingUtils } from '../types/Processing';
import { ProcessingContext, ContextBuilder } from '../types/Context';
import { FileFeatures } from '../core/interfaces/IProcessingContext';
import { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
import { IStrategyFactory } from '../core/interfaces/IStrategyFactory';
import { IConfigManager } from '../core/interfaces/IConfigManager';

/**
 * 批量处理文件接口
 */
export interface BatchProcessingFile {
  content: string;
  language: string;
  filePath?: string;
  features?: FileFeatures;
  ast?: any;
  nodeTracker?: any;
}

/**
 * 批量处理选项
 */
export interface BatchProcessingOptions {
  /** 批次大小 */
  batchSize?: number;
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 是否启用智能分组 */
  enableIntelligentGrouping?: boolean;
  /** 是否启用共享上下文 */
  enableSharedContext?: boolean;
  /** 是否启用缓存 */
  enableCaching?: boolean;
  /** 重试次数 */
  maxRetries?: number;
}

/**
 * 共享处理上下文
 */
export interface SharedProcessingContext {
  /** 基础配置 */
  baseConfig: any;
  /** 策略类型 */
  strategyType: string;
  /** 共享策略实例 */
  sharedStrategy: IProcessingStrategy;
  /** 共享配置 */
  sharedConfig: any;
  /** 文件特征统计 */
  featuresStats: {
    avgComplexity: number;
    avgSize: number;
    commonPatterns: string[];
  };
}

/**
 * 批量处理结果
 */
export interface BatchProcessingResult {
  /** 处理结果数组 */
  results: ProcessingResult[];
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
  /** 总耗时 */
  totalDuration: number;
  /** 批次统计 */
  batchStats: Array<{
    batchIndex: number;
    batchSize: number;
    duration: number;
    successCount: number;
    failureCount: number;
    strategyType: string;
  }>;
}

/**
 * 批量处理协调器
 * 负责协调多个文件的批量处理，优化性能和资源使用
 */
@injectable()
export class BatchProcessingCoordinator {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.StrategyFactory) private strategyFactory: IStrategyFactory,
    @inject(TYPES.ConfigurationManager) private configManager: IConfigManager
  ) { }

  /**
   * 批量处理多个文件
   */
  async processBatch(
    files: BatchProcessingFile[],
    options?: BatchProcessingOptions
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting batch processing for ${files.length} files`, {
        fileCount: files.length,
        options
      });

      // 1. 按语言和策略类型分组
      const fileGroups = this.groupFilesByProcessingStrategy(files);

      this.logger.info('Files grouped by processing strategy', {
        totalFiles: files.length,
        groupCount: fileGroups.size,
        groups: Array.from(fileGroups.entries()).map(([strategy, files]) => ({
          strategy,
          fileCount: files.length
        }))
      });

      // 2. 并行处理不同组
      const groupPromises = Array.from(fileGroups.entries()).map(async ([strategyType, groupFiles]) => {
        return this.processGroupWithStrategy(strategyType, groupFiles, options);
      });

      // 3. 等待所有组完成并聚合结果
      const groupResults = await Promise.allSettled(groupPromises);

      const result = this.aggregateBatchResults(groupResults, startTime);

      this.logger.info('Batch processing completed', {
        totalFiles: files.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalDuration: result.totalDuration,
        successRate: files.length > 0 ? (result.successCount / files.length * 100).toFixed(1) + '%' : '0%'
      });

      return result;
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        component: 'BatchProcessingCoordinator',
        operation: 'processBatch',
        fileCount: files.length,
        options
      });
      throw error;
    }
  }

  /**
   * 按处理策略对文件进行分组
   */
  private groupFilesByProcessingStrategy(
    files: BatchProcessingFile[]
  ): Map<string, BatchProcessingFile[]> {
    const groups = new Map<string, BatchProcessingFile[]>();

    for (const file of files) {
      // 预先确定策略类型，避免重复计算
      const strategyType = this.preselectStrategyType(file.language, file.filePath);

      if (!groups.has(strategyType)) {
        groups.set(strategyType, []);
      }
      groups.get(strategyType)!.push(file);
    }

    return groups;
  }

  /**
   * 预选择策略类型
   */
  private preselectStrategyType(language: string, filePath?: string): string {
    // 基于语言和文件路径的快速策略选择
    const languageStrategyMap: Record<string, string> = {
      'typescript': 'ast-based',
      'javascript': 'ast-based',
      'java': 'ast-based',
      'python': 'semantic',
      'cpp': 'bracket-based',
      'c': 'bracket-based',
      'csharp': 'bracket-based',
      'go': 'semantic',
      'rust': 'bracket-based',
      'html': 'html-layered',
      'css': 'style-based',
      'scss': 'style-based',
      'json': 'config-based',
      'yaml': 'config-based',
      'xml': 'xml-based',
      'markdown': 'markdown-based'
    };

    // 检查文件扩展名
    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext) {
        const extStrategyMap: Record<string, string> = {
          'ts': 'ast-based',
          'tsx': 'ast-based',
          'js': 'ast-based',
          'jsx': 'ast-based',
          'py': 'semantic',
          'java': 'ast-based',
          'cpp': 'bracket-based',
          'c': 'bracket-based',
          'cs': 'bracket-based',
          'go': 'semantic',
          'rs': 'bracket-based',
          'html': 'html-layered',
          'htm': 'html-layered',
          'css': 'style-based',
          'scss': 'style-based',
          'sass': 'style-based',
          'less': 'style-based',
          'json': 'config-based',
          'yaml': 'config-based',
          'yml': 'config-based',
          'xml': 'xml-based',
          'md': 'markdown-based'
        };

        if (extStrategyMap[ext]) {
          return extStrategyMap[ext];
        }
      }
    }

    return languageStrategyMap[language] || 'universal';
  }

  /**
   * 使用特定策略处理文件组
   */
  private async processGroupWithStrategy(
    strategyType: string,
    files: BatchProcessingFile[],
    options?: BatchProcessingOptions
  ): Promise<{
    results: ProcessingResult[];
    batchStats: Array<{
      batchIndex: number;
      batchSize: number;
      duration: number;
      successCount: number;
      failureCount: number;
      strategyType: string;
    }>;
  }> {
    this.logger.debug(`Processing group with strategy ${strategyType}`, {
      strategyType,
      fileCount: files.length
    });

    // 1. 创建共享的处理上下文
    const sharedContext = await this.createSharedContext(files[0], strategyType);

    // 2. 计算最优批次大小
    const batchSize = this.calculateOptimalBatchSize(files, strategyType, options);
    const maxConcurrency = options?.maxConcurrency || 3;

    this.logger.debug(`Batch processing configuration`, {
      strategyType,
      batchSize,
      maxConcurrency,
      totalBatches: Math.ceil(files.length / batchSize)
    });

    // 3. 批量处理文件
    const batchResults = await this.batchProcessor.executeBatch(
      files,
      async (batch: BatchProcessingFile[]) => {
        return this.processBatchWithSharedContext(batch, sharedContext, strategyType);
      },
      {
        batchSize,
        maxConcurrency,
        context: { domain: 'database', subType: strategyType }
      }
    );

    // 4. 生成批次统计
    // batchResults is ProcessingResult[] (flat array from executeBatchesConcurrently)
    // We need to convert it to ProcessingResult[][] for generateBatchStats
    const batchResultsArray = Array.isArray(batchResults) ? batchResults : [batchResults];
    const groupedResults: ProcessingResult[][] = [];
    for (let i = 0; i < batchResultsArray.length; i += batchSize) {
      groupedResults.push(batchResultsArray.slice(i, i + batchSize));
    }

    const batchStats = this.generateBatchStats(groupedResults, strategyType, batchSize);

    return {
      results: batchResultsArray,
      batchStats
    };
  }

  /**
   * 创建共享处理上下文
   */
  private async createSharedContext(
    sampleFile: BatchProcessingFile,
    strategyType: string
  ): Promise<SharedProcessingContext> {
    // 获取基础配置
    const baseConfig = await this.configManager.getConfig();

    // 创建可重用的上下文
    const baseContext = await new ContextBuilder(sampleFile.content)
      .setLanguage(sampleFile.language)
      .setFilePath(sampleFile.filePath)
      .setConfig(baseConfig)
      .setFeatures(sampleFile.features || this.createDefaultFileFeatures(sampleFile.content, sampleFile.filePath))
      .setAST(sampleFile.ast)
      .setNodeTracker(sampleFile.nodeTracker)
      .build();

    // 创建共享策略实例
    const sharedStrategy = this.strategyFactory.createStrategy(strategyType, baseContext.config);

    // 计算文件特征统计
    const featuresStats = this.calculateFeaturesStats([sampleFile]);

    return {
      baseConfig,
      strategyType,
      sharedStrategy,
      sharedConfig: baseContext.config,
      featuresStats
    };
  }

  /**
   * 使用共享上下文处理批次
   */
  private async processBatchWithSharedContext(
    batch: BatchProcessingFile[],
    sharedContext: SharedProcessingContext,
    strategyType: string
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const startTime = Date.now();

    try {
      for (const file of batch) {
        try {
          // 创建文件特定的上下文（轻量级）
          const fileContext = this.createFileContext(file, sharedContext);

          // 使用共享策略执行处理
          const result = await sharedContext.sharedStrategy.execute(fileContext);

          // 后处理
          const finalResult = await this.postProcess(result, fileContext);
          results.push(finalResult);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to process file ${file.filePath || 'unknown'}`, {
            filePath: file.filePath,
            language: file.language,
            strategyType,
            error: errorMessage
          });

          results.push({
            success: false,
            error: errorMessage,
            chunks: [],
            executionTime: Date.now() - startTime,
            strategy: strategyType,
            metadata: {
              filePath: file.filePath,
              language: file.language,
              chunkCount: 0,
              strategyType,
              processingTime: Date.now() - startTime
            }
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Batch processing failed for strategy ${strategyType}`, {
        strategyType,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error)
      });

      // 返回失败结果
      return batch.map(file => ({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        chunks: [],
        executionTime: Date.now() - startTime,
        strategy: strategyType,
        metadata: {
          filePath: file.filePath,
          language: file.language,
          chunkCount: 0,
          strategyType,
          processingTime: Date.now() - startTime
        }
      }));
    }
  }

  /**
   * 创建文件特定上下文
   */
  private createFileContext(
    file: BatchProcessingFile,
    sharedContext: SharedProcessingContext
  ): ProcessingContext {
    return new ContextBuilder(file.content)
      .setLanguage(file.language)
      .setFilePath(file.filePath)
      .setConfig(sharedContext.sharedConfig)
      .setFeatures(file.features || this.createDefaultFileFeatures(file.content, file.filePath))
      .setAST(file.ast)
      .setNodeTracker(file.nodeTracker)
      .build();
  }

  /**
   * 后处理
   */
  private async postProcess(
    result: ProcessingResult,
    context: ProcessingContext
  ): Promise<ProcessingResult> {
    // 这里可以添加通用的后处理逻辑
    // 例如：代码块过滤、合并、优化等

    return result;
  }

  /**
   * 计算最优批次大小
   */
  private calculateOptimalBatchSize(
    files: BatchProcessingFile[],
    strategyType: string,
    options?: BatchProcessingOptions
  ): number {
    if (options?.batchSize) {
      return options.batchSize;
    }

    // 基于策略类型和文件特征计算批次大小
    const avgFileSize = files.reduce((sum, file) => sum + file.content.length, 0) / files.length;
    const avgComplexity = this.calculateAverageComplexity(files);

    let batchSize: number;

    // 基于策略类型的基础批次大小
    const strategyBatchSizes: Record<string, number> = {
      'ast-based': 5,      // AST解析较重，使用小批次
      'semantic': 8,       // 语义分析中等
      'bracket-based': 10, // 括号分析较轻
      'html-layered': 15, // HTML处理较轻
      'style-based': 20,   // CSS处理很轻
      'config-based': 25,  // 配置文件处理很轻
      'universal': 12      // 通用策略中等
    };

    batchSize = strategyBatchSizes[strategyType] || 10;

    // 基于文件大小调整
    if (avgFileSize > 10000) { // > 10KB
      batchSize = Math.max(1, Math.floor(batchSize * 0.5));
    } else if (avgFileSize > 5000) { // > 5KB
      batchSize = Math.max(1, Math.floor(batchSize * 0.7));
    } else if (avgFileSize < 1000) { // < 1KB
      batchSize = Math.min(50, batchSize * 2);
    }

    // 基于复杂度调整
    if (avgComplexity > 0.8) {
      batchSize = Math.max(1, Math.floor(batchSize * 0.6));
    } else if (avgComplexity < 0.3) {
      batchSize = Math.min(50, batchSize * 1.5);
    }

    return Math.max(1, Math.min(50, batchSize));
  }

  /**
   * 计算平均复杂度
   */
  private calculateAverageComplexity(files: BatchProcessingFile[]): number {
    const totalComplexity = files.reduce((sum, file) => {
      return sum + this.calculateFileComplexity(file.content);
    }, 0);

    return files.length > 0 ? totalComplexity / files.length : 0;
  }

  /**
   * 计算文件复杂度
   */
  private calculateFileComplexity(content: string): number {
    let complexity = 0;

    complexity += (content.match(/if\s*\(/g) || []).length * 2;
    complexity += (content.match(/for\s*\(/g) || []).length * 3;
    complexity += (content.match(/while\s*\(/g) || []).length * 3;
    complexity += (content.match(/function\s+\w+/g) || []).length * 2;
    complexity += (content.match(/class\s+\w+/g) || []).length * 3;
    complexity += (content.match(/try\s*{/g) || []).length * 2;
    complexity += (content.match(/catch\s*\(/g) || []).length * 2;

    return Math.max(1, complexity);
  }

  /**
   * 创建默认文件特征
   */
  private createDefaultFileFeatures(content: string, filePath?: string): FileFeatures {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const size = new Blob([content]).size;

    return {
      size,
      lineCount,
      isSmallFile: size < 1024,
      isCodeFile: this.isCodeContent(content),
      isStructuredFile: this.hasStructuralElements(content),
      complexity: this.calculateFileComplexity(content),
      hasImports: /import\s+|require\s*\(/.test(content),
      hasExports: /export\s+|module\.exports/.test(content),
      hasFunctions: /function\s+\w+|=>\s*{|\w+\s*:\s*function/.test(content),
      hasClasses: /class\s+\w+/.test(content),
      languageFeatures: {
        characterCount: content.length,
        isBinary: this.isBinaryContent(content),
        isText: !this.isBinaryContent(content),
        extension: filePath ? filePath.split('.').pop()?.toLowerCase() || '' : '',
        hasNonASCII: /[^\x00-\x7F]/.test(content),
        hasBOM: content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE,
        lineEndingType: this.detectLineEndingType(content),
        indentType: this.detectIndentationType(content),
        averageIndentSize: this.calculateAverageIndentSize(content)
      }
    };
  }

  /**
   * 判断是否为代码内容
   */
  private isCodeContent(content: string): boolean {
    const codePatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /var\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /const\s+\w+\s*=/,
      /import\s+/,
      /export\s+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /def\s+\w+/,
      /public\s+class/,
      /private\s+\w+/,
      /public\s+\w+/
    ];

    return codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * 判断是否有结构化元素
   */
  private hasStructuralElements(content: string): boolean {
    return /function|class|interface|struct|enum|namespace|module/.test(content);
  }

  /**
   * 判断是否为二进制内容
   */
  private isBinaryContent(content: string): boolean {
    return /[\x00-\x08\x0E-\x1F\x7F]/.test(content);
  }

  /**
   * 检测换行符类型
   */
  private detectLineEndingType(content: string): 'CRLF' | 'LF' | 'CR' | 'MIXED' {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    const crCount = (content.match(/\r(?!\n)/g) || []).length;

    if (crlfCount > 0 && lfCount === 0 && crCount === 0) return 'CRLF';
    if (lfCount > 0 && crlfCount === 0 && crCount === 0) return 'LF';
    if (crCount > 0 && crlfCount === 0 && lfCount === 0) return 'CR';
    return 'MIXED';
  }

  /**
   * 检测缩进类型
   */
  private detectIndentationType(content: string): 'TABS' | 'SPACES' | 'MIXED' | 'NONE' {
    const lines = content.split('\n');
    const indentPatterns: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        indentPatterns.push(match[1]);
      }
    }

    if (indentPatterns.length === 0) return 'NONE';

    const tabCount = indentPatterns.filter(pattern => pattern.includes('\t')).length;
    const spaceCount = indentPatterns.filter(pattern => /^[ ]+$/.test(pattern)).length;

    if (tabCount > 0 && spaceCount === 0) return 'TABS';
    if (spaceCount > 0 && tabCount === 0) return 'SPACES';
    if (tabCount > 0 && spaceCount > 0) return 'MIXED';
    return 'NONE';
  }

  /**
   * 计算平均缩进大小
   */
  private calculateAverageIndentSize(content: string): number {
    const lines = content.split('\n');
    const indentSizes: number[] = [];

    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match && /^[ ]+$/.test(match[1])) {
        indentSizes.push(match[1].length);
      }
    }

    return indentSizes.length > 0
      ? indentSizes.reduce((sum, size) => sum + size, 0) / indentSizes.length
      : 0;
  }

  /**
   * 计算文件特征统计
   */
  private calculateFeaturesStats(files: BatchProcessingFile[]): SharedProcessingContext['featuresStats'] {
    const complexities = files.map(file => this.calculateFileComplexity(file.content));
    const sizes = files.map(file => file.content.length);

    return {
      avgComplexity: complexities.reduce((sum, c) => sum + c, 0) / complexities.length,
      avgSize: sizes.reduce((sum, s) => sum + s, 0) / sizes.length,
      commonPatterns: this.extractCommonPatterns(files)
    };
  }

  /**
   * 提取常见模式
   */
  private extractCommonPatterns(files: BatchProcessingFile[]): string[] {
    const patterns = new Set<string>();

    for (const file of files) {
      if (file.content.includes('import')) patterns.add('imports');
      if (file.content.includes('export')) patterns.add('exports');
      if (file.content.includes('class')) patterns.add('classes');
      if (file.content.includes('function')) patterns.add('functions');
      if (file.content.includes('async')) patterns.add('async');
      if (file.content.includes('await')) patterns.add('await');
    }

    return Array.from(patterns);
  }

  /**
   * 生成批次统计
   */
  private generateBatchStats(
    batchResults: ProcessingResult[][],
    strategyType: string,
    batchSize: number
  ): Array<{
    batchIndex: number;
    batchSize: number;
    duration: number;
    successCount: number;
    failureCount: number;
    strategyType: string;
  }> {
    return batchResults.map((batch, index) => {
      const successCount = batch.filter(result => result.success).length;
      const failureCount = batch.filter(result => !result.success).length;
      const avgDuration = batch.reduce((sum, result) => sum + result.executionTime, 0) / batch.length;

      return {
        batchIndex: index,
        batchSize: batch.length,
        duration: Math.round(avgDuration),
        successCount,
        failureCount,
        strategyType
      };
    });
  }

  /**
   * 聚合批处理结果
   */
  private aggregateBatchResults(
    groupResults: PromiseSettledResult<{
      results: ProcessingResult[];
      batchStats: Array<{
        batchIndex: number;
        batchSize: number;
        duration: number;
        successCount: number;
        failureCount: number;
        strategyType: string;
      }>;
    }>[],
    startTime: number
  ): BatchProcessingResult {
    const allResults: ProcessingResult[] = [];
    const allBatchStats: Array<{
      batchIndex: number;
      batchSize: number;
      duration: number;
      successCount: number;
      failureCount: number;
      strategyType: string;
    }> = [];

    for (const result of groupResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value.results);
        allBatchStats.push(...result.value.batchStats);
      } else {
        this.logger.error('Group processing failed', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    }

    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.filter(r => !r.success).length;

    return {
      results: allResults,
      successCount,
      failureCount,
      totalDuration: Date.now() - startTime,
      batchStats: allBatchStats
    };
  }
}