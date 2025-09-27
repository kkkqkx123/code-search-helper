import { RealTimeLearningService } from '../RealTimeLearningService';

// Mock dependencies
const mockConfigService = {
  get: jest.fn().mockReturnValue({}),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

describe('RealTimeLearningService', () => {
  let realTimeLearningService: RealTimeLearningService;

  beforeEach(() => {
    realTimeLearningService = new RealTimeLearningService(
      mockConfigService as any,
      mockLoggerService as any,
      mockErrorHandlerService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectFeedback', () => {
    it('should collect user feedback', () => {
      const feedback = {
        query: 'test query',
        resultId: 'result1',
        relevanceScore: 0.8,
        timestamp: new Date(),
      };

      realTimeLearningService.collectFeedback(feedback);

      // Verify no errors
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Feedback collected',
        expect.any(Object)
      );
    });

    it('should process feedback in batches', () => {
      // Add 10 feedback items to trigger batch processing
      for (let i = 0; i < 10; i++) {
        const feedback = {
          query: `test query ${i}`,
          resultId: `result${i}`,
          relevanceScore: 0.8,
          timestamp: new Date(),
        };

        realTimeLearningService.collectFeedback(feedback);
      }

      // Verify that batch processing was triggered
      expect(mockLoggerService.info).toHaveBeenCalledWith('Processing feedback batch', {
        batchCount: 10,
      });
    });
  });

  describe('getAdaptiveWeights', () => {
    it('should return current adaptive weights', () => {
      const weights = realTimeLearningService.getAdaptiveWeights();

      expect(weights).toBeDefined();
      expect(Object.keys(weights).length).toBeGreaterThan(0);
    });
  });

  describe('getAdaptiveAlgorithms', () => {
    it('should return adaptive algorithms', () => {
      const algorithms = realTimeLearningService.getAdaptiveAlgorithms();

      expect(algorithms).toHaveProperty('exponentialMovingAverage');
      expect(algorithms).toHaveProperty('confidenceWeightedAverage');
      expect(algorithms).toHaveProperty('regretBasedAdjustment');

      // Test exponential moving average
      const ema = algorithms.exponentialMovingAverage(0.5, 0.8, 0.3);
      expect(ema).toBeCloseTo(0.59, 4);

      // Test confidence weighted average
      const cwa = algorithms.confidenceWeightedAverage([
        { value: 0.5, confidence: 0.8 },
        { value: 0.7, confidence: 0.6 },
      ]);
      expect(cwa).toBeGreaterThan(0);

      // Test regret based adjustment
      const regret = algorithms.regretBasedAdjustment(0.5, 0.8, 0.1);
      expect(regret).toBeLessThan(0.5);
    });
  });

  describe('Model Persistence', () => {
    it('should save the learning model', async () => {
      await realTimeLearningService.saveModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Learning model saved successfully',
        expect.any(Object)
      );
    });

    it('should load the learning model', async () => {
      await realTimeLearningService.loadModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Learning model loaded successfully');
    });
  });

  describe('Model Rollback', () => {
    it('should rollback to a previous model version', async () => {
      // First, save current model to history
      await realTimeLearningService.saveModel();

      // Try to rollback to a non-existent version
      const success = await realTimeLearningService.rollbackToVersion('2.0.0');

      // Should return false because version doesn't exist
      expect(success).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should return performance monitoring data', () => {
      const monitoringData = realTimeLearningService.getPerformanceMonitoring();

      expect(monitoringData).toHaveProperty('totalFeedback');
      expect(monitoringData).toHaveProperty('positiveFeedback');
      expect(monitoringData).toHaveProperty('negativeFeedback');
      expect(monitoringData).toHaveProperty('modelAccuracy');
      expect(monitoringData).toHaveProperty('performanceHistory');
    });
  });

  describe('flushFeedbackBuffer', () => {
    it('should flush remaining feedback in buffer', async () => {
      // Add some feedback
      const feedback = {
        query: 'test query',
        resultId: 'result1',
        relevanceScore: 0.8,
        timestamp: new Date(),
      };

      realTimeLearningService.collectFeedback(feedback);

      // Flush the buffer
      await realTimeLearningService.flushFeedbackBuffer();

      // Verify processing occurred
      expect(mockLoggerService.info).toHaveBeenCalledWith('Feedback batch processed successfully');
    });
  });
});
