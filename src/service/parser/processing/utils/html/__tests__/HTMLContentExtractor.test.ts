import { HTMLContentExtractor } from '../HTMLContentExtractor';
import { ScriptBlock, StyleBlock } from '../LayeredHTMLConfig';

describe('HTMLContentExtractor', () => {
  let extractor: HTMLContentExtractor;

  beforeEach(() => {
    extractor = new HTMLContentExtractor();
  });

  describe('extractScripts', () => {
    it('should extract single script block', () => {
      const html = '<script>console.log("test");</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(1);
      expect(scripts[0].content).toBe('console.log("test");');
      expect(scripts[0].id).toBe('script_0');
    });

    it('should extract multiple script blocks', () => {
      const html = `
        <script>var a = 1;</script>
        <script>var b = 2;</script>
      `;

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(2);
      expect(scripts[0].content).toBe('var a = 1;');
      expect(scripts[1].content).toBe('var b = 2;');
    });

    it('should trim script content', () => {
      const html = '<script>  \n  console.log("test");  \n  </script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].content).toBe('console.log("test");');
    });

    it('should handle nested HTML in script', () => {
      const html = '<script>const html = "<div></div>";</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(1);
      expect(scripts[0].content).toContain('<div></div>');
    });

    it('should extract script attributes', () => {
      const html = '<script type="module" async="true" src="file.js"></script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].attributes.type).toBe('module');
      expect(scripts[0].attributes.async).toBe('true');
      expect(scripts[0].attributes.src).toBe('file.js');
    });

    it('should generate content hash', () => {
      const html = '<script>test code</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].contentHash).toBeDefined();
      expect(typeof scripts[0].contentHash).toBe('string');
    });

    it('should calculate position line number', () => {
      const html = '\n\n<script>code</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].position.line).toBe(3);
    });

    it('should return empty array when no scripts found', () => {
      const html = '<div>no scripts here</div>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(0);
    });

    it('should be case-insensitive for script tags', () => {
      const html = '<SCRIPT>code</SCRIPT>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(1);
    });

    it('should handle multiline scripts', () => {
      const html = `<script>
        function test() {
          return true;
        }
      </script>`;

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].content).toContain('function test()');
    });
  });

  describe('extractStyles', () => {
    it('should extract single style block', () => {
      const html = '<style>.test { color: red; }</style>';

      const styles = extractor.extractStyles(html);

      expect(styles).toHaveLength(1);
      expect(styles[0].content).toBe('.test { color: red; }');
      expect(styles[0].id).toBe('style_0');
    });

    it('should extract multiple style blocks', () => {
      const html = `
        <style>.a { color: red; }</style>
        <style>.b { color: blue; }</style>
      `;

      const styles = extractor.extractStyles(html);

      expect(styles).toHaveLength(2);
      expect(styles[0].content).toContain('.a');
      expect(styles[1].content).toContain('.b');
    });

    it('should extract style attributes', () => {
      const html = '<style type="text/css" lang="scss" media="screen"></style>';

      const styles = extractor.extractStyles(html);

      expect(styles[0].attributes.type).toBe('text/css');
      expect(styles[0].attributes.lang).toBe('scss');
      expect(styles[0].attributes.media).toBe('screen');
    });

    it('should return empty array when no styles found', () => {
      const html = '<script>code</script>';

      const styles = extractor.extractStyles(html);

      expect(styles).toHaveLength(0);
    });

    it('should be case-insensitive for style tags', () => {
      const html = '<STYLE>code</STYLE>';

      const styles = extractor.extractStyles(html);

      expect(styles).toHaveLength(1);
    });
  });

  describe('detectScriptLanguage', () => {
    it('should detect javascript from type attribute', () => {
      const lang = extractor.detectScriptLanguage('<script type="text/javascript">');

      expect(lang).toBe('javascript');
    });

    it('should detect typescript from type attribute', () => {
      const lang = extractor.detectScriptLanguage('<script type="text/typescript">');

      expect(lang).toBe('typescript');
    });

    it('should detect typescript from lang attribute', () => {
      const lang = extractor.detectScriptLanguage('<script lang="ts">');

      expect(lang).toBe('typescript');
    });

    it('should detect typescript from src attribute', () => {
      const lang = extractor.detectScriptLanguage('<script src="file.ts">');

      expect(lang).toBe('typescript');
    });

    it('should detect json from type attribute', () => {
      const lang = extractor.detectScriptLanguage('<script type="application/json">');

      expect(lang).toBe('json');
    });

    it('should detect babel', () => {
      const lang = extractor.detectScriptLanguage('<script type="text/babel">');

      expect(lang).toBe('javascript');
    });

    it('should detect typescript from content features', () => {
      const tag = '<script>const x: string = "test";</script>';

      const lang = extractor.detectScriptLanguage(tag);

      expect(lang).toBe('typescript');
    });

    it('should default to javascript', () => {
      const lang = extractor.detectScriptLanguage('<script>');

      expect(lang).toBe('javascript');
    });
  });

  describe('detectStyleType', () => {
    it('should detect CSS from type attribute', () => {
      const type = extractor.detectStyleType('<style type="text/css">');

      expect(type).toBe('css');
    });

    it('should detect SCSS from type attribute', () => {
      const type = extractor.detectStyleType('<style type="text/scss">');

      expect(type).toBe('scss');
    });

    it('should detect SCSS from lang attribute', () => {
      const type = extractor.detectStyleType('<style lang="scss">');

      expect(type).toBe('scss');
    });

    it('should detect LESS from type attribute', () => {
      const type = extractor.detectStyleType('<style type="text/less">');

      expect(type).toBe('less');
    });

    it('should detect LESS from lang attribute', () => {
      const type = extractor.detectStyleType('<style lang="less">');

      expect(type).toBe('less');
    });

    it('should detect SCSS from content features', () => {
      const tag = '<style>$color: red; @mixin test { color: $color; }</style>';

      const type = extractor.detectStyleType(tag);

      expect(type).toBe('scss');
    });

    it('should detect LESS from content features', () => {
      const tag = '<style>@primary: #333; .selector { color: @primary; }</style>';

      const type = extractor.detectStyleType(tag);

      expect(type).toBe('less');
    });

    it('should default to CSS', () => {
      const type = extractor.detectStyleType('<style>');

      expect(type).toBe('css');
    });
  });

  describe('attribute extraction', () => {
    it('should extract attributes with single quotes', () => {
      const html = "<script src='file.js' type='module'></script>";

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].attributes.src).toBe('file.js');
      expect(scripts[0].attributes.type).toBe('module');
    });

    it('should extract attributes with double quotes', () => {
      const html = '<script src="file.js" type="module"></script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].attributes.src).toBe('file.js');
      expect(scripts[0].attributes.type).toBe('module');
    });

    it('should handle attributes with hyphens', () => {
      const html = '<script cross-origin="anonymous"></script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].attributes['cross-origin']).toBe('anonymous');
    });

    it('should handle empty attributes', () => {
      const html = '<script async></script>';

      const scripts = extractor.extractScripts(html);

      expect(Object.keys(scripts[0].attributes).length).toBe(0);
    });
  });

  describe('position calculation', () => {
    it('should calculate correct column position', () => {
      const html = '  <script>code</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].position.column).toBe(3);
    });

    it('should calculate position with multiple lines', () => {
      const html = 'line1\nline2\n<script>code</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].position.line).toBe(3);
    });

    it('should calculate start and end positions', () => {
      const html = '<script>test</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].position.start).toBe(0);
      expect(scripts[0].position.end).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty script tags', () => {
      const html = '<script></script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(1);
      expect(scripts[0].content).toBe('');
    });

    it('should handle empty style tags', () => {
      const html = '<style></style>';

      const styles = extractor.extractStyles(html);

      expect(styles).toHaveLength(1);
      expect(styles[0].content).toBe('');
    });

    it('should handle special characters in attributes', () => {
      const html = '<script src="path/to/file.js?v=1.0&module=true"></script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts[0].attributes.src).toBe('path/to/file.js?v=1.0&module=true');
    });

    it('should handle consecutive script tags', () => {
      const html = '<script>a</script><script>b</script>';

      const scripts = extractor.extractScripts(html);

      expect(scripts).toHaveLength(2);
      expect(scripts[0].content).toBe('a');
      expect(scripts[1].content).toBe('b');
    });
  });
});
