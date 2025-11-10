import { BaseSimilarityStrategy } from '../BaseSimilarityStrategy';
import { SimilarityError } from '../../types/SimilarityTypes';

/**
 * 具体实现用于测试
 */
class TestSimilarityStrategy extends BaseSimilarityStrategy {
  readonly name = 'Test Strategy';
  readonly type = 'levenshtein' as any;

  async calculate(content1: string, content2: string): Promise<number> {
    return 0.5; // 简单测试实现
  }
}

describe('BaseSimilarityStrategy', () => {
  let strategy: TestSimilarityStrategy;

  beforeEach(() => {
    strategy = new TestSimilarityStrategy();
  });

  describe('validateInput', () => {
    it('should throw error when content1 is empty', () => {
      expect(() => {
        (strategy as any).validateInput('', 'content2');
      }).toThrow(SimilarityError);
    });

    it('should throw error when content2 is empty', () => {
      expect(() => {
        (strategy as any).validateInput('content1', '');
      }).toThrow(SimilarityError);
    });

    it('should throw error when threshold is invalid', () => {
      expect(() => {
        (strategy as any).validateInput('content1', 'content2', { threshold: 1.5 });
      }).toThrow(SimilarityError);
    });

    it('should throw error when threshold is negative', () => {
      expect(() => {
        (strategy as any).validateInput('content1', 'content2', { threshold: -0.1 });
      }).toThrow(SimilarityError);
    });

    it('should not throw when inputs are valid', () => {
      expect(() => {
        (strategy as any).validateInput('content1', 'content2');
      }).not.toThrow();
    });

    it('should not throw when threshold is valid', () => {
      expect(() => {
        (strategy as any).validateInput('content1', 'content2', { threshold: 0.8 });
      }).not.toThrow();
    });
  });

  describe('isIdentical', () => {
    it('should return true for identical content', async () => {
      const result = await (strategy as any).isIdentical('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should return false for different content', async () => {
      const result = await (strategy as any).isIdentical('hello', 'world');
      expect(result).toBe(false);
    });
  });

  describe('isSupported', () => {
    it('should return true for any content type by default', () => {
      expect(strategy.isSupported('code')).toBe(true);
      expect(strategy.isSupported('document')).toBe(true);
      expect(strategy.isSupported('generic')).toBe(true);
    });

    it('should return true with language parameter', () => {
      expect(strategy.isSupported('code', 'javascript')).toBe(true);
    });
  });

  describe('getDefaultThreshold', () => {
    it('should return 0.8', () => {
      expect(strategy.getDefaultThreshold()).toBe(0.8);
    });
  });

  describe('normalizeScore', () => {
    it('should clamp score to 0-1 range', () => {
      expect((strategy as any).normalizeScore(-0.5)).toBe(0);
      expect((strategy as any).normalizeScore(1.5)).toBe(1);
      expect((strategy as any).normalizeScore(0.5)).toBe(0.5);
    });

    it('should return 0 for negative scores', () => {
      expect((strategy as any).normalizeScore(-1)).toBe(0);
    });

    it('should return 1 for scores > 1', () => {
      expect((strategy as any).normalizeScore(2)).toBe(1);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = (strategy as any).generateContentHash(content);
      const hash2 = (strategy as any).generateContentHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = (strategy as any).generateContentHash('content1');
      const hash2 = (strategy as any).generateContentHash('content2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle special characters', () => {
      const hash = (strategy as any).generateContentHash('特殊字符!@#$%');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate unique cache key for different content', () => {
      const key1 = (strategy as any).generateCacheKey('content1', 'content2');
      const key2 = (strategy as any).generateCacheKey('content1', 'content3');
      expect(key1).not.toBe(key2);
    });

    it('should include strategy type in cache key', () => {
      const key = (strategy as any).generateCacheKey('content1', 'content2');
      expect(key).toContain('levenshtein');
    });

    it('should include threshold in cache key', () => {
      const key1 = (strategy as any).generateCacheKey('content1', 'content2', { threshold: 0.5 });
      const key2 = (strategy as any).generateCacheKey('content1', 'content2', { threshold: 0.8 });
      expect(key1).not.toBe(key2);
    });

    it('should use default threshold if not provided', () => {
      const key = (strategy as any).generateCacheKey('content1', 'content2');
      expect(key).toContain('0.8');
    });
  });

  describe('preprocessContent', () => {
    it('should remove single-line comments', async () => {
      const content = 'line1 // comment\nline2';
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).not.toContain('comment');
    });

    it('should remove multi-line comments', async () => {
      const content = 'line1 /* comment */ line2';
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).not.toContain('comment');
    });

    it('should normalize whitespace', async () => {
      const content = 'line1\n\n\nline2  \t  line3';
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).not.toContain('\n');
      expect(processed).not.toContain('\t');
    });

    it('should convert to lowercase', async () => {
      const content = 'HELLO World';
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).toBe('hello world');
    });

    it('should trim whitespace', async () => {
      const content = '  hello world  ';
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).toBe('hello world');
    });

    it('should handle complex content', async () => {
      const content = `
        // This is a comment
        function test() {
          /* Multi-line
             comment */
          return 42;
        }
      `;
      const processed = await (strategy as any).preprocessContent(content);
      expect(processed).not.toContain('//');
      expect(processed).not.toContain('/*');
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure execution time', async () => {
      const { result, executionTime } = await (strategy as any).measureExecutionTime(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result';
        }
      );
      expect(result).toBe('result');
      expect(executionTime).toBeGreaterThanOrEqual(10);
    });

    it('should return zero execution time for synchronous operations', async () => {
      const { result, executionTime } = await (strategy as any).measureExecutionTime(
        async () => 'result'
      );
      expect(result).toBe('result');
      expect(executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
