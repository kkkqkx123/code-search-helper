import { LevenshteinSimilarityStrategy } from '../LevenshteinSimilarityStrategy';

describe('LevenshteinSimilarityStrategy', () => {
  let strategy: LevenshteinSimilarityStrategy;

  beforeEach(() => {
    strategy = new LevenshteinSimilarityStrategy();
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('Levenshtein Similarity');
    });

    it('should have correct type', () => {
      expect(strategy.type).toBe('levenshtein');
    });

    it('should return correct default threshold', () => {
      expect(strategy.getDefaultThreshold()).toBe(0.85);
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
      const similarity = await strategy.calculate('hello', 'hello');
      expect(similarity).toBe(1.0);
    });

    it('should return high similarity for very similar content', async () => {
      const similarity = await strategy.calculate('hello', 'hallo');
      expect(similarity).toBeGreaterThanOrEqual(0.8);
    });

    it('should return low similarity for different content', async () => {
      const similarity = await strategy.calculate('hello', 'world');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings as input validation error', async () => {
      await expect(strategy.calculate('', 'content')).rejects.toThrow();
    });

    it('should normalize whitespace before comparison', async () => {
      const similarity1 = await strategy.calculate('hello world', 'hello world');
      const similarity2 = await strategy.calculate('hello    world', 'hello world');
      expect(similarity1).toBe(1.0);
      expect(similarity2).toBe(1.0);
    });

    it('should handle case insensitivity', async () => {
      const similarity1 = await strategy.calculate('Hello', 'hello');
      const similarity2 = await strategy.calculate('WORLD', 'world');
      expect(similarity1).toBe(1.0);
      expect(similarity2).toBe(1.0);
    });

    it('should be symmetric', async () => {
      const sim1 = await strategy.calculate('abc', 'def');
      const sim2 = await strategy.calculate('def', 'abc');
      expect(sim1).toBe(sim2);
    });

    it('should handle special characters', async () => {
      const similarity = await strategy.calculate('hello!', 'hello@');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle unicode characters', async () => {
      const similarity = await strategy.calculate('你好', '你好');
      expect(similarity).toBe(1.0);
    });

    it('should validate threshold option', async () => {
      await expect(
        strategy.calculate('hello', 'world', { threshold: 1.5 })
      ).rejects.toThrow();
    });

    it('should handle very long strings', async () => {
      const long1 = 'a'.repeat(1000);
      const long2 = 'a'.repeat(1000);
      const similarity = await strategy.calculate(long1, long2);
      expect(similarity).toBe(1.0);
    });

    it('should handle one-character difference', async () => {
      const similarity = await strategy.calculate('cat', 'car');
      expect(similarity).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('Levenshtein distance calculation', () => {
    it('should calculate correct distance for insertions', async () => {
      // "cat" -> "cats" requires 1 insertion
      const similarity = await strategy.calculate('cat', 'cats');
      expect(similarity).toBeGreaterThanOrEqual(0.75);
    });

    it('should calculate correct distance for deletions', async () => {
      // "cats" -> "cat" requires 1 deletion
      const similarity = await strategy.calculate('cats', 'cat');
      expect(similarity).toBeGreaterThanOrEqual(0.75);
    });

    it('should calculate correct distance for substitutions', async () => {
      // "cat" -> "bat" requires 1 substitution
      const similarity = await strategy.calculate('cat', 'bat');
      expect(similarity).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle completely different strings', async () => {
      const similarity = await strategy.calculate('abc', 'xyz');
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('options handling', () => {
    it('should accept content type option', async () => {
      const similarity = await strategy.calculate('hello', 'hello', { contentType: 'code' });
      expect(similarity).toBe(1.0);
    });

    it('should accept language option', async () => {
      const similarity = await strategy.calculate('hello', 'hello', { language: 'javascript' });
      expect(similarity).toBe(1.0);
    });

    it('should respect threshold option', async () => {
      const similarity = await strategy.calculate('hello', 'hallo', { threshold: 0.5 });
      expect(similarity).toBeDefined();
    });
  });
});
