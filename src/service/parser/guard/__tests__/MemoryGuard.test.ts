import { MemoryGuard } from '../MemoryGuard';
import { LoggerService } from '../../../../utils/LoggerService';
import { IMemoryMonitorService } from '../../../memory/interfaces/IMemoryMonitorService';
import { CleanupManager } from '../../../../infrastructure/cleanup/CleanupManager';

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
} as unknown as LoggerService;

// Mock MemoryMonitorService
const mockMemoryMonitor: IMemoryMonitorService = {
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  getMemoryStatus: jest.fn().mockReturnValue({
    heapUsed: 100 * 1024 * 1024, // 100MB
    heapTotal: 200 * 1024 * 1024, // 200MB
    heapUsedPercent: 0.5,
    rss: 300 * 1024 * 1024,
    external: 0,
    isWarning: false,
    isCritical: false,
    isEmergency: false,
    trend: 'stable',
    averageUsage: 100 * 1024 * 1024,
    timestamp: new Date()
  }),
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
  triggerCleanup: jest.fn(),
  checkMemoryUsage: jest.fn().mockReturnValue({
    isWithinLimit: true,
    usagePercent: 20,
    heapUsed: 100 * 1024 * 1024,
    heapTotal: 200 * 1024 * 1024,
    external: 0,
    arrayBuffers: 0
  }),
  updateConfig: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    memoryLimitMB: 500,
    checkIntervalMs: 5000,
    cleanupThreshold: 0.8,
    emergencyThreshold: 0.95
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  forceGarbageCollection: jest.fn(),
  optimizeMemory: jest.fn(),
  setMemoryLimit: jest.fn(),
  getMemoryLimit: jest.fn().mockReturnValue(500),
  isWithinLimit: jest.fn().mockReturnValue(true),
  destroy: jest.fn()
};

// Mock CleanupManager
const mockCleanupManager: CleanupManager = {
  performCleanup: jest.fn().mockResolvedValue({
    success: true,
    memoryFreed: 50 * 1024 * 1024,
    cleanedCaches: ['cache1', 'cache2']
  })
} as unknown as CleanupManager;

