import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IBatchStrategy, BatchContext } from '../types';
import { DatabaseType } from '../../../infrastructure/types';

/**
 * Nebula图数据库批处理策略
 * 针对图操作的特殊优化
 */
@injectable()
export class NebulaBatchStrategy implements IBatchStrategy {
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly MAX_BATCH_SIZE = 500;
  private readonly MIN_BATCH_SIZE = 10;
  private readonly PERFORMANCE_THRESHOLD = 3000; // 3秒

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 计算最优批大小
   * 考虑图操作的复杂度和内存使用
   */
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number {
    let batchSize = this.DEFAULT_BATCH_SIZE;

    // 根据操作类型调整
    const operationType = context?.metadata?.operationType || 'insert';
    if (operationType === 'query') {
      batchSize = Math.min(batchSize, 20); // 查询操作使用较小批次
    } else if (operationType === 'insert') {
      batchSize = Math.min(batchSize * 1.5, this.MAX_BATCH_SIZE); // 插入操作可以使用较大批次
    } else if (operationType === 'update') {
      batchSize = Math.min(batchSize, 100); // 更新操作使用中等批次
    }

    // 根据图复杂度调整
    const graphComplexity = context?.metadata?.graphComplexity || 'medium';
    if (graphComplexity === 'high') {
      batchSize = Math.floor(batchSize * 0.6); // 高复杂度图减少批大小
    } else if (graphComplexity === 'low') {
      batchSize = Math.min(batchSize * 1.2, this.MAX_BATCH_SIZE); // 低复杂度图可以增加批大小
    }

    // 根据节点/关系数量调整
    const nodeCount = context?.metadata?.nodeCount || 0;
    const edgeCount = context?.metadata?.edgeCount || 0;
    const totalElements = nodeCount + edgeCount;
    
    if (totalElements > 10000) {
      batchSize = Math.min(batchSize, 200); // 大图使用较小批次
    } else if (totalElements < 100) {
      batchSize = Math.min(batchSize, totalElements); // 小图使用实际数量
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

    // 对于图特定的错误
    if (errorMessage.includes('storage') ||
        errorMessage.includes('meta') ||
        errorMessage.includes('graph')) {
      return attempt < 2; // 图相关错误重试次数较少
    }

    // 对于客户端错误（如无效查询），不重试
    if (errorMessage.includes('syntax') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('404')) {
      return false;
    }

    // 其他错误默认重试
    return attempt < 2;
  }

  /**
   * 获取重试延迟
   */
  getRetryDelay(attempt: number, context?: BatchContext): number {
    // 指数退避，基础延迟1秒（比Qdrant稍长，因为图操作通常更复杂）
    const baseDelay = 1000;
    const maxDelay = 15000; // 最大15秒
    
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
      const reduction = Math.floor(batchSize * 0.25); // 图操作减少幅度更大
      const newBatchSize = Math.max(batchSize - reduction, this.MIN_BATCH_SIZE);
      
      this.logger.debug('Reducing Nebula batch size due to slow performance', {
        operationType,
        oldSize: batchSize,
        newSize: newBatchSize,
        executionTime,
        threshold: this.PERFORMANCE_THRESHOLD
      });
      
      return newBatchSize;
    } else if (executionTime < this.PERFORMANCE_THRESHOLD * 0.4 && batchSize < this.MAX_BATCH_SIZE) {
      // 执行时间较短，可以增加批大小
      const increase = Math.floor(batchSize * 0.15);
      const newBatchSize = Math.min(batchSize + increase, this.MAX_BATCH_SIZE);
      
      this.logger.debug('Increasing Nebula batch size due to good performance', {
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
  estimateMemoryUsage(batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    const avgNodeSize = 200; // 每个节点平均200字节
    const avgEdgeSize = 150; // 每条边平均150字节
    const queryOverhead = 1024 * 1024; // 查询开销1MB
    
    let estimatedSize = 0;
    
    if (operationType === 'insert') {
      // 插入操作：节点和边的内存使用
      const nodeCount = context?.metadata?.nodeCount || batchSize;
      const edgeCount = context?.metadata?.edgeCount || batchSize;
      estimatedSize = (nodeCount * avgNodeSize) + (edgeCount * avgEdgeSize);
    } else if (operationType === 'query') {
      // 查询操作：结果集和查询开销
      estimatedSize = batchSize * avgNodeSize + queryOverhead;
    } else {
      // 其他操作：估算
      estimatedSize = batchSize * Math.max(avgNodeSize, avgEdgeSize);
    }
    
    // 转换为MB
    return estimatedSize / (1024 * 1024);
  }

  /**
   * 检查是否有足够内存处理批次
   */
  hasSufficientMemory(batchSize: number, context?: BatchContext): boolean {
    const estimatedMemoryMB = this.estimateMemoryUsage(batchSize, context);
    const maxMemoryMB = 256; // 图操作最大允许使用256MB
    
    if (estimatedMemoryMB > maxMemoryMB) {
      this.logger.warn('Insufficient memory for Nebula batch operation', {
        batchSize,
        estimatedMemoryMB,
        maxMemoryMB,
        operationType: context?.metadata?.operationType
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
    const graphComplexity = context?.metadata?.graphComplexity || 'medium';
    
    // 根据图复杂度调整并发数
    let maxConcurrency = 3;
    if (graphComplexity === 'low') {
      maxConcurrency = 5;
    } else if (graphComplexity === 'high') {
      maxConcurrency = 2;
    }
    
    // 根据操作类型调整
    if (operationType === 'query') {
      return Math.min(maxConcurrency, Math.floor(200 / batchSize)); // 查询操作
    } else if (operationType === 'insert') {
      return Math.min(maxConcurrency, Math.floor(100 / batchSize)); // 插入操作
    }
    
    // 其他操作默认并发数
    return Math.min(maxConcurrency, 2);
  }

  /**
   * 获取操作超时时间
   */
  getOperationTimeout(batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    const graphComplexity = context?.metadata?.graphComplexity || 'medium';
    
    // 基础超时时间
    let baseTimeout = 30000; // 30秒
    
    // 根据操作类型调整
    if (operationType === 'query') {
      baseTimeout = 15000; // 查询操作15秒
    } else if (operationType === 'insert') {
      baseTimeout = 60000; // 插入操作60秒
    } else if (operationType === 'update') {
      baseTimeout = 45000; // 更新操作45秒
    }
    
    // 根据图复杂度调整
    let complexityFactor = 1.0;
    if (graphComplexity === 'high') {
      complexityFactor = 2.0;
    } else if (graphComplexity === 'low') {
      complexityFactor = 0.8;
    }
    
    // 根据批大小调整
    const batchSizeFactor = Math.max(1.0, batchSize / this.DEFAULT_BATCH_SIZE);
    
    const adjustedTimeout = baseTimeout * complexityFactor * batchSizeFactor;
    
    // 最大超时时间10分钟
    return Math.min(adjustedTimeout, 600000);
  }

  /**
   * 检查是否应该分割大型事务
   */
  shouldSplitTransaction(batchSize: number, context?: BatchContext): boolean {
    const operationType = context?.metadata?.operationType || 'insert';
    const graphComplexity = context?.metadata?.graphComplexity || 'medium';
    
    // 大型插入操作需要分割
    if (operationType === 'insert' && batchSize > 200) {
      return true;
    }
    
    // 高复杂度图的操作需要分割
    if (graphComplexity === 'high' && batchSize > 100) {
      return true;
    }
    
    return false;
  }

  /**
   * 获取事务分割大小
   */
  getTransactionSplitSize(batchSize: number, context?: BatchContext): number {
    const operationType = context?.metadata?.operationType || 'insert';
    
    if (operationType === 'insert') {
      return Math.min(100, Math.floor(batchSize / 2));
    }
    
    return Math.min(50, Math.floor(batchSize / 3));
  }
}