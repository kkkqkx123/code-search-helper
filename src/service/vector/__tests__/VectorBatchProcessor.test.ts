import { VectorBatchProcessor, BatchOptions } from '../operations/VectorBatchProcessor';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';

describe('VectorBatchProcessor', () => {
  let vectorBatchProcessor: VectorBatchProcessor;
  let mockBatchService: jest.Mocked<BatchProcessingService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockBatchService = {
      processBatches: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    vectorBatchProcessor = new VectorBatchProcessor(
      mockBatchService,
      mockLoggerService
    );
  });

  describe('processBatch', () => {
    it('should process batch successfully with default options', async () => {
      // Arrange
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockResolvedValue(['result1', 'result2', 'result3', 'result4', 'result5']);
      const expectedResults = ['result1', 'result2', 'result3', 'result4', 'result5'];

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(processor).toHaveBeenCalledTimes(1); // All items in one batch with default size 100
      expect(processor).toHaveBeenCalledWith(items);
    });

    it('should process batch with custom batch size', async () => {
      // Arrange
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn()
        .mockResolvedValueOnce(['result1', 'result2'])
        .mockResolvedValueOnce(['result3', 'result4'])
        .mockResolvedValueOnce(['result5']);
      const options: BatchOptions = { batchSize: 2 };
      const expectedResults = ['result1', 'result2', 'result3', 'result4', 'result5'];

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(processor).toHaveBeenCalledTimes(3);
      expect(processor).toHaveBeenCalledWith([1, 2]);
      expect(processor).toHaveBeenCalledWith([3, 4]);
      expect(processor).toHaveBeenCalledWith([5]);
    });

    it('should handle empty items array', async () => {
      // Arrange
      const items: number[] = [];
      const processor = jest.fn();

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor);

      // Assert
      expect(result).toEqual([]);
      expect(processor).not.toHaveBeenCalled();
    });

    it('should handle single item', async () => {
      // Arrange
      const items = [1];
      const processor = jest.fn().mockResolvedValue(['result1']);

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor);

      // Assert
      expect(result).toEqual(['result1']);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith([1]);
    });

    it('should handle processor errors with retry', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce(['result1', 'result2', 'result3']);
      const options: BatchOptions = { retryAttempts: 3 };
      const expectedResults = ['result1', 'result2', 'result3'];

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(processor).toHaveBeenCalledTimes(3);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 1 failed', { error: 'First attempt failed' });
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 2 failed', { error: 'Second attempt failed' });
    });

    it('should throw error after all retry attempts fail', async () => {
      // Arrange
      const items = [1, 2, 3];
      const error = new Error('All attempts failed');
      const processor = jest.fn().mockRejectedValue(error);
      const options: BatchOptions = { retryAttempts: 2 };

      // Act & Assert
      await expect(vectorBatchProcessor.processBatch(items, processor, options))
        .rejects.toThrow('All attempts failed');
      expect(processor).toHaveBeenCalledTimes(2);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 1 failed', { error: 'All attempts failed' });
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 2 failed', { error: 'All attempts failed' });
    });

    it('should handle non-Error objects in processor', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn().mockRejectedValue('String error');
      const options: BatchOptions = { retryAttempts: 1 };

      // Act & Assert
      await expect(vectorBatchProcessor.processBatch(items, processor, options))
        .rejects.toThrow('String error');
      expect(processor).toHaveBeenCalledTimes(1);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 1 failed', { error: 'String error' });
    });

    it('should use exponential backoff between retries', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(['result1', 'result2', 'result3']);
      const options: BatchOptions = { retryAttempts: 2 };

      // Mock setTimeout to track calls
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockImplementation((callback, delay) => {
        // Immediately execute the callback for testing
        callback();
        return 1;
      });
      global.setTimeout = mockSetTimeout as any;

      try {
        // Act
        await vectorBatchProcessor.processBatch(items, processor, options);

        // Assert
        expect(processor).toHaveBeenCalledTimes(2);
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000); // 2^0 * 1000ms
      } finally {
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle multiple batches with different sizes', async () => {
      // Arrange
      const items = [1, 2, 3, 4, 5, 6, 7];
      const processor = jest.fn()
        .mockResolvedValueOnce(['result1', 'result2', 'result3'])
        .mockResolvedValueOnce(['result4', 'result5', 'result6'])
        .mockResolvedValueOnce(['result7']);
      const options: BatchOptions = { batchSize: 3 };
      const expectedResults = ['result1', 'result2', 'result3', 'result4', 'result5', 'result6', 'result7'];

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(processor).toHaveBeenCalledTimes(3);
      expect(processor).toHaveBeenCalledWith([1, 2, 3]);
      expect(processor).toHaveBeenCalledWith([4, 5, 6]);
      expect(processor).toHaveBeenCalledWith([7]);
    });

    it('should handle processor returning empty results', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue([]);
      const options: BatchOptions = { batchSize: 2 };

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor, options);

      // Assert
      expect(result).toEqual([]);
      expect(processor).toHaveBeenCalledTimes(2);
    });

    it('should handle processor returning different number of results than items', async () => {
      // Arrange
      const items = [1, 2, 3];
      const processor = jest.fn()
        .mockResolvedValueOnce(['result1']) // Fewer results than items
        .mockResolvedValueOnce(['result2', 'result3', 'result4']); // More results than items
      const options: BatchOptions = { batchSize: 2 };
      const expectedResults = ['result1', 'result2', 'result3', 'result4'];

      // Act
      const result = await vectorBatchProcessor.processBatch(items, processor, options);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(processor).toHaveBeenCalledTimes(2);
    });
  });

  describe('processBatchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      // Arrange
      const batch = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['result1', 'result2', 'result3']);
      const retryAttempts = 3;

      // Act
      const result = await (vectorBatchProcessor as any).processBatchWithRetry(batch, processor, retryAttempts);

      // Assert
      expect(result).toEqual(['result1', 'result2', 'result3']);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      // Arrange
      const batch = [1, 2, 3];
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(['result1', 'result2', 'result3']);
      const retryAttempts = 3;

      // Mock setTimeout to avoid delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((callback) => callback()) as any;

      try {
        // Act
        const result = await (vectorBatchProcessor as any).processBatchWithRetry(batch, processor, retryAttempts);

        // Assert
        expect(result).toEqual(['result1', 'result2', 'result3']);
        expect(processor).toHaveBeenCalledTimes(2);
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should fail after all retry attempts', async () => {
      // Arrange
      const batch = [1, 2, 3];
      const error = new Error('All attempts failed');
      const processor = jest.fn().mockRejectedValue(error);
      const retryAttempts = 2;

      // Mock setTimeout to avoid delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((callback) => callback()) as any;

      try {
        // Act & Assert
        await expect((vectorBatchProcessor as any).processBatchWithRetry(batch, processor, retryAttempts))
          .rejects.toThrow('All attempts failed');
        expect(processor).toHaveBeenCalledTimes(2);
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should use zero retry attempts', async () => {
      // Arrange
      const batch = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue(['result1', 'result2', 'result3']);
      const retryAttempts = 0;

      // Act
      const result = await (vectorBatchProcessor as any).processBatchWithRetry(batch, processor, retryAttempts);

      // Assert
      expect(result).toEqual(['result1', 'result2', 'result3']);
      expect(processor).toHaveBeenCalledTimes(1);
    });
  });

  describe('delay', () => {
    it('should create a delay', async () => {
      // Arrange
      const ms = 100;
      const startTime = Date.now();

      // Act
      await (vectorBatchProcessor as any).delay(ms);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeGreaterThanOrEqual(ms);
    });
  });

  describe('integration tests', () => {
    it('should handle complex batch processing scenario', async () => {
      // Arrange
      const items = Array.from({ length: 25 }, (_, i) => i + 1); // 25 items
      let callCount = 0;
      const processor = jest.fn().mockImplementation((batch) => {
        callCount++;
        if (callCount === 2) {
          // Fail on second batch
          return Promise.reject(new Error('Batch processing failed'));
        }
        return Promise.resolve(batch.map((item: number) => `result-${item}`));
      });
      const options: BatchOptions = { batchSize: 10, retryAttempts: 2 };

      // Mock setTimeout to avoid delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((callback) => callback()) as any;

      try {
        // Act
        const result = await vectorBatchProcessor.processBatch(items, processor, options);

        // Assert
        expect(result).toHaveLength(25);
        expect(result[0]).toBe('result-1');
        expect(result[24]).toBe('result-25');
        expect(processor).toHaveBeenCalledTimes(7); // 3 batches + 1 retry for second batch + 3 batches for retry
        expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch processing attempt 1 failed', { error: 'Batch processing failed' });
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  });
});