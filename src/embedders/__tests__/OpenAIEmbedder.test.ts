import { OpenAIEmbedder } from '../OpenAIEmbedder';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { LoggerService } from '../../utils/LoggerService';
import { Logger } from '../../utils/logger';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('OpenAIEmbedder', () => {
  let openAIEmbedder: OpenAIEmbedder;
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
    
    // Create OpenAIEmbedder instance
    openAIEmbedder = new OpenAIEmbedder(loggerInstance, errorHandler, cacheService);
  });

  describe('嵌入器服务验收标准', () => {
    test('✅ OpenAI嵌入器能够生成嵌入', async () => {
      const input = { text: 'test text for embedding' };
      const mockResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
            index: 0
          }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const result = await openAIEmbedder.embed(input);
      
      // Check if result is an array and handle accordingly
      if (Array.isArray(result)) {
        expect(result[0].vector).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
        expect(result[0].dimensions).toBe(5);
        expect(result[0].model).toBe('text-embedding-ada-002');
      } else {
        expect(result.vector).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
        expect(result.dimensions).toBe(5);
        expect(result.model).toBe('text-embedding-ada-002');
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            input: ['test text for embedding'],
            model: 'text-embedding-ada-002'
          })
        })
      );
    });
  });

  describe('可用性检查', () => {
    test('✅ 能够检查OpenAI服务可用性', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: []
        })
      });
      
      const isAvailable = await openAIEmbedder.isAvailable();
      expect(isAvailable).toBe(true);
    });

    test('✅ 当API密钥未配置时返回不可用', async () => {
      // Temporarily clear the API key
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const isAvailable = await openAIEmbedder.isAvailable();
      expect(isAvailable).toBe(false);
      
      // Restore the API key
      if (originalApiKey) {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });
  });

  describe('模型信息', () => {
    test('✅ 能够获取模型维度', () => {
      const dimensions = openAIEmbedder.getDimensions();
      expect(dimensions).toBe(1536); // Default dimension
    });

    test('✅ 能够获取模型名称', () => {
      const modelName = openAIEmbedder.getModelName();
      expect(modelName).toBe('text-embedding-ada-002'); // Default model
    });
  });

  describe('性能验收标准', () => {
    test('✅ 嵌入生成响应时间 < 10秒', async () => {
      const input = { text: 'test text for performance testing' };
      const mockResponse = {
        data: [
          {
            embedding: Array(1536).fill(0.5),
            index: 0
          }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const startTime = Date.now();
      await openAIEmbedder.embed(input);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(10000); // 10秒 = 10000毫秒
    });

    test('✅ 并发处理能力 ≥ 5个请求', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        text: `test text ${i}`
      }));
      
      const mockResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
            index: 0
          }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });
      
      // Create multiple concurrent requests
      const promises = inputs.map(input => openAIEmbedder.embed(input));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        // Check if result is an array and handle accordingly
        if (Array.isArray(result)) {
          expect(result[0].vector).toEqual([0.1, 0.2, 0.3]);
        } else {
          expect(result.vector).toEqual([0.1, 0.2, 0.3]);
        }
      });
      
      // Verify all requests were processed
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('错误处理', () => {
    test('✅ 能够处理API错误', async () => {
      const input = { text: 'test text for error handling' };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('API Error')
      });
      
      await expect(openAIEmbedder.embed(input)).rejects.toThrow();
    });

    test('✅ 能够处理网络错误', async () => {
      const input = { text: 'test text for network error' };
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(openAIEmbedder.embed(input)).rejects.toThrow();
    });
  });
});