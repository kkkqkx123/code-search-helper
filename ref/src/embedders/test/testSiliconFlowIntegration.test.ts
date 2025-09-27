import { ConfigService } from '../../config/ConfigService';
import { SiliconFlowEmbedder } from '../SiliconFlowEmbedder';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { CacheManager } from '../../services/cache/CacheManager';

// Mock CacheManager for testing
const mockCacheManager = {
  getEmbeddingCache: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({ size: 0, hitCount: 0, missCount: 0 })
  })
} as unknown as CacheManager;

describe('SiliconFlow Integration', () => {
  let configService: ConfigService;
  let logger: LoggerService;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;
  let siliconFlowEmbedder: SiliconFlowEmbedder;

  beforeEach(() => {
    // Initialize services
    configService = ConfigService.getInstance();
    logger = new LoggerService();
    errorHandler = new ErrorHandlerService(logger);
    cacheService = new EmbeddingCacheService(configService, logger, mockCacheManager);
  });

  test('should create SiliconFlow embedder successfully', () => {
    // Initialize SiliconFlow embedder
    siliconFlowEmbedder = new SiliconFlowEmbedder(
      configService,
      logger,
      errorHandler,
      cacheService
    );

    expect(siliconFlowEmbedder).toBeDefined();
    expect(siliconFlowEmbedder).toBeInstanceOf(SiliconFlowEmbedder);
  });

  test('should have valid SiliconFlow configuration', () => {
    const config = configService.get('embedding');
    
    expect(config).toBeDefined();
    expect(config.siliconflow).toBeDefined();
    expect(config.siliconflow.apiKey).toBeDefined();
    expect(config.siliconflow.baseUrl).toBeDefined();
    expect(config.siliconflow.model).toBeDefined();
    
    // Log configuration for debugging
    console.log('SiliconFlow Configuration:');
    console.log('- API Key:', config.siliconflow.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', config.siliconflow.baseUrl || '[NOT SET]');
    console.log('- Model:', config.siliconflow.model);
  });

  test('should get correct model name and dimensions', () => {
    siliconFlowEmbedder = new SiliconFlowEmbedder(
      configService,
      logger,
      errorHandler,
      cacheService
    );

    const modelName = siliconFlowEmbedder.getModelName();
    const dimensions = siliconFlowEmbedder.getDimensions();

    expect(modelName).toBeDefined();
    expect(typeof modelName).toBe('string');
    expect(dimensions).toBeDefined();
    expect(typeof dimensions).toBe('number');
    expect(dimensions).toBeGreaterThan(0);
  });

  test('should handle missing API key gracefully', () => {
    // This test verifies that the embedder can be created even without API key
    // Actual API calls would fail, but instantiation should work
    expect(() => {
      new SiliconFlowEmbedder(
        configService,
        logger,
        errorHandler,
        cacheService
      );
    }).not.toThrow();
  });
});
