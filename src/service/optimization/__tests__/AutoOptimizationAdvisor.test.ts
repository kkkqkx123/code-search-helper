import { AutoOptimizationAdvisor, OptimizationRecommendation, AdvisorOptions } from '../AutoOptimizationAdvisor';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { PerformanceDashboard } from '../../monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../monitoring/PerformanceMetricsCollector';
import { GraphBatchOptimizer } from '../../graph/utils/GraphBatchOptimizer';
import { GraphMappingCache } from '../../graph/caching/GraphMappingCache';

// Mock所有依赖项
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockPerformanceDashboard = {
  getDashboardStats: jest.fn(),
  recordMetric: jest.fn(),
};

const mockPerformanceMetricsCollector = {
  // 根据需要添加方法
};

const mockGraphBatchOptimizer = {
  getPerformanceStats: jest.fn(),
};

const mockGraphMappingCache = {
  getStats: jest.fn(),
};

describe('AutoOptimizationAdvisor', () => {
  let autoOptimizationAdvisor: AutoOptimizationAdvisor;
  let originalEnv: NodeJS.ProcessEnv;

  // 保存原始环境变量
  beforeAll(() => {
    originalEnv = { ...process.env };
    // 确保在测试模式下，这样不会启动定时器
    process.env.NODE_ENV = 'test';
    process.env.JEST_WORKER_ID = '1';
  });

  // 恢复原始环境变量
  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    autoOptimizationAdvisor = new AutoOptimizationAdvisor(
      mockLoggerService as unknown as LoggerService,
      mockPerformanceDashboard as unknown as PerformanceDashboard,
      mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
      mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
      mockGraphMappingCache as unknown as GraphMappingCache
    );
  });

  afterEach(async () => {
    await autoOptimizationAdvisor.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'AutoOptimizationAdvisor initialized',
        expect.objectContaining({
          options: expect.objectContaining({
            minConfidence: 0.7,
            checkInterval: 300000, // 5分钟
            maxRecommendations: 50,
            enableAutoApply: false,
          }),
        })
      );

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'AutoOptimizationAdvisor running in test mode - periodic analysis disabled'
      );
    });

    it('should accept custom options', () => {
      const customOptions: Partial<AdvisorOptions> = {
        minConfidence: 0.8,
        checkInterval: 60000,
        maxRecommendations: 100,
        enableAutoApply: true,
      };

      const advisor = new AutoOptimizationAdvisor(
        mockLoggerService as unknown as LoggerService,
        mockPerformanceDashboard as unknown as PerformanceDashboard,
        mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
        mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
        mockGraphMappingCache as unknown as GraphMappingCache,
        customOptions
      );

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'AutoOptimizationAdvisor initialized',
        expect.objectContaining({
          options: expect.objectContaining(customOptions),
        })
      );

      advisor.destroy();
    });

    it('should throw error when initialization fails', () => {
      const failingLogger = {
        info: jest.fn().mockImplementation(() => {
          throw new Error("Initialization error");
        }),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      expect(() => {
        new AutoOptimizationAdvisor(
          failingLogger as unknown as LoggerService,
          mockPerformanceDashboard as unknown as PerformanceDashboard,
          mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
          mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
          mockGraphMappingCache as unknown as GraphMappingCache
        );
      }).toThrow();

      expect(failingLogger.error).toHaveBeenCalledWith(
        'Failed to initialize AutoOptimizationAdvisor',
        expect.objectContaining({
          error: expect.any(String),
          stack: expect.any(String),
        })
      );
    });
  });

  describe('startAnalysis and stopAnalysis', () => {
    it('should start analysis and log the start', () => {
      autoOptimizationAdvisor['checkInterval'] = null; // 重置
      autoOptimizationAdvisor.startAnalysis();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Starting auto optimization analysis',
        expect.objectContaining({
          interval: 300000,
        })
      );
    });

    it('should not start analysis if already started', () => {
      autoOptimizationAdvisor.startAnalysis(); // 启动一次
      autoOptimizationAdvisor.startAnalysis(); // 尝试再次启动

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Analysis already started');
    });

    it('should stop analysis', () => {
      autoOptimizationAdvisor['checkInterval'] = setInterval(() => { }, 1000) as NodeJS.Timeout;
      autoOptimizationAdvisor.stopAnalysis();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Stopped auto optimization analysis');
      expect(autoOptimizationAdvisor['checkInterval']).toBeNull();
    });

    it('should not stop analysis if not started', () => {
      autoOptimizationAdvisor.stopAnalysis();

      // 如果没有启动，调用stopAnalysis不会记录任何内容
      expect(mockLoggerService.info).not.toHaveBeenCalledWith('Stopped auto optimization analysis');
    });
  });

  describe('analyzeAndRecommend', () => {
    it('should analyze performance and generate recommendations', async () => {
      // Mock cache stats for low hit rate
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.5, // 低于0.7的阈值
        evictions: 150,
        hits: 500,
        misses: 500,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      // Mock batch stats for low throughput
      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 1200, // 高于1000ms阈值
        avgItemsPerMs: 0.05, // 低于0.1阈值
        totalOperations: 10,
        successfulOperations: 8,
        failedOperations: 2,
      });

      // Mock dashboard stats for high error rate
      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.08, // 高于0.05阈值
          totalOperations: 100,
          failedOperations: 8,
        },
        graph: {
          averageResponseTime: 2500, // 高于2000ms阈值
          totalQueries: 50,
          totalResponseTime: 125000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 100,
        },
      });

      const recommendations = await autoOptimizationAdvisor.analyzeAndRecommend();

      // 应该有6个推荐：缓存命中率、缓存驱逐、批处理吞吐量、批处理延迟、Qdrant错误率、图数据库响应时间
      expect(recommendations).toHaveLength(6);

      // 检查是否有缓存命中率相关的推荐
      const cacheHitRateRec = recommendations.find(rec =>
        rec.title === 'Low Cache Hit Rate'
      );
      expect(cacheHitRateRec).toBeDefined();
      expect(cacheHitRateRec?.priority).toBe('high');
      expect(cacheHitRateRec?.confidence).toBe(0.85);

      // 检查是否有缓存驱逐相关的推荐
      const cacheEvictionRec = recommendations.find(rec =>
        rec.title === 'High Cache Eviction Rate'
      );
      expect(cacheEvictionRec).toBeDefined();
      expect(cacheEvictionRec?.priority).toBe('medium');
      expect(cacheEvictionRec?.confidence).toBe(0.75);

      // 检查是否有批处理吞吐量相关的推荐
      const batchThroughputRec = recommendations.find(rec =>
        rec.title === 'Low Batch Processing Throughput'
      );
      expect(batchThroughputRec).toBeDefined();
      expect(batchThroughputRec?.priority).toBe('medium');
      expect(batchThroughputRec?.confidence).toBe(0.8);

      // 检查是否有批处理延迟相关的推荐
      const batchLatencyRec = recommendations.find(rec =>
        rec.title === 'High Batch Processing Latency'
      );
      expect(batchLatencyRec).toBeDefined();
      expect(batchLatencyRec?.priority).toBe('high');
      expect(batchLatencyRec?.confidence).toBe(0.78);

      // 检查是否有系统错误率相关的推荐
      const qdrantErrorRec = recommendations.find(rec =>
        rec.title === 'High Qdrant Error Rate'
      );
      expect(qdrantErrorRec).toBeDefined();
      expect(qdrantErrorRec?.priority).toBe('high');
      expect(qdrantErrorRec?.confidence).toBe(0.9);

      // 检查是否有图数据库响应时间相关的推荐
      const graphResponseRec = recommendations.find(rec =>
        rec.title === 'High Graph Database Response Time'
      );
      expect(graphResponseRec).toBeDefined();
      expect(graphResponseRec?.priority).toBe('medium');
      expect(graphResponseRec?.confidence).toBe(0.82);
    });

    it('should filter out low confidence recommendations', async () => {
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.75, // 高于阈值，不会产生推荐
        evictions: 50, // 低于阈值，不会产生推荐
        hits: 750,
        misses: 250,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 500, // 低于阈值，不会产生推荐
        avgItemsPerMs: 0.15, // 高于阈值，不会产生推荐
        totalOperations: 10,
        successfulOperations: 9,
        failedOperations: 1,
      });

      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.02, // 低于阈值，不会产生推荐
          totalOperations: 100,
          failedOperations: 2,
        },
        graph: {
          averageResponseTime: 1000, // 低于阈值，不会产生推荐
          totalQueries: 50,
          totalResponseTime: 50000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 10,
        },
      });

      const recommendations = await autoOptimizationAdvisor.analyzeAndRecommend();
      expect(recommendations).toHaveLength(0); // 没有低置信度的推荐
    });

    it('should clear old recommendations', async () => {
      // 添加一个超过24小时的旧推荐
      const oldRecommendation: OptimizationRecommendation = {
        id: 'old_rec',
        category: 'cache',
        priority: 'high',
        title: 'Old Recommendation',
        description: 'This is an old recommendation',
        suggestedAction: 'Action',
        expectedImprovement: 'Improvement',
        confidence: 0.9,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25小时前
      };

      autoOptimizationAdvisor['recommendations'].push(oldRecommendation);

      // 添加一个新推荐
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.5, // 低于阈值
        evictions: 150,
        hits: 500,
        misses: 500,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 1200,
        avgItemsPerMs: 0.05,
        totalOperations: 10,
        successfulOperations: 8,
        failedOperations: 2,
      });

      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.02,
          totalOperations: 100,
          failedOperations: 2,
        },
        graph: {
          averageResponseTime: 1000,
          totalQueries: 50,
          totalResponseTime: 50000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 100,
        },
      });

      const newRecommendations = await autoOptimizationAdvisor.analyzeAndRecommend();

      // 旧推荐应该被清除，只留下新生成的推荐
      const updatedRecommendations = await autoOptimizationAdvisor.getRecommendations();
      expect(updatedRecommendations).not.toContain(oldRecommendation);
      expect(updatedRecommendations).toHaveLength(newRecommendations.length);
    });
  });

  describe('getRecommendations', () => {
    beforeEach(async () => {
      // 添加一些测试推荐
      const testRecommendations: OptimizationRecommendation[] = [
        {
          id: 'rec1',
          category: 'cache',
          priority: 'high',
          title: 'Cache Recommendation 1',
          description: 'Cache description',
          suggestedAction: 'Action',
          expectedImprovement: 'Improvement',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          id: 'rec2',
          category: 'batching',
          priority: 'medium',
          title: 'Batching Recommendation 1',
          description: 'Batching description',
          suggestedAction: 'Action',
          expectedImprovement: 'Improvement',
          confidence: 0.8,
          timestamp: Date.now(),
        },
        {
          id: 'rec3',
          category: 'cache',
          priority: 'low',
          title: 'Cache Recommendation 2',
          description: 'Cache description 2',
          suggestedAction: 'Action',
          expectedImprovement: 'Improvement',
          confidence: 0.75,
          timestamp: Date.now(),
        },
      ];

      autoOptimizationAdvisor['recommendations'] = testRecommendations;
    });

    it('should return all recommendations when no filters are applied', async () => {
      const recommendations = await autoOptimizationAdvisor.getRecommendations();
      expect(recommendations).toHaveLength(3);
    });

    it('should filter recommendations by category', async () => {
      const cacheRecommendations = await autoOptimizationAdvisor.getRecommendations('cache');
      expect(cacheRecommendations).toHaveLength(2);
      expect(cacheRecommendations.every(rec => rec.category === 'cache')).toBe(true);
    });

    it('should filter recommendations by priority', async () => {
      const highPriorityRecommendations = await autoOptimizationAdvisor.getRecommendations(undefined, 'high');
      expect(highPriorityRecommendations).toHaveLength(1);
      expect(highPriorityRecommendations[0].priority).toBe('high');
    });

    it('should filter recommendations by both category and priority', async () => {
      const cacheHighPriorityRecommendations = await autoOptimizationAdvisor.getRecommendations('cache', 'high');
      expect(cacheHighPriorityRecommendations).toHaveLength(1);
      expect(cacheHighPriorityRecommendations[0].category).toBe('cache');
      expect(cacheHighPriorityRecommendations[0].priority).toBe('high');
    });

    it('should sort recommendations by priority and confidence', async () => {
      const recommendations = await autoOptimizationAdvisor.getRecommendations();

      // 检查是否按优先级排序（critical > high > medium > low）
      for (let i = 0; i < recommendations.length - 1; i++) {
        const current = recommendations[i];
        const next = recommendations[i + 1];

        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const currentPriority = priorityOrder[current.priority];
        const nextPriority = priorityOrder[next.priority];

        expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);

        // 如果优先级相同，检查置信度
        if (currentPriority === nextPriority) {
          expect(current.confidence).toBeGreaterThanOrEqual(next.confidence);
        }
      }
    });
  });

  describe('applyRecommendation', () => {
    it('should return false for non-existent recommendation', async () => {
      const result = await autoOptimizationAdvisor.applyRecommendation('non-existent-id');
      expect(result).toBe(false);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Recommendation not found',
        { recommendationId: 'non-existent-id' }
      );
    });

    it('should apply cache recommendation', async () => {
      const cacheRecommendation: OptimizationRecommendation = {
        id: 'cache-rec-1',
        category: 'cache',
        priority: 'high',
        title: 'Cache Recommendation',
        description: 'Cache description',
        suggestedAction: 'Action',
        expectedImprovement: 'Improvement',
        confidence: 0.9,
        timestamp: Date.now(),
      };

      autoOptimizationAdvisor['recommendations'].push(cacheRecommendation);

      const result = await autoOptimizationAdvisor.applyRecommendation('cache-rec-1');
      expect(result).toBe(true);

      // 检查是否记录了应用历史
      const history = await autoOptimizationAdvisor.getOptimizationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].recommendationId).toBe('cache-rec-1');
      expect(history[0].applied).toBe(true);
    });

    it('should apply batching recommendation', async () => {
      const batchingRecommendation: OptimizationRecommendation = {
        id: 'batching-rec-1',
        category: 'batching',
        priority: 'medium',
        title: 'Batching Recommendation',
        description: 'Batching description',
        suggestedAction: 'Action',
        expectedImprovement: 'Improvement',
        confidence: 0.8,
        timestamp: Date.now(),
      };

      autoOptimizationAdvisor['recommendations'].push(batchingRecommendation);

      const result = await autoOptimizationAdvisor.applyRecommendation('batching-rec-1');
      expect(result).toBe(true);

      // 检查是否记录了应用历史
      const history = await autoOptimizationAdvisor.getOptimizationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].recommendationId).toBe('batching-rec-1');
      expect(history[0].applied).toBe(true);
    });

    it('should return false for unknown recommendation category', async () => {
      const unknownRecommendation: OptimizationRecommendation = {
        id: 'unknown-rec-1',
        category: 'system',
        priority: 'high',
        title: 'System Recommendation',
        description: 'System description',
        suggestedAction: 'Action',
        expectedImprovement: 'Improvement',
        confidence: 0.9,
        timestamp: Date.now(),
      };

      autoOptimizationAdvisor['recommendations'].push(unknownRecommendation);

      const result = await autoOptimizationAdvisor.applyRecommendation('unknown-rec-1');
      expect(result).toBe(false);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Unknown recommendation category',
        { category: 'system' }
      );
    });

    it('should handle errors when applying recommendation', async () => {
      // 创建一个会抛出错误的顾问实例
      const advisorWithError = new AutoOptimizationAdvisor(
        mockLoggerService as unknown as LoggerService,
        mockPerformanceDashboard as unknown as PerformanceDashboard,
        mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
        mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
        mockGraphMappingCache as unknown as GraphMappingCache
      );

      // Mock applyCacheRecommendation to throw an error
      jest.spyOn(advisorWithError as any, 'applyCacheRecommendation').mockRejectedValue(new Error('Test error'));

      const cacheRecommendation: OptimizationRecommendation = {
        id: 'error-rec-1',
        category: 'cache',
        priority: 'high',
        title: 'Cache Recommendation',
        description: 'Cache description',
        suggestedAction: 'Action',
        expectedImprovement: 'Improvement',
        confidence: 0.9,
        timestamp: Date.now(),
      };

      advisorWithError['recommendations'].push(cacheRecommendation);

      const result = await advisorWithError.applyRecommendation('error-rec-1');
      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Error applying recommendation',
        expect.objectContaining({
          recommendationId: 'error-rec-1',
          error: 'Test error'
        })
      );

      await advisorWithError.destroy();
    });
  });

  describe('analyzeCachePerformance', () => {
    it('should generate recommendation for low cache hit rate', async () => {
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.5, // 低于0.7阈值
        evictions: 50,
        hits: 500,
        misses: 500,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeCachePerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('Low Cache Hit Rate');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].confidence).toBe(0.85);
      expect(recommendations[0].currentValue).toBe(0.5);
    });

    it('should generate recommendation for high cache evictions', async () => {
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.8, // 高于阈值，不会产生命中率推荐
        evictions: 150, // 高于10阈值
        hits: 800,
        misses: 200,
        totalRequests: 1000,
        size: 10,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeCachePerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('High Cache Eviction Rate');
      expect(recommendations[0].priority).toBe('medium');
      expect(recommendations[0].confidence).toBe(0.75);
      expect(recommendations[0].currentValue).toBe(150);
    });

    it('should generate multiple recommendations when appropriate', async () => {
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.5, // 低于阈值
        evictions: 150, // 高于阈值
        hits: 500,
        misses: 500,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeCachePerformance();
      expect(recommendations).toHaveLength(2);
      expect(recommendations.some((rec: { title: string; }) => rec.title === 'Low Cache Hit Rate')).toBe(true);
      expect(recommendations.some((rec: { title: string; }) => rec.title === 'High Cache Eviction Rate')).toBe(true);
    });

    it('should return empty array when no issues detected', async () => {
      mockGraphMappingCache.getStats.mockResolvedValue({
        hitRate: 0.85, // 高于阈值
        evictions: 50, // 低于阈值
        hits: 850,
        misses: 150,
        totalRequests: 1000,
        size: 100,
        maxSize: 200,
        lastUpdate: Date.now(),
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeCachePerformance();
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('analyzeBatchingPerformance', () => {
    it('should generate recommendation for low batch throughput', async () => {
      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 800,
        avgItemsPerMs: 0.05, // 低于0.1阈值
        totalOperations: 10,
        successfulOperations: 9,
        failedOperations: 1,
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeBatchingPerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('Low Batch Processing Throughput');
      expect(recommendations[0].priority).toBe('medium');
      expect(recommendations[0].confidence).toBe(0.8);
      expect(recommendations[0].currentValue).toBe(0.05);
    });

    it('should generate recommendation for high batch processing latency', async () => {
      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 1500, // 高于1000ms阈值
        avgItemsPerMs: 0.15, // 高于阈值，不会产生吞吐量推荐
        totalOperations: 10,
        successfulOperations: 9,
        failedOperations: 1,
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeBatchingPerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('High Batch Processing Latency');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].confidence).toBe(0.78);
      expect(recommendations[0].currentValue).toBe(1500);
    });

    it('should return empty array when no issues detected', async () => {
      mockGraphBatchOptimizer.getPerformanceStats.mockReturnValue({
        avgProcessingTime: 500, // 低于阈值
        avgItemsPerMs: 0.15, // 高于阈值
        totalOperations: 10,
        successfulOperations: 9,
        failedOperations: 1,
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeBatchingPerformance();
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('analyzeSystemPerformance', () => {
    it('should generate recommendation for high Qdrant error rate', async () => {
      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.08, // 高于0.05阈值
          totalOperations: 100,
          failedOperations: 8,
        },
        graph: {
          averageResponseTime: 500, // 低于阈值
          totalQueries: 50,
          totalResponseTime: 25000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 10,
        },
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeSystemPerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('High Qdrant Error Rate');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].confidence).toBe(0.9);
      expect(recommendations[0].currentValue).toBe(0.08);
    });

    it('should generate recommendation for high graph response time', async () => {
      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.02, // 低于阈值
          totalOperations: 100,
          failedOperations: 2,
        },
        graph: {
          averageResponseTime: 2500, // 高于2000ms阈值
          totalQueries: 50,
          totalResponseTime: 125000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 100,
        },
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeSystemPerformance();
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('High Graph Database Response Time');
      expect(recommendations[0].priority).toBe('medium');
      expect(recommendations[0].confidence).toBe(0.82);
      expect(recommendations[0].currentValue).toBe(2500);
    });

    it('should generate multiple recommendations when appropriate', async () => {
      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.08, // 高于阈值
          totalOperations: 100,
          failedOperations: 8,
        },
        graph: {
          averageResponseTime: 2500, // 高于阈值
          totalQueries: 50,
          totalResponseTime: 125000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 100,
        },
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeSystemPerformance();
      expect(recommendations).toHaveLength(2);
      expect(recommendations.some((rec: { title: string; }) => rec.title === 'High Qdrant Error Rate')).toBe(true);
      expect(recommendations.some((rec: { title: string; }) => rec.title === 'High Graph Database Response Time')).toBe(true);
    });

    it('should return empty array when no issues detected', async () => {
      mockPerformanceDashboard.getDashboardStats.mockResolvedValue({
        qdrant: {
          errorRate: 0.02, // 低于阈值
          totalOperations: 100,
          failedOperations: 2,
        },
        graph: {
          averageResponseTime: 500, // 低于阈值
          totalQueries: 50,
          totalResponseTime: 25000,
        },
        indexing: {
          averageIndexingTime: 1000,
          totalIndexed: 100,
        },
      });

      const recommendations = await (autoOptimizationAdvisor as any).analyzeSystemPerformance();
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('getOptimizationHistory', () => {
    it('should return optimization history', async () => {
      const testHistory = [
        { recommendationId: 'rec1', applied: true, appliedAt: Date.now() },
        { recommendationId: 'rec2', applied: false, appliedAt: Date.now() - 1000 },
      ];

      autoOptimizationAdvisor['history'] = testHistory;

      const history = await autoOptimizationAdvisor.getOptimizationHistory();
      expect(history).toEqual(testHistory);
    });
  });

  describe('getOptimizationStats', () => {
    it('should return optimization statistics', async () => {
      const testRecommendations: OptimizationRecommendation[] = [
        {
          id: 'rec1', category: 'cache', priority: 'high', title: 'Test', description: 'Test',
          suggestedAction: 'Action', expectedImprovement: 'Improvement', confidence: 0.9, timestamp: Date.now()
        },
        {
          id: 'rec2', category: 'batching', priority: 'medium', title: 'Test', description: 'Test',
          suggestedAction: 'Action', expectedImprovement: 'Improvement', confidence: 0.8, timestamp: Date.now()
        },
        {
          id: 'rec3', category: 'cache', priority: 'low', title: 'Test', description: 'Test',
          suggestedAction: 'Action', expectedImprovement: 'Improvement', confidence: 0.75, timestamp: Date.now()
        },
      ];

      const testHistory = [
        { recommendationId: 'rec1', applied: true, appliedAt: Date.now() },
        { recommendationId: 'rec2', applied: false, appliedAt: Date.now() - 1000 },
      ];

      autoOptimizationAdvisor['recommendations'] = testRecommendations;
      autoOptimizationAdvisor['history'] = testHistory;

      const stats = await autoOptimizationAdvisor.getOptimizationStats();

      expect(stats.totalRecommendations).toBe(3);
      expect(stats.appliedRecommendations).toBe(1); // 只有一个applied为true
      expect(stats.categoryBreakdown).toEqual({ cache: 2, batching: 1 });
    });
  });

  describe('destroy', () => {
    it('should stop analysis and log destruction', async () => {
      const advisor = new AutoOptimizationAdvisor(
        mockLoggerService as unknown as LoggerService,
        mockPerformanceDashboard as unknown as PerformanceDashboard,
        mockPerformanceMetricsCollector as unknown as PerformanceMetricsCollector,
        mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
        mockGraphMappingCache as unknown as GraphMappingCache
      );

      // 启动分析以便可以停止
      advisor['checkInterval'] = setInterval(() => { }, 1000) as NodeJS.Timeout;

      await advisor.destroy();

      expect(mockLoggerService.info).toHaveBeenCalledWith('AutoOptimizationAdvisor destroyed');
      expect(advisor['checkInterval']).toBeNull();
    });
  });
});