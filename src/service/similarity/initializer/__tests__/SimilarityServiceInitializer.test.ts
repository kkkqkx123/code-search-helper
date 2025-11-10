import { SimilarityServiceInitializer } from '../SimilarityServiceInitializer';
import { LoggerService } from '../../../../utils/LoggerService';
import { ISimilarityService, SimilarityResult, SimilarityStrategyType } from '../../types/SimilarityTypes';
import { SimilarityUtils } from '../../utils/SimilarityUtils';
import { SimilarityDetector } from '../../utils/SimilarityDetector';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock SimilarityUtils
jest.mock('../../utils/SimilarityUtils');
const MockSimilarityUtils = SimilarityUtils as jest.Mocked<typeof SimilarityUtils>;

// Mock SimilarityDetector
jest.mock('../../utils/SimilarityDetector');
const MockSimilarityDetector = SimilarityDetector as jest.Mocked<typeof SimilarityDetector>;

// Mock SimilarityService
class MockSimilarityService implements ISimilarityService {
  async calculateSimilarity(
    content1: string,
    content2: string,
    options?: any
  ): Promise<SimilarityResult> {
    return {
      similarity: 0.8,
      isSimilar: true,
      threshold: options?.threshold || 0.8,
      strategy: options?.strategy || 'levenshtein',
      details: {
        executionTime: 10,
        cacheHit: false
      }
    };
  }

  async calculateBatchSimilarity(
    contents: string[],
    options?: any
  ): Promise<any> {
    return {
      matrix: Array(contents.length).fill(0).map(() => Array(contents.length).fill(0.8)),
      pairs: [],
      executionTime: 50,
      cacheHits: 0
    };
  }

  async calculateAdvancedSimilarity(
    content1: string,
    content2: string,
    options: any
  ): Promise<SimilarityResult> {
    return this.calculateSimilarity(content1, content2, options);
  }

  async isSimilar(
    content1: string,
    content2: string,
    threshold?: number,
    options?: any
  ): Promise<boolean> {
    const result = await this.calculateSimilarity(content1, content2, { ...options, threshold });
    return result.isSimilar;
  }

  async filterSimilarItems<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: any
  ): Promise<T[]> {
    return items;
  }

  async findSimilarityGroups<T extends { content: string; id?: string }>(
    items: T[],
    threshold?: number,
    options?: any
  ): Promise<Map<string, T[]>> {
    return new Map();
  }

  // Additional methods for testing
  getAvailableStrategies(): string[] {
    return ['levenshtein', 'semantic', 'keyword', 'hybrid'];
  }

  getServiceStats(): any {
    return {
      totalCalculations: 100,
      cacheHitRate: 0.75,
      averageExecutionTime: 25
    };
  }
}

