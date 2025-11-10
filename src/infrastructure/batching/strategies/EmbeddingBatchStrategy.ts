import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IBatchStrategy, BatchContext } from '../types';
import { EmbeddingInput, EmbeddingResult, Embedder } from '../../../embedders/BaseEmbedder';

/**
 * 嵌入器API批处理策略
 * 针对嵌入器API调用的特殊优化
 */
@injectable()
export class EmbeddingBatchStrategy implements IBatchStrategy {
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly MAX_BATCH_SIZE = 200;
  private readonly MIN_BATCH_SIZE = 1;
  private readonly PERFORMANCE_THRESHOLD = 10000; // 10秒

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 计算最优批大小
   * 考虑API限制、模型特性和内存使用
   */
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number {
    let batchSize = this.DEFAULT_BATCH_SIZE;

    // 根据模型类型调整
    const model = context?.metadata?.model || 'default';
    if (model.includes('large') || model.includes('big')) {
      batchSize = Math.floor(batchSize * 0.6); // 大模型使用较小批次
    } else if (model.includes('small') || model.includes('tiny')) {
      batchSize = Math.min(batchSize * 1.5, this.MAX_BATCH_SIZE); // 小模型可以使用较大批次
    }

    // 根据向量维度调整
    const dimension = context?.metadata?.dimensions || 1536;
    if (dimension > 2048) {
      batchSize = Math.floor(batchSize * 0.7); // 高维度减少批大小
    } else if (dimension < 768) {
      batchSize = Math.min(batchSize * 1.3, this.MAX_BATCH_SIZE); // 低维度可以增加批大小
    }

    // 根据文本长度调整
    const avgTextLength = context?.metadata?.avgTextLength || 500;
    if (avgTextLength > 2000) {
      batchSize = Math.floor(batchSize * 0.5); // 长文本使用较小批次
    } else if (avgTextLength < 200) {
      batchSize = Math.min(batchSize * 1.2, this.MAX_BATCH_SIZE); // 短文本可以增加批大小
    }

    // 根据API提供商限制调整
    const provider = context?.metadata?.provider || 'default';
    if (provider === 'openai') {
      batchSize = Math.min(batchSize, 100); // OpenAI限制较严格
    } else if (provider === 'siliconflow') {
      batchSize = Math.min(batchSize, 50); // SiliconFlow限制更严格
    } else if (provider === 'local') {
      batchSize = Math.min(batchSize * 2, this.MAX_BATCH_SIZE); // 本地模型限制较少
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
    
    // 对于API限制和网络错误，应该重试
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('503') ||
        errorMessage.includes('502') ||
        errorMessage.includes('500')) {
      return attempt < 3;
    }

    // 对于模型负载过高，应该重试
    if (errorMessage.includes('overloaded') ||
        errorMessage.includes('capacity') ||
        errorMessage.includes('busy')) {
      return attempt < 2;
    }

    // 对于客户端错误（如无效输入），不重试
    if (errorMessage.includes('invalid') ||
        errorMessage.includes('bad request') ||
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
    const provider = context?.metadata?.provider || 'default';
    
    // 根据提供商调整基础延迟
    let baseDelay = 1000; // 默认1秒
    if (provider === 'openai') {
      baseDelay = 2000; // OpenAI需要更长等待
    } else if (provider === 'siliconflow') {
      baseDelay = 1500; // SiliconFlow中等等待
    } else if (provider === 'local') {
      baseDelay = 500; // 本地模型等待较短
    }
    
    const maxDelay = 30000; // 最大30秒
    
    let delay = baseDelay * Math.pow(2, attempt - 1);
    
    // 添加随机抖动，避免雷群效应
    delay = delay * (0.5 + Math.random() * 0.5);
    
    return Math.min(delay, maxDelay);
  }

  /**
   * 根据性能调整批大小
   */
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number, context?: BatchContext): number {
    const provider = context?.metadata?.provider || 'default';
    
    if (executionTime > this.PERFORMANCE_THRESHOLD) {
      // 执行时间过长，减少批大小
      let reductionFactor = 0.2;
      
      // 根据提供商调整减少幅度
      if (provider === 'openai') {
        reductionFactor = 0.3; // OpenAI减少幅度更大
      } else if (provider === 'local') {
        reductionFactor = 0.15; // 本地模型减少幅度较小
      }
      
      const reduction = Math.floor(batchSize * reductionFactor);
      const newBatchSize = Math.max(batchSize - reduction, this.MIN_BATCH_SIZE);
      
      this.logger.debug('Reducing embedding batch size due to slow performance', {
        provider,
        oldSize: batchSize,
        newSize: newBatchSize,
        executionTime,
        threshold: this.PERFORMANCE_THRESHOLD
      });
      
      return newBatchSize;
    } else if (executionTime < this.PERFORMANCE_THRESHOLD * 0.5 && batchSize < this.MAX_BATCH_SIZE) {
      // 执行时间较短，可以增加批大小
      let increaseFactor = 0.1;
      
      // 根据提供商调整增加幅度
      if (provider === 'local') {
        increaseFactor = 0.15; // 本地模型可以更激进增加
      } else if (provider === 'openai') {
        increaseFactor = 0.05; // OpenAI增加幅度较小
      }
      
      const increase = Math.floor(batchSize * increaseFactor);
      const newBatchSize = Math.min(batchSize + increase, this.MAX_BATCH_SIZE);
      
      this.logger.debug('Increasing embedding batch size due to good performance', {
        provider,
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
    const dimension = context?.metadata?.dimensions || 1536;
    const avgTextLength = context?.metadata?.avgTextLength || 500;
    
    // 输入文本内存
    const textMemory = batchSize * avgTextLength * 2; // UTF-16编码
    
    // 嵌入向量内存（float32）
    const vectorMemory = batchSize * dimension * 4;
    
    // 中间处理内存
    const processingMemory = batchSize * 1024; // 每个输入1KB处理开销
    
    const totalMemory = textMemory + vectorMemory + processingMemory;
    
    // 转换为MB
    return totalMemory / (1024 * 1024);
  }

  /**
   * 检查是否有足够内存处理批次
   */
  hasSufficientMemory(batchSize: number, context?: BatchContext): boolean {
    const estimatedMemoryMB = this.estimateMemoryUsage(batchSize, context);
    const maxMemoryMB = 1024; // 嵌入操作最大允许使用1GB
    
    if (estimatedMemoryMB > maxMemoryMB) {
      this.logger.warn('Insufficient memory for embedding batch operation', {
        batchSize,
        estimatedMemoryMB,
        maxMemoryMB,
        provider: context?.metadata?.provider
      });
      return false;
    }
    
    return true;
  }

  /**
   * 获取推荐的并发数
   */
  getRecommendedConcurrency(batchSize: number, context?: BatchContext): number {
    const provider = context?.metadata?.provider || 'default';
    
    // 根据提供商调整并发数
    let maxConcurrency = 3;
    if (provider === 'openai') {
      maxConcurrency = 2; // OpenAI限制较严格
    } else if (provider === 'local') {
      maxConcurrency = 5; // 本地模型可以使用更高并发
    } else if (provider === 'siliconflow') {
      maxConcurrency = 3; // SiliconFlow中等并发
    }
    
    // 根据批大小调整
    if (batchSize < 10) {
      return Math.min(maxConcurrency, 5); // 小批次可以使用更高并发
    } else if (batchSize > 100) {
      return Math.min(maxConcurrency, 2); // 大批次使用较低并发
    }
    
    return maxConcurrency;
  }

  /**
   * 获取操作超时时间
   */
  getOperationTimeout(batchSize: number, context?: BatchContext): number {
    const provider = context?.metadata?.provider || 'default';
    const avgTextLength = context?.metadata?.avgTextLength || 500;
    
    // 基础超时时间
    let baseTimeout = 30000; // 30秒
    
    // 根据提供商调整
    if (provider === 'openai') {
      baseTimeout = 60000; // OpenAI需要更长超时
    } else if (provider === 'local') {
      baseTimeout = 120000; // 本地模型可能需要更长时间
    } else if (provider === 'siliconflow') {
      baseTimeout = 45000; // SiliconFlow中等超时
    }
    
    // 根据批大小和文本长度调整
    const complexityFactor = Math.max(1.0, (batchSize * avgTextLength) / (50 * 500));
    const adjustedTimeout = baseTimeout * complexityFactor;
    
    // 最大超时时间10分钟
    return Math.min(adjustedTimeout, 600000);
  }

  /**
   * 预处理输入数据
   */
  preprocessInputs(inputs: EmbeddingInput[], context?: BatchContext): EmbeddingInput[] {
    const provider = context?.metadata?.provider || 'default';
    
    // 根据提供商进行特殊预处理
    if (provider === 'openai') {
      // OpenAI可能有特殊要求
      return inputs.map(input => ({
        text: input.text.trim(),
        metadata: input.metadata
      }));
    }
    
    // 默认预处理
    return inputs.map(input => ({
      text: input.text.trim(),
      metadata: input.metadata
    }));
  }

  /**
   * 后处理结果数据
   */
  postprocessResults(results: EmbeddingResult[], context?: BatchContext): EmbeddingResult[] {
    const provider = context?.metadata?.provider || 'default';
    
    // 根据提供商进行特殊后处理
    if (provider === 'openai') {
      // OpenAI可能有特殊响应格式
      return results.map(result => ({
        ...result,
        processingTime: result.processingTime || 0
      }));
    }
    
    // 默认后处理
    return results;
  }

  /**
   * 检查输入有效性
   */
  validateInputs(inputs: EmbeddingInput[], context?: BatchContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查输入数量
    if (inputs.length === 0) {
      errors.push('No inputs provided');
    }
    
    // 检查文本内容
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input.text || input.text.trim().length === 0) {
        errors.push(`Input ${i} has empty text`);
      }
      
      if (input.text.length > 8000) {
        errors.push(`Input ${i} text too long (${input.text.length} characters)`);
      }
    }
    
    // 检查批大小限制
    const maxBatchSize = this.calculateOptimalBatchSize(inputs.length, context);
    if (inputs.length > maxBatchSize) {
      errors.push(`Batch size ${inputs.length} exceeds recommended maximum ${maxBatchSize}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}