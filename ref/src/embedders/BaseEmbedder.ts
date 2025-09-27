import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { TYPES } from '../types';

export interface EmbeddingInput {
  text: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  processingTime: number;
}

export interface Embedder {
  embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]>;
  getDimensions(): number;
  getModelName(): string;
  isAvailable(): Promise<boolean>;
}

@injectable()
export abstract class BaseEmbedder implements Embedder {
  protected logger: LoggerService;
  protected errorHandler: ErrorHandlerService;
  protected configService: ConfigService;
  protected cacheService: EmbeddingCacheService;
  protected timeout: number;
  protected maxConcurrent: number;
  private activeRequests: number = 0;
  private requestQueue: Array<() => void> = [];

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.EmbeddingCacheService) cacheService: EmbeddingCacheService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.cacheService = cacheService;

    // Get timeout and concurrency settings from config
    const batchConfig = configService.get('batchProcessing');
    this.timeout = batchConfig?.processingTimeout || 300000; // Default to 5 minutes
    this.maxConcurrent = batchConfig?.maxConcurrentOperations || 5;
  }

  abstract embed(
    input: EmbeddingInput | EmbeddingInput[]
  ): Promise<EmbeddingResult | EmbeddingResult[]>;
  abstract getDimensions(): number;
  abstract getModelName(): string;
  abstract isAvailable(): Promise<boolean>;

  /**
   * Common embedding logic with cache checking and result combination
   */
  protected async embedWithCache(
    input: EmbeddingInput | EmbeddingInput[],
    processEmbeddings: (inputs: EmbeddingInput[]) => Promise<EmbeddingResult[]>
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];

    // Check cache for existing embeddings
    const cachedResults: EmbeddingResult[] = [];
    const uncachedInputs: EmbeddingInput[] = [];

    for (const inp of inputs) {
      const cached = await this.cacheService.get(inp.text, this.getModelName());
      if (cached) {
        cachedResults.push(cached);
      } else {
        uncachedInputs.push(inp);
      }
    }

    // If all inputs are cached, return cached results
    if (uncachedInputs.length === 0) {
      this.logger.debug('All embeddings found in cache', { count: cachedResults.length });
      return Array.isArray(input) ? cachedResults : cachedResults[0];
    }

    try {
      // Wait for available request slot
      await this.waitForAvailableSlot();

      const { result, time } = await this.executeWithTimeout(async () => {
        return await this.measureTime(async () => {
          return await processEmbeddings(uncachedInputs);
        });
      });

      // Release request slot
      this.releaseSlot();

      // Update processingTime with the actual measured time
      const apiResults = Array.isArray(result) ? result : [result];
      apiResults.forEach(embedding => {
        embedding.processingTime = time;
      });

      // Cache the new results
      for (let i = 0; i < apiResults.length; i++) {
        await this.cacheService.set(uncachedInputs[i].text, this.getModelName(), apiResults[i]);
      }

      // Combine cached and new results
      const finalResult = [...cachedResults, ...apiResults];

      return Array.isArray(input) ? finalResult : finalResult[0];
    } catch (error) {
      // Release request slot in case of error
      this.releaseSlot();
      throw error;
    }
  }

  protected async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; time: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    return { result, time: endTime - startTime };
  }

  /**
   * Wait for available request slot based on concurrency limits
   */
  protected async waitForAvailableSlot(): Promise<void> {
    return new Promise(resolve => {
      if (this.activeRequests < this.maxConcurrent) {
        this.activeRequests++;
        resolve();
      } else {
        this.requestQueue.push(() => {
          this.activeRequests++;
          resolve();
        });
      }
    });
  }

  /**
   * Release a request slot
   */
  protected releaseSlot(): void {
    this.activeRequests--;

    // Process next request in queue if available
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      if (next) {
        setTimeout(next, 0); // Schedule for next tick
      }
    }
  }

  /**
   * Execute an operation with timeout
   */
  protected async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);

      // Execute operation
      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
