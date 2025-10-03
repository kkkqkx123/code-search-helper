import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { EmbeddingInput } from '../../embedders/BaseEmbedder';
// Tree-sitter AST分段支持
import { ASTCodeSplitter } from '../parser/splitting/ASTCodeSplitter';
import { CodeChunk } from '../parser/splitting/Splitter';
import { ChunkToVectorCoordinationService } from '../parser/ChunkToVectorCoordinationService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IndexSyncOptions } from './IndexService';

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

export interface IndexingMetrics {
  fileSize: number;
  chunkCount: number;
  processingTime: number;
  memoryUsage: MemoryUsage;
  embeddingTime?: number;
}

@injectable()
export class IndexingLogicService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.FileSystemTraversal) private fileSystemTraversal: FileSystemTraversal,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCacheService: EmbeddingCacheService,
    @inject(TYPES.PerformanceOptimizerService) private performanceOptimizer: PerformanceOptimizerService,
    @inject(TYPES.ASTCodeSplitter) private astSplitter: ASTCodeSplitter,
    @inject(TYPES.ChunkToVectorCoordinationService) private coordinationService: ChunkToVectorCoordinationService
  ) { }

  /**
   * 索引项目
   */
  async indexProject(
    projectPath: string,
    options?: IndexSyncOptions,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      this.logger.debug(`[DEBUG] Starting file traversal for project: ${projectPath}`, { projectPath });

      // 获取项目中的所有文件
      const traversalResult = await this.performanceOptimizer.executeWithRetry(
        () => this.fileSystemTraversal.traverseDirectory(projectPath, {
          includePatterns: options?.includePatterns,
          excludePatterns: options?.excludePatterns
        }),
        'traverseDirectory'
      );

      const files = traversalResult.files;
      const totalFiles = files.length;
      this.logger.info(`Found ${files.length} files to index in project: ${projectPath}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectPath}`, {
        filesFound: files.length
      });

      // 处理每个文件
      const batchSize = options?.batchSize || this.performanceOptimizer.getCurrentBatchSize();
      const maxConcurrency = options?.maxConcurrency || 3;

      // 使用性能优化器批量处理文件
      await this.performanceOptimizer.processBatches(
        files,
        async (batch) => {
          const promises = batch.map(async (file) => {
            try {
              await this.performanceOptimizer.executeWithRetry(
                () => this.indexFile(projectPath, file.path),
                `indexFile:${file.path}`
              );
            } catch (error) {
              this.logger.error(`Failed to index file: ${file.path}`, { error });
            }
          });

          // 限制并发数
          await this.processWithConcurrency(promises, maxConcurrency);

          // 调用进度回调
          if (onProgress) {
            const progress = Math.round((batch.length / totalFiles) * 100);
            onProgress(progress);
          }

          // 返回空数组以满足processBatches的返回类型要求
          return [];
        },
        'indexProjectFiles'
      );

      this.logger.info(`Completed indexing project: ${projectPath}`, {
        totalFiles: totalFiles
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to index project: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'indexProject', projectPath }
      );
      throw error;
    }
  }

  /**
   * 获取嵌入器维度
   */
  async getEmbedderDimensions(embedderProvider: string): Promise<number> {
    let vectorDimensions = 1024; // 默认回退到SiliconFlow的1024维度

    try {
      // 尝试从嵌入器实例获取实际维度，这会验证提供者是否可用
      const providerInfo = await this.embedderFactory.getProviderInfo(embedderProvider);
      vectorDimensions = providerInfo.dimensions;
      this.logger.info(`Using embedder dimensions: ${vectorDimensions} for provider: ${providerInfo.name}`);
    } catch (error) {
      // 如果无法获取提供者信息，根据提供者类型使用环境变量中的默认值
      this.logger.warn(`Failed to get embedder dimensions from provider, falling back to env config: ${embedderProvider}`, { error });

      // 根据提供者设置默认维度
      switch (embedderProvider) {
        case 'openai':
          vectorDimensions = parseInt(process.env.OPENAI_DIMENSIONS || '1536');
          break;
        case 'ollama':
          vectorDimensions = parseInt(process.env.OLLAMA_DIMENSIONS || '768');
          break;
        case 'gemini':
          vectorDimensions = parseInt(process.env.GEMINI_DIMENSIONS || '768');
          break;
        case 'mistral':
          vectorDimensions = parseInt(process.env.MISTRAL_DIMENSIONS || '1024');
          break;
        case 'siliconflow':
          vectorDimensions = parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024');
          break;
        case 'custom1':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM1_DIMENSIONS || '768');
          break;
        case 'custom2':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM2_DIMENSIONS || '768');
          break;
        case 'custom3':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM3_DIMENSIONS || '768');
          break;
        default:
          vectorDimensions = 1024; // 默认值
      }
    }

    return vectorDimensions;
  }

  /**
   * 索引单个文件（增强版，带性能监控）
   */
  async indexFile(projectPath: string, filePath: string): Promise<void> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      // 使用协调服务处理文件
      const vectorPoints = await this.coordinationService.processFileForEmbedding(filePath, projectPath);

      // 存储到Qdrant
      const success = await this.qdrantService.upsertVectorsForProject(projectPath, vectorPoints);

      if (!success) {
        throw new Error(`Failed to upsert vectors for file: ${filePath}`);
      }

      const processingTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();

      // 记录性能指标
      const metrics: IndexingMetrics = {
        fileSize: (await fs.stat(filePath)).size,
        chunkCount: vectorPoints.length,
        processingTime,
        memoryUsage: {
          used: finalMemory.heapUsed - initialMemory.heapUsed,
          total: finalMemory.heapTotal,
          percentage: ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapTotal) * 100,
          timestamp: new Date()
        }
      };

      this.recordMetrics(filePath, metrics);

      // 内存警告检查
      if (metrics.memoryUsage.percentage > 80) {
        this.logger.warn(`High memory usage detected for file: ${filePath}`, {
          memoryUsage: metrics.memoryUsage,
          threshold: 80
        });
      }

      this.logger.debug(`Indexed file: ${filePath}`, { metrics });
    } catch (error) {
      this.recordError(filePath, error);
      this.errorHandler.handleError(
        new Error(`Failed to index file: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'indexFile', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 从索引中删除文件
   */
  async removeFileFromIndex(projectPath: string, filePath: string): Promise<void> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project ID not found for path: ${projectPath}`);
      }

      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectId}`);
      }

      // 获取文件的所有块ID
      const chunkIds = await this.qdrantService.getChunkIdsByFiles(collectionName, [filePath]);

      if (chunkIds.length > 0) {
        // 删除这些块
        const success = await this.qdrantService.deletePoints(collectionName, chunkIds);

        if (!success) {
          throw new Error(`Failed to delete chunks for file: ${filePath}`);
        }

        this.logger.debug(`Removed file from index: ${filePath}`, { chunks: chunkIds.length });
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to remove file from index: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'removeFileFromIndex', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 记录性能指标
   */
  async recordMetrics(filePath: string, metrics: IndexingMetrics): Promise<void> {
    this.logger.debug(`Indexing metrics for ${filePath}:`, { metrics });
  }

  /**
   * 记录错误信息
   */
  recordError(filePath: string, error: any): void {
    this.logger.error(`Indexing error for ${filePath}:`, { error });
  }

  /**
   * 并发处理任务
   */
  private async processWithConcurrency<T>(promises: Promise<T>[], maxConcurrency: number): Promise<void> {
    const results: Promise<T>[] = [];
    const executing: Set<Promise<T>> = new Set();

    for (const promise of promises) {
      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }

      const p = promise.then(result => {
        executing.delete(p);
        return result;
      });

      executing.add(p);
      results.push(p);
    }

    await Promise.all(results);
  }
}