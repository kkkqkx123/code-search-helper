import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

export interface UserFeedback {
  query: string;
  resultId: string;
  relevanceScore: number; // 0-1 scale, 1 being highly relevant
  timestamp: Date;
  userId?: string;
}

export interface AdaptiveWeight {
  name: string;
  value: number;
  lastUpdated: Date;
  confidence: number;
}

export interface LearningModel {
  weights: Record<string, AdaptiveWeight>;
  performanceHistory: Array<{
    timestamp: Date;
    accuracy: number;
    feedbackCount: number;
  }>;
  version: string;
}

@injectable()
export class RealTimeLearningService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  private feedbackBuffer: UserFeedback[] = [];
  private adaptiveWeights: Record<string, AdaptiveWeight> = {};
  private learningModel: LearningModel;
  private modelHistory: LearningModel[] = [];

  // Performance monitoring
  private performanceMetrics: {
    totalFeedback: number;
    positiveFeedback: number;
    negativeFeedback: number;
    modelAccuracy: number;
  } = {
    totalFeedback: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    modelAccuracy: 0.85,
  };

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;

    // Initialize learning model
    this.learningModel = {
      weights: {},
      performanceHistory: [],
      version: '1.0.0',
    };

    // Initialize default adaptive weights
    this.initializeAdaptiveWeights();

    this.logger.info('Real-time Learning Service initialized');
  }

  /**
   * Initialize default adaptive weights
   */
  private initializeAdaptiveWeights(): void {
    const defaultWeights = [
      { name: 'semantic', value: 0.3, confidence: 0.8 },
      { name: 'graph', value: 0.2, confidence: 0.7 },
      { name: 'contextual', value: 0.15, confidence: 0.6 },
      { name: 'recency', value: 0.1, confidence: 0.5 },
      { name: 'popularity', value: 0.1, confidence: 0.5 },
      { name: 'original', value: 0.15, confidence: 0.9 },
    ];

    const now = new Date();
    for (const weight of defaultWeights) {
      this.adaptiveWeights[weight.name] = {
        name: weight.name,
        value: weight.value,
        lastUpdated: now,
        confidence: weight.confidence,
      };
    }

    this.logger.info('Adaptive weights initialized', { weightCount: defaultWeights.length });
  }

  /**
   * Collect user feedback for learning
   * @param feedback User feedback data
   */
  collectFeedback(feedback: UserFeedback): void {
    this.feedbackBuffer.push(feedback);
    this.performanceMetrics.totalFeedback++;

    if (feedback.relevanceScore >= 0.5) {
      this.performanceMetrics.positiveFeedback++;
    } else {
      this.performanceMetrics.negativeFeedback++;
    }

    this.logger.debug('Feedback collected', {
      query: feedback.query,
      resultId: feedback.resultId,
      relevanceScore: feedback.relevanceScore,
    });

    // Process feedback in batches
    if (this.feedbackBuffer.length >= 10) {
      this.processFeedbackBatch();
    }
  }

  /**
   * Process a batch of feedback to update adaptive weights
   */
  private processFeedbackBatch(): void {
    if (this.feedbackBuffer.length === 0) {
      return;
    }

    try {
      this.logger.info('Processing feedback batch', { batchCount: this.feedbackBuffer.length });

      // Group feedback by query
      const feedbackByQuery: Record<string, UserFeedback[]> = {};
      for (const feedback of this.feedbackBuffer) {
        if (!feedbackByQuery[feedback.query]) {
          feedbackByQuery[feedback.query] = [];
        }
        feedbackByQuery[feedback.query].push(feedback);
      }

      // Update weights based on feedback patterns
      for (const [query, feedbacks] of Object.entries(feedbackByQuery)) {
        this.updateWeightsBasedOnFeedback(query, feedbacks);
      }

      // Clear processed feedback
      this.feedbackBuffer = [];

      // Update model accuracy
      this.updateModelAccuracy();

      // Record performance history
      this.recordPerformanceHistory();

      this.logger.info('Feedback batch processed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to process feedback batch: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'RealTimeLearningService', operation: 'processFeedbackBatch' }
      );
    }
  }

  /**
   * Update adaptive weights based on user feedback
   * @param query Search query
   * @param feedbacks Feedback for this query
   */
  private updateWeightsBasedOnFeedback(query: string, feedbacks: UserFeedback[]): void {
    // Calculate average relevance score for this query
    const avgRelevance =
      feedbacks.reduce((sum, fb) => sum + fb.relevanceScore, 0) / feedbacks.length;

    // Determine which weights to adjust based on feedback
    // This is a simplified approach - in a real implementation, this would be more sophisticated
    const weightAdjustments: Record<string, number> = {};

    // If relevance is high, reinforce current weights
    // If relevance is low, adjust weights to improve
    if (avgRelevance >= 0.7) {
      // Reinforce weights that contributed to good results
      for (const [name, weight] of Object.entries(this.adaptiveWeights)) {
        weightAdjustments[name] = weight.value * 0.05; // Small positive reinforcement
      }
    } else if (avgRelevance <= 0.3) {
      // Adjust weights to improve poor results
      for (const [name, weight] of Object.entries(this.adaptiveWeights)) {
        weightAdjustments[name] = -weight.value * 0.1; // Small negative adjustment
      }
    }

    // Apply weight adjustments
    for (const [name, adjustment] of Object.entries(weightAdjustments)) {
      if (this.adaptiveWeights[name]) {
        const currentValue = this.adaptiveWeights[name].value;
        const newValue = Math.max(0, Math.min(1, currentValue + adjustment));

        // Update weight with confidence adjustment
        const confidenceAdjustment = Math.abs(adjustment) * 0.1;
        const newConfidence = Math.min(
          1,
          this.adaptiveWeights[name].confidence + confidenceAdjustment
        );

        this.adaptiveWeights[name] = {
          name,
          value: newValue,
          lastUpdated: new Date(),
          confidence: newConfidence,
        };
      }
    }

    this.logger.debug('Weights updated based on feedback', {
      query,
      avgRelevance,
      adjustments: Object.keys(weightAdjustments).length,
    });
  }

  /**
   * Update model accuracy based on feedback
   */
  private updateModelAccuracy(): void {
    if (this.performanceMetrics.totalFeedback > 0) {
      const positiveRate =
        this.performanceMetrics.positiveFeedback / this.performanceMetrics.totalFeedback;
      // Adjust model accuracy based on positive feedback rate
      this.performanceMetrics.modelAccuracy =
        0.7 * this.performanceMetrics.modelAccuracy + 0.3 * positiveRate;
    }
  }

  /**
   * Record performance history for model tracking
   */
  private recordPerformanceHistory(): void {
    const now = new Date();
    this.learningModel.performanceHistory.push({
      timestamp: now,
      accuracy: this.performanceMetrics.modelAccuracy,
      feedbackCount: this.performanceMetrics.totalFeedback,
    });

    // Keep only recent history (last 100 entries)
    if (this.learningModel.performanceHistory.length > 100) {
      this.learningModel.performanceHistory = this.learningModel.performanceHistory.slice(-100);
    }
  }

  /**
   * Get current adaptive weights
   * @returns Current adaptive weights
   */
  getAdaptiveWeights(): Record<string, AdaptiveWeight> {
    return { ...this.adaptiveWeights };
  }

  /**
   * Get adaptive weight adjustment algorithms
   * @returns Weight adjustment functions
   */
  getAdaptiveAlgorithms(): {
    exponentialMovingAverage: (current: number, newValue: number, alpha: number) => number;
    confidenceWeightedAverage: (values: Array<{ value: number; confidence: number }>) => number;
    regretBasedAdjustment: (current: number, reward: number, learningRate: number) => number;
  } {
    return {
      exponentialMovingAverage: (current: number, newValue: number, alpha: number) => {
        return alpha * newValue + (1 - alpha) * current;
      },

      confidenceWeightedAverage: (values: Array<{ value: number; confidence: number }>) => {
        if (values.length === 0) return 0;

        let weightedSum = 0;
        let confidenceSum = 0;

        for (const { value, confidence } of values) {
          weightedSum += value * confidence;
          confidenceSum += confidence;
        }

        return confidenceSum > 0 ? weightedSum / confidenceSum : 0;
      },

      regretBasedAdjustment: (current: number, reward: number, learningRate: number) => {
        // Simple regret-based adjustment
        const regret = 1 - reward; // Assuming reward is between 0 and 1
        return current - learningRate * regret;
      },
    };
  }

  /**
   * Save learning model to persistent storage
   */
  async saveModel(): Promise<void> {
    try {
      this.logger.info('Saving learning model');

      // Save current model to history before updating
      this.modelHistory.push(JSON.parse(JSON.stringify(this.learningModel)));

      // Keep only recent model versions (last 10)
      if (this.modelHistory.length > 10) {
        this.modelHistory = this.modelHistory.slice(-10);
      }

      // In a real implementation, this would save to a database or file system
      this.logger.info('Learning model saved successfully', {
        version: this.learningModel.version,
        historyCount: this.modelHistory.length,
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to save learning model: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'RealTimeLearningService', operation: 'saveModel' }
      );
      throw error;
    }
  }

  /**
   * Load learning model from persistent storage
   */
  async loadModel(): Promise<void> {
    try {
      this.logger.info('Loading learning model');

      // In a real implementation, this would load from a database or file system
      // For now, we'll just ensure the current model is initialized
      if (!this.learningModel.weights || Object.keys(this.learningModel.weights).length === 0) {
        this.initializeAdaptiveWeights();
      }

      this.logger.info('Learning model loaded successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to load learning model: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'RealTimeLearningService', operation: 'loadModel' }
      );
      throw error;
    }
  }

  /**
   * Rollback to a previous model version
   * @param version Version to rollback to
   */
  async rollbackToVersion(version: string): Promise<boolean> {
    try {
      this.logger.info('Rolling back model version', { version });

      const modelToRestore = this.modelHistory.find(model => model.version === version);
      if (!modelToRestore) {
        this.logger.warn('Model version not found for rollback', { version });
        return false;
      }

      // Save current model before rollback
      this.modelHistory.push(JSON.parse(JSON.stringify(this.learningModel)));

      // Restore the selected model
      this.learningModel = JSON.parse(JSON.stringify(modelToRestore));

      // Restore adaptive weights
      this.adaptiveWeights = { ...this.learningModel.weights };

      this.logger.info('Model rollback completed successfully', { version });
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to rollback model: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'RealTimeLearningService', operation: 'rollbackToVersion' }
      );
      return false;
    }
  }

  /**
   * Get performance monitoring data
   * @returns Performance monitoring metrics
   */
  getPerformanceMonitoring(): {
    totalFeedback: number;
    positiveFeedback: number;
    negativeFeedback: number;
    modelAccuracy: number;
    performanceHistory: any[];
  } {
    return {
      ...this.performanceMetrics,
      performanceHistory: [...this.learningModel.performanceHistory],
    };
  }

  /**
   * Force process any remaining feedback in the buffer
   */
  async flushFeedbackBuffer(): Promise<void> {
    if (this.feedbackBuffer.length > 0) {
      this.processFeedbackBatch();
    }
  }
}
