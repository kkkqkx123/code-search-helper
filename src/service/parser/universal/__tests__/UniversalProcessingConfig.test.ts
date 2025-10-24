import { UniversalProcessingConfig } from '../UniversalProcessingConfig';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock process.env
const originalEnv = process.env;

describe('UniversalProcessingConfig', () => {
  let config: UniversalProcessingConfig;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // Reset process.env
    process.env = { ...originalEnv };
    
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    
    config = new UniversalProcessingConfig(mockLogger);
  });

  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  describe('Constructor and Default Values', () => {
    it('should initialize with default values', () => {
      const errorConfig = config.getErrorConfig();
      const memoryConfig = config.getMemoryConfig();
      const chunkingConfig = config.getChunkingConfig();
      const backupConfig = config.getBackupFileConfig();

      expect(errorConfig.maxErrors).toBe(5);
      expect(errorConfig.errorResetInterval).toBe(60000);
      
      expect(memoryConfig.memoryLimitMB).toBe(500);
      expect(memoryConfig.memoryCheckInterval).toBe(5000);
      
      expect(chunkingConfig.maxChunkSize).toBe(2000);
      expect(chunkingConfig.chunkOverlap).toBe(200);
      expect(chunkingConfig.maxLinesPerChunk).toBe(50);
      
      expect(backupConfig.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save']);
      expect(backupConfig.backupFileConfidenceThreshold).toBe(0.7);
    });

    it('should load configuration from environment variables', () => {
      // Set environment variables
      process.env.UNIVERSAL_MAX_ERRORS = '10';
      process.env.UNIVERSAL_ERROR_RESET_INTERVAL = '120000';
      process.env.UNIVERSAL_MEMORY_LIMIT_MB = '1000';
      process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL = '10000';
      process.env.UNIVERSAL_MAX_CHUNK_SIZE = '3000';
      process.env.UNIVERSAL_CHUNK_OVERLAP = '300';
      process.env.UNIVERSAL_MAX_LINES_PER_CHUNK = '100';
      process.env.UNIVERSAL_BACKUP_PATTERNS = '.bak,.backup,.old';
      process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD = '0.8';

      const newConfig = new UniversalProcessingConfig(mockLogger);

      const errorConfig = newConfig.getErrorConfig();
      const memoryConfig = newConfig.getMemoryConfig();
      const chunkingConfig = newConfig.getChunkingConfig();
      const backupConfig = newConfig.getBackupFileConfig();

      expect(errorConfig.maxErrors).toBe(10);
      expect(errorConfig.errorResetInterval).toBe(120000);
      
      expect(memoryConfig.memoryLimitMB).toBe(1000);
      expect(memoryConfig.memoryCheckInterval).toBe(10000);
      
      expect(chunkingConfig.maxChunkSize).toBe(3000);
      expect(chunkingConfig.chunkOverlap).toBe(300);
      expect(chunkingConfig.maxLinesPerChunk).toBe(100);
      
      expect(backupConfig.backupFilePatterns).toEqual(['.bak', '.backup', '.old']);
      expect(backupConfig.backupFileConfidenceThreshold).toBe(0.8);

      expect(mockLogger.info).toHaveBeenCalledWith('Universal processing configuration loaded from environment variables');
    });

    it('should handle invalid environment variables gracefully', () => {
      // Set invalid environment variables
      process.env.UNIVERSAL_MAX_ERRORS = 'invalid';
      process.env.UNIVERSAL_MEMORY_LIMIT_MB = 'not-a-number';
      process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD = 'not-a-float';

      const newConfig = new UniversalProcessingConfig(mockLogger);

      // Should fall back to defaults
      const errorConfig = newConfig.getErrorConfig();
      const memoryConfig = newConfig.getMemoryConfig();
      const backupConfig = newConfig.getBackupFileConfig();

      expect(errorConfig.maxErrors).toBe(5); // Default value
      expect(memoryConfig.memoryLimitMB).toBe(500); // Default value
      expect(backupConfig.backupFileConfidenceThreshold).toBe(0.7); // Default value

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load configuration from environment: Error: Invalid environment variable value');
    });
  });

  describe('Error Configuration', () => {
    it('should get error configuration', () => {
      const errorConfig = config.getErrorConfig();
      
      expect(errorConfig).toEqual({
        maxErrors: 5,
        errorResetInterval: 60000
      });
    });

    it('should set error configuration', () => {
      config.setErrorConfig(10, 120000);
      
      const errorConfig = config.getErrorConfig();
      expect(errorConfig.maxErrors).toBe(10);
      expect(errorConfig.errorResetInterval).toBe(120000);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Error config updated: maxErrors=10, errorResetInterval=120000');
    });
  });

  describe('Memory Configuration', () => {
    it('should get memory configuration', () => {
      const memoryConfig = config.getMemoryConfig();
      
      expect(memoryConfig).toEqual({
        memoryLimitMB: 500,
        memoryCheckInterval: 5000
      });
    });

    it('should set memory configuration', () => {
      config.setMemoryConfig(1000, 10000);
      
      const memoryConfig = config.getMemoryConfig();
      expect(memoryConfig.memoryLimitMB).toBe(1000);
      expect(memoryConfig.memoryCheckInterval).toBe(10000);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Memory config updated: memoryLimitMB=1000, memoryCheckInterval=10000');
    });
  });

  describe('Chunking Configuration', () => {
    it('should get chunking configuration', () => {
      const chunkingConfig = config.getChunkingConfig();
      
      expect(chunkingConfig).toEqual({
        maxChunkSize: 2000,
        chunkOverlap: 200,
        maxLinesPerChunk: 50
      });
    });

    it('should set chunking configuration', () => {
      config.setChunkingConfig(3000, 300, 100);
      
      const chunkingConfig = config.getChunkingConfig();
      expect(chunkingConfig.maxChunkSize).toBe(3000);
      expect(chunkingConfig.chunkOverlap).toBe(300);
      expect(chunkingConfig.maxLinesPerChunk).toBe(100);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Chunking config updated: maxChunkSize=3000, chunkOverlap=300, maxLinesPerChunk=100');
    });
  });

  describe('Backup File Configuration', () => {
    it('should get backup file configuration', () => {
      const backupConfig = config.getBackupFileConfig();
      
      expect(backupConfig.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save']);
      expect(backupConfig.backupFileConfidenceThreshold).toBe(0.7);
    });

    it('should set backup file configuration', () => {
      const newPatterns = ['.bak', '.backup', '.old', '.custom'];
      config.setBackupFileConfig(newPatterns);
      
      const backupConfig = config.getBackupFileConfig();
      expect(backupConfig.backupFilePatterns).toEqual(newPatterns);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Backup file config updated: patterns=.bak, .backup, .old, .custom');
    });

    it('should get and set backup file confidence threshold', () => {
      expect(config.getBackupFileConfidenceThreshold()).toBe(0.7);
      
      config.setBackupFileConfidenceThreshold(0.8);
      expect(config.getBackupFileConfidenceThreshold()).toBe(0.8);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Backup file confidence threshold set to 0.8');
    });

    it('should not set invalid backup file confidence threshold', () => {
      config.setBackupFileConfidenceThreshold(-0.1);
      expect(config.getBackupFileConfidenceThreshold()).toBe(0.7); // Should remain unchanged
      
      config.setBackupFileConfidenceThreshold(1.1);
      expect(config.getBackupFileConfidenceThreshold()).toBe(0.7); // Should remain unchanged
      
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('All Configuration', () => {
    it('should get all configuration', () => {
      const allConfig = config.getAllConfig();
      
      expect(allConfig).toEqual({
        error: {
          maxErrors: 5,
          errorResetInterval: 60000
        },
        memory: {
          memoryLimitMB: 500,
          memoryCheckInterval: 5000
        },
        chunking: {
          maxChunkSize: 2000,
          chunkOverlap: 200,
          maxLinesPerChunk: 50
        },
        backup: {
          backupFilePatterns: ['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save'],
          backupFileConfidenceThreshold: 0.7
        }
      });
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset all configuration to defaults', () => {
      // Change some values
      config.setErrorConfig(10, 120000);
      config.setMemoryConfig(1000, 10000);
      config.setChunkingConfig(3000, 300, 100);
      config.setBackupFileConfig(['.custom']);
      config.setBackupFileConfidenceThreshold(0.9);

      // Reset to defaults
      config.resetToDefaults();

      // Check all values are reset
      const allConfig = config.getAllConfig();
      
      expect(allConfig.error.maxErrors).toBe(5);
      expect(allConfig.error.errorResetInterval).toBe(60000);
      expect(allConfig.memory.memoryLimitMB).toBe(500);
      expect(allConfig.memory.memoryCheckInterval).toBe(5000);
      expect(allConfig.chunking.maxChunkSize).toBe(2000);
      expect(allConfig.chunking.chunkOverlap).toBe(200);
      expect(allConfig.chunking.maxLinesPerChunk).toBe(50);
      expect(allConfig.backup.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp']);
      expect(allConfig.backup.backupFileConfidenceThreshold).toBe(0.7);

      expect(mockLogger.info).toHaveBeenCalledWith('Universal processing configuration reset to defaults');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validation = config.validateConfig();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect invalid error configuration', () => {
      config.setErrorConfig(0, 60000); // Invalid maxErrors
      
      const validation = config.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('maxErrors must be greater than 0');
    });

    it('should detect invalid memory configuration', () => {
      config.setMemoryConfig(0, 5000); // Invalid memoryLimitMB
      
      const validation = config.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('memoryLimitMB must be greater than 0');
    });

    it('should detect invalid chunking configuration', () => {
      config.setChunkingConfig(0, 200, 50); // Invalid maxChunkSize
      
      let validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('maxChunkSize must be greater than 0');
      
      config.setChunkingConfig(2000, -1, 50); // Invalid chunkOverlap
      validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('chunkOverlap must be non-negative');
      
      config.setChunkingConfig(2000, 200, 0); // Invalid maxLinesPerChunk
      validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('maxLinesPerChunk must be greater than 0');
      
      config.setChunkingConfig(2000, 2500, 50); // chunkOverlap >= maxChunkSize
      validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('chunkOverlap must be less than maxChunkSize');
    });

    it('should detect invalid backup configuration', () => {
      config.setBackupFileConfig([]); // Empty patterns
      
      let validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('backupFilePatterns cannot be empty');
      
      // 直接设置内部值以测试验证逻辑，而不是通过保护性的setter
      (config as any).backupFileConfidenceThreshold = -0.1; // Invalid threshold
      validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('backupFileConfidenceThreshold must be between 0 and 1');
      
      (config as any).backupFileConfidenceThreshold = 1.1; // Invalid threshold
      validation = config.validateConfig();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('backupFileConfidenceThreshold must be between 0 and 1');
    });

    it('should detect multiple validation errors', () => {
      config.setErrorConfig(0, 60000); // Invalid maxErrors
      config.setMemoryConfig(0, 5000); // Invalid memoryLimitMB
      config.setChunkingConfig(0, 200, 50); // Invalid maxChunkSize
      config.setBackupFileConfig([]); // Empty patterns
      
      const validation = config.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(1);
      expect(validation.errors).toContain('maxErrors must be greater than 0');
      expect(validation.errors).toContain('memoryLimitMB must be greater than 0');
      expect(validation.errors).toContain('maxChunkSize must be greater than 0');
      expect(validation.errors).toContain('backupFilePatterns cannot be empty');
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse comma-separated backup patterns', () => {
      process.env.UNIVERSAL_BACKUP_PATTERNS = '.bak,.backup,.old,.tmp,.custom';
      
      const newConfig = new UniversalProcessingConfig(mockLogger);
      const backupConfig = newConfig.getBackupFileConfig();
      
      expect(backupConfig.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp', '.custom']);
    });

    it('should handle whitespace in backup patterns', () => {
      process.env.UNIVERSAL_BACKUP_PATTERNS = ' .bak , .backup , .old , .tmp ';
      
      const newConfig = new UniversalProcessingConfig(mockLogger);
      const backupConfig = newConfig.getBackupFileConfig();
      
      expect(backupConfig.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp']);
    });

    it('should handle empty backup patterns environment variable', () => {
      process.env.UNIVERSAL_BACKUP_PATTERNS = '';
      
      const newConfig = new UniversalProcessingConfig(mockLogger);
      const backupConfig = newConfig.getBackupFileConfig();
      
      expect(backupConfig.backupFilePatterns).toEqual(['']); // Empty string in array
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex configuration scenarios', () => {
      // Set environment variables
      process.env.UNIVERSAL_MAX_ERRORS = '8';
      process.env.UNIVERSAL_MEMORY_LIMIT_MB = '750';
      process.env.UNIVERSAL_MAX_CHUNK_SIZE = '2500';
      process.env.UNIVERSAL_BACKUP_PATTERNS = '.bak,.backup,.old,.tmp,.custom';
      process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD = '0.85';

      const newConfig = new UniversalProcessingConfig(mockLogger);

      // Modify some values programmatically
      newConfig.setErrorConfig(12, 90000);
      newConfig.setChunkingConfig(2800, 280, 80);

      // Verify final configuration
      const allConfig = newConfig.getAllConfig();
      
      expect(allConfig.error.maxErrors).toBe(12); // Programmatic change
      expect(allConfig.error.errorResetInterval).toBe(90000); // Programmatic change
      expect(allConfig.memory.memoryLimitMB).toBe(750); // From environment
      expect(allConfig.memory.memoryCheckInterval).toBe(5000); // Default
      expect(allConfig.chunking.maxChunkSize).toBe(2800); // Programmatic change
      expect(allConfig.chunking.chunkOverlap).toBe(280); // Programmatic change
      expect(allConfig.chunking.maxLinesPerChunk).toBe(80); // Programmatic change
      expect(allConfig.backup.backupFilePatterns).toEqual(['.bak', '.backup', '.old', '.tmp', '.custom']); // From environment
      expect(allConfig.backup.backupFileConfidenceThreshold).toBe(0.85); // From environment

      // Validate configuration
      const validation = newConfig.validateConfig();
      expect(validation.isValid).toBe(true);
    });

    it('should handle configuration reset after environment loading', () => {
      // Set environment variables
      process.env.UNIVERSAL_MAX_ERRORS = '15';
      process.env.UNIVERSAL_MEMORY_LIMIT_MB = '1200';

      const newConfig = new UniversalProcessingConfig(mockLogger);

      // Verify environment values are loaded
      expect(newConfig.getErrorConfig().maxErrors).toBe(15);
      expect(newConfig.getMemoryConfig().memoryLimitMB).toBe(1200);

      // Reset to defaults
      newConfig.resetToDefaults();

      // Verify defaults are restored
      expect(newConfig.getErrorConfig().maxErrors).toBe(5);
      expect(newConfig.getMemoryConfig().memoryLimitMB).toBe(500);
    });
  });
});