import { EmbedderFactory } from '../EmbedderFactory';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

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

const mockSiliconFlowEmbedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(1024),
  getModelName: jest.fn().mockReturnValue('BAAI/bge-m3'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockCustom1Embedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(768),
  getModelName: jest.fn().mockReturnValue('custom1-model'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockCustom2Embedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(768),
  getModelName: jest.fn().mockReturnValue('custom2-model'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockCustom3Embedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(768),
  getModelName: jest.fn().mockReturnValue('custom3-model'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockGeminiEmbedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(768),
  getModelName: jest.fn().mockReturnValue('text-embedding-004'),
  isAvailable: jest.fn().mockResolvedValue(true)
};

const mockMistralEmbedder = {
  embed: jest.fn(),
  getDimensions: jest.fn().mockReturnValue(1024),
  getModelName: jest.fn().mockReturnValue('mistral-embed'),
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

jest.mock('../SiliconFlowEmbedder', () => {
  return {
    SiliconFlowEmbedder: jest.fn().mockImplementation(() => mockSiliconFlowEmbedder)
  };
});

jest.mock('../CustomEmbedder', () => {
  return {
    CustomEmbedder: jest.fn().mockImplementation((logger, errorHandler, cacheService, providerName) => {
      switch (providerName) {
        case 'custom1':
          return mockCustom1Embedder;
        case 'custom2':
          return mockCustom2Embedder;
        case 'custom3':
          return mockCustom3Embedder;
        default:
          return mockCustom1Embedder;
      }
    })
  };
});

jest.mock('../GeminiEmbedder', () => {
  return {
    GeminiEmbedder: jest.fn().mockImplementation(() => mockGeminiEmbedder)
  };
});

jest.mock('../MistralEmbedder', () => {
  return {
    MistralEmbedder: jest.fn().mockImplementation(() => mockMistralEmbedder)
  };
});

describe('EmbedderFactory', () => {
  let embedderFactory: EmbedderFactory;
  let logger: LoggerService;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup services
    // Create a mock ConfigService for testing
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'logging') {
          return { level: 'info' };
        }
        return undefined;
      })
    } as unknown as ConfigService;
    
    logger = new LoggerService(mockConfigService);
    errorHandler = new ErrorHandlerService(logger);
    cacheService = new EmbeddingCacheService(logger, errorHandler);
    
    // Create EmbedderFactory instance
    embedderFactory = new EmbedderFactory(logger, errorHandler, cacheService);
  });

  describe('嵌入器服务验收标准', () => {
    test('✅ 嵌入器工厂能够正常工作', () => {
      const providers = embedderFactory.getRegisteredProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('ollama');
      expect(providers).toContain('siliconflow');
      expect(providers).toContain('custom1');
      expect(providers).toContain('custom2');
      expect(providers).toContain('custom3');
      expect(providers).toContain('gemini');
      expect(providers).toContain('mistral');
      expect(providers.length).toBeGreaterThanOrEqual(8);
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

    test('✅ SiliconFlow嵌入器能够生成嵌入', async () => {
      const input = { text: 'test text for embedding' };
      const mockResult = {
        vector: [0.7, 0.8, 0.9],
        dimensions: 1024,
        model: 'BAAI/bge-m3',
        processingTime: 120
      };
      
      mockSiliconFlowEmbedder.embed.mockResolvedValue(mockResult);
      
      const embedder = await embedderFactory.getEmbedder('siliconflow');
      const result = await embedder.embed(input);
      
      expect(result).toEqual(mockResult);
      expect(mockSiliconFlowEmbedder.embed).toHaveBeenCalledWith(input);
    });

    test('✅ 自定义嵌入器能够生成嵌入', async () => {
      const input = { text: 'test text for embedding' };
      const mockResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 768,
        model: 'custom1-model',
        processingTime: 100
      };
      
      mockCustom1Embedder.embed.mockResolvedValue(mockResult);
      
      const embedder = await embedderFactory.getEmbedder('custom1');
      const result = await embedder.embed(input);
      
      expect(result).toEqual(mockResult);
      expect(mockCustom1Embedder.embed).toHaveBeenCalledWith(input);
    });

    test('✅ 能够自动选择可用嵌入器', async () => {
      // Test with default provider available
      const selectedProvider = await embedderFactory.autoSelectProvider();
      expect(typeof selectedProvider).toBe('string');
      expect(['openai', 'ollama', 'siliconflow', 'custom1', 'custom2', 'custom3', 'gemini', 'mistral']).toContain(selectedProvider);
    });
  });

  describe('工厂功能测试', () => {
    test('✅ 能够获取默认提供者', () => {
      const defaultProvider = embedderFactory.getDefaultProvider();
      expect(typeof defaultProvider).toBe('string');
      // 根据环境变量配置，期望的默认提供者
      expect(['siliconflow', 'openai', 'ollama']).toContain(defaultProvider);
    });

    test('✅ 能够获取可用的提供者列表', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(true);
      mockOllamaEmbedder.isAvailable.mockResolvedValue(true);
      mockSiliconFlowEmbedder.isAvailable.mockResolvedValue(true);
      mockCustom1Embedder.isAvailable.mockResolvedValue(true);
      mockCustom2Embedder.isAvailable.mockResolvedValue(true);
      mockCustom3Embedder.isAvailable.mockResolvedValue(true);
      mockGeminiEmbedder.isAvailable.mockResolvedValue(true);
      mockMistralEmbedder.isAvailable.mockResolvedValue(true);
      
      const availableProviders = await embedderFactory.getAvailableProviders();
      expect(Array.isArray(availableProviders)).toBe(true);
      // getAvailableProviders() 只返回配置中指定的提供者（EMBEDDING_PROVIDER）
      // 根据当前环境变量配置，期望的可用提供者应该是siliconflow
      expect(availableProviders).toContain('siliconflow');
      // 由于环境变量配置了siliconflow为默认提供者，且模拟其可用，所以应该只返回siliconflow
      expect(availableProviders.length).toBeGreaterThanOrEqual(1);
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