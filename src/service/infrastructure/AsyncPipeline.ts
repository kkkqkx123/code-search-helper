import { injectable } from 'inversify';

export interface PipelineStep<T = any, R = any> {
  name: string;
  execute: (data: T) => Promise<R>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  continueOnError?: boolean;
}

export interface PipelineOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  continueOnError?: boolean;
  enableMetrics?: boolean;
}

export interface PipelineResult<T = any> {
  success: boolean;
  data: T;
  steps: PipelineStepResult[];
  totalTime: number;
  error?: string;
}

export interface PipelineStepResult {
  name: string;
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  retryCount: number;
}

export interface PipelineMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  stepMetrics: Map<
    string,
    {
      executions: number;
      averageTime: number;
      failureRate: number;
    }
  >;
}

@injectable()
export class AsyncPipeline {
  private steps: PipelineStep[] = [];
  private options: PipelineOptions;
  private metrics: PipelineMetrics;
  private logger?: any;

  constructor(options: PipelineOptions = {}, logger?: any) {
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: false,
      enableMetrics: false,
      ...options,
    };

    this.logger = logger;
    this.metrics = this.initializeMetrics();
  }

  addStep<T, R>(step: PipelineStep<T, R>): this {
    this.steps.push({
      timeout: this.options.timeout,
      retryAttempts: this.options.retryAttempts,
      retryDelay: this.options.retryDelay,
      continueOnError: this.options.continueOnError,
      ...step,
    });

    return this;
  }

  async execute<T = any, R = any>(initialData: T): Promise<PipelineResult<R>> {
    const startTime = Date.now();
    let currentData: any = initialData;
    const stepResults: PipelineStepResult[] = [];
    let pipelineSuccess = true;
    let pipelineError: string | undefined;

    if (this.options.enableMetrics) {
      this.metrics.totalExecutions++;
    }

    this.logger?.info('Starting pipeline execution', {
      stepsCount: this.steps.length,
      startTime,
    });

    try {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        const stepStartTime = Date.now();
        let stepSuccess = true;
        let stepError: string | undefined;
        let retryCount = 0;

        if (this.options.enableMetrics) {
          const stepMetrics = this.metrics.stepMetrics.get(step.name) || {
            executions: 0,
            averageTime: 0,
            failureRate: 0,
          };
          stepMetrics.executions++;
          this.metrics.stepMetrics.set(step.name, stepMetrics);
        }

        const stepEndTime = Date.now();

        try {
          // Execute step with retry logic
          const retryResult = await this.executeStepWithRetry(step, currentData);
          currentData = retryResult.result;
          retryCount = retryResult.retryCount;
          stepSuccess = true;
          stepError = undefined;
        } catch (error) {
          stepSuccess = false;
          stepError = error instanceof Error ? error.message : String(error);
          retryCount = 0; // Reset on failure

          if (this.options.enableMetrics) {
            const stepMetrics = this.metrics.stepMetrics.get(step.name)!;
            stepMetrics.failureRate =
              (stepMetrics.failureRate * (stepMetrics.executions - 1) + 1) / stepMetrics.executions;
          }

          if (!this.options.continueOnError || step.continueOnError === false) {
            pipelineSuccess = false;
            pipelineError = stepError;
          }
        }

        const stepResult: PipelineStepResult = {
          name: step.name,
          success: stepSuccess,
          startTime: stepStartTime,
          endTime: stepEndTime,
          duration: stepEndTime - stepStartTime,
          error: stepError,
          retryCount,
        };

        stepResults.push(stepResult);

        // Break after adding the step result if the pipeline should stop
        if (!stepSuccess && (!this.options.continueOnError || step.continueOnError === false)) {
          break;
        }

        if (this.options.enableMetrics) {
          const stepMetrics = this.metrics.stepMetrics.get(step.name)!;
          stepMetrics.averageTime =
            (stepMetrics.averageTime * (stepMetrics.executions - 1) + stepResult.duration) /
            stepMetrics.executions;
        }

        this.logger?.debug('Pipeline step completed', {
          step: step.name,
          success: stepSuccess,
          duration: stepResult.duration,
          retryCount,
        });
      }

      const totalTime = Date.now() - startTime;

      if (this.options.enableMetrics && pipelineSuccess) {
        this.metrics.successfulExecutions++;
        this.metrics.averageExecutionTime =
          (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + totalTime) /
          this.metrics.totalExecutions;
      } else if (this.options.enableMetrics) {
        this.metrics.failedExecutions++;
      }

      this.logger?.info('Pipeline execution completed', {
        success: pipelineSuccess,
        totalTime,
        stepsCompleted: stepResults.filter(r => r.success).length,
        stepsFailed: stepResults.filter(r => !r.success).length,
      });

      return {
        success: pipelineSuccess,
        data: currentData as R,
        steps: stepResults,
        totalTime,
        error: pipelineError,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.options.enableMetrics) {
        this.metrics.failedExecutions++;
      }

      this.logger?.error('Pipeline execution failed', {
        error: errorMessage,
        totalTime,
      });

      return {
        success: false,
        data: currentData as R,
        steps: stepResults,
        totalTime,
        error: errorMessage,
      };
    }
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  clearSteps(): void {
    this.steps = [];
  }

  clone(): AsyncPipeline {
    const pipeline = new AsyncPipeline(this.options, this.logger);
    pipeline.steps = [...this.steps];
    // Don't copy metrics to maintain independent state
    return pipeline;
  }

  private async executeStepWithRetry(
    step: PipelineStep,
    data: any
  ): Promise<{ result: any; retryCount: number }> {
    let attempts = 0;
    let lastError: string = '';

    while (attempts <= (step.retryAttempts || this.options.retryAttempts!)) {
      try {
        // Execute step with timeout
        const result = await this.executeWithTimeout(
          () => step.execute(data),
          step.timeout || this.options.timeout!
        );

        return { result, retryCount: attempts };
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : String(error);

        if (attempts <= (step.retryAttempts || this.options.retryAttempts!)) {
          this.logger?.warn('Pipeline step failed, retrying', {
            step: step.name,
            attempt: attempts,
            maxAttempts: step.retryAttempts || this.options.retryAttempts,
            error: lastError,
          });

          // Wait before retry
          await this.delay(step.retryDelay || this.options.retryDelay! * attempts);
        } else {
          this.logger?.error('Pipeline step failed after all retries', {
            step: step.name,
            attempts,
            error: lastError,
          });
          throw new Error(`Step '${step.name}' failed after ${attempts} attempts: ${lastError}`);
        }
      }
    }

    throw new Error(`Step '${step.name}' failed: ${lastError}`);
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeMetrics(): PipelineMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      stepMetrics: new Map(),
    };
  }
}
