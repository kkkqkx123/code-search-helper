import { BaseEmbedder, EmbeddingInput, EmbeddingResult } from '../BaseEmbedder';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService, ErrorContext } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';

// Mock classes
class MockConfigService implements Partial<ConfigService> {
  private config: any;

  constructor(config: any = {}) {
    // Default configuration
    this.config = {
      batchProcessing: {
        processingTimeout: 300000, // 5 minutes
        maxConcurrentOperations: 5,
      },
      ...config,
    };
  }

  get(key: string): any {
    if (key === 'batchProcessing') return this.config.batchProcessing;
    return this.config[key];
  }
}

class MockLoggerService implements Partial<LoggerService> {
  debug(message: string, meta?: any): void {
    // Mock implementation
  }

  warn(message: string, meta?: any): void {
    // Mock implementation
  }

  error(message: string, error?: any): void {
    // Mock implementation
  }

  info(message: string, meta?: any): void {
    // Mock implementation
  }

  verbose(message: string, meta?: any): void {
    // Mock implementation
  }
}

class MockErrorHandlerService implements Partial<ErrorHandlerService> {
  handleError(error: Error, context: ErrorContext): any {
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

  handleAsyncError(operation: () => Promise<any>, context: ErrorContext): Promise<any> {
    return operation().catch(error => {
      this.handleError(error, context);
      throw error;
    });
  }
}

class MockEmbeddingCacheService implements Partial<EmbeddingCacheService> {
  private cache: Map<string, EmbeddingResult> = new Map();

  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    const key = `${model}:${text}`;
    return this.cache.get(key) || null;
  }

  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    const key = `${model}:${text}`;
    this.cache.set(key, result);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getStats(): Promise<{ size: number; hits?: number; misses?: number }> {
    return {
      size: this.cache.size,
    };
  }
}

// Concrete implementation of BaseEmbedder for testing
class TestEmbedder extends BaseEmbedder {
  private modelName: string = 'test-model';
  private dimensions: number = 768;

  constructor(
    configService: ConfigService,
    logger: LoggerService,
    errorHandler: ErrorHandlerService,
    cacheService: EmbeddingCacheService
  ) {
    super(configService, logger, errorHandler, cacheService);
  }

