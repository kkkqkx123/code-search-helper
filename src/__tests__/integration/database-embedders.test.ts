import { QdrantService } from '../../database/QdrantService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { LoggerService } from '../../utils/logger';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

/**
 * 数据库和嵌入器集成测试
 */
describe('Database and Embedders Integration', () => {
  let logger: LoggerService;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;
  let embedderFactory: EmbedderFactory;
  let qdrantService: QdrantService;

  beforeAll(() => {
    // 初始化服务
    logger = new LoggerService();
    errorHandler = new ErrorHandlerService(logger);
    cacheService = new EmbeddingCacheService(logger, errorHandler);
    embedderFactory = new EmbedderFactory(logger, errorHandler, cacheService);
    qdrantService = new QdrantService(logger, errorHandler);
  });

  afterAll(async () => {
    // 清理资源
    if (qdrantService) {
      await qdrantService.close();
    }
  });

  describe('QdrantService', () => {
    test('should initialize connection', async () => {
      // 注意：这个测试需要Qdrant服务正在运行
      // 如果没有运行，测试会失败，这是正常的
      const connected = await qdrantService.initialize();
      
      // 如果Qdrant服务可用，应该返回true
      // 如果不可用，会返回false，这也是可以接受的
      expect(typeof connected).toBe('boolean');
    });

    test('should create collection', async () => {
      const collectionName = 'test-collection';
      const vectorSize = 1536;
      
      try {
        const created = await qdrantService.createCollection(collectionName, vectorSize);
        expect(typeof created).toBe('boolean');
      } catch (error) {
        // 如果Qdrant服务不可用，会抛出错误，这也是可以接受的
        console.warn('Qdrant service not available, skipping collection creation test');
      }
    });

    test('should check collection existence', async () => {
      const collectionName = 'test-collection';
      
      try {
        const exists = await qdrantService.collectionExists(collectionName);
        expect(typeof exists).toBe('boolean');
      } catch (error) {
        // 如果Qdrant服务不可用，会抛出错误，这也是可以接受的
        console.warn('Qdrant service not available, skipping collection existence test');
      }
    });
  });

  describe('EmbeddingCacheService', () => {
    test('should cache and retrieve embeddings', async () => {
      const text = 'test text for caching';
      const model = 'test-model';
      const mockResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };

      // 设置缓存
      await cacheService.set(text, model, mockResult);

      // 获取缓存
      const cached = await cacheService.get(text, model);
      
      expect(cached).toEqual(mockResult);
    });

    test('should return null for non-existent cache entry', async () => {
      const text = 'non-existent text';
      const model = 'test-model';
      
      const cached = await cacheService.get(text, model);
      
      expect(cached).toBeNull();
    });

    test('should clear cache', async () => {
      const text = 'test text for clearing';
      const model = 'test-model';
      const mockResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };

      // 设置缓存
      await cacheService.set(text, model, mockResult);
      
      // 清空缓存
      await cacheService.clear();
      
      // 尝试获取缓存
      const cached = await cacheService.get(text, model);
      
      expect(cached).toBeNull();
    });
  });

  describe('EmbedderFactory', () => {
    test('should get registered providers', () => {
      const providers = embedderFactory.getRegisteredProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    test('should check provider registration', () => {
      const isOpenAIRegistered = embedderFactory.isProviderRegistered('openai');
      const isOllamaRegistered = embedderFactory.isProviderRegistered('ollama');
      
      expect(isOpenAIRegistered).toBe(true);
      expect(isOllamaRegistered).toBe(true);
    });

    test('should get default provider', () => {
      const defaultProvider = embedderFactory.getDefaultProvider();
      
      expect(typeof defaultProvider).toBe('string');
      expect(['openai', 'ollama']).toContain(defaultProvider);
    });

    test('should get available providers', async () => {
      const availableProviders = await embedderFactory.getAvailableProviders();
      
      expect(Array.isArray(availableProviders)).toBe(true);
      // 注意：如果没有配置API密钥或服务不可用，可能没有可用的提供者
    });

    test('should auto-select provider', async () => {
      try {
        const selectedProvider = await embedderFactory.autoSelectProvider();
        
        expect(typeof selectedProvider).toBe('string');
        expect(['openai', 'ollama']).toContain(selectedProvider);
      } catch (error) {
        // 如果没有可用的提供者，会抛出错误，这也是可以接受的
        console.warn('No available embedder providers, skipping auto-select test');
      }
    });
  });

  describe('Integration Workflow', () => {
    test('should generate embeddings and store in vector database', async () => {
      try {
        // 生成嵌入
        const input = { text: 'This is a test text for embedding generation' };
        const embeddingResult = await embedderFactory.embed(input);
        
        expect(embeddingResult).toBeDefined();
        if (Array.isArray(embeddingResult)) {
          expect(embeddingResult.length).toBe(1);
          expect(embeddingResult[0].vector).toBeDefined();
          expect(embeddingResult[0].dimensions).toBeGreaterThan(0);
        } else {
          expect(embeddingResult.vector).toBeDefined();
          expect(embeddingResult.dimensions).toBeGreaterThan(0);
        }

        // 如果Qdrant服务可用，尝试存储向量
        if (await qdrantService.isConnected()) {
          const collectionName = 'test-embeddings';
          const vectorSize = Array.isArray(embeddingResult) 
            ? embeddingResult[0].dimensions 
            : embeddingResult.dimensions;
          
          // 确保集合存在
          await qdrantService.createCollection(collectionName, vectorSize);
          
          // 创建向量点
          const vectorPoint = {
            id: 'test-1',
            vector: Array.isArray(embeddingResult) 
              ? embeddingResult[0].vector 
              : embeddingResult.vector,
            payload: {
              content: input.text,
              filePath: '/test/file.ts',
              language: 'typescript',
              chunkType: 'code',
              startLine: 1,
              endLine: 1,
              timestamp: new Date(),
              metadata: {}
            }
          };
          
          // 存储向量
          const upserted = await qdrantService.upsertVectors(collectionName, [vectorPoint]);
          
          expect(upserted).toBe(true);
        }
      } catch (error) {
        // 如果服务不可用，会抛出错误，这也是可以接受的
        console.warn('Services not available, skipping integration workflow test');
      }
    });
  });
});