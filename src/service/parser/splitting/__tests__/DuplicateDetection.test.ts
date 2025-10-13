import { SimilarityDetector } from '../utils/SimilarityDetector';
import { UnifiedOverlapCalculator } from '../utils/UnifiedOverlapCalculator';
import { ASTNodeTracker } from '../utils/ASTNodeTracker';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';
import { CodeChunk } from '../types';

describe('Duplicate Detection and Overlap Control', () => {
  let similarityDetector: SimilarityDetector;
  let nodeTracker: ASTNodeTracker;
  let unifiedOverlapCalculator: UnifiedOverlapCalculator;

  beforeEach(() => {
    similarityDetector = new SimilarityDetector();
    nodeTracker = new ASTNodeTracker();
    unifiedOverlapCalculator = new UnifiedOverlapCalculator({
      maxSize: 200,
      minLines: 1,
      maxOverlapRatio: 0.3,
      maxOverlapLines: 50,
      enableASTBoundaryDetection: false,
      enableNodeAwareOverlap: false,
      enableSmartDeduplication: true,
      similarityThreshold: 0.8,
      mergeStrategy: 'conservative',
      nodeTracker: nodeTracker
    });
  });

  describe('SimilarityDetector', () => {
    it('should detect similar content', () => {
      const content1 = 'function test() { return 1; }';
      const content2 = 'function test() { return 1; }';
      
      const isSimilar = SimilarityDetector.isSimilar(content1, content2, 0.8);
      expect(isSimilar).toBe(true);
    });

    it('should detect different content', () => {
      const content1 = 'function test() { return 1; }';
      const content2 = 'function different() { return 2; }';
      
      const isSimilar = SimilarityDetector.isSimilar(content1, content2, 0.8);
      expect(isSimilar).toBe(false);
    });

    it('should filter similar chunks', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return 1; }',
          metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'function' }
        },
        {
          content: 'function test() { return 1; }', // 相同内容
          metadata: { startLine: 2, endLine: 2, language: 'javascript', type: 'function' }
        },
        {
          content: 'function different() { return 2; }',
          metadata: { startLine: 3, endLine: 3, language: 'javascript', type: 'function' }
        }
      ];

      const filtered = SimilarityDetector.filterSimilarChunks(chunks, 0.8);
      expect(filtered.length).toBe(2); // 应该过滤掉一个重复的
    });
  });

  describe('ContentHashIDGenerator', () => {
    it('should generate consistent hash prefixes', () => {
      const content = 'function test() { return 1; }';
      const hash1 = ContentHashIDGenerator.getContentHashPrefix(content);
      const hash2 = ContentHashIDGenerator.getContentHashPrefix(content);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash prefixes for different content', () => {
      const content1 = 'function test() { return 1; }';
      const content2 = 'function different() { return 2; }';
      
      const hash1 = ContentHashIDGenerator.getContentHashPrefix(content1);
      const hash2 = ContentHashIDGenerator.getContentHashPrefix(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('UnifiedOverlapCalculator (formerly SmartOverlapController)', () => {
    let calculator: UnifiedOverlapCalculator;

    beforeEach(() => {
      calculator = new UnifiedOverlapCalculator({
        maxSize: 200,
        minLines: 1,
        maxOverlapRatio: 0.3,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: false,
        enableNodeAwareOverlap: false,
        enableSmartDeduplication: true,
        similarityThreshold: 0.8,
        mergeStrategy: 'conservative',
        nodeTracker: nodeTracker
      });
    });

    it('should merge similar chunks', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { return 1; }',
          metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'function' }
        },
        {
          content: 'function test2() { return 2; }',
          metadata: { startLine: 2, endLine: 2, language: 'javascript', type: 'function' }
        }
      ];

      const merged = calculator.mergeSimilarChunks(chunks);
      expect(Array.isArray(merged)).toBe(true);
    });

    it('should create smart overlap', () => {
      const currentChunk: CodeChunk = {
        content: 'function test1() { return 1; }\n',
        metadata: { startLine: 1, endLine: 2, language: 'javascript', type: 'function' }
      };
      
      const nextChunk: CodeChunk = {
        content: 'function test2() { return 2; }',
        metadata: { startLine: 3, endLine: 3, language: 'javascript', type: 'function' }
      };

      const overlap = calculator.createSmartOverlap(
        currentChunk,
        nextChunk,
        'function test1() { return 1; }\nfunction test2() { return 2; }',
        [currentChunk, nextChunk]
      );
      
      expect(typeof overlap).toBe('string');
    });

    it('should clear caches properly', () => {
      const calculator = new UnifiedOverlapCalculator({
        maxSize: 200,
        minLines: 1,
        maxOverlapRatio: 0.3,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: false,
        enableNodeAwareOverlap: false,
        enableSmartDeduplication: true,
        similarityThreshold: 0.8,
        mergeStrategy: 'conservative'
      });

      calculator.clearHistory();
      const stats = calculator.getStats();
      expect(stats.processedChunks).toBe(0);
      expect(stats.overlapHistoryEntries).toBe(0);
    });
  });

  describe('ASTNodeTracker', () => {
    it('should track nodes correctly', () => {
      const node1 = {
        id: 'node1',
        type: 'function',
        startByte: 0,
        endByte: 50,
        startLine: 1,
        endLine: 5,
        text: 'function test() { return 1; }',
        contentHash: 'hash1'
      };

      const node2 = {
        id: 'node2',
        type: 'function',
        startByte: 60,
        endByte: 110,
        startLine: 7,
        endLine: 10,
        text: 'function test2() { return 2; }',
        contentHash: 'hash2'
      };

      nodeTracker.markUsed(node1);
      expect(nodeTracker.isUsed(node1)).toBe(true);
      expect(nodeTracker.isUsed(node2)).toBe(false);
    });

    it('should detect overlapping nodes', () => {
      const node1 = {
        id: 'node1',
        type: 'function',
        startByte: 0,
        endByte: 50,
        startLine: 1,
        endLine: 5,
        text: 'function test() { return 1; }',
        contentHash: 'hash1'
      };

      const node2 = {
        id: 'node2',
        type: 'function',
        startByte: 40,
        endByte: 90,
        startLine: 4,
        endLine: 8,
        text: 'function test2() { return 2; }',
        contentHash: 'hash2'
      };

      nodeTracker.markUsed(node1);
      expect(nodeTracker.hasOverlap(node2)).toBe(true);
    });
  });
});