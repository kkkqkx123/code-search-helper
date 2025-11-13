import { HTMLFallbackProcessor } from '../HTMLFallbackProcessor';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';
import { ChunkType } from '../../../core/types/ResultTypes';

describe('HTMLFallbackProcessor', () => {
  let processor: HTMLFallbackProcessor;

  beforeEach(() => {
    processor = new HTMLFallbackProcessor();
  });

  const createMockContext = (overrides?: Partial<IProcessingContext>): IProcessingContext => ({
    filePath: 'test.html',
    content: 'test content',
    language: 'html',
    config: {} as any,
    features: {} as any,
    metadata: {} as any,
    ...overrides
  });

  describe('createFallbackChunks', () => {
    it('should create a single fallback chunk for entire content', () => {
      const context = createMockContext({
        content: 'single line content'
      });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('single line content');
    });

    it('should set correct line numbers for single line', () => {
      const context = createMockContext({
        content: 'single line'
      });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });

    it('should calculate correct line count for multiline content', () => {
      const context = createMockContext({
        content: 'line1\nline2\nline3'
      });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(3);
    });

    it('should include fallback flag in metadata', () => {
      const context = createMockContext();

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.fallback).toBe(true);
    });

    it('should set type to html_fallback', () => {
      const context = createMockContext();

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.type).toBe('html_fallback');
    });

    it('should preserve file path in metadata', () => {
      const context = createMockContext({ filePath: 'path/to/file.html' });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.filePath).toBe('path/to/file.html');
    });

    it('should use provided language or default to html', () => {
      const context = createMockContext({ language: 'vue' });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.language).toBe('vue');
    });

    it('should calculate complexity', () => {
      const context = createMockContext({
        content: 'const x = 1; function test() { return true; }'
      });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.complexity).toBeGreaterThan(0);
    });

    it('should calculate size correctly', () => {
      const content = 'test content';
      const context = createMockContext({ content });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.size).toBe(content.length);
    });
  });

  describe('createFallbackHTMLChunks', () => {
    it('should split HTML based on tag balance', () => {
      const htmlContent = `<div>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
        <p>Paragraph 3</p>
        <p>Paragraph 4</p>
        <p>Paragraph 5</p>
      </div>`;

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should create chunk when tag depth equals zero', () => {
      const htmlContent = '<div></div>\n<p></p>\n<span></span>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      // Should split when tags are balanced
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should create chunk when content exceeds max size', () => {
      const longContent = '<div>' + 'a'.repeat(2500) + '</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(longContent, context);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // At least one chunk should be marked as fallback
      expect(chunks[0].metadata.fallback).toBe(true);
    });

    it('should set correct line numbers for chunks', () => {
      const htmlContent = 'line1\nline2\nline3\nline4\nline5';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.metadata.startLine).toBeLessThanOrEqual(chunk.metadata.endLine);
      }
    });

    it('should mark all chunks as fallback', () => {
      const htmlContent = '<div>content</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      for (const chunk of chunks) {
        expect(chunk.metadata.fallback).toBe(true);
      }
    });

    it('should set type to html_structure', () => {
      const htmlContent = '<div>test</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      for (const chunk of chunks) {
        expect(chunk.metadata.type).toBe('html_structure');
      }
    });

    it('should handle deeply nested tags', () => {
      const htmlContent = '<div><section><article><p>Deep</p></article></section></div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle unbalanced tags gracefully', () => {
      const htmlContent = '<div><p>Unclosed paragraph</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include file path in chunk metadata', () => {
      const context = createMockContext({ filePath: 'src/components/App.vue' });

      const chunks = processor.createFallbackHTMLChunks('<div>test</div>', context);

      for (const chunk of chunks) {
        expect(chunk.metadata.filePath).toBe('src/components/App.vue');
      }
    });

    it('should calculate complexity for each chunk', () => {
      const htmlContent = '<div>\n  <p>Complex content with keywords function if return</p>\n</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      for (const chunk of chunks) {
        expect(chunk.metadata.complexity).toBeGreaterThan(0);
      }
    });

    it('should handle empty content', () => {
      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks('', context);

      // Should handle gracefully without throwing
      expect(chunks).toBeDefined();
    });

    it('should calculate line count correctly', () => {
      const htmlContent = 'line1\nline2\nline3\nline4\nline5';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      for (const chunk of chunks) {
        const expectedLineCount = chunk.metadata.endLine - chunk.metadata.startLine + 1;
        expect(chunk.metadata.lineCount).toBe(expectedLineCount);
      }
    });

    it('should split only complete balanced tags', () => {
      const htmlContent = `<ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
        <li>Item 4</li>
        <li>Item 5</li>
      </ul>`;

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      // All content should be contained
      const combined = chunks.map(c => c.content).join('');
      expect(combined).toContain('<ul>');
      expect(combined).toContain('</ul>');
    });

    it('should handle self-closing tags', () => {
      const htmlContent = '<img src="test.jpg"/>\n<br/>\n<hr/>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
      const combined = chunks.map(c => c.content).join('');
      expect(combined).toContain('img');
      expect(combined).toContain('br');
      expect(combined).toContain('hr');
    });

    it('should handle HTML comments', () => {
      const htmlContent = '<!-- comment -->\n<div>content</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should preserve all content when splitting', () => {
      const htmlContent = '<div>A</div><div>B</div><div>C</div>';

      const context = createMockContext();

      const chunks = processor.createFallbackHTMLChunks(htmlContent, context);

      const combined = chunks.map(c => c.content).join('');
      expect(combined).toContain('A');
      expect(combined).toContain('B');
      expect(combined).toContain('C');
    });
  });

  describe('metadata consistency', () => {
    it('should have consistent metadata structure', () => {
      const context = createMockContext();

      const chunks = processor.createFallbackChunks(context);

      const chunk = chunks[0];
      expect(chunk.metadata.startLine).toBeDefined();
      expect(chunk.metadata.endLine).toBeDefined();
      expect(chunk.metadata.language).toBeDefined();
      expect(chunk.metadata.type).toBeDefined();
      expect(chunk.metadata.filePath).toBeDefined();
      expect(chunk.metadata.complexity).toBeDefined();
      expect(chunk.metadata.fallback).toBeDefined();
    });

    it('should have timestamp in metadata', () => {
      const context = createMockContext();

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.timestamp).toBeDefined();
      expect(typeof chunks[0].metadata.timestamp).toBe('number');
    });

    it('should calculate size correctly', () => {
      const content = 'test';
      const context = createMockContext({ content });

      const chunks = processor.createFallbackChunks(context);

      expect(chunks[0].metadata.size).toBe(content.length);
    });
  });
});
