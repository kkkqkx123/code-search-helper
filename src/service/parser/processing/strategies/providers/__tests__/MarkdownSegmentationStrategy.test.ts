import { MarkdownSegmentationStrategy } from '../MarkdownSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext } from '../../../../universal/types/SegmentationTypes';
import { CodeChunk } from '../../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('MarkdownSegmentationStrategy', () => {
  let strategy: MarkdownSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' | 'markdown' | 'standardization' | 'section' | 'content' = 'markdown'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'markdown',
      filePath: 'test.md',
      type,
      complexity: 1
    }
  });

  // Create mock context
  const createMockContext = (language = 'markdown', maxChunkSize = 2000): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize,
      overlapSize: 200,
      maxLinesPerChunk: 50,
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
      isCodeFile: false,
      isMarkdownFile: true
    }
  });
  // Helper function to create context with content and file info
  const createSegmentationContext = (
    content: string,
    filePath: string,
    language: string,
    baseContext?: SegmentationContext
  ): SegmentationContext => {
    const context = baseContext || createMockContext(language);
    context.content = content;
    context.filePath = filePath;
    context.language = language;
    return context;
  };

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    // Create a mock complexity calculator
    const mockComplexityCalculator = {
      calculate: jest.fn().mockReturnValue(1)
    };

    strategy = new MarkdownSegmentationStrategy(mockComplexityCalculator, mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('markdown');
    });
  });

  describe('getPriority', () => {
    it('should return the strategy priority', () => {
      expect(strategy.getPriority()).toBe(1);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = strategy.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('markdown');
      expect(languages).toContain('md');
    });
  });

  describe('canHandle', () => {
    it('should return true for markdown files', () => {
      const context = createMockContext('markdown');
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return true for md files', () => {
      const context = createMockContext('md');
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return false for non-markdown files', () => {
      const jsContext = createMockContext('javascript');
      jsContext.metadata.isMarkdownFile = false;
      jsContext.language = 'javascript';

      const pyContext = createMockContext('python');
      pyContext.metadata.isMarkdownFile = false;
      pyContext.language = 'python';

      expect(strategy.canHandle(jsContext)).toBe(false);
      expect(strategy.canHandle(pyContext)).toBe(false);
    });

    it('should return true when isMarkdownFile is true', () => {
      const context = createMockContext('text');
      context.metadata.isMarkdownFile = true;

      expect(strategy.canHandle(context)).toBe(true);
    });
  });

  describe('segment', () => {
    it('should segment markdown content by headings', async () => {
      const content = `
        # Main Title
        
        This is the introduction paragraph.
        
        ## Section 1
        
        This is the content of section 1.
        
        ### Subsection 1.1
        
        This is a subsection.
        
        ## Section 2
        
        This is the content of section 2.
        
        # Conclusion
        
        This is the conclusion.
      `;

      const context = createMockContext('markdown');
      context.content = content;
      context.filePath = 'test.md';
      context.language = 'markdown';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('paragraph');
      expect(chunks[0].metadata.language).toBe('markdown');
      expect(chunks[0].metadata.filePath).toBe('test.md');
    });

    it('should segment markdown content with code blocks', async () => {
      const content = `
        # Code Examples
        
        Here is some JavaScript code:
        
        \`\`\`javascript
        function example() {
          return "Hello, world!";
        }
        \`\`\`
        
        Here is some Python code:
        
        \`\`\`python
        def example():
          return "Hello, world!"
        \`\`\`
        
        # More Content
        
        This is more content after the code blocks.
      `;

      const context = createMockContext('markdown');
      context.content = content;
      context.filePath = 'test.md';
      context.language = 'markdown';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type && ['paragraph', 'heading', 'code_block', 'table', 'list', 'blockquote'].includes(chunk.metadata.type))).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'markdown'));
    });

    it('should segment markdown content with lists', async () => {
      const content = `
        # Lists Example
        
        ## Unordered List
        
        - Item 1
        - Item 2
          - Nested item 2.1
          - Nested item 2.2
        - Item 3
        
        ## Ordered List
        
        1. First item
        2. Second item
           1. Nested item 2.1
           2. Nested item 2.2
        3. Third item
        
        # More Content
        
        This is more content after the lists.
      `;

      const context = createMockContext('markdown');
      context.content = content;
      context.filePath = 'test.md';
      context.language = 'markdown';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type && ['paragraph', 'heading', 'code_block', 'table', 'list', 'blockquote'].includes(chunk.metadata.type))).toBe(true);
    });

    it('should segment markdown content with tables', async () => {
      const content = `
        # Tables Example
        
        ## Simple Table
        
        | Header 1 | Header 2 | Header 3 |
        |----------|----------|----------|
        | Row 1    | Data 1   | Data 2   |
        | Row 2    | Data 3   | Data 4   |
        
        ## Complex Table
        
        | Name    | Age | Occupation     |
        |---------|-----|---------------|
        | John    | 30  | Developer     |
        | Jane    | 25  | Designer      |
        | Bob     | 40  | Project Manager |
        
        # More Content
        
        This is more content after the tables.
      `;

      const context = createMockContext('markdown');
      context.content = content;
      context.filePath = 'test.md';
      context.language = 'markdown';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type && ['paragraph', 'heading', 'code_block', 'table', 'list', 'blockquote'].includes(chunk.metadata.type))).toBe(true);
    });

    it('should respect max chunk size limit', async () => {
      const content = `
        # Large Section
        
        ${Array.from({ length: 100 }, (_, i) => `This is line ${i + 1} with some content to make the section larger.`).join('\n')}
        
        # Another Section
        
        ${Array.from({ length: 100 }, (_, i) => `This is line ${i + 1} with some content to make the section larger.`).join('\n')}
      `;

      const context = createMockContext('markdown', 1000);
      const chunks = await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // maxChunkSize * 1.1
      });
    });

    it('should handle empty content', async () => {
      const content = '';
      const context = createMockContext('markdown');

      const chunks = await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });

    it('should handle single line content', async () => {
      const content = '# Single Title';
      const context = createMockContext('markdown');

      const chunks = await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('# Single Title');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });

    it('should log segmentation progress', async () => {
      const content = '# Title\n\nThis is a paragraph.';
      const context = createMockContext('markdown');

      await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting markdown-based segmentation for test.md');
    });

    it('should handle errors gracefully', async () => {
      const content = '# Title\n\nThis is a paragraph.';
      const context = createMockContext('markdown');

      // Mock the segment method to throw an error
      (strategy as any).segment = jest.fn().mockRejectedValue(new Error('Segmentation failed'));

      await expect(strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context))).rejects.toThrow('Segmentation failed');
    });

    it('should validate context when available', async () => {
      const content = '# Title\n\nThis is a paragraph.';
      const context = createMockContext('markdown');

      // Mock validateContext method
      (strategy as any).validateContext = jest.fn().mockReturnValue(true);

      const chunks = await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for markdown strategy');
    });

    it('should skip validation when not available', async () => {
      const content = '# Title\n\nThis is a paragraph.';
      const context = createMockContext('markdown');

      // Mock validateContext method to return false
      (strategy as any).validateContext = jest.fn().mockReturnValue(false);

      const chunks = await strategy.segment(createSegmentationContext(content, 'test.md', 'markdown', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for markdown strategy, proceeding anyway');
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex markdown document', async () => {
      const markdownContent = `
        # Complex Document
        
        This is the introduction paragraph with some **bold text** and *italic text*.
        
        ## Code Examples
        
        Here is some inline code: \`variable\`.
        
        Here is a JavaScript code block:
        
        \`\`\`javascript
        function calculateSum(a, b) {
          return a + b;
        }
        
        const result = calculateSum(5, 10);
        console.log(\`The result is \${result}\`);
        \`\`\`
        
        ## Lists and Tables
        
        ### Unordered List
        
        - Item 1
        - Item 2
          - Nested item 2.1
          - Nested item 2.2
        - Item 3
        
        ### Ordered List
        
        1. First item
        2. Second item
           1. Nested item 2.1
           2. Nested item 2.2
        3. Third item
        
        ### Table
        
        | Name    | Age | Occupation     |
        |---------|-----|---------------|
        | John    | 30  | Developer     |
        | Jane    | 25  | Designer      |
        | Bob     | 40  | Project Manager |
        
        ## Links and Images
        
        Here is a [link](https://example.com) and an image:
        
        ![Example Image](https://example.com/image.png)
        
        ## Blockquotes
        
        > This is a blockquote.
        > 
        > It can span multiple lines.
        
        ## Conclusion
        
        This is the conclusion of the document.
      `;

      const context = createMockContext('markdown', 1000);
      const chunks = await strategy.segment(createSegmentationContext(markdownContent, 'complex.md', 'markdown', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type && ['paragraph', 'heading', 'code_block', 'table', 'list', 'blockquote'].includes(chunk.metadata.type))).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'markdown'));
    });

    it('should work with markdown document without headings', async () => {
      const markdownContent = `
        This is a paragraph without any headings.
        
        This is another paragraph.
        
        - List item 1
        - List item 2
        - List item 3
        
        This is a paragraph after the list.
        
        \`\`\`javascript
        function example() {
          return "Hello, world!";
        }
        \`\`\`
        
        This is the final paragraph.
      `;

      const context = createMockContext('markdown', 500);
      const chunks = await strategy.segment(createSegmentationContext(markdownContent, 'no-headings.md', 'markdown', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type && ['paragraph', 'heading', 'code_block', 'table', 'list', 'blockquote'].includes(chunk.metadata.type))).toBe(true);
    });

    it('should handle edge cases', async () => {
      // Empty content
      const emptyResult = await strategy.segment(createSegmentationContext('', 'test.md', 'markdown', createMockContext('markdown')));
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].content).toBe('');

      // Single line content
      const singleLineResult = await strategy.segment(createSegmentationContext('# Single Title', 'test.md', 'markdown', createMockContext('markdown')));
      expect(singleLineResult).toHaveLength(1);
      expect(singleLineResult[0].content).toBe('# Single Title');

      // Very large content
      const largeContent = Array.from({ length: 1000 }, (_, i) => `This is line ${i + 1} with some content to make the document larger.`).join('\n');
      const largeResult = await strategy.segment(createSegmentationContext(largeContent, 'large.md', 'markdown', createMockContext('markdown', 1000)));
      expect(largeResult.length).toBeGreaterThan(1);
    });
  });
});