import { LayeredHTMLStrategy } from '../../../service/parser/processing/strategies/segmentation/LayeredHTMLStrategy';
import { XMLTextStrategy } from '../../../service/parser/processing/utils/xml/XMLTextStrategy';
import { LoggerService } from '../../../utils/LoggerService';
import { DetectionResult } from '../../../service/parser/processing/detection/UnifiedDetectionService';

describe('LayeredHTMLStrategy', () => {
  let strategy: LayeredHTMLStrategy;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockXMLStrategy: jest.Mocked<XMLTextStrategy> & {
    chunkXML: jest.MockedFunction<(content: string, filePath?: string) => any[]>;
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockXMLStrategy = {
      chunkXML: jest.fn()
    } as any;

    strategy = new LayeredHTMLStrategy(mockLogger, mockXMLStrategy);
  });

  describe('execute', () => {
    it('should process HTML with embedded scripts and styles', async () => {
      const htmlContent = `
<!DOCTYPE html>
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
      const detection: DetectionResult = {
        language: 'html',
        confidence: 0.9,
        detectionMethod: 'extension',
        processingStrategy: 'html_layered',
        metadata: {}
      };

      // Mock XML strategy response
      (mockXMLStrategy.chunkXML as jest.Mock).mockResolvedValue([
        {
          content: '<!DOCTYPE html>',
          metadata: { startLine: 1, endLine: 1, type: 'doctype' }
        },
        {
          content: '<html>\n<head>\n    <title>Test Page</title>\n</head>\n<body>\n    <div class="container">\n        <h1>Test Page</h1>\n    </div>\n</body>\n</html>',
          metadata: { startLine: 2, endLine: 12, type: 'element' }
        }
      ]);

      const result = await strategy.execute(filePath, htmlContent, detection);

      expect(result.chunks).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.strategy).toBe('LayeredHTMLStrategy');
      expect(result.metadata.scriptCount).toBe(2);
      expect(result.metadata.styleCount).toBe(1);
      expect(result.metadata.hasEmbeddedContent).toBe(true);
      expect(result.metadata.layers).toContain('structure');
      expect(result.metadata.layers).toContain('script');
      expect(result.metadata.layers).toContain('style');

      // Verify XML strategy was called
      expect(mockXMLStrategy.chunkXML).toHaveBeenCalledWith(htmlContent, filePath);
    });

    it('should handle HTML without embedded content', async () => {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Simple Page</title>
</head>
<body>
    <div>Simple content</div>
</body>
</html>`;

      const filePath = 'simple.html';
      const detection: DetectionResult = {
        language: 'html',
        confidence: 0.9,
        detectionMethod: 'extension',
        processingStrategy: 'html_layered',
        metadata: {}
      };

      (mockXMLStrategy.chunkXML as jest.Mock).mockResolvedValue([
        {
          content: htmlContent.trim(),
          metadata: { startLine: 1, endLine: 9, type: 'element' }
        }
      ]);

      const result = await strategy.execute(filePath, htmlContent, detection);

      expect(result.chunks).toBeDefined();
      expect(result.metadata.scriptCount).toBe(0);
      expect(result.metadata.styleCount).toBe(0);
      expect(result.metadata.hasEmbeddedContent).toBe(false);
    });

    it('should detect TypeScript in scripts', async () => {
      const htmlContent = `
<html>
<head>
    <script lang="typescript">
        interface User {
            name: string;
            age: number;
        }
        
        const user: User = { name: 'John', age: 30 };
    </script>
</head>
<body></body>
</html>`;

      const filePath = 'typescript.html';
      const detection: DetectionResult = {
        language: 'html',
        confidence: 0.9,
        detectionMethod: 'extension',
        processingStrategy: 'html_layered',
        metadata: {}
      };

      (mockXMLStrategy.chunkXML as jest.Mock).mockResolvedValue([
        {
          content: '<html>\n<head>\n</head>\n<body></body>\n</html>',
          metadata: { startLine: 1, endLine: 5, type: 'element' }
        }
      ]);

      const result = await strategy.execute(filePath, htmlContent, detection);

      expect(result.metadata.scriptCount).toBe(1);
      
      // Find the script chunk and check its language
      const scriptChunk = result.chunks.find(chunk => 
        chunk.metadata.type === 'script' && chunk.metadata.scriptLanguage === 'typescript'
      );
      expect(scriptChunk).toBeDefined();
    });

    it('should detect SCSS in styles', async () => {
      const htmlContent = `
<html>
<head>
    <style lang="scss">
        $primary-color: #007bff;
        
        .container {
            background: $primary-color;
            
            &:hover {
                opacity: 0.8;
            }
        }
    </style>
</head>
<body></body>
</html>`;

      const filePath = 'scss.html';
      const detection: DetectionResult = {
        language: 'html',
        confidence: 0.9,
        detectionMethod: 'extension',
        processingStrategy: 'html_layered',
        metadata: {}
      };

      (mockXMLStrategy.chunkXML as jest.Mock).mockResolvedValue([
        {
          content: '<html>\n<head>\n</head>\n<body></body>\n</html>',
          metadata: { startLine: 1, endLine: 5, type: 'element' }
        }
      ]);

      const result = await strategy.execute(filePath, htmlContent, detection);

      expect(result.metadata.styleCount).toBe(1);
      
      // Find the style chunk and check its type
      const styleChunk = result.chunks.find(chunk => 
        chunk.metadata.type === 'style' && chunk.metadata.styleType === 'scss'
      );
      expect(styleChunk).toBeDefined();
    });

    it('should fallback to XML strategy on error', async () => {
      const htmlContent = '<html><body>Test</body></html>';
      const filePath = 'test.html';
      const detection: DetectionResult = {
        language: 'html',
        confidence: 0.9,
        detectionMethod: 'extension',
        processingStrategy: 'html_layered',
        metadata: {}
      };

      // Mock XML strategy to succeed for fallback
      (mockXMLStrategy.chunkXML as jest.Mock).mockResolvedValue([
        {
          content: htmlContent,
          metadata: { startLine: 1, endLine: 1, type: 'element' }
        }
      ]);

      // Create strategy with XML strategy but make it fail initially
      const strategyWithFallback = new LayeredHTMLStrategy(mockLogger, mockXMLStrategy);
      
      // Mock the first call to fail, second call to succeed (fallback)
      (mockXMLStrategy.chunkXML as jest.Mock)
        .mockRejectedValueOnce(new Error('Initial processing failed'))
        .mockResolvedValueOnce([
          {
            content: htmlContent,
            metadata: { startLine: 1, endLine: 1, type: 'element' }
          }
        ]);
      
      const result = await strategyWithFallback.execute(filePath, htmlContent, detection);

      expect(result.chunks).toBeDefined();
      expect(result.metadata.strategy).toBe('LayeredHTMLStrategy-Fallback');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to XML strategy')
      );
    });
  });

  describe('getName and getDescription', () => {
    it('should return correct name and description', () => {
      expect(strategy.getName()).toBe('LayeredHTMLStrategy');
      expect(strategy.getDescription()).toBe(
        'Uses layered processing to handle HTML structure and embedded content (scripts/styles) separately'
      );
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const customConfig = {
        enableParallel: false,
        errorHandling: 'fail-fast' as const,
        maxProcessingTime: 5000
      };

      strategy.setConfig(customConfig);
      const updatedConfig = strategy.getConfig();

      expect(updatedConfig.enableParallel).toBe(false);
      expect(updatedConfig.errorHandling).toBe('fail-fast');
      expect(updatedConfig.maxProcessingTime).toBe(5000);
    });
  });
});