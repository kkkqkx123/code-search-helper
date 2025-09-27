import { RerankingService } from '../RerankingService';
import { QueryResult } from '../../query/QueryCoordinationService';

// Mock dependencies
const mockConfigService = {
  get: jest.fn().mockReturnValue({}),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockGraphStorage = {
  searchNodes: jest.fn().mockResolvedValue([]),
};

const mockSemanticSearch = {
  search: jest.fn().mockResolvedValue({ results: [], metrics: { executionTime: 0 } }),
};

describe('RerankingService', () => {
  let rerankingService: RerankingService;

  beforeEach(() => {
    rerankingService = new RerankingService(
      mockConfigService as any,
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockGraphStorage as any,
      mockSemanticSearch as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rerank', () => {
    const mockResults: QueryResult[] = [
      {
        id: '1',
        score: 0.8,
        filePath: '/src/file1.ts',
        content: 'function test() { return true; }',
        startLine: 1,
        endLine: 3,
        language: 'typescript',
        chunkType: 'function',
        metadata: {},
      },
      {
        id: '2',
        score: 0.6,
        filePath: '/src/file2.ts',
        content: 'class TestClass { }',
        startLine: 1,
        endLine: 2,
        language: 'typescript',
        chunkType: 'class',
        metadata: {},
      },
    ];

    it('should rerank results using hybrid strategy by default', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query');

      expect(reranked).toHaveLength(2);
      expect(reranked[0]).toHaveProperty('rerankingMetrics');
      expect(reranked[0].rerankingMetrics.finalScore).toBeGreaterThanOrEqual(0);
      expect(reranked[0].rerankingMetrics.finalScore).toBeLessThanOrEqual(1);
    });

    it('should rerank results using semantic strategy', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query', {
        strategy: 'semantic',
      });

      expect(reranked).toHaveLength(2);
      expect(reranked[0]).toHaveProperty('rerankingMetrics');
    });

    it('should rerank results using graph strategy', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query', {
        strategy: 'graph',
      });

      expect(reranked).toHaveLength(2);
      expect(reranked[0]).toHaveProperty('rerankingMetrics');
    });

    it('should rerank results using ml strategy', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query', { strategy: 'ml' });

      expect(reranked).toHaveLength(2);
      expect(reranked[0]).toHaveProperty('rerankingMetrics');
    });

    it('should apply limit to results', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query', { limit: 1 });

      expect(reranked).toHaveLength(1);
    });

    it('should apply threshold to results', async () => {
      const reranked = await rerankingService.rerank(mockResults, 'test query', { threshold: 0.9 });

      // All results should be filtered out as they're below the threshold
      expect(reranked).toHaveLength(0);
    });
  });

  describe('getRerankingStats', () => {
    it('should return reranking statistics', async () => {
      // Perform some reranking operations first
      const mockResults: QueryResult[] = [
        {
          id: '1',
          score: 0.8,
          filePath: '/src/file1.ts',
          content: 'function test() { return true; }',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      await rerankingService.rerank(mockResults, 'test query');

      const stats = await rerankingService.getRerankingStats();

      expect(stats.totalRerankings).toBeGreaterThan(0);
      expect(stats.strategyDistribution).toBeDefined();
    });
  });
});
