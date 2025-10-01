import { BatchOptimizer } from '../BatchOptimizer';
import { IBatchOptimizer } from '../types';

describe('BatchOptimizer', () => {
  let batchOptimizer: IBatchOptimizer;

  beforeEach(() => {
    batchOptimizer = new BatchOptimizer();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = (batchOptimizer as any).config;
      expect(config.maxConcurrentOperations).toBe(5);
      expect(config.defaultBatchSize).toBe(50);
      expect(config.maxBatchSize).toBe(500);
      expect(config.memoryThreshold).toBe(80);
      expect(config.processingTimeout).toBe(300000);
      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.adaptiveBatchingEnabled).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxConcurrentOperations: 10,
        defaultBatchSize: 100,
        maxBatchSize: 1000,
        memoryThreshold: 90,
        processingTimeout: 600000,
        retryAttempts: 5,
        retryDelay: 2000,
        adaptiveBatchingEnabled: false,
      };
      
      const customOptimizer = new BatchOptimizer(customConfig);
      const config = (customOptimizer as any).config;
      
      expect(config.maxConcurrentOperations).toBe(10);
      expect(config.defaultBatchSize).toBe(100);
      expect(config.maxBatchSize).toBe(1000);
      expect(config.memoryThreshold).toBe(90);
      expect(config.processingTimeout).toBe(600000);
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.adaptiveBatchingEnabled).toBe(false);
    });
  });

  describe('calculateOptimalBatchSize', () => {
    it('should return default batch size for small item counts', () => {
      const batchSize = batchOptimizer.calculateOptimalBatchSize(10);
      expect(batchSize).toBe(50);
    });

    it('should scale batch size for medium item counts', () => {
      const batchSize = batchOptimizer.calculateOptimalBatchSize(1000);
      expect(batchSize).toBeGreaterThan(50);
      expect(batchSize).toBeLessThanOrEqual(500);
    });

    it('should not exceed max batch size for large item counts', () => {
      const batchSize = batchOptimizer.calculateOptimalBatchSize(10000);
      expect(batchSize).toBeLessThanOrEqual(500);
    });

    it('should use adaptive batching when enabled', () => {
      const batchSize = batchOptimizer.calculateOptimalBatchSize(1000);
      expect(batchSize).toBeGreaterThan(0);
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable errors', () => {
      const retryableError = new Error('Network timeout');
      const shouldRetry = batchOptimizer.shouldRetry(retryableError, 1);
      expect(shouldRetry).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const nonRetryableError = new Error('Invalid input');
      const shouldRetry = batchOptimizer.shouldRetry(nonRetryableError, 1);
      expect(shouldRetry).toBe(false);
    });

    it('should return false when max retry attempts reached', () => {
      const retryableError = new Error('Network timeout');
      const shouldRetry = batchOptimizer.shouldRetry(retryableError, 3);
      expect(shouldRetry).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      batchOptimizer.updateConfig({
        maxConcurrentOperations: 15,
        defaultBatchSize: 75,
      });
      
      const config = (batchOptimizer as any).config;
      expect(config.maxConcurrentOperations).toBe(15);
      expect(config.defaultBatchSize).toBe(75);
    });

    it('should merge configuration with existing values', () => {
      batchOptimizer.updateConfig({
        maxConcurrentOperations: 15,
      });
      
      const config = (batchOptimizer as any).config;
      expect(config.maxConcurrentOperations).toBe(15);
      expect(config.defaultBatchSize).toBe(50); // Default value
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = batchOptimizer.getConfig();
      expect(config).toHaveProperty('maxConcurrentOperations');
      expect(config).toHaveProperty('defaultBatchSize');
      expect(config).toHaveProperty('maxBatchSize');
      expect(config).toHaveProperty('memoryThreshold');
      expect(config).toHaveProperty('processingTimeout');
      expect(config).toHaveProperty('retryAttempts');
      expect(config).toHaveProperty('retryDelay');
      expect(config).toHaveProperty('adaptiveBatchingEnabled');
    });
  });
});