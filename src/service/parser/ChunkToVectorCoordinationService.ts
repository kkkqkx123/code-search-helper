import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { CodeChunk } from './types';
import * as fs from 'fs/promises';
import { GuardCoordinator } from './guard/GuardCoordinator';
import { ProcessingCoordinator } from './processing/coordinator/ProcessingCoordinator';
import { VectorEmbeddingService } from '../vector/embedding/VectorEmbeddingService';
import { VectorConversionService } from '../vector/conversion/VectorConversionService';

export interface ProcessingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
  addOverlap?: boolean;
}

/**
 * 专门协调代码分段到向量嵌入转换的服务
 * 完全委托给 ProcessingCoordinator 和 GuardCoordinator 进行策略管理
 */
@injectable()
export class ChunkToVectorCoordinationService {
  private projectEmbedders: Map<string, string> = new Map(); // 存储项目对应的embedder

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProcessingGuard) private processingGuard: GuardCoordinator,
    @inject(TYPES.UnifiedProcessingCoordinator) private processingCoordinator: ProcessingCoordinator,
    @inject(TYPES.VectorEmbeddingService) private embeddingService: VectorEmbeddingService,
    @inject(TYPES.VectorConversionService) private conversionService: VectorConversionService
  ) {
    // 所有策略管理完全委托给 ProcessingCoordinator 和 GuardCoordinator
    // 向量操作委托给 VectorEmbeddingService 和 VectorConversionService
  }

  async processFileForEmbedding(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    try {
      // 1. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 2. 完全委托给 ProcessingCoordinator 进行智能处理
      const processingResult = await this.processingCoordinator.process(content, 'unknown', filePath);

      if (!processingResult.success) {
        throw new Error(`Processing failed: ${processingResult.error}`);
      }

      // 3. 转换为向量点
      return await this.convertToVectorPoints(processingResult.chunks, projectPath, options);
    } catch (error) {
      // 记录错误并清理
      this.processingGuard.recordError(error as Error, `processFileForEmbedding: ${filePath}`);

      // 使用降级方案 - 完全委托给 GuardCoordinator
      try {
        // GuardCoordinator 会处理降级逻辑
        return await this.processWithGuardCoordinatorFallback(filePath, projectPath, options);
      } catch (fallbackError) {
        this.errorHandler.handleError(
          new Error(`Failed to process file for embedding: ${error instanceof Error ? error.message : String(error)}, fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`),
          { component: 'ChunkToVectorCoordinationService', operation: 'processFileForEmbedding', filePath, projectPath }
        );
        throw error;
      }
    }
  }

  /**
   * 使用 GuardCoordinator 进行降级处理
   * 完全委托给 GuardCoordinator 处理所有降级逻辑
   */
  private async processWithGuardCoordinatorFallback(
    filePath: string,
    projectPath: string,
    options?: ProcessingOptions
  ): Promise<VectorPoint[]> {
    try {
      // 使用 GuardCoordinator 的文件处理功能
      const guardResult = await this.processingGuard.processFile(filePath, '');

      if (guardResult.chunks && guardResult.chunks.length > 0) {
        return await this.convertToVectorPoints(guardResult.chunks, projectPath, options);
      }

      // 如果 GuardCoordinator 也无法处理，使用最基本的行级分段
      const content = await fs.readFile(filePath, 'utf-8');
      const basicChunks = this.createBasicLineChunks(content, filePath);
      return await this.convertToVectorPoints(basicChunks, projectPath, options);
    } catch (error) {
      this.logger.warn(`GuardCoordinator fallback failed for ${filePath}, using basic line segmentation: ${error}`);

      // 最后的保障：基本行级分段
      const content = await fs.readFile(filePath, 'utf-8');
      const basicChunks = this.createBasicLineChunks(content, filePath);
      return await this.convertToVectorPoints(basicChunks, projectPath, options);
    }
  }

  /**
   * 创建基本的行级分段（最后的保障）
   */
  private createBasicLineChunks(content: string, filePath: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    const maxLinesPerChunk = 50; // 默认每块最大行数

    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, Math.min(i + maxLinesPerChunk, lines.length));
      const chunkContent = chunkLines.join('\n');

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: i + 1,
          endLine: Math.min(i + maxLinesPerChunk, lines.length),
          language: 'unknown',
          filePath: filePath,
          strategy: 'basic-line-fallback',
          complexity: 1,
          timestamp: Date.now(),
          type: 'generic' as any,
          size: chunkContent.length,
          lineCount: chunkLines.length
        }
      });
    }

    return chunks;
  }

  /**
   * 将代码块转换为向量点
   * 委托给 VectorEmbeddingService 和 VectorConversionService
   */
  private async convertToVectorPoints(chunks: CodeChunk[], projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    // 1. 生成嵌入向量
    const contents = chunks.map(chunk => chunk.content);
    const embeddings = await this.embeddingService.generateBatchEmbeddings(contents, {
      provider: this.projectEmbedders.get(projectPath),
      batchSize: options?.maxChunkSize
    });

    // 2. 转换为向量对象
    const vectors = await this.conversionService.convertChunksToVectors(chunks, embeddings, projectPath);

    // 3. 转换为向量点
    return vectors.map(vector => this.conversionService.convertVectorToPoint(vector));
  }

  setProjectEmbedder(projectId: string, embedder: string): void {
    this.projectEmbedders.set(projectId, embedder);
  }
}