import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IBatchStrategy, BatchContext } from '../types';
import { DatabaseType } from '../../../infrastructure/types';

/**
 * Qdrant向量数据库批处理策略
 * 针对向量操作的特殊优化
 */
@injectable()
export class QdrantBatchStrategy implements IBatchStrategy {
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 1000;
  private readonly MIN_BATCH_SIZE = 5;
  private readonly PERFORMANCE_THRESHOLD = 2000; // 2秒

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 计算最优批大小
   * 考虑向量维度和内存使用
   */
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number {
    let batchSize = this.DEFAULT_BATCH_SIZE;

    // 根据向量维度调整
    const dimension = context?.metadata?.dimension || 1536; // 默认维度
    if (dimension > 2048) {
      batchSize = Math.floor(batchSize * 0.5); // 高维度减少批大小
    } else if (dimension > 1024) {
      batchSize = Math.floor(batchSize * 0.75); // 中等维度适度减少
    }

    // 根据操作类型调整
    const operationType = context?.metadata?.operationType || 'insert';
    if (operationType === 'search') {
      batchSize = Math.min(batchSize, 50); // 搜索操作使用较小批次
    } else if (operationType === 'insert') {
      batchSize = Math.min(batchSize * 2, this.MAX_BATCH_SIZE); // 插入操作可以使用较大批次
    }

    // 根据项目数量调整
    if (itemsCount < this.MIN_BATCH_SIZE) {
      batchSize = Math.max(itemsCount, this.MIN_BATCH_SIZE);
    } else if (itemsCount > this.MAX_BATCH_SIZE) {
      batchSize = this.MAX_BATCH_SIZE;
    }

    return Math.max(batchSize, this.MIN_BATCH_SIZE);
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error: Error, attempt: number, context?: BatchContext): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // 对于网络错误、超时和服务器错误，应该重试
    if (errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('server error') ||
        errorMessage.includes('503') ||
        errorMessage.includes('502') ||
        errorMessage.includes('500')) {
      return attempt < 3;
    }

    // 对于客户端错误（如无效请求），不重试
    if (errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404') ||
        errorMessage.includes('invalid')) {
      return false;
    }

    // 其他错误默认重试
    return attempt < 2;
  }

  /**
   * 获取重试延迟
   */
  getRetryDelay(attempt: number, context?: BatchContext): number {
    // 指数退避，基础延迟500ms
    const baseDelay = 500;
    const maxDelay = 10000; // 最大10秒
    
    let delay = baseDelay * Math.pow(2, attempt - 1);
    
    // 添加随机抖动，避免雷群效应
    delay = delay * (0.5 + Math.random() * 0.5);
    
    return Math.min(delay, maxDelay);
  }

  /**
   * 根据性能调整批大小
   */
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    
    if (executionTime > this.PERFORMANCE_THRESHOLD) {
      // 执行时间过长，减少批大小
      const reduction = Math.floor(batchSize * 0.2);
      const newBatchSize = Math.max(batchSize - reduction, this.MIN_BATCH_SIZE);
      
      this.logger.debug('Reducing Qdrant batch size due to slow performance', {
        operationType,
        oldSize: batchSize,
        newSize: newBatchSize,
        executionTime,
        threshold: this.PERFORMANCE_THRESHOLD
      });
      
      return newBatchSize;
    } else if (executionTime < this.PERFORMANCE_THRESHOLD * 0.5 && batchSize < this.MAX_BATCH_SIZE) {
      // 执行时间较短，可以增加批大小
      const increase = Math.floor(batchSize * 0.1);
      const newBatchSize = Math.min(batchSize + increase, this.MAX_BATCH_SIZE);
      
      this.logger.debug('Increasing Qdrant batch size due to good performance', {
        operationType,
        oldSize: batchSize,
        newSize: newBatchSize,
        executionTime
      });
      
      return newBatchSize;
    }
    
    return batchSize;
  }

  /**
   * 估算内存使用
   */
  estimateMemoryUsage(batchSize: number, dimension: number): number {
    // 每个向量占用内存 = 维度 * 4字节（float32）+ 元数据开销
    const vectorSize = dimension * 4;
    const metadataOverhead = 200; // 每个向量的元数据开销
    const totalSize = batchSize * (vectorSize + metadataOverhead);
    
    // 转换为MB
    return totalSize / (1024 * 1024);
  }

  /**
   * 检查是否有足够内存处理批次
   */
  hasSufficientMemory(batchSize: number, context?: BatchContext): boolean {
    const dimension = context?.metadata?.dimension || 1536;
    const estimatedMemoryMB = this.estimateMemoryUsage(batchSize, dimension);
    const maxMemoryMB = 512; // 最大允许使用512MB
    
    if (estimatedMemoryMB > maxMemoryMB) {
      this.logger.warn('Insufficient memory for Qdrant batch operation', {
        batchSize,
        estimatedMemoryMB,
        maxMemoryMB,
        dimension
      });
      return false;
    }
    
    return true;
  }

  /**
   * 获取推荐的并发数
   */
  getRecommendedConcurrency(batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    
    // 插入操作可以使用较高并发
    if (operationType === 'insert') {
      return Math.min(5, Math.floor(1000 / batchSize)); // 最多5个并发
    }
    
    // 搜索操作使用较低并发
    if (operationType === 'search') {
      return Math.min(3, Math.floor(500 / batchSize)); // 最多3个并发
    }
    
    // 其他操作默认并发数
    return 2;
  }

  /**
   * 获取操作超时时间
   */
  getOperationTimeout(batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    const dimension = context?.metadata?.dimension || 1536;
    
    // 基础超时时间
    let baseTimeout = 30000; // 30秒
    
    // 根据操作类型调整
    if (operationType === 'search') {
      baseTimeout = 10000; // 搜索操作10秒
    } else if (operationType === 'insert') {
      baseTimeout = 60000; // 插入操作60秒
    }
    
    // 根据批大小和维度调整
    const complexityFactor = (batchSize * dimension) / (100 * 1536); // 相对于基准的复杂度
    const adjustedTimeout = baseTimeout * Math.max(1, complexityFactor);
    
    // 最大超时时间5分钟
    return Math.min(adjustedTimeout, 300000);
  }
}