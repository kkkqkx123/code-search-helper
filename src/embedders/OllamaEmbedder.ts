import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';
import { TYPES } from '../types';

@injectable()
export class OllamaEmbedder extends BaseEmbedder implements Embedder {
  private baseUrl: string;
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
    this.baseUrl = config.ollama.baseUrl || 'http://localhost:11434';
    this.model = config.ollama.model || 'nomic-embed-text';
    this.dimensions = config.ollama.dimensions || 768;
  }

  private async makeEmbeddingRequest(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    const url = `${this.baseUrl}/api/embeddings`;
    const headers = {
      'Content-Type': 'application/json',
    };

    // Process each input separately as Ollama API expects single input
    const embeddings = [];
    for (const inp of inputs) {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: inp.text,
          model: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API request failed with status ${response.status}: ${await response.text()}`
        );
      }

      const data = (await response.json()) as { embedding: number[] };
      embeddings.push({
        vector: data.embedding,
        dimensions: data.embedding.length,
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
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama availability check failed', { error });
      return false;
    }
  }
}