describe('MemoryGuard', () => {
  let memoryGuard: MemoryGuard;
  let mockProcessMemoryUsage: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock process.memoryUsage
    mockProcessMemoryUsage = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 300 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      heapUsed: 100 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0
    });

    memoryGuard = new MemoryGuard(
      mockMemoryMonitor,
      500, // 500MB limit
      mockLogger,
      mockCleanupManager
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    memoryGuard.stopMonitoring();
    mockProcessMemoryUsage.mockRestore();
  });

  describe('monitoring', () => {
    it('should start monitoring', () => {
      memoryGuard.startMonitoring();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Memory monitoring started (limit: 500MB, interval: 5000ms)'
      );
      expect(memoryGuard['isMonitoring']).toBe(true);
    });

    it('should stop monitoring', () => {
      memoryGuard.startMonitoring();
      memoryGuard.stopMonitoring();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Memory monitoring stopped');
      expect(memoryGuard['isMonitoring']).toBe(false);
    });

    it('should not start monitoring if already active', () => {
      memoryGuard.startMonitoring();
      memoryGuard.startMonitoring(); // Second call
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Memory monitoring is already active');
    });
  });

  describe('memory usage checking', () => {
    it('should check memory usage within limit', () => {
      const status = memoryGuard.checkMemoryUsage();
      
      expect(status.isWithinLimit).toBe(true);
      expect(status.usagePercent).toBeLessThan(100);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should trigger cleanup when memory exceeds limit', () => {
      // Mock memory usage exceeding limit
      mockProcessMemoryUsage.mockReturnValue({
        rss: 600 * 1024 * 1024,
        heapTotal: 600 * 1024 * 1024,
        heapUsed: 600 * 1024 * 1024, // 600MB > 500MB limit
        external: 0,
        arrayBuffers: 0
      });

      (mockMemoryMonitor.getMemoryStatus as jest.Mock).mockReturnValue({
        heapUsed: 600 * 1024 * 1024,
        heapTotal: 600 * 1024 * 1024,
        heapUsedPercent: 1.0,
        rss: 600 * 1024 * 1024,
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'increasing',
        averageUsage: 600 * 1024 * 1024,
        timestamp: new Date()
      });

      const status = memoryGuard.checkMemoryUsage();
      
      expect(status.isWithinLimit).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Memory usage exceeds limit')
      );
    });

    it('should handle errors during memory check', () => {
      (mockMemoryMonitor.getMemoryStatus as jest.Mock).mockImplementation(() => {
        throw new Error('Memory check failed');
      });

      const status = memoryGuard.checkMemoryUsage();
      
      expect(status.isWithinLimit).toBe(true); // Default safe status
      expect(mockLogger.error).toHaveBeenCalledWith('Error checking memory usage: Error: Memory check failed');
    });
  });

  describe('force cleanup', () => {
    it('should perform forced cleanup', () => {
      memoryGuard['forceCleanup']();
      
      // 不等待异步操作完成，只检查方法是否被调用
      expect(mockCleanupManager.performCleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Performing forced memory cleanup...');
    });

    it('should handle cleanup without cleanup manager', () => {
      const guardWithoutCleanup = new MemoryGuard(
        mockMemoryMonitor,
        500,
        mockLogger
        // No cleanup manager
      );

      guardWithoutCleanup['forceCleanup']();

      expect(mockLogger.warn).toHaveBeenCalledWith('CleanupManager not available, cleanup skipped');
    });
  });

  describe('graceful degradation', () => {
    it('should trigger graceful degradation', () => {
      const emitSpy = jest.spyOn(process, 'emit').mockImplementation(jest.fn());

      memoryGuard['gracefulDegradation']();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Initiating graceful degradation due to memory pressure...'
      );
      expect(emitSpy).toHaveBeenCalledWith('memoryPressure', expect.any(Object));
      expect(mockMemoryMonitor.forceGarbageCollection).toHaveBeenCalled();

      emitSpy.mockRestore();
    });
  });

  describe('memory stats and history', () => {
    it('should get memory stats', () => {
      // 确保在测试内存统计之前重置 mock
      (mockMemoryMonitor.getMemoryStatus as jest.Mock).mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        heapUsedPercent: 0.5,
        rss: 300 * 1024 * 1024,
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'stable',
        averageUsage: 100 * 1024 * 1024,
        timestamp: new Date()
      });

      const stats = memoryGuard.getMemoryStats();
      
      expect(stats.current).toBeDefined();
      expect(stats.limit).toBe(500 * 1024 * 1024);
      expect(stats.usagePercent).toBeDefined();
      expect(stats.isWithinLimit).toBe(true);
    });

    it('should get memory history', () => {
      const history = memoryGuard.getMemoryHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(mockMemoryMonitor.getMemoryHistory).toHaveBeenCalled();
    });

    it('should clear history', () => {
      memoryGuard.clearHistory();
      
      expect(mockMemoryMonitor.clearHistory).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Memory usage history cleared');
    });
  });

  describe('memory limit management', () => {
    it('should set memory limit', () => {
      memoryGuard.setMemoryLimit(1000); // 1GB
      
      expect(memoryGuard['memoryLimit']).toBe(1000 * 1024 * 1024);
      expect(mockMemoryMonitor.setMemoryLimit).toHaveBeenCalledWith(1000);
      expect(mockLogger.info).toHaveBeenCalledWith('Memory limit updated to 1000MB');
    });

    it('should not set invalid memory limit', () => {
      const originalLimit = memoryGuard['memoryLimit'];
      memoryGuard.setMemoryLimit(-100);
      
      expect(memoryGuard['memoryLimit']).toBe(originalLimit); // 应该保持原有限制
      // 注意：setMemoryLimit 方法在构造函数中会被调用一次，所以这里可能已经被调用过
      // 我们只检查是否没有被再次调用
      expect(mockMemoryMonitor.setMemoryLimit).toHaveBeenCalledTimes(1); // 只在构造函数中调用一次
    });
  });

  describe('garbage collection', () => {
    it('should force garbage collection', () => {
      memoryGuard.forceGarbageCollection();
      
      expect(mockMemoryMonitor.forceGarbageCollection).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Forced garbage collection');
    });

    it('should handle garbage collection errors', () => {
      (mockMemoryMonitor.forceGarbageCollection as jest.Mock).mockImplementation(() => {
        throw new Error('GC failed');
      });

      memoryGuard.forceGarbageCollection();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Could not force garbage collection: GC failed');
    });
  });

  describe('destruction', () => {
    it('should destroy memory guard', () => {
      memoryGuard.startMonitoring();
      memoryGuard.destroy();
      
      expect(mockLogger.info).toHaveBeenCalledWith('MemoryGuard destroyed');
      expect(memoryGuard['isMonitoring']).toBe(false);
    });
  });

  describe('cleanup manager injection', () => {
    it('should set cleanup manager', () => {
      const newCleanupManager = {} as CleanupManager;
      memoryGuard.setCleanupManager(newCleanupManager);
      
      expect(memoryGuard['cleanupManager']).toBe(newCleanupManager);
      expect(mockLogger.info).toHaveBeenCalledWith('CleanupManager injected into MemoryGuard');
    });
  });
});