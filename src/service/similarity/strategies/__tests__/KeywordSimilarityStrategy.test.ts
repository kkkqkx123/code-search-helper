import { KeywordSimilarityStrategy } from '../KeywordSimilarityStrategy';

describe('KeywordSimilarityStrategy', () => {
  let strategy: KeywordSimilarityStrategy;

  beforeEach(() => {
    strategy = new KeywordSimilarityStrategy();
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('Keyword Similarity');
    });

    it('should have correct type', () => {
      expect(strategy.type).toBe('keyword');
    });

    it('should return correct default threshold', () => {
      expect(strategy.getDefaultThreshold()).toBe(0.6);
    });
  });

  describe('isSupported', () => {
    it('should support all content types', () => {
      expect(strategy.isSupported('code')).toBe(true);
      expect(strategy.isSupported('document')).toBe(true);
      expect(strategy.isSupported('generic')).toBe(true);
    });

    it('should support all languages', () => {
      expect(strategy.isSupported('code', 'javascript')).toBe(true);
      expect(strategy.isSupported('code', 'python')).toBe(true);
    });
  });

  describe('calculate', () => {
    it('should return 1.0 for identical content', async () => {
      const similarity = await strategy.calculate('hello world', 'hello world');
      expect(similarity).toBe(1.0);
    });

    it('should return high similarity for content with same keywords', async () => {
      const similarity = await strategy.calculate('hello world test', 'hello world code');
      expect(similarity).toBeGreaterThan(0.4);
    });

    it('should return low similarity for content with different keywords', async () => {
      const similarity = await strategy.calculate('apple orange banana', 'car truck bus');
      expect(similarity).toBe(0);
    });

    it('should handle empty strings as input validation error', async () => {
      await expect(strategy.calculate('', 'content')).rejects.toThrow();
    });

    it('should be case insensitive', async () => {
      const similarity1 = await strategy.calculate('HELLO WORLD', 'hello world');
      const similarity2 = await strategy.calculate('Hello World', 'hello world');
      expect(similarity1).toBe(1.0);
      expect(similarity2).toBe(1.0);
    });

    it('should be symmetric', async () => {
      const sim1 = await strategy.calculate('hello world', 'world hello');
      const sim2 = await strategy.calculate('world hello', 'hello world');
      expect(sim1).toBe(sim2);
    });

    it('should handle punctuation', async () => {
      const similarity = await strategy.calculate(
        'hello, world!',
        'hello world'
      );
      expect(similarity).toBe(1.0);
    });

    it('should filter stop words', async () => {
      const similarity = await strategy.calculate(
        'the quick brown fox',
        'quick brown fox'
      );
      expect(similarity).toBe(1.0);
    });

    it('should filter numeric values', async () => {
      const similarity = await strategy.calculate(
        'test 123 code',
        'test code'
      );
      expect(similarity).toBe(1.0);
    });

    it('should validate threshold option', async () => {
      await expect(
        strategy.calculate('hello', 'world', { threshold: 1.5 })
      ).rejects.toThrow();
    });

    it('should handle special characters', async () => {
      const similarity = await strategy.calculate(
        'function test() {}',
        'function test() {}'
      );
      expect(similarity).toBe(1.0);
    });

    it('should return 0 when no keywords are extracted', async () => {
      // Content with only stop words and numbers
      const similarity = await strategy.calculate(
        'a an the 123 456',
        'the a 789'
      );
      expect(similarity).toBe(0);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from normal text', async () => {
      const content = 'hello world test';
      // We need to call calculate to test keyword extraction indirectly
      const similarity = await strategy.calculate(content, content);
      expect(similarity).toBe(1.0);
    });

    it('should handle content type specific keyword extraction', async () => {
      const similarity = await strategy.calculate(
        'function test() { return 42; }',
        'function test() { return 42; }',
        { contentType: 'code', language: 'javascript' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should filter short words based on content type', async () => {
      const codeContent = 'var x = 10; var y = 20;';
      const similarity = await strategy.calculate(
        codeContent,
        codeContent,
        { contentType: 'code' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle code with camelCase identifiers', async () => {
      const similarity = await strategy.calculate(
        'myVariable testFunction getValue',
        'myVariable testFunction getValue',
        { contentType: 'code', language: 'javascript' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle code with snake_case identifiers', async () => {
      const similarity = await strategy.calculate(
        'my_variable test_function get_value',
        'my_variable test_function get_value',
        { contentType: 'code', language: 'python' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should remove duplicate keywords', async () => {
      const similarity = await strategy.calculate(
        'test test test code code code',
        'test code'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle unicode keywords', async () => {
      const similarity = await strategy.calculate(
        '变量 函数 测试',
        '变量 函数 测试'
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('Jaccard similarity', () => {
    it('should calculate Jaccard similarity correctly', async () => {
      // Common keywords: "hello", "world"
      // Union: "hello", "world", "foo", "bar" = 4 elements
      // Intersection: 2 elements
      // Similarity: 2/4 = 0.5
      const similarity = await strategy.calculate(
        'hello world',
        'hello world foo bar'
      );
      expect(similarity).toBeCloseTo(0.5, 1);
    });

    it('should handle empty keyword set', async () => {
      const similarity = await strategy.calculate(
        'a an the',
        'the a an'
      );
      expect(similarity).toBe(0);
    });

    it('should handle partial overlap', async () => {
      const similarity = await strategy.calculate(
        'apple banana cherry',
        'apple date elderberry'
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('content type specific handling', () => {
    it('should handle code content type', async () => {
      const similarity = await strategy.calculate(
        'function getData() { return data; }',
        'function getData() { return data; }',
        { contentType: 'code', language: 'javascript' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle document content type', async () => {
      const similarity = await strategy.calculate(
        'This is a document about testing',
        'This is a document about testing',
        { contentType: 'document' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle generic content type', async () => {
      const similarity = await strategy.calculate(
        'generic content here',
        'generic content here',
        { contentType: 'generic' }
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('language specific handling', () => {
    it('should handle JavaScript/TypeScript identifiers with $', async () => {
      const similarity = await strategy.calculate(
        '$variable testFunction',
        '$variable testFunction',
        { language: 'javascript' }
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle Python identifiers', async () => {
      const similarity = await strategy.calculate(
        'my_function test_var',
        'my_function test_var',
        { language: 'python' }
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('edge cases', () => {
    it('should handle very long keywords', async () => {
      const longKeyword = 'a'.repeat(100);
      const similarity = await strategy.calculate(
        longKeyword + ' test',
        longKeyword + ' test'
      );
      expect(similarity).toBe(1.0);
    });

    it('should handle many keywords', async () => {
      const manyKeywords = Array(100).fill('word').join(' ');
      const similarity = await strategy.calculate(
        manyKeywords,
        manyKeywords
      );
      expect(similarity).toBe(1.0);
    });

    it('should normalize multiple spaces', async () => {
      const similarity = await strategy.calculate(
        'hello   world   test',
        'hello world test'
      );
      expect(similarity).toBe(1.0);
    });
  });
});
