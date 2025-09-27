export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Remove and re-add to update the order (make it most recently used)
      this.cache.delete(key);
      this.cache.set(key, { value: item.value, timestamp: Date.now() });
      return item.value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    // Handle zero size cache
    if (this.maxSize <= 0) {
      return;
    }

    // If key already exists, update its value and timestamp
    if (this.cache.has(key)) {
      this.cache.set(key, { value, timestamp: Date.now() });
      return;
    }

    // If cache is full, remove the least recently used item
    if (this.cache.size >= this.maxSize) {
      // Find the oldest entry
      let oldestKey: K | undefined;
      let oldestTimestamp = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTimestamp) {
          oldestTimestamp = v.timestamp;
          oldestKey = k;
        }
      }

      // Remove the oldest entry
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add the new entry
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }
}
