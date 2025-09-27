import { ResultFormatter } from '../ResultFormatter';
import { GraphAnalysisResult } from '../../graph/GraphService';
import { QueryResult } from '../QueryCoordinationService';

// Mock services
const mockConfigService = {
  get: jest.fn().mockReturnValue({}),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn().mockResolvedValue({
    type: 'handled',
    suggestions: ['Try again'],
  }),
};

const mockCache = {
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  delete: jest.fn(),
  clear: jest.fn(),
  size: jest.fn().mockReturnValue(0),
};

const mockConfigLoader = {
  loadConfig: jest.fn().mockReturnValue({
    profiles: {
      openai: {
        format: 'json',
        includeMetadata: true,
        maxTokens: 4000,
        structuredOutput: true,
      },
      claude: {
        format: 'markdown',
        includeMetadata: false,
        maxTokens: 8000,
        structuredOutput: false,
      },
      anthropic: {
        format: 'json',
        includeMetadata: true,
        maxTokens: 2000,
        structuredOutput: true,
      },
      custom: {
        format: 'json',
        includeMetadata: true,
        maxTokens: 4000,
        structuredOutput: true,
      },
    },
    defaults: {
      provider: 'openai',
      format: 'json',
      includeMetadata: true,
      maxTokens: 4000,
      structuredOutput: true,
    },
    formatting: {
      entityExtraction: {
        confidenceThreshold: 0.7,
        maxEntities: 100,
        includeRelationships: true,
      },
      summaryGeneration: {
        maxLength: 500,
        includeStatistics: true,
        includeRecommendations: true,
      },
      suggestionGeneration: {
        maxSuggestions: 5,
        includeCodeSmells: true,
        includeRefactoringTips: true,
      },
    },
    performance: {
      caching: {
        enabled: true,
        ttl: 300,
        maxCacheSize: 1000,
      },
      memory: {
        maxResultSize: 1000000,
        streamResults: true,
      },
      rateLimiting: {
        maxRequestsPerSecond: 10,
        burstLimit: 20,
      },
    },
  }),
};

const mockMetricsService = {
  recordAlert: jest.fn(),
  getMetricsEndpoint: jest.fn().mockReturnValue('/metrics'),
};

