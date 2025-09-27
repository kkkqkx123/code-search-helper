import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { HttpEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './CustomEmbedder';
import { TYPES } from '../types';

@injectable()
export class SiliconFlowEmbedder extends HttpEmbedder implements Embedder {
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
    this.apiKey = config.siliconflow.apiKey;
    this.model = config.siliconflow.model || 'BAAI/bge-large-en-v1.5';
    this.dimensions = config.siliconflow.dimensions || 1024;
  }

  protected getBaseUrl(): string {
    const config = this.configService.get('embedding');
    // SiliconFlow URL will be set in .env file by the user
    return config.siliconflow.baseUrl || '';
  }

  protected getApiKey(): string {
    return this.apiKey;
  }

  protected getModel(): string {
    return this.model;
  }

  protected getEmbeddingEndpoint(): string {
    return '/embeddings';
  }

  protected getAvailabilityEndpoint(): string {
    return '/models';
  }

  protected getComponentName(): string {
    return 'SiliconFlowEmbedder';
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
