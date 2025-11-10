import { ChunkSimilarityUtils } from '../ChunkSimilarityUtils';
import { CodeChunk, ChunkType } from '../../../types/CodeChunk';
import { SimilarityUtils } from '../../../../../similarity/utils/SimilarityUtils';

describe('ChunkSimilarityUtils', () => {
  describe('isDuplicateChunk', () => {
    it('should detect identical chunks as duplicates', () => {
      const chunk1: CodeChunk = {
        content: 'function test() {\n  return "test";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      const chunk2: CodeChunk = {
        content: 'function test() {\n  return "test";\n}',
        metadata: {
          startLine: 5,
          endLine: 7,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      expect(ChunkSimilarityUtils.isDuplicateChunk(chunk1, chunk2)).toBe(true);
    });

    it('should detect chunks with same position as duplicates', () => {
      const chunk1: CodeChunk = {
        content: 'function test() {\n  return "test";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      const chunk2: CodeChunk = {
        content: 'function another() {\n  return "another";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 35,
          lineCount: 3
        }
      };

      expect(ChunkSimilarityUtils.isDuplicateChunk(chunk1, chunk2)).toBe(true);
    });

    it('should not detect different chunks as duplicates', () => {
      const chunk1: CodeChunk = {
        content: 'function test() {\n  return "test";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      const chunk2: CodeChunk = {
        content: 'class TestClass {\n  method() {}\n}',
        metadata: {
          startLine: 5,
          endLine: 7,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.CLASS,
          size: 32,
          lineCount: 3
        }
      };

      expect(ChunkSimilarityUtils.isDuplicateChunk(chunk1, chunk2)).toBe(false);
    });
  });

  describe('canMergeChunks', () => {
    it('should allow merging adjacent chunks', async () => {
      const chunk1: CodeChunk = {
        content: 'function first() {\n  return "first";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      const chunk2: CodeChunk = {
        content: 'function second() {\n  return "second";\n}',
        metadata: {
          startLine: 4,
          endLine: 6,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 32,
          lineCount: 3
        }
      };

      // Create an instance of SimilarityUtils using the static instance
      const similarityUtils = SimilarityUtils.getInstance();
      if (!similarityUtils) {
        throw new Error('SimilarityUtils instance not available');
      }
      const chunkSimilarityUtils = new ChunkSimilarityUtils(similarityUtils);
      expect(await chunkSimilarityUtils.canMergeChunks(chunk1, chunk2, 0.3)).toBe(true);
    });

    it('should not allow merging non-adjacent chunks', async () => {
      const chunk1: CodeChunk = {
        content: 'function first() {\n  return "first";\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 30,
          lineCount: 3
        }
      };

      const chunk2: CodeChunk = {
        content: 'function second() {\n  return "second";\n}',
        metadata: {
          startLine: 10,
          endLine: 12,
          language: 'javascript',
          strategy: 'test',
          timestamp: Date.now(),
          type: ChunkType.FUNCTION,
          size: 32,
          lineCount: 3
        }
      };

      // Create an instance of SimilarityUtils using the static instance
      const similarityUtils = SimilarityUtils.getInstance();
      if (!similarityUtils) {
        throw new Error('SimilarityUtils instance not available');
      }
      const chunkSimilarityUtils = new ChunkSimilarityUtils(similarityUtils);
      expect(await chunkSimilarityUtils.canMergeChunks(chunk1, chunk2, 0.8)).toBe(false);
    });
  });

  describe('mergeContents', () => {
    it('should merge contents without overlap', () => {
      const content1 = 'function first() {\n  return "first";\n}';
      const content2 = 'function second() {\n  return "second";\n}';
      
      const result = ChunkSimilarityUtils.mergeContents(content1, content2, 1, 4);
      expect(result).toBe('function first() {\n  return "first";\n}\nfunction second() {\n  return "second";\n}');
    });

    it('should merge contents with overlap', () => {
      const content1 = 'function first() {\n  return "first";\n}';
      const content2 = '  return "first";\n}';
      
      const result = ChunkSimilarityUtils.mergeContents(content1, content2, 1, 2);
      expect(result).toBe('function first() {\n  return "first";\n}');
    });
  });
});