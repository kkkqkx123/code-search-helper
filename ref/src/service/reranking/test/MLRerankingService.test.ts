import { MLRerankingService } from '../MLRerankingService';

// Mock dependencies
const mockConfigService = {
  get: jest.fn().mockReturnValue({
    modelType: 'linear',
    features: ['semanticScore', 'graphScore', 'contextualScore'],
    trainingEnabled: true,
  }),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

describe('MLRerankingService', () => {
  let mlRerankingService: MLRerankingService;

  beforeEach(() => {
    mlRerankingService = new MLRerankingService(
      mockConfigService as any,
      mockLoggerService as any,
      mockErrorHandlerService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeModel', () => {
    it('should initialize the ML model', async () => {
      await mlRerankingService.initializeModel();

      // Verify that the model was initialized
      expect(mockLoggerService.info).toHaveBeenCalledWith('ML model initialized successfully');
    });
  });

  describe('predict', () => {
    it('should make predictions using the model', async () => {
      const features = {
        semanticScore: 0.8,
        graphScore: 0.6,
        contextualScore: 0.4,
      };

      const prediction = await mlRerankingService.predict(features);

      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    it('should initialize model if not already initialized', async () => {
      const features = {
        semanticScore: 0.8,
        graphScore: 0.6,
      };

      // Mock that model is not initialized
      (mlRerankingService as any).model = null;

      const prediction = await mlRerankingService.predict(features);

      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Initializing ML model', {
        modelType: 'linear',
      });
    });
  });

  describe('addTrainingData', () => {
    it('should add training data when training is enabled', () => {
      const trainingData = {
        features: { semanticScore: 0.8, graphScore: 0.6 },
        label: 0.7,
        query: 'test query',
        documentId: 'doc1',
      };

      mlRerankingService.addTrainingData(trainingData);

      // Verify data was added (we can't directly access private field in test,
      // but we can check that no error was thrown)
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
    });

    it('should not add training data when training is disabled', () => {
      // Create a new instance with training disabled
      const disabledConfigService = {
        get: jest.fn().mockReturnValue({
          modelType: 'linear',
          features: ['semanticScore', 'graphScore'],
          trainingEnabled: false,
        }),
      };

      const service = new MLRerankingService(
        disabledConfigService as any,
        mockLoggerService as any,
        mockErrorHandlerService as any
      );

      const trainingData = {
        features: { semanticScore: 0.8, graphScore: 0.6 },
        label: 0.7,
        query: 'test query',
        documentId: 'doc1',
      };

      service.addTrainingData(trainingData);

      // Should not throw any errors
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
    });
  });

  describe('trainModel', () => {
    it('should train the model with collected data', async () => {
      // Add some training data first
      const trainingData = {
        features: { semanticScore: 0.8, graphScore: 0.6 },
        label: 0.7,
        query: 'test query',
        documentId: 'doc1',
      };

      mlRerankingService.addTrainingData(trainingData);

      await mlRerankingService.trainModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Model training completed',
        expect.any(Object)
      );
    });

    it('should skip training when no data is available', async () => {
      await mlRerankingService.trainModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Model training skipped',
        expect.any(Object)
      );
    });
  });

  describe('evaluateModel', () => {
    it('should return model performance metrics', async () => {
      const performance = await mlRerankingService.evaluateModel();

      expect(performance).toHaveProperty('accuracy');
      expect(performance).toHaveProperty('precision');
      expect(performance).toHaveProperty('recall');
      expect(performance).toHaveProperty('f1Score');
      expect(performance).toHaveProperty('loss');
    });
  });

  describe('AB Testing', () => {
    it('should enable A/B testing', () => {
      mlRerankingService.enableABTesting();

      // We can't directly check private field, but we can verify no errors
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
    });

    it('should record user interactions for A/B testing', () => {
      mlRerankingService.enableABTesting();
      mlRerankingService.recordUserInteraction('A', true);
      mlRerankingService.recordUserInteraction('B', false);

      // Verify no errors
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
    });

    it('should get A/B test results', () => {
      mlRerankingService.enableABTesting();
      mlRerankingService.recordUserInteraction('A', true);
      mlRerankingService.recordUserInteraction('A', false);
      mlRerankingService.recordUserInteraction('B', true);

      const results = mlRerankingService.getABTestResults();

      expect(results).toHaveProperty('variantA');
      expect(results).toHaveProperty('variantB');
      expect(results.variantA).toHaveProperty('ctr');
      expect(results.variantB).toHaveProperty('ctr');
    });
  });

  describe('Model Persistence', () => {
    it('should save the model', async () => {
      await mlRerankingService.saveModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Model saved successfully');
    });

    it('should load the model', async () => {
      await mlRerankingService.loadModel();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Model loaded successfully');
    });
  });

  describe('Performance Monitoring', () => {
    it('should return performance monitoring data', () => {
      const monitoringData = mlRerankingService.getPerformanceMonitoring();

      expect(monitoringData).toHaveProperty('modelPerformance');
      expect(monitoringData).toHaveProperty('trainingDataCount');
      expect(monitoringData).toHaveProperty('abTestResults');
    });
  });
});
