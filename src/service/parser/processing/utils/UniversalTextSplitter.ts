import { injectable, inject } from 'inversify';
import { CodeChunk } from '../splitting';
import { LoggerService } from '../../../utils/LoggerService';
import {
  ITextSplitter,
  ISegmentationContextManager,
  ISegmentationProcessor,
  IProtectionCoordinator,
  IConfigurationManager,
  SegmentationContext,
  UniversalChunkingOptions
} from '../strategies/types/SegmentationTypes';
import { SegmentationContextManager } from '../utils/context/SegmentationContextManager';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../utils/protection/ProtectionCoordinator';
import { TYPES } from '../../../types';
import { FileFeatureDetector } from '../detection/FileFeatureDetector';

/**
 * 通用文本分段器（重构后版本）
 * 职责：专注于核心分段逻辑，不承担其他职责
 */
@injectable()
export class UniversalTextSplitter implements ITextSplitter {
  private contextManager: ISegmentationContextManager;
  private processors: ISegmentationProcessor[];
  private protectionCoordinator: IProtectionCoordinator;
  private configManager: IConfigurationManager;
  private options: UniversalChunkingOptions;
  private logger?: LoggerService;
  private fileFeatureDetector: FileFeatureDetector;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigurationManager) configManager: ConfigurationManager,
    @inject(TYPES.ProtectionCoordinator) protectionCoordinator: ProtectionCoordinator
  ) {
    try {
      this.logger = logger;
      this.configManager = configManager;
      this.protectionCoordinator = protectionCoordinator;
      this.options = configManager.getDefaultOptions();
      this.processors = [];
      this.fileFeatureDetector = new FileFeatureDetector(logger);

      this.logger?.debug('Initializing UniversalTextSplitter...');

      // 创建上下文管理器
      this.contextManager = new SegmentationContextManager(logger, configManager);

      this.logger?.debug('UniversalTextSplitter initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize UniversalTextSplitter:', error);
      throw error;
    }
  }

  /**
   * 基于语义边界的分段
   */
  async chunkBySemanticBoundaries(
    content: string,
    filePath?: string,
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('semantic', context);
  }

  /**
   * 基于括号和行数的分段
   */
  async chunkByBracketsAndLines(
    content: string,
    filePath?: string,
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('bracket', context);
  }

  /**
   * 基于行数的分段
   */
  async chunkByLines(
    content: string,
    filePath?: string,
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('line', context);
  }

  /**
   * 设置分段选项
   */
  setOptions(options: Partial<UniversalChunkingOptions>): void {
    this.options = this.configManager.mergeOptions(this.options, options);
    this.logger?.debug('Updated segmentation options', options);
  }

  /**
   * 获取当前分段选项
   */
  getOptions(): UniversalChunkingOptions {
    return { ...this.options };
  }

  /**
   * 设置保护拦截器链
   */
  setProtectionChain(chain: any): void {
    this.protectionCoordinator.setProtectionChain(chain);
    this.logger?.debug('Protection interceptor chain set for UniversalTextSplitter');
  }

  /**
   * 添加处理器
   */
  addProcessor(processor: ISegmentationProcessor): void {
    this.processors.push(processor);
    this.logger?.debug(`Added processor: ${processor.getName()}`);
  }

  /**
   * 移除处理器
   */
  removeProcessor(processorName: string): void {
    const initialLength = this.processors.length;
    this.processors = this.processors.filter(p => p.getName() !== processorName);

    if (this.processors.length < initialLength) {
      this.logger?.debug(`Removed processor: ${processorName}`);
    }
  }

  /**
   * 获取所有处理器
   */
  getProcessors(): ISegmentationProcessor[] {
    return [...this.processors];
  }

  /**
   * 创建分段上下文
   */
  private createSegmentationContext(
    content: string,
    filePath?: string,
    language?: string
  ): SegmentationContext {
    return this.contextManager.createSegmentationContext(
      content,
      filePath,
      language,
      this.options
    );
  }

  /**
   * 执行分段
   */
  private async executeSegmentation(
    strategyType: string,
    context: SegmentationContext
  ): Promise<CodeChunk[]> {
    // 对小文件直接作为一个块处理
    if (context.metadata.isSmallFile) {
      return this.chunkSmallFile(context);
    }

    // 执行保护检查
    if (context.options.protectionConfig.enableProtection) {
      const protectionContext = this.protectionCoordinator.createProtectionContext(
        strategyType + '_chunk',
        context
      );

      const isAllowed = await this.protectionCoordinator.checkProtection(protectionContext);

      if (!isAllowed) {
        this.logger?.warn(`${strategyType} segmentation blocked by protection mechanism`);
        // 降级到行数分段
        return this.executeSegmentation('line', context);
      }
    }

    try {
      // 选择并执行策略
      const strategy = this.contextManager.selectStrategy(context, strategyType);
      let chunks = await this.contextManager.executeStrategy(strategy, context);

      // 应用处理器
      chunks = await this.applyProcessors(chunks, context);

      this.logger?.info(`${strategyType} segmentation completed: ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger?.error(`${strategyType} segmentation failed:`, error);

      // 尝试降级到行数分段
      if (strategyType !== 'line') {
        this.logger?.warn('Falling back to line-based segmentation');
        return this.executeSegmentation('line', context);
      }

      throw error;
    }
  }

  /**
   * 应用处理器到分块结果
   */
  private async applyProcessors(
    chunks: CodeChunk[],
    context: SegmentationContext
  ): Promise<CodeChunk[]> {
    let processedChunks = [...chunks];

    for (const processor of this.processors) {
      if (processor.shouldApply(processedChunks, context)) {
        try {
          processedChunks = await processor.process(processedChunks, context);
          this.logger?.debug(`Applied processor: ${processor.getName()}`);
        } catch (error) {
          this.logger?.error(`Processor ${processor.getName()} failed:`, error);
          // 继续使用其他处理器
        }
      }
    }

    return processedChunks;
  }

  /**
   * 小文件处理
   */
  private chunkSmallFile(context: SegmentationContext): CodeChunk[] {
    const { content, filePath, language } = context;
    const lines = content.split('\n');

    const metadata = {
      startLine: 1,
      endLine: lines.length,
      language: language || 'unknown',
      filePath,
      type: 'semantic' as const,
      complexity: this.fileFeatureDetector.calculateComplexity(content)
    };

    this.logger?.info(`Small file detected (${content.length} chars, ${lines.length} lines), using single chunk`);

    return [{
      content: content,
      metadata
    }];
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
    // 这里可以添加统计逻辑
    return {
      totalSegmentations: 0,
      averageChunkCount: 0,
      strategyUsage: {},
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
    // 为了兼容性，返回分段统计信息
    return this.getSegmentationStats();
  }

  /**
   * 重置统计信息
   */
  resetSegmentationStats(): void {
    this.logger?.debug('Segmentation statistics reset');
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
    return {
      isValid: this.configManager.validateOptions(this.options),
      errors: [] // 可以添加具体的验证逻辑
    };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    const strategies = this.contextManager.getStrategies();
    const supportedLanguages = new Set<string>();

    for (const strategy of strategies) {
      if (strategy.getSupportedLanguages) {
        const languages = strategy.getSupportedLanguages();
        languages.forEach((lang: string) => supportedLanguages.add(lang));
      }
    }

    return Array.from(supportedLanguages);
  }

  /**
   * 获取可用的策略列表
   */
  getAvailableStrategies(): Array<{ name: string; priority: number; supportedLanguages?: string[] }> {
    const strategies = this.contextManager.getStrategies();

    return strategies.map((strategy: { getName: () => any; getPriority: () => any; getSupportedLanguages: () => any; }) => ({
      name: strategy.getName(),
      priority: strategy.getPriority(),
      supportedLanguages: strategy.getSupportedLanguages ? strategy.getSupportedLanguages() : undefined
    }));
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
    const strategies = this.contextManager.getStrategies();
    const results = [];

    for (const strategy of strategies) {
      if (strategy.canHandle(this.createSegmentationContext(content, filePath, language))) {
        const startTime = Date.now();
        try {
          const chunks = await this.contextManager.executeStrategy(
            strategy,
            this.createSegmentationContext(content, filePath, language)
          );
          const duration = Date.now() - startTime;
          const averageChunkSize = chunks.reduce((sum: any, chunk: { content: string | any[]; }) => sum + chunk.content.length, 0) / chunks.length;

          results.push({
            strategy: strategy.getName(),
            duration,
            chunkCount: chunks.length,
            averageChunkSize
          });
        } catch (error) {
          this.logger?.error(`Performance test failed for strategy ${strategy.getName()}:`, error);
        }
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
        const chunks = await this.chunkBySemanticBoundaries(
          file.content,
          file.filePath,
          file.language
        );
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

    // 检查上下文管理器
    try {
      const strategies = this.contextManager.getStrategies();
      components.contextManager = strategies.length > 0;
      if (strategies.length === 0) {
        issues.push('No segmentation strategies available');
      }
    } catch (error) {
      components.contextManager = false;
      issues.push(`Context manager error: ${error}`);
    }

    // 检查配置管理器
    try {
      const options = this.configManager.getDefaultOptions();
      components.configManager = !!options;
      if (!options) {
        issues.push('Configuration manager not available');
      }
    } catch (error) {
      components.configManager = false;
      issues.push(`Configuration manager error: ${error}`);
    }

    // 检查保护协调器
    try {
      components.protectionCoordinator = !!this.protectionCoordinator;
    } catch (error) {
      components.protectionCoordinator = false;
      issues.push(`Protection coordinator error: ${error}`);
    }

    // 检查处理器
    try {
      components.processors = Array.isArray(this.processors);
    } catch (error) {
      components.processors = false;
      issues.push(`Processors error: ${error}`);
    }

    const isHealthy = issues.length === 0 && Object.values(components).every(Boolean);

    return {
      isHealthy,
      issues,
      components
    };
  }
}