import { ChunkFilter } from '../ChunkFilter';
import { LoggerService } from '../../../../../utils/LoggerService';
import { SegmentationContext } from '../../../processing/strategies/types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ChunkFilter', () => {
  let filter: ChunkFilter;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' | 'markdown' | 'standardization' | 'section' | 'content' = 'code'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'javascript',
      filePath: 'test.js',
      type,
      complexity: 1
    }
  });

  // Create mock context
  const createMockContext = (enableFilter = true, minChunkSize = 50, maxChunkSize = 1000): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      enableBracketBalance: true,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: 0.3,
      errorThreshold: 5,
      memoryLimitMB: 500,
      strategyPriorities: {
        'markdown': 1,
        'standardization': 2,
        'semantic': 3,
        'bracket': 4,
        'line': 5
      },
      filterConfig: {
        enableSmallChunkFilter: enableFilter,
        enableChunkRebalancing: true,
        minChunkSize,
        maxChunkSize
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    },
    metadata: {
      contentLength: 12,
      lineCount: 1,
      isSmallFile: true,
      isCodeFile: true,
      isMarkdownFile: false
    }
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    filter = new ChunkFilter(mockLogger);
  });

  describe('process', () => {
    it('should return chunks unchanged when filtering is disabled', async () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2)
      ];
      const context = createMockContext(false);

      const result = await filter.process(chunks, context);

      expect(result).toEqual(chunks);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should filter out small chunks by merging with previous chunk', async () => {
      const chunks = [
        createMockChunk('This is a normal sized chunk that should be kept', 1, 1),
        createMockChunk('Small', 2, 2), // Too small
        createMockChunk('Another normal sized chunk', 3, 3)
      ];
      const context = createMockContext(true, 50);

      const result = await filter.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('This is a normal sized chunk that should be kept\nSmall');
      expect(result[0].metadata.endLine).toBe(2);
      expect(result[1].content).toBe('Another normal sized chunk');
      expect(mockLogger.debug).toHaveBeenCalledWith('Merged small chunk (5 chars) into previous chunk');
    });

    it('should filter out small chunks by merging with next chunk', async () => {
      const chunks = [
        createMockChunk('Small', 1, 1), // Too small
        createMockChunk('This is a normal sized chunk that should be kept', 2, 2),
        createMockChunk('Another normal sized chunk', 3, 3)
      ];
      const context = createMockContext(true, 50);

      const result = await filter.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Small\nThis is a normal sized chunk that should be kept');
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[1].content).toBe('Another normal sized chunk');
      expect(mockLogger.debug).toHaveBeenCalledWith('Merged small chunk (5 chars) into next chunk');
    });

    it('should discard isolated small chunks', async () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Small', 2, 2) // Too small and isolated
      ];
      const context = createMockContext(true, 50);

      const result = await filter.process(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Normal chunk');
      expect(mockLogger.warn).toHaveBeenCalledWith('Discarded small chunk (5 chars): Small...');
    });

    it('should log filtering statistics', async () => {
      const chunks = [
        createMockChunk('Normal chunk 1', 1, 1),
        createMockChunk('Small', 2, 2),
        createMockChunk('Normal chunk 2', 3, 3)
      ];
      const context = createMockContext(true, 50);

      await filter.process(chunks, context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Filtered 3 chunks to 2 valid chunks');
    });
  });

  describe('getName', () => {
    it('should return the processor name', () => {
      expect(filter.getName()).toBe('chunk-filter');
    });
  });

  describe('shouldApply', () => {
    it('should return true when filtering is enabled and chunks need filtering', () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Small', 2, 2) // Too small
      ];
      const context = createMockContext(true, 50);

      expect(filter.shouldApply(chunks, context)).toBe(true);
    });

    it('should return false when filtering is disabled', () => {
      const chunks = [createMockChunk('Normal chunk', 1, 1)];
      const context = createMockContext(false);

      expect(filter.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when no chunks', () => {
      const chunks: CodeChunk[] = [];
      const context = createMockContext(true);

      expect(filter.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when all chunks are valid size', () => {
      const chunks = [
        createMockChunk('Normal chunk 1', 1, 1),
        createMockChunk('Normal chunk 2', 2, 2)
      ];
      const context = createMockContext(true, 50);

      expect(filter.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('advancedFilter', () => {
    it('should filter out low quality chunks', async () => {
      const chunks = [
        createMockChunk('function test() { return 1; }', 1, 3), // High quality
        createMockChunk('   \n   \n   ', 4, 6) // Low quality
      ];
      const context = createMockContext();

      const result = await filter.advancedFilter(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('function test() { return 1; }');
      expect(mockLogger.debug).toHaveBeenCalledWith('Filtered low-quality chunk:    \n   \n   ...');
    });

    it('should keep high quality chunks', async () => {
      const chunks = [
        createMockChunk('function test() { return 1; }', 1, 3),
        createMockChunk('class Test { constructor() {} }', 4, 6)
      ];
      const context = createMockContext();

      const result = await filter.advancedFilter(chunks, context);

      expect(result).toHaveLength(2);
    });
  });

  describe('isHighQualityChunk', () => {
    it('should return false for chunks below minimum size', () => {
      const chunk = createMockChunk('Small', 1, 1);
      const context = createMockContext(true, 50);

      // Access private method through type assertion
      const result = (filter as any).isHighQualityChunk(chunk, context);

      expect(result).toBe(false);
    });

    it('should return true for chunks above quality threshold', () => {
      const chunk = createMockChunk('function test() { return 1; }', 1, 3);
      const context = createMockContext(true, 10);

      // Access private method through type assertion
      const result = (filter as any).isHighQualityChunk(chunk, context);

      expect(result).toBe(true);
    });
  });

  describe('calculateContentQuality', () => {
    it('should calculate quality for code content', () => {
      const content = 'function test() { if (condition) { return 1; } }';
      const language = 'javascript';

      // Access private method through type assertion
      const result = (filter as any).calculateContentQuality(content, language);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should calculate quality for markdown content', () => {
      const content = '# Title\n\n```javascript\nfunction test() { return 1; }\n```\n\n- Item 1\n- Item 2';
      const language = 'markdown';

      // Access private method through type assertion
      const result = (filter as any).calculateContentQuality(content, language);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should penalize content with too many empty lines', () => {
      const content = '\n\n\n\n\nfunction test() { return 1; }\n\n\n\n\n';
      const language = 'javascript';

      // Access private method through type assertion
      const result = (filter as any).calculateContentQuality(content, language);

      expect(result).toBeLessThan(0.5);
    });

    it('should penalize content with too many comments', () => {
      const content = '// Comment 1\n// Comment 2\n// Comment 3\n// Comment 4\n// Comment 5\n// Comment 6\n// Comment 7\n// Comment 8';
      const language = 'javascript';

      // Access private method through type assertion
      const result = (filter as any).calculateContentQuality(content, language);

      expect(result).toBeLessThan(0.5);
    });
  });

  describe('intelligentMerge', () => {
    it('should merge chunks with high similarity', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 1, 'function'),
        createMockChunk('function test2() { return 2; }', 2, 2, 'function')
      ];
      const context = createMockContext();

      const result = await filter.intelligentMerge(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('function test1() { return 1; }');
      expect(result[0].content).toContain('function test2() { return 2; }');
      expect(mockLogger.debug).toHaveBeenCalledWith('Intelligently merged 2 chunks into 1 groups');
    });

    it('should not merge chunks with low similarity', async () => {
      const chunks = [
        createMockChunk('function test() { return 1; }', 1, 1, 'function'),
        createMockChunk('# Title\n\nSome markdown content', 2, 4, 'markdown')
      ];
      const context = createMockContext();

      const result = await filter.intelligentMerge(chunks, context);

      expect(result).toHaveLength(2);
    });

    it('should return chunks unchanged when only one chunk', async () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];
      const context = createMockContext();

      const result = await filter.intelligentMerge(chunks, context);

      expect(result).toEqual(chunks);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate high similarity for chunks with same type and language', () => {
      const chunk1 = createMockChunk('function test() { return 1; }', 1, 1, 'function');
      const chunk2 = createMockChunk('function test2() { return 2; }', 2, 2, 'function');

      // Access private method through type assertion
      const result = (filter as any).calculateSimilarity(chunk1, chunk2);

      expect(result).toBeGreaterThan(0.5); // Type similarity (0.5) + language similarity (0.3)
    });

    it('should calculate low similarity for chunks with different types', () => {
      const chunk1 = createMockChunk('function test() { return 1; }', 1, 1, 'function');
      const chunk2 = createMockChunk('# Title\n\nContent', 2, 4, 'markdown');

      // Access private method through type assertion
      const result = (filter as any).calculateSimilarity(chunk1, chunk2);

      expect(result).toBeLessThan(0.5);
    });
  });

  describe('calculateContentSimilarity', () => {
    it('should calculate high similarity for content with shared keywords', () => {
      const content1 = 'function test() { return value; }';
      const content2 = 'function test2() { return anotherValue; }';

      // Access private method through type assertion
      const result = (filter as any).calculateContentSimilarity(content1, content2);

      expect(result).toBeGreaterThan(0.3);
    });

    it('should calculate zero similarity for content with no shared keywords', () => {
      const content1 = 'function test() { return value; }';
      const content2 = '# Title\n\nSome completely different content';

      // Access private method through type assertion
      const result = (filter as any).calculateContentSimilarity(content1, content2);

      expect(result).toBe(0);
    });

    it('should handle empty content', () => {
      const content1 = '';
      const content2 = 'function test() { return value; }';

      // Access private method through type assertion
      const result = (filter as any).calculateContentSimilarity(content1, content2);

      expect(result).toBe(0);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from content', () => {
      const content = 'function test() { return value; }';

      // Access private method through type assertion
      const result = (filter as any).extractKeywords(content);

      expect(result).toContain('function');
      expect(result).toContain('test');
      expect(result).toContain('return');
      expect(result).toContain('value');
    });

    it('should filter out stop words', () => {
      const content = 'the function test and return value';

      // Access private method through type assertion
      const result = (filter as any).extractKeywords(content);

      expect(result).toContain('function');
      expect(result).toContain('test');
      expect(result).toContain('return');
      expect(result).toContain('value');
      expect(result).not.toContain('the');
      expect(result).not.toContain('and');
    });

    it('should limit keyword count', () => {
      const content = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25';

      // Access private method through type assertion
      const result = (filter as any).extractKeywords(content);

      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe('mergeChunkGroup', () => {
    it('should merge multiple chunks into one', () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2),
        createMockChunk('Chunk 3', 3, 3)
      ];

      // Access private method through type assertion
      const result = (filter as any).mergeChunkGroup(chunks);

      expect(result.content).toBe('Chunk 1\n\nChunk 2\n\nChunk 3');
      expect(result.metadata.startLine).toBe(1);
      expect(result.metadata.endLine).toBe(3);
      expect(result.metadata.complexity).toBe(3); // Sum of all complexities
    });

    it('should return single chunk unchanged', () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];

      // Access private method through type assertion
      const result = (filter as any).mergeChunkGroup(chunks);

      expect(result).toBe(chunks[0]);
    });
  });

  describe('setFilterConfig', () => {
    it('should log configuration update', () => {
      const config = {
        enableSmallChunkFilter: false,
        minChunkSize: 100,
        maxChunkSize: 2000
      };

      filter.setFilterConfig(config);

      expect(mockLogger.debug).toHaveBeenCalledWith('Filter configuration updated', config);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex filtering scenarios', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 3),
        createMockChunk('Small', 4, 4), // Will be merged
        createMockChunk('function test2() { return 2; }', 5, 7),
        createMockChunk('Tiny', 8, 8), // Will be merged
        createMockChunk('class Test { constructor() {} }', 9, 11)
      ];
      const context = createMockContext(true, 50);

      const result = await filter.process(chunks, context);

      expect(result).toHaveLength(3);
      expect(result[0].content).toContain('function test1() { return 1; }\nSmall');
      expect(result[1].content).toContain('function test2() { return 2; }\nTiny');
      expect(result[2].content).toBe('class Test { constructor() {} }');
    });

    it('should work with intelligent merge for similar content', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 1, 'function'),
        createMockChunk('function test2() { return 2; }', 2, 2, 'function'),
        createMockChunk('function test3() { return 3; }', 3, 3, 'function')
      ];
      const context = createMockContext();

      const result = await filter.intelligentMerge(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('function test1() { return 1; }');
      expect(result[0].content).toContain('function test2() { return 2; }');
      expect(result[0].content).toContain('function test3() { return 3; }');
    });
  });
});