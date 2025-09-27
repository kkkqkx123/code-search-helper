import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { HttpEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './CustomEmbedder';
import { TYPES } from '../types';

@injectable()
export class MistralEmbedder extends HttpEmbedder implements Embedder {
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
    this.apiKey = config.mistral.apiKey;
    this.model = config.mistral.model || 'mistral-embed';
    this.dimensions = config.mistral.dimensions || 1024;
  }

  protected getBaseUrl(): string {
    const config = this.configService.get('embedding');
    return config.mistral.baseUrl || 'https://api.mistral.ai';
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
    return 'MistralEmbedder';
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
