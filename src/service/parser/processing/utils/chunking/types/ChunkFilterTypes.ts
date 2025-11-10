import { CodeChunk } from '../../../types/CodeChunk';
import { PostProcessingContext } from '../../../../post-processing/IChunkPostProcessor';

/**
 * 块过滤器接口
 * 专注于小块过滤功能
 */
export interface IChunkFilter {
  /**
   * 过滤代码块
   * @param chunks 代码块数组
   * @param context 后处理上下文
   * @returns 过滤后的代码块数组
   */
  filterChunks(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;

  /**
   * 获取过滤器名称
   */
  getName(): string;

  /**
   * 判断是否应该应用过滤
   */
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
}

/**
 * 过滤配置接口
 */
export interface FilterConfig {
  /** 是否启用过滤 */
  enableFilter: boolean;
  /** 最小块大小 */
  minChunkSize: number;
  /** 非常小的块阈值 */
  verySmallThreshold: number;
  /** 最大块大小 */
  maxChunkSize: number;
  /** 语言特定调整 */
  languageAdjustment: LanguageAdjustment;
}

/**
 * 块统计信息
 */
export interface ChunkStats {
  /** 中位数大小 */
  medianSize: number;
  /** 平均大小 */
  meanSize: number;
  /** 大小分布 */
  sizeDistribution: number[];
  /** 总块数 */
  totalChunks: number;
}

/**
 * 语言特定调整
 */
export interface LanguageAdjustment {
  /** 最小大小 */
  minSize: number;
  /** 最大大小因子 */
  maxSizeFactor: number;
  /** 是否启用严格模式 */
  strictMode?: boolean;
}

/**
 * 过滤结果
 */
export interface FilterResult {
  /** 过滤后的块 */
  chunks: CodeChunk[];
  /** 过滤掉的块数量 */
  filteredCount: number;
  /** 过滤统计 */
  statistics: {
    originalCount: number;
    finalCount: number;
    averageSizeBefore: number;
    averageSizeAfter: number;
  };
}

/**
 * 内容质量评估器接口
 */
export interface IContentQualityEvaluator {
  /**
   * 计算内容质量分数
   * @param content 内容
   * @param language 编程语言
   * @returns 质量分数 (0-1)
   */
  calculateQuality(content: string, language?: string): number;

  /**
   * 判断是否为高质量内容
   * @param content 内容
   * @param language 编程语言
   * @param threshold 质量阈值
   * @returns 是否高质量
   */
  isHighQuality(content: string, language?: string, threshold?: number): boolean;
}

/**
 * 块相似性计算器接口
 */
export interface IChunkSimilarityCalculator {
  /**
   * 计算两个块的相似性
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   * @returns 相似性分数 (0-1)
   */
  calculateSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): Promise<number>;

  /**
   * 计算内容相似性
   * @param content1 第一个内容
   * @param content2 第二个内容
   * @returns 相似性分数 (0-1)
   */
  calculateContentSimilarity(content1: string, content2: string): Promise<number>;
}

/**
 * 块合并器接口
 */
export interface IChunkMerger {
  /**
   * 智能合并块
   * @param chunks 块数组
   * @param context 上下文
   * @returns 合并后的块数组
   */
  intelligentMerge(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;

  /**
   * 合并块组
   * @param group 块组
   * @returns 合并后的块
   */
  mergeChunkGroup(group: CodeChunk[]): CodeChunk;

  /**
   * 判断是否应该合并
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   * @param context 上下文
   * @returns 是否应该合并
   */
  shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk, context: PostProcessingContext): Promise<boolean>;
}