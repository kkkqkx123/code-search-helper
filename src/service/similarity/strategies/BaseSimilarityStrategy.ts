import { injectable } from 'inversify';
import { 
  ISimilarityStrategy, 
  SimilarityOptions, 
  SimilarityStrategyType,
  SimilarityError 
} from '../types/SimilarityTypes';

/**
 * 相似度策略基类
 * 提供通用的相似度计算功能和默认实现
 */
@injectable()
export abstract class BaseSimilarityStrategy implements ISimilarityStrategy {
  abstract readonly name: string;
  abstract readonly type: SimilarityStrategyType;

  /**
   * 计算相似度 - 子类必须实现
   */
  abstract calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number>;

  /**
   * 检查是否支持指定的内容类型和语言
   */
  isSupported(contentType: string, language?: string): boolean {
    // 默认实现：支持所有类型，子类可以重写
    return true;
  }

  /**
   * 获取默认阈值
   */
  getDefaultThreshold(): number {
    return 0.8;
  }

  /**
   * 预处理内容 - 子类可以重写
   */
  protected async preprocessContent(content: string, options?: SimilarityOptions): Promise<string> {
    return content
      .replace(/\s+/g, ' ') // 标准化空白字符
      .replace(/\/\/.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .replace(/\s+/g, ' ') // 再次标准化空白字符
      .trim()
      .toLowerCase();
  }

  /**
   * 验证输入参数
   */
  protected validateInput(content1: string, content2: string, options?: SimilarityOptions): void {
    if (!content1 || !content2) {
      throw new SimilarityError(
        'Content cannot be empty',
        'INVALID_INPUT',
        { content1: !!content1, content2: !!content2 }
      );
    }

    if (options?.threshold !== undefined && (options.threshold < 0 || options.threshold > 1)) {
      throw new SimilarityError(
        'Threshold must be between 0 and 1',
        'INVALID_THRESHOLD',
        { threshold: options.threshold }
      );
    }
  }

  /**
   * 快速检查内容是否完全相同
   */
  protected async isIdentical(content1: string, content2: string): Promise<boolean> {
    return content1 === content2;
  }

  /**
   * 计算内容哈希用于缓存键
   */
  protected generateContentHash(content: string): string {
    // 简单的哈希实现，实际项目中可以使用更复杂的哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(content1: string, content2: string, options?: SimilarityOptions): string {
    const hash1 = this.generateContentHash(content1);
    const hash2 = this.generateContentHash(content2);
    const strategy = this.type;
    const threshold = options?.threshold || this.getDefaultThreshold();
    
    return `${strategy}:${hash1}:${hash2}:${threshold}`;
  }

  /**
   * 标准化相似度分数到0-1范围
   */
  protected normalizeScore(score: number): number {
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 计算执行时间
   */
  protected async measureExecutionTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    
    return { result, executionTime };
  }
}