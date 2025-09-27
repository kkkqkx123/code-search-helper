import { EmbedderFactory } from '../EmbedderFactory';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { LoggerService } from '../../utils/LoggerService';
import { Logger } from '../../utils/logger';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// Mock embedders
const mockOpenAIEmbedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(1536),
  getModelName: jest.fn().mockReturnValue('text-embedding-ada-002'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockOllamaEmbedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(768),
  getModelName: jest.fn().mockReturnValue('nomic-embed-text'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

// Mock the require calls in EmbedderFactory
jest.mock('../OpenAIEmbedder', () => {
  return {
    OpenAIEmbedder: jest.fn().mockImplementation(() => mockOpenAIEmbedder)
  };
});

jest.mock('../OllamaEmbedder', () => {
  return {
    OllamaEmbedder: jest.fn().mockImplementation(() => mockOllamaEmbedder)
  };
});

describe('EmbedderFactory', () => {
  let embedderFactory: EmbedderFactory;
  let logger: LoggerService;
  let loggerInstance: Logger;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup services
    logger = new LoggerService();
    loggerInstance = new Logger('test');
    errorHandler = new ErrorHandlerService(logger);
    cacheService = new EmbeddingCacheService(logger, errorHandler);
    
    // Create EmbedderFactory instance
    embedderFactory = new EmbedderFactory(loggerInstance, errorHandler, cacheService);
  });

  describe('嵌入器服务验收标准', () => {
    test('✅ 嵌入器工厂能够正常工作', () => {
      const providers = embedderFactory.getRegisteredProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('ollama');
      expect(providers.length).toBeGreaterThanOrEqual(2);
    });

    test('✅ OpenAI嵌入器能够生成嵌入', async () => {
      const input = { text: 'test text for embedding' };
      const mockResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: 100
      };
      
      mockOpenAIEmbedder.embed.mockResolvedValue(mockResult);
      
      const embedder = await embedderFactory.getEmbedder('openai');
      const result = await embedder.embed(input);
      
      expect(result).toEqual(mockResult);
      expect(mockOpenAIEmbedder.embed).toHaveBeenCalledWith(input);
    });

    test('✅ Ollama嵌入器能够生成嵌入', async () => {
      const input = { text: 'test text for embedding' };
      const mockResult = {
        vector: [0.4, 0.5, 0.6],
        dimensions: 768,
        model: 'nomic-embed-text',
        processingTime: 150
      };
      
      mockOllamaEmbedder.embed.mockResolvedValue(mockResult);
      
      const embedder = await embedderFactory.getEmbedder('ollama');
      const result = await embedder.embed(input);
      
      expect(result).toEqual(mockResult);
      expect(mockOllamaEmbedder.embed).toHaveBeenCalledWith(input);
    });

    test('✅ 能够自动选择可用嵌入器', async () => {
      // Test with default provider available
      const selectedProvider = await embedderFactory.autoSelectProvider();
      expect(typeof selectedProvider).toBe('string');
      expect(['openai', 'ollama']).toContain(selectedProvider);
    });
  });

  describe('工厂功能测试', () => {
    test('✅ 能够获取默认提供者', () => {
      const defaultProvider = embedderFactory.getDefaultProvider();
      expect(typeof defaultProvider).toBe('string');
      expect(['openai', 'ollama']).toContain(defaultProvider);
    });

    test('✅ 能够获取可用的提供者列表', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(true);
      mockOllamaEmbedder.isAvailable.mockResolvedValue(true);
      
      const availableProviders = await embedderFactory.getAvailableProviders();
      expect(Array.isArray(availableProviders)).toBe(true);
      expect(availableProviders).toContain('openai');
      expect(availableProviders).toContain('ollama');
    });

    test('✅ 能够获取提供者信息', async () => {
      const providerInfo = await embedderFactory.getProviderInfo('openai');
      expect(providerInfo.name).toBe('openai');
      expect(providerInfo.model).toBe('text-embedding-ada-002');
      expect(providerInfo.dimensions).toBe(1536);
      expect(typeof providerInfo.available).toBe('boolean');
    });

    test('✅ 能够注册和注销提供者', () => {
      // Test registering a new provider
      const mockCustomEmbedder = {
        embed: jest.fn(),
        getDimensions: jest.fn().mockReturnValue(512),
        getModelName: jest.fn().mockReturnValue('custom-model'),
        isAvailable: jest.fn().mockResolvedValue(true)
      };
      
      embedderFactory.registerProvider('custom', mockCustomEmbedder);
      expect(embedderFactory.isProviderRegistered('custom')).toBe(true);
      
      // Test unregistering provider
      const unregistered = embedderFactory.unregisterProvider('custom');
      expect(unregistered).toBe(true);
      expect(embedderFactory.isProviderRegistered('custom')).toBe(false);
    });
  });

  describe('性能验收标准', () => {
    test('✅ 嵌入生成响应时间 < 10秒', async () => {
      const input = { text: 'test text for performance testing' };
      const mockResult = {
        vector: Array(1536).fill(0.5),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: 100
      };
      
      mockOpenAIEmbedder.embed.mockResolvedValue(mockResult);
      
      const startTime = Date.now();
      await embedderFactory.embed(input, 'openai');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(10000); // 10秒 = 10000毫秒
    });

    test('✅ 并发处理能力 ≥ 5个请求', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        text: `test text ${i}`
      }));
      
      const mockResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: 100
      };
      
      mockOpenAIEmbedder.embed.mockResolvedValue(mockResult);
      
      // Create multiple concurrent requests
      const promises = inputs.map(input => embedderFactory.embed(input, 'openai'));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual(mockResult);
      });
      
      // Verify all requests were processed
      expect(mockOpenAIEmbedder.embed).toHaveBeenCalledTimes(5);
    });
  });
});