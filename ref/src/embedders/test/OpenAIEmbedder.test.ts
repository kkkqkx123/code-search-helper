import { OpenAIEmbedder } from '../OpenAIEmbedder';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { EmbeddingInput } from '../BaseEmbedder';

// Mock classes
class MockConfigService {
  private config: any;

  constructor(config: any = {}) {
    // Default configuration
    this.config = {
      embedding: {
        openai: {
          apiKey: 'test-api-key',
          baseUrl: 'https://api.openai.com',
          model: 'text-embedding-ada-02',
          dimensions: 1536,
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

describe('OpenAIEmbedder', () => {
  let openAIEmbedder: OpenAIEmbedder;
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  let mockErrorHandlerService: MockErrorHandlerService;
  let mockCacheService: MockEmbeddingCacheService;

  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    mockErrorHandlerService = new MockErrorHandlerService();
    mockCacheService = new MockEmbeddingCacheService();

    openAIEmbedder = new OpenAIEmbedder(
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
      expect((openAIEmbedder as any).apiKey).toBe('test-api-key');
      expect((openAIEmbedder as any).model).toBe('text-embedding-ada-02');
    });

    it('should use default model when not specified', () => {
      const configWithoutModel = new MockConfigService({
        embedding: {
          openai: {
            apiKey: 'test-api-key',
            baseUrl: 'https://api.openai.com',
            // No model specified
          },
        },
      });

      const embedder = new OpenAIEmbedder(
        configWithoutModel as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      expect((embedder as any).model).toBe('text-embedding-ada-002');
    });
  });

  describe('getBaseUrl', () => {
    it('should return configured base URL', () => {
      const baseUrl = (openAIEmbedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://api.openai.com');
    });

    it('should return default base URL when not configured', () => {
      const configWithoutBaseUrl = new MockConfigService({
        embedding: {
          openai: {
            apiKey: 'test-api-key',
            model: 'text-embedding-ada-002',
            // No baseUrl specified
          },
        },
      });

      const embedder = new OpenAIEmbedder(
        configWithoutBaseUrl as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      const baseUrl = (embedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://api.openai.com');
    });
  });

  describe('getApiKey', () => {
    it('should return configured API key', () => {
      const apiKey = (openAIEmbedder as any).getApiKey();
      expect(apiKey).toBe('test-api-key');
    });
  });

  describe('getModel', () => {
    it('should return configured model', () => {
      const model = (openAIEmbedder as any).getModel();
      expect(model).toBe('text-embedding-ada-02');
    });
  });

  describe('getEmbeddingEndpoint', () => {
    it('should return correct embedding endpoint', () => {
      const endpoint = (openAIEmbedder as any).getEmbeddingEndpoint();
      expect(endpoint).toBe('/v1/embeddings');
    });
  });

  describe('getAvailabilityEndpoint', () => {
    it('should return correct availability endpoint', () => {
      const endpoint = (openAIEmbedder as any).getAvailabilityEndpoint();
      expect(endpoint).toBe('/v1/models');
    });
  });

  describe('getComponentName', () => {
    it('should return correct component name', () => {
      const componentName = (openAIEmbedder as any).getComponentName();
      expect(componentName).toBe('OpenAIEmbedder');
    });
  });

  describe('embed', () => {
    it('should call embedWithCache with correct parameters', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock the embedWithCache method
      const embedWithCacheSpy = jest.spyOn(openAIEmbedder as any, 'embedWithCache');
      embedWithCacheSpy.mockImplementation(async (input: any, processEmbeddings: any) => {
        return await processEmbeddings([input]);
      });

      // Mock the makeEmbeddingRequest method
      const makeEmbeddingRequestSpy = jest.spyOn(openAIEmbedder as any, 'makeEmbeddingRequest');
      makeEmbeddingRequestSpy.mockResolvedValue([
        {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'text-embedding-ada-002',
          processingTime: 100,
        },
      ]);

      await openAIEmbedder.embed(input);

      expect(embedWithCacheSpy).toHaveBeenCalledWith(input, expect.any(Function));
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for text-embedding-ada-002', () => {
      const dimensions = openAIEmbedder.getDimensions();
      expect(dimensions).toBe(1536);
    });
  });

  describe('getModelName', () => {
    it('should return configured model name', () => {
      const modelName = openAIEmbedder.getModelName();
      expect(modelName).toBe('text-embedding-ada-02');
    });
  });

  describe('isAvailable', () => {
    it('should call checkAvailabilityViaHttp', async () => {
      // Mock the checkAvailabilityViaHttp method
      const checkAvailabilitySpy = jest.spyOn(openAIEmbedder as any, 'checkAvailabilityViaHttp');
      checkAvailabilitySpy.mockResolvedValue(true);

      const result = await openAIEmbedder.isAvailable();

      expect(checkAvailabilitySpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
