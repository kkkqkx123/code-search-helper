import { SemanticSearchService } from '../SemanticSearchService';
import { BaseEmbedder } from '../../../embedders/BaseEmbedder';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { VectorStorageService } from '../../storage/vector/VectorStorageService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { CacheManager } from '../../cache/CacheManager';

describe('SemanticSearchService', () => {
  let semanticSearchService: SemanticSearchService;
  let mockEmbedder: jest.Mocked<BaseEmbedder>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockVectorStorage: jest.Mocked<VectorStorageService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockCacheManager: jest.Mocked<CacheManager>;

  beforeEach(() => {
    // Create mocks
    mockEmbedder = {
      embed: jest.fn(),
      embedBatch: jest.fn(),
      getDimensions: jest.fn().mockReturnValue(384),
      getModelName: jest.fn().mockReturnValue('test-model'),
      isAvailable: jest.fn().mockResolvedValue(true),
    } as any;

    mockEmbedderFactory = {
      getEmbedder: jest.fn().mockResolvedValue(mockEmbedder),
      createEmbedder: jest.fn().mockReturnValue(mockEmbedder),
      getAvailableEmbedders: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getEmbeddingConfig: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 384,
        batchSize: 100,
      }),
      getSearchConfig: jest.fn().mockReturnValue({
        maxResults: 50,
        scoreThreshold: 0.1,
        enableReranking: true,
      }),
    } as any;

    mockVectorStorage = {
      searchVectors: jest.fn(),
      storeVectors: jest.fn(),
      deleteVectors: jest.fn(),
      getVector: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
      classifyError: jest.fn(),
      createErrorContext: jest.fn(),
    } as any;

    // Create mock cache object
    const mockCache = {
      get: jest.fn().mockResolvedValue(null), // Default to cache miss
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      clear: jest.fn(),
      getSearchCache: jest.fn().mockResolvedValue(mockCache),
    } as any;

    // Mock setInterval to prevent hanging
    jest.useFakeTimers();

    // Create service instance directly with mocked dependencies
    semanticSearchService = new SemanticSearchService(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockEmbedderFactory,
      mockVectorStorage,
      mockCacheManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('searchSimilar', () => {
    it('should search for similar code using embeddings', async () => {
      const content = 'function to authenticate user';
      const params = {
        projectId: 'test-project',
        limit: 10,
        threshold: 0.7,
      };

      const queryEmbedding = { vector: [0.1, 0.2, 0.3, 0.4], dimensions: 384, model: 'test-model' };
      const searchResults = [
        {
          id: '1',
          score: 0.95,
          content:
            'function authenticateUser(username, password) { return bcrypt.compare(password, user.hash); }',
          filePath: '/src/auth.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
        {
          id: '2',
          score: 0.85,
          content:
            'async function login(credentials) { const user = await authenticate(credentials); }',
          filePath: '/src/login.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({
        vector: [0.1, 0.2, 0.3, 0.4],
        dimensions: 384,
        model: 'test-model',
        processingTime: 100,
      });
      mockVectorStorage.searchVectors.mockResolvedValue(searchResults as any);

      // Mock the internal enhanceResults method to return simple results
      jest.spyOn(semanticSearchService as any, 'enhanceResults').mockResolvedValue([
        {
          id: '1',
          score: 0.9,
          similarity: 0.9,
          filePath: '/src/auth.ts',
          content:
            'function authenticateUser(username, password) { return bcrypt.compare(password, user.hash); }',
          startLine: 1,
          endLine: 2,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.9,
            contextualScore: 0.8,
            recencyScore: 0.9,
            popularityScore: 0.7,
            finalScore: 0.9,
          },
        },
        {
          id: '2',
          score: 0.85,
          similarity: 0.85,
          filePath: '/src/login.ts',
          content:
            'async function login(credentials) { const user = await authenticate(credentials); }',
          startLine: 1,
          endLine: 2,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.85,
            contextualScore: 0.8,
            recencyScore: 0.9,
            popularityScore: 0.7,
            finalScore: 0.85,
          },
        },
      ]);

      const result = await semanticSearchService.searchSimilar(content, params);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThan(0.8);
      expect(result[0].content).toContain('authenticateUser');
      expect(mockEmbedderFactory.getEmbedder).toHaveBeenCalled();
      expect(mockVectorStorage.searchVectors).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4],
        expect.objectContaining({
          limit: params.limit,
          scoreThreshold: params.threshold,
          filter: { projectId: params.projectId },
        })
      );
    });

    it('should handle embedding failures gracefully', async () => {
      const content = 'test query';
      const params = {
        projectId: 'test-project',
        limit: 10,
        threshold: 0.7,
      };

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockRejectedValue(new Error('Embedding failed'));

      await expect(semanticSearchService.searchSimilar(content, params)).rejects.toThrow();
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should filter results below score threshold', async () => {
      const content = 'test function';
      const params = {
        projectId: 'test-project',
        limit: 10,
        threshold: 0.8,
      };

      const queryEmbedding = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 384,
        model: 'test-model',
        processingTime: 100,
      };
      const searchResults = [
        {
          id: '1',
          score: 0.95,
          content: 'high score result',
          filePath: '/src/test.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
        {
          id: '2',
          score: 0.75,
          content: 'low score result',
          filePath: '/src/test.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
        {
          id: '3',
          score: 0.9,
          content: 'medium score result',
          filePath: '/src/test.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockVectorStorage.searchVectors.mockResolvedValue(searchResults as any);

      const result = await semanticSearchService.searchSimilar(content, params);

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result.every(r => r.score >= 0.8)).toBe(true);
    });
  });

  describe('search', () => {
    it('should perform semantic search with parameters', async () => {
      const params = {
        query: 'database connection',
        projectId: 'test-project',
        limit: 10,
        threshold: 0.7,
        filters: {
          language: ['javascript', 'typescript'],
          chunkType: ['function'],
        },
      };

      const queryEmbedding = {
        vector: [0.1, 0.2, 0.3, 0.4],
        dimensions: 384,
        model: 'test-model',
        processingTime: 100,
      };
      const searchResults = [
        {
          id: '1',
          score: 0.95,
          content: 'function connectToDatabase() { return new Connection(config); }',
          filePath: '/src/database.ts',
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockVectorStorage.searchVectors.mockResolvedValue(searchResults as any);

      // Mock the enhanceResults method to return enhanced results
      jest.spyOn(semanticSearchService as any, 'enhanceResults').mockResolvedValue([
        {
          id: '1',
          score: 0.95,
          similarity: 0.95,
          filePath: '/src/database.ts',
          content: 'function connectToDatabase() { return new Connection(config); }',
          startLine: 1,
          endLine: 2,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.95,
            contextualScore: 0.9,
            recencyScore: 0.9,
            popularityScore: 0.8,
            finalScore: 0.95,
          },
        },
      ]);

      // Mock Date.now to simulate execution time
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 1000; // Start time
        if (callCount === 2) return 1100; // After embedding
        if (callCount === 3) return 1200; // After search
        if (callCount === 4) return 1300; // After ranking
        return 1400; // End time
      });

      const result = await semanticSearchService.search(params);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeGreaterThan(0.8);
      expect(result.results[0].content).toContain('connectToDatabase');
      expect(result.metrics.queryId).toBeDefined();
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(mockVectorStorage.searchVectors).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4],
        expect.objectContaining({
          limit: params.limit,
          scoreThreshold: params.threshold,
          filter: expect.objectContaining({
            language: ['javascript', 'typescript'],
            chunkType: ['function'],
          }),
        })
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('searchByConcept', () => {
    it('should search by concept with context', async () => {
      const concept = 'authentication';
      const params = {
        projectId: 'test-project',
        limit: 5,
        context: 'security',
      };

      const mockSearchResults = {
        results: [
          {
            id: '1',
            score: 0.85,
            similarity: 0.85,
            filePath: '/src/auth.ts',
            content: 'function authenticateUser() { }',
            startLine: 10,
            endLine: 15,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
            rankingFactors: {
              semanticScore: 0.85,
              contextualScore: 0.8,
              recencyScore: 0.9,
              popularityScore: 0.7,
              finalScore: 0.85,
            },
          },
        ],
        metrics: {
          queryId: 'test-query-id',
          executionTime: 100,
          embeddingTime: 50,
          searchTime: 30,
          rankingTime: 20,
          totalResults: 1,
          averageSimilarity: 0.85,
          searchStrategy: 'semantic_vector',
        },
      };

      jest.spyOn(semanticSearchService, 'search').mockResolvedValue(mockSearchResults);

      const result = await semanticSearchService.searchByConcept(concept, params);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('authenticateUser');
      expect(semanticSearchService.search).toHaveBeenCalledWith({
        query: 'login security authorization user password security',
        projectId: params.projectId,
        limit: params.limit,
        threshold: 0.6,
      });
    });
  });

  describe('searchSnippets', () => {
    it('should search for code snippets', async () => {
      const params = {
        query: 'error handling',
        projectId: 'test-project',
        limit: 5,
        threshold: 0.7,
        snippetType: ['try_catch', 'error_handling'],
      };

      const queryEmbedding = {
        vector: [0.1, 0.2, 0.3, 0.4],
        dimensions: 384,
        model: 'test-model',
        processingTime: 100,
      };
      const searchResults = [
        {
          id: '1',
          score: 0.95,
          content: 'try { process(); } catch (error) { handleError(error); }',
          filePath: '/src/utils.ts',
          language: 'typescript',
          chunkType: 'snippet',
          metadata: { snippetType: 'try_catch' },
        },
      ];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockVectorStorage.searchVectors.mockResolvedValue(searchResults as any);

      // Mock the enhanceResults method to return enhanced results
      jest.spyOn(semanticSearchService as any, 'enhanceResults').mockResolvedValue([
        {
          id: '1',
          score: 0.95,
          similarity: 0.95,
          filePath: '/src/utils.ts',
          content: 'try { process(); } catch (error) { handleError(error); }',
          startLine: 1,
          endLine: 2,
          language: 'typescript',
          chunkType: 'snippet',
          metadata: { snippetType: 'try_catch' },
          rankingFactors: {
            semanticScore: 0.95,
            contextualScore: 0.9,
            recencyScore: 0.9,
            popularityScore: 0.8,
            finalScore: 0.95,
          },
        },
      ]);

      const result = await semanticSearchService.searchSnippets(params);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('try');
      expect(result[0].chunkType).toBe('snippet');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should provide search suggestions based on query', async () => {
      const query = 'auth';
      const params = {
        projectId: 'test-project',
        limit: 5,
      };

      const suggestions = await semanticSearchService.getSearchSuggestions(query, params);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('suggestion');
      expect(suggestions[0]).toHaveProperty('confidence');
      expect(suggestions[0]).toHaveProperty('category');
      expect(['term', 'concept', 'pattern', 'code']).toContain(suggestions[0].category);
    });

    it('should return limited suggestions based on limit parameter', async () => {
      const query = 'database';
      const params = {
        projectId: 'test-project',
        limit: 2,
      };

      const suggestions = await semanticSearchService.getSearchSuggestions(query, params);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getSemanticSearchStats', () => {
    it('should return semantic search statistics', async () => {
      const stats = await semanticSearchService.getSemanticSearchStats();

      expect(stats).toHaveProperty('totalSearches');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('averageResults');
      expect(stats).toHaveProperty('topConcepts');
      expect(Array.isArray(stats.topConcepts)).toBe(true);
      expect(stats.topConcepts[0]).toHaveProperty('concept');
      expect(stats.topConcepts[0]).toHaveProperty('searchCount');
    });
  });
});
