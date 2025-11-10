import { ChunkFilter } from '../ChunkFilter';
import { CodeChunk, ChunkType } from '../../../types/CodeChunk';
import { PostProcessingContext } from '../../../../post-processing/IChunkPostProcessor';
import { ContentQualityEvaluator } from '../evaluators/ContentQualityEvaluator';
import { ChunkMerger } from '../evaluators/ChunkMerger';

describe('ChunkFilter', () => {
  let chunkFilter: ChunkFilter;
  let mockContext: PostProcessingContext;

  beforeEach(() => {
    chunkFilter = new ChunkFilter();
    mockContext = {
      originalContent: 'test content',
      language: 'typescript',
      filePath: 'test.ts',
      config: {} as any,
      options: {
        enableIntelligentChunking: true,
        minChunkSize: 100,
        maxChunkSize: 1000
      }
    };
  });

  describe('filterChunks', () => {
    it('should keep chunks that meet minimum size requirement', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'a'.repeat(150),
          metadata: {
            startLine: 1,
            endLine: 10,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.FUNCTION,
            timestamp: Date.now(),
            size: 150,
            lineCount: 10
          }
        }
      ];

      const result = await chunkFilter.filterChunks(chunks, mockContext);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });

    it('should filter out very small chunks', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'small',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 5,
            lineCount: 1
          }
        }
      ];

      const result = await chunkFilter.filterChunks(chunks, mockContext);
      expect(result).toHaveLength(0);
    });

    it('should merge small chunks with adjacent normal-sized chunks', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'a'.repeat(120),
          metadata: {
            startLine: 1,
            endLine: 10,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.FUNCTION,
            timestamp: Date.now(),
            size: 120,
            lineCount: 10
          }
        },
        {
          content: 'small',
          metadata: {
            startLine: 11,
            endLine: 11,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 5,
            lineCount: 1
          }
        },
        {
          content: 'b'.repeat(120),
          metadata: {
            startLine: 12,
            endLine: 20,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.FUNCTION,
            timestamp: Date.now(),
            size: 120,
            lineCount: 9
          }
        }
      ];

      const result = await chunkFilter.filterChunks(chunks, mockContext);
      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('small');
    });
  });

  describe('shouldApply', () => {
    it('should return false when intelligent chunking is disabled', () => {
      const context = {
        ...mockContext,
        options: {
          ...mockContext.options,
          enableIntelligentChunking: false
        }
      };

      const chunks: CodeChunk[] = [
        {
          content: 'test',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 4,
            lineCount: 1
          }
        }
      ];

      expect(chunkFilter.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when chunks array is empty', () => {
      expect(chunkFilter.shouldApply([], mockContext)).toBe(false);
    });

    it('should return true when there are chunks that need filtering', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'small',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 5,
            lineCount: 1
          }
        }
      ];

      expect(chunkFilter.shouldApply(chunks, mockContext)).toBe(true);
    });
  });

  describe('advancedFilter', () => {
    it('should return chunks as-is when quality evaluator is not available', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'test content',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 12,
            lineCount: 1
          }
        }
      ];

      const result = await chunkFilter.advancedFilter(chunks, mockContext);
      expect(result).toEqual(chunks);
    });
  });

  describe('intelligentMerge', () => {
    it('should return chunks as-is when chunk merger is not available', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'test content',
          metadata: {
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.LINE,
            timestamp: Date.now(),
            size: 12,
            lineCount: 1
          }
        }
      ];

      const result = await chunkFilter.intelligentMerge(chunks, mockContext);
      expect(result).toEqual(chunks);
    });
  });

  describe('processWithChunks', () => {
    it('should work with legacy context format', async () => {
      const chunks: CodeChunk[] = [
        {
          content: 'a'.repeat(150),
          metadata: {
            startLine: 1,
            endLine: 10,
            language: 'typescript',
            strategy: 'test',
            type: ChunkType.FUNCTION,
            timestamp: Date.now(),
            size: 150,
            lineCount: 10
          }
        }
      ];

      const legacyContext = {
        originalContent: 'test content',
        language: 'typescript',
        filePath: 'test.ts',
        config: {},
        options: {
          enableIntelligentChunking: true,
          minChunkSize: 100,
          maxChunkSize: 1000
        }
      };

      const result = await chunkFilter.processWithChunks(chunks, legacyContext);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(chunks[0].content);
    });
  });
});