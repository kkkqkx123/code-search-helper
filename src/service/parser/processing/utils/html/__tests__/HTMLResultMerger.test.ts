import { HTMLResultMerger } from '../HTMLResultMerger';
import { CodeChunk, ChunkType } from '../../../core/types/ResultTypes';
import { HtmlRelationship } from '../../../../core/normalization/adapters/html-utils/HtmlRelationshipTypes';

describe('HTMLResultMerger', () => {
  let merger: HTMLResultMerger;

  beforeEach(() => {
    merger = new HTMLResultMerger();
  });

  const getDefaultMetadata = () => ({
    startLine: 1,
    endLine: 1,
    language: 'html',
    type: ChunkType.GENERIC,
    filePath: 'test.html',
    strategy: 'test',
    timestamp: Date.now(),
    size: 12,
    lineCount: 1
  });

  const createMockChunk = (overrides?: Partial<CodeChunk>): CodeChunk => ({
    content: 'test content',
    metadata: {
      ...getDefaultMetadata(),
      nodeId: 'node_1',
      ...overrides?.metadata
    },
    ...overrides
  });

  const createMockRelationship = (overrides?: Partial<HtmlRelationship>): HtmlRelationship => ({
    source: 'node_1',
    target: 'node_2',
    type: 'id-reference',
    metadata: {},
    referenceType: 'id',
    referenceValue: 'node_2',
    referenceAttribute: 'id',
    ...overrides
  } as HtmlRelationship);

  const mergeMetadata = (partial: any) => ({ ...getDefaultMetadata(), ...partial });

  describe('mergeResults', () => {
    it('should combine all chunks', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'html_1' }) })];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'script_1' }) })];
      const styleChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'style_1' }) })];

      const result = merger.mergeResults(htmlChunks, scriptChunks, styleChunks, []);

      expect(result).toHaveLength(3);
    });

    it('should sort chunks by start line', () => {
      const htmlChunks = [
        createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) }),
        createMockChunk({ metadata: mergeMetadata({ startLine: 5 }) })
      ];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })];
      const styleChunks: CodeChunk[] = [];

      const result = merger.mergeResults(htmlChunks, scriptChunks, styleChunks, []);

      expect(result[0].metadata.startLine).toBe(1);
      expect(result[1].metadata.startLine).toBe(5);
      expect(result[2].metadata.startLine).toBe(10);
    });

    it('should attach relationships to chunks', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) })];
      const relationships = [
        createMockRelationship({ source: 'node_1', target: 'node_2' }),
        createMockRelationship({ source: 'node_1', target: 'node_3' })
      ];

      const result = merger.mergeResults(htmlChunks, [], [], relationships);

      expect(result[0].metadata.relationships).toHaveLength(2);
    });

    it('should include relationship count', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) })];
      const relationships = [
        createMockRelationship({ source: 'node_1' }),
        createMockRelationship({ source: 'node_1' })
      ];

      const result = merger.mergeResults(htmlChunks, [], [], relationships);

      expect(result[0].metadata.relationshipCount).toBe(2);
    });

    it('should handle chunks with no relationships', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'unrelated' }) })];
      const relationships = [
        createMockRelationship({ source: 'other_node' })
      ];

      const result = merger.mergeResults(htmlChunks, [], [], relationships);

      expect(result[0].metadata.relationships).toHaveLength(0);
      expect(result[0].metadata.relationshipCount).toBe(0);
    });

    it('should handle empty relationships array', () => {
      const htmlChunks = [createMockChunk()];

      const result = merger.mergeResults(htmlChunks, [], [], []);

      expect(result[0].metadata.relationships).toHaveLength(0);
      expect(result[0].metadata.relationshipCount).toBe(0);
    });

    it('should preserve chunk content', () => {
      const content = 'specific content';
      const htmlChunks = [createMockChunk({ content })];

      const result = merger.mergeResults(htmlChunks, [], [], []);

      expect(result[0].content).toBe(content);
    });

    it('should preserve original metadata', () => {
      const metadata = mergeMetadata({
        startLine: 5,
        endLine: 10,
        language: 'javascript',
        customField: 'value'
      });
      const htmlChunks = [createMockChunk({ metadata })];

      const result = merger.mergeResults(htmlChunks, [], [], []);

      expect(result[0].metadata.startLine).toBe(5);
      expect(result[0].metadata.customField).toBe('value');
    });

    it('should handle large number of chunks', () => {
      const htmlChunks = Array(50).fill(0).map((_, i) =>
        createMockChunk({ metadata: mergeMetadata({ startLine: i * 10, nodeId: `node_${i}` }) })
      );

      const result = merger.mergeResults(htmlChunks, [], [], []);

      expect(result).toHaveLength(50);
      // Verify sorting
      for (let i = 1; i < result.length; i++) {
        expect(result[i].metadata.startLine).toBeGreaterThanOrEqual(result[i - 1].metadata.startLine);
      }
    });

    it('should handle multiple relationships per chunk', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) })];
      const relationships = [
        createMockRelationship({ source: 'node_1', target: 'a' }),
        createMockRelationship({ source: 'node_1', target: 'b' }),
        createMockRelationship({ source: 'node_1', target: 'c' })
      ];

      const result = merger.mergeResults(htmlChunks, [], [], relationships);

      expect(result[0].metadata.relationships).toHaveLength(3);
      expect(result[0].metadata.relationshipCount).toBe(3);
    });

    it('should handle mixed chunk types', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 5 }) })];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) })];
      const styleChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })];

      const result = merger.mergeResults(htmlChunks, scriptChunks, styleChunks, []);

      expect(result).toHaveLength(3);
      expect(result[0].metadata.startLine).toBe(1); // style first
      expect(result[1].metadata.startLine).toBe(5); // html second
      expect(result[2].metadata.startLine).toBe(10); // script last
    });
  });

  describe('simpleMergeResults', () => {
    it('should combine chunks without relationships', () => {
      const htmlChunks = [createMockChunk()];
      const scriptChunks = [createMockChunk()];
      const styleChunks = [createMockChunk()];

      const result = merger.simpleMergeResults(htmlChunks, scriptChunks, styleChunks);

      expect(result).toHaveLength(3);
    });

    it('should sort by start line', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) })];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })];
      const styleChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 5 }) })];

      const result = merger.simpleMergeResults(htmlChunks, scriptChunks, styleChunks);

      expect(result[0].metadata.startLine).toBe(1);
      expect(result[1].metadata.startLine).toBe(5);
      expect(result[2].metadata.startLine).toBe(10);
    });

    it('should not include relationship information', () => {
      const htmlChunks = [createMockChunk()];

      const result = merger.simpleMergeResults(htmlChunks, [], []);

      expect(result[0].metadata.relationships).toBeUndefined();
      expect(result[0].metadata.relationshipCount).toBeUndefined();
    });

    it('should preserve chunk content and metadata', () => {
      const content = 'test';
      const metadata = mergeMetadata({ startLine: 1, language: 'html' });
      const htmlChunks = [createMockChunk({ content, metadata })];

      const result = merger.simpleMergeResults(htmlChunks, [], []);

      expect(result[0].content).toBe(content);
      expect(result[0].metadata.language).toBe('html');
    });

    it('should handle empty chunk arrays', () => {
      const result = merger.simpleMergeResults([], [], []);

      expect(result).toHaveLength(0);
    });

    it('should handle one non-empty array', () => {
      const htmlChunks = [createMockChunk(), createMockChunk()];

      const result = merger.simpleMergeResults(htmlChunks, [], []);

      expect(result).toHaveLength(2);
    });
  });

  describe('mergeResultsWithMetadata', () => {
    it('should merge results with additional metadata', () => {
      const htmlChunks = [createMockChunk()];
      const additionalMetadata = { processedAt: Date.now(), strategy: 'layer1' };

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], additionalMetadata);

      expect(result[0].metadata.processedAt).toBe(additionalMetadata.processedAt);
      expect(result[0].metadata.strategy).toBe('layer1');
    });

    it('should preserve original metadata when adding new metadata', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 5, language: 'html' }) })];
      const additionalMetadata = { processed: true };

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], additionalMetadata);

      expect(result[0].metadata.startLine).toBe(5);
      expect(result[0].metadata.language).toBe('html');
      expect(result[0].metadata.processed).toBe(true);
    });

    it('should apply relationships when provided', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) })];
      const relationships = [createMockRelationship({ source: 'node_1' })];
      const additionalMetadata = { stage: 'post-processing' };

      const result = merger.mergeResultsWithMetadata(
        htmlChunks,
        [],
        [],
        relationships,
        additionalMetadata
      );

      expect(result[0].metadata.relationships).toHaveLength(1);
      expect(result[0].metadata.stage).toBe('post-processing');
    });

    it('should sort results by start line', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) })];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })];

      const result = merger.mergeResultsWithMetadata(
        htmlChunks,
        scriptChunks,
        [],
        [],
        {}
      );

      expect(result[0].metadata.startLine).toBe(1);
      expect(result[1].metadata.startLine).toBe(10);
    });

    it('should handle empty additional metadata', () => {
      const htmlChunks = [createMockChunk()];

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], {});

      expect(result).toHaveLength(1);
      expect(result[0].content).toBeDefined();
    });

    it('should override conflicting metadata keys', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ strategy: 'old' }) })];
      const additionalMetadata = { strategy: 'new' };

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], additionalMetadata);

      expect(result[0].metadata.strategy).toBe('new');
    });

    it('should handle multiple chunks with different metadata', () => {
      const htmlChunks = [
        createMockChunk({ metadata: mergeMetadata({ startLine: 1, custom: 'a' }) }),
        createMockChunk({ metadata: mergeMetadata({ startLine: 10, custom: 'b' }) })
      ];
      const additionalMetadata = { processed: true };

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], additionalMetadata);

      expect(result).toHaveLength(2);
      expect(result[0].metadata.custom).toBe('a');
      expect(result[1].metadata.custom).toBe('b');
      expect(result[0].metadata.processed).toBe(true);
      expect(result[1].metadata.processed).toBe(true);
    });

    it('should combine all chunk types with metadata', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) })];
      const scriptChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 5 }) })];
      const styleChunks = [createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })];
      const additionalMetadata = { version: 1 };

      const result = merger.mergeResultsWithMetadata(
        htmlChunks,
        scriptChunks,
        styleChunks,
        [],
        additionalMetadata
      );

      expect(result).toHaveLength(3);
      for (const chunk of result) {
        expect(chunk.metadata.version).toBe(1);
      }
    });

    it('should handle complex metadata objects', () => {
      const htmlChunks = [createMockChunk()];
      const additionalMetadata = {
        analysis: {
          complexity: 5,
          size: 1000
        },
        tags: ['important', 'reviewed'],
        timestamp: Date.now()
      };

      const result = merger.mergeResultsWithMetadata(htmlChunks, [], [], [], additionalMetadata);

      expect(result[0].metadata.analysis).toEqual(additionalMetadata.analysis);
      expect(result[0].metadata.tags).toEqual(additionalMetadata.tags);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle chunks with missing nodeId', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: undefined }) })];
      const relationships = [createMockRelationship({ source: 'node_1' })];

      // Should not throw
      expect(() => merger.mergeResults(htmlChunks, [], [], relationships)).not.toThrow();
    });

    it('should handle chunks with same start line', () => {
      const htmlChunks = [
        createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) }),
        createMockChunk({ metadata: mergeMetadata({ startLine: 1 }) })
      ];

      const result = merger.mergeResults(htmlChunks, [], [], []);

      expect(result).toHaveLength(2);
    });

    it('should handle very large relationship maps', () => {
      const htmlChunks = [createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) })];
      const relationships = Array(1000).fill(0).map((_, i) =>
        createMockRelationship({ source: 'node_1', target: `node_${i}` })
      );

      const result = merger.mergeResults(htmlChunks, [], [], relationships);

      expect(result[0].metadata.relationshipCount).toBe(1000);
    });

    it('should handle undefined metadata in chunk', () => {
      const chunk: CodeChunk = {
        content: 'test',
        metadata: undefined as any
      };

      // Should handle gracefully
      expect(() => merger.simpleMergeResults([chunk], [], [])).not.toThrow();
    });
  });

  describe('metadata integrity', () => {
    it('should not mutate original chunks', () => {
      const originalChunk = createMockChunk({ metadata: mergeMetadata({ nodeId: 'node_1' }) });
      const htmlChunks = [originalChunk];
      const relationships = [createMockRelationship({ source: 'node_1' })];

      merger.mergeResults(htmlChunks, [], [], relationships);

      expect(originalChunk.metadata.relationships).toBeUndefined();
    });

    it('should maintain chunk order consistency', () => {
      const chunks = [
        createMockChunk({ metadata: mergeMetadata({ startLine: 20 }) }),
        createMockChunk({ metadata: mergeMetadata({ startLine: 10 }) }),
        createMockChunk({ metadata: mergeMetadata({ startLine: 30 }) })
      ];

      const result = merger.simpleMergeResults(chunks, [], []);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].metadata.startLine).toBeGreaterThanOrEqual(
          result[i - 1].metadata.startLine
        );
      }
    });
  });
});
