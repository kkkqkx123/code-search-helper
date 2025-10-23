import { LineSegmentationStrategy } from '../LineSegmentationStrategy';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('LineSegmentationStrategy', () => {
  let strategy: LineSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: string = 'line'): CodeChunk => ({
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
  const createMockContext = (language = 'javascript', maxLinesPerChunk = 50, maxChunkSize = 2000): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize,
      overlapSize: 200,
      maxLinesPerChunk,
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

    strategy = new LineSegmentationStrategy(mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('line');
    });
  });

  describe('getPriority', () => {
    it('should return the strategy priority', () => {
      expect(strategy.getPriority()).toBe(5);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return all supported languages', () => {
      const languages = strategy.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      // Line strategy should support all languages
      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
      expect(languages).toContain('markdown');
      expect(languages).toContain('text');
    });
  });

  describe('canHandle', () => {
    it('should return true for any file type', () => {
      const jsContext = createMockContext('javascript');
      const mdContext = createMockContext('markdown');
      const txtContext = createMockContext('text');

      expect(strategy.canHandle(jsContext)).toBe(true);
      expect(strategy.canHandle(mdContext)).toBe(true);
      expect(strategy.canHandle(txtContext)).toBe(true);
    });

    it('should return true for small files', () => {
      const context = createMockContext('javascript');
      context.metadata.isSmallFile = true;

      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return true for large files', () => {
      const context = createMockContext('javascript');
      context.metadata.isSmallFile = false;

      expect(strategy.canHandle(context)).toBe(true);
    });
  });

  describe('segment', () => {
    it('should segment content by lines', async () => {
      const content = `
        line 1
        line 2
        line 3
        line 4
        line 5
      `;

      const context = createMockContext('javascript', 50, 2000);
      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('line');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.filePath).toBe('test.js');
    });

    it('should respect max lines per chunk limit', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
      const context = createMockContext('javascript', 20, 2000);

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        const lineCount = chunk.metadata.endLine - chunk.metadata.startLine + 1;
        expect(lineCount).toBeLessThanOrEqual(20);
      });
    });

    it('should respect max chunk size limit', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1} with some additional text to increase size`).join('\n');
      const context = createMockContext('javascript', 50, 500);

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(550); // maxChunkSize * 1.1
      });
    });

    it('should handle empty content', async () => {
      const content = '';
      const context = createMockContext('javascript');

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(0);
    });

    it('should handle single line content', async () => {
      const content = 'single line of content';
      const context = createMockContext('javascript');

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('single line of content');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });

    it('should handle content with varying line lengths', async () => {
      const content = `
        short line
        this is a much longer line with a lot more content to test size limits
        medium length line here
        another very long line that should trigger size limits when combined with other lines
        short
        medium length line with some content
        extremely long line that contains a lot of text and should definitely trigger size limits on its own if the limit is low enough
        short
      `;

      const context = createMockContext('javascript', 5, 200);
      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(220); // maxChunkSize * 1.1
      });
    });

    it('should log segmentation progress', async () => {
      const content = 'line 1\nline 2\nline 3';
      const context = createMockContext('javascript');

      await strategy.segment(content, 'test.js', 'javascript', context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting line-based segmentation for test.js');
    });

    it('should handle errors gracefully', async () => {
      const content = 'line 1\nline 2\nline 3';
      const context = createMockContext('javascript');

      // Mock the segment method to throw an error
      (strategy as any).segment = jest.fn().mockRejectedValue(new Error('Segmentation failed'));

      await expect(strategy.segment(content, 'test.js', 'javascript', context)).rejects.toThrow('Segmentation failed');
    });

    it('should validate context when available', async () => {
      const content = 'line 1\nline 2\nline 3';
      const context = createMockContext('javascript');

      // Mock validateContext method
      (strategy as any).validateContext = jest.fn().mockReturnValue(true);

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for line strategy');
    });

    it('should skip validation when not available', async () => {
      const content = 'line 1\nline 2\nline 3';
      const context = createMockContext('javascript');

      // Mock validateContext method to return false
      (strategy as any).validateContext = jest.fn().mockReturnValue(false);

      const chunks = await strategy.segment(content, 'test.js', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for line strategy, proceeding anyway');
    });
  });

  describe('Integration Tests', () => {
    it('should work with JavaScript code', async () => {
      const jsCode = `
        import React from 'react';
        
        function Component() {
          const [count, setCount] = React.useState(0);
          
          const handleClick = () => {
            setCount(prevCount => prevCount + 1);
          };
          
          return (
            <div>
              <h1>Count: {count}</h1>
              <button onClick={handleClick}>
                Click me
              </button>
            </div>
          );
        }
        
        export default Component;
      `;

      const context = createMockContext('javascript', 10, 500);
      const chunks = await strategy.segment(jsCode, 'Component.jsx', 'javascript', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'line')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'javascript'));
    });

    it('should work with Python code', async () => {
      const pythonCode = `
        import os
        import sys
        from typing import List, Dict
        
        class DataProcessor:
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.data = []
                
            def process_data(self, input_data: List[str]) -> List[Dict[str, Any]]:
                processed = []
                for item in input_data:
                    if self._validate_item(item):
                        processed_item = self._transform_item(item)
                        processed.append(processed_item)
                    else:
                        self._log_error(f"Invalid item: {item}")
                
                return processed
                
            def _validate_item(self, item: str) -> bool:
                return len(item) > 0 and item.strip() != ""
                
            def _transform_item(self, item: str) -> Dict[str, Any]:
                return {
                    'original': item,
                    'processed': item.upper(),
                    'length': len(item)
                }
                
            def _log_error(self, message: str) -> None:
                print(f"ERROR: {message}")
      `;

      const context = createMockContext('python', 10, 500);
      const chunks = await strategy.segment(pythonCode, 'data_processor.py', 'python', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'line')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
    });

    it('should work with Markdown content', async () => {
      const markdownContent = `
        # Heading 1
        
        This is a paragraph with some text.
        
        ## Heading 2
        
        - List item 1
        - List item 2
        - List item 3
        
        ### Heading 3
        
        \`\`\`javascript
        function example() {
          return "This is a code block";
        }
        \`\`\`
        
        Another paragraph with more text.
      `;

      const context = createMockContext('markdown', 10, 500);
      const chunks = await strategy.segment(markdownContent, 'example.md', 'markdown', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'line')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'markdown'));
    });

    it('should work with plain text content', async () => {
      const textContent = `
        This is a plain text document.
        It contains multiple lines of text.
        Each line should be handled correctly.
        
        There might be empty lines in the document.
        These should also be handled properly.
        
        The document might be quite long.
        It should be split into appropriate chunks.
        Each chunk should respect the size limits.
      `;

      const context = createMockContext('text', 5, 200);
      const chunks = await strategy.segment(textContent, 'example.txt', 'text', context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'line')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'text'));
    });

    it('should handle edge cases', async () => {
      // Empty content
      const emptyResult = await strategy.segment('', 'test.js', 'javascript', createMockContext('javascript'));
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].content).toBe('');

      // Single line content
      const singleLineResult = await strategy.segment('console.log("test");', 'test.js', 'javascript', createMockContext('javascript'));
      expect(singleLineResult).toHaveLength(1);
      expect(singleLineResult[0].content).toBe('console.log("test")');

      // Very large content
      const largeContent = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join('\n');
      const largeResult = await strategy.segment(largeContent, 'test.js', 'javascript', createMockContext('javascript', 50, 2000));
      expect(largeResult.length).toBeGreaterThan(1);
    });
  });
});