  async embed(
    input: EmbeddingInput | EmbeddingInput[]
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    // This is just a mock implementation for testing
    const inputs = Array.isArray(input) ? input : [input];

    return await this.embedWithCache(input, async uncachedInputs => {
      return uncachedInputs.map(inp => ({
        vector: new Array(this.dimensions).fill(0.1),
        dimensions: this.dimensions,
        model: this.getModelName(),
        processingTime: 100,
      }));
    });
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('BaseEmbedder', () => {
  let testEmbedder: TestEmbedder;
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  let mockErrorHandlerService: MockErrorHandlerService;
  let mockCacheService: MockEmbeddingCacheService;

  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    mockErrorHandlerService = new MockErrorHandlerService();
    mockCacheService = new MockEmbeddingCacheService();

    testEmbedder = new TestEmbedder(
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

  describe('embedWithCache', () => {
    it('should return cached result when available', async () => {
      const input: EmbeddingInput = { text: 'test text' };
      const cachedResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 50,
      };

      // Set up cache with a result
      mockCacheService.set('test text', 'test-model', cachedResult);

      const result = await testEmbedder.embed(input);

      expect(result).toEqual(cachedResult);
    });

    it('should process and cache new results', async () => {
      const input: EmbeddingInput = { text: 'new text' };

      const result = await testEmbedder.embed(input);

      // Verify the result is as expected
      expect(result).toEqual({
        vector: new Array(768).fill(0.1),
        dimensions: 768,
        model: 'test-model',
        processingTime: expect.any(Number),
      });

      // Verify the result was cached
      const cachedResult = await mockCacheService.get('new text', 'test-model');
      expect(cachedResult).toEqual(result);
    });

    it('should handle array inputs', async () => {
      const inputs: EmbeddingInput[] = [{ text: 'text 1' }, { text: 'text 2' }];

      const results = await testEmbedder.embed(inputs);

      // For array inputs, we expect an array output
      expect(Array.isArray(results)).toBe(true);
      if (Array.isArray(results)) {
        expect(results).toHaveLength(2);
      }

      // Verify each result
      if (Array.isArray(results)) {
        results.forEach(result => {
          expect(result).toEqual({
            vector: new Array(768).fill(0.1),
            dimensions: 768,
            model: 'test-model',
            processingTime: expect.any(Number),
          });
        });
      } else {
        expect(results).toEqual({
          vector: new Array(768).fill(0.1),
          dimensions: 768,
          model: 'test-model',
          processingTime: expect.any(Number),
        });
      }

      // Verify the results were cached
      const cachedResult1 = await mockCacheService.get('text 1', 'test-model');
      if (Array.isArray(results)) {
        expect(cachedResult1).toEqual(results[0]);
      } else {
        expect(cachedResult1).toEqual(results);
      }

      const cachedResult2 = await mockCacheService.get('text 2', 'test-model');
      if (Array.isArray(results) && results.length > 1) {
        expect(cachedResult2).toEqual(results[1]);
      } else {
        // If only one result, the second cache lookup should be null
        expect(cachedResult2).toBeNull();
      }
    });

    it('should combine cached and new results for array inputs', async () => {
      const inputs: EmbeddingInput[] = [{ text: 'cached text' }, { text: 'new text' }];

      const cachedResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 50,
      };

      // Set up cache with one result
      mockCacheService.set('cached text', 'test-model', cachedResult);

      const results = await testEmbedder.embed(inputs);

      // For array inputs, we expect an array output
      expect(Array.isArray(results)).toBe(true);
      if (Array.isArray(results)) {
        expect(results).toHaveLength(2);
      }

      if (Array.isArray(results)) {
        // First result should be the cached one
        expect(results[0]).toEqual(cachedResult);

        // Second result should be a new one
        expect(results[1]).toEqual({
          vector: new Array(768).fill(0.1),
          dimensions: 768,
          model: 'test-model',
          processingTime: expect.any(Number),
        });
      } else {
        // If only one result, it should be the cached one
        expect(results).toEqual(cachedResult);
      }

      // Verify the new result was cached
      const newCachedResult = await mockCacheService.get('new text', 'test-model');
      if (Array.isArray(results) && results.length > 1) {
        expect(newCachedResult).toEqual(results[1]);
      } else {
        // If only one result, and it was cached, then newCachedResult should be the same
        // If only one result, and it wasn't cached, then newCachedResult should match results
        expect(newCachedResult).toEqual(results);
      }
    });
  });

  describe('measureTime', () => {
    it('should measure execution time of an operation', async () => {
      const operation = async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const { result, time } = await (testEmbedder as any).measureTime(operation);

      expect(result).toBe('result');
      expect(time).toBeGreaterThanOrEqual(10);
    });
  });

  describe('waitForAvailableSlot', () => {
    it('should resolve immediately when under concurrency limit', async () => {
      // This test is a bit tricky because waitForAvailableSlot is protected
      // We'll test it indirectly by making concurrent requests

      const input: EmbeddingInput = { text: 'test text' };

      // Make a request - should complete quickly
      const start = Date.now();
      await testEmbedder.embed(input);
      const end = Date.now();

      // Should complete within a reasonable time (much less than timeout)
      expect(end - start).toBeLessThan(1000);
    });

    it('should queue requests when at concurrency limit', async () => {
      // Create an embedder with maxConcurrent of 1
      const limitedConfigService = new MockConfigService({
        batchProcessing: {
          processingTimeout: 300000, // 5 minutes
          maxConcurrentOperations: 1,
        },
      });

      // Create a test embedder that simulates slow processing
      class SlowTestEmbedder extends BaseEmbedder {
        private modelName: string = 'test-model';
        private dimensions: number = 768;

        constructor(
          configService: ConfigService,
          logger: LoggerService,
          errorHandler: ErrorHandlerService,
          cacheService: EmbeddingCacheService
        ) {
          super(configService, logger, errorHandler, cacheService);
        }

        async embed(
          input: EmbeddingInput | EmbeddingInput[]
        ): Promise<EmbeddingResult | EmbeddingResult[]> {
          // This is just a mock implementation for testing
          const inputs = Array.isArray(input) ? input : [input];

          return await this.embedWithCache(input, async inputs => {
            // Simulate slow processing
            await new Promise(resolve => setTimeout(resolve, 50));
            return inputs.map(inp => ({
              vector: new Array(this.dimensions).fill(0.1),
              dimensions: this.dimensions,
              model: this.getModelName(),
              processingTime: 100,
            }));
          });
        }

        getDimensions(): number {
          return this.dimensions;
        }

        getModelName(): string {
          return this.modelName;
        }

        async isAvailable(): Promise<boolean> {
          return true;
        }
      }

      const slowEmbedder = new SlowTestEmbedder(
        limitedConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      const input1: EmbeddingInput = { text: 'text 1' };
      const input2: EmbeddingInput = { text: 'text 2' };

      // Start two requests concurrently
      const start = Date.now();
      const [result1, result2] = await Promise.all([
        slowEmbedder.embed(input1),
        slowEmbedder.embed(input2),
      ]);
      const end = Date.now();

      // Both requests should complete successfully
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Total time should be at least 100ms (50ms for each request, one after the other)
      // But less than 200ms (if they ran in parallel, it would be ~50ms)
      expect(end - start).toBeGreaterThanOrEqual(90);
      expect(end - start).toBeLessThan(200);
    });
  });

  describe('executeWithTimeout', () => {
    it('should execute operation within timeout', async () => {
      const operation = async () => {
        return 'result';
      };

      const result = await (testEmbedder as any).executeWithTimeout(operation);

      expect(result).toBe('result');
    });

    it('should reject operation that exceeds timeout', async () => {
      // Create an embedder with a short timeout
      const shortTimeoutConfigService = new MockConfigService({
        batchProcessing: {
          processingTimeout: 10, // 10ms
          maxConcurrentOperations: 5,
        },
      });

      const shortTimeoutEmbedder = new TestEmbedder(
        shortTimeoutConfigService as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        mockErrorHandlerService as unknown as ErrorHandlerService,
        mockCacheService as unknown as EmbeddingCacheService
      );

      const operation = async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      await expect((shortTimeoutEmbedder as any).executeWithTimeout(operation)).rejects.toThrow(
        'Operation timed out after 10ms'
      );
    });
  });
});
