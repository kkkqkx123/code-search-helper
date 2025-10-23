import { NormalizationIntegrationService } from '../NormalizationIntegrationService';
import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { UnifiedCacheManager } from '../../../../infrastructure/caching/UnifiedCacheManager';
import { ErrorHandlingManager } from '../../../../infrastructure/error-handling/ErrorHandlingManager';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { LoggerService } from '../../../../utils/LoggerService';

describe('NormalizationIntegrationService', () => {
  let service: NormalizationIntegrationService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockQueryNormalizer: jest.Mocked<QueryResultNormalizer>;
  let mockUniversalTextSplitter: jest.Mocked<UniversalTextSplitter>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;
  let mockCacheManager: jest.Mocked<UnifiedCacheManager>;
  let mockErrorHandlingManager: jest.Mocked<ErrorHandlingManager>;
  let mockTreeSitterService: jest.Mocked<TreeSitterCoreService>;

  beforeEach(() => {
    // 创建模拟对象
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockQueryNormalizer = {
      normalize: jest.fn(),
      getPerformanceStats: jest.fn(),
      resetStats: jest.fn(),
      setTreeSitterService: jest.fn(),
      setPerformanceMonitor: jest.fn()
    } as any;

    mockUniversalTextSplitter = {
      chunkBySemanticBoundaries: jest.fn(),
      chunkByBracketsAndLines: jest.fn(),
      chunkByLines: jest.fn(),
      setQueryNormalizer: jest.fn(),
      setTreeSitterService: jest.fn(),
      getStandardizationStats: jest.fn(),
      resetStandardizationStats: jest.fn()
    } as any;

    mockPerformanceMonitor = {
      startOperation: jest.fn(),
      endOperation: jest.fn(),
      getOperationStats: jest.fn(),
      resetMetrics: jest.fn(),
      getMetrics: jest.fn()
    } as any;

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      getGlobalStats: jest.fn(),
      resetStats: jest.fn(),
      clearAll: jest.fn()
    } as any;

    mockErrorHandlingManager = {
      executeWithFallback: jest.fn(),
      getErrorStats: jest.fn(),
      resetErrorHistory: jest.fn(),
      resetCircuitBreakers: jest.fn(),
      updateConfig: jest.fn(),
      getCircuitBreakerStates: jest.fn()
    } as any;

    mockTreeSitterService = {
      parseCode: jest.fn(),
      getSupportedLanguages: jest.fn()
    } as any;

    // 创建服务实例
    service = new NormalizationIntegrationService(
      mockLogger,
      mockQueryNormalizer,
      mockUniversalTextSplitter,
      mockPerformanceMonitor,
      mockCacheManager,
      mockErrorHandlingManager,
      mockTreeSitterService
    );
  });

  describe('processContent', () => {
    const testContent = 'function test() { return "hello"; }';
    const testLanguage = 'javascript';
    const testFilePath = '/test/file.js';

    it('should process content successfully with semantic chunking', async () => {
      // 模拟缓存未命中
      mockCacheManager.get.mockReturnValue(undefined);

      // 模拟分段结果
      const mockChunks = [
        {
          content: testContent,
          metadata: {
            startLine: 1,
            endLine: 1,
            language: testLanguage,
            filePath: testFilePath,
            type: 'semantic',
            complexity: 1,
            standardized: false
          }
        }
      ];
      mockUniversalTextSplitter.chunkBySemanticBoundaries.mockResolvedValue(mockChunks);

      // 模拟标准化结果
      const mockNormalizedResults = [
        {
          type: 'function',
          name: 'test',
          startLine: 1,
          endLine: 1,
          content: testContent,
          metadata: {
            language: testLanguage,
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        }
      ];
      mockQueryNormalizer.normalize.mockResolvedValue(mockNormalizedResults);

      // 模拟解析结果
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: {} as any
      });

      // 模拟性能监控
      mockPerformanceMonitor.startOperation.mockReturnValue('op-123');
      mockPerformanceMonitor.getOperationStats.mockReturnValue({
        totalOperations: 1,
        successRate: 1,
        averageDuration: 100,
        operationsByType: { process_content: 1 },
        operationsByLanguage: { javascript: 1 }
      });

      // 执行处理
      const result = await service.processContent(testContent, testLanguage, testFilePath);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.chunks).toEqual(mockChunks);
      expect(result.normalizedResults).toEqual(mockNormalizedResults);
      expect(result.metrics?.cacheHit).toBe(false);
      expect(result.metrics?.fallbackUsed).toBe(false);

      // 验证调用
      expect(mockUniversalTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(
        testContent, testFilePath, testLanguage
      );
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should use cached result when available', async () => {
      // 模拟缓存命中
      const cachedResult = {
        success: true,
        chunks: [{ content: testContent, metadata: {} }],
        normalizedResults: [],
        metrics: { processingTime: 50, cacheHit: true, fallbackUsed: false }
      };
      mockCacheManager.get.mockReturnValue(cachedResult);

      // 执行处理
      const result = await service.processContent(testContent, testLanguage, testFilePath);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.metrics?.cacheHit).toBe(true);

      // 验证没有调用处理方法
      expect(mockUniversalTextSplitter.chunkBySemanticBoundaries).not.toHaveBeenCalled();
      expect(mockQueryNormalizer.normalize).not.toHaveBeenCalled();
    });

    it('should handle errors with fallback when enabled', async () => {
      // 模拟缓存未命中
      mockCacheManager.get.mockReturnValue(undefined);

      // 模拟分段失败
      mockUniversalTextSplitter.chunkBySemanticBoundaries.mockRejectedValue(
        new Error('Chunking failed')
      );

      // 模拟错误处理降级
      const fallbackResult = {
        success: true,
        chunks: [{ content: testContent, metadata: { type: 'line' } }],
        normalizedResults: [],
        metrics: { processingTime: 100, cacheHit: false, fallbackUsed: true }
      };
      mockErrorHandlingManager.executeWithFallback.mockResolvedValue(fallbackResult);

      // 执行处理
      const result = await service.processContent(testContent, testLanguage, testFilePath);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.metrics?.fallbackUsed).toBe(true);

      // 验证错误处理被调用
      expect(mockErrorHandlingManager.executeWithFallback).toHaveBeenCalled();
    });

    it('should use different chunking strategies', async () => {
      // 模拟缓存未命中
      mockCacheManager.get.mockReturnValue(undefined);

      // 模拟括号分段结果
      const mockChunks = [{ content: testContent, metadata: { type: 'bracket' } }];
      mockUniversalTextSplitter.chunkByBracketsAndLines.mockResolvedValue(mockChunks);

      // 模拟性能监控
      mockPerformanceMonitor.startOperation.mockReturnValue('op-123');

      // 执行处理
      const result = await service.processContent(testContent, testLanguage, testFilePath, {
        chunkingStrategy: 'bracket'
      });

      // 验证结果
      expect(result.success).toBe(true);

      // 验证调用了正确的分段方法
      expect(mockUniversalTextSplitter.chunkByBracketsAndLines).toHaveBeenCalledWith(
        testContent, testFilePath, testLanguage
      );
      expect(mockUniversalTextSplitter.chunkBySemanticBoundaries).not.toHaveBeenCalled();
    });

    it('should disable normalization when requested', async () => {
      // 模拟缓存未命中
      mockCacheManager.get.mockReturnValue(undefined);

      // 模拟分段结果
      const mockChunks = [{ content: testContent, metadata: { type: 'semantic' } }];
      mockUniversalTextSplitter.chunkBySemanticBoundaries.mockResolvedValue(mockChunks);

      // 模拟性能监控
      mockPerformanceMonitor.startOperation.mockReturnValue('op-123');

      // 执行处理（禁用标准化）
      const result = await service.processContent(testContent, testLanguage, testFilePath, {
        enableNormalization: false
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.normalizedResults).toEqual([]);

      // 验证没有调用标准化
      expect(mockQueryNormalizer.normalize).not.toHaveBeenCalled();
    });
  });

  describe('getServiceStats', () => {
    it('should return aggregated stats from all services', () => {
      // 模拟各服务统计
      mockQueryNormalizer.getPerformanceStats.mockReturnValue({
        normalization: { totalNodes: 10, successfulNormalizations: 8 }
      });
      mockUniversalTextSplitter.getStandardizationStats.mockReturnValue({
        attempts: 5, successes: 4, failures: 1, fallbacks: 0
      });
      mockCacheManager.getGlobalStats.mockReturnValue({
        totalCaches: 2, totalEntries: 100, averageHitRate: 0.8
      });
      mockPerformanceMonitor.getOperationStats.mockReturnValue({
        totalOperations: 15, successRate: 0.9, averageDuration: 120
      });
      mockErrorHandlingManager.getErrorStats.mockReturnValue({
        totalErrors: 2, errorsByType: {}, errorsBySeverity: {}, recentErrors: []
      });

      // 获取统计
      const stats = service.getServiceStats();

      // 验证统计
      expect(stats.normalization).toBeDefined();
      expect(stats.chunking).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.errorHandling).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are working', async () => {
      // 模拟所有服务正常
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(['javascript', 'typescript']);
      mockCacheManager.getGlobalStats.mockReturnValue({ totalCaches: 2 });
      mockPerformanceMonitor.getMetrics.mockReturnValue({ timestamp: Date.now() });
      mockErrorHandlingManager.getErrorStats.mockReturnValue({ totalErrors: 0 });
      mockErrorHandlingManager.getCircuitBreakerStates.mockReturnValue({});

      // 执行健康检查
      const health = await service.healthCheck();

      // 验证结果
      expect(health.status).toBe('healthy');
      expect(health.services.treeSitter).toBe(true);
      expect(health.services.cache).toBe(true);
      expect(health.services.performanceMonitor).toBe(true);
      expect(health.services.errorHandling).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should return degraded status when some services are failing', async () => {
      // 模拟部分服务失败
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([]);
      mockCacheManager.getGlobalStats.mockReturnValue({ totalCaches: 2 });
      mockPerformanceMonitor.getMetrics.mockReturnValue({ timestamp: Date.now() });
      mockErrorHandlingManager.getErrorStats.mockReturnValue({ totalErrors: 0 });
      mockErrorHandlingManager.getCircuitBreakerStates.mockReturnValue({});

      // 执行健康检查
      const health = await service.healthCheck();

      // 验证结果
      expect(health.status).toBe('degraded');
      expect(health.services.treeSitter).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should return unhealthy status when most services are failing', async () => {
      // 模拟大部分服务失败
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([]);
      mockCacheManager.getGlobalStats.mockReturnValue({ totalCaches: 0 });
      mockPerformanceMonitor.getMetrics.mockReturnValue({ timestamp: 0 });
      mockErrorHandlingManager.getErrorStats.mockReturnValue({ totalErrors: 0 });
      mockErrorHandlingManager.getCircuitBreakerStates.mockReturnValue({});

      // 执行健康检查
      const health = await service.healthCheck();

      // 验证结果
      expect(health.status).toBe('unhealthy');
      expect(health.issues.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        enableCaching: false,
        enablePerformanceMonitoring: false,
        errorHandlingConfig: {
          maxRetries: 5,
          enableFallback: false
        }
      };

      // 更新配置
      service.updateConfig(newConfig);

      // 验证错误处理配置被更新
      expect(mockErrorHandlingManager.updateConfig).toHaveBeenCalledWith({
        maxRetries: 5,
        enableFallback: false
      });
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', () => {
      service.clearCache();
      expect(mockCacheManager.clearAll).toHaveBeenCalled();
    });
  });

  describe('stats management', () => {
    it('should reset all stats when requested', () => {
      service.resetStats();
      
      expect(mockQueryNormalizer.resetStats).toHaveBeenCalled();
      expect(mockUniversalTextSplitter.resetStandardizationStats).toHaveBeenCalled();
      expect(mockCacheManager.resetStats).toHaveBeenCalled();
      expect(mockPerformanceMonitor.resetMetrics).toHaveBeenCalled();
      expect(mockErrorHandlingManager.resetErrorHistory).toHaveBeenCalled();
    });
  });

  describe('circuit breaker management', () => {
    it('should reset circuit breakers when requested', () => {
      service.resetCircuitBreakers();
      expect(mockErrorHandlingManager.resetCircuitBreakers).toHaveBeenCalled();
    });
  });
});