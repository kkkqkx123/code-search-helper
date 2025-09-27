import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { OpenAIEmbedder } from './OpenAIEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';
import { GeminiEmbedder } from './GeminiEmbedder';
import { MistralEmbedder } from './MistralEmbedder';
import { SiliconFlowEmbedder } from './SiliconFlowEmbedder';
import { Custom1Embedder } from './Custom1Embedder';
import { Custom2Embedder } from './Custom2Embedder';
import { Custom3Embedder } from './Custom3Embedder';
import { Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class EmbedderFactory {
  private configService: ConfigService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private embedders: Map<string, Embedder> = new Map();

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.OpenAIEmbedder) openAIEmbedder: OpenAIEmbedder,
    @inject(TYPES.OllamaEmbedder) ollamaEmbedder: OllamaEmbedder,
    @inject(TYPES.GeminiEmbedder) geminiEmbedder: GeminiEmbedder,
    @inject(TYPES.MistralEmbedder) mistralEmbedder: MistralEmbedder,
    @inject(TYPES.SiliconFlowEmbedder) siliconFlowEmbedder: SiliconFlowEmbedder,
    @inject(TYPES.Custom1Embedder) custom1Embedder: Custom1Embedder,
    @inject(TYPES.Custom2Embedder) custom2Embedder: Custom2Embedder,
    @inject(TYPES.Custom3Embedder) custom3Embedder: Custom3Embedder
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;

    // Register embedders
    this.embedders.set('openai', openAIEmbedder);
    this.embedders.set('ollama', ollamaEmbedder);
    this.embedders.set('gemini', geminiEmbedder);
    this.embedders.set('mistral', mistralEmbedder);
    this.embedders.set('siliconflow', siliconFlowEmbedder);
    this.embedders.set('custom1', custom1Embedder);
    this.embedders.set('custom2', custom2Embedder);
    this.embedders.set('custom3', custom3Embedder);
  }

  async getEmbedder(provider?: string): Promise<Embedder> {
    const config = this.configService.get('embedding');
    const selectedProvider = provider || config.provider;

    const embedder = this.embedders.get(selectedProvider);
    if (!embedder) {
      throw new Error(`Unsupported embedder provider: ${selectedProvider}`);
    }

    // Check if the embedder is available
    const isAvailable = await embedder.isAvailable();
    if (!isAvailable) {
      throw new Error(`Embedder provider ${selectedProvider} is not available`);
    }

    return embedder;
  }

  async embed(
    input: EmbeddingInput | EmbeddingInput[],
    provider?: string
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    const embedder = await this.getEmbedder(provider);
    return embedder.embed(input);
  }

  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, embedder] of this.embedders.entries()) {
      try {
        const isAvailable = await embedder.isAvailable();
        if (isAvailable) {
          available.push(name);
        }
      } catch (error) {
        this.logger.warn(`Failed to check availability for embedder ${name}`, { error });
      }
    }

    return available;
  }

  async getProviderInfo(provider?: string): Promise<{
    name: string;
    model: string;
    dimensions: number;
    available: boolean;
  }> {
    const embedder = await this.getEmbedder(provider);
    const available = await embedder.isAvailable();

    return {
      name: provider || this.configService.get('embedding').provider,
      model: embedder.getModelName(),
      dimensions: embedder.getDimensions(),
      available,
    };
  }

  async autoSelectProvider(): Promise<string> {
    const available = await this.getAvailableProviders();

    if (available.length === 0) {
      throw new Error('No embedder providers available');
    }

    const config = this.configService.get('embedding');
    const preferredProvider = config.provider;

    // Return preferred provider if available
    if (available.includes(preferredProvider)) {
      return preferredProvider;
    }

    // Otherwise return first available provider
    return available[0];
  }

  registerProvider(name: string, embedder: Embedder): void {
    this.embedders.set(name, embedder);
    this.logger.info(`Registered embedder provider: ${name}`);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.embedders.keys());
  }
}
