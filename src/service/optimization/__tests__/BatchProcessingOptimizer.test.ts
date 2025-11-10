import { BatchProcessingOptimizer, OptimizationRecommendation } from '../BatchProcessingOptimizer';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { PerformanceDashboard } from '../../monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../monitoring/PerformanceMetricsCollector';
import { BatchResult } from '../../../infrastructure/batching/types';

// Mock所有依赖项
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockGraphBatchOptimizer = {
  executeBatch: jest.fn(),
  getPerformanceStats: jest.fn(),
  updateConfig: jest.fn(),
};

const mockPerformanceDashboard = {
  recordMetric: jest.fn(),
  getDashboardStats: jest.fn(),
};

const mockPerformanceMetricsCollector = {
  // 根据需要添加方法
};

describe('BatchProcessingOptimizer', () => {
  let batchProcessingOptimizer: BatchProcessingOptimizer;
  let originalEnv: NodeJS.ProcessEnv;

  // 保存原始环境变量
  beforeAll(() => {
    originalEnv = { ...process.env };
    // 确保在测试模式下，这样不会启动定时器
    process.env.NODE_ENV = 'test';
  });

  // 恢复原始环境变量
  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    batchProcessingOptimizer = new BatchProcessingOptimizer(
      mockLoggerService as unknown as LoggerService,
      mockGraphBatchOptimizer as unknown as BatchProcessingService,
      mockPerformanceDashboard as unknown as PerformanceDashboard,
      mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector
    );
  });

  afterEach(async () => {
    await batchProcessingOptimizer.destroy();
  });

 describe('constructor', () => {
   it('should initialize with default configuration', () => {
     // BatchProcessingOptimizer在构造函数中会自动调用startAutoTuning，所以会有2次调用
     // 第一次是初始化日志，第二次是开始自动调优日志
     expect(mockLoggerService.info).toHaveBeenNthCalledWith(1,
       'BatchProcessingOptimizer initialized',
       expect.objectContaining({
         config: expect.objectContaining({
           minBatchSize: 10,
           maxBatchSize: 500,
           defaultBatchSize: 50,
           minConcurrency: 1,
           maxConcurrency: 10,
           defaultConcurrency: 3,
           performanceThreshold: 1000,
           adjustmentFactor: 0.1,
           metricsRetentionPeriod: 86400000, // 24小时
           enableAutoTuning: true,
           tuningInterval: 600,
         }),
       })
     );

     const params = batchProcessingOptimizer.getCurrentParams();
     expect(params.batchSize).toBe(50);
     expect(params.concurrency).toBe(3);
   });

    it('should accept custom configuration', () => {
      const customConfig = {
        minBatchSize: 5,
        maxBatchSize: 100,
        defaultBatchSize: 25,
        performanceThreshold: 500,
      };

      const optimizer = new BatchProcessingOptimizer(
        mockLoggerService as unknown as LoggerService,
        mockGraphBatchOptimizer as unknown as BatchProcessingService,
        mockPerformanceDashboard as unknown as PerformanceDashboard,
        mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
        customConfig
      );

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'BatchProcessingOptimizer initialized',
        expect.objectContaining({
          config: expect.objectContaining(customConfig),
        })
      );

      optimizer.destroy();
    });
  });

  describe('startAutoTuning and stopAutoTuning', () => {
    it('should start auto tuning and log the start', () => {
      // 需要停止默认的自动调优，然后重新开始
      batchProcessingOptimizer['tuningInterval'] = null; // 重置
      batchProcessingOptimizer.startAutoTuning();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Starting batch processing auto tuning',
        expect.objectContaining({
          interval: 600,
        })
      );
    });

    it('should not start auto tuning if already started', () => {
      batchProcessingOptimizer.startAutoTuning(); // 启动一次
      batchProcessingOptimizer.startAutoTuning(); // 尝试再次启动

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Auto tuning already started');
    });

    it('should stop auto tuning', () => {
      batchProcessingOptimizer['tuningInterval'] = setInterval(() => {}, 1000) as NodeJS.Timeout;
      batchProcessingOptimizer.stopAutoTuning();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Stopped batch processing auto tuning');
      expect(batchProcessingOptimizer['tuningInterval']).toBeNull();
    });

    it('should not stop auto tuning if not started', () => {
      // 首先停止已启动的自动调优
      batchProcessingOptimizer['tuningInterval'] = null; // 重置，模拟未启动状态
      batchProcessingOptimizer.stopAutoTuning();

      // 如果没有启动，调用stopAutoTuning不会记录任何内容
      expect(mockLoggerService.info).not.toHaveBeenCalledWith('Stopped batch processing auto tuning');
    });
  });

  describe('executeOptimizedBatch', () => {
    it('should execute batch operation with optimized parameters', async () => {
      const mockItems = [1, 2, 3, 4, 5];
      const mockOperation = jest.fn().mockResolvedValue('result');
      const mockBatchResult: any = {
        success: true,
        results: ['result1', 'result2', 'result3', 'result4', 'result5'],
        successfulItems: mockItems,
        failedItems: [],
        processingTime: 100,
        batchSize: 5,
      };

      mockGraphBatchOptimizer.executeBatch.mockResolvedValue(mockBatchResult);

      const result = await batchProcessingOptimizer.executeOptimizedBatch(
        mockItems,
        mockOperation
      );

      expect(mockGraphBatchOptimizer.executeBatch).toHaveBeenCalledWith(
        mockItems,
        mockOperation,
        { batchSize: 50, concurrency: 4 } // 使用调整后的值
      );

      expect(result.results).toEqual(mockBatchResult.results);
      expect(result.batchSize).toBe(50);
      expect(result.concurrency).toBe(4);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.throughput).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch operation failure', async () => {
      const mockItems = [1, 2, 3];
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const expectedError = new Error('Operation failed');

      mockGraphBatchOptimizer.executeBatch.mockRejectedValue(expectedError);

      await expect(
        batchProcessingOptimizer.executeOptimizedBatch(mockItems, mockOperation)
      ).rejects.toThrow('Operation failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Optimized batch operation failed',
        expect.objectContaining({
          error: 'Operation failed',
          itemCount: 3,
        })
      );
    });

    it('should record performance metrics after successful operation', async () => {
      const mockItems = [1, 2, 3];
      const mockOperation = jest.fn().mockResolvedValue('result');
      const mockBatchResult: any = {
        success: true,
        results: ['result1', 'result2', 'result3'],
        successfulItems: mockItems,
        failedItems: [],
        processingTime: 100,
        batchSize: 3,
      };

      mockGraphBatchOptimizer.executeBatch.mockResolvedValue(mockBatchResult);

      await batchProcessingOptimizer.executeOptimizedBatch(mockItems, mockOperation);

      // 检查是否记录了性能指标
      expect(mockPerformanceDashboard.recordMetric).toHaveBeenCalledTimes(3);
      expect(mockPerformanceDashboard.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metricName: 'batch.processing_time',
          unit: 'milliseconds',
        })
      );
      expect(mockPerformanceDashboard.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metricName: 'batch.throughput',
          unit: 'items_per_second',
        })
      );
      expect(mockPerformanceDashboard.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metricName: 'batch.success_rate',
          unit: 'ratio',
        })
      );
    });
  });

  describe('getCurrentParams and setParams', () => {
    it('should get current parameters', () => {
      const params = batchProcessingOptimizer.getCurrentParams();

      expect(params).toEqual({
        batchSize: 50,
        concurrency: 3,
      });
    });

    it('should set parameters within valid ranges', () => {
      batchProcessingOptimizer.setParams(100, 5);

      const params = batchProcessingOptimizer.getCurrentParams();
      expect(params.batchSize).toBe(100);
      expect(params.concurrency).toBe(5);

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Batch processing parameters updated',
        expect.objectContaining({
          batchSize: 100,
          concurrency: 5,
        })
      );
    });

    it('should constrain parameters to valid ranges', () => {
      batchProcessingOptimizer.setParams(1000, 20); // 超出最大值

      const params = batchProcessingOptimizer.getCurrentParams();
      expect(params.batchSize).toBe(500); // maxBatchSize
      expect(params.concurrency).toBe(10); // maxConcurrency

      batchProcessingOptimizer.setParams(0, 0); // 低于最小值

      const params2 = batchProcessingOptimizer.getCurrentParams();
      expect(params2.batchSize).toBe(10); // minBatchSize
      expect(params2.concurrency).toBe(1); // minConcurrency
    });
  });

  describe('getPerformanceHistory', () => {
    it('should return performance history within specified time range', async () => {
      // 添加一些测试数据
      const testMetrics = {
        batchSize: 50,
        concurrency: 3,
        processingTime: 100,
        itemsProcessed: 10,
        throughput: 100,
        successRate: 1,
        errorCount: 0,
        timestamp: Date.now() - 1000, // 1秒前
      };

      batchProcessingOptimizer['performanceHistory'].push(testMetrics);

      const history = await batchProcessingOptimizer.getPerformanceHistory(1); // 1小时内
      expect(history).toContain(testMetrics);
    });

    it('should filter out old performance history', async () => {
      const oldMetrics = {
        batchSize: 50,
        concurrency: 3,
        processingTime: 100,
        itemsProcessed: 10,
        throughput: 100,
        successRate: 1,
        errorCount: 0,
        timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2小时前
      };

      batchProcessingOptimizer['performanceHistory'].push(oldMetrics);

      const history = await batchProcessingOptimizer.getPerformanceHistory(1); // 1小时内
      expect(history).toHaveLength(0); // 应该不包含2小时前的数据
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should return optimization recommendations', async () => {
      const mockRecommendation: OptimizationRecommendation = {
        id: 'test_rec',
        type: 'batch_size',
        currentValue: 50,
        recommendedValue: 75,
        confidence: 0.8,
        impact: 'medium',
        reason: 'Test reason',
        expectedImprovement: 10,
        timestamp: Date.now(),
      };

      batchProcessingOptimizer['optimizationRecommendations'].push(mockRecommendation);

      const recommendations = await batchProcessingOptimizer.getOptimizationRecommendations();
      expect(recommendations).toContain(mockRecommendation);
    });

    it('should sort recommendations by confidence', async () => {
      const lowConfRec: OptimizationRecommendation = {
        id: 'low_conf',
        type: 'batch_size',
        currentValue: 50,
        recommendedValue: 75,
        confidence: 0.6,
        impact: 'medium',
        reason: 'Low confidence',
        expectedImprovement: 10,
        timestamp: Date.now(),
      };

      const highConfRec: OptimizationRecommendation = {
        id: 'high_conf',
        type: 'batch_size',
        currentValue: 50,
        recommendedValue: 75,
        confidence: 0.9,
        impact: 'high',
        reason: 'High confidence',
        expectedImprovement: 20,
        timestamp: Date.now(),
      };

      batchProcessingOptimizer['optimizationRecommendations'].push(lowConfRec, highConfRec);

      const recommendations = await batchProcessingOptimizer.getOptimizationRecommendations();
      expect(recommendations[0]).toBe(highConfRec);
      expect(recommendations[1]).toBe(lowConfRec);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return performance summary', async () => {
      const summary = await batchProcessingOptimizer.getPerformanceSummary();

      expect(summary).toHaveProperty('currentParams');
      expect(summary).toHaveProperty('avgProcessingTime');
      expect(summary).toHaveProperty('avgThroughput');
      expect(summary).toHaveProperty('avgSuccessRate');
      expect(summary).toHaveProperty('recommendations');
    });
  });

 describe('reset', () => {
    it('should reset optimizer to default values', async () => {
      // 修改一些值
      batchProcessingOptimizer['performanceHistory'].push({
        batchSize: 10,
        concurrency: 5,
        processingTime: 200,
        itemsProcessed: 10,
        throughput: 50,
        successRate: 0.9,
        errorCount: 1,
        timestamp: Date.now(),
      });

      batchProcessingOptimizer['optimizationRecommendations'].push({
        id: 'test',
        type: 'batch_size' as const,
        currentValue: 50,
        recommendedValue: 75,
        confidence: 0.8,
        impact: 'medium' as const,
        reason: 'Test',
        expectedImprovement: 10,
        timestamp: Date.now(),
      });

      batchProcessingOptimizer.setParams(100, 8);

      // 重置
      await batchProcessingOptimizer.reset();

      const params = batchProcessingOptimizer.getCurrentParams();
      expect(params.batchSize).toBe(50); // 默认值
      expect(params.concurrency).toBe(3); // 默认值

      const history = await batchProcessingOptimizer.getPerformanceHistory();
      expect(history).toHaveLength(0);

      const recommendations = await batchProcessingOptimizer.getOptimizationRecommendations();
      expect(recommendations).toHaveLength(0);

      expect(mockLoggerService.info).toHaveBeenCalledWith('BatchProcessingOptimizer reset to defaults');
    });
  });

  describe('destroy', () => {
    it('should stop auto tuning and log destruction', async () => {
      await batchProcessingOptimizer.destroy();

      expect(mockLoggerService.info).toHaveBeenCalledWith('BatchProcessingOptimizer destroyed');
    });
  });

  describe('calculateOptimalParams', () => {
    it('should calculate optimal params based on strategy', () => {
      const result = batchProcessingOptimizer['calculateOptimalParams'](100, undefined, undefined, 'balanced');
      
      expect(result).toHaveProperty('batchSize');
      expect(result).toHaveProperty('concurrency');
    });
  });
});