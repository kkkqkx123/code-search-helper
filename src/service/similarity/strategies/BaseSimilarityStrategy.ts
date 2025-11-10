import { injectable } from 'inversify';
import {
  ISimilarityStrategy,
  SimilarityOptions,
  SimilarityStrategyType,
  SimilarityError
} from '../types/SimilarityTypes';
import { HashUtils } from '../../../utils/cache/HashUtils';
import { StrategyCost } from '../coordination/types/CoordinationTypes';

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
    return HashUtils.simpleHash(content);
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

  /**
   * 获取策略成本信息
   */
  getStrategyCost(): StrategyCost {
    // 默认实现，子类可以重写
    return {
      computational: 0.5,
      memory: 0.3,
      time: 200,
      total: 0.5
    };
  }

  /**
   * 预估执行时间（毫秒）
   */
  estimateExecutionTime(content1: string, content2: string): number {
    // 基于内容长度的简单估算
    const avgLength = (content1.length + content2.length) / 2;
    const baseTime = this.getStrategyCost().time;

    // 根据内容长度调整时间
    if (avgLength < 100) {
      return baseTime * 0.5;
    } else if (avgLength > 1000) {
      return baseTime * 2;
    }

    return baseTime;
  }

  /**
   * 获取策略优先级（数字越小优先级越高）
   */
  getPriority(): number {
    // 默认优先级，子类可以重写
    return 5;
  }

  /**
   * 检查是否支持快速路径
   */
  supportsFastPath(content1: string, content2: string): boolean {
    // 默认不支持快速路径，子类可以重写
    return false;
  }

  /**
   * 快速路径计算（如果支持）
   */
  async fastPathCalculate(content1: string, content2: string): Promise<number | null> {
    // 默认返回null，表示不支持快速路径
    return null;
  }
}