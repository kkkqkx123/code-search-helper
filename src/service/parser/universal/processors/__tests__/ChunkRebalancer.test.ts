import { ChunkRebalancer } from '../ChunkRebalancer';
import { LoggerService } from '../../../../../utils/LoggerService';
import { IComplexityCalculator } from '../../types/SegmentationTypes';
import { SegmentationContext } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock IComplexityCalculator
const mockComplexityCalculator: IComplexityCalculator = {
  calculate: jest.fn()
};

describe('ChunkRebalancer', () => {
  let rebalancer: ChunkRebalancer;
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
  const createMockContext = (enableRebalancing = true, minChunkSize = 50, maxChunkSize = 1000): SegmentationContext => ({
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
        enableSmallChunkFilter: false,
        enableChunkRebalancing: enableRebalancing,
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

    (mockComplexityCalculator.calculate as jest.Mock).mockReturnValue(5);

    rebalancer = new ChunkRebalancer(mockComplexityCalculator, mockLogger);
  });

  describe('process', () => {
    it('should return chunks unchanged when rebalancing is disabled', async () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2)
      ];
      const context = createMockContext(false);

      const result = await rebalancer.process(chunks, context);

      expect(result).toEqual(chunks);
    });

    it('should return chunks unchanged when only one chunk', async () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];
      const context = createMockContext();

      const result = await rebalancer.process(chunks, context);

      expect(result).toEqual(chunks);
    });

    it('should merge final small chunk with previous chunk', async () => {
      const chunks = [
        createMockChunk('This is a normal sized chunk', 1, 1),
        createMockChunk('Small', 2, 2) // Too small
      ];
      const context = createMockContext(true, 50);

      const result = await rebalancer.process(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('This is a normal sized chunk\nSmall');
      expect(result[0].metadata.endLine).toBe(2);
      expect(mockComplexityCalculator.calculate).toHaveBeenCalledWith('This is a normal sized chunk\nSmall');
      expect(mockLogger.info).toHaveBeenCalledWith('Rebalanced final small chunk (5 chars) into previous chunk');
    });

    it('should not merge when combined size exceeds max limit', async () => {
      const chunks = [
        createMockChunk('A'.repeat(900), 1, 1),
        createMockChunk('B'.repeat(200), 2, 2) // Small but combined would exceed limit
      ];
      const context = createMockContext(true, 50, 1000);

      const result = await rebalancer.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('A'.repeat(900));
      expect(result[1].content).toBe('B'.repeat(200));
    });

    it('should keep final chunk when it is not too small', async () => {
      const chunks = [
        createMockChunk('This is a normal sized chunk that is above the minimum size', 1, 1),
        createMockChunk('This is another normal sized chunk that is above the minimum size', 2, 2)
      ];
      const context = createMockContext(true, 50);

      const result = await rebalancer.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('This is a normal sized chunk that is above the minimum size');
      expect(result[1].content).toBe('This is another normal sized chunk that is above the minimum size');
    });

    it('should log rebalancing statistics', async () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Small', 2, 2)
      ];
      const context = createMockContext();

      await rebalancer.process(chunks, context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Rebalanced 2 chunks to 1 chunks');
    });
  });

  describe('getName', () => {
    it('should return the processor name', () => {
      expect(rebalancer.getName()).toBe('chunk-rebalancer');
    });
  });

  describe('shouldApply', () => {
    it('should return true when rebalancing is enabled and chunks need rebalancing', () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Small', 2, 2) // Too small
      ];
      const context = createMockContext(true, 50);

      expect(rebalancer.shouldApply(chunks, context)).toBe(true);
    });

    it('should return false when rebalancing is disabled', () => {
      const chunks = [createMockChunk('Normal chunk', 1, 1)];
      const context = createMockContext(false);

      expect(rebalancer.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when only one chunk', () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];
      const context = createMockContext();

      expect(rebalancer.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when all chunks are valid size', () => {
      const chunks = [
        createMockChunk('This is a normal sized chunk that is above the minimum size', 1, 1),
        createMockChunk('This is another normal sized chunk that is above the minimum size', 2, 2)
      ];
      const context = createMockContext(true, 50);

      expect(rebalancer.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('advancedRebalancing', () => {
    it('should return chunks unchanged when there are only 2 chunks and they are valid size', async () => {
      const chunks = [
        createMockChunk('This is a normal sized chunk that is above the minimum size', 1, 1),
        createMockChunk('This is another normal sized chunk that is above the minimum size', 2, 2)
      ];
      const context = createMockContext();

      const result = await rebalancer.advancedRebalancing(chunks, context);

      expect(result).toEqual(chunks);
    });

    it('should merge undersized chunks with previous chunk', async () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Small', 2, 2) // Undersized
      ];
      const context = createMockContext(true, 50, 1000);

      const result = await rebalancer.advancedRebalancing(chunks, context);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Normal chunk\nSmall');
      expect(mockLogger.debug).toHaveBeenCalledWith('Merged undersized chunk with previous chunk');
    });

    it('should split oversized chunks', async () => {
      const chunks = [
        createMockChunk('A'.repeat(1500), 1, 1) // Oversized
      ];
      const context = createMockContext(true, 50, 1000);

      const result = await rebalancer.advancedRebalancing(chunks, context);

      expect(result.length).toBeGreaterThan(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Split oversized chunk into ${result.length} parts`);
    });
  });

  describe('calculateOptimalChunkSize', () => {
    it('should calculate optimal size based on average', () => {
      const chunks = [
        createMockChunk('This is a much larger chunk with significantly more content to make sure that average is high enough', 1, 1),
        createMockChunk('This is another much larger chunk with significantly more content to make sure that average is high enough', 2, 2),
        createMockChunk('This is a third much larger chunk with significantly more content to make sure that average is high enough', 3, 3)
      ];
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).calculateOptimalChunkSize(chunks, context);

      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThan(1000);
    });

    it('should respect min and max limits', () => {
      const chunks = [
        createMockChunk('A'.repeat(10), 1, 1),
        createMockChunk('B'.repeat(10), 2, 2),
        createMockChunk('C'.repeat(10), 3, 3)
      ];
      const context = createMockContext(true, 200, 300);

      // Access private method through type assertion
      const result = (rebalancer as any).calculateOptimalChunkSize(chunks, context);

      expect(result).toBe(200); // Min size
    });
  });

  describe('isUnderSized', () => {
    it('should return true for undersized chunks', () => {
      const chunk = createMockChunk('Small', 1, 1);
      const context = createMockContext(true, 50);

      // Access private method through type assertion
      const result = (rebalancer as any).isUnderSized(chunk, context);

      expect(result).toBe(true);
    });

    it('should return false for properly sized chunks', () => {
      const chunk = createMockChunk('This is a properly sized chunk that is above the minimum size requirement', 1, 1);
      const context = createMockContext(true, 50);

      // Access private method through type assertion
      const result = (rebalancer as any).isUnderSized(chunk, context);

      expect(result).toBe(false);
    });
  });

  describe('isOverSized', () => {
    it('should return true for oversized chunks', () => {
      const chunk = createMockChunk('A'.repeat(1500), 1, 1);
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).isOverSized(chunk, context);

      expect(result).toBe(true);
    });

    it('should return false for properly sized chunks', () => {
      const chunk = createMockChunk('Normal sized chunk', 1, 1);
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).isOverSized(chunk, context);

      expect(result).toBe(false);
    });
  });

  describe('canSafelyMerge', () => {
    it('should return true for compatible chunks within size limit', () => {
      const chunk1 = createMockChunk('Chunk 1', 1, 1, 'function');
      const chunk2 = createMockChunk('Chunk 2', 2, 2, 'function');
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).canSafelyMerge(chunk1, chunk2, context);

      expect(result).toBe(true);
    });

    it('should return false when combined size exceeds limit', () => {
      const chunk1 = createMockChunk('A'.repeat(900), 1, 1);
      const chunk2 = createMockChunk('B'.repeat(200), 2, 2);
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).canSafelyMerge(chunk1, chunk2, context);

      expect(result).toBe(false);
    });

    it('should return false for incompatible types', () => {
      const chunk1 = createMockChunk('Chunk 1', 1, 1, 'function');
      const chunk2 = createMockChunk('Chunk 2', 2, 2, 'markdown');
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).canSafelyMerge(chunk1, chunk2, context);

      expect(result).toBe(false);
    });

    it('should return false for different languages', () => {
      const chunk1 = createMockChunk('Chunk 1', 1, 1, 'function');
      const chunk2 = createMockChunk('Chunk 2', 2, 2, 'function');
      chunk2.metadata.language = 'python';
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).canSafelyMerge(chunk1, chunk2, context);

      expect(result).toBe(false);
    });
  });

  describe('areTypesCompatible', () => {
    it('should return true for identical types', () => {
      // Access private method through type assertion
      const result = (rebalancer as any).areTypesCompatible('function', 'function');

      expect(result).toBe(true);
    });

    it('should return true for semantic types', () => {
      // Access private method through type assertion
      const result1 = (rebalancer as any).areTypesCompatible('function', 'class');
      const result2 = (rebalancer as any).areTypesCompatible('method', 'semantic');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return true for code types', () => {
      // Access private method through type assertion
      const result = (rebalancer as any).areTypesCompatible('code', 'import');

      expect(result).toBe(true);
    });

    it('should return false for incompatible types', () => {
      // Access private method through type assertion
      const result = (rebalancer as any).areTypesCompatible('function', 'markdown');

      expect(result).toBe(false);
    });
  });

  describe('mergeChunks', () => {
    it('should merge chunks and update metadata', () => {
      const targetChunk = createMockChunk('Target', 1, 1);
      const sourceChunk = createMockChunk('Source', 2, 2);

      // Access private method through type assertion
      (rebalancer as any).mergeChunks(targetChunk, sourceChunk);

      expect(targetChunk.content).toBe('Target\nSource');
      expect(targetChunk.metadata.endLine).toBe(2);
      expect(mockComplexityCalculator.calculate).toHaveBeenCalledWith('Target\nSource');
    });

    it('should preserve function name from source chunk', () => {
      const targetChunk = createMockChunk('Target', 1, 1);
      const sourceChunk = createMockChunk('Source', 2, 2);
      sourceChunk.metadata.functionName = 'testFunction';

      // Access private method through type assertion
      (rebalancer as any).mergeChunks(targetChunk, sourceChunk);

      expect(targetChunk.metadata.functionName).toBe('testFunction');
    });

    it('should preserve class name from source chunk', () => {
      const targetChunk = createMockChunk('Target', 1, 1);
      const sourceChunk = createMockChunk('Source', 2, 2);
      sourceChunk.metadata.className = 'TestClass';

      // Access private method through type assertion
      (rebalancer as any).mergeChunks(targetChunk, sourceChunk);

      expect(targetChunk.metadata.className).toBe('TestClass');
    });
  });

  describe('splitOversizedChunk', () => {
    it('should split multi-line content by lines', async () => {
      const chunk = createMockChunk('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\nLine 12\nLine 13\nLine 14\nLine 15\nLine 16\nLine 17\nLine 18\nLine 19\nLine 20', 1, 20);
      const context = createMockContext(true, 50, 100);

      const result = await rebalancer.advancedRebalancing([chunk], context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content).toContain('Line 1');
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[0].metadata.endLine).toBeGreaterThanOrEqual(1);
    });

    it('should split single-line content by characters', async () => {
      const chunk = createMockChunk('A'.repeat(200), 1, 1);
      const context = createMockContext(true, 50, 100);

      const result = await rebalancer.advancedRebalancing([chunk], context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content.length).toBeLessThanOrEqual(100);
    });
  });

  describe('splitByLines', () => {
    it('should split content by lines respecting target size', () => {
      const chunk = createMockChunk('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 1, 5);
      const targetSize = 20;

      // Access private method through type assertion
      const result = (rebalancer as any).splitByLines(chunk, targetSize);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content).toContain('Line 1');
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[0].metadata.endLine).toBeGreaterThanOrEqual(1);
    });
  });

  describe('splitByCharacters', () => {
    it('should split content by characters', () => {
      const chunk = createMockChunk('A'.repeat(100), 1, 1);
      const targetSize = 30;

      // Access private method through type assertion
      const result = (rebalancer as any).splitByCharacters(chunk, targetSize);

      expect(result.length).toBe(4); // 100 / 30 = 3.33, rounded up to 4
      expect(result[0].content.length).toBe(30);
      expect(result[3].content.length).toBe(10);
    });
  });

  describe('createSubChunk', () => {
    it('should create subchunk with correct metadata', () => {
      const parentChunk = createMockChunk('Parent content', 1, 5, 'function');
      const content = 'Sub content';
      const startLine = 2;
      const endLine = 3;

      // Access private method through type assertion
      const result = (rebalancer as any).createSubChunk(parentChunk, content, startLine, endLine);

      expect(result.content).toBe(content);
      expect(result.metadata.startLine).toBe(startLine);
      expect(result.metadata.endLine).toBe(endLine);
      expect(result.metadata.language).toBe('javascript');
      expect(result.metadata.filePath).toBe('test.js');
      expect(result.metadata.type).toBe('function');
      expect(mockComplexityCalculator.calculate).toHaveBeenCalledWith(content);
    });
  });

  describe('optimizeSizeDistribution', () => {
    it('should return chunks unchanged when variance is low', async () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2)
      ];
      const context = createMockContext();

      const result = await rebalancer.optimizeSizeDistribution(chunks, context);

      expect(result).toEqual(chunks);
    });

    it('should balance chunks when variance is high', async () => {
      const chunks = [
        createMockChunk('A'.repeat(100), 1, 1),
        createMockChunk('B'.repeat(10), 2, 2),
        createMockChunk('C'.repeat(10), 3, 3)
      ];
      const context = createMockContext();

      const result = await rebalancer.optimizeSizeDistribution(chunks, context);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('calculateVariance', () => {
    it('should calculate variance correctly', () => {
      const values = [10, 20, 30, 40, 50];

      // Access private method through type assertion
      const result = (rebalancer as any).calculateVariance(values);

      expect(result).toBe(200); // Variance of [10, 20, 30, 40, 50] is 200
    });

    it('should handle empty array', () => {
      const values: number[] = [];

      // Access private method through type assertion
      const result = (rebalancer as any).calculateVariance(values);

      expect(result).toBe(0);
    });
  });

  describe('balanceChunkSizes', () => {
    it('should split oversized chunks and merge undersized chunks', () => {
      const chunks = [
        createMockChunk('A'.repeat(1500), 1, 1), // Oversized
        createMockChunk('B'.repeat(10), 2, 2), // Undersized
        createMockChunk('C'.repeat(100), 3, 3)
      ];
      const context = createMockContext(true, 50, 1000);

      // Access private method through type assertion
      const result = (rebalancer as any).balanceChunkSizes(chunks, context);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('setRebalancingConfig', () => {
    it('should log configuration update', () => {
      const config = {
        enableChunkRebalancing: false,
        minChunkSize: 100,
        maxChunkSize: 2000
      };

      rebalancer.setRebalancingConfig(config);

      expect(mockLogger.debug).toHaveBeenCalledWith('Rebalancing configuration updated', config);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex rebalancing scenarios', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 3),
        createMockChunk('Small', 4, 4), // Will be merged
        createMockChunk('function test2() { return 2; }', 5, 7),
        createMockChunk('Tiny', 8, 8), // Will be merged
        createMockChunk('A'.repeat(1500), 9, 20) // Will be split
      ];
      const context = createMockContext(true, 50, 1000);

      const result = await rebalancer.advancedRebalancing(chunks, context);

      expect(result.length).toBeGreaterThan(2);
      expect(result[0].content).toContain('function test1() { return 1; }\nSmall');
      expect(result[1].content).toContain('function test2() { return 2; }\nTiny');
      expect(result.some(chunk => chunk.content.includes('A'.repeat(1500)))).toBe(false); // Should be split
    });

    it('should work with advanced rebalancing for complex scenarios', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 3),
        createMockChunk('function test2() { return 2; }', 4, 6),
        createMockChunk('function test3() { return 3; }', 7, 9)
      ];
      const context = createMockContext(true, 50, 1000);

      const result = await rebalancer.advancedRebalancing(chunks, context);

      expect(result.length).toBeGreaterThan(0);
    });
  });
});