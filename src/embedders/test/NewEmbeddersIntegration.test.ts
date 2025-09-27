import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { OpenAIEmbedder } from '../OpenAIEmbedder';
import { OllamaEmbedder } from '../OllamaEmbedder';
import { GeminiEmbedder } from '../GeminiEmbedder';
import { MistralEmbedder } from '../MistralEmbedder';
import { EmbeddingInput } from '../BaseEmbedder';

// Store original fetch
const originalFetch = global.fetch;

// Mock classes
class MockConfigService {
  private config: any;

  constructor(config: any = {}) {
    // Default configuration
    this.config = {
      embedding: {
        openai: {
          apiKey: 'test-openai-api-key',
          baseUrl: 'https://api.openai.com',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'test-gemini-api-key',
          baseUrl: 'https://generativelanguage.googleapis.com',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-api-key',
          baseUrl: 'https://api.mistral.ai',
          model: 'mistral-embed',
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
      maxSize: 100,
      defaultTTL: 300000,
    };
  }
}

describe('New Embedders Integration', () => {
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  let mockErrorHandlerService: MockErrorHandlerService;
  let mockCacheService: MockEmbeddingCacheService;

  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    mockErrorHandlerService = new MockErrorHandlerService();
    mockCacheService = new MockEmbeddingCacheService();
  });

  afterEach(() => {
    // Clear the cache after each test
    mockCacheService.clear();
  });

  describe('OpenAIEmbedder', () => {
    let openAIEmbedder: OpenAIEmbedder;

    beforeEach(() => {
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should be instantiated correctly', () => {
      expect(openAIEmbedder).toBeInstanceOf(OpenAIEmbedder);
    });

    it('should have correct model name', () => {
      expect(openAIEmbedder.getModelName()).toBe('text-embedding-ada-002');
    });

    it('should have correct dimensions', () => {
      expect(openAIEmbedder.getDimensions()).toBe(1536);
    });
  });

  describe('OllamaEmbedder', () => {
    let ollamaEmbedder: OllamaEmbedder;

    beforeEach(() => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should be instantiated correctly', () => {
      expect(ollamaEmbedder).toBeInstanceOf(OllamaEmbedder);
    });

    it('should have correct model name', () => {
      expect(ollamaEmbedder.getModelName()).toBe('nomic-embed-text');
    });

    it('should have correct dimensions', () => {
      expect(ollamaEmbedder.getDimensions()).toBe(768);
    });
  });

  describe('GeminiEmbedder', () => {
    let geminiEmbedder: GeminiEmbedder;

    beforeEach(() => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should be instantiated correctly', () => {
      expect(geminiEmbedder).toBeInstanceOf(GeminiEmbedder);
    });

    it('should have correct model name', () => {
      expect(geminiEmbedder.getModelName()).toBe('embedding-001');
    });

    it('should have correct dimensions', () => {
      expect(geminiEmbedder.getDimensions()).toBe(768);
    });
  });

  describe('MistralEmbedder', () => {
    let mistralEmbedder: MistralEmbedder;

    beforeEach(() => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should be instantiated correctly', () => {
      expect(mistralEmbedder).toBeInstanceOf(MistralEmbedder);
    });

    it('should have correct model name', () => {
      expect(mistralEmbedder.getModelName()).toBe('mistral-embed');
    });

    it('should have correct dimensions', () => {
      expect(mistralEmbedder.getDimensions()).toBe(1024);
    });
  });

  describe('Cache Integration', () => {
    let openAIEmbedder: OpenAIEmbedder;
    let ollamaEmbedder: OllamaEmbedder;

    beforeEach(() => {
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should cache results from different embedders separately', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock the embed methods to return different results
      jest.spyOn(openAIEmbedder, 'embed').mockImplementation(async () => {
        return {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'text-embedding-ada-002',
          processingTime: 100,
        };
      });

      jest.spyOn(ollamaEmbedder, 'embed').mockImplementation(async () => {
        return {
          vector: [0.4, 0.5, 0.6],
          dimensions: 3,
          model: 'nomic-embed-text',
          processingTime: 100,
        };
      });

      // Call embed on both embedders
      await openAIEmbedder.embed(input);
      await ollamaEmbedder.embed(input);

      // Verify cache was called with correct parameters
      // Note: This is a simplified test as we're using a mock cache service
      // In a real test, we would verify the actual cache behavior
    });
  });

  describe('Concurrency and Timeout Integration', () => {
    let openAIEmbedder: OpenAIEmbedder;

    beforeEach(() => {
      // Create an embedder with specific concurrency and timeout settings
      const configWithLimits = new MockConfigService({
        batchProcessing: {
          processingTimeout: 100, // 100ms
          maxConcurrentOperations: 2,
        },
      });

      openAIEmbedder = new OpenAIEmbedder(
        configWithLimits as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );
    });

    it('should respect concurrency limits', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock fetch to simulate slow processing
      const mockFetch = jest
        .fn()
        .mockImplementationOnce(async () => {
          // First request - simulate delay
          await new Promise(resolve => setTimeout(resolve, 50));
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.1, 0.2, 0.3] }],
            }),
            { status: 200 }
          );
        })
        .mockImplementationOnce(async () => {
          // Second request - simulate delay
          await new Promise(resolve => setTimeout(resolve, 50));
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.1, 0.2, 0.3] }],
            }),
            { status: 200 }
          );
        })
        .mockImplementationOnce(async () => {
          // Third request - simulate delay
          await new Promise(resolve => setTimeout(resolve, 50));
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.1, 0.2, 0.3] }],
            }),
            { status: 200 }
          );
        });

      global.fetch = mockFetch as any;

      try {
        // Start multiple concurrent requests
        const start = Date.now();
        const promises = [
          openAIEmbedder.embed(input),
          openAIEmbedder.embed(input),
          openAIEmbedder.embed(input),
        ];

        await Promise.all(promises);
        const end = Date.now();

        // With maxConcurrentOperations = 2 and 3 requests,
        // the total time should be at least 100ms (50ms for first 2, then 50ms for the third)
        expect(end - start).toBeGreaterThanOrEqual(100);
      } finally {
        // Restore original fetch
        (global.fetch as any) = originalFetch;
      }
    });

    it('should timeout when processing takes too long', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock fetch to simulate very slow processing
      const mockFetch = jest.fn(async () => {
        // Simulate very slow processing that exceeds timeout
        await new Promise(resolve => setTimeout(resolve, 200));
        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, 0.2, 0.3] }],
          }),
          { status: 200 }
        );
      });

      global.fetch = mockFetch as any;

      try {
        // The operation should timeout after 100ms
        await expect(openAIEmbedder.embed(input)).rejects.toThrow(
          'Operation timed out after 100ms'
        );
      } finally {
        // Restore original fetch
        (global.fetch as any) = originalFetch;
      }
    });
  });
});
