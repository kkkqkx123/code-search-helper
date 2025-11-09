import { injectable, inject } from 'inversify';
import { ISegmentationProcessor, SegmentationContext } from '../../strategies/types/SegmentationTypes';
import { CodeChunk } from '../../types/CodeChunk';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { IChunkFilter, FilterConfig } from './types/ChunkFilterTypes';
import { ContentQualityEvaluator } from './evaluators/ContentQualityEvaluator';
import { ChunkMerger } from './evaluators/ChunkMerger';
import { PostProcessingContext } from '../../post-processing/IChunkPostProcessor';

/**
 * 块过滤器
 * 职责：专注于小块过滤功能，使用独立的评估器模块进行质量评估和合并
 */
@injectable()
export class ChunkFilter implements ISegmentationProcessor, IChunkFilter {
  private logger?: LoggerService;
  private qualityEvaluator?: ContentQualityEvaluator;
  private chunkMerger?: ChunkMerger;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    qualityEvaluator?: ContentQualityEvaluator,
    chunkMerger?: ChunkMerger
  ) {
    this.logger = logger;
    this.qualityEvaluator = qualityEvaluator;
    this.chunkMerger = chunkMerger;
  }

  async process(context: SegmentationContext): Promise<any[]> {
    // 为ISegmentationProcessor接口实现的process方法
    // 由于接口限制，这里简单返回空数组
    return [];
  }

  getName(): string {
    return 'chunk-filter';
  }

  validateContext(context: SegmentationContext): boolean {
    return !!context.content && context.content.length > 0;
  }

  /**
   * 实现IChunkFilter接口的过滤方法
   */
  async filterChunks(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (!context.options.enableIntelligentChunking || chunks.length === 0) {
      return chunks;
    }

    const result: CodeChunk[] = [];
    const minChunkSize = context.options.minChunkSize || 100;

    // 处理每个块
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkSize = chunk.content.length;

      // 如果块大小足够，直接添加
      if (chunkSize >= minChunkSize) {
        result.push(chunk);
        continue;
      }

      // 对于小块，检查是否应该被过滤
      if (this.shouldKeepSmallChunk(chunk, minChunkSize)) {
        result.push(chunk);
        continue;
      }

      // 处理非常小的块
      const hasPrevChunk = result.length > 0;
      const hasNextChunk = i < chunks.length - 1;

      // 检查下一个块是否是正常大小的块
      const nextChunkIsNormalSized = hasNextChunk && this.isNormalSizedChunk(chunks[i + 1], minChunkSize);

      if (hasPrevChunk && hasNextChunk && nextChunkIsNormalSized) {
        // 只有当小块位于两个正常大小的块之间时，才合并到前一个块
        const prevChunk = result[result.length - 1];
        prevChunk.content += '\n' + chunk.content;
        prevChunk.metadata.endLine = chunk.metadata.endLine;
        this.logger?.debug(`Merged small chunk (${chunkSize} chars) into previous chunk`);
      } else if (hasNextChunk && nextChunkIsNormalSized) {
        // 合并到后一个块
        const nextChunk = chunks[i + 1];
        const mergedChunk = {
          content: chunk.content + '\n' + nextChunk.content,
          metadata: {
            ...nextChunk.metadata,
            startLine: chunk.metadata.startLine
          }
        };
        result.push(mergedChunk);
        this.logger?.debug(`Merged small chunk (${chunkSize} chars) into next chunk`);
        i++; // 跳过下一个块，因为已经合并了
      } else {
        // 孤立的小块，丢弃
        this.logger?.warn(`Discarded small chunk (${chunkSize} chars): ${chunk.content.substring(0, 50)}...`);
      }
    }

    this.logger?.debug(`Filtered ${chunks.length} chunks to ${result.length} valid chunks`);
    return result;
  }

  /**
   * 判断是否应该应用过滤
   */
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    if (!context.options.enableIntelligentChunking || chunks.length === 0) {
      return false;
    }

    // 检查是否有需要过滤的小块
    return chunks.some(chunk => {
      const chunkSize = chunk.content.length;
      const minChunkSize = context.options.minChunkSize || 100;

      // 如果不是正常大小且小于minChunkSize，则需要过滤
      return !this.isNormalSizedChunk(chunk, minChunkSize) && chunkSize < minChunkSize;
    });
  }

  /**
   * 为后处理器使用添加的方法（保持向后兼容）
   */
  async processWithChunks(chunks: CodeChunk[], context: any): Promise<CodeChunk[]> {
    // 转换为PostProcessingContext格式
    const postProcessingContext: PostProcessingContext = {
      originalContent: context.originalContent || '',
      language: context.language || '',
      filePath: context.filePath,
      config: context.config || {},
      options: context.options || {}
    };

    return this.filterChunks(chunks, postProcessingContext);
  }

  /**
   * 高级过滤：基于内容质量的过滤（使用独立的质量评估器）
   */
  async advancedFilter(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (!this.qualityEvaluator) {
      this.logger?.warn('ContentQualityEvaluator not available, skipping advanced filtering');
      return chunks;
    }

    const filteredChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (this.qualityEvaluator.isHighQuality(chunk.content, chunk.metadata.language, 0.1)) {
        filteredChunks.push(chunk);
      } else {
        this.logger?.debug(`Filtered low-quality chunk: ${chunk.content.substring(0, 50)}...`);
      }
    }

    return filteredChunks;
  }

  /**
   * 智能合并：使用独立的块合并器
   */
  async intelligentMerge(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (!this.chunkMerger) {
      this.logger?.warn('ChunkMerger not available, skipping intelligent merging');
      return chunks;
    }

    return this.chunkMerger.intelligentMerge(chunks, context);
  }

  /**
   * 判断是否为正常大小的块（基于内容特征）
   */
  private isNormalSizedChunk(chunk: CodeChunk, minChunkSize: number): boolean {
    const chunkSize = chunk.content.length;
    
    // 检查是否是"正常大小"的块（基于内容特征）
    return chunkSize >= 20 || // 长度大于等于20
      chunk.content.includes(' ') || // 包含空格（可能是句子）
      chunkSize >= 12; // 长度大于等于12
  }

  /**
   * 判断是否应该保留小块
   */
  private shouldKeepSmallChunk(chunk: CodeChunk, minChunkSize: number): boolean {
    const chunkSize = chunk.content.length;
    
    // 使用更严格的阈值来确定哪些小块需要被过滤
    const verySmallThreshold = Math.min(minChunkSize * 0.3, 15); // 最多15个字符或minChunkSize的30%

    // 检查是否是"正常大小"的块（基于内容特征）
    const isNormalSized = this.isNormalSizedChunk(chunk, minChunkSize);

    return isNormalSized;
  }

  /**
   * 设置过滤配置
   */
  setFilterConfig(config: {
    enableSmallChunkFilter?: boolean;
    minChunkSize?: number;
    maxChunkSize?: number;
    enableIntelligentMerge?: boolean;
  }): void {
    this.logger?.debug('Filter configuration updated', config);
  }
}