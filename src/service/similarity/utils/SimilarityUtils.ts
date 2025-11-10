import { injectable, inject } from 'inversify';
import {
  SimilarityOptions,
  SimilarityResult,
  BatchSimilarityResult,
  ISimilarityService,
  SimilarityError
} from '../types/SimilarityTypes';
import { TYPES } from '../../../types';
import { CodeChunk } from '../../parser/processing/types/CodeChunk';
import { ContentHashIDGenerator } from '../../parser/processing/utils/ContentHashIDGenerator';
import { ContentHashUtils } from '../../../utils/ContentHashUtils';
import { ISimilarityCoordinator } from '../coordination/types/CoordinationTypes';

/**
 * 相似度计算工具类（重构为实例化）
 * 提供统一的相似度计算方法，内部使用SimilarityService和SimilarityCoordinator
 */
@injectable()
export class SimilarityUtils {
  private static instance: SimilarityUtils | null = null;
  
  constructor(
    @inject(TYPES.SimilarityService) private similarityService: ISimilarityService,
    @inject('ISimilarityCoordinator') private coordinator?: ISimilarityCoordinator
  ) {
    // 设置静态实例以支持向后兼容
    SimilarityUtils.instance = this;
  }

  /**
   * 设置服务实例（静态方法，用于向后兼容）
   */
  static setService(similarityService: ISimilarityService): void {
    // 注意：这个方法是为了向后兼容，但在DI环境中不应该使用
    // 实际使用时应该通过DI容器获取实例
    console.warn('SimilarityUtils.setService() is deprecated. Use dependency injection instead.');
    if (SimilarityUtils.instance) {
      (SimilarityUtils.instance as any).similarityService = similarityService;
    }
  }

  /**
   * 清理资源（静态方法，用于向后兼容）
   */
  static cleanup(): void {
    // 注意：这个方法是为了向后兼容
    console.warn('SimilarityUtils.cleanup() is deprecated. Use dependency injection instead.');
    SimilarityUtils.instance = null;
  }

  /**
   * 获取实例（静态方法，用于向后兼容）
   */
  static getInstance(): SimilarityUtils | null {
    return SimilarityUtils.instance;
  }

  /**
   * 设置实例（静态方法，用于向后兼容）
   */
  static setInstance(instance: SimilarityUtils): void {
    SimilarityUtils.instance = instance;
  }

