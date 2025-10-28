import { ConfigCoordinator, ConfigUpdateEvent } from '../ConfigCoordinator';
import { UnifiedConfigManager } from '../../../config/UnifiedConfigManager';
import { LoggerService } from '../../../../../utils/LoggerService';

// Mock dependencies
jest.mock('../../../../../utils/LoggerService');
jest.mock('../../../config/UnifiedConfigManager');

const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;
const MockUnifiedConfigManager = UnifiedConfigManager as jest.MockedClass<typeof UnifiedConfigManager>;

describe('ConfigCoordinator', () => {
  let configCoordinator: ConfigCoordinator;
  let mockConfigManager: jest.Mocked<UnifiedConfigManager>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockConfigManager = new MockUnifiedConfigManager() as jest.Mocked<UnifiedConfigManager>;
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;

    mockConfigManager.getGlobalConfig.mockReturnValue({
      maxChunkSize: 2000,
      overlapSize: 200,
      preserveFunctionBoundaries: true
    });

    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    configCoordinator = new ConfigCoordinator(mockConfigManager, mockLogger);
  });

  describe('Constructor', () => {
    it('should initialize with current config from config manager', () => {
      expect(mockConfigManager.getGlobalConfig).toHaveBeenCalled();
      expect(configCoordinator.getConfig()).toEqual({
        maxChunkSize: 2000,
        overlapSize: 200,
        preserveFunctionBoundaries: true
      });
    });

    it('should initialize without logger when not provided', () => {
      const coordinator = new ConfigCoordinator(mockConfigManager);
      expect(coordinator.getConfig()).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of current config', () => {
      const config1 = configCoordinator.getConfig();
      const config2 = configCoordinator.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });

    it('should return complete configuration structure', () => {
      const config = configCoordinator.getConfig();

      expect(config).toHaveProperty('memory');
      expect(config).toHaveProperty('cache');
      expect(config).toHaveProperty('performance');
    });
  });

  describe('updateConfig', () => {
    it('should update config with valid changes', async () => {
      const updates = {
        maxChunkSize: 3000,
        overlapSize: 300
      };

      await configCoordinator.updateConfig(updates);

      const updatedConfig = configCoordinator.getConfig();
      expect(updatedConfig.maxChunkSize).toBe(3000);
      expect(updatedConfig.overlapSize).toBe(300);
      expect(updatedConfig.preserveFunctionBoundaries).toBe(true); // Should remain unchanged
    });

    it('should validate config before applying updates', async () => {
      const invalidUpdates = {
        maxChunkSize: 50 // Below minimum
      };

      await expect(configCoordinator.updateConfig(invalidUpdates))
        .rejects.toThrow('Config validation failed: Max chunk size must be at least 100');
    });

    it('should detect and emit config changes', async () => {
      const mockCallback = jest.fn();
      configCoordinator.onConfigUpdate(mockCallback);

      const updates = {
        maxChunkSize: 3000,
        overlapSize: 300
      };

      await configCoordinator.updateConfig(updates);

      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'config-updated',
        changes: ['maxChunkSize', 'overlapSize'],
        timestamp: expect.any(Date)
      }));
    });

    it('should log config update', async () => {
      const updates = { maxChunkSize: 3000 };
      await configCoordinator.updateConfig(updates);

      expect(mockLogger.info).toHaveBeenCalledWith('Configuration updated', {
        changes: ['maxChunkSize']
      });
    });
  });

  describe('onConfigUpdate', () => {
    it('should register config update listeners', () => {
      const mockCallback = jest.fn();
      configCoordinator.onConfigUpdate(mockCallback);

      // Simulate config update
      configCoordinator.emit('config-updated', {
        type: 'config-updated',
        changes: ['test'],
        timestamp: new Date()
      } as ConfigUpdateEvent);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      configCoordinator.onConfigUpdate(callback1);
      configCoordinator.onConfigUpdate(callback2);

      // Simulate config update
      configCoordinator.emit('config-updated', {
        type: 'config-updated',
        changes: ['test'],
        timestamp: new Date()
      } as ConfigUpdateEvent);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Config Validation', () => {
    it('should validate memory limit', async () => {
      const invalidMemory = { maxChunkSize: 50 };
      await expect(configCoordinator.updateConfig(invalidMemory))
        .rejects.toThrow('Memory limit must be at least 100MB');

      const validMemory = { memory: { memoryLimitMB: 200 } };
      await expect(configCoordinator.updateConfig(validMemory)).resolves.not.toThrow();
    });

    it('should validate cache size', async () => {
      const invalidCache = { cache: { maxSize: -1 } };
      await expect(configCoordinator.updateConfig(invalidCache))
        .rejects.toThrow('Cache size must be non-negative');

      const validCache = { cache: { maxSize: 0 } };
      await expect(configCoordinator.updateConfig(validCache)).resolves.not.toThrow();
    });

    it('should handle complex validation scenarios', async () => {
      const complexUpdates = {
        memory: { memoryLimitMB: 200 },
        cache: { maxSize: 500 },
        performance: { thresholds: { processFile: 3000 } }
      };

      await expect(configCoordinator.updateConfig(complexUpdates)).resolves.not.toThrow();
    });
  });

  describe('Config Change Detection', () => {
    it('should detect memory limit changes', () => {
      const oldConfig = { memory: { memoryLimitMB: 512 } };
      const newConfig = { memory: { memoryLimitMB: 1024 } };

      const changes = (configCoordinator as any).detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContain('memoryLimitMB');
    });

    it('should detect cache size changes', () => {
      const oldConfig = { cache: { maxSize: 1000 } };
      const newConfig = { overlapSize: 300 };

      const changes = (configCoordinator as any).detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContain('cacheMaxSize');
    });

    it('should detect performance threshold changes', () => {
      const oldConfig = { preserveFunctionBoundaries: true };
      const newConfig = { performance: { thresholds: { processFile: 3000 } } };

      const changes = (configCoordinator as any).detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContain('performanceThresholds');
    });

    it('should return empty array for no changes', () => {
      const config = { memory: { memoryLimitMB: 512 } };
      const changes = (configCoordinator as any).detectConfigChanges(config, config);
      expect(changes).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidUpdates = { memory: { memoryLimitMB: 50 } };

      await expect(configCoordinator.updateConfig(invalidUpdates))
        .rejects.toThrow('Config validation failed');

      // Original config should remain unchanged
      const currentConfig = configCoordinator.getConfig();
      expect(currentConfig.memory.memoryLimitMB).toBe(512);
    });

    it('should handle event emission errors', async () => {
      // Mock event emission to throw error
      const originalEmit = configCoordinator.emit;
      configCoordinator.emit = jest.fn().mockImplementation(() => {
        throw new Error('Event emission failed');
      });

      const updates = { maxChunkSize: 3000 };
      await expect(configCoordinator.updateConfig(updates)).rejects.toThrow('Event emission failed');

      // Restore original method
      configCoordinator.emit = originalEmit;
    });
  });

  describe('Integration Tests', () => {
    it('should maintain config consistency across multiple updates', async () => {
      // First update
      await configCoordinator.updateConfig({ memory: { memoryLimitMB: 1024 } });
      expect(configCoordinator.getConfig().memory.memoryLimitMB).toBe(1024);

      // Second update
      await configCoordinator.updateConfig({ overlapSize: 300 });
      expect(configCoordinator.getConfig().cache.maxSize).toBe(2000);
      expect(configCoordinator.getConfig().memory.memoryLimitMB).toBe(1024); // Should remain

      // Third update
      await configCoordinator.updateConfig({ performance: { thresholds: { processFile: 3000 } } });
      expect(configCoordinator.getConfig().performance.thresholds.processFile).toBe(3000);
      expect(configCoordinator.getConfig().memory.memoryLimitMB).toBe(1024); // Should remain
      expect(configCoordinator.getConfig().cache.maxSize).toBe(2000); // Should remain
    });

    it('should handle concurrent config updates', async () => {
      const updatePromises = [
        configCoordinator.updateConfig({ memory: { memoryLimitMB: 1024 } }),
        configCoordinator.updateConfig({ overlapSize: 300 }),
        configCoordinator.updateConfig({ performance: { thresholds: { processFile: 3000 } } })
      ];

      await Promise.all(updatePromises);

      const finalConfig = configCoordinator.getConfig();
      expect(finalConfig.memory.memoryLimitMB).toBe(1024);
      expect(finalConfig.cache.maxSize).toBe(2000);
      expect(finalConfig.performance.thresholds.processFile).toBe(3000);
    });
  });
});