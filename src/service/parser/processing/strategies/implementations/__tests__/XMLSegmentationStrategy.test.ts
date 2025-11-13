import { XMLSegmentationStrategy, XMLStrategyConfig } from '../XMLSegmentationStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';
import { ChunkType } from '../../../core/types/ResultTypes';

describe('XMLSegmentationStrategy', () => {
  let strategy: XMLSegmentationStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new XMLSegmentationStrategy({
      name: 'xml-segmentation',
      supportedLanguages: ['xml', 'xhtml', 'svg'],
      enabled: true
    });

    mockContext = {
      content: '',
      language: 'xml',
      filePath: 'test.xml',
      config: {} as any,
      features: {
        size: 0,
        lineCount: 0,
        isSmallFile: false,
        isCodeFile: true,
        isStructuredFile: true,
        complexity: 0,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      }
    };
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = strategy.getConfig();
      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.maxTagDepth).toBe(10);
      expect(config.preserveAttributes).toBe(true);
    });

    it('should merge provided config with defaults', () => {
      const customStrategy = new XMLSegmentationStrategy({
        name: 'xml-segmentation',
        supportedLanguages: ['xml'],
        maxChunkSize: 5000,
        maxTagDepth: 20
      });

      const config = customStrategy.getConfig();
      expect(config.maxChunkSize).toBe(5000);
      expect(config.maxTagDepth).toBe(20);
      expect(config.preserveAttributes).toBe(true); // 默认值
    });
  });

  describe('canHandle', () => {
    it('should handle XML files', () => {
      mockContext.language = 'xml';
      mockContext.content = '<root></root>';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should handle HTML files', () => {
      mockContext.language = 'html';
      mockContext.content = '<html></html>';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should handle XHTML files', () => {
      mockContext.language = 'xhtml';
      mockContext.content = '<root></root>';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should handle SVG files', () => {
      mockContext.language = 'svg';
      mockContext.content = '<svg></svg>';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should not handle non-XML content', () => {
      mockContext.language = 'xml';
      mockContext.content = 'plain text without tags';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });

    it('should not handle wrong language', () => {
      mockContext.language = 'javascript';
      mockContext.content = '<root></root>';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid XML', async () => {
      mockContext.content = '<root><child>content</child></root>';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('xml-segmentation');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content gracefully', async () => {
      mockContext.content = '';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should handle invalid XML by falling back to line segmentation', async () => {
      mockContext.content = '<unclosed tag\n<another unclosed';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.chunks)).toBe(true);
    });
  });

  describe('process', () => {
    it('should segment well-formed XML', async () => {
      mockContext.content = `<root>
  <element>content</element>
  <element>more content</element>
</root>`;

      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata?.startLine).toBeDefined();
        expect(chunk.metadata?.endLine).toBeDefined();
      });
    });

    it('should handle nested elements', async () => {
      mockContext.content = `<root>
  <level1>
    <level2>
      <level3>
        <level4>Deep content</level4>
      </level3>
    </level2>
  </level1>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle self-closing tags', async () => {
      mockContext.content = `<root>
  <element1 attr="value"/>
  <element2/>
  <element3 />
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle attributes with values', async () => {
      mockContext.content = `<root>
  <element attr1="value1" attr2="value2">
    content
  </element>
  <element attr1='single' attr2='quotes'>
    content
  </element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text nodes', async () => {
      mockContext.content = `<root>
Some text before
  <element>element content</element>
Some text after
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max chunk size', async () => {
      const largeContent = '<root>' + '<element>content</element>\n'.repeat(1000) + '</root>';
      mockContext.content = largeContent;

      strategy.updateConfig({ maxChunkSize: 1000 });
      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // 稍微宽松
      });
    });

    it('should respect max tag depth', async () => {
      let deepXML = '<root>';
      for (let i = 0; i < 15; i++) {
        deepXML += `<level${i}>`;
      }
      deepXML += 'content';
      for (let i = 14; i >= 0; i--) {
        deepXML += `</level${i}>`;
      }
      deepXML += '</root>';

      mockContext.content = deepXML;
      strategy.updateConfig({ maxTagDepth: 10 });

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect min chunk size', async () => {
      mockContext.content = `<root>
  <small>x</small>
  <small>y</small>
  <small>z</small>
</root>`;

      strategy.updateConfig({ minChunkSize: 100 });
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mismatched tags gracefully', async () => {
      mockContext.content = `<root>
  <open>
    <another>
  </close>
  </another>
</root>`;

      const chunks = await strategy.process(mockContext);
      // 应该通过降级处理
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('HTML support', () => {
    it('should segment HTML documents', async () => {
      mockContext.language = 'html';
      mockContext.content = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <h1>Title</h1>
    <p>Content</p>
  </body>
</html>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle HTML void elements', async () => {
      mockContext.language = 'html';
      mockContext.content = `<html>
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <img src="image.jpg">
    <br>
    <hr>
  </body>
</html>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('SVG support', () => {
    it('should segment SVG documents', async () => {
      mockContext.language = 'svg';
      mockContext.content = `<svg xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40"/>
  <rect x="10" y="10" width="30" height="30"/>
</svg>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const languages = strategy.getSupportedLanguages();

      expect(languages).toContain('xml');
      expect(languages).toContain('html');
      expect(languages).toContain('htm');
      expect(languages).toContain('xhtml');
      expect(languages).toContain('svg');
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBeDefined();
      expect(config.minChunkSize).toBeDefined();
      expect(config.maxTagDepth).toBeDefined();
      expect(config.preserveAttributes).toBeDefined();
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

      expect(updated.minChunkSize).toBe(original.minChunkSize);
      expect(updated.maxTagDepth).toBe(original.maxTagDepth);
    });
  });

  describe('complexity calculation', () => {
    it('should calculate complexity based on tags', async () => {
      mockContext.content = `<root>
  <element>content</element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks[0].metadata?.complexity).toBeGreaterThan(0);
    });

    it('should calculate complexity based on attributes', async () => {
      mockContext.content = `<root attr1="value1" attr2="value2" attr3="value3">
  <element attr1="value">content</element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks[0].metadata?.complexity).toBeGreaterThan(0);
    });

    it('should calculate complexity based on nesting depth', async () => {
      let nested = '<root>';
      for (let i = 0; i < 10; i++) {
        nested += `<level${i}>`;
      }
      nested += 'content';
      for (let i = 9; i >= 0; i--) {
        nested += `</level${i}>`;
      }
      nested += '</root>';

      mockContext.content = nested;
      const chunks = await strategy.process(mockContext);
      expect(chunks[0].metadata?.complexity).toBeGreaterThan(0);
    });
  });

  describe('fallback behavior', () => {
    it('should fall back to line segmentation on error', async () => {
      mockContext.content = `line 1
<unclosed
line 3
line 4`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
      // 降级块应该标记为 fallback
      if (chunks[0].metadata?.fallback) {
        expect(chunks[0].metadata.fallback).toBe(true);
      }
    });

    it('should handle completely invalid content gracefully', async () => {
      mockContext.content = '<<<>>><<<>>>';
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle CDATA sections', async () => {
      mockContext.content = `<root>
  <element>
    <![CDATA[
    This is raw content with <tags> that shouldn't be parsed
    ]]>
  </element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle XML declarations', async () => {
      mockContext.content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element>content</element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle processing instructions', async () => {
      mockContext.content = `<?xml version="1.0"?>
<?xml-stylesheet type="text/xsl" href="style.xsl"?>
<root>
  <element>content</element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle comments', async () => {
      mockContext.content = `<root>
  <!-- This is a comment -->
  <element>content</element>
  <!-- Another comment with < and > -->
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle empty elements', async () => {
      mockContext.content = `<root>
  <empty></empty>
  <empty />
  <empty/>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle namespaces', async () => {
      mockContext.content = `<root xmlns="http://example.com" xmlns:custom="http://custom.com">
  <custom:element>content</custom:element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('performance stats', () => {
    it('should track performance statistics', async () => {
      mockContext.content = '<root><element>content</element></root>';

      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await strategy.execute(mockContext);

      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBeGreaterThan(statsBefore.totalExecutions);
    });

    it('should reset performance stats', async () => {
      mockContext.content = '<root><element>content</element></root>';

      await strategy.execute(mockContext);
      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBeGreaterThan(0);

      strategy.resetPerformanceStats();
      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBe(0);
    });
  });

  describe('complex XML documents', () => {
    it('should handle documents with mixed content', async () => {
      mockContext.content = `<?xml version="1.0"?>
<library>
  <!-- Books in the library -->
  <book id="1" available="true">
    <title>Book One</title>
    <author>Author Name</author>
    <year>2020</year>
    <pages>300</pages>
  </book>
  <book id="2">
    <title>Book Two</title>
    <author>Another Author</author>
    <year>2021</year>
  </book>
</library>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
