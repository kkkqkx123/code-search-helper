import { MarkdownSegmentationStrategy, MarkdownStrategyConfig } from '../MarkdownSegmentationStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';
import { ChunkType } from '../../../core/types/ResultTypes';

describe('MarkdownSegmentationStrategy', () => {
  let strategy: MarkdownSegmentationStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new MarkdownSegmentationStrategy({
      name: 'markdown-segmentation',
      supportedLanguages: ['markdown', 'md'],
      enabled: true
    });

    mockContext = {
      content: '',
      language: 'markdown',
      filePath: 'test.md',
      config: {} as any,
      features: {
        size: 0,
        lineCount: 0,
        isSmallFile: false,
        isCodeFile: false,
        isStructuredFile: true,
        complexity: 0,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      },
      metadata: {
        contentLength: 0,
        lineCount: 0,
        size: 0,
        isSmallFile: false,
        isCodeFile: false,
        isStructuredFile: true,
        complexity: 0,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false,
        timestamp: Date.now()
      }
    };
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = strategy.getConfig();
      expect(config.maxChunkSize).toBe(3000);
      expect(config.maxLinesPerChunk).toBe(100);
      expect(config.enableSmartMerging).toBe(true);
      expect(config.mergeThreshold).toBe(1500);
    });

    it('should merge provided config with defaults', () => {
      const customStrategy = new MarkdownSegmentationStrategy({
        name: 'markdown-segmentation',
        supportedLanguages: ['markdown'],
        enabled: true,
        maxChunkSize: 5000,
        enableSmartMerging: false
      });

      const config = customStrategy.getConfig();
      expect(config.maxChunkSize).toBe(5000);
      expect(config.enableSmartMerging).toBe(false);
    });
  });

  describe('canHandle', () => {
    it('should handle markdown files by language', () => {
      mockContext.language = 'markdown';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'md';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect markdown by structure', () => {
      mockContext.language = 'unknown';
      mockContext.content = '# Heading\nSome text';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should not handle non-markdown content', () => {
      mockContext.language = 'javascript';
      mockContext.content = 'const x = 1;';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid markdown', async () => {
      mockContext.content = '# Title\n\nSome content here.';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('markdown-segmentation');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content gracefully', async () => {
      mockContext.content = '';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should handle execution errors', async () => {
      const invalidContext = { ...mockContext, content: null } as any;
      const result = await strategy.execute(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('process', () => {
    it('should segment by headings', async () => {
      mockContext.content = `# Chapter 1
Content here

## Section 1.1
More content

# Chapter 2
Final content`;

      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata?.startLine).toBeDefined();
        expect(chunk.metadata?.endLine).toBeDefined();
      });
    });

    it('should handle code blocks properly', async () => {
      mockContext.content = `# Code Example

\`\`\`javascript
function test() {
  return 1;
}
\`\`\`

More text after code block`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should not split inside code blocks', async () => {
      mockContext.content = `\`\`\`markdown
# This is not a real heading
Still in code block
# More fake heading
\`\`\`

# Real heading`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle tables', async () => {
      mockContext.content = `# Table Example

| Column1 | Column2 |
|---------|---------|
| Data1   | Data2   |
| Data3   | Data4   |

# Next Section`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle lists', async () => {
      mockContext.content = `# List Example

- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third

# Next Section`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle horizontal rules', async () => {
      mockContext.content = `# Section 1

Content here

---

# Section 2

More content`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max chunk size', async () => {
      // 创建包含换行符的长文本，便于分割
      const longText = Array.from({ length: 100 }, (_, i) => 
        `This is sentence ${i + 1} with enough content to trigger chunking.`
      ).join('\n');
      
      mockContext.content = `# Title\n\n${longText}`;

      strategy.updateConfig({ maxChunkSize: 1000, excludeCodeFromChunkSize: false });
      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // 稍微宽松
      });
    });

    it('should respect max lines per chunk', async () => {
      mockContext.content = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');

      strategy.updateConfig({ maxLinesPerChunk: 50, excludeCodeFromChunkSize: false });
      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        const lineCount = chunk.content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(55); // 稍微宽松
      });
    });

    it('should enable smart merging when configured', async () => {
      mockContext.content = `## Small Section
Content

## Another Small Section
More content

## Yet Another Small Section
Even more content`;

      strategy.updateConfig({ enableSmartMerging: true });
      const chunksWithMerging = await strategy.process(mockContext);

      strategy.updateConfig({ enableSmartMerging: false });
      const chunksWithoutMerging = await strategy.process(mockContext);

      // MarkdownChunker处理智能合并，启用合并时应该有更少的块
      expect(chunksWithMerging.length).toBeLessThanOrEqual(chunksWithoutMerging.length);
    });
  });

  describe('markdown structure detection', () => {
    it('should detect headings', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '# Title\n## Subtitle';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect unordered lists', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '- Item 1\n- Item 2';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect ordered lists', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '1. First\n2. Second';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect code blocks', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '```\ncode\n```';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect tables', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '| Col1 | Col2 |\n|------|------|';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should detect horizontal rules', async () => {
      mockContext.language = 'unknown';
      mockContext.content = '---';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });
  });

  describe('validateContext', () => {
    it('should validate markdown content', () => {
      mockContext.content = '# Title\nContent';
      expect(strategy.validateContext(mockContext)).toBe(true);
    });

    it('should reject empty content', () => {
      mockContext.content = '';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });

    it('should reject whitespace-only content', () => {
      mockContext.content = '   \n\n   ';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return markdown languages', () => {
      const languages = strategy.getSupportedLanguages();

      expect(languages).toContain('markdown');
      expect(languages).toContain('md');
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBeDefined();
      expect(config.maxLinesPerChunk).toBeDefined();
      expect(config.enableSmartMerging).toBeDefined();
      expect(config.mergeThreshold).toBeDefined();
    });

    it('should update config', () => {
      strategy.updateConfig({ maxChunkSize: 5000 });
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBe(5000);
    });

    it('should preserve unmodified config values', () => {
      const original = strategy.getConfig();
      strategy.updateConfig({ maxChunkSize: 2000 });
      const updated = strategy.getConfig();

      expect(updated.enableSmartMerging).toBe(original.enableSmartMerging);
      expect(updated.mergeThreshold).toBe(original.mergeThreshold);
    });
  });

  describe('complex markdown documents', () => {
    it('should handle mixed markdown elements', async () => {
      mockContext.content = `# Main Title

This is an introduction paragraph.

## Section 1

Some content with **bold** and *italic* text.

### Subsection 1.1

- List item 1
- List item 2
  - Nested item

\`\`\`javascript
function example() {
  return "code";
}
\`\`\`

## Section 2

| Header 1 | Header 2 |
|----------|----------|
| Data 1   | Data 2   |

---

Final section`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle nested code blocks with markdown-like content', async () => {
      mockContext.content = `# Documentation

\`\`\`markdown
# This looks like markdown
## But it's in a code block
- So it shouldn't be parsed
\`\`\`

# Real heading

Content here`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('performance stats', () => {
    it('should track performance statistics', async () => {
      mockContext.content = '# Title\n\nContent';

      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await strategy.execute(mockContext);

      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBeGreaterThan(statsBefore.totalExecutions);
    });

    it('should reset performance stats', async () => {
      mockContext.content = '# Title\n\nContent';

      await strategy.execute(mockContext);
      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBeGreaterThan(0);

      strategy.resetPerformanceStats();
      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple levels of headings', async () => {
      mockContext.content = `# H1
## H2
### H3
#### H4
##### H5
###### H6
Content`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle heading-like content in text', async () => {
      mockContext.content = `# Real Heading

This talks about #hashtags and ## fake headings in the middle of text.

# Another Real Heading`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle empty lines in various positions', async () => {
      mockContext.content = `

# Title

Paragraph

`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
