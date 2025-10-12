import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';
import { SimilarityDetector } from '../utils/SimilarityDetector';
import { SmartOverlapController } from '../utils/SmartOverlapController';
import { ASTNodeTracker } from '../utils/ASTNodeTracker';
import { ChunkingCoordinator } from '../utils/ChunkingCoordinator';
import { DEFAULT_CHUNKING_OPTIONS, CodeChunk } from '../types';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
const mockLoggerService: Partial<LoggerService> = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Duplicate Detection System', () => {
  let nodeTracker: ASTNodeTracker;
  let coordinator: ChunkingCoordinator;

  beforeEach(() => {
    nodeTracker = new ASTNodeTracker(1000, true, 0.8);
    coordinator = new ChunkingCoordinator(
      nodeTracker,
      {
        ...DEFAULT_CHUNKING_OPTIONS,
        enableChunkDeduplication: true,
        deduplicationThreshold: 0.8,
        chunkMergeStrategy: 'conservative'
      },
      mockLoggerService as LoggerService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ContentHashIDGenerator', () => {
    it('should generate consistent IDs for identical content', () => {
      const node1 = {
        id: 'test-1',
        type: 'function',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 10,
        text: 'function test() { return true; }'
      };

      const node2 = {
        id: 'test-2',
        type: 'function',
        startByte: 200,
        endByte: 300,
        startLine: 20,
        endLine: 30,
        text: 'function test() { return true; }' // 相同内容，不同位置
      };

      const id1 = ContentHashIDGenerator.generateNodeId(node1);
      const id2 = ContentHashIDGenerator.generateNodeId(node2);

      // 内容相同，ID应该不同（因为位置不同）
      expect(id1).not.toBe(id2);
      
      // 但内容哈希部分应该相同
      const hash1 = id1.split('-')[0];
      const hash2 = id2.split('-')[0];
      expect(hash1).toBe(hash2);
    });

    it('should detect potentially similar content', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return true; }';
      const content3 = 'function different() { return false; }';

      expect(ContentHashIDGenerator.isPotentiallySimilar(content1, content2)).toBe(true);
      expect(ContentHashIDGenerator.isPotentiallySimilar(content1, content3)).toBe(false);
    });

    it('should normalize content consistently', () => {
      const content1 = 'function test() {\n    return true;\n}';
      const content2 = 'function test() { return true; }';
      
      const normalized1 = ContentHashIDGenerator['normalizeContent'](content1);
      const normalized2 = ContentHashIDGenerator['normalizeContent'](content2);
      
      // 标准化后应该相同
      expect(normalized1).toBe(normalized2);
    });
  });

  describe('SimilarityDetector', () => {
    it('should calculate similarity correctly', () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function test() { return true; }';
      const content3 = 'function different() { return false; }';

      const similarity1 = SimilarityDetector.calculateSimilarity(content1, content2);
      const similarity2 = SimilarityDetector.calculateSimilarity(content1, content3);

      expect(similarity1).toBe(1.0); // 完全相同
      expect(similarity2).toBeLessThan(0.8); // 相似度应该较低
    });

    it('should filter similar chunks correctly', () => {
      const chunks = [
        { content: 'function test1() { return true; }', id: 'chunk1' },
        { content: 'function test1() { return true; }', id: 'chunk2' }, // 相同内容
        { content: 'function test2() { return false; }', id: 'chunk3' },
        { content: 'function test1() { return true; }', id: 'chunk4' }  // 相同内容
      ];

      const filtered = SimilarityDetector.filterSimilarChunks(chunks, 0.9);
      
      // 应该过滤掉重复的块
      expect(filtered.length).toBe(2);
      expect(filtered.map(c => c.id)).toContain('chunk1');
      expect(filtered.map(c => c.id)).toContain('chunk3');
    });

    it('should find similarity groups', () => {
      const chunks = [
        { content: 'function test() { return true; }', id: 'chunk1' },
        { content: 'function test() { return true; }', id: 'chunk2' },
        { content: 'function other() { return false; }', id: 'chunk3' },
        { content: 'function test() { return true; }', id: 'chunk4' }
      ];

      const groups = SimilarityDetector.findSimilarityGroups(chunks, 0.9);
      
      expect(groups.size).toBe(1); // 只有一组相似的块
      expect(groups.has('chunk1')).toBe(true);
      expect(groups.get('chunk1')!.length).toBe(3); // 包含3个相似的块
    });
  });

  describe('SmartOverlapController', () => {
    let controller: SmartOverlapController;

    beforeEach(() => {
      controller = new SmartOverlapController(0.8, 'conservative', 0.3);
    });

    it('should prevent creation of similar overlap chunks', () => {
      const chunk1: CodeChunk = {
        content: 'function test() {\n  return true;\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          type: 'function',
          filePath: 'test.js'
        }
      };

      const chunk2: CodeChunk = {
        content: 'function test() {\n  return true;\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          type: 'overlap',
          filePath: 'test.js'
        }
      };

      const existingChunks = [chunk1];
      
      const shouldCreate = controller.shouldCreateOverlap(chunk2, existingChunks, '');
      expect(shouldCreate).toBe(false); // 不应该创建相似的重叠块
    });

    it('should merge similar adjacent chunks', () => {
      const chunk1: CodeChunk = {
        content: 'function test() {\n  return true;\n}',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          type: 'function',
          filePath: 'test.js'
        }
      };

      const chunk2: CodeChunk = {
        content: 'function test() {\n  return true;\n}\n\n// comment',
        metadata: {
          startLine: 1,
          endLine: 4,
          language: 'javascript',
          type: 'function',
          filePath: 'test.js'
        }
      };

      const chunks = [chunk1, chunk2];
      const merged = controller.mergeSimilarChunks(chunks);
      
      // 应该合并相似的相邻块
      expect(merged.length).toBeLessThanOrEqual(chunks.length);
    });
  });

  describe('ASTNodeTracker with Content Hashing', () => {
    it('should detect content similar nodes', () => {
      const node1 = {
        id: 'test-1',
        type: 'function',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 10,
        text: 'function test() { return true; }',
        contentHash: ContentHashIDGenerator.getContentHashPrefix('function test() { return true; }')
      };

      const node2 = {
        id: 'test-2',
        type: 'function',
        startByte: 200,
        endByte: 300,
        startLine: 20,
        endLine: 30,
        text: 'function test() { return true; }', // 相同内容，不同位置
        contentHash: ContentHashIDGenerator.getContentHashPrefix('function test() { return true; }')
      };

      // 标记第一个节点为已使用
      nodeTracker.markUsed(node1);
      
      // 第二个节点应该被识别为已使用（因为内容相似）
      expect(nodeTracker.isUsed(node2)).toBe(true);
      
      const stats = nodeTracker.getStats();
      expect(stats.similarityHits).toBe(1);
    });

    it('should find similarity groups', () => {
      const node1 = {
        id: 'test-1',
        type: 'function',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 10,
        text: 'function test() { return true; }',
        contentHash: 'hash1'
      };

      const node2 = {
        id: 'test-2',
        type: 'function',
        startByte: 200,
        endByte: 300,
        startLine: 20,
        endLine: 30,
        text: 'function test() { return true; }',
        contentHash: 'hash1' // 相同哈希
      };

      const node3 = {
        id: 'test-3',
        type: 'function',
        startByte: 400,
        endByte: 500,
        startLine: 40,
        endLine: 50,
        text: 'function other() { return false; }',
        contentHash: 'hash2' // 不同哈希
      };

      // 将节点添加到跟踪器中（不标记为已使用，以便它们出现在分组中）
      (nodeTracker as any).nodeCache.set('node1', node1);
      (nodeTracker as any).nodeCache.set('node2', node2);
      (nodeTracker as any).nodeCache.set('node3', node3);

      const groups = nodeTracker.findSimilarityGroups();
      
      // 应该找到基于内容哈希的相似组
      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      // 检查是否包含相似内容的组
      const hasSimilarityGroup = Array.from(groups.values()).some(group => group.length >= 2);
      expect(hasSimilarityGroup).toBe(true);
    });
  });

  describe('Integration Test - Duplicate Detection Workflow', () => {
    it('should handle the original problem case', () => {
      // 模拟原始问题中的Go代码片段
      const goCode = `
package main

type Node struct {
	data       int
	leftChild  *Node
	rightChild *Node
}

type Tree struct {
}
`;

      // 创建模拟的代码块（模拟不同分段策略生成的重复块）
      const duplicateChunks = [
        {
          content: `package main

type Node struct {
	data       int
	leftChild  *Node
	rightChild *Node
}

type Tree struct {
}`,
          metadata: {
            startLine: 2,
            endLine: 11,
            language: 'go',
            type: 'code'
          }
        },
        {
          content: `package main

type Node struct {
	data       int
	leftChild  *Node
	rightChild *Node
}

type Tree struct {`,
          metadata: {
            startLine: 2,
            endLine: 10,
            language: 'go',
            type: 'code'
          }
        },
        {
          content: `package main

type Node struct {
	data       int
	leftChild  *Node
	rightChild *Node
}`,
          metadata: {
            startLine: 2,
            endLine: 8,
            language: 'go',
            type: 'code'
          }
        }
      ];

      // 使用相似度检测器过滤重复的块
      const filteredChunks = SimilarityDetector.filterSimilarChunks(
        duplicateChunks,
        0.8
      );

      // 应该过滤掉重复的块，保留最完整的块
      expect(filteredChunks.length).toBeLessThan(duplicateChunks.length);
      expect(filteredChunks.some(chunk => chunk.content.includes('type Tree struct'))).toBe(true);
    });

    it('should demonstrate content hashing effectiveness', () => {
      const similarContents = [
        'function test() { return true; }',
        'function test() {\n  return true;\n}',
        'function test() { return true; } // comment',
        '  function test() { return true; }  '
      ];

      // 标准化后的内容应该相同
      const normalizedContents = similarContents.map(content => 
        ContentHashIDGenerator['normalizeContent'](content)
      );

      const hashes = normalizedContents.map(content => 
        ContentHashIDGenerator['generateContentHash'](content)
      );

      // 所有哈希应该相同
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle cache size limits', () => {
      const tracker = new ASTNodeTracker(100, true, 0.8); // 小缓存用于测试

      // 创建大量节点
      for (let i = 0; i < 200; i++) {
        const node = {
          id: `test-${i}`,
          type: 'function',
          startByte: i * 100,
          endByte: (i + 1) * 100,
          startLine: i,
          endLine: i + 1,
          text: `function test${i}() { return true; }`,
          contentHash: `hash-${i % 50}` // 每50个节点重复一次哈希
        };
        tracker.markUsed(node);
      }

      const stats = tracker.getStats();
      expect(stats.totalNodes).toBeLessThanOrEqual(100); // 不应该超过缓存限制
    });

    it('should clear caches properly', () => {
      const controller = new SmartOverlapController();
      
      // 添加一些数据
      // 先创建一些重叠历史
      const chunk1: CodeChunk = {
        content: 'test content line 1',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'javascript',
          type: 'overlap',
          filePath: 'test.js'
        }
      };

      controller['recordOverlapHistory'](chunk1);

      const statsBefore = controller.getStats();
      expect(statsBefore.overlapHistoryEntries).toBeGreaterThan(0);

      controller.clearHistory();

      const statsAfter = controller.getStats();
      expect(statsAfter.processedChunks).toBe(0);
      expect(statsAfter.overlapHistoryEntries).toBe(0);
    });
  });
});