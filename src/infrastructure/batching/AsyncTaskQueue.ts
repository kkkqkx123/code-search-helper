import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';

export interface Task<T = any> {
  id: string;
  execute: () => Promise<T>;
  priority?: number;
  retries?: number;
  maxRetries?: number;
  timeout?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
}

export interface QueueOptions {
  maxConcurrency?: number;
  defaultMaxRetries?: number;
  defaultTimeout?: number;
  autoStart?: boolean;
}

export interface TaskResult<T = any> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: Error;
  retries: number;
  executionTime: number;
}

@injectable()
export class AsyncTaskQueue {
  private logger: LoggerService;
  private tasks: Map<string, Task> = new Map();
  private pendingTasks: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private options: QueueOptions;
  private isRunning: boolean = false;
  private activeWorkers: number = 0;
  private maxConcurrency: number;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    options: QueueOptions = {}
  ) {
    this.logger = logger;
    this.options = {
      maxConcurrency: 5,
      defaultMaxRetries: 3,
      defaultTimeout: 30000,
      autoStart: true,
      ...options
    };
    this.maxConcurrency = this.options.maxConcurrency || 5;
    
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * 添加任务到队列
   */
  async addTask<T>(execute: () => Promise<T>, options?: Partial<Task>): Promise<string> {
    const taskId = this.generateTaskId();
    
    const task: Task<T> = {
      id: taskId,
      execute,
      priority: options?.priority || 0,
      retries: 0,
      maxRetries: options?.maxRetries || this.options.defaultMaxRetries,
      timeout: options?.timeout || this.options.defaultTimeout,
      createdAt: new Date(),
      ...options
    };

    this.tasks.set(taskId, task as Task);
    this.pendingTasks.push(task as Task);
    
    // 按优先级排序
    this.sortPendingTasks();
    this.logger.debug('Added task to queue', { taskId, priority: task.priority });
    
    // 如果队列未启动，启动它
    if (!this.isRunning) {
      this.start();
    }
    // 即使队列已经在运行，我们不需要做额外的事情，因为processQueue会持续处理任务
    // 任务已经被添加到pendingTasks中，会在下一次循环中被处理
    
    return taskId;
  }

  /**
   * 开始处理队列中的任务
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Task queue is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Started async task queue', { maxConcurrency: this.maxConcurrency });
    
    // 启动工作线程
    this.processQueue();
  }

  /**
   * 停止处理队列中的任务
   */
  stop(): void {
    this.isRunning = false;
    // 清理所有待处理的任务
    this.pendingTasks = [];
    // 清理所有正在进行的任务
    this.runningTasks.clear();
    this.activeWorkers = 0;
    this.logger.info('Stopped async task queue');
  }

  /**
   * 等待所有任务完成
   */
  async waitForCompletion(timeoutMs: number = 30000): Promise<Map<string, TaskResult>> {
    // 添加超时机制以避免无限等待
    const startTime = Date.now();
    
    // 确保队列正在运行
    if (!this.isRunning && (this.pendingTasks.length > 0 || this.runningTasks.size > 0)) {
      this.start();
    }
    
    while ((this.pendingTasks.length > 0 || this.runningTasks.size > 0) && (Date.now() - startTime < timeoutMs)) {
      // 如果有待处理任务但没有活跃工作线程，可能需要重新启动处理
      if (this.pendingTasks.length > 0 && this.activeWorkers === 0 && this.isRunning) {
        this.processQueue();
      }
      
      await this.delay(100); // 增加延迟时间以减少CPU使用
    }
    
    if (Date.now() - startTime >= timeoutMs) {
      this.logger.warn('Wait for completion timed out', {
        pendingTasks: this.pendingTasks.length,
        runningTasks: this.runningTasks.size,
        completedTasks: this.completedTasks.size,
        activeWorkers: this.activeWorkers,
        isRunning: this.isRunning
      });
    }
    
    return this.completedTasks;
  }

  /**
   * 获取任务结果
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.completedTasks.get(taskId);
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    pending: number;
    running: number;
    completed: number;
    total: number;
    isRunning: boolean;
  } {
    return {
      pending: this.pendingTasks.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      total: this.tasks.size,
      isRunning: this.isRunning
    };
  }

  private async processQueue(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    while (this.isRunning) {
      let hasWork = false;
      
      // 启动新的工作线程直到达到最大并发数
      while (this.isRunning && this.activeWorkers < this.maxConcurrency && this.pendingTasks.length > 0) {
        const task = this.pendingTasks.shift();
        if (task) {
          this.activeWorkers++;
          this.runningTasks.set(task.id, task);
          hasWork = true;
          
          // 执行任务
          this.executeTask(task)
            .finally(() => {
              this.activeWorkers--;
              this.runningTasks.delete(task.id);
              // 任务完成后，如果队列仍在运行且有新任务，继续处理
              if (this.isRunning && this.pendingTasks.length > 0) {
                // 使用 setImmediate 避免阻塞
                setTimeout(() => this.processQueue(), 0);
              }
            });
        }
      }

      // 如果没有待处理的任务且没有正在运行的任务，可以退出循环
      // 但如果有正在运行的任务，需要继续等待它们完成
      if (!hasWork && this.activeWorkers === 0 && this.pendingTasks.length === 0) {
        // 只有在没有任务且没有工作线程时才退出
        if (this.pendingTasks.length === 0) {
          break;
        }
      }

      // 等待一小段时间再检查
      await this.delay(50);
      
      // 检查是否应该停止
      if (!this.isRunning) {
        break;
      }
    }
  }

  private async executeTask(task: Task): Promise<void> {
    const startTime = Date.now();
    task.startedAt = new Date();
    
    let result: TaskResult;
    
    try {
      // 使用超时包装任务执行
      const taskResult = await this.executeWithTimeout(
        task.execute(),
        task.timeout || this.options.defaultTimeout || 30000
      );
      
      result = {
        taskId: task.id,
        success: true,
        result: taskResult,
        retries: task.retries || 0,
        executionTime: Date.now() - startTime
      };
      
      this.logger.debug('Task completed successfully', {
        taskId: task.id,
        executionTime: result.executionTime
      });
    } catch (error) {
      // 检查是否可以重试
      if ((task.retries || 0) < (task.maxRetries || this.options.defaultMaxRetries || 0)) {
        // 递增重试次数
        task.retries = (task.retries || 0) + 1;
        
        this.logger.warn('Task failed, scheduling retry', {
          taskId: task.id,
          retryCount: task.retries,
          error: (error as Error).message
        });
        
        // 将任务放回队列前端以供重试
        this.pendingTasks.unshift(task);
        return; // 不要将失败结果记录到completedTasks
      } else {
        result = {
          taskId: task.id,
          success: false,
          error: error as Error,
          retries: task.retries || 0,
          executionTime: Date.now() - startTime
        };
        
        this.logger.error('Task failed after all retries', {
          taskId: task.id,
          retries: result.retries,
          error: (error as Error).message
        });
      }
    }
    
    task.completedAt = new Date();
    this.completedTasks.set(task.id, result);
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout);
    });
    
    try {
      return await Promise.race([
        promise,
        timeoutPromise
      ]);
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  private sortPendingTasks(): void {
    // 按优先级排序，优先级高的在前
    this.pendingTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}