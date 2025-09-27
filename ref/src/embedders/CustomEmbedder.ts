import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';
import { TYPES } from '../types';

export { Embedder, EmbeddingInput, EmbeddingResult };

/**
 * Base class for HTTP-based embedders with common API patterns
 */
@injectable()
export abstract class HttpEmbedder extends BaseEmbedder implements Embedder {
  protected abstract getBaseUrl(): string;
  protected abstract getApiKey(): string;
  protected abstract getModel(): string;
  protected abstract getEmbeddingEndpoint(): string;
  protected abstract getAvailabilityEndpoint(): string;
  protected abstract getComponentName(): string;

  /**
   * Make HTTP request to embedding API
   */
  protected async makeEmbeddingRequest(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error(`${this.getComponentName()} base URL is not configured`);
    }

    const url = `${baseUrl}${this.getEmbeddingEndpoint()}`;
    const headers = this.getRequestHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.getRequestBody(inputs)),
    });

    if (!response.ok) {
      throw new Error(
        `${this.getComponentName()} API request failed with status ${response.status}: ${await response.text()}`
      );
    }

    return this.processResponse(await response.json());
  }

  /**
   * Check availability via HTTP endpoint
   */
  protected async checkAvailabilityViaHttp(): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        return false;
      }

      const url = `${baseUrl}${this.getAvailabilityEndpoint()}`;
      const headers = this.getRequestHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`${this.getComponentName()} availability check failed`, { error });
      return false;
    }
  }

  /**
   * Get request headers for API calls
   */
  protected getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = this.getApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * Get request body for embedding API
   */
  protected getRequestBody(inputs: EmbeddingInput[]): any {
    return {
      input: inputs.map(inp => inp.text),
      model: this.getModel(),
    };
  }

  /**
   * Process API response and convert to EmbeddingResult[]
   */
  protected processResponse(data: any): EmbeddingResult[] {
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid API response format');
    }

    return data.data.map((item: any, index: number) => ({
      vector: item.embedding,
      dimensions: item.embedding.length,
      model: this.getModel(),
      processingTime: 0, // Will be updated after timing
    }));
  }
}

/**
 * Custom embedder implementation
 */
@injectable()
export class CustomEmbedder extends HttpEmbedder implements Embedder {
  private name: string;
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.EmbeddingCacheService) cacheService: EmbeddingCacheService,
    name: string,
    defaultDimensions: number = 768
  ) {
    super(configService, logger, errorHandler, cacheService);

    this.name = name;

    const config = configService.get('embedding');
    const customConfig = (config.custom as Record<string, any>) || {};
    const providerConfig = customConfig[name] || {};

    this.apiKey = providerConfig.apiKey || '';
    this.model = providerConfig.model || 'default-model';
    this.dimensions = providerConfig.dimensions || defaultDimensions;
  }

  protected getBaseUrl(): string {
    const config = this.configService.get('embedding');
    const customConfig = (config.custom as Record<string, any>) || {};
    const providerConfig = customConfig[this.name] || {};

    // Custom embedders only read from .env, no default URL
    return providerConfig.baseUrl || '';
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
    return `CustomEmbedder-${this.name}`;
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
