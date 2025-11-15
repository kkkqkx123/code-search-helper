/**
 * 简化的并行处理工具
 * 为ASTCodeSplitter提供基本的并行处理功能
 */

import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 简化的并行处理配置
 */
export interface ParallelProcessorConfig {
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 任务超时时间（毫秒） */
  taskTimeout?: number;
}

/**
 * 简化的并行任务
 */
export interface SimpleTask<T> {
  /** 任务函数 */
  task: () => Promise<T>;
  /** 任务描述（用于日志） */
  description?: string;
}

/**
 * 简化的并行处理器
 */
export class ParallelProcessor {
  private config: Required<ParallelProcessorConfig>;
  private logger: LoggerService;

  constructor(logger: LoggerService, config: ParallelProcessorConfig = {}) {
    this.logger = logger;
    this.config = {
      maxConcurrency: config.maxConcurrency || Math.max(1, require('os').cpus().length - 1),
      taskTimeout: config.taskTimeout || 30000 // 30秒
    };
  }

  /**
   * 并行执行多个任务
   */
  async executeAll<T>(tasks: SimpleTask<T>[]): Promise<T[]> {
    if (tasks.length === 0) {
      return [];
    }

    // 分批处理以控制并发
    const results: T[] = [];
    const batches = this.createBatches(tasks, this.config.maxConcurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(item => this.executeTask(item));
      const batchResults = await Promise.allSettled(batchPromises);

      // 收集成功的结果
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.warn(`Task failed:`, result.reason);
        }
      }
    }

    return results;
  }

  /**
   * 执行单个任务（带超时）
   */
  private async executeTask<T>(taskItem: SimpleTask<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${this.config.taskTimeout}ms`)), this.config.taskTimeout);
    });

    try {
      return await Promise.race([taskItem.task(), timeoutPromise]);
    } catch (error) {
      if (taskItem.description) {
        this.logger.error(`Task "${taskItem.description}" failed:`, error);
      }
      throw error;
    }
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}