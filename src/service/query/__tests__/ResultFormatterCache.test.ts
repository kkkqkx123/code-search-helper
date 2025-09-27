import { ResultFormatterCache } from '../ResultFormatterCache';

describe('ResultFormatterCache', () => {
  let cache: ResultFormatterCache;

  beforeEach(() => {
    cache = new ResultFormatterCache(10, 1000); // Small cache for testing
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      cache.set(key, value);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const retrieved = cache.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should overwrite existing keys', () => {
      const key = 'test-key';
      const value1 = { data: 'test-data-1' };
      const value2 = { data: 'test-data-2' };

      cache.set(key, value1);
      cache.set(key, value2);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(value2);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      cache.set(key, value);
      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent-key')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entries', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      cache.set(key, value);
      expect(cache.has(key)).toBe(true);

      cache.delete(key);
      expect(cache.has(key)).toBe(false);
    });

    it('should return true when deleting existing keys', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      cache.set(key, value);
      const result = cache.delete(key);

      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent keys', () => {
      const result = cache.delete('non-existent-key');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return the correct number of entries', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('max size', () => {
    it('should remove oldest entry when exceeding max size', () => {
      const smallCache = new ResultFormatterCache(2, 1000);

      try {
        smallCache.set('key1', 'value1');
        smallCache.set('key2', 'value2');

        expect(smallCache.size()).toBe(2);

        // Adding a third entry should remove the oldest (key1)
        smallCache.set('key3', 'value3');

        expect(smallCache.size()).toBe(2);
        expect(smallCache.has('key1')).toBe(false);
        expect(smallCache.has('key2')).toBe(true);
        expect(smallCache.has('key3')).toBe(true);
      } finally {
        smallCache.destroy();
      }
    });
  });

  describe('ttl', () => {
    it('should expire entries after ttl', done => {
      const testCache = new ResultFormatterCache(10, 1000);
      const key = 'test-key';
      const value = { data: 'test-data' };

      // Set with 10ms TTL
      testCache.set(key, value, 10);

      // Should exist immediately
      expect(testCache.get(key)).toEqual(value);

      // Should be expired after 15ms
      setTimeout(() => {
        expect(testCache.get(key)).toBeNull();
        testCache.destroy();
        done();
      }, 15);
    });

    it('should not expire entries before ttl', done => {
      const testCache = new ResultFormatterCache(10, 1000);
      const key = 'test-key';
      const value = { data: 'test-data' };

      // Set with 50ms TTL
      testCache.set(key, value, 50);

      // Should exist after 10ms
      setTimeout(() => {
        expect(testCache.get(key)).toEqual(value);
        testCache.destroy();
        done();
      }, 10);
    });
  });
});
