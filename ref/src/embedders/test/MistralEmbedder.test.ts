import { MistralEmbedder } from '../MistralEmbedder';
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
        mistral: {
          apiKey: 'test-api-key',
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

describe('MistralEmbedder', () => {
  let mistralEmbedder: MistralEmbedder;
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  let mockErrorHandlerService: MockErrorHandlerService;
  let mockCacheService: MockEmbeddingCacheService;

  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    mockErrorHandlerService = new MockErrorHandlerService();
    mockCacheService = new MockEmbeddingCacheService();

    mistralEmbedder = new MistralEmbedder(
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
      expect((mistralEmbedder as any).apiKey).toBe('test-api-key');
      expect((mistralEmbedder as any).model).toBe('mistral-embed');
    });

    it('should use default model when not specified', () => {
      const configWithoutModel = new MockConfigService({
        embedding: {
          mistral: {
            apiKey: 'test-api-key',
            baseUrl: 'https://api.mistral.ai',
            // No model specified
          },
        },
      });

      const embedder = new MistralEmbedder(
        configWithoutModel as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      expect((embedder as any).model).toBe('mistral-embed');
    });
  });

  describe('getBaseUrl', () => {
    it('should return configured base URL', () => {
      const baseUrl = (mistralEmbedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://api.mistral.ai');
    });

    it('should return default base URL when not configured', () => {
      const configWithoutBaseUrl = new MockConfigService({
        embedding: {
          mistral: {
            apiKey: 'test-api-key',
            model: 'mistral-embed',
            // No baseUrl specified
          },
        },
      });

      const embedder = new MistralEmbedder(
        configWithoutBaseUrl as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      const baseUrl = (embedder as any).getBaseUrl();
      expect(baseUrl).toBe('https://api.mistral.ai');
    });
  });

  describe('getApiKey', () => {
    it('should return configured API key', () => {
      const apiKey = (mistralEmbedder as any).getApiKey();
      expect(apiKey).toBe('test-api-key');
    });
  });

  describe('getModel', () => {
    it('should return configured model', () => {
      const model = (mistralEmbedder as any).getModel();
      expect(model).toBe('mistral-embed');
    });
  });

  describe('getEmbeddingEndpoint', () => {
    it('should return correct embedding endpoint', () => {
      const endpoint = (mistralEmbedder as any).getEmbeddingEndpoint();
      expect(endpoint).toBe('/v1/embeddings');
    });
  });

  describe('getAvailabilityEndpoint', () => {
    it('should return correct availability endpoint', () => {
      const endpoint = (mistralEmbedder as any).getAvailabilityEndpoint();
      expect(endpoint).toBe('/v1/models');
    });
  });

  describe('getComponentName', () => {
    it('should return correct component name', () => {
      const componentName = (mistralEmbedder as any).getComponentName();
      expect(componentName).toBe('MistralEmbedder');
    });
  });

  describe('embed', () => {
    it('should call embedWithCache with correct parameters', async () => {
      const input: EmbeddingInput = { text: 'test text' };

      // Mock the embedWithCache method
      const embedWithCacheSpy = jest.spyOn(mistralEmbedder as any, 'embedWithCache');
      embedWithCacheSpy.mockImplementation(async (input: any, processEmbeddings: any) => {
        return await processEmbeddings([input]);
      });

      // Mock the makeEmbeddingRequest method
      const makeEmbeddingRequestSpy = jest.spyOn(mistralEmbedder as any, 'makeEmbeddingRequest');
      makeEmbeddingRequestSpy.mockResolvedValue([
        {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'mistral-embed',
          processingTime: 100,
        },
      ]);

      await mistralEmbedder.embed(input);

      expect(embedWithCacheSpy).toHaveBeenCalledWith(input, expect.any(Function));
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for mistral-embed', () => {
      const dimensions = mistralEmbedder.getDimensions();
      expect(dimensions).toBe(1024);
    });
  });

  describe('getModelName', () => {
    it('should return configured model name', () => {
      const modelName = mistralEmbedder.getModelName();
      expect(modelName).toBe('mistral-embed');
    });
  });

  describe('isAvailable', () => {
    it('should call checkAvailabilityViaHttp', async () => {
      // Mock the checkAvailabilityViaHttp method
      const checkAvailabilitySpy = jest.spyOn(mistralEmbedder as any, 'checkAvailabilityViaHttp');
      checkAvailabilitySpy.mockResolvedValue(true);

      const result = await mistralEmbedder.isAvailable();

      expect(checkAvailabilitySpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
