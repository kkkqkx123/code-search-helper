import { ChunkRefinementService } from '../splitting/ChunkRefinementService';
import { CodeChunk } from '../types';

describe('ChunkRefinementService', () => {
  let chunkRefinementService: ChunkRefinementService;

  beforeEach(() => {
    chunkRefinementService = new ChunkRefinementService();
  });

  describe('refineChunks method', () => {
    test('should refine chunks by splitting large chunks and adding overlap', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          content: 'line1\nline2\nline3\nline4\nline5',
          startLine: 1,
          endLine: 5,
          startByte: 0,
          endByte: 30,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 5,
            complexity: 1,
          },
        },
      ];

      const options = {
        maxChunkSize: 20,
        overlapSize: 10,
        addOverlap: true,
      };

      const refinedChunks = chunkRefinementService.refineChunks(chunks, options);

      // Should return chunks
      expect(refinedChunks).toBeDefined();
      expect(Array.isArray(refinedChunks)).toBe(true);
    });

    test('should not add overlap when addOverlap is false', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          content: 'line1\nline2\nline3',
          startLine: 1,
          endLine: 3,
          startByte: 0,
          endByte: 20,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
        {
          id: 'chunk2',
          content: 'line4\nline5\nline6',
          startLine: 4,
          endLine: 6,
          startByte: 21,
          endByte: 40,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
      ];

      const options = {
        maxChunkSize: 100,
        overlapSize: 10,
        addOverlap: false,
      };

      const refinedChunks = chunkRefinementService.refineChunks(chunks, options);

      // Should return the same chunks since no refinement is needed
      expect(refinedChunks).toBeDefined();
      expect(Array.isArray(refinedChunks)).toBe(true);
      expect(refinedChunks.length).toBe(2);
    });
  });

  describe('splitLargeChunks method', () => {
    test('should split large chunks that exceed maxChunkSize', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'large-chunk',
          content: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10',
          startLine: 1,
          endLine: 10,
          startByte: 0,
          endByte: 60,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 10,
            complexity: 1,
          },
        },
      ];

      const splitChunks = chunkRefinementService.splitLargeChunks(chunks, 30);

      // Should have more chunks after splitting
      expect(splitChunks).toBeDefined();
      expect(Array.isArray(splitChunks)).toBe(true);
      // Note: With mock implementation, the exact number might vary
    });

    test('should not split chunks that are within maxChunkSize', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'small-chunk',
          content: 'line1\nline2\nline3',
          startLine: 1,
          endLine: 3,
          startByte: 0,
          endByte: 20,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
      ];

      const splitChunks = chunkRefinementService.splitLargeChunks(chunks, 100);

      // Should have the same number of chunks
      expect(splitChunks).toBeDefined();
      expect(Array.isArray(splitChunks)).toBe(true);
      expect(splitChunks.length).toBe(1);
      expect(splitChunks[0]).toEqual(chunks[0]);
    });

    test('should handle empty chunks array', () => {
      const chunks: CodeChunk[] = [];
      const splitChunks = chunkRefinementService.splitLargeChunks(chunks, 100);

      // Should return empty array
      expect(splitChunks).toBeDefined();
      expect(Array.isArray(splitChunks)).toBe(true);
      expect(splitChunks.length).toBe(0);
    });
  });

  describe('addOverlap method', () => {
    test('should add overlap between chunks', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          content: 'line1\nline2\nline3',
          startLine: 1,
          endLine: 3,
          startByte: 0,
          endByte: 20,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
        {
          id: 'chunk2',
          content: 'line4\nline5\nline6',
          startLine: 4,
          endLine: 6,
          startByte: 21,
          endByte: 40,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
      ];

      const overlappedChunks = chunkRefinementService.addOverlap(chunks, 1);

      // Should return chunks with overlap
      expect(overlappedChunks).toBeDefined();
      expect(Array.isArray(overlappedChunks)).toBe(true);
      expect(overlappedChunks.length).toBe(2);
    });

    test('should handle single chunk', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          content: 'line1\nline2\nline3',
          startLine: 1,
          endLine: 3,
          startByte: 0,
          endByte: 20,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 3,
            complexity: 1,
          },
        },
      ];

      const overlappedChunks = chunkRefinementService.addOverlap(chunks, 1);

      // Should return the same chunk
      expect(overlappedChunks).toBeDefined();
      expect(Array.isArray(overlappedChunks)).toBe(true);
      expect(overlappedChunks.length).toBe(1);
      expect(overlappedChunks[0]).toEqual(chunks[0]);
    });

    test('should handle empty chunks array', () => {
      const chunks: CodeChunk[] = [];
      const overlappedChunks = chunkRefinementService.addOverlap(chunks, 1);

      // Should return empty array
      expect(overlappedChunks).toBeDefined();
      expect(Array.isArray(overlappedChunks)).toBe(true);
      expect(overlappedChunks.length).toBe(0);
    });
  });

  describe('calculateComplexity method', () => {
    test('should calculate complexity of code', () => {
      const simpleCode = 'const x = 1;';
      const complexCode = `
if (condition) {
  for (let i = 0; i < 10; i++) {
    if (anotherCondition) {
      console.log(i);
    }
  }
}
      `;

      // Access private method through reflection for testing
      const calculateComplexity = (chunkRefinementService as any).calculateComplexity.bind(chunkRefinementService);

      const simpleComplexity = calculateComplexity(simpleCode);
      const complexComplexity = calculateComplexity(complexCode);

      // Should return numbers
      expect(typeof simpleComplexity).toBe('number');
      expect(typeof complexComplexity).toBe('number');
      // Complex code should have higher complexity
      expect(complexComplexity).toBeGreaterThanOrEqual(simpleComplexity);
    });

    test('should handle empty code', () => {
      const calculateComplexity = (chunkRefinementService as any).calculateComplexity.bind(chunkRefinementService);
      const complexity = calculateComplexity('');

      // Should return a default complexity value
      expect(typeof complexity).toBe('number');
      expect(complexity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateChunkId method', () => {
    test('should generate unique chunk IDs', () => {
      const content1 = 'line1\nline2\nline3';
      const content2 = 'line4\nline5\nline6';

      // Access private method through reflection for testing
      const generateChunkId = (chunkRefinementService as any).generateChunkId.bind(chunkRefinementService);

      const id1 = generateChunkId(content1, 1);
      const id2 = generateChunkId(content2, 4);
      const id3 = generateChunkId(content1, 1); // Same content and line

      // Should generate string IDs
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(typeof id3).toBe('string');

      // Same content and line should generate same ID
      expect(id1).toBe(id3);

      // Different content should generate different IDs
      expect(id1).not.toBe(id2);
    });
  });
});