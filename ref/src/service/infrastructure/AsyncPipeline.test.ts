import { AsyncPipeline, PipelineStep } from './AsyncPipeline';
import { LoggerService } from '../../core/LoggerService';
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

// Mock logger for testing
const createMockLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AsyncPipeline Integration Tests', () => {
  let pipeline: AsyncPipeline;
  let logger: LoggerService;

  // Note: We don't use fake timers here because the delay method uses
  // setTimeout which doesn't work well with jest's fake timers in async tests

  beforeEach(() => {
    // Create fresh pipeline and logger for each test
    logger = createMockLogger() as any;
    pipeline = new AsyncPipeline({}, logger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    pipeline.clearSteps();
  });

  describe('Basic Pipeline Execution', () => {
    it('should execute a simple pipeline successfully', async () => {
      // Arrange
      const step1: PipelineStep<number, number> = {
        name: 'step1',
        execute: async data => data + 1,
      };

      const step2: PipelineStep<number, number> = {
        name: 'step2',
        execute: async data => data * 2,
      };

      pipeline.addStep(step1).addStep(step2);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(12); // (5 + 1) * 2 = 12
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(true);
    });

    it('should handle empty pipeline', async () => {
      // Act
      const result = await pipeline.execute('test');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe('test');
      expect(result.steps).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle step failures with continueOnError=false', async () => {
      // Arrange
      const step1: PipelineStep<number, number> = {
        name: 'step1',
        execute: async data => {
          throw new Error('Step failed');
        },
      };

      const step2: PipelineStep<number, number> = {
        name: 'step2',
        execute: async data => data * 2,
      };

      pipeline.addStep(step1).addStep(step2);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step failed');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].success).toBe(false);
    });

    it('should continue execution with continueOnError=true', async () => {
      // Arrange
      const step1: PipelineStep<number, number> = {
        name: 'step1',
        execute: async data => {
          throw new Error('Step failed');
        },
        continueOnError: true,
      };

      const step2: PipelineStep<number, number> = {
        name: 'step2',
        execute: async data => data * 2,
      };

      pipeline = new AsyncPipeline({ continueOnError: true }, logger);
      pipeline.addStep(step1).addStep(step2);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(true); // Pipeline succeeds because we continue on error
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[1].success).toBe(true);
      expect(result.data).toBe(10); // 5 * 2 = 10
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed steps', async () => {
      // Arrange
      let attemptCount = 0;
      const step: PipelineStep<number, number> = {
        name: 'retryStep',
        execute: async data => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary failure');
          }
          return data + 1;
        },
        retryAttempts: 3,
        retryDelay: 10,
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(6);
      expect(attemptCount).toBe(2); // 1 failure + 1 success
    });

    it('should fail after max retry attempts', async () => {
      // Arrange
      let attemptCount = 0;
      const step: PipelineStep<number, number> = {
        name: 'failingStep',
        execute: async data => {
          attemptCount++;
          throw new Error(`Permanent failure ${attemptCount}`);
        },
        retryAttempts: 2,
        retryDelay: 100,
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(false);
      expect(attemptCount).toBe(3); // 1 initial + 2 retries
      expect(result.error).toContain('Permanent failure 3');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow operations', async () => {
      // Arrange
      const step: PipelineStep<number, number> = {
        name: 'slowStep',
        execute: async data => {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          return data + 1;
        },
        timeout: 100, // 100ms timeout
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should complete operations within timeout', async () => {
      // Arrange
      const step: PipelineStep<number, number> = {
        name: 'fastStep',
        execute: async data => {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          return data + 1;
        },
        timeout: 100, // 100ms timeout
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute(5);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(6);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics when enabled', async () => {
      // Arrange
      pipeline = new AsyncPipeline({ enableMetrics: true }, logger);

      const step1: PipelineStep<number, number> = {
        name: 'step1',
        execute: async data => data + 1,
      };

      const step2: PipelineStep<number, number> = {
        name: 'step2',
        execute: async data => data * 2,
      };

      pipeline.addStep(step1).addStep(step2);

      // Act
      const result1 = await pipeline.execute(5);
      const result2 = await pipeline.execute(10);
      const metrics = pipeline.getMetrics();

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.successfulExecutions).toBe(2);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.stepMetrics.size).toBe(2);
      expect(metrics.stepMetrics.get('step1')?.executions).toBe(2);
      expect(metrics.stepMetrics.get('step2')?.executions).toBe(2);
    });

    it('should track failed executions in metrics', async () => {
      // Arrange
      pipeline = new AsyncPipeline({ enableMetrics: true }, logger);

      const step: PipelineStep<number, number> = {
        name: 'failingStep',
        execute: async data => {
          throw new Error('Failed');
        },
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute(5);
      const metrics = pipeline.getMetrics();

      // Assert
      expect(result.success).toBe(false);
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.stepMetrics.get('failingStep')?.failureRate).toBe(1);
    });

    it('should reset metrics', async () => {
      // Arrange
      pipeline = new AsyncPipeline({ enableMetrics: true }, logger);

      const step: PipelineStep<number, number> = {
        name: 'step',
        execute: async data => data + 1,
      };

      pipeline.addStep(step);

      // Act
      await pipeline.execute(5);
      pipeline.resetMetrics();
      const metrics = pipeline.getMetrics();

      // Assert
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.stepMetrics.size).toBe(0);
    });
  });

  describe('Logging', () => {
    it('should log pipeline execution events', async () => {
      // Arrange
      const step: PipelineStep<number, number> = {
        name: 'testStep',
        execute: async data => data + 1,
      };

      pipeline.addStep(step);

      // Act
      await pipeline.execute(5);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting pipeline execution', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('Pipeline execution completed', expect.any(Object));
      expect(logger.debug).toHaveBeenCalledWith('Pipeline step completed', expect.any(Object));
    });

    it('should log retry attempts', async () => {
      // Arrange
      let attemptCount = 0;
      const step: PipelineStep<number, number> = {
        name: 'retryStep',
        execute: async data => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary failure');
          }
          return data + 1;
        },
        retryAttempts: 3,
        retryDelay: 10,
      };

      pipeline.addStep(step);

      // Act
      await pipeline.execute(5);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'Pipeline step failed, retrying',
        expect.any(Object)
      );
    });

    it('should log final failures', async () => {
      // Arrange
      const step: PipelineStep<number, number> = {
        name: 'failingStep',
        execute: async data => {
          throw new Error('Permanent failure');
        },
        retryAttempts: 1,
        retryDelay: 10, // Add small retry delay to prevent timeout
      };

      pipeline.addStep(step);

      // Act
      await pipeline.execute(5);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Pipeline step failed after all retries',
        expect.any(Object)
      );
      // Pipeline execution doesn't fail because we continue on individual step errors
    });
  });

  describe('Pipeline Cloning', () => {
    it('should clone pipeline with steps and options', async () => {
      // Arrange
      const step: PipelineStep<number, number> = {
        name: 'step',
        execute: async data => data + 1,
      };

      pipeline.addStep(step);

      // Act
      const clonedPipeline = pipeline.clone();
      const result = await clonedPipeline.execute(5);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(6);
      expect(clonedPipeline).toBeInstanceOf(AsyncPipeline);
      expect(clonedPipeline).not.toBe(pipeline);
    });

    it('should maintain independent state after cloning', async () => {
      // Arrange
      pipeline = new AsyncPipeline({ enableMetrics: true }, logger);
      const step: PipelineStep<number, number> = {
        name: 'step',
        execute: async data => data + 1,
      };

      pipeline.addStep(step);

      // Act
      const clonedPipeline = pipeline.clone();
      await pipeline.execute(5);
      await clonedPipeline.execute(10);

      const originalMetrics = pipeline.getMetrics();
      const clonedMetrics = clonedPipeline.getMetrics();

      // Assert
      expect(originalMetrics.totalExecutions).toBe(1);
      expect(clonedMetrics.totalExecutions).toBe(1);
    });
  });

  describe('Complex Data Types', () => {
    it('should handle object data types', async () => {
      // Arrange
      const step1: PipelineStep<{ value: number }, { value: number }> = {
        name: 'step1',
        execute: async data => ({ value: data.value + 1 }),
      };

      const step2: PipelineStep<{ value: number }, { value: number }> = {
        name: 'step2',
        execute: async data => ({ value: data.value * 2 }),
      };

      pipeline.addStep(step1).addStep(step2);

      // Act
      const result = await pipeline.execute({ value: 5 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 12 }); // (5 + 1) * 2 = 12
    });

    it('should handle array data types', async () => {
      // Arrange
      const step: PipelineStep<number[], number[]> = {
        name: 'step',
        execute: async data => data.map(x => x * 2),
      };

      pipeline.addStep(step);

      // Act
      const result = await pipeline.execute([1, 2, 3]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual([2, 4, 6]);
    });
  });
});
