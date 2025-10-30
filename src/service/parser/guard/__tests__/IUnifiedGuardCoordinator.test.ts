
import { IUnifiedGuardCoordinator } from '../IUnifiedGuardCoordinator';
import { UnifiedGuardCoordinator } from '../UnifiedGuardCoordinator';

describe('IUnifiedGuardCoordinator Interface', () => {
  let coordinator: IUnifiedGuardCoordinator;

  // Mock implementations for testing interface compliance
  const mockCoordinator: IUnifiedGuardCoordinator = {
    // 生命周期管理
    initialize: jest.fn(),
    destroy: jest.fn(),
    reset: jest.fn(),
    
    // 内存保护功能
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    checkMemoryUsage: jest.fn().mockReturnValue({
      isWithinLimit: true,
      usagePercent: 50,
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0
    }),
    forceCleanup: jest.fn().mockResolvedValue(undefined),
    gracefulDegradation: jest.fn(),
    getMemoryStats: jest.fn().mockReturnValue({
      current: {
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
        rss: 300 * 1024 * 1024
      },
      limit: 500 * 1024 * 1024,
      usagePercent: 20,
      isWithinLimit: true,
      trend: 'stable',
      averageUsage: 100 * 1024 * 1024
    }),
    getMemoryHistory: jest.fn().mockReturnValue([]),
    clearHistory: jest.fn(),
    setMemoryLimit: jest.fn(),
    forceGarbageCollection: jest.fn(),
    
    // 错误保护功能
    shouldUseFallback: jest.fn().mockReturnValue(false),
    recordError: jest.fn(),
    
    // 文件处理协调
    processFile: jest.fn().mockResolvedValue({
      chunks: [{ content: 'chunk1' }],
      language: 'javascript',
      processingStrategy: 'treesitter-ast',
      fallbackReason: undefined
    }),
    
    // ProcessingGuard 兼容方法
    processFileWithDetection: jest.fn().mockResolvedValue({
      chunks: [{ content: 'chunk1' }],
      language: 'javascript',
      processingStrategy: 'treesitter-ast',
      fallbackReason: undefined,
      success: true,
      duration: 100,
      metadata: {}
    }),
    getProcessingStats: jest.fn().mockReturnValue({
      totalProcessed: 0,
      successfulProcessed: 0,
      fallbackUsed: 0,
      averageProcessingTime: 0,
      errorRate: 0
    }),
    clearDetectionCache: jest.fn(),
    
    // 状态查询
    getStatus: jest.fn().mockReturnValue({
      errorThreshold: {
        errorCount: 0,
        maxErrors: 5,
        shouldUseFallback: false,
        resetInterval: 30000
      },
      memoryGuard: {
        current: {
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 200 * 1024 * 1024,
          external: 0,
          arrayBuffers: 0,
          rss: 300 * 1024 * 1024
        },
        limit: 500 * 1024 * 1024,
        usagePercent: 20,
        isWithinLimit: true,
        trend: 'stable',
        averageUsage: 100 * 1024 * 1024
      },
      isInitialized: false,
      isMonitoring: false
    })
  };

  beforeEach(() => {
    coordinator = mockCoordinator;
    jest.clearAllMocks();
  });

  describe('interface compliance', () => {
    it('should have all required lifecycle methods', () => {
      expect(typeof coordinator.initialize).toBe('function');
      expect(typeof coordinator.destroy).toBe('function');
      expect(typeof coordinator.reset).toBe('function');
    });

    it('should have all required memory protection methods', () => {
      expect(typeof coordinator.startMonitoring).toBe('function');
      expect(typeof coordinator.stopMonitoring).toBe('function');
      expect(typeof coordinator.checkMemoryUsage).toBe('function');
      expect(typeof coordinator.forceCleanup).toBe('function');
      expect(typeof coordinator.gracefulDegradation).toBe('function');
      expect(typeof coordinator.getMemoryStats).toBe('function');
      expect(typeof coordinator.getMemoryHistory).toBe('function');
      expect(typeof coordinator.clearHistory).toBe('function');
      expect(typeof coordinator.setMemoryLimit).toBe('function');
      expect(typeof coordinator.forceGarbageCollection).toBe('function');
    });

    it('should have all required error protection methods', () => {
      expect(typeof coordinator.shouldUseFallback).toBe('function');
      expect(typeof coordinator.recordError).toBe('function');
    });

    it('should have all required file processing methods', () => {
      expect(typeof coordinator.processFile).toBe('function');
      expect(typeof coordinator.processFileWithDetection).toBe('function');
      expect(typeof coordinator.getProcessingStats).toBe('function');
      expect(typeof coordinator.clearDetectionCache).toBe('function');
    });

    it('should have status query method', () => {
      expect(typeof coordinator.getStatus).toBe('function');
    });
  });

  describe('method signatures', () => {
    it('should have correct return types for lifecycle methods', () => {
      expect(coordinator.initialize()).toBeUndefined();
      expect(coordinator.destroy()).toBeUndefined();
      expect(coordinator.reset()).toBeUndefined();
    });

    it('should have correct return types for memory methods', () => {
      const memoryStatus = coordinator.checkMemoryUsage();
      expect(memoryStatus).toHaveProperty('isWithinLimit');
      expect(memoryStatus).toHaveProperty('usagePercent');
      expect(memoryStatus).toHaveProperty('heapUsed');
      expect(memoryStatus).toHaveProperty('heapTotal');

      const memoryStats = coordinator.getMemoryStats();
      expect(memoryStats).toHaveProperty('current');
      expect(memoryStats).toHaveProperty('limit');
      expect(memoryStats).toHaveProperty('usagePercent');
      expect(memoryStats).toHaveProperty('isWithinLimit');

      const memoryHistory = coordinator.getMemoryHistory();
      expect(Array.isArray(memoryHistory)).toBe(true);
    });

    it('should have correct return types for error methods', () => {
      const shouldFallback = coordinator.shouldUseFallback();
      expect(typeof shouldFallback).toBe('boolean');

      coordinator.recordError(new Error('test'), 'context');
      expect(coordinator.recordError).toHaveBeenCalled();
    });

    it('should have correct return types for file processing methods', async () => {
      const result = await coordinator.processFile('test.js', 'content');
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('processingStrategy');

      const detectionResult = await coordinator.processFileWithDetection('test.js', 'content');
      expect(detectionResult).toHaveProperty('success');
      expect(detectionResult).toHaveProperty('duration');
      expect(detectionResult).toHaveProperty('chunks');

      const stats = coordinator.getProcessingStats();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successfulProcessed');
      expect(stats).toHaveProperty('fallbackUsed');
    });

    it('should have correct return type for status method', () => {
      const status = coordinator.getStatus();
      expect(status).toHaveProperty('errorThreshold');
      expect(status).toHaveProperty('memoryGuard');
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('isMonitoring');
    });
  });

  describe('interface types', () => {
    it('should have correct MemoryStatus type', () => {
      const memoryStatus = coordinator.checkMemoryUsage();
      
      // Check required properties
      expect(memoryStatus.isWithinLimit).toBeDefined();
      expect(memoryStatus.usagePercent).toBeDefined();
      expect(memoryStatus.heapUsed).toBeDefined();
      expect(memoryStatus.heapTotal).toBeDefined();
      expect(memoryStatus.external).toBeDefined();
      expect(memoryStatus.arrayBuffers).toBeDefined();

      // Check types
      expect(typeof memoryStatus.isWithinLimit).toBe('boolean');
      expect(typeof memoryStatus.usagePercent).toBe('number');
      expect(typeof memoryStatus.heapUsed).toBe('number');
      expect(typeof memoryStatus.heapTotal).toBe('number');
      expect(typeof memoryStatus.external).toBe('number');
      expect(typeof memoryStatus.arrayBuffers).toBe('number');
    });

    it('should have correct MemoryStats type', () => {
      const memoryStats = coordinator.getMemoryStats();
      
      expect(memoryStats.current).toBeDefined();
      expect(memoryStats.limit).toBeDefined();
      expect(memoryStats.usagePercent).toBeDefined();
      expect(memoryStats.isWithinLimit).toBeDefined();
      expect(memoryStats.trend).toBeDefined();
      expect(memoryStats.averageUsage).toBeDefined();

      expect(typeof memoryStats.limit).toBe('number');
      expect(typeof memoryStats.usagePercent).toBe('number');
      expect(typeof memoryStats.isWithinLimit).toBe('boolean');
      expect(['increasing', 'decreasing', 'stable']).toContain(memoryStats.trend);
      expect(typeof memoryStats.averageUsage).toBe('number');
    });

    it('should have correct ProcessingResult type', async () => {
      const result = await coordinator.processFileWithDetection('test.js', 'content');
      
      expect(result.success).toBeDefined();
      expect(result.duration).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(result.language).toBeDefined();
      expect(result.processingStrategy).toBeDefined();

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(typeof result.language).toBe('string');
      expect(typeof result.processingStrategy).toBe('string');
    });

    it('should have correct GuardStatus type', () => {
      const status = coordinator.getStatus();
      
      expect(status.errorThreshold).toBeDefined();
      expect(status.memoryGuard).toBeDefined();
      expect(status.isInitialized).toBeDefined();
      expect(status.isMonitoring).toBeDefined();

      expect(typeof status.isInitialized).toBe('boolean');
      expect(typeof status.isMonitoring).toBe('boolean');
    });
  });

  describe('UnifiedGuardCoordinator implementation', () => {
    it('should implement IUnifiedGuardCoordinator interface', () => {
      // This is a type check - if UnifiedGuardCoordinator implements the interface,
      // TypeScript will not throw compilation errors
      const instance: IUnifiedGuardCoordinator = {} as UnifiedGuardCoordinator;
      
      // The instance should be assignable to the interface
      expect(instance).toBeDefined();
    });

    it('should have all interface methods implemented', () => {
      // Check that UnifiedGuardCoordinator has all the required methods
      const coordinatorProto = UnifiedGuardCoordinator.prototype;
      
      const requiredMethods = [
        'initialize', 'destroy', 'reset',
        'startMonitoring', 'stopMonitoring', 'checkMemoryUsage',
        'forceCleanup', 'gracefulDegradation', 'getMemoryStats',
        'getMemoryHistory', 'clearHistory', 'setMemoryLimit',
        'forceGarbageCollection', 'shouldUseFallback', 'recordError',
        'processFile', 'processFileWithDetection', 'getProcessingStats',
        'clearDetectionCache', 'getStatus'
      ];

      requiredMethods.forEach(method => {
        expect(typeof coordinatorProto[method as keyof UnifiedGuardCoordinator]).toBe('function');
      });
    });
  });
});
