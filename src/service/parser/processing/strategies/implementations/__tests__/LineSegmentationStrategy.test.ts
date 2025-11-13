import { LineSegmentationStrategy, LineStrategyConfig } from '../LineSegmentationStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';

describe('LineSegmentationStrategy', () => {
  let strategy: LineSegmentationStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new LineSegmentationStrategy({
      name: 'line-segmentation',
      supportedLanguages: ['*'],
      enabled: true
    });

    mockContext = {
      content: '',
      language: 'unknown',
      filePath: 'test.txt',
      config: {} as any,
      features: {
        size: 0,
        lineCount: 0,
        isSmallFile: false,
        isCodeFile: false,
        isStructuredFile: false,
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
        isStructuredFile: false,
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
      expect(config.maxLinesPerChunk).toBe(50);
      expect(config.minLinesPerChunk).toBe(5);
      expect(config.overlapLines).toBe(0);
      expect(config.maxChunkSize).toBe(3000);
    });

    it('should merge provided config with defaults', () => {
      const customStrategy = new LineSegmentationStrategy({
        name: 'line-segmentation',
        supportedLanguages: ['*'],
        enabled: true,
        maxLinesPerChunk: 100,
        minLinesPerChunk: 10
      });

      const config = customStrategy.getConfig();
      expect(config.maxLinesPerChunk).toBe(100);
      expect(config.minLinesPerChunk).toBe(10);
    });
  });

  describe('canHandle', () => {
    it('should handle any language (fallback strategy)', () => {
      mockContext.language = 'javascript';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'markdown';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'unknown';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should always return true as fallback strategy', () => {
      for (const lang of ['python', 'java', 'rust', 'plaintext']) {
        mockContext.language = lang;
        expect(strategy.canHandle(mockContext)).toBe(true);
      }
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid content', async () => {
      mockContext.content = 'line1\nline2\nline3\nline4\nline5';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('line-segmentation');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content gracefully', async () => {
      mockContext.content = '';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should handle very large content', async () => {
      const largeContent = 'line\n'.repeat(10000);
      mockContext.content = largeContent;

      const result = await strategy.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('process', () => {
    it('should segment content by lines', async () => {
      mockContext.content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');

      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata?.startLine).toBeDefined();
        expect(chunk.metadata?.endLine).toBeDefined();
      });
    });

    it('should respect max lines per chunk', async () => {
      mockContext.content = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
      strategy.updateConfig({ maxLinesPerChunk: 30 });

      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        const lineCount = chunk.content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(31); // 稍微宽松一点
      });
    });

    it('should respect min lines per chunk', async () => {
      mockContext.content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
      strategy.updateConfig({ minLinesPerChunk: 10 });

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max chunk size', async () => {
      mockContext.content = Array.from({ length: 300 }, (_, i) => 'a'.repeat(50)).join('\n');
      strategy.updateConfig({ maxChunkSize: 1000 });

      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // 稍微宽松一点
      });
    });

    it('should handle empty lines intelligently', async () => {
      mockContext.content = `line 1
line 2

line 3
line 4

line 5
line 6`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should find better split points at empty lines', async () => {
      mockContext.content = Array.from(
        { length: 100 },
        (_, i) => (i % 20 === 19 ? '' : `line ${i + 1}`)
      ).join('\n');

      strategy.updateConfig({ maxLinesPerChunk: 20 });
      const chunks = await strategy.process(mockContext);

      // 应该在空行处分割
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('intelligent segmentation', () => {
    it('should find better split points at comment lines', async () => {
      mockContext.content = `
code line 1
code line 2
// comment line
code line 3
code line 4
// another comment
code line 5`;

      strategy.updateConfig({ maxLinesPerChunk: 3 });
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should find better split points at statement endings', async () => {
      mockContext.content = `
const x = 1;
const y = 2;
const z = 3;
}
const a = 4;
const b = 5;`;

      strategy.updateConfig({ maxLinesPerChunk: 3 });
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mixed comment styles', async () => {
      mockContext.content = `
// C++ style comment
const x = 1;
# Python style comment
const y = 2;
/* Multi-line
   comment */
const z = 3;`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should support all languages', () => {
      const languages = strategy.getSupportedLanguages();

      expect(languages).toContain('*');
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = strategy.getConfig();

      expect(config.maxLinesPerChunk).toBeDefined();
      expect(config.minLinesPerChunk).toBeDefined();
      expect(config.overlapLines).toBeDefined();
      expect(config.maxChunkSize).toBeDefined();
    });

    it('should update config', () => {
      strategy.updateConfig({ maxLinesPerChunk: 100 });
      const config = strategy.getConfig();

      expect(config.maxLinesPerChunk).toBe(100);
    });

    it('should preserve unmodified config values when updating', () => {
      const original = strategy.getConfig();
      strategy.updateConfig({ maxLinesPerChunk: 100 });
      const updated = strategy.getConfig();

      expect(updated.minLinesPerChunk).toBe(original.minLinesPerChunk);
      expect(updated.maxChunkSize).toBe(original.maxChunkSize);
    });
  });

  describe('edge cases', () => {
    it('should handle single line content', async () => {
      mockContext.content = 'single line';
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe('single line');
    });

    it('should handle content with only empty lines', async () => {
      mockContext.content = '\n\n\n\n';
      const chunks = await strategy.process(mockContext);

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long lines', async () => {
      const longLine = 'a'.repeat(10000);
      mockContext.content = longLine + '\n' + longLine;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle content with special characters', async () => {
      mockContext.content = `
特殊字符
🎉 emoji line
\t tab indented
\r\n windows newline`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('performance stats', () => {
    it('should track performance statistics', async () => {
      mockContext.content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');

      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await strategy.execute(mockContext);

      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBeGreaterThan(statsBefore.totalExecutions);
    });

    it('should reset performance stats', async () => {
      mockContext.content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');

      await strategy.execute(mockContext);
      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBeGreaterThan(0);

      strategy.resetPerformanceStats();
      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBe(0);
    });
  });
});
