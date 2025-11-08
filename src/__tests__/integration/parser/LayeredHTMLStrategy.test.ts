import { LayeredHTMLStrategy } from '../../../service/parser/processing/strategies/implementations/LayeredHTMLStrategy';
import { IProcessingContext } from '../../../service/parser/processing/core/interfaces/IProcessingContext';
import { DefaultConfigFactory } from '../../../service/parser/processing/types/Config';
import { CodeChunk } from '../../../service/parser/processing/types/CodeChunk';
import { StrategyUtils } from '../../../service/parser/processing/types/Strategy';

describe('LayeredHTMLStrategy', () => {
  let strategy: LayeredHTMLStrategy;

  beforeEach(() => {
    const config = StrategyUtils.createDefaultStrategyConfig('layered-html', 1, ['html', 'htm']);
    strategy = new LayeredHTMLStrategy(config);
  });

  describe('process', () => {
    it('should process HTML with embedded scripts and styles', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>
        body { margin: 0; }
        .container { padding: 20px; }
    </style>
    <script type="text/javascript">
        function greet(name) {
            console.log('Hello, ' + name + '!');
        }
    </script>
</head>
<body>
    <div class="container">
        <h1>Test Page</h1>
        <script>
            // Inline script
            document.addEventListener('DOMContentLoaded', function() {
                greet('World');
            });
        </script>
    </div>
</body>
</html>`;

      const filePath = 'test.html';
      const config = DefaultConfigFactory.createDefaultProcessingConfig();

      const context: IProcessingContext = {
        content: htmlContent,
        language: 'html',
        filePath,
        config,
        features: {
          size: htmlContent.length,
          lineCount: htmlContent.split('\n').length,
          isSmallFile: false,
          isCodeFile: true,
          isStructuredFile: true,
          complexity: 1,
          hasImports: false,
          hasExports: false,
          hasFunctions: true,
          hasClasses: false
        },
        metadata: {
          contentLength: htmlContent.length,
          lineCount: htmlContent.split('\n').length,
          size: htmlContent.length,
          isSmallFile: false,
          isCodeFile: true,
          isStructuredFile: true,
          complexity: 1,
          hasImports: false,
          hasExports: false,
          hasFunctions: true,
          hasClasses: false,
          timestamp: Date.now()
        }
      };

      const chunks = await strategy.process(context);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);

      // Check that chunks have proper metadata
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.language).toBe('html');
        expect(chunk.metadata.strategy).toBe('layered-html');
      });
    });

    it('should handle HTML without embedded content', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Simple Page</title>
</head>
<body>
    <div class="container">
        <h1>Simple Test Page</h1>
        <p>This is a simple HTML page without scripts or styles.</p>
    </div>
</body>
</html>`;

      const filePath = 'simple.html';
      const config = DefaultConfigFactory.createDefaultProcessingConfig();

      const context: IProcessingContext = {
        content: htmlContent,
        language: 'html',
        filePath,
        config,
        features: {
          size: htmlContent.length,
          lineCount: htmlContent.split('\n').length,
          isSmallFile: true,
          isCodeFile: true,
          isStructuredFile: true,
          complexity: 1,
          hasImports: false,
          hasExports: false,
          hasFunctions: false,
          hasClasses: false
        },
        metadata: {
          contentLength: htmlContent.length,
          lineCount: htmlContent.split('\n').length,
          size: htmlContent.length,
          isSmallFile: true,
          isCodeFile: true,
          isStructuredFile: true,
          complexity: 1,
          hasImports: false,
          hasExports: false,
          hasFunctions: false,
          hasClasses: false,
          timestamp: Date.now()
        }
      };

      const chunks = await strategy.process(context);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);

      // Check that chunks have proper metadata
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.language).toBe('html');
        expect(chunk.metadata.strategy).toBe('layered-html');
      });
    });
  });
});
