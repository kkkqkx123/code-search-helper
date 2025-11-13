import { HTMLContentSeparator } from '../HTMLContentSeparator';
import { HTMLContentExtractor } from '../HTMLContentExtractor';

describe('HTMLContentSeparator', () => {
  let separator: HTMLContentSeparator;
  let mockExtractor: jest.Mocked<HTMLContentExtractor>;

  beforeEach(() => {
    mockExtractor = {
      extractScripts: jest.fn(),
      extractStyles: jest.fn(),
      detectScriptLanguage: jest.fn(),
      detectStyleType: jest.fn()
    } as any;

    separator = new HTMLContentSeparator(mockExtractor);
  });

  describe('separateContent', () => {
    it('should separate HTML with script and style tags', () => {
      const html = `
        <div>
          <h1>Title</h1>
          <script>console.log("test");</script>
          <p>Content</p>
          <style>.test { color: red; }</style>
        </div>
      `;

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'console.log("test");',
        language: 'javascript',
        position: { start: 0, end: 25, line: 4, column: 1 },
        attributes: {},
        contentHash: 'hash1'
      }]);

      mockExtractor.extractStyles.mockReturnValue([{
        id: 'style_0',
        content: '.test { color: red; }',
        styleType: 'css',
        position: { start: 0, end: 21, line: 6, column: 1 },
        attributes: {},
        contentHash: 'hash2'
      }]);

      const result = separator.separateContent(html);

      expect(result.scripts).toHaveLength(1);
      expect(result.styles).toHaveLength(1);
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('</script>');
      expect(result.html).not.toContain('<style>');
      expect(result.html).not.toContain('</style>');
    });

    it('should extract scripts correctly', () => {
      const html = '<div><script>var x = 1;</script></div>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'var x = 1;',
        language: 'javascript',
        position: { start: 5, end: 35, line: 1, column: 6 },
        attributes: {},
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.scripts).toHaveLength(1);
      expect(result.scripts[0].content).toBe('var x = 1;');
    });

    it('should extract styles correctly', () => {
      const html = '<div><style>.cls { color: blue; }</style></div>';

      mockExtractor.extractScripts.mockReturnValue([]);
      mockExtractor.extractStyles.mockReturnValue([{
        id: 'style_0',
        content: '.cls { color: blue; }',
        styleType: 'css',
        position: { start: 5, end: 45, line: 1, column: 6 },
        attributes: {},
        contentHash: 'hash'
      }]);

      const result = separator.separateContent(html);

      expect(result.styles).toHaveLength(1);
      expect(result.styles[0].content).toBe('.cls { color: blue; }');
    });

    it('should return clean HTML without script and style tags', () => {
      const html = '<div><p>Text</p><script>code</script><style>css</style></div>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'code',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash1'
      }]);

      mockExtractor.extractStyles.mockReturnValue([{
        id: 'style_0',
        content: 'css',
        styleType: 'css',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash2'
      }]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('<div>');
      expect(result.html).toContain('<p>Text</p>');
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('<style>');
    });

    it('should handle multiple script tags', () => {
      const html = '<script>a</script><script>b</script>';

      mockExtractor.extractScripts.mockReturnValue([
        {
          id: 'script_0',
          content: 'a',
          language: 'javascript',
          position: { start: 0, end: 18, line: 1, column: 1 },
          attributes: {},
          contentHash: 'hash1'
        },
        {
          id: 'script_1',
          content: 'b',
          language: 'javascript',
          position: { start: 18, end: 36, line: 1, column: 19 },
          attributes: {},
          contentHash: 'hash2'
        }
      ]);

      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.scripts).toHaveLength(2);
      expect(result.html).toBe('');
    });

    it('should handle multiple style tags', () => {
      const html = '<style>a</style><style>b</style>';

      mockExtractor.extractScripts.mockReturnValue([]);
      mockExtractor.extractStyles.mockReturnValue([
        {
          id: 'style_0',
          content: 'a',
          styleType: 'css',
          position: { start: 0, end: 16, line: 1, column: 1 },
          attributes: {},
          contentHash: 'hash1'
        },
        {
          id: 'style_1',
          content: 'b',
          styleType: 'css',
          position: { start: 16, end: 32, line: 1, column: 17 },
          attributes: {},
          contentHash: 'hash2'
        }
      ]);

      const result = separator.separateContent(html);

      expect(result.styles).toHaveLength(2);
      expect(result.html).toBe('');
    });

    it('should preserve HTML structure when removing scripts and styles', () => {
      const html = `
        <html>
          <head>
            <style>body { margin: 0; }</style>
          </head>
          <body>
            <div class="container">
              <p>Content</p>
            </div>
            <script>console.log("done");</script>
          </body>
        </html>
      `;

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'console.log("done");',
        language: 'javascript',
        position: { start: 0, end: 0, line: 10, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([{
        id: 'style_0',
        content: 'body { margin: 0; }',
        styleType: 'css',
        position: { start: 0, end: 0, line: 4, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('<html>');
      expect(result.html).toContain('<body>');
      expect(result.html).toContain('class="container"');
      expect(result.html).toContain('<p>Content</p>');
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('<style>');
    });

    it('should handle content with no scripts or styles', () => {
      const html = '<div><p>Only HTML</p></div>';

      mockExtractor.extractScripts.mockReturnValue([]);
      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.scripts).toHaveLength(0);
      expect(result.styles).toHaveLength(0);
      expect(result.html).toBe(html);
    });

    it('should handle nested script-like content in comments', () => {
      const html = '<!-- <script>not real</script> --><p>Test</p>';

      mockExtractor.extractScripts.mockReturnValue([]);
      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('<!-- <script>');
    });

    it('should be case-insensitive when removing tags', () => {
      const html = '<SCRIPT>code</SCRIPT><STYLE>css</STYLE>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'code',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([{
        id: 'style_0',
        content: 'css',
        styleType: 'css',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      const result = separator.separateContent(html);

      expect(result.html).toBe('');
    });

    it('should use default extractor when none provided', () => {
      const sep = new HTMLContentSeparator();
      const html = '<script>a</script>';

      // Should not throw
      expect(() => sep.separateContent(html)).not.toThrow();
    });

    it('should handle self-closing tags', () => {
      const html = '<div><img src="test.jpg"/><script>code</script></div>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'code',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('<img src="test.jpg"/>');
    });

    it('should handle script with attributes', () => {
      const html = '<script type="module" src="app.js"></script>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: '',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: { type: 'module', src: 'app.js' },
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.html).not.toContain('script');
    });
  });

  describe('separation accuracy', () => {
    it('should not remove scripts from within HTML attributes', () => {
      const html = '<div data-script="<script>"></div>';

      mockExtractor.extractScripts.mockReturnValue([]);
      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('data-script="<script>"');
    });

    it('should remove only actual script tags', () => {
      const html = '<div>description: use <script> tag</div><script>real</script>';

      mockExtractor.extractScripts.mockReturnValue([{
        id: 'script_0',
        content: 'real',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      }]);

      mockExtractor.extractStyles.mockReturnValue([]);

      const result = separator.separateContent(html);

      expect(result.html).toContain('use <script> tag');
      expect(result.scripts).toHaveLength(1);
    });
  });
});
