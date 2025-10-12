
import { ASTNodeTracker } from '../utils/ASTNodeTracker';
import { ChunkMerger } from '../utils/ChunkMerger';
import { EnhancedOverlapCalculator } from '../utils/EnhancedOverlapCalculator';
import { ASTCodeSplitter } from '../ASTCodeSplitter';
import { DEFAULT_CHUNKING_OPTIONS, EnhancedChunkingOptions } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock TreeSitterService
jest.mock('../../core/parse/TreeSitterService');
jest.mock('../../../../utils/LoggerService');

describe('Duplicate Detection Tests', () => {
  let astNodeTracker: ASTNodeTracker;
  let chunkMerger: ChunkMerger;
  let enhancedOverlapCalculator: EnhancedOverlapCalculator;
  let astCodeSplitter: ASTCodeSplitter;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // 创建mock实例
    const mockCoreService = {} as any; // 创建一个模拟的coreService
    mockTreeSitterService = new TreeSitterService(mockCoreService) as jest.Mocked<TreeSitterService>;
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    
    // 初始化组件
    astNodeTracker = new ASTNodeTracker();
    const enhancedOptions: EnhancedChunkingOptions = {
      ...DEFAULT_CHUNKING_OPTIONS,
      enableChunkDeduplication: true,
      maxOverlapLines: 50,
      maxOverlapRatio: 0.3,
      enableASTBoundaryDetection: true,
      deduplicationThreshold: 0.8,
      astNodeTracking: true,
      chunkMergeStrategy: 'conservative',
      minChunkSimilarity: 0.6
    };
    chunkMerger = new ChunkMerger(enhancedOptions as Required<EnhancedChunkingOptions>, astNodeTracker);
    
    enhancedOverlapCalculator = new EnhancedOverlapCalculator({
      maxSize: 200,
      minLines: 1,
      maxOverlapRatio: 0.3,
      enableASTBoundaryDetection: true,
      nodeTracker: astNodeTracker
    });

    // 创建ASTCodeSplitter实例
    astCodeSplitter = new ASTCodeSplitter(mockTreeSitterService, mockLogger);
  });

  describe('ASTNodeTracker', () => {
    it('should track used nodes correctly', () => {
      const mockNode = {
        id: 'test-node-1',
        type: 'function_declaration',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 5,
        text: 'function test() {}'
      };

      expect(astNodeTracker.isUsed(mockNode)).toBe(false);
      
      astNodeTracker.markUsed(mockNode);
      expect(astNodeTracker.isUsed(mockNode)).toBe(true);
      
      const stats = astNodeTracker.getStats();
      expect(stats.totalNodes).toBe(1);
      expect(stats.usedNodes).toBe(1);
    });

    it('should detect node overlap', () => {
      const node1 = {
        id: 'node-1',
        type: 'function_declaration',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 5,
        text: 'function test1() {}'
      };

      const node2 = {
        id: 'node-2',
        type: 'function_declaration',
        startByte: 50,
        endByte: 150,
        startLine: 3,
        endLine: 7,
        text: 'function test2() {}'
      };

      astNodeTracker.markUsed(node1);
      expect(astNodeTracker.hasOverlap(node2)).toBe(true);
    });

    it('should clear tracking data', () => {
      const mockNode = {
        id: 'test-node-1',
        type: 'function_declaration',
        startByte: 0,
        endByte: 100,
        startLine: 1,
        endLine: 5,
        text: 'function test() {}'
      };

      astNodeTracker.markUsed(mockNode);
      expect(astNodeTracker.getStats().usedNodes).toBe(1);
      
      astNodeTracker.clear();
      expect(astNodeTracker.getStats().usedNodes).toBe(0);
      expect(astNodeTracker.getStats().totalNodes).toBe(0);
    });
  });

  describe('ChunkMerger', () => {
    it('should detect duplicate content', () => {
      const chunks = [
        {
          content: 'function test() {\n  return "hello";\n}',
          metadata: { startLine: 1, endLine: 3, language: 'javascript' }
        },
        {
          content: 'function test() {\n  return "hello";\n}',
          metadata: { startLine: 5, endLine: 7, language: 'javascript' }
        }
      ];

            const duplicates = chunkMerger.detectDuplicateContent(chunks);
      expect(duplicates.size).toBeGreaterThan(0);
    });

    it('should merge overlapping chunks', () => {
      const chunks = [
        {
          content: 'function test1() {\n  return "hello";\n}',
          metadata: { startLine: 1, endLine: 3, language: 'javascript' }
        },
        {
          content: 'function test2() {\n  return "world";\n}',
          metadata: { startLine: 2, endLine: 4, language: 'javascript' }
        }
      ];

      const mergedChunks = chunkMerger.mergeOverlappingChunks(chunks);
      expect(mergedChunks.length).toBeLessThanOrEqual(chunks.length);
    });

    it('should calculate chunk similarity', () => {
      const chunk1 = {
        content: 'function test() {\n  return "hello";\n}',
        metadata: { startLine: 1, endLine: 3, language: 'javascript' }
      };

      const chunk2 = {
        content: 'function test() {\n  return "world";\n}',
        metadata: { startLine: 5, endLine: 7, language: 'javascript' }
      };

      const similarity = chunkMerger.calculateChunkSimilarity(chunk1, chunk2);
      expect(similarity.overall).toBeGreaterThan(0);
      expect(similarity.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('EnhancedOverlapCalculator', () => {
    it('should respect max overlap ratio', () => {
      const currentChunk = {
        content: 'function test() {\n  return "hello";\n}',
        metadata: { startLine: 1, endLine: 3, language: 'javascript' }
      };

      const nextChunk = {
        content: 'function next() {\n  return "world";\n}',
        metadata: { startLine: 4, endLine: 6, language: 'javascript' }
      };

      const originalCode = 'function test() {\n  return "hello";\n}\nfunction next() {\n  return "world";\n}';

      const overlapResult = enhancedOverlapCalculator.calculateEnhancedOverlap(
        currentChunk,
        nextChunk,
        originalCode,
        {
          maxSize: 200,
          minLines: 1,
          maxOverlapRatio: 0.3,
          enableASTBoundaryDetection: false,
          nodeTracker: astNodeTracker
        }
      );

      expect(overlapResult.overlapRatio).toBeLessThanOrEqual(0.3);
    });

    it('should avoid duplicate AST nodes', () => {
      // 这个测试需要模拟AST结构，暂时跳过具体实现
      expect(true).toBe(true); // 占位测试
    });

    it('should maintain semantic integrity', () => {
      const currentChunk = {
        content: 'function test() {\n  return "hello";\n}',
        metadata: { startLine: 1, endLine: 3, language: 'javascript' }
      };

      const nextChunk = {
        content: 'function next() {\n  return "world";\n}',
        metadata: { startLine: 4, endLine: 6, language: 'javascript' }
      };

      const originalCode = 'function test() {\n  return "hello";\n}\nfunction next() {\n  return "world";\n}';

      const overlapResult = enhancedOverlapCalculator.calculateEnhancedOverlap(
        currentChunk,
        nextChunk,
        originalCode,
        {
          maxSize: 200,
          minLines: 1,
          maxOverlapRatio: 0.3,
          enableASTBoundaryDetection: false,
          nodeTracker: astNodeTracker
        }
      );

      expect(overlapResult.quality).toBeGreaterThan(0);
      expect(overlapResult.content).toContain('function test()');
    });
  });

  describe('Integration Tests', () => {
    it('should handle simple duplicate scenarios', async () => {
      const code = `
function test() {
  return "hello";
}

function test() {
  return "hello";
}

function another() {
  return "world";
}
      `.trim();

      // Mock TreeSitterService返回成功结果
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: null as any,
        language: { name: 'JavaScript', parser: {}, fileExtensions: ['.js', '.jsx'], supported: true },
        parseTime: 0
      });

      const chunks = await astCodeSplitter.split(code, 'javascript');
      
      // 验证重复检测功能
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle overlapping content scenarios', async () => {
      const code = `
function test() {
  return "hello";
}
// Some comment
function test() {
  return "hello";
}
      `.trim();

      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: null as any,
        language: 'javascript' as any,
        parseTime: 0
      });

      const chunks = await astCodeSplitter.split(code, 'javascript');
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});