  /**
   * 计算两个代码片段的相似度（0-1之间）
   */
  async calculateSimilarity(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<number> {
    const result = await this.similarityService.calculateSimilarity(content1, content2, options);
    return result.similarity;
  }

  /**
   * 检查两个代码片段是否相似（基于阈值）
   */
  async isSimilar(
    content1: string,
    content2: string,
    threshold: number = 0.8,
    options?: SimilarityOptions
  ): Promise<boolean> {
    return await this.similarityService.isSimilar(content1, content2, threshold, options);
  }

  /**
   * 批量相似度计算
   */
  async calculateBatchSimilarity(
    contents: string[],
    options?: SimilarityOptions
  ): Promise<number[][]> {
    const result = await this.similarityService.calculateBatchSimilarity(contents, options);
    return result.matrix;
  }

  /**
   * 标准化内容（用于相似度计算）
   * 保持向后兼容的同步方法
   */
  static normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // 标准化空白字符
      .replace(/\/\/.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .replace(/\s+/g, ' ') // 再次标准化空白字符
      .trim()
      .toLowerCase();
  }

  /**
   * 计算内容哈希
   * 保持向后兼容的同步方法
   */
  static calculateContentHash(content: string): string {
    return ContentHashUtils.generateContentHash(content);
  }

  /**
   * 获取推荐的相似度阈值
   * 保持向后兼容的同步方法
   */
  static getRecommendedThreshold(contentType: 'function' | 'class' | 'generic' = 'generic'): number {
    switch (contentType) {
      case 'function':
        return 0.85; // 函数通常更相似
      case 'class':
        return 0.8;  // 类定义相似度适中
      case 'generic':
      default:
        return 0.8;
    }
  }

  /**
   * 检查两个块是否可以合并
   */
  async canMergeChunks(
    chunk1: CodeChunk,
    chunk2: CodeChunk,
    similarityThreshold: number
  ): Promise<boolean> {
    // 检查相似度
    const isSimilar = await this.isSimilar(chunk1.content, chunk2.content, similarityThreshold);
    if (!isSimilar) {
      return false;
    }

    // 检查位置关系（相邻或重叠）
    const start1 = chunk1.metadata.startLine;
    const end1 = chunk1.metadata.endLine;
    const start2 = chunk2.metadata.startLine;
    const end2 = chunk2.metadata.endLine;

    // 相邻：块2紧接在块1后面
    const isAdjacent = start2 === end1 + 1;

    // 重叠：两个块有重叠区域
    const isOverlapping = start2 <= end1 && start1 <= end2;

    return isAdjacent || isOverlapping;
  }

  /**
   * 智能重叠控制 - 检查新的重叠块是否与已有块过于相似
   */
  async shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    similarityThreshold: number
  ): Promise<boolean> {
    // 生成新块的内容哈希
    const newChunkHash = ContentHashIDGenerator.getContentHashPrefix(newChunk.content);

    // 检查是否已经存在相同内容的块
    for (const existingChunk of existingChunks) {
      const existingHash = ContentHashIDGenerator.getContentHashPrefix(existingChunk.content);

      // 如果内容哈希相同，说明内容基本相同
      if (newChunkHash === existingHash) {
        return false; // 跳过这个重叠块
      }

      // 检查相似度
      const isSimilar = await this.isSimilar(newChunk.content, existingChunk.content, similarityThreshold);
      if (isSimilar) {
        return false; // 跳过过于相似的重叠块
      }
    }

    return true;
  }

  /**
   * 从代码块列表中过滤掉相似的块
   */
  async filterSimilarChunks<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<T[]> {
    return await this.similarityService.filterSimilarItems(chunks, threshold, options);
  }

  /**
   * 查找相似块组
   */
  async findSimilarityGroups<T extends { content: string; id?: string }>(
    chunks: T[],
    threshold?: number,
    options?: SimilarityOptions
  ): Promise<Map<string, T[]>> {
    return await this.similarityService.findSimilarityGroups(chunks, threshold, options);
  }

  /**
   * 计算代码块的相似度矩阵
   */
  async calculateSimilarityMatrix(contents: string[]): Promise<number[][]> {
    return await this.calculateBatchSimilarity(contents);
  }

  /**
   * 高级相似度计算（包含多种策略）
   */
  async calculateAdvancedSimilarity(
    content1: string,
    content2: string,
    options: SimilarityOptions & {
      includeStructure?: boolean;
      includeSemantic?: boolean;
      includeKeywords?: boolean;
      weights?: {
        content?: number;
        structure?: number;
        semantic?: number;
        keywords?: number;
      };
    }
  ): Promise<SimilarityResult> {
    return await this.similarityService.calculateAdvancedSimilarity(content1, content2, options);
  }

  /**
   * 获取可用策略列表
   */
  getAvailableStrategies(): string[] {
    // 假设SimilarityService有这个方法
    if ('getAvailableStrategies' in this.similarityService) {
      return (this.similarityService as any).getAvailableStrategies();
    }

    return [];
  }

  /**
   * 获取协调器统计信息
   */
  getCoordinatorStats(): any {
    if (this.coordinator) {
      return this.coordinator.getCoordinatorStats();
    }
    return null;
  }

  /**
   * 生成执行计划
   */
  async generateExecutionPlan(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<any> {
    if (this.coordinator) {
      return await this.coordinator.generateExecutionPlan(content1, content2, options);
    }
    throw new SimilarityError(
      'Coordinator not available for execution plan generation',
      'COORDINATOR_NOT_AVAILABLE'
    );
  }
}