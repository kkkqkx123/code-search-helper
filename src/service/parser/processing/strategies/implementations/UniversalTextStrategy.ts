import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult, ChunkType } from '../../core/types/ResultTypes';
import { CodeChunk } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { LoggerService } from '../../../../../utils/LoggerService';
import { FileFeatureDetector } from '../../../detection/FileFeatureDetector';
import { ChunkFactory } from '../../../../../utils/parser/ChunkFactory';

/**
 * 通用文本分段策略配置
 */
export interface UniversalStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最小块大小 */
  minChunkSize?: number;
  /** 最大行数 */
  maxLinesPerChunk?: number;
  /** 最小行数 */
  minLinesPerChunk?: number;
  /** 重叠大小 */
  overlapSize?: number;
  /** 是否启用智能分块 */
  enableIntelligentChunking?: boolean;
  /** 内存限制（MB） */
  memoryLimitMB?: number;
  /** 错误阈值 */
  errorThreshold?: number;
}

/**
 * 通用文本分段策略
 * 重构后版本，继承 BaseStrategy 以保持架构一致性
 */
export class UniversalTextStrategy extends BaseStrategy {
  protected config: UniversalStrategyConfig;
  private logger: LoggerService;
  private fileFeatureDetector: FileFeatureDetector;

  constructor(config: UniversalStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'universal-text-segmentation',
      supportedLanguages: ['*'], // 支持所有语言
      enabled: true,
      description: 'Universal Text Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxLinesPerChunk: 100,
      minLinesPerChunk: 5,
      overlapSize: 100,
      enableIntelligentChunking: true,
      memoryLimitMB: 512,
      errorThreshold: 10,
      ...config
    };
    this.logger = new LoggerService();
    this.fileFeatureDetector = new FileFeatureDetector();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    // 通用策略可以处理任何内容，作为降级策略
    // 特别优化处理纯文本格式文件
    const textFormatLanguages = ['text', 'ini', 'csv', 'log', 'env', 'properties', 'dockerfile', 'gitignore', 'makefile', 'readme'];
    const language = context.language?.toLowerCase();

    // 对于纯文本格式文件，优先使用此策略
    if (language && textFormatLanguages.includes(language)) {
      return true;
    }

    // 对于未知语言或小文件，也使用此策略
    if (!language || context.features?.isSmallFile) {
      return true;
    }