describe('SimilarityServiceInitializer', () => {
  let initializer: SimilarityServiceInitializer;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockSimilarityService: MockSimilarityService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      getLogFilePath: jest.fn().mockReturnValue('/test/log/path'),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockSimilarityService = new MockSimilarityService();
    
    initializer = new SimilarityServiceInitializer(
      mockSimilarityService,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should initialize with provided services', () => {
      expect(initializer).toBeInstanceOf(SimilarityServiceInitializer);
    });
  });

  describe('initialize', () => {
    it('should initialize similarity service successfully', async () => {
      await initializer.initialize();

      expect(MockSimilarityUtils.setService).toHaveBeenCalledWith(mockSimilarityService);
      expect(MockSimilarityDetector.setService).toHaveBeenCalledWith(mockSimilarityService);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing similarity service...');
      expect(mockLogger.info).toHaveBeenCalledWith('Similarity service initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      MockSimilarityUtils.setService.mockImplementation(() => {
        throw error;
      });

      await expect(initializer.initialize()).rejects.toThrow('Initialization failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize similarity service:', error);
    });
  });

  describe('cleanup', () => {
    it('should cleanup similarity service successfully', async () => {
      await initializer.cleanup();

      expect(MockSimilarityUtils.cleanup).toHaveBeenCalled();
      expect(MockSimilarityDetector.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up similarity service...');
      expect(mockLogger.info).toHaveBeenCalledWith('Similarity service cleaned up successfully');
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      MockSimilarityUtils.cleanup.mockImplementation(() => {
        throw error;
      });

      await expect(initializer.cleanup()).rejects.toThrow('Cleanup failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup similarity service:', error);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when service is initialized', () => {
      const status = initializer.getStatus();

      expect(status.isInitialized).toBe(true);
      expect(status.availableStrategies).toEqual(['levenshtein', 'semantic', 'keyword', 'hybrid']);
      expect(status.serviceStats).toEqual({
        totalCalculations: 100,
        cacheHitRate: 0.75,
        averageExecutionTime: 25
      });
    });

    it('should return correct status when service methods are not available', () => {
      // Create a minimal service without the extra methods
      const minimalService = {
        calculateSimilarity: jest.fn(),
        calculateBatchSimilarity: jest.fn(),
        calculateAdvancedSimilarity: jest.fn(),
        isSimilar: jest.fn(),
        filterSimilarItems: jest.fn(),
        findSimilarityGroups: jest.fn()
      } as any;

      const minimalInitializer = new SimilarityServiceInitializer(minimalService, mockLogger);
      const status = minimalInitializer.getStatus();

      expect(status.isInitialized).toBe(true);
      expect(status.availableStrategies).toEqual([]);
      expect(status.serviceStats).toBeUndefined();
    });

    it('should return false when service is not initialized', () => {
      const uninitializedInitializer = new SimilarityServiceInitializer(undefined as any, mockLogger);
      const status = uninitializedInitializer.getStatus();

      expect(status.isInitialized).toBe(false);
      expect(status.availableStrategies).toEqual([]);
      expect(status.serviceStats).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should validate service successfully', async () => {
      const result = await initializer.validate();

      expect(result.isValid).toBe(true);
      expect(result.testResult).toEqual({
        similarity: 0.8,
        strategy: 'levenshtein',
        executionTime: 10
      });
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when service is not available', async () => {
      const uninitializedInitializer = new SimilarityServiceInitializer(undefined as any, mockLogger);
      const result = await uninitializedInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('SimilarityService not available');
      expect(result.testResult).toBeUndefined();
    });

    it('should return invalid when similarity result is invalid', async () => {
      const invalidService = {
        calculateSimilarity: jest.fn().mockResolvedValue({
          similarity: 1.5, // Invalid: > 1
          isSimilar: true,
          threshold: 0.8,
          strategy: 'levenshtein'
        })
      } as any;

      const invalidInitializer = new SimilarityServiceInitializer(invalidService, mockLogger);
      const result = await invalidInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid similarity result');
      expect(result.testResult).toBeUndefined();
    });

    it('should return invalid when similarity is negative', async () => {
      const invalidService = {
        calculateSimilarity: jest.fn().mockResolvedValue({
          similarity: -0.1, // Invalid: < 0
          isSimilar: true,
          threshold: 0.8,
          strategy: 'levenshtein'
        })
      } as any;

      const invalidInitializer = new SimilarityServiceInitializer(invalidService, mockLogger);
      const result = await invalidInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid similarity result');
    });

    it('should return invalid when similarity is not a number', async () => {
      const invalidService = {
        calculateSimilarity: jest.fn().mockResolvedValue({
          similarity: 'invalid' as any, // Invalid: not a number
          isSimilar: true,
          threshold: 0.8,
          strategy: 'levenshtein'
        })
      } as any;

      const invalidInitializer = new SimilarityServiceInitializer(invalidService, mockLogger);
      const result = await invalidInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid similarity result');
    });

    it('should handle service errors during validation', async () => {
      const errorService = {
        calculateSimilarity: jest.fn().mockRejectedValue(new Error('Service error'))
      } as any;

      const errorInitializer = new SimilarityServiceInitializer(errorService, mockLogger);
      const result = await errorInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Service error');
      expect(result.testResult).toBeUndefined();
    });

    it('should handle non-Error objects during validation', async () => {
      const errorService = {
        calculateSimilarity: jest.fn().mockRejectedValue('String error')
      } as any;

      const errorInitializer = new SimilarityServiceInitializer(errorService, mockLogger);
      const result = await errorInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should include execution time in test result when available', async () => {
      const serviceWithDetails = {
        calculateSimilarity: jest.fn().mockResolvedValue({
          similarity: 0.8,
          isSimilar: true,
          threshold: 0.8,
          strategy: 'levenshtein',
          details: {
            executionTime: 25,
            cacheHit: true
          }
        })
      } as any;

      const detailsInitializer = new SimilarityServiceInitializer(serviceWithDetails, mockLogger);
      const result = await detailsInitializer.validate();

      expect(result.isValid).toBe(true);
      expect(result.testResult).toEqual({
        similarity: 0.8,
        strategy: 'levenshtein',
        executionTime: 25
      });
    });
  });

  describe('integration tests', () => {
    beforeEach(() => {
      // Reset mock implementations for integration tests
      MockSimilarityUtils.setService.mockImplementation(() => {});
      MockSimilarityUtils.cleanup.mockImplementation(() => {});
      MockSimilarityDetector.setService.mockImplementation(() => {});
      MockSimilarityDetector.cleanup.mockImplementation(() => {});
    });

    it('should handle complete lifecycle', async () => {
      // Initialize
      await initializer.initialize();
      expect(MockSimilarityUtils.setService).toHaveBeenCalled();
      expect(MockSimilarityDetector.setService).toHaveBeenCalled();

      // Check status
      const status = initializer.getStatus();
      expect(status.isInitialized).toBe(true);

      // Validate
      const validationResult = await initializer.validate();
      expect(validationResult.isValid).toBe(true);

      // Cleanup
      await initializer.cleanup();
      expect(MockSimilarityUtils.cleanup).toHaveBeenCalled();
      expect(MockSimilarityDetector.cleanup).toHaveBeenCalled();
    });

    it('should handle multiple initialization calls', async () => {
      await initializer.initialize();
      await initializer.initialize();

      expect(MockSimilarityUtils.setService).toHaveBeenCalledTimes(2);
      expect(MockSimilarityDetector.setService).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple cleanup calls', async () => {
      await initializer.cleanup();
      await initializer.cleanup();

      expect(MockSimilarityUtils.cleanup).toHaveBeenCalledTimes(2);
      expect(MockSimilarityDetector.cleanup).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      // Reset mock implementations for edge case tests
      MockSimilarityUtils.setService.mockImplementation(() => {});
      MockSimilarityUtils.cleanup.mockImplementation(() => {});
      MockSimilarityDetector.setService.mockImplementation(() => {});
      MockSimilarityDetector.cleanup.mockImplementation(() => {});
    });

    it('should handle service with minimal implementation', async () => {
      const minimalService = {
        calculateSimilarity: jest.fn().mockResolvedValue({
          similarity: 0.8,
          isSimilar: true,
          threshold: 0.8,
          strategy: 'levenshtein'
        })
      } as any;

      const minimalInitializer = new SimilarityServiceInitializer(minimalService, mockLogger);

      // Should still work for basic operations
      await minimalInitializer.initialize();
      const status = minimalInitializer.getStatus();
      const validationResult = await minimalInitializer.validate();

      expect(status.isInitialized).toBe(true);
      expect(status.availableStrategies).toEqual([]);
      expect(status.serviceStats).toBeUndefined();
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle service that throws on calculateSimilarity', async () => {
      const throwingService = {
        calculateSimilarity: jest.fn().mockRejectedValue(new Error('Calculation error'))
      } as any;

      const throwingInitializer = new SimilarityServiceInitializer(throwingService, mockLogger);
      const result = await throwingInitializer.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Calculation error');
    });
  });
});