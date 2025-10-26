import { OverlapProcessor } from '../OverlapProcessor';
import { LoggerService } from '../../../../../utils/LoggerService';
import { IComplexityCalculator } from '../../../processing/strategies/types/SegmentationTypes';
import { SegmentationContext } from '../../../processing/strategies/types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock IComplexityCalculator
const mockComplexityCalculator: jest.Mocked<IComplexityCalculator> = {
  calculate: jest.fn()
};

describe('OverlapProcessor', () => {
  let processor: OverlapProcessor;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' = 'code'): CodeChunk => ({
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
  const createMockContext = (isCodeFile = true, enableCodeOverlap = false, overlapSize = 200, maxChunkSize = 2000): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize,
      overlapSize,
      maxLinesPerChunk: 50,
      enableBracketBalance: true,
      enableSemanticDetection: true,
      enableCodeOverlap,
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
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: 50,
        maxChunkSize: 1000
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
      isCodeFile,
      isMarkdownFile: !isCodeFile
    }
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockComplexityCalculator.calculate.mockReturnValue(5);

    processor = new OverlapProcessor(mockComplexityCalculator, mockLogger);
  });

  describe('process', () => {
    it('should return chunks unchanged when only one chunk', async () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];
      const context = createMockContext();

      const result = await processor.process(chunks, context);

      expect(result).toEqual(chunks);
    });

    it('should process code file chunks when code overlap is disabled', async () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Large chunk that exceeds max size', 2, 100)
      ];
      const context = createMockContext(true, false, 200, 2000);

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Normal chunk');
      expect(result[1].content).toBe('Large chunk that exceeds max size');
    });

    it('should split large code chunks when code overlap is disabled', async () => {
      const chunks = [
        createMockChunk('A'.repeat(2500), 1, 50),
        createMockChunk('Normal chunk', 51, 52)
      ];
      const context = createMockContext(true, false, 200, 2000);

      const result = await processor.process(chunks, context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content.length).toBeLessThanOrEqual(2200); // Should be split
      expect(mockLogger.info).toHaveBeenCalledWith('Large chunk detected (2500 chars), splitting with overlap');
    });

    it('should process text file chunks with overlap', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Second chunk', 6, 10)
      ];
      const context = createMockContext(false);

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('First chunk');
      expect(result[0].content).toContain('\n'); // Should have overlap
      expect(result[1].content).toBe('Second chunk');
    });

    it('should not add overlap when chunks are adjacent', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Second chunk', 6, 10)
      ];
      const context = createMockContext(false);

      // Mock the overlap calculation to return empty string for adjacent chunks
      const originalContent = 'First chunk\nSecond chunk';
      context.content = originalContent;

      const result = await processor.process(chunks, context);

      expect(result[0].content).toBe('First chunk');
      expect(result[1].content).toBe('Second chunk');
    });

    it('should log processing statistics', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Second chunk', 6, 10)
      ];
      const context = createMockContext(false);

      await processor.process(chunks, context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Processed 2 text file chunks with overlap');
    });
  });

  describe('getName', () => {
    it('should return the processor name', () => {
      expect(processor.getName()).toBe('overlap');
    });
  });

  describe('shouldApply', () => {
    it('should return true when there are multiple chunks and overlap size > 0', () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2)
      ];
      const context = createMockContext(true, true, 200);

      expect(processor.shouldApply(chunks, context)).toBe(true);
    });

    it('should return false when only one chunk', () => {
      const chunks = [createMockChunk('Single chunk', 1, 1)];
      const context = createMockContext();

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });

    it('should return false when overlap size is 0', () => {
      const chunks = [
        createMockChunk('Chunk 1', 1, 1),
        createMockChunk('Chunk 2', 2, 2)
      ];
      const context = createMockContext(true, false, 0); // 修复：传递overlapSize为0

      expect(processor.shouldApply(chunks, context)).toBe(false);
    });
  });

  describe('processCodeFileChunks', () => {
    it('should split large chunks with overlap', async () => {
      const chunks = [
        createMockChunk('A'.repeat(2500), 1, 50),
        createMockChunk('Normal chunk', 51, 52)
      ];
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).processCodeFileChunks(chunks, context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content.length).toBeLessThanOrEqual(2200);
      expect(mockLogger.info).toHaveBeenCalledWith('Large chunk detected (2500 chars), splitting with overlap');
    });

    it('should keep normal sized chunks unchanged', async () => {
      const chunks = [
        createMockChunk('Normal chunk 1', 1, 1),
        createMockChunk('Normal chunk 2', 2, 2)
      ];
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).processCodeFileChunks(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Normal chunk 1');
      expect(result[1].content).toBe('Normal chunk 2');
    });

    it('should log processing statistics', async () => {
      const chunks = [
        createMockChunk('Normal chunk', 1, 1),
        createMockChunk('Large chunk', 2, 50)
      ];
      const context = createMockContext(true, false, 200, 2000);

      await (processor as any).processCodeFileChunks(chunks, context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Processed 2 code file chunks, resulted in 2 chunks');
    });
  });

  describe('processTextFileChunks', () => {
    it('should add overlap between chunks', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Second chunk', 6, 10)
      ];
      const context = createMockContext(false);

      const result = await (processor as any).processTextFileChunks(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('First chunk');
      expect(result[0].content).toContain('\n');
      expect(result[1].content).toBe('Second chunk');
    });

    it('should not add overlap for last chunk', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Last chunk', 6, 10)
      ];
      const context = createMockContext(false);

      const result = await (processor as any).processTextFileChunks(chunks, context);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First chunk');
      expect(result[1].content).toBe('Last chunk');
    });

    it('should handle empty overlap content gracefully', async () => {
      const chunks = [
        createMockChunk('First chunk', 1, 5),
        createMockChunk('Second chunk', 6, 10)
      ];
      const context = createMockContext(false);

      // Mock overlap calculation to return empty string
      (processor as any).calculateOverlapContent = jest.fn().mockReturnValue('');

      const result = await (processor as any).processTextFileChunks(chunks, context);

      expect(result[0].content).toBe('First chunk');
      expect(result[1].content).toBe('Second chunk');
    });
  });

  describe('splitLargeChunkWithOverlap', () => {
    it('should split large chunk with overlap lines', async () => {
      const chunk = createMockChunk('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 1, 5);
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).splitLargeChunkWithOverlap(chunk, context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content).toContain('Line 1');
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[0].metadata.endLine).toBeGreaterThanOrEqual(1);
    });

    it('should split single-line content by characters', async () => {
      const chunk = createMockChunk('A'.repeat(100), 1, 1);
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).splitLargeChunkWithOverlap(chunk, context);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content.length).toBeLessThanOrEqual(200);
      expect(result[0].metadata.startLine).toBe(1);
      expect(result[0].metadata.endLine).toBe(1);
    });

    it('should calculate smart overlap lines', async () => {
      const chunk = createMockChunk('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', 1, 5);
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).splitLargeChunkWithOverlap(chunk, context);

      // Should include some overlap lines from the end of current chunk
      expect(result[0].content).toContain('Line 5');
    });

    it('should include at least one line when overlap is too small', async () => {
      const chunk = createMockChunk('Short', 1, 1);
      const context = createMockContext(true, false, 200, 2000);

      const result = await (processor as any).splitLargeChunkWithOverlap(chunk, context);

      expect(result[0].content).toBe('Short');
    });

    it('should log splitting information', async () => {
      const chunk = createMockChunk('A'.repeat(2500), 1, 50);
      const context = createMockContext(true, false, 200, 2000);

      await (processor as any).splitLargeChunkWithOverlap(chunk, context);

      expect(mockLogger.info).toHaveBeenCalledWith('Large chunk detected (2500 chars), splitting with overlap');
    });
  });

  describe('calculateSmartOverlapLines', () => {
    it('should calculate overlap lines from the end', () => {
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const maxOverlapSize = 50;

      // Access private method through type assertion
      const result = (processor as any).calculateSmartOverlapLines(lines, maxOverlapSize);

      expect(result).toContain('Line 5');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should respect maximum overlap size', () => {
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const maxOverlapSize = 10;

      // Access private method through type assertion
      const result = (processor as any).calculateSmartOverlapLines(lines, maxOverlapSize);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no lines', () => {
      const lines: string[] = [];
      const maxOverlapSize = 50;

      // Access private method through type assertion
      const result = (processor as any).calculateSmartOverlapLines(lines, maxOverlapSize);

      expect(result).toEqual([]);
    });
  });

  describe('calculateOverlapContent', () => {
    it('should calculate overlap content between chunks', () => {
      const currentChunk = createMockChunk('Line 1\nLine 2\nLine 3', 1, 3);
      const nextChunk = createMockChunk('Line 4\nLine 5\nLine 6', 4, 6);
      const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      // Access private method through type assertion
      const result = (processor as any).calculateOverlapContent(currentChunk, nextChunk, originalContent);

      expect(result).toContain('Line 3');
    });

    it('should return empty string for overlapping chunks', () => {
      const currentChunk = createMockChunk('Line 1\nLine 2\nLine 3', 1, 3);
      const nextChunk = createMockChunk('Line 4\nLine 5\nLine 6', 4, 6);
      const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      // Access private method through type assertion
      const result = (processor as any).calculateOverlapContent(currentChunk, nextChunk, originalContent);

      expect(result).toBe('');
    });

    it('should limit overlap lines based on chunk size', () => {
      const currentChunk = createMockChunk('A'.repeat(100), 1, 1);
      const nextChunk = createMockChunk('B'.repeat(100), 2, 2);
      const originalContent = 'A'.repeat(100) + '\n' + 'B'.repeat(100);

      // Access private method through type assertion
      const result = (processor as any).calculateOverlapContent(currentChunk, nextChunk, originalContent);

      expect(result.length).toBeLessThan(50); // Limited by chunk size
    });
  });

  describe('calculateSemanticOverlap', () => {
    it('should find semantic boundaries', async () => {
      const currentLines = ['function test() {', '  return 1;', '}'];
      const nextLines = ['function test2() {', '  return 2;', '}'];
      const originalContent = 'function test() { \n  return 1;\n}\n\nfunction test2() { \n  return 2;\n}';

      // Access private method through type assertion
      const result = (processor as any).calculateSemanticOverlap(
        { content: currentLines.join('\n'), metadata: { startLine: 1, endLine: 3 } },
        { content: nextLines.join('\n'), metadata: { startLine: 4, endLine: 6 } },
        originalContent
      );

      expect(result).toContain('function test() { \n  return 1;\n}');
    });

    it('should return null when no semantic boundary found', async () => {
      const currentLines = ['Line 1', 'Line 2', 'Line 3'];
      const nextLines = ['Line 4', 'Line 5', 'Line 6'];
      const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      // Access private method through type assertion
      const result = (processor as any).calculateSemanticOverlap(
        { content: currentLines.join('\n'), metadata: { startLine: 1, endLine: 3 } },
        { content: nextLines.join('\n'), metadata: { startLine: 4, endLine: 6 } },
        originalContent
      );

      expect(result).toBeNull();
    });

    it('should fall back to simple overlap when no semantic boundary', async () => {
      const currentLines = ['Line 1', 'Line 2', 'Line 3'];
      const nextLines = ['Line 4', 'Line 5', 'Line 6'];
      const originalContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      // Mock semantic boundary detection to return null
      (processor as any).findSemanticBoundary = jest.fn().mockReturnValue(null);

      // Access private method through type assertion
      const result = (processor as any).calculateSemanticOverlap(
        { content: currentLines.join('\n'), metadata: { startLine: 1, endLine: 3 } },
        { content: nextLines.join('\n'), metadata: { startLine: 4, endLine: 6 } },
        originalContent
      );

      expect(result).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('findSemanticBoundary', () => {
    it('should find function boundaries', () => {
      const lines = [
        '  if (condition) {',
        '    return value;',
        '  }',
        '',
        'function test() {',
        '  return result;',
        '}'
      ];

      // Access private method through type assertion
      const result = (processor as any).findSemanticBoundary(lines);

      expect(result).toContain('function test() {');
      expect(result).toContain('  return result;');
    });

    it('should find empty lines as boundaries', () => {
      const lines = [
        '  const x = 1;',
        '',
        '  const y = 2;',
        ''
      ];

      // Access private method through type assertion
      const result = (processor as any).findSemanticBoundary(lines);

      expect(result).toContain('const x = 1;\n\n');
    });

    it('should return null when no boundary found', () => {
      const lines = [
        'Line 1',
        'Line 2',
        'Line 3'
      ];

      // Access private method through type assertion
      const result = (processor as any).findSemanticBoundary(lines);

      expect(result).toBeNull();
    });
  });

  describe('setOverlapOptions', () => {
    it('should log configuration update', () => {
      const options = {
        overlapSize: 300,
        maxOverlapRatio: 0.5,
        enableCodeOverlap: true
      };

      processor.setOverlapOptions(options);

      expect(mockLogger.debug).toHaveBeenCalledWith('Overlap options updated', options);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex code file processing', async () => {
      const chunks = [
        createMockChunk('function test1() { return 1; }', 1, 3),
        createMockChunk('Small', 4, 4), // Will be merged
        createMockChunk('function test2() { return 2; }', 5, 7),
        createMockChunk('A'.repeat(2500), 8, 50), // Will be split
        createMockChunk('Normal chunk', 51, 52)
      ];
      const context = createMockContext(true, false, 200, 2000);

      const result = await processor.process(chunks, context);

      expect(result.length).toBeGreaterThan(3);
      expect(result[0].content).toContain('function test1() { return 1; }\nSmall');
      expect(result[1].content).toContain('function test2() { return 2; }\nTiny');
      expect(result.some(chunk => chunk.content.includes('A'.repeat(2500)))).toBe(false); // Large chunk should be split
    });

    it('should handle complex text file processing', async () => {
      const chunks = [
        createMockChunk('# Title\n\nContent section 1', 1, 5, 'heading'),
        createMockChunk('## Subtitle\n\nContent section 2', 6, 10, 'heading'),
        createMockChunk('```javascript\nfunction test() { return 1; }\n```', 11, 15, 'code_block'),
        createMockChunk('- Item 1\n- Item 2\n- Item 3', 16, 18, 'list')
      ];
      const context = createMockContext(false);

      const result = await processor.process(chunks, context);

      expect(result).toHaveLength(4);
      expect(result[0].content).toContain('# Title\n\nContent section 1');
      expect(result[0].content).toContain('\n'); // Should have overlap
      expect(result[3].content).toBe('- Item 1\n- Item 2\n- Item 3');
    });

    it('should handle edge cases gracefully', async () => {
      const emptyChunks: CodeChunk[] = [];
      const singleChunk = [createMockChunk('Single chunk', 1, 1)];
      const largeChunks = [
        createMockChunk('A'.repeat(5000), 1, 100),
        createMockChunk('B'.repeat(3000), 101, 200)
      ];

      // Test empty chunks
      const emptyResult = await processor.process(emptyChunks, createMockContext());
      expect(emptyResult).toEqual([]);

      // Test single chunk
      const singleResult = await processor.process(singleChunk, createMockContext());
      expect(singleResult).toEqual(singleChunk);

      // Test large chunks
      const largeResult = await processor.process(largeChunks, createMockContext(true, false, 200, 2000));
      expect(largeResult.length).toBeGreaterThan(1);
    });
  });
});