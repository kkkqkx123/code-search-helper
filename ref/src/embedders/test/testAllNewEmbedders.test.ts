import { ConfigService } from '../../config/ConfigService';
import { SiliconFlowEmbedder } from '../SiliconFlowEmbedder';
import { Custom1Embedder } from '../Custom1Embedder';
import { Custom2Embedder } from '../Custom2Embedder';
import { Custom3Embedder } from '../Custom3Embedder';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Test suite for all new embedders
describe('All New Embedders Integration', () => {
  let configService: ConfigService;
  let logger: LoggerService;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;

  beforeEach(() => {
    // Mock dependencies to avoid configuration validation errors
    configService = {
      get: jest.fn().mockReturnValue({
        siliconflow: {
          apiKey: 'test-key',
          baseUrl: 'http://localhost:8000',
          model: 'test-model',
        },
        custom: {
          custom1: {
            apiKey: 'test-key',
            baseUrl: 'http://localhost:8001',
            model: 'test-model',
          },
          custom2: {
            apiKey: 'test-key',
            baseUrl: 'http://localhost:8002',
            model: 'test-model',
          },
          custom3: {
            apiKey: 'test-key',
            baseUrl: 'http://localhost:8003',
            model: 'test-model',
          },
        },
      }),
      getAll: jest.fn().mockReturnValue({}),
    } as any;

    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    errorHandler = {
      handleError: jest.fn(),
      handleAsyncError: jest.fn(),
      wrapAsync: jest.fn().mockImplementation(fn => fn),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as any;
  });

  test('should create all new embedders without errors', () => {
    expect(() => {
      new SiliconFlowEmbedder(configService, logger, errorHandler, cacheService);
      new Custom1Embedder(configService, logger, errorHandler, cacheService);
      new Custom2Embedder(configService, logger, errorHandler, cacheService);
      new Custom3Embedder(configService, logger, errorHandler, cacheService);
    }).not.toThrow();
  });

  test('should get dimensions from all embedders', () => {
    const siliconFlowEmbedder = new SiliconFlowEmbedder(
      configService,
      logger,
      errorHandler,
      cacheService
    );
    const custom1Embedder = new Custom1Embedder(configService, logger, errorHandler, cacheService);
    const custom2Embedder = new Custom2Embedder(configService, logger, errorHandler, cacheService);
    const custom3Embedder = new Custom3Embedder(configService, logger, errorHandler, cacheService);

    expect(siliconFlowEmbedder.getDimensions()).toBeGreaterThan(0);
    expect(custom1Embedder.getDimensions()).toBeGreaterThan(0);
    expect(custom2Embedder.getDimensions()).toBeGreaterThan(0);
    expect(custom3Embedder.getDimensions()).toBeGreaterThan(0);
  });

  test('should get model names from all embedders', () => {
    const siliconFlowEmbedder = new SiliconFlowEmbedder(
      configService,
      logger,
      errorHandler,
      cacheService
    );
    const custom1Embedder = new Custom1Embedder(configService, logger, errorHandler, cacheService);
    const custom2Embedder = new Custom2Embedder(configService, logger, errorHandler, cacheService);
    const custom3Embedder = new Custom3Embedder(configService, logger, errorHandler, cacheService);

    expect(siliconFlowEmbedder.getModelName()).toBeDefined();
    expect(custom1Embedder.getModelName()).toBeDefined();
    expect(custom2Embedder.getModelName()).toBeDefined();
    expect(custom3Embedder.getModelName()).toBeDefined();
  });

  test('should check availability of all embedders', async () => {
    const siliconFlowEmbedder = new SiliconFlowEmbedder(
      configService,
      logger,
      errorHandler,
      cacheService
    );
    const custom1Embedder = new Custom1Embedder(configService, logger, errorHandler, cacheService);
    const custom2Embedder = new Custom2Embedder(configService, logger, errorHandler, cacheService);
    const custom3Embedder = new Custom3Embedder(configService, logger, errorHandler, cacheService);

    // Mock availability checks
    jest.spyOn(siliconFlowEmbedder, 'isAvailable').mockResolvedValue(true);
    jest.spyOn(custom1Embedder, 'isAvailable').mockResolvedValue(true);
    jest.spyOn(custom2Embedder, 'isAvailable').mockResolvedValue(true);
    jest.spyOn(custom3Embedder, 'isAvailable').mockResolvedValue(true);

    expect(await siliconFlowEmbedder.isAvailable()).toBe(true);
    expect(await custom1Embedder.isAvailable()).toBe(true);
    expect(await custom2Embedder.isAvailable()).toBe(true);
    expect(await custom3Embedder.isAvailable()).toBe(true);
  });
});
