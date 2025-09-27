import { injectable, inject, optional } from 'inversify';

export interface PoolOptions<T> {
  initialSize?: number;
  maxSize?: number;
  creator: () => T;
  resetter?: (obj: T) => void;
  validator?: (obj: T) => boolean;
  destroy?: (obj: T) => void;
  evictionPolicy?: 'lru' | 'fifo' | 'random';
}

export interface PoolStats {
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  totalDestroyed: number;
  currentSize: number;
  availableItems: number;
  activeItems: number;
  hitRate: number;
  missRate: number;
}

@injectable()
export class ObjectPool<T> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private accessOrder: T[] = []; // For LRU eviction
  private options: Required<PoolOptions<T>>;
  private stats: PoolStats;
  private logger?: any;

  constructor(
    @inject('PoolOptions') options: PoolOptions<T>,
    @inject('LoggerService') @optional() logger?: any
  ) {
    this.options = {
      initialSize: 10,
      maxSize: 100,
      resetter: (obj: T) => {}, // Default no-op resetter
      validator: (obj: T) => true, // Default always valid
      destroy: (obj: T) => {}, // Default no-op destroy
      evictionPolicy: 'lru',
      ...options,
    };

    this.logger = logger;
    this.stats = this.initializeStats();

    this.initializePool();
  }

  acquire(): T {
    let obj: T;

    if (this.pool.length > 0) {
      // Get object from pool
      obj = this.pool.pop()!;
      this.stats.totalAcquired++;
      this.stats.hitRate =
        this.stats.totalAcquired / (this.stats.totalAcquired + this.stats.totalCreated);
    } else {
      // Create new object
      obj = this.options.creator();
      this.stats.totalCreated++;
      this.stats.missRate =
        this.stats.totalCreated / (this.stats.totalAcquired + this.stats.totalCreated);
    }

    // Track active object
    this.active.add(obj);
    this.updateAccessOrder(obj);

    this.updateStats();

    this.logger?.debug('Object acquired from pool', {
      poolSize: this.pool.length,
      activeSize: this.active.size,
      totalCreated: this.stats.totalCreated,
      totalAcquired: this.stats.totalAcquired,
    });

    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) {
      this.logger?.warn('Attempted to release object not acquired from pool');
      return;
    }

    // Remove from active set
    this.active.delete(obj);
    this.stats.totalReleased++;

    try {
      // Validate object before returning to pool
      if (this.options.validator(obj)) {
        // Reset object state
        this.options.resetter(obj);

        // Check if pool has space
        if (this.pool.length < this.options.maxSize) {
          this.pool.push(obj);
          this.removeFromAccessOrder(obj);
        } else {
          // Pool is full, destroy the object
          this.options.destroy(obj);
          this.stats.totalDestroyed++;
        }
      } else {
        // Object is invalid, destroy it
        this.options.destroy(obj);
        this.stats.totalDestroyed++;
      }
    } catch (error) {
      this.logger?.error('Error releasing object to pool', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Destroy object on error
      try {
        this.options.destroy(obj);
      } catch (destroyError) {
        this.logger?.error('Error destroying object during release', {
          error: destroyError instanceof Error ? destroyError.message : String(destroyError),
        });
      }

      this.stats.totalDestroyed++;
    }

    this.updateStats();

    this.logger?.debug('Object released to pool', {
      poolSize: this.pool.length,
      activeSize: this.active.size,
      totalReleased: this.stats.totalReleased,
      totalDestroyed: this.stats.totalDestroyed,
    });
  }

  clear(): void {
    // Destroy all objects in pool
    for (const obj of this.pool) {
      try {
        this.options.destroy(obj);
      } catch (error) {
        this.logger?.error('Error destroying object during pool clear', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Destroy all active objects
    for (const obj of this.active) {
      try {
        this.options.destroy(obj);
      } catch (error) {
        this.logger?.error('Error destroying active object during pool clear', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear collections
    this.pool.length = 0;
    this.active.clear();
    this.accessOrder.length = 0;

    this.updateStats();

    this.logger?.info('Object pool cleared');
  }

  resize(newMaxSize: number): void {
    const oldMaxSize = this.options.maxSize;
    this.options.maxSize = newMaxSize;

    if (newMaxSize < oldMaxSize) {
      // Need to remove excess objects
      const excessCount = this.pool.length - newMaxSize;

      for (let i = 0; i < excessCount; i++) {
        const obj = this.pool.pop();
        if (obj) {
          try {
            this.options.destroy(obj);
            this.stats.totalDestroyed++;
          } catch (error) {
            this.logger?.error('Error destroying object during pool resize', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    this.updateStats();

    this.logger?.info('Object pool resized', {
      oldMaxSize,
      newMaxSize,
      currentSize: this.pool.length,
    });
  }

  getStats(): PoolStats {
    return { ...this.stats };
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getActiveSize(): number {
    return this.active.size;
  }

  getTotalSize(): number {
    return this.pool.length + this.active.size;
  }

  private initializePool(): void {
    // Create initial pool objects
    for (let i = 0; i < this.options.initialSize; i++) {
      const obj = this.options.creator();
      this.pool.push(obj);
      this.stats.totalCreated++;
    }

    this.updateStats();

    this.logger?.info('Object pool initialized', {
      initialSize: this.options.initialSize,
      maxSize: this.options.maxSize,
      evictionPolicy: this.options.evictionPolicy,
    });
  }

  private updateAccessOrder(obj: T): void {
    if (this.options.evictionPolicy === 'lru') {
      // Remove from current position
      const index = this.accessOrder.indexOf(obj);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }

      // Add to end (most recently used)
      this.accessOrder.push(obj);
    } else if (this.options.evictionPolicy === 'fifo') {
      // Add to end for FIFO
      if (!this.accessOrder.includes(obj)) {
        this.accessOrder.push(obj);
      }
    }
  }

  private removeFromAccessOrder(obj: T): void {
    const index = this.accessOrder.indexOf(obj);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictIfNeeded(): void {
    if (this.pool.length >= this.options.maxSize) {
      let objToEvict: T | undefined;

      switch (this.options.evictionPolicy) {
        case 'lru':
          // Evict least recently used
          objToEvict = this.accessOrder.shift();
          break;
        case 'fifo':
          // Evict first in
          objToEvict = this.accessOrder.shift();
          break;
        case 'random':
          // Evict random object
          const randomIndex = Math.floor(Math.random() * this.pool.length);
          objToEvict = this.pool[randomIndex];
          this.pool.splice(randomIndex, 1);
          break;
      }

      if (objToEvict) {
        try {
          this.options.destroy(objToEvict);
          this.stats.totalDestroyed++;
        } catch (error) {
          this.logger?.error('Error destroying object during eviction', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  private updateStats(): void {
    this.stats.currentSize = this.getTotalSize();
    this.stats.availableItems = this.pool.length;
    this.stats.activeItems = this.active.size;
  }

  private initializeStats(): PoolStats {
    return {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalDestroyed: 0,
      currentSize: 0,
      availableItems: 0,
      activeItems: 0,
      hitRate: 0,
      missRate: 0,
    };
  }
}
