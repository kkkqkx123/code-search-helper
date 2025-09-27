import { GeminiEmbedder } from '../GeminiEmbedder';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { EmbeddingInput, EmbeddingResult } from '../BaseEmbedder';

// Mock classes
class MockConfigService {
  private config: any;

  constructor(config: any = {}) {
    // Default configuration
    this.config = {
      embedding: {
        gemini: {
          apiKey: 'test-api-key',
          baseUrl: 'https://generativelanguage.googleapis.com',
          model: 'embedding-001',
        },
      },
      batchProcessing: {
        processingTimeout: 300000, // 5 minutes
        maxConcurrentOperations: 5,
      },
      caching: {
        defaultTTL: 300,
        maxSize: 1000,
      },
      cache: {
        ttl: 300,
        maxEntries: 1000,
        cleanupInterval: 60,
      },
      ...config,
    };
  }

  get(key: string): any {
    if (key === 'embedding') return this.config.embedding;
    if (key === 'batchProcessing') return this.config.batchProcessing;
    if (key === 'caching') return this.config.caching;
    if (key === 'cache') return this.config.cache;
    return this.config[key];
  }
}

class MockLoggerService {
  debug(message: string, meta?: any): void {
    // Mock implementation
  }

  warn(message: string, meta?: any): void {
    // Mock implementation
  }

  error(message: string, meta?: any): void {
    // Mock implementation
  }

  info(message: string, meta?: any): void {
    // Mock implementation
  }
}

class MockErrorHandlerService {
  handleError(error: Error, context: any): any {
    // Mock implementation
    return {
      id: 'test-error-id',
      timestamp: new Date(),
      type: error.name,
      message: error.message,
      stack: error.stack,
      context,
      severity: 'medium',
      handled: false,
    };
  }

  handleAsyncError(operation: () => Promise<any>, context: any): Promise<any> {
    return operation().catch(error => {
      this.handleError(error, context);
      throw error;
    });
  }
}

class MockEmbeddingCacheService {
  private cache: Map<string, any> = new Map();

  get(text: string, model: string): any {
    const key = `${model}:${text}`;
    return this.cache.get(key) || null;
  }

  set(text: string, model: string, result: any): void {
    const key = `${model}:${text}`;
    this.cache.set(key, result);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; defaultTTL: number } {
    return {
      size: this.cache.size,
      maxSize: 1000,
      defaultTTL: 300000,
    };
  }
}

describe('GeminiEmbedder', () => {
  let geminiEmbedder: GeminiEmbedder;
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  let mockErrorHandlerService: MockErrorHandlerService;
  let mockCacheService: MockEmbeddingCacheService;

  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    mockErrorHandlerService = new MockErrorHandlerService();
    mockCacheService = new MockEmbeddingCacheService();

    geminiEmbedder = new GeminiEmbedder(
      mockConfigService as unknown as ConfigService,
      mockLoggerService as unknown as LoggerService,
      mockErrorHandlerService as unknown as ErrorHandlerService,
      mockCacheService as unknown as EmbeddingCacheService
    );
  });

  afterEach(() => {
    // Clear the cache after each test
    mockCacheService.clear();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect((geminiEmbedder as any).apiKey).toBe('test-api-key');
      expect((geminiEmbedder as any).model).toBe('embedding-001');
    });

    it('should use default model when not specified', () => {
      const configWithoutModel = new MockConfigService({
        embedding: {
          gemini: {
            apiKey: 'test-api-key',
            baseUrl: 'https://generativelanguage.googleapis.com',
            // No model specified
          },
        },
      });

      const embedder = new GeminiEmbedder(
        configWithoutModel as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      expect((embedder as any).model).toBe('embedding-001');
    });
  });

  describe('getBaseUrl', () => {
    it('should return configured base URL', () => {
      const baseUrl = (geminiEmbedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://generativelanguage.googleapis.com');
    });

    it('should return default base URL when not configured', () => {
      const configWithoutBaseUrl = new MockConfigService({
        embedding: {
          gemini: {
            apiKey: 'test-api-key',
            model: 'embedding-001',
            // No baseUrl specified
          },
        },
      });

      const embedder = new GeminiEmbedder(
        configWithoutBaseUrl as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      const baseUrl = (embedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://generativelanguage.googleapis.com');
    });
  });

  describe('embed', () => {
    it('should call embedWithCache with correct parameters', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock the embedWithCache method
      const embedWithCacheSpy = jest.spyOn(geminiEmbedder as any, 'embedWithCache');
      embedWithCacheSpy.mockImplementation(async (input: any, processEmbeddings: any) => {
        return await processEmbeddings([input]);
      });

      // Mock the makeEmbeddingRequest method
      const makeEmbeddingRequestSpy = jest.spyOn(geminiEmbedder as any, 'makeEmbeddingRequest');
      makeEmbeddingRequestSpy.mockResolvedValue([
        {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'embedding-001',
          processingTime: 100,
        },
      ]);

      await geminiEmbedder.embed(input);

      expect(embedWithCacheSpy).toHaveBeenCalledWith(input, expect.any(Function));
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for embedding-001', () => {
      const dimensions = geminiEmbedder.getDimensions();
      expect(dimensions).toBe(768);
    });
  });

  describe('getModelName', () => {
    it('should return configured model name', () => {
      const modelName = geminiEmbedder.getModelName();
      expect(modelName).toBe('embedding-001');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Gemini is available', async () => {
      // Mock the fetch function to simulate a successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
      }) as jest.Mock;

      const result = await geminiEmbedder.isAvailable();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-api-key',
        {
          method: 'GET',
        }
      );
    });

    it('should return false when Gemini is not available', async () => {
      // Mock the fetch function to simulate a failed response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      }) as jest.Mock;

      const result = await geminiEmbedder.isAvailable();

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-api-key',
        {
          method: 'GET',
        }
      );
    });

    it('should return false when fetch throws an error', async () => {
      // Mock the fetch function to simulate an error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock;

      const result = await geminiEmbedder.isAvailable();

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-api-key',
        {
          method: 'GET',
        }
      );
    });
  });

  describe('makeEmbeddingRequest', () => {
    it('should make correct API request', async () => {
      const inputs: EmbeddingInput[] = [{ text: 'test text' }];

      // Mock the fetch function to simulate a successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
      }) as jest.Mock;

      const results = await (geminiEmbedder as any).makeEmbeddingRequest(inputs);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=test-api-key',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: {
              parts: [
                {
                  text: 'test text',
                },
              ],
            },
          }),
        }
      );

      expect(results).toEqual([
        {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'embedding-001',
          processingTime: 0,
        },
      ]);
    });

    it('should throw error when API request fails', async () => {
      const inputs: EmbeddingInput[] = [{ text: 'test text' }];

      // Mock the fetch function to simulate a failed response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }) as jest.Mock;

      await expect((geminiEmbedder as any).makeEmbeddingRequest(inputs)).rejects.toThrow(
        'Gemini API request failed with status 500: Internal Server Error'
      );
    });
  });
});
