import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

/**
 * 简化的嵌入器工厂
 * 不使用依赖注入，直接创建和管理嵌入器实例
 */
export class EmbedderFactory {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private cacheService: EmbeddingCacheService;
  private embedders: Map<string, Embedder> = new Map();
  private defaultProvider: string;

  constructor(
    logger: LoggerService,
    errorHandler: ErrorHandlerService,
    cacheService: EmbeddingCacheService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.cacheService = cacheService;

    // 从环境变量获取嵌入提供者配置
    const configProvider = process.env.EMBEDDING_PROVIDER || 'openai';
    this.defaultProvider = configProvider;

    // 初始化嵌入器
    this.initializeEmbedders();
  }

  /**
   * 初始化嵌入器
   */
  private initializeEmbedders(): void {
    try {
      // 动态导入嵌入器类，避免循环依赖
      const { OpenAIEmbedder } = require('./OpenAIEmbedder');
      const { OllamaEmbedder } = require('./OllamaEmbedder');
      const { SiliconFlowEmbedder } = require('./SiliconFlowEmbedder');
      const { CustomEmbedder } = require('./CustomEmbedder');
      const { GeminiEmbedder } = require('./GeminiEmbedder');
      const { MistralEmbedder } = require('./MistralEmbedder');

      // 创建嵌入器实例
      const openAIEmbedder = new OpenAIEmbedder(this.logger, this.errorHandler, this.cacheService);
      const ollamaEmbedder = new OllamaEmbedder(this.logger, this.errorHandler, this.cacheService);
      const siliconFlowEmbedder = new SiliconFlowEmbedder(this.logger, this.errorHandler, this.cacheService);
      const custom1Embedder = new CustomEmbedder(this.logger, this.errorHandler, this.cacheService, 'custom1');
      const custom2Embedder = new CustomEmbedder(this.logger, this.errorHandler, this.cacheService, 'custom2');
      const custom3Embedder = new CustomEmbedder(this.logger, this.errorHandler, this.cacheService, 'custom3');
      const geminiEmbedder = new GeminiEmbedder(this.logger, this.errorHandler, this.cacheService);
      const mistralEmbedder = new MistralEmbedder(this.logger, this.errorHandler, this.cacheService);

      // 注册嵌入器
      this.registerProvider('openai', openAIEmbedder);
      this.registerProvider('ollama', ollamaEmbedder);
      this.registerProvider('siliconflow', siliconFlowEmbedder);
      this.registerProvider('custom1', custom1Embedder);
      this.registerProvider('custom2', custom2Embedder);
      this.registerProvider('custom3', custom3Embedder);
      this.registerProvider('gemini', geminiEmbedder);
      this.registerProvider('mistral', mistralEmbedder);

      this.logger.info('Embedder factory initialized', {
        providers: Array.from(this.embedders.keys()),
        defaultProvider: this.defaultProvider
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize embedders: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbedderFactory', operation: 'initializeEmbedders' }
      );
    }
  }

  /**
   * 获取嵌入器实例
   */
  async getEmbedder(provider?: string): Promise<Embedder> {
    const selectedProvider = provider || this.defaultProvider;

    const embedder = this.embedders.get(selectedProvider);
    if (!embedder) {
      throw new Error(`Unsupported embedder provider: ${selectedProvider}`);
    }

    // 检查嵌入器是否可用
    const isAvailable = await embedder.isAvailable();
    if (!isAvailable) {
      throw new Error(`Embedder provider ${selectedProvider} is not available`);
    }

    return embedder;
  }

  /**
   * 生成嵌入
   */
  async embed(
    input: EmbeddingInput | EmbeddingInput[],
    provider?: string
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    try {
      const embedder = await this.getEmbedder(provider);
      return embedder.embed(input);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbedderFactory', operation: 'embed' }
      );
      throw error;
    }
  }
/**
 * 获取可用的嵌入器提供者列表
 * 现在只检查配置中指定的提供者
 */
async getAvailableProviders(): Promise<string[]> {
  const available: string[] = [];
  
  // 只检查配置中指定的提供者
  const configProvider = process.env.EMBEDDING_PROVIDER || 'openai';
  
  if (this.embedders.has(configProvider)) {
    try {
      const embedder = this.embedders.get(configProvider)!;
      const isAvailable = await embedder.isAvailable();
      if (isAvailable) {
        available.push(configProvider);
        this.logger.info(`Configured embedder provider is available: ${configProvider}`);
      } else {
        this.logger.warn(`Configured embedder provider is not available: ${configProvider}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to check availability for configured embedder ${configProvider}`, { error });
    }
  } else {
    this.logger.warn(`Configured embedder provider not found: ${configProvider}`);
  }

  return available;
}

  /**
   * 获取嵌入器信息
   */
  async getProviderInfo(provider?: string): Promise<{
    name: string;
    model: string;
    dimensions: number;
    available: boolean;
  }> {
    try {
      const selectedProvider = provider || this.defaultProvider;
      const embedder = await this.getEmbedder(selectedProvider);
      const available = await embedder.isAvailable();

      return {
        name: selectedProvider,
        model: embedder.getModelName(),
        dimensions: embedder.getDimensions(),
        available,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get provider info: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbedderFactory', operation: 'getProviderInfo' }
      );
      throw error;
    }
  }

  /**
   * 自动选择可用的嵌入器提供者
   */
  async autoSelectProvider(): Promise<string> {
    try {
      const available = await this.getAvailableProviders();

      if (available.length === 0) {
        throw new Error('No embedder providers available');
      }

      // 优先返回默认提供者（如果可用）
      if (available.includes(this.defaultProvider)) {
        return this.defaultProvider;
      }

      // 否则返回第一个可用的提供者
      return available[0];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to auto-select provider: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'EmbedderFactory', operation: 'autoSelectProvider' }
      );
      throw error;
    }
  }

  /**
   * 注册嵌入器提供者
   */
  registerProvider(name: string, embedder: Embedder): void {
    this.embedders.set(name, embedder);
    this.logger.info(`Registered embedder provider: ${name}`);
  }

  /**
   * 获取已注册的嵌入器提供者列表
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.embedders.keys());
  }

  /**
   * 检查提供者是否已注册
   */
  isProviderRegistered(name: string): boolean {
    return this.embedders.has(name);
  }

  /**
   * 移除嵌入器提供者
   */
  unregisterProvider(name: string): boolean {
    const removed = this.embedders.delete(name);
    if (removed) {
      this.logger.info(`Unregistered embedder provider: ${name}`);
    }
    return removed;
  }

  /**
   * 获取默认提供者
   */
  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  /**
   * 设置默认提供者
   */
  setDefaultProvider(provider: string): void {
    if (!this.embedders.has(provider)) {
      throw new Error(`Provider ${provider} is not registered`);
    }
    this.defaultProvider = provider;
    this.logger.info(`Default embedder provider set to: ${provider}`);
  }
}