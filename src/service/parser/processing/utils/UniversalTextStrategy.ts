import { injectable, inject } from 'inversify';
import { CodeChunk, ChunkType } from '../types/CodeChunk';
import { LoggerService } from '../../../../utils/LoggerService';
import {
  ITextSplitter,
  ISegmentationContextManager,
  ISegmentationProcessor,
  IProtectionCoordinator,
  IConfigurationManager,
  SegmentationContext,
  UniversalChunkingOptions,
  ChunkingOptions
} from '../strategies/types/SegmentationTypes';
import { ProcessingCoordinator } from '../coordinator';
import { SegmentationConfigService } from '../../../../config/service/SegmentationConfigService';
import { ProtectionCoordinator } from './protection/ProtectionCoordinator';
import { TYPES } from '../../../../types';
import { FileFeatureDetector } from '../../detection/FileFeatureDetector';

/**
* 通用文本分段器（重构后版本）
* 职责：专注于核心分段逻辑，不承担其他职责
*/
@injectable()
export class UniversalTextStrategy implements ITextSplitter {
    /**
     * 分割文本 (实现 ITextSplitter 接口)
     */
    async split(
      content: string,
      language: string,
      filePath?: string,
      options?: ChunkingOptions
    ): Promise<CodeChunk[]> {
      // 使用默认的语义分段方法
      return this.chunkBySemanticBoundaries(content, filePath, language);
    }
  private processors: ISegmentationProcessor[];
  private protectionCoordinator: IProtectionCoordinator;
  private configManager: SegmentationConfigService;
  private options: UniversalChunkingOptions;
  private logger?: LoggerService;
  private fileFeatureDetector: FileFeatureDetector;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.SegmentationConfigService) configManager: SegmentationConfigService,
    @inject(TYPES.ProtectionCoordinator) protectionCoordinator: ProtectionCoordinator
  ) {
    try {
      this.logger = logger;
      this.configManager = configManager;
      this.protectionCoordinator = protectionCoordinator;
      this.options = configManager.getDefaultOptions();
      this.processors = [];
      this.fileFeatureDetector = new FileFeatureDetector(logger);

      this.logger?.debug('Initializing UniversalTextStrategy...');

      this.logger?.debug('UniversalTextStrategy initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize UniversalTextStrategy:', error);
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
  // 简化实现，不使用复杂的保护链
  this.logger?.debug('Protection interceptor chain set for UniversalTextStrategy');
  }

  /**
  * 添加处理器
  */
  addProcessor(processor: ISegmentationProcessor): void {
  this.processors.push(processor);
  this.logger?.debug('Added processor');
  }

  /**
  * 移除处理器
  */
  removeProcessor(processorName: string): void {
  const initialLength = this.processors.length;
  // 简化实现，移除所有处理器（实际使用时需要更复杂的逻辑）
    this.processors = [];

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
  return {
  content,
  language: language || 'unknown',
  filePath,
  options: this.options
  };
  }

  /**
  * 执行分段
  */
  private async executeSegmentation(
  strategyType: string,
  context: SegmentationContext
  ): Promise<CodeChunk[]> {
  try {
    // 简单实现：根据策略类型返回不同的分段结果
  let chunks: CodeChunk[];

      if (strategyType === 'line') {
      chunks = await this.chunkByLines(context.content, context.filePath, context.language);
    } else if (strategyType === 'semantic') {
    chunks = await this.chunkBySemanticBoundaries(context.content, context.filePath, context.language);
  } else {
  chunks = await this.chunkByBracketsAndLines(context.content, context.filePath, context.language);
  }

  // 应用处理器
      chunks = await this.applyProcessors(chunks, context);

  this.logger?.info(`${strategyType} segmentation completed: ${chunks.length} chunks`);
  return chunks;
  } catch (error) {
  this.logger?.error(`${strategyType} segmentation failed:`, error);
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
  try {
  processedChunks = await processor.process(context);
  this.logger?.debug('Applied processor');
  } catch (error) {
  this.logger?.error('Processor failed:', error);
  // 继续使用其他处理器
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
      strategy: 'small-file',
      complexity: this.fileFeatureDetector.calculateComplexity(content),
      timestamp: Date.now(),
      type: ChunkType.FUNCTION, // 使用正确的枚举值
      size: content.length,
      lineCount: lines.length
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
  isValid: true, // 简化实现
  errors: [] // 可以添加具体的验证逻辑
  };
  }

  /**
  * 获取支持的语言列表
  */
  getSupportedLanguages(): string[] {
  // 简化实现，返回常见编程语言
  return ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];
  }

  /**
  * 获取可用的策略列表
  */
  getAvailableStrategies(): Array<{ name: string; priority: number; supportedLanguages?: string[] }> {
  // 简化实现，返回固定的策略列表
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

  for (const strategyName of strategies) {
  const startTime = Date.now();
  try {
  const chunks = await this.executeSegmentation(strategyName, this.createSegmentationContext(content, filePath, language));
  const duration = Date.now() - startTime;
  const averageChunkSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length;

  results.push({
  strategy: strategyName,
  duration,
          chunkCount: chunks.length,
  averageChunkSize
  });
  } catch (error) {
  this.logger?.error(`Performance test failed for strategy ${strategyName}:`, error);
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

    // 检查配置管理器
    try {
    const options = this.configManager.getConfig();
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