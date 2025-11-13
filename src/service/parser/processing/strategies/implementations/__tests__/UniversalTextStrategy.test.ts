import { UniversalTextStrategy, UniversalStrategyConfig } from '../UniversalTextStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';

describe('UniversalTextStrategy', () => {
  let strategy: UniversalTextStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new UniversalTextStrategy({
      name: 'universal-text-segmentation',
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
      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.maxLinesPerChunk).toBe(100);
      expect(config.minLinesPerChunk).toBe(5);
      expect(config.overlapSize).toBe(100);
      expect(config.enableIntelligentChunking).toBe(true);
      expect(config.memoryLimitMB).toBe(512);
      expect(config.errorThreshold).toBe(10);
    });

    it('should merge provided config with defaults', () => {
      const customStrategy = new UniversalTextStrategy({
        name: 'universal-text-segmentation',
        supportedLanguages: ['*'],
        enabled: true,
        maxChunkSize: 5000,
        minChunkSize: 300
      });

      const config = customStrategy.getConfig();
      expect(config.maxChunkSize).toBe(5000);
      expect(config.minChunkSize).toBe(300);
      expect(config.enableIntelligentChunking).toBe(true); // 默认值
    });
  });

  describe('canHandle', () => {
    it('should handle text format files', () => {
      mockContext.language = 'text';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'ini';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'csv';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should handle small files', () => {
      mockContext.language = 'javascript';
      mockContext.features.isSmallFile = true;
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should handle unknown languages', () => {
      mockContext.language = '';
      expect(strategy.canHandle(mockContext)).toBe(true);

      mockContext.language = 'unknown_lang';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should always work as universal fallback strategy', () => {
      mockContext.language = 'anything';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid content', async () => {
      mockContext.content = 'Some text content here';
      mockContext.features.isSmallFile = true;
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('universal-text-segmentation');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content gracefully', async () => {
      mockContext.content = '';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should handle large content', async () => {
      mockContext.content = 'line\n'.repeat(10000);
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('process', () => {
    it('should handle small files efficiently', async () => {
      mockContext.content = 'Short content';
      mockContext.features.isSmallFile = true;

      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBe(1); // 小文件应该是一个块
      expect(chunks[0].content).toBe('Short content');
    });

    it('should use semantic segmentation for code with functions', async () => {
      mockContext.language = 'javascript';
      mockContext.features.hasFunctions = true;
      mockContext.features.isSmallFile = false;
      mockContext.content = `
function test1() {
  return 1;
}

function test2() {
  return 2;
}`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use bracket segmentation for bracket-heavy code', async () => {
      mockContext.language = 'javascript';
      mockContext.content = `
const obj = {
  nested: {
    array: [1, 2, 3],
    func: () => {}
  }
};`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should fall back to line segmentation for plain text', async () => {
      mockContext.language = 'text';
      mockContext.content = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max chunk size', async () => {
      mockContext.content = 'a'.repeat(10000);
      strategy.updateConfig({ maxChunkSize: 1000 });

      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // 稍微宽松
      });
    });

    it('should respect min chunk size', async () => {
      mockContext.content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
      strategy.updateConfig({ minChunkSize: 300, maxChunkSize: 3000 });

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max lines per chunk', async () => {
      mockContext.content = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
      strategy.updateConfig({ maxLinesPerChunk: 50 });

      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        const lineCount = chunk.content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(55); // 稍微宽松
      });
    });
  });

  describe('language support', () => {
    it('should support all languages', () => {
      const languages = strategy.getSupportedLanguages();
      expect(languages).toContain('*');
    });

    it('should support semantic segmentation for appropriate languages', async () => {
      const semanticLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp'];

      for (const lang of semanticLanguages) {
        mockContext.language = lang;
        mockContext.features.hasFunctions = true;
        mockContext.features.isSmallFile = false;
        mockContext.content = 'function test() { return 1; }\nfunction test2() { return 2; }';

        const chunks = await strategy.process(mockContext);
        expect(chunks.length).toBeGreaterThan(0);
      }
    });

    it('should support bracket segmentation for appropriate languages', async () => {
      const bracketLanguages = ['javascript', 'typescript', 'java', 'cpp', 'csharp', 'c', 'go'];

      for (const lang of bracketLanguages) {
        mockContext.language = lang;
        mockContext.content = 'const x = { nested: { value: [] } };';

        const chunks = await strategy.process(mockContext);
        expect(chunks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBeDefined();
      expect(config.minChunkSize).toBeDefined();
      expect(config.maxLinesPerChunk).toBeDefined();
      expect(config.minLinesPerChunk).toBeDefined();
      expect(config.overlapSize).toBeDefined();
      expect(config.enableIntelligentChunking).toBeDefined();
      expect(config.memoryLimitMB).toBeDefined();
      expect(config.errorThreshold).toBeDefined();
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
      expect(updated.enableIntelligentChunking).toBe(original.enableIntelligentChunking);
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration', () => {
      const result = strategy.validateConfiguration();
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid maxChunkSize', () => {
      strategy.updateConfig({ maxChunkSize: 0 });
      const result = strategy.validateConfiguration();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid minChunkSize', () => {
      strategy.updateConfig({ minChunkSize: -1 });
      const result = strategy.validateConfiguration();
      expect(result.isValid).toBe(false);
    });

    it('should detect when minChunkSize >= maxChunkSize', () => {
      strategy.updateConfig({ minChunkSize: 5000, maxChunkSize: 1000 });
      const result = strategy.validateConfiguration();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('minChunkSize must be less than maxChunkSize'))).toBe(true);
    });
  });

  describe('advanced features', () => {
    it('should return supported languages list', () => {
      const languages = strategy.getSupportedLanguagesList();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });

    it('should return available strategies', () => {
      const strategies = strategy.getAvailableStrategies();

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name === 'semantic')).toBe(true);
      expect(strategies.some(s => s.name === 'bracket')).toBe(true);
      expect(strategies.some(s => s.name === 'line')).toBe(true);
    });

    it('should provide health check', async () => {
      const health = await strategy.healthCheck();

      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('components');
      expect(Array.isArray(health.issues)).toBe(true);
      expect(typeof health.components).toBe('object');
    });

    it('should track segmentation statistics', () => {
      const stats = strategy.getSegmentationStats();

      expect(stats).toHaveProperty('totalSegmentations');
      expect(stats).toHaveProperty('averageChunkCount');
      expect(stats).toHaveProperty('strategyUsage');
      expect(stats).toHaveProperty('processorUsage');
    });

    it('should reset segmentation statistics', () => {
      strategy.resetSegmentationStats();
      const stats = strategy.getSegmentationStats();

      expect(stats.totalSegmentations).toBe(0);
    });
  });

  describe('performance testing', () => {
    it('should run performance tests', async () => {
      const content = 'const x = 1;\n'.repeat(100);
      const results = await strategy.performanceTest(content, 'test.js', 'javascript');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result).toHaveProperty('strategy');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('chunkCount');
        expect(result).toHaveProperty('averageChunkSize');
      });
    });
  });

  describe('batch processing', () => {
    it('should batch chunk multiple files', async () => {
      const files = [
        { content: 'file 1 content', filePath: 'file1.txt', language: 'text' },
        { content: 'file 2 content', filePath: 'file2.txt', language: 'text' },
        { content: 'file 3 content', filePath: 'file3.txt', language: 'text' }
      ];

      const results = await strategy.batchChunk(files);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toHaveProperty('chunks');
        expect(Array.isArray(result.chunks)).toBe(true);
      });
    });

    it('should handle errors in batch processing', async () => {
      const files = [
        { content: 'valid content', filePath: 'file1.txt', language: 'text' },
        { content: null, filePath: 'file2.txt', language: 'text' } as any
      ];

      const results = await strategy.batchChunk(files);

      expect(results.length).toBe(2);
      // 第一个应该成功
      expect(results[0].chunks.length).toBeGreaterThan(0);
      // 第二个应该有错误
      expect(results[1].error).toBeDefined();
    });
  });

  describe('validateContext', () => {
    it('should validate content', () => {
      mockContext.content = 'Some content';
      expect(strategy.validateContext(mockContext)).toBe(true);
    });

    it('should reject empty content', () => {
      mockContext.content = '';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });

    it('should reject whitespace-only content', () => {
      mockContext.content = '   \n  \n   ';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });
  });

  describe('performance stats', () => {
    it('should track performance statistics', async () => {
      mockContext.content = 'Some content';
      mockContext.features.isSmallFile = true;

      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await strategy.execute(mockContext);

      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBeGreaterThan(statsBefore.totalExecutions);
    });

    it('should reset performance stats', async () => {
      mockContext.content = 'Some content';
      mockContext.features.isSmallFile = true;

      await strategy.execute(mockContext);
      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBeGreaterThan(0);

      strategy.resetPerformanceStats();
      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large files', async () => {
      mockContext.content = 'line\n'.repeat(100000);
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle files with only whitespace', async () => {
      mockContext.content = '   \n\t\n  ';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed line endings', async () => {
      mockContext.content = 'line1\r\nline2\nline3\rline4';
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      mockContext.content = '特殊字符\n🎉 emoji\n\t tabs\0null';
      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
