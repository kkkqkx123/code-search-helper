import 'reflect-metadata';
import { GraphBatchOptimizer, BatchOptimizerConfig } from '../GraphBatchOptimizer';
import { GraphNodeType, GraphRelationshipType } from '../../mapping/IGraphDataMappingService';

// Simple mock for LoggerService
const mockLoggerService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn()
};

describe('GraphBatchOptimizer', () => {
  let optimizer: GraphBatchOptimizer;
  const defaultConfig: Partial<BatchOptimizerConfig> = {
    defaultBatchSize: 50,
    maxBatchSize: 500,
    minBatchSize: 10,
    maxConcurrentBatches: 5,
    timeout: 30000,
    performanceThreshold: 1000,
    adjustmentFactor: 0.1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    optimizer = new GraphBatchOptimizer(mockLoggerService as any, defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(optimizer).toBeDefined();
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'GraphBatchOptimizer initialized',
        expect.objectContaining({
          config: expect.objectContaining({
            defaultBatchSize: 50,
            maxBatchSize: 500,
            minBatchSize: 10,
            maxConcurrentBatches: 5,
            timeout: 30000,
            performanceThreshold: 1000,
            adjustmentFactor: 0.1
          })
        })
      );
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<BatchOptimizerConfig> = {
        defaultBatchSize: 100,
        maxConcurrentBatches: 3
      };

      const customOptimizer = new GraphBatchOptimizer(mockLoggerService as any, customConfig);
      expect(customOptimizer).toBeDefined();
    });
  });

  describe('executeBatch', () => {
    const mockItems = Array.from({ length: 150 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      type: 'test'
    }));

    const mockOperation = jest.fn().mockResolvedValue('success');

    it('should process items in batches', async () => {
      const result = await optimizer.executeBatch(mockItems, mockOperation);

      expect(result.success).toBe(true);
      expect(result.batchSize).toBe(50);
      expect(result.successfulItems).toHaveLength(150);
      expect(result.failedItems).toHaveLength(0);
      expect(result.results).toHaveLength(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should handle empty items array', async () => {
      const result = await optimizer.executeBatch([], mockOperation);

      expect(result.success).toBe(true);
      expect(result.successfulItems).toHaveLength(0);
      expect(result.failedItems).toHaveLength(0);
    });

    it('should respect custom batch size', async () => {
      const customBatchSize = 25;
      const result = await optimizer.executeBatch(mockItems, mockOperation, {
        batchSize: customBatchSize
      });

      expect(result.batchSize).toBe(customBatchSize);
      expect(mockOperation).toHaveBeenCalledTimes(6); // 150/25 = 6 batches
    });

    it('should handle operation failures', async () => {
      const failingOperation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockResolvedValueOnce('success');

      const result = await optimizer.executeBatch(mockItems, failingOperation);

      expect(result.success).toBe(false);
      expect(result.failedItems.length).toBeGreaterThan(0);
    });
  });

  describe('executeNodeBatch', () => {
    const mockNodes = Array.from({ length: 75 }, (_, i) => ({
      id: `node-${i}`,
      type: GraphNodeType.FILE,
      properties: { name: `Node ${i}`, path: `/file${i}.ts` }
    }));

    it('should process node batches', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await optimizer.executeNodeBatch(mockNodes, mockOperation);

      expect(result.success).toBe(true);
      expect(result.successfulItems).toHaveLength(75);
    });
  });

  describe('executeRelationshipBatch', () => {
    const mockRelationships = Array.from({ length: 60 }, (_, i) => ({
      id: `rel-${i}`,
      type: GraphRelationshipType.CONTAINS,
      fromNodeId: `source-${i}`,
      toNodeId: `target-${i}`,
      properties: {}
    }));

    it('should process relationship batches', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await optimizer.executeRelationshipBatch(mockRelationships, mockOperation);

      expect(result.success).toBe(true);
      expect(result.successfulItems).toHaveLength(60);
    });
  });

  describe('executeWithOptimalBatching', () => {
    it('should use optimal batch size based on performance history', async () => {
      const mockItems = Array.from({ length: 200 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        type: 'test'
      }));

      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await optimizer.executeWithOptimalBatching(mockItems, mockOperation);

      expect(result.success).toBe(true);
    });
  });

  describe('executeGraphMixedBatch', () => {
    it('should process mixed node and relationship batches', async () => {
      const mockNodes = Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        type: GraphNodeType.FILE,
        properties: { name: `Node ${i}` }
      }));

      const mockRelationships = Array.from({ length: 40 }, (_, i) => ({
        id: `rel-${i}`,
        type: GraphRelationshipType.CONTAINS,
        fromNodeId: `source-${i}`,
        toNodeId: `target-${i}`,
        properties: {}
      }));

      const mockNodeOperation = jest.fn().mockResolvedValue('node-success');
      const mockRelOperation = jest.fn().mockResolvedValue('rel-success');

      const result = await optimizer.executeGraphMixedBatch(
        mockNodes,
        mockRelationships,
        mockNodeOperation,
        mockRelOperation
      );

      expect(result.nodeResult.success).toBe(true);
      expect(result.relationshipResult.success).toBe(true);
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics', () => {
      const stats = optimizer.getPerformanceStats();

      expect(stats).toHaveProperty('avgProcessingTime');
      expect(stats).toHaveProperty('avgItemsPerMs');
      expect(stats).toHaveProperty('optimalBatchSize');
      expect(stats).toHaveProperty('historyLength');
    });
  });
});