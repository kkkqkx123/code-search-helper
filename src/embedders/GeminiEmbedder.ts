import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';
import { TYPES } from '../types';

@injectable()
export class GeminiEmbedder extends BaseEmbedder implements Embedder {
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
    this.apiKey = config.gemini.apiKey;
    this.model = config.gemini.model || 'embedding-001';
    this.dimensions = config.gemini.dimensions || 768;
  }

  private getBaseUrl(): string {
    const config = this.configService.get('embedding');
    return config.gemini.baseUrl || 'https://generativelanguage.googleapis.com';
  }

  private async makeEmbeddingRequest(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    // Process each input separately as Gemini API expects single input
    const embeddings = [];
    for (const inp of inputs) {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: {
            parts: [
              {
                text: inp.text,
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Gemini API request failed with status ${response.status}: ${await response.text()}`
        );
      }

      const data = (await response.json()) as { embedding: { values: number[] } };
      embeddings.push({
        vector: data.embedding.values,
        dimensions: data.embedding.values.length,
        model: this.model,
        processingTime: 0, // Will be updated after timing
      });
    }

    return embeddings as EmbeddingResult[];
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
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      this.logger.warn('Gemini availability check failed', { error });
      return false;
    }
  }
}