describe('ResultFormatter', () => {
  let resultFormatter: ResultFormatter;

  beforeEach(() => {
    resultFormatter = new ResultFormatter(
      mockConfigService as any,
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockCache as any,
      mockConfigLoader as any,
      mockMetricsService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('formatForLLM', () => {
    it('should format GraphAnalysisResult correctly', async () => {
      const mockGraphResult: GraphAnalysisResult = {
        nodes: [
          {
            id: 'node1',
            label: 'File1',
            properties: { path: 'src/file1.ts' },
            type: 'file',
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            type: 'imports',
            properties: {},
          },
        ],
        metrics: {
          totalNodes: 1,
          totalEdges: 1,
          averageDegree: 1,
          maxDepth: 2,
          componentCount: 1,
        },
        summary: {
          projectFiles: 1,
          functions: 0,
          classes: 0,
          imports: 1,
          externalDependencies: 0,
        },
      };

      const result = await resultFormatter.formatForLLM(mockGraphResult);

      expect(result.status).toBe('success');
      expect(result.data.structured).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.meta.tool).toBe('graph_analysis');
      expect(result.meta.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should format QueryResult array correctly', async () => {
      const mockQueryResults: QueryResult[] = [
        {
          id: 'result1',
          score: 0.95,
          filePath: 'src/file1.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const result = await resultFormatter.formatForLLM(mockQueryResults);

      expect(result.status).toBe('success');
      expect(result.data.structured).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.meta.tool).toBe('query_search');
      expect(result.meta.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should handle single QueryResult correctly', async () => {
      const mockQueryResult: QueryResult = {
        id: 'result1',
        score: 0.95,
        filePath: 'src/file1.ts',
        content: 'function test() {}',
        startLine: 1,
        endLine: 1,
        language: 'typescript',
        chunkType: 'function',
        metadata: {},
      };

      const result = await resultFormatter.formatForLLM(mockQueryResult);

      expect(result.status).toBe('success');
      expect(result.data.structured).toBeDefined();
      expect(result.meta.tool).toBe('generic_tool');
      expect(result.meta.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in the formatting process
      jest.spyOn(resultFormatter as any, 'extractStructuredData').mockImplementation(() => {
        throw new Error('Test error');
      });

      const mockQueryResults: QueryResult[] = [
        {
          id: 'result1',
          score: 0.95,
          filePath: 'src/file1.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const result = await resultFormatter.formatForLLM(mockQueryResults);

      expect(result.status).toBe('error');
      expect(result.data.message).toBe('Test error');
      expect(result.meta.tool).toBe('query_search');
    });
  });

  describe('extractStructuredData', () => {
    it('should extract structured data from GraphAnalysisResult', () => {
      const mockGraphResult: GraphAnalysisResult = {
        nodes: [
          {
            id: 'node1',
            label: 'File1',
            properties: { path: 'src/file1.ts' },
            type: 'file',
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            type: 'imports',
            properties: {},
          },
        ],
        metrics: {
          totalNodes: 1,
          totalEdges: 1,
          averageDegree: 1,
          maxDepth: 2,
          componentCount: 1,
        },
        summary: {
          projectFiles: 1,
          functions: 0,
          classes: 0,
          imports: 1,
          externalDependencies: 0,
        },
      };

      const structuredData = (resultFormatter as any).extractStructuredData(mockGraphResult);

      expect(structuredData.entities).toHaveLength(1);
      expect(structuredData.entities[0].id).toBe('node1');
      expect(structuredData.entities[0].type).toBe('file');
    });

    it('should extract structured data from QueryResult array', () => {
      const mockQueryResults: QueryResult[] = [
        {
          id: 'result1',
          score: 0.95,
          filePath: 'src/file1.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const structuredData = (resultFormatter as any).extractStructuredData(mockQueryResults);

      expect(structuredData.entities).toHaveLength(1);
      expect(structuredData.entities[0].id).toBe('result1');
      expect(structuredData.entities[0].type).toBe('code_chunk');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for GraphAnalysisResult', () => {
      const mockGraphResult: GraphAnalysisResult = {
        nodes: [
          {
            id: 'node1',
            label: 'File1',
            properties: { path: 'src/file1.ts' },
            type: 'file',
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            type: 'imports',
            properties: {},
          },
        ],
        metrics: {
          totalNodes: 1,
          totalEdges: 1,
          averageDegree: 1,
          maxDepth: 2,
          componentCount: 1,
        },
        summary: {
          projectFiles: 1,
          functions: 0,
          classes: 0,
          imports: 1,
          externalDependencies: 0,
        },
      };

      const summary = (resultFormatter as any).generateSummary(mockGraphResult);

      expect(summary.executiveSummary).toContain('Analyzed codebase structure');
      expect(summary.statistics.totalNodes).toBe(1);
      expect(summary.statistics.totalEdges).toBe(1);
    });

    it('should generate summary for QueryResult array', () => {
      const mockQueryResults: QueryResult[] = [
        {
          id: 'result1',
          score: 0.95,
          filePath: 'src/file1.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const summary = (resultFormatter as any).generateSummary(mockQueryResults);

      expect(summary.executiveSummary).toContain('Found 1 relevant code segments');
      expect(summary.statistics.resultCount).toBe(1);
    });
  });

  describe('provideSuggestions', () => {
    it('should provide suggestions for GraphAnalysisResult with issues', () => {
      const mockGraphResult: any = {
        metrics: {
          totalNodes: 5,
          totalEdges: 15,
          averageDegree: 10,
          maxDepth: 3,
          componentCount: 1,
        },
        summary: {
          projectFiles: 5,
          functions: 10,
          classes: 3,
          imports: 15,
          externalDependencies: 15,
        },
        nodes: [],
        edges: [],
      };

      const suggestions = (resultFormatter as any).provideSuggestions(mockGraphResult);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain(
        'Highly connected components detected, consider modularization'
      );
      expect(suggestions).toContain(
        'Large number of external dependencies, review for security and maintenance'
      );
    });

    it('should provide suggestions for QueryResult array with issues', () => {
      const mockQueryResults: QueryResult[] = [
        {
          id: 'result1',
          score: 0.3,
          filePath: 'src/file1.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
        {
          id: 'result2',
          score: 0.2,
          filePath: 'src/file2.py',
          content: 'def test(): pass',
          startLine: 1,
          endLine: 1,
          language: 'python',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const suggestions = (resultFormatter as any).provideSuggestions(mockQueryResults);

      expect(suggestions).toContain(
        'Results span multiple languages, ensure cross-language consistency'
      );
      expect(suggestions).toContain('Low average relevance score, consider refining your query');
    });
  });
});
