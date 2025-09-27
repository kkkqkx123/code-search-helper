import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { HttpEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './CustomEmbedder';
import { TYPES } from '../types';

@injectable()
export class OpenAIEmbedder extends HttpEmbedder implements Embedder {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.EmbeddingCacheService) cacheService: EmbeddingCacheService
  ) {
    super(configService, logger, errorHandler, cacheService);

    const config = configService.get('embedding');
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model || 'text-embedding-ada-002';
    this.dimensions = config.openai.dimensions || 1536;
  }

  protected getBaseUrl(): string {
    const config = this.configService.get('embedding');
    return config.openai.baseUrl || 'https://api.openai.com';
  }

  protected getApiKey(): string {
    return this.apiKey;
  }

  protected getModel(): string {
    return this.model;
  }

  protected getEmbeddingEndpoint(): string {
    return '/v1/embeddings';
  }

  protected getAvailabilityEndpoint(): string {
    return '/v1/models';
  }

  protected getComponentName(): string {
    return 'OpenAIEmbedder';
  }

  async embed(
    input: EmbeddingInput | EmbeddingInput[]
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    return await this.embedWithCache(input, async inputs => {
      return await this.makeEmbeddingRequest(inputs);
    });
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    return await this.checkAvailabilityViaHttp();
  }
}
