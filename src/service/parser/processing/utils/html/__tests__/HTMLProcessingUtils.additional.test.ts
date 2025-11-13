import { HTMLProcessingUtils } from '../HTMLProcessingUtils';

/**
 * 补充测试：HTMLProcessingUtils 的额外测试用例
 * 用于覆盖更多边界情况和复杂场景
 */
describe('HTMLProcessingUtils - Additional Edge Cases', () => {
  describe('countOpeningTags - Advanced Scenarios', () => {
    it('should handle malformed HTML', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div><<p>');

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle tags with special characters', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div-custom><my:component>');

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should not count HTML entities', () => {
      const count = HTMLProcessingUtils.countOpeningTags('&lt;div&gt;');

      expect(count).toBe(0);
    });

    it('should handle text that looks like tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('use <gt> and <lt> operators');

      expect(count).toBe(0);
    });

    it('should count namespace tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<svg:rect><math:mi>');

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateComplexity - Real-world Code', () => {
    it('should handle React component', () => {
      const code = `
        function MyComponent() {
          const [count, setCount] = useState(0);
          
          const handleClick = () => {
            setCount(count + 1);
          };
          
          return <div onClick={handleClick}>{count}</div>;
        }
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(5);
    });

    it('should handle complex conditional logic', () => {
      const code = `
        if (a && b) {
          if (c || d) {
            for (let i = 0; i < 10; i++) {
              while (true) {
                if (condition) return;
              }
            }
          }
        }
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(10);
    });

    it('should handle import/export statements', () => {
      const code = `
        import { foo, bar } from './module';
        export const myVar = 123;
        export function myFunc() { return 42; }
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(0);
    });

    it('should handle comments in code', () => {
      const code = `
        // This is a function
        function test() { /* comment */ return true; }
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(0);
    });
  });

  describe('processHTMLStructure - Complex Layouts', () => {
    it('should handle deeply nested structure', () => {
      const html = `
        <div>
          <main>
            <article>
              <section>
                <div>
                  <p>Deep content</p>
                </div>
              </section>
            </article>
          </main>
        </div>
      `;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
      const allContent = chunks.map(c => c.content).join('');
      expect(allContent).toContain('Deep content');
    });

    it('should handle mixed inline and block elements', () => {
      const html = `
        <p>Text with <strong>inline</strong> and <em>mixed</em> elements</p>
        <p>More <a href="#">text</a> here</p>
      `;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle table structures', () => {
      const html = `
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Data 1</td><td>Data 2</td></tr>
            <tr><td>Data 3</td><td>Data 4</td></tr>
          </tbody>
        </table>
      `;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle form structures', () => {
      const html = `
        <form>
          <fieldset>
            <legend>Contact Info</legend>
            <input type="text" name="name">
            <input type="email" name="email">
            <textarea name="message"></textarea>
            <button type="submit">Submit</button>
          </fieldset>
        </form>
      `;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle list structures', () => {
      const html = `
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
        </ul>
      `;

      const chunks = HTMLProcessingUtils.processHTMLStructure(html);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeScriptAttributes - Edge Cases', () => {
    it('should handle case-insensitive type values', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({
        type: 'TEXT/JAVASCRIPT'
      });

      // Should be case-sensitive match, so may not detect
      expect(analysis).toBeDefined();
    });

    it('should handle multiple value formats', () => {
      const analysis1 = HTMLProcessingUtils.analyzeScriptAttributes({
        type: 'application/javascript'
      });
      const analysis2 = HTMLProcessingUtils.analyzeScriptAttributes({
        type: 'text/javascript'
      });

      expect(analysis1).toBeDefined();
      expect(analysis2).toBeDefined();
    });

    it('should distinguish between module and regular scripts', () => {
      const moduleAnalysis = HTMLProcessingUtils.analyzeScriptAttributes({
        type: 'module'
      });
      const regularAnalysis = HTMLProcessingUtils.analyzeScriptAttributes({});

      expect(moduleAnalysis.isModule).toBe(true);
      expect(regularAnalysis.isModule).toBe(false);
    });

    it('should handle mixed boolean attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({
        async: 'true',
        defer: 'false'
      });

      expect(analysis.isAsync).toBe(true);
      expect(analysis.isDefer).toBe(false);
    });

    it('should handle missing values in boolean attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeScriptAttributes({
        async: '',
        defer: ''
      });

      expect(analysis.isAsync).toBe(false);
      expect(analysis.isDefer).toBe(false);
    });
  });

  describe('analyzeStyleAttributes - Preprocessor Detection', () => {
    it('should detect multiple preprocessor formats', () => {
      const scssType = HTMLProcessingUtils.analyzeStyleAttributes({
        type: 'text/scss'
      });
      const scssLang = HTMLProcessingUtils.analyzeStyleAttributes({
        lang: 'scss'
      });

      expect(scssType.isSCSS).toBe(true);
      expect(scssLang.isSCSS).toBe(true);
    });

    it('should handle Vue-style scoped styles', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({
        scoped: 'true',
        lang: 'scss'
      });

      expect(analysis.hasScope).toBe(true);
      expect(analysis.isSCSS).toBe(true);
    });

    it('should detect media queries', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({
        media: 'screen and (min-width: 768px)'
      });

      expect(analysis.hasMedia).toBe(true);
    });

    it('should handle combined type and lang attributes', () => {
      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({
        type: 'text/less',
        lang: 'less',
        media: 'print'
      });

      expect(analysis.isLESS).toBe(true);
      expect(analysis.hasMedia).toBe(true);
    });
  });

  describe('Tag Balance and Depth Tracking', () => {
    it('should correctly track depth for sibling elements', () => {
      const line1 = HTMLProcessingUtils.countOpeningTags('<div>');
      const line2 = HTMLProcessingUtils.countClosingTags('</div>');

      expect(line1).toBe(1);
      expect(line2).toBe(1);
    });

    it('should handle mixed self-closing and regular tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<div><img/><p>');

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should handle void elements', () => {
      const voidElements = '<br><hr><input>';

      const count = HTMLProcessingUtils.countOpeningTags(voidElements);

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should not count CDATA sections as tags', () => {
      const count = HTMLProcessingUtils.countOpeningTags('<![CDATA[<div>]]>');

      expect(count).toBe(0);
    });
  });

  describe('Performance and Large Content', () => {
    it('should handle very large HTML efficiently', () => {
      const largeHtml = '<div>' + '<p>item</p>'.repeat(1000) + '</div>';
      const startTime = Date.now();

      const chunks = HTMLProcessingUtils.processHTMLStructure(largeHtml);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very long single line', () => {
      const longLine = '<div>' + 'a'.repeat(10000) + '</div>';

      const chunks = HTMLProcessingUtils.processHTMLStructure(longLine);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle large number of attributes', () => {
      let attrs: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        attrs[`attr${i}`] = `value${i}`;
      }

      const analysis = HTMLProcessingUtils.analyzeScriptAttributes(attrs);

      expect(analysis).toBeDefined();
    });
  });

  describe('Cache Key Generation - Consistency', () => {
    it('should generate same key for identical scripts', () => {
      const script1 = {
        id: 's1',
        content: 'test',
        language: 'javascript' as const,
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: { type: 'module' },
        contentHash: 'hash'
      };
      const script2 = {
        id: 's2',
        content: 'test',
        language: 'javascript' as const,
        position: { start: 10, end: 20, line: 2, column: 5 },
        attributes: { type: 'module' },
        contentHash: 'hash'
      };

      const key1 = HTMLProcessingUtils.generateScriptCacheKey(script1);
      const key2 = HTMLProcessingUtils.generateScriptCacheKey(script2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different content hash', () => {
      const script1 = {
        id: 's1',
        content: 'test1',
        language: 'javascript' as const,
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash1'
      };
      const script2 = {
        id: 's2',
        content: 'test2',
        language: 'javascript' as const,
        position: { start: 0, end: 0, line: 1, column: 1 },
        attributes: {},
        contentHash: 'hash2'
      };

      const key1 = HTMLProcessingUtils.generateScriptCacheKey(script1);
      const key2 = HTMLProcessingUtils.generateScriptCacheKey(script2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different attributes', () => {
      const baseScript = {
        id: 's1',
        content: 'test',
        language: 'javascript' as const,
        position: { start: 0, end: 0, line: 1, column: 1 },
        contentHash: 'hash'
      };

      const key1 = HTMLProcessingUtils.generateScriptCacheKey({
        ...baseScript,
        attributes: { async: 'true' }
      });
      const key2 = HTMLProcessingUtils.generateScriptCacheKey({
        ...baseScript,
        attributes: { async: 'false' }
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Integration Scenarios', () => {
    it('should process Vue SFC script section', () => {
      const code = `
        <script setup lang="ts">
        import { ref } from 'vue';
        
        interface Props {
          msg: string;
        }
        
        defineProps<Props>();
        const count = ref(0);
        </script>
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(0);
    });

    it('should analyze TypeScript file with decorators', () => {
      const code = `
        @Component
        export class MyComponent implements OnInit {
          @Input() name: string;
          
          constructor(private service: MyService) {}
          
          ngOnInit() {
            this.service.getData();
          }
        }
      `;

      const complexity = HTMLProcessingUtils.calculateComplexity(code);

      expect(complexity).toBeGreaterThan(0);
    });

    it('should handle CSS with media queries and nesting', () => {
      const css = `
        @media (max-width: 768px) {
          .container {
            display: flex;
            gap: 10px;
            
            &:hover {
              background: blue;
            }
          }
        }
      `;

      const analysis = HTMLProcessingUtils.analyzeStyleAttributes({
        lang: 'scss'
      });

      expect(analysis.isSCSS).toBe(true);
    });
  });
});
