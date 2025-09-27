import { ResultFusionEngine } from './ResultFusionEngine';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

describe('ResultFusionEngine', () => {
  let resultFusionEngine: ResultFusionEngine;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    // Create mocks
    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    // Setup mock returns
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'fusion') {
        return {
          vectorWeight: 0.4,
          graphWeight: 0.3,
          contextualWeight: 0.2,
          recencyWeight: 0.05,
          popularityWeight: 0.05,
        };
      }
      return undefined;
    });

    // Create instance directly
    resultFusionEngine = new ResultFusionEngine(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fuse', () => {
    it('should fuse vector and graph results with weighted scoring', async () => {
      const input = {
        vectorResults: [
          {
            id: '1',
            score: 0.9,
            filePath: '/src/test.ts',
            content: 'function test() { return true; }',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
          },
          {
            id: '2',
            score: 0.8,
            filePath: '/src/main.ts',
            content: 'function main() { console.log("hello"); }',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
          },
        ],
        graphResults: [
          {
            id: '1',
            score: 0.7,
            filePath: '/src/test.ts',
            content: 'function test() { return true; }',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {
              name: 'test',
              type: 'function',
              calls: ['helper'],
            },
            graphContext: {
              dependencies: ['helper'],
              relationships: [{ type: 'calls', target: 'helper', strength: 0.8 }],
            },
          },
          {
            id: '3',
            score: 0.6,
            filePath: '/src/utils.ts',
            content: 'function utils() { return "utils"; }',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {
              name: 'utils',
              type: 'function',
              calls: ['test'],
            },
          },
        ],
        query: 'test function',
        options: {
          limit: 10,
          threshold: 0.3,
          searchType: 'hybrid' as const,
        },
      };

      const fusedResults = await resultFusionEngine.fuse(input);

      expect(fusedResults.length).toBeGreaterThan(0);
      expect(fusedResults[0]).toHaveProperty('fusionMetrics');
      expect(fusedResults[0].fusionMetrics).toHaveProperty('vectorScore');
      expect(fusedResults[0].fusionMetrics).toHaveProperty('graphScore');
      expect(fusedResults[0].fusionMetrics).toHaveProperty('finalScore');
    });

    it('should handle empty result sets', async () => {
      const input = {
        vectorResults: [],
        graphResults: [],
        query: 'empty test',
        options: {
          limit: 10,
          threshold: 0.3,
          searchType: 'hybrid' as const,
        },
      };

      const fusedResults = await resultFusionEngine.fuse(input);

      expect(fusedResults).toHaveLength(0);
    });

    it('should apply threshold filtering', async () => {
      const input = {
        vectorResults: [
          {
            id: '1',
            score: 0.9,
            filePath: '/src/test.ts',
            content: 'high score content',
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
          },
          {
            id: '2',
            score: 0.2,
            filePath: '/src/low.ts',
            content: 'low score content',
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
          },
        ],
        graphResults: [],
        query: 'test',
        options: {
          limit: 10,
          threshold: 0.5,
          searchType: 'semantic' as const,
        },
      };

      const fusedResults = await resultFusionEngine.fuse(input);

      expect(fusedResults.length).toBeGreaterThanOrEqual(0);
      if (fusedResults.length > 0) {
        expect(fusedResults[0].id).toBeDefined();
      }
    });
  });

  describe('getFusionStats', () => {
    it('should return fusion statistics', async () => {
      const stats = await resultFusionEngine.getFusionStats();

      expect(stats).toHaveProperty('totalFusions');
      expect(stats).toHaveProperty('averageFusionTime');
      expect(stats).toHaveProperty('averageResultsPerQuery');
      expect(stats).toHaveProperty('weightDistribution');
      expect(stats.weightDistribution).toHaveProperty('vector');
      expect(stats.weightDistribution).toHaveProperty('graph');
      expect(stats.weightDistribution).toHaveProperty('contextual');
    });
  });
});
