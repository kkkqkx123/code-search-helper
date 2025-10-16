import { CleanupManager } from '../CleanupManager';
import { ICleanupStrategy, ICleanupContext, ICleanupResult } from '../interfaces/ICleanupStrategy';
import { LoggerService } from '../../../../../utils/LoggerService';

// 模拟清理策略
class MockCleanupStrategy implements ICleanupStrategy {
  readonly name: string;
  readonly priority: number;
  readonly description = 'Mock cleanup strategy for testing';

  constructor(
    private shouldSucceed: boolean = true, 
    private memoryToFree: number = 1024,
    name: string = 'mock-strategy',
    priority: number = 1
  ) {
    this.name = name;
    this.priority = priority;
  }

  isApplicable(context: ICleanupContext): boolean {
    return true;
  }

  async cleanup(context: ICleanupContext): Promise<ICleanupResult> {
    if (!this.shouldSucceed) {
      throw new Error('Mock cleanup failed');
    }

    return {
      success: true,
      cleanedCaches: ['mock-cache'],
      memoryFreed: this.memoryToFree,
      duration: 100
    };
  }

  estimateCleanupImpact(context: ICleanupContext): number {
    return this.memoryToFree;
  }

  isAvailable(): boolean {
    return true;
  }
}

describe('CleanupManager', () => {
  let cleanupManager: CleanupManager;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService();
    cleanupManager = new CleanupManager(logger);
    cleanupManager.initialize();
  });

  afterEach(() => {
    cleanupManager.destroy();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(cleanupManager.getStatus().isInitialized).toBe(true);
    });

    it('should not initialize twice', () => {
      const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation();
      cleanupManager.initialize();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
      loggerSpy.mockRestore();
    });
  });

  describe('strategy registration', () => {
    it('should register a strategy successfully', () => {
      const strategy = new MockCleanupStrategy();
      cleanupManager.registerStrategy(strategy);

      const status = cleanupManager.getStatus();
      expect(status.registeredStrategies).toContain('mock-strategy');
      expect(status.totalStrategies).toBe(1);
    });

    it('should not register an unavailable strategy', () => {
      const strategy = new MockCleanupStrategy();
      jest.spyOn(strategy, 'isAvailable').mockReturnValue(false);
      
      cleanupManager.registerStrategy(strategy);

      const status = cleanupManager.getStatus();
      expect(status.registeredStrategies).not.toContain('mock-strategy');
      expect(status.totalStrategies).toBe(0);
    });

    it('should unregister a strategy successfully', () => {
      const strategy = new MockCleanupStrategy();
      cleanupManager.registerStrategy(strategy);
      
      cleanupManager.unregisterStrategy('mock-strategy');

      const status = cleanupManager.getStatus();
      expect(status.registeredStrategies).not.toContain('mock-strategy');
      expect(status.totalStrategies).toBe(0);
    });

    it('should handle unregistering non-existent strategy', () => {
      const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation();
      cleanupManager.unregisterStrategy('non-existent');
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Strategy not found'));
      loggerSpy.mockRestore();
    });
  });

  describe('cleanup execution', () => {
    it('should perform cleanup successfully', async () => {
      const strategy = new MockCleanupStrategy(true, 2048);
      cleanupManager.registerStrategy(strategy);

      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const result = await cleanupManager.performCleanup(context);

      expect(result.success).toBe(true);
      expect(result.cleanedCaches).toContain('mock-cache');
      expect(result.memoryFreed).toBe(2048);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle cleanup with multiple strategies', async () => {
      const strategy1 = new MockCleanupStrategy(true, 1024, 'mock-strategy-1', 1);
      const strategy2 = new MockCleanupStrategy(true, 2048, 'mock-strategy-2', 2);
      
      cleanupManager.registerStrategy(strategy1);
      cleanupManager.registerStrategy(strategy2);

      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const result = await cleanupManager.performCleanup(context);

      expect(result.success).toBe(true);
      expect(result.memoryFreed).toBe(3072); // 1024 + 2048
      expect(result.cleanedCaches).toContain('mock-cache');
    });

    it('should handle cleanup failure gracefully', async () => {
      const strategy = new MockCleanupStrategy(false);
      cleanupManager.registerStrategy(strategy);

      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const result = await cleanupManager.performCleanup(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.memoryFreed).toBe(0);
    });

    it('should handle no applicable strategies', async () => {
      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const result = await cleanupManager.performCleanup(context);

      expect(result.success).toBe(true);
      expect(result.memoryFreed).toBe(0);
      expect(result.cleanedCaches).toEqual([]);
    });
  });

  describe('cleanup impact estimation', () => {
    it('should estimate cleanup impact correctly', () => {
      const strategy1 = new MockCleanupStrategy(true, 1024, 'mock-strategy-1', 1);
      const strategy2 = new MockCleanupStrategy(true, 2048, 'mock-strategy-2', 2);
      
      cleanupManager.registerStrategy(strategy1);
      cleanupManager.registerStrategy(strategy2);

      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const impact = cleanupManager.estimateCleanupImpact(context);

      expect(impact).toBe(3072); // 1024 + 2048
    });

    it('should return 0 when not initialized', () => {
      cleanupManager.destroy();
      
      const context: ICleanupContext = {
        triggerReason: 'test-cleanup',
        timestamp: new Date()
      };

      const impact = cleanupManager.estimateCleanupImpact(context);
      expect(impact).toBe(0);
    });
  });

  describe('status and reset', () => {
    it('should provide correct status', () => {
      const strategy = new MockCleanupStrategy();
      cleanupManager.registerStrategy(strategy);

      const status = cleanupManager.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.registeredStrategies).toContain('mock-strategy');
      expect(status.totalStrategies).toBe(1);
    });

    it('should reset successfully', () => {
      const strategy = new MockCleanupStrategy();
      cleanupManager.registerStrategy(strategy);

      cleanupManager.reset();

      const status = cleanupManager.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.totalStrategies).toBe(1); // 策略注册不会被清除
    });
  });

  describe('error handling', () => {
    it('should handle uninitialized manager', () => {
      cleanupManager.destroy();
      
      const strategy = new MockCleanupStrategy();
      
      expect(() => {
        cleanupManager.registerStrategy(strategy);
      }).toThrow('CleanupManager is not initialized');
    });

    it('should handle null strategy registration', () => {
      expect(() => {
        cleanupManager.registerStrategy(null as any);
      }).toThrow('Strategy cannot be null or undefined');
    });
  });
});