    // 作为通用降级策略，总是返回 true
    return true;
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Using Universal Text segmentation strategy for ${context.filePath || 'unknown file'}`);

    try {
      // 验证上下文
      if (!this.validateContext(context)) {
        this.logger.warn('Context validation failed for universal text strategy, proceeding anyway');
      } else {
        this.logger.debug('Context validation passed for universal text strategy');
      }

      // 根据文件特征选择最佳分段方法
      const chunks = await this.selectOptimalSegmentationMethod(context);

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Universal Text segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Universal Text segmentation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['*']; // 支持所有语言
  }

  /**
   * 验证上下文是否适合通用文本分段
   */
  validateContext(context: IProcessingContext): boolean {
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 根据文件特征选择最佳分段方法
   */
  private async selectOptimalSegmentationMethod(context: IProcessingContext): Promise<CodeChunk[]> {
    const { content, language, features } = context;

    // 小文件处理
    if (features.isSmallFile || content.length < this.config.minChunkSize!) {
      return this.chunkSmallFile(context);
    }

    // 根据语言和特征选择分段策略
    if (this.shouldUseSemanticSegmentation(context)) {
      return this.chunkBySemanticBoundaries(context);
    } else if (this.shouldUseBracketSegmentation(context)) {
      return this.chunkByBracketsAndLines(context);
    } else {
      return this.chunkByLines(context);
    }
  }

  /**
   * 基于语义边界的分段
   */
  private async chunkBySemanticBoundaries(context: IProcessingContext): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = context.content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 检查是否应该在语义边界处分段
      if (this.shouldSplitAtSemanticBoundary(line, currentChunk, i, lines.length)) {
        const chunkContent = currentChunk.join('\n');
        chunks.push(ChunkFactory.createGenericChunk(
          chunkContent,
          currentLine,
          currentLine + currentChunk.length - 1,
          context.language || 'unknown',
          {
            filePath: context.filePath,
            complexity: this.calculateComplexity(chunkContent),
            segmentationMethod: 'semantic'
          }
        ));

        currentChunk = [];
        currentLine = i + 1;
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push(ChunkFactory.createGenericChunk(
        chunkContent,
        currentLine,
        currentLine + currentChunk.length - 1,
        context.language || 'unknown',
        {
          filePath: context.filePath,
          complexity: this.calculateComplexity(chunkContent),
          segmentationMethod: 'semantic'
        }
      ));
    }

    return chunks;
  }

  /**
   * 基于括号和行数的分段
   */
  private async chunkByBracketsAndLines(context: IProcessingContext): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = context.content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let bracketDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 更新括号深度
      bracketDepth += this.countOpeningBrackets(line);
      bracketDepth -= this.countClosingBrackets(line);

      // 检查是否应该分段
      if (this.shouldSplitAtBracketBoundary(bracketDepth, currentChunk, i, lines.length)) {
        const chunkContent = currentChunk.join('\n');
        chunks.push(ChunkFactory.createBlockChunk(
          chunkContent,
          currentLine,
          currentLine + currentChunk.length - 1,
          context.language || 'unknown',
          {
            filePath: context.filePath,
            complexity: this.calculateComplexity(chunkContent),
            segmentationMethod: 'bracket'
          }
        ));

        currentChunk = [];
        currentLine = i + 1;
        bracketDepth = 0;
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push(ChunkFactory.createBlockChunk(
        chunkContent,
        currentLine,
        currentLine + currentChunk.length - 1,
        context.language || 'unknown',
        {
          filePath: context.filePath,
          complexity: this.calculateComplexity(chunkContent),
          segmentationMethod: 'bracket'
        }
      ));
    }

    return chunks;
  }

  /**
   * 基于行数的分段
   */
  private async chunkByLines(context: IProcessingContext): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = context.content.split('\n');
    const maxLinesPerChunk = this.config.maxLinesPerChunk!;

    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, Math.min(i + maxLinesPerChunk, lines.length));
      const chunkContent = chunkLines.join('\n');

      chunks.push(ChunkFactory.createLineChunk(
        chunkContent,
        i + 1, // 转换为1基索引
        Math.min(i + maxLinesPerChunk, lines.length),
        context.language || 'unknown',
        {
          filePath: context.filePath,
          complexity: this.calculateComplexity(chunkContent),
          segmentationMethod: 'line'
        }
      ));
    }

    return chunks;
  }

  /**
   * 小文件处理
   */
  private chunkSmallFile(context: IProcessingContext): CodeChunk[] {
    const { content, filePath, language } = context;
    const lines = content.split('\n');

    return [ChunkFactory.createGenericChunk(
      content,
      1,
      lines.length,
      language || 'unknown',
      {
        filePath,
        complexity: this.calculateComplexity(content),
        segmentationMethod: 'small-file'
      }
    )];
  }

  /**
   * 判断是否应该使用语义分段
   */
  private shouldUseSemanticSegmentation(context: IProcessingContext): boolean {
    const { language, features } = context;

    // 支持语义分段的语言
    const semanticLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp'];

    return semanticLanguages.includes(language?.toLowerCase() || '') &&
      features.hasFunctions &&
      !features.isSmallFile;
  }

  /**
   * 判断是否应该使用括号分段
   */
  private shouldUseBracketSegmentation(context: IProcessingContext): boolean {
    const { language, content } = context;

    // 支持括号分段的语言
    const bracketLanguages = ['javascript', 'typescript', 'java', 'cpp', 'csharp', 'c', 'go'];

    return bracketLanguages.includes(language?.toLowerCase() || '') &&
      /[{}()\[\]]/.test(content);
  }

  /**
   * 判断是否应该在语义边界处分段
   */
  private shouldSplitAtSemanticBoundary(
    line: string,
    currentChunk: string[],
    currentIndex: number,
    totalLines: number
  ): boolean {
    // 检查函数/类定义边界
    if (this.isFunctionOrClassBoundary(line) && currentChunk.length > 0) {
      return true;
    }

    // 检查空行边界
    if (line.trim() === '' && currentChunk.length >= this.config.minLinesPerChunk!) {
      return true;
    }

    // 大小限制检查
    const chunkContent = currentChunk.join('\n');
    if (chunkContent.length >= this.config.maxChunkSize!) {
      return true;
    }

    // 行数限制
    if (currentChunk.length >= this.config.maxLinesPerChunk!) {
      return true;
    }

    // 到达文件末尾
    if (currentIndex === totalLines - 1) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否应该在括号边界处分段
   */
  private shouldSplitAtBracketBoundary(
    bracketDepth: number,
    currentChunk: string[],
    currentIndex: number,
    totalLines: number
  ): boolean {
    // 括号平衡且达到最小块大小
    const isBalanced = bracketDepth === 0;
    const hasMinSize = currentChunk.length >= this.config.minLinesPerChunk!;

    // 大小限制检查
    const chunkContent = currentChunk.join('\n');
    const exceedsMaxSize = chunkContent.length >= this.config.maxChunkSize! ||
      currentChunk.length >= this.config.maxLinesPerChunk!;

    // 到达文件末尾
    const isEndOfFile = currentIndex === totalLines - 1;

    return (isBalanced && hasMinSize) || exceedsMaxSize || isEndOfFile;
  }

  /**
   * 判断是否为函数或类边界
   */
  private isFunctionOrClassBoundary(line: string): boolean {
    const trimmed = line.trim();

    // 函数定义
    if (/^(function|def|class|interface|struct)\s/.test(trimmed)) {
      return true;
    }

    // 方法定义
    if (/^\s*(public|private|protected)?\s*(static)?\s*\w+\s*\([^)]*\)\s*[{:]?\s*$/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * 计算开括号数量
   */
  private countOpeningBrackets(line: string): number {
    return (line.match(/\(/g) || []).length +
      (line.match(/\{/g) || []).length +
      (line.match(/\[/g) || []).length;
  }

  /**
   * 计算闭括号数量
   */
  private countClosingBrackets(line: string): number {
    return (line.match(/\)/g) || []).length +
      (line.match(/\}/g) || []).length +
      (line.match(/\]/g) || []).length;
  }

  /**
   * 获取策略配置
   */
  getConfig(): UniversalStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<UniversalStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取分段统计信息
   */
  getSegmentationStats(): {
    totalSegmentations: number;
    averageChunkCount: number;
    strategyUsage: Record<string, number>;
    processorUsage: Record<string, number>;
  } {
    const stats = this.getPerformanceStats();
    return {
      totalSegmentations: stats.totalExecutions,
      averageChunkCount: stats.totalExecutions > 0 ?
        (stats as any).totalChunksProcessed / stats.totalExecutions : 0,
      strategyUsage: {
        'semantic': 0,
        'bracket': 0,
        'line': 0,
        'small-file': 0
      },
      processorUsage: {}
    };
  }

  /**
   * 获取标准化统计信息（与分段统计信息相同，保持兼容性）
   */
  getStandardizationStats(): {
    totalSegmentations: number;
    averageChunkCount: number;
    strategyUsage: Record<string, number>;
    processorUsage: Record<string, number>;
  } {
    return this.getSegmentationStats();
  }

  /**
   * 重置统计信息
   */
  resetSegmentationStats(): void {
    this.resetPerformanceStats();
  }

  /**
   * 重置标准化统计信息（与分段统计信息相同，保持兼容性）
   */
  resetStandardizationStats(): void {
    this.resetSegmentationStats();
  }

  /**
   * 验证配置
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.maxChunkSize || this.config.maxChunkSize <= 0) {
      errors.push('maxChunkSize must be greater than 0');
    }

    if (!this.config.minChunkSize || this.config.minChunkSize <= 0) {
      errors.push('minChunkSize must be greater than 0');
    }

    if (this.config.minChunkSize! >= this.config.maxChunkSize!) {
      errors.push('minChunkSize must be less than maxChunkSize');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguagesList(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'markdown', 'xml', 'html'];
  }

  /**
   * 获取可用的策略列表
   */
  getAvailableStrategies(): Array<{ name: string; priority: number; supportedLanguages?: string[] }> {
    return [
      { name: 'semantic', priority: 1, supportedLanguages: ['javascript', 'typescript', 'python'] },
      { name: 'bracket', priority: 2, supportedLanguages: ['javascript', 'typescript', 'java'] },
      { name: 'line', priority: 3, supportedLanguages: ['all'] }
    ];
  }

  /**
   * 性能测试
   */
  async performanceTest(
    content: string,
    filePath?: string,
    language?: string
  ): Promise<{
    strategy: string;
    duration: number;
    chunkCount: number;
    averageChunkSize: number;
  }[]> {
    const results = [];
    const strategies = ['semantic', 'bracket', 'line'];

    // 创建模拟上下文
    const mockContext: IProcessingContext = {
      content,
      language: language || 'unknown',
      filePath,
      config: {} as any,
      features: {
        size: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: content.length < 1000,
        isCodeFile: true,
        isStructuredFile: true,
        complexity: this.calculateComplexity(content),
        hasImports: /import|require/.test(content),
        hasExports: /export|module\.exports/.test(content),
        hasFunctions: /function|def|class/.test(content),
        hasClasses: /class|interface/.test(content)
      },
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        size: content.length,
        isSmallFile: content.length < 1000,
        isCodeFile: true,
        isStructuredFile: true,
        complexity: this.calculateComplexity(content),
        hasImports: /import|require/.test(content),
        hasExports: /export|module\.exports/.test(content),
        hasFunctions: /function|def|class/.test(content),
        hasClasses: /class|interface/.test(content),
        timestamp: Date.now()
      }
    };

    for (const strategyName of strategies) {
      const startTime = Date.now();
      try {
        let chunks: CodeChunk[] = [];

        if (strategyName === 'semantic') {
          chunks = await this.chunkBySemanticBoundaries(mockContext);
        } else if (strategyName === 'bracket') {
          chunks = await this.chunkByBracketsAndLines(mockContext);
        } else {
          chunks = await this.chunkByLines(mockContext);
        }

        const duration = Date.now() - startTime;
        const averageChunkSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length;

        results.push({
          strategy: strategyName,
          duration,
          chunkCount: chunks.length,
          averageChunkSize
        });
      } catch (error) {
        this.logger.error(`Performance test failed for strategy ${strategyName}:`, error);
      }
    }

    return results;
  }

  /**
   * 批量分段
   */
  async batchChunk(
    files: Array<{ content: string; filePath?: string; language?: string }>
  ): Promise<Array<{ chunks: CodeChunk[]; error?: Error }>> {
    const results = [];

    for (const file of files) {
      try {
        // 创建模拟上下文
        const mockContext: IProcessingContext = {
          content: file.content,
          language: file.language || 'unknown',
          filePath: file.filePath,
          config: {} as any,
          features: {
            size: file.content.length,
            lineCount: file.content.split('\n').length,
            isSmallFile: file.content.length < 1000,
            isCodeFile: true,
            isStructuredFile: true,
            complexity: this.calculateComplexity(file.content),
            hasImports: /import|require/.test(file.content),
            hasExports: /export|module\.exports/.test(file.content),
            hasFunctions: /function|def|class/.test(file.content),
            hasClasses: /class|interface/.test(file.content)
          },
          metadata: {
            contentLength: file.content.length,
            lineCount: file.content.split('\n').length,
            size: file.content.length,
            isSmallFile: file.content.length < 1000,
            isCodeFile: true,
            isStructuredFile: true,
            complexity: this.calculateComplexity(file.content),
            hasImports: /import|require/.test(file.content),
            hasExports: /export|module\.exports/.test(file.content),
            hasFunctions: /function|def|class/.test(file.content),
            hasClasses: /class|interface/.test(file.content),
            timestamp: Date.now()
          }
        };

        const chunks = await this.process(mockContext);
        results.push({ chunks });
      } catch (error) {
        results.push({
          chunks: [],
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    return results;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    components: Record<string, boolean>;
  }> {
    const issues: string[] = [];
    const components: Record<string, boolean> = {};

    // 检查配置
    try {
      const configValidation = this.validateConfiguration();
      components.config = configValidation.isValid;
      if (!configValidation.isValid) {
        issues.push(...configValidation.errors);
      }
    } catch (error) {
      components.config = false;
      issues.push(`Configuration error: ${error}`);
    }

    // 检查文件特征检测器
    try {
      components.fileFeatureDetector = !!this.fileFeatureDetector;
    } catch (error) {
      components.fileFeatureDetector = false;
      issues.push(`File feature detector error: ${error}`);
    }

    // 检查日志记录器
    try {
      components.logger = !!this.logger;
    } catch (error) {
      components.logger = false;
      issues.push(`Logger error: ${error}`);
    }

    const isHealthy = issues.length === 0 && Object.values(components).every(Boolean);

    return {
      isHealthy,
      issues,
      components
    };
  }
}