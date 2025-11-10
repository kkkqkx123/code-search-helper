import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';
import { ISimilarityService } from '../types/SimilarityTypes';
import { SimilarityUtils } from '../utils/SimilarityUtils';
import { SimilarityDetector } from '../utils/SimilarityDetector';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 相似度服务初始化器
 * 负责将SimilarityService实例注入到工具类中
 */
@injectable()
export class SimilarityServiceInitializer {
  constructor(
    @inject(TYPES.SimilarityService) private similarityService: ISimilarityService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  /**
   * 初始化相似度工具类
   */
  async initialize(): Promise<void> {
    try {
      this.logger?.info('Initializing similarity service...');
      
      // SimilarityUtils现在通过DI容器管理，不需要手动设置服务
      // 但SimilarityDetector仍使用旧的静态方法，需要保留
      SimilarityDetector.setService(this.similarityService);
      
      this.logger?.info('Similarity service initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize similarity service:', error);
      throw error;
    }
  }

  /**
   * 清理相似度工具类
   */
  async cleanup(): Promise<void> {
    try {
      this.logger?.info('Cleaning up similarity service...');
      
      // SimilarityDetector仍使用旧的静态方法，需要保留清理
      SimilarityDetector.cleanup();
      
      this.logger?.info('Similarity service cleaned up successfully');
    } catch (error) {
      this.logger?.error('Failed to cleanup similarity service:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isInitialized: boolean;
    availableStrategies: string[];
    serviceStats?: any;
  } {
    const isInitialized = !!(this.similarityService);
    
    let availableStrategies: string[] = [];
    let serviceStats;
    
    if (isInitialized && this.similarityService) {
      if ('getAvailableStrategies' in this.similarityService) {
        availableStrategies = (this.similarityService as any).getAvailableStrategies();
      }
      
      if ('getServiceStats' in this.similarityService) {
        serviceStats = (this.similarityService as any).getServiceStats();
      }
    }
    
    return {
      isInitialized,
      availableStrategies,
      serviceStats
    };
  }

  /**
   * 验证服务是否正常工作
   */
  async validate(): Promise<{
    isValid: boolean;
    error?: string;
    testResult?: any;
  }> {
    try {
      if (!this.similarityService) {
        return {
          isValid: false,
          error: 'SimilarityService not available'
        };
      }

      // 执行简单的测试
      const testContent1 = 'function test() { return "hello"; }';
      const testContent2 = 'function test() { return "world"; }';
      
      const result = await this.similarityService.calculateSimilarity(testContent1, testContent2);
      
      if (typeof result.similarity !== 'number' || result.similarity < 0 || result.similarity > 1) {
        return {
          isValid: false,
          error: 'Invalid similarity result'
        };
      }

      return {
        isValid: true,
        testResult: {
          similarity: result.similarity,
          strategy: result.strategy,
          executionTime: result.details?.executionTime
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}