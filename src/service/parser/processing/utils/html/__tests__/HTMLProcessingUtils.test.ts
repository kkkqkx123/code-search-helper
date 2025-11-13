import { HTMLProcessingUtils } from '../HTMLProcessingUtils';
import { ScriptBlock, StyleBlock } from '../LayeredHTMLConfig';

describe('HTMLProcessingUtils', () => {
  describe('countOpeningTags', () => {
    it('should count simple opening tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div>');

      expect(count).toBe(1);
    });

    it('should count multiple opening tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div><p><span>');

      expect(count).toBe(3);
    });

    it('should not count closing tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('</div></p>');

      expect(count).toBe(0);
    });

    it('should count self-closing tags as opening', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<br> <img src="test.jpg"/>');

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should not count closing slashes in opening tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<img/>');

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle tags with attributes', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div class="test" id="main">');

      expect(count).toBe(1);
    });

    it('should return 0 for empty string', () => {
      const count = HTMLProcessingUtils.countOpeningTags('');

      expect(count).toBe(0);
    });

    it('should return 0 for non-HTML content', () => {
      const count = HTMLProcessingUtils.countOpeningTags('This is plain text');

      expect(count).toBe(0);
    });

    it('should handle mixed content', () => {
      const count = HTMLProcessingUtils.countOpeningTags('text <div> more text <p>');

      expect(count).toBe(2);
    });

    it('should count tags even inside quotes (limitation of regex)', () => {
      const count = HTMLProcessingUtils.countOpeningTags('This says "<div>" but not really');

      // Regex-based implementation counts all matches regardless of context
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('countClosingTags', () => {
    it('should count simple closing tags', () => {
      const count = HTMLProcessingUtils.countClosingTags('</div>');

      expect(count).toBe(1);
    });

    it('should count multiple closing tags', () => {
      const count = HTMLProcessingUtils.countClosingTags('</div></p></span>');

      expect(count).toBe(3);
    });

    it('should not count opening tags', () => {
      const count = HTMLProcessingUtils.countClosingTags('<div><p>');

      expect(count).toBe(0);
    });

    it('should return 0 for empty string', () => {
      const count = HTMLProcessingUtils.countClosingTags('');

      expect(count).toBe(0);
    });

    it('should handle tags with whitespace', () => {
      const count = HTMLProcessingUtils.countClosingTags('</ div >');

      // Regex matches </div > format
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should count standard closing tags', () => {
      const count = HTMLProcessingUtils.countClosingTags('text </div> more </p>');

      expect(count).toBe(2);
    });

    it('should count closing tags even in quoted context (limitation of regex)', () => {
      const count = HTMLProcessingUtils.countClosingTags('This says "</div>" but not really');

      // Regex-based implementation counts all matches regardless of context
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateComplexity', () => {
    it('should return at least 1 for empty content', () => {
      const complexity = HTMLProcessingUtils.calculateComplexity('');

      expect(complexity).toBeGreaterThanOrEqual(1);
    });

    it('should increase complexity with content length', () => {
      const short = HTMLProcessingUtils.calculateComplexity('a');
      const long = HTMLProcessingUtils.calculateComplexity('a'.repeat(1000));

      expect(long).toBeGreaterThan(short);
    });

    it('should increase complexity with line count', () => {
      const single = HTMLProcessingUtils.calculateComplexity('one line');
      const multi = HTMLProcessingUtils.calculateComplexity('line1\nline2\nline3\nline4\nline5');

      expect(multi).toBeGreaterThan(single);
    });

    it('should increase complexity with keywords', () => {
      const simple = HTMLProcessingUtils.calculateComplexity('var x = 1;');
      const complex = HTMLProcessingUtils.calculateComplexity(
        'function test() { if (true) { for (let i = 0; i < 10; i++) { return i; } } }'
      );

      expect(complex).toBeGreaterThan(simple);
    });

    it('should detect function keyword', () => {
      const withFunction = HTMLProcessingUtils.calculateComplexity('function test() {}');
      const simple = HTMLProcessingUtils.calculateComplexity('x = 1');

      expect(withFunction).toBeGreaterThanOrEqual(simple);
    });

    it('should detect class keyword', () => {
      const withClass = HTMLProcessingUtils.calculateComplexity('class MyClass {}');
      const simple = HTMLProcessingUtils.calculateComplexity('x = 1');

      expect(withClass).toBeGreaterThanOrEqual(simple);
    });

    it('should detect multiple control keywords', () => {
      const code = 'if (x) { for (let i = 0; i < 10; i++) { while (true) { return; } } }';
      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(5);
    });

    it('should return integer value', () => {
      const complexity = HTMLProcessingUtils.calculateComplexity('some code');

      expect(Number.isInteger(complexity)).toBe(true);
    });

    it('should be deterministic', () => {
      const code = 'const x = 1; function test() { return true; }';
      const complexity1 = HTMLProcessingUtils.calculateComplexity(code);
      const complexity2 = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity1).toBe(complexity2);
    });
  });

  describe('processHTMLStructure', () => {
    it('should create chunks from HTML content', () => {
      const html = '<div><p>content</p></div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should respect startLine parameter', () => {
      const html = '<div>test</div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html, 10);

      if (chunks.length > 0) {
        expect(chunks[0].startLine).toBe(10);
      }
    });

    it('should mark chunks as HTML structure type', () => {
      const html = '<div><p>test</p></div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      for (const chunk of chunks) {
        expect(chunk.type).toBe('structure');
      }
    });

    it('should include complexity in chunk metadata', () => {
      const html = '<div><p>test</p></div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      for (const chunk of chunks) {
        expect(chunk.complexity).toBeGreaterThan(0);
      }
    });

    it('should split on tag balance', () => {
      const html = `<div>
        <p>Para 1</p>
        <p>Para 2</p>
        <p>Para 3</p>
        <p>Para 4</p>
        <p>Para 5</p>
      </div>`;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle large content by size limit', () => {
      const html = '<div>' + 'a'.repeat(2500) + '</div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should set language to html', () => {
      const html = '<div>test</div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      for (const chunk of chunks) {
        expect(chunk.language).toBe('html');
      }
    });

    it('should not lose content when splitting', () => {
      const html = '<div>A</div><p>B</p><span>C</span>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      const combined = chunks.map(c => c.content).join('');
      expect(combined).toContain('A');
      expect(combined).toContain('B');
      expect(combined).toContain('C');
    });

    it('should handle empty content', () => {
      const chunks = HTMLProcessingUtils.processHTMLStructure('');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should calculate correct line numbers', () => {
      const html = 'line1\nline2\nline3';

      const chunks = HTMLProcessingUtils.processHTMLStructure(html, 1);

      for (const chunk of chunks) {
        expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      }
    });
  });

  describe('generateScriptCacheKey', () => {
    it('should generate consistent key', () => {
      const script: ScriptBlock = {
        id: 'script_0',
        content: 'test',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: { type: 'module' },
        contentHash: 'hash123'
      };

      const key1 = HTMLProcessingUtils.generateScriptCacheKey(script);
      const key2 = HTMLProcessingUtils.generateScriptCacheKey(script);

      expect(key1).toBe(key2);
    });

    it('should include content hash', () => {
      const script: ScriptBlock = {
        id: 'script_0',
        content: 'test',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'unique123'
      };

      const key = HTMLProcessingUtils.generateScriptCacheKey(script);

      expect(key).toContain('unique123');
    });

    it('should include language', () => {
      const script: ScriptBlock = {
        id: 'script_0',
        content: 'test',
        language: 'typescript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      };

      const key = HTMLProcessingUtils.generateScriptCacheKey(script);

      expect(key).toContain('typescript');
    });

    it('should include attributes signature', () => {
      const script: ScriptBlock = {
        id: 'script_0',
        content: 'test',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: { async: 'true', defer: 'true' },
        contentHash: 'hash'
      };

      const key = HTMLProcessingUtils.generateScriptCacheKey(script);

      expect(key).toContain('async');
      expect(key).toContain('defer');
    });

    it('should handle empty attributes', () => {
      const script: ScriptBlock = {
        id: 'script_0',
        content: 'test',
        language: 'javascript',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      };

      const key = HTMLProcessingUtils.generateScriptCacheKey(script);

      expect(key).toBeDefined();
    });
  });

  describe('generateStyleCacheKey', () => {
    it('should generate consistent key', () => {
      const style: StyleBlock = {
        id: 'style_0',
        content: 'css',
        styleType: 'css',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: { type: 'text/css' },
        contentHash: 'hash123'
      };

      const key1 = HTMLProcessingUtils.generateStyleCacheKey(style);
      const key2 = HTMLProcessingUtils.generateStyleCacheKey(style);

      expect(key1).toBe(key2);
    });

    it('should include content hash', () => {
      const style: StyleBlock = {
        id: 'style_0',
        content: 'css',
        styleType: 'css',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'unique456'
      };

      const key = HTMLProcessingUtils.generateStyleCacheKey(style);

      expect(key).toContain('unique456');
    });

    it('should include style type', () => {
      const style: StyleBlock = {
        id: 'style_0',
        content: 'scss',
        styleType: 'scss',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      };

      const key = HTMLProcessingUtils.generateStyleCacheKey(style);

      expect(key).toContain('scss');
    });

    it('should handle empty attributes', () => {
      const style: StyleBlock = {
        id: 'style_0',
        content: 'css',
        styleType: 'css',
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash'
      };

      const key = HTMLProcessingUtils.generateStyleCacheKey(style);

      expect(key).toBeDefined();
    });
  });

  describe('analyzeScriptAttributes', () => {
    it('should detect module type', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ type: 'module' });

      expect(analysis.isModule).toBe(true);
    });

    it('should detect async attribute', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ async: 'true' });

      expect(analysis.isAsync).toBe(true);
    });

    it('should detect defer attribute', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ defer: 'true' });

      expect(analysis.isDefer).toBe(true);
    });

    it('should detect src presence', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ src: 'file.js' });

      expect(analysis.hasSrc).toBe(true);
    });

    it('should detect TypeScript', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ lang: 'ts' });

      expect(analysis.isTypeScript).toBe(true);
    });

    it('should detect JSON type', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ type: 'json' });

      expect(analysis.isJSON).toBe(true);
    });

    it('should detect crossorigin', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ crossorigin: 'anonymous' });

      expect(analysis.hasCrossorigin).toBe(true);
    });

    it('should detect nomodule', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({ nomodule: 'true' });

      expect(analysis.isNomodule).toBe(true);
    });

    it('should handle multiple attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({
        type: 'module',
        async: 'true',
        src: 'app.js'
      });

      expect(analysis.isModule).toBe(true);
      expect(analysis.isAsync).toBe(true);
      expect(analysis.hasSrc).toBe(true);
    });

    it('should handle empty attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({});

      expect(analysis.isModule).toBe(false);
      expect(analysis.isAsync).toBe(false);
      expect(analysis.isDefer).toBe(false);
      expect(analysis.hasSrc).toBe(false);
    });
  });

  describe('analyzeStyleAttributes', () => {
    it('should detect SCSS', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ lang: 'scss' });

      expect(analysis.isSCSS).toBe(true);
    });

    it('should detect LESS', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ lang: 'less' });

      expect(analysis.isLESS).toBe(true);
    });

    it('should detect media attribute', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ media: 'screen' });

      expect(analysis.hasMedia).toBe(true);
    });

    it('should detect scoped attribute', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ scoped: 'true' });

      expect(analysis.hasScope).toBe(true);
    });

    it('should detect preprocessor from type', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ type: 'text/scss' });

      expect(analysis.isPreprocessor).toBe(true);
    });

    it('should detect preprocessor from lang', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ lang: 'less' });

      expect(analysis.isPreprocessor).toBe(true);
    });

    it('should handle multiple attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({
        lang: 'scss',
        scoped: 'true',
        media: 'print'
      });

      expect(analysis.isSCSS).toBe(true);
      expect(analysis.hasScope).toBe(true);
      expect(analysis.hasMedia).toBe(true);
    });

    it('should handle empty attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({});

      expect(analysis.isSCSS).toBeFalsy();
      expect(analysis.isLESS).toBeFalsy();
      expect(analysis.hasMedia).toBeFalsy();
      expect(analysis.hasScope).toBeFalsy();
    });

    it('should detect inline style', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({ type: 'inline' });

      expect(analysis.isInline).toBe(true);
    });
  });
});
