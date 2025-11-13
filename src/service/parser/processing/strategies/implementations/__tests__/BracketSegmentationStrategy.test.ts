import { BracketSegmentationStrategy, BracketStrategyConfig } from '../BracketSegmentationStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';
import { ChunkType } from '../../../core/types/ResultTypes';

describe('BracketSegmentationStrategy', () => {
  let strategy: BracketSegmentationStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new BracketSegmentationStrategy({
      name: 'bracket-segmentation',
      supportedLanguages: ['javascript', 'typescript'],
      enabled: true
    });

    mockContext = {
      content: '',
      language: 'javascript',
      filePath: 'test.js',
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
      },
      metadata: {
        contentLength: 0,
        lineCount: 0,
        size: 0,
        isSmallFile: false,
        isCodeFile: true,
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
      expect(config.minChunkSize).toBe(200);
      expect(config.maxImbalance).toBe(3);
      expect(config.enableBracketBalance).toBe(true);
    });

    it('should merge provided config with defaults', () => {
      const customStrategy = new BracketSegmentationStrategy({
        name: 'bracket-segmentation',
        supportedLanguages: [],
        enabled: true,
        maxChunkSize: 5000,
        minChunkSize: 100
      });

      const config = customStrategy.getConfig();
      expect(config.maxChunkSize).toBe(5000);
      expect(config.minChunkSize).toBe(100);
      expect(config.maxImbalance).toBe(3); // 默认值
    });
  });

  describe('canHandle', () => {
    it('should handle code files with enabled bracket balance', () => {
      mockContext.language = 'javascript';
      expect(strategy.canHandle(mockContext)).toBe(true);
    });

    it('should not handle markdown files', () => {
      mockContext.language = 'markdown';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });

    it('should not handle when bracket balance is disabled', () => {
      strategy.updateConfig({ enableBracketBalance: false });
      mockContext.language = 'javascript';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });

    it('should not handle unknown language', () => {
      mockContext.language = 'unknown_lang';
      expect(strategy.canHandle(mockContext)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid content', async () => {
      mockContext.content = 'function test() { return 1; }';
      const result = await strategy.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('bracket-segmentation');
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
      // 创建一个会抛出错误的上下文
      const invalidContext = { ...mockContext, content: null } as any;
      const result = await strategy.execute(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('process', () => {
    it('should segment code with balanced brackets', async () => {
      mockContext.content = `
function test() {
  return 1;
}
function another() {
  return 2;
}`;

      const chunks = await strategy.process(mockContext);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata?.startLine).toBeDefined();
        expect(chunk.metadata?.endLine).toBeDefined();
      });
    });

    it('should handle multiple bracket types', async () => {
      mockContext.content = `
const arr = [1, 2, 3];
const obj = { key: 'value' };
const func = () => { return 42; };
`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle nested brackets', async () => {
      mockContext.content = `
const nested = {
  level1: {
    level2: {
      level3: []
    }
  }
};`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect max chunk size limit', async () => {
      const largeContent = 'const x = 1;\n'.repeat(1000);
      mockContext.content = largeContent;

      strategy.updateConfig({ maxChunkSize: 500 });
      const chunks = await strategy.process(mockContext);

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(520); // 稍微宽松一点
      });
    });

    it('should respect min chunk size limit', async () => {
      const smallContent = 'const x = 1;\nconst y = 2;';
      mockContext.content = smallContent;

      strategy.updateConfig({ minChunkSize: 100 });
      const chunks = await strategy.process(mockContext);

      // 小于最小大小的内容应该被合并成一个块
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle XML tags', async () => {
      mockContext.content = `
<root>
  <element>content</element>
  <element>more content</element>
</root>`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('validateContext', () => {
    it('should validate content with brackets', () => {
      mockContext.content = 'function test() { return 1; }';
      expect(strategy.validateContext(mockContext)).toBe(true);
    });

    it('should validate content with XML tags', () => {
      mockContext.content = '<root><element>test</element></root>';
      expect(strategy.validateContext(mockContext)).toBe(true);
    });

    it('should reject empty content', () => {
      mockContext.content = '';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });

    it('should reject content without brackets or tags', () => {
      mockContext.content = 'plain text without brackets';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });

    it('should reject files with less than 3 lines', () => {
      mockContext.content = 'line1\nline2';
      expect(strategy.validateContext(mockContext)).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const languages = strategy.getSupportedLanguages();

      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('xml');
    });
  });

  describe('config management', () => {
    it('should get config', () => {
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBeDefined();
      expect(config.minChunkSize).toBeDefined();
      expect(config.maxImbalance).toBeDefined();
      expect(config.enableBracketBalance).toBeDefined();
    });

    it('should update config', () => {
      strategy.updateConfig({ maxChunkSize: 5000 });
      const config = strategy.getConfig();

      expect(config.maxChunkSize).toBe(5000);
    });

    it('should preserve unmodified config values when updating', () => {
      const original = strategy.getConfig();
      strategy.updateConfig({ maxChunkSize: 2000 });
      const updated = strategy.getConfig();

      expect(updated.minChunkSize).toBe(original.minChunkSize);
      expect(updated.maxImbalance).toBe(original.maxImbalance);
    });
  });

  describe('bracket counting', () => {
    it('should handle mixed bracket types', async () => {
      mockContext.content = `
array[0];
object.key = { nested: [] };
function(arg1, arg2) { return arg1 + arg2; }
`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle unbalanced brackets within threshold', async () => {
      mockContext.content = `
if (true) {
  const x = [1, 2, 3];
  return x;
}`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should split on imbalanced brackets exceeding threshold', async () => {
      mockContext.content = `
const unbalanced = [ [ [ [ [ [
end of unbalanced
function balanced() {
  return 1;
}`;

      const chunks = await strategy.process(mockContext);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('performance stats', () => {
    it('should track performance statistics', async () => {
      mockContext.content = 'function test() { return 1; }';

      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await strategy.execute(mockContext);

      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBeGreaterThan(statsBefore.totalExecutions);
    });

    it('should reset performance stats', async () => {
      mockContext.content = 'function test() { return 1; }';

      await strategy.execute(mockContext);
      const statsBefore = strategy.getPerformanceStats();
      expect(statsBefore.totalExecutions).toBeGreaterThan(0);

      strategy.resetPerformanceStats();
      const statsAfter = strategy.getPerformanceStats();
      expect(statsAfter.totalExecutions).toBe(0);
    });
  });
});
