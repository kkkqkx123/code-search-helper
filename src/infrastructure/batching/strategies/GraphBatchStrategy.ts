import { injectable } from 'inversify';
import { IBatchStrategy, BatchContext, BatchProcessingOptions } from '../types';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 图数据库批处理策略
 * 针对Nebula Graph数据库的特性和限制进行优化
 */
@injectable()
export class GraphBatchStrategy implements IBatchStrategy {
  constructor(
    private logger: LoggerService
  ) {}

  /**
   * 计算最优批处理大小
   * 图数据库的批处理大小通常较小，因为需要处理复杂的图结构
   */
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number {
    // 图索引的批处理大小通常较小
    const baseSize = 5;
    
    // 根据项目规模调整
    if (itemsCount < 50) {
      return Math.min(3, itemsCount);
    } else if (itemsCount < 200) {
      return 5;
    } else if (itemsCount < 1000) {
      return 8;
    } else {
      return 10;
    }
  }

  /**
   * 判断是否应该重试
   * 图数据库的错误通常需要重试，特别是连接相关的错误
   */
  shouldRetry(error: Error, attempt: number, context?: BatchContext): boolean {
    // 最多重试3次
    if (attempt >= 3) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    
    // 连接错误应该重试
    if (errorMessage.includes('connection') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('network')) {
      return true;
    }

    // 服务器繁忙错误应该重试
    if (errorMessage.includes('server') && 
        (errorMessage.includes('busy') || errorMessage.includes('overloaded'))) {
      return true;
    }

    // 临时性错误应该重试
    if (errorMessage.includes('temporary') || 
        errorMessage.includes('retry') ||
        errorMessage.includes('try again')) {
      return true;
    }

    // 数据冲突错误可以重试
    if (errorMessage.includes('conflict') || 
        errorMessage.includes('duplicate') ||
        errorMessage.includes('concurrent')) {
      return true;
    }

    return false;
  }

  /**
   * 获取重试延迟
   * 图数据库的重试延迟应该较长，给数据库更多恢复时间
   */
  getRetryDelay(attempt: number, context?: BatchContext): number {
    // 指数退避，基础延迟为2秒
    const baseDelay = 2000;
    const maxDelay = 30000; // 最大30秒
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // 添加随机抖动，避免雷群效应
    const jitter = Math.random() * 1000;
    
    return delay + jitter;
  }

  /**
   * 根据性能调整批处理大小
   * 图数据库的性能调整较为保守
   */
  adjustBatchSizeBasedOnPerformance(
    executionTime: number, 
    batchSize: number, 
    context?: BatchContext
  ): number {
    // 性能阈值（毫秒）
    const fastThreshold = 5000;   // 5秒以下认为很快
    const slowThreshold = 30000;  // 30秒以上认为很慢
    
    let newSize = batchSize;
    
    if (executionTime < fastThreshold) {
      // 执行很快，可以适当增加批处理大小
      newSize = Math.min(batchSize + 1, 15);
      this.logger.debug('Increasing batch size due to fast execution', {
        oldSize: batchSize,
        newSize,
        executionTime
      });
    } else if (executionTime > slowThreshold) {
      // 执行很慢，减少批处理大小
      newSize = Math.max(batchSize - 1, 2);
      this.logger.debug('Decreasing batch size due to slow execution', {
        oldSize: batchSize,
        newSize,
        executionTime
      });
    }
    
    return newSize;
  }
}