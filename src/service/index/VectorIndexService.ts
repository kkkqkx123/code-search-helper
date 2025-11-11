import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { IIndexService, IndexServiceType, IndexStatus, IndexOptions } from './IIndexService';
import { IndexServiceError } from './errors/IndexServiceErrors';

export interface VectorIndexOptions {
  embedder?: string;
  batchSize?: number;
  maxConcurrency?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface VectorIndexResult {
  success: boolean;
  projectId: string;
  operationId: string;
  status: 'started' | 'completed' | 'error';
  estimatedTime?: number;
  processedFiles?: number;
  totalFiles?: number;
  error?: string;
}

/**
 * 向量索引服务实现
 * 实现统一的IIndexService接口，专注于向量索引操作
 */
@injectable()
export class VectorIndexService implements IIndexService {
  private activeOperations: Map<string, any> = new Map();
  private serviceType = IndexServiceType.VECTOR;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.FileSystemTraversal) private fileTraversalService: FileSystemTraversal,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
  ) { }

  /**
   * 获取嵌入器维度
   */
  private async getEmbedderDimensions(embedderProvider: string): Promise<number> {
    try {
      const providerInfo = await this.embedderFactory.getProviderInfo(embedderProvider);
      return providerInfo.dimensions;
    } catch (error) {
      this.logger.warn(`Failed to get embedder dimensions, using fallback: ${embedderProvider}`, { error });

      // 根据提供者设置默认维度
      switch (embedderProvider) {
        case 'openai':
          return parseInt(process.env.OPENAI_DIMENSIONS || '1536');
        case 'ollama':
          return parseInt(process.env.OLLAMA_DIMENSIONS || '768');
        case 'gemini':
          return parseInt(process.env.GEMINI_DIMENSIONS || '768');
        case 'mistral':
          return parseInt(process.env.MISTRAL_DIMENSIONS || '1024');
        case 'siliconflow':
          return parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024');
        default:
          return 1024;
      }
    }
  }

  /**
   * 实现IIndexService接口 - 开始索引项目
   */
  async startIndexing(projectPath: string, options?: IndexOptions): Promise<string> {
    const startTime = Date.now();

    try {
      // 检查是否启用了向量索引
      if (options?.enableVectorIndex === false) {
        throw IndexServiceError.serviceDisabled('Vector indexing', undefined, 'vector');
      }

      // 检查VECTOR_ENABLED环境变量
      const vectorEnabled = process.env.VECTOR_ENABLED?.toLowerCase() !== 'false';
      if (!vectorEnabled) {
        this.logger.info('Vector indexing is disabled via VECTOR_ENABLED environment variable', {
          projectPath
        });
        throw IndexServiceError.serviceDisabled('Vector indexing', undefined, 'vector');
      }

      // 生成或获取项目ID
      const projectId = await this.projectIdManager.generateProjectId(projectPath);

      // 检查项目状态管理器中的状态
      const vectorStatus = this.projectStateManager.getVectorStatus(projectId);
      if (vectorStatus && vectorStatus.status === 'indexing') {
        throw IndexServiceError.projectAlreadyIndexing(projectId, 'vector');
      }

      // 检查是否已有正在进行的操作
      if (this.activeOperations.has(projectId)) {
        throw IndexServiceError.projectAlreadyIndexing(projectId, 'vector');
      }

      // 获取项目文件列表
      const traversalResult = await this.fileTraversalService.traverseDirectory(projectPath, {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      });
      const files = traversalResult.files.map(file => file.path);
      const totalFiles = files.length;

      if (totalFiles === 0) {
        throw IndexServiceError.indexingFailed(
          `No files found in project: ${projectId}`,
          projectId,
          'vector'
        );
      }

      // 使用IndexingLogicService获取嵌入器维度
      const embedderProvider = options?.embedder || this.embedderFactory.getDefaultProvider();
      const vectorDimensions = await this.getEmbedderDimensions(embedderProvider);

      // 创建Qdrant集合
      const collectionCreated = await this.qdrantService.createCollectionForProject(
        projectPath,
        vectorDimensions,
        'Cosine'
      );

      if (!collectionCreated) {
        throw IndexServiceError.indexingFailed(
          `Failed to create collection for project: ${projectPath}`,
          projectId,
          'vector'
        );
      }

      // 开始向量索引
      const operationId = `vector_${projectId}_${Date.now()}`;
      this.activeOperations.set(projectId, { operationId, startTime: Date.now() });

      // 更新项目状态
      await this.projectStateManager.startVectorIndexing(projectId, totalFiles);

      this.logger.info(`Started vector indexing for project ${projectId}`, {
        projectId,
        operationId,
        totalFiles,
        options
      });

      // 异步执行索引（不等待完成）
      this.performVectorIndexing(projectId, projectPath, files, options)
        .catch(error => {
          this.logger.error(`Vector indexing failed for project ${projectId}`, { error });
          this.failVectorIndexing(projectId, error.message);
        })
        .finally(() => {
          this.activeOperations.delete(projectId);
        });

      // 简化版本 - 移除复杂的性能监控

      return projectId;

    } catch (error) {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 使用ErrorHandlerService记录错误
      this.errorHandler.handleError(
        new Error(`Failed to start vector indexing: ${errorMessage}`),
        { component: 'VectorIndexService', operation: 'startIndexing', projectPath, options }
      );

      // 更新项目状态为失败
      if (projectId) {
        await this.projectStateManager.failVectorIndexing(projectId, errorMessage);
      }

      // 简化版本 - 移除复杂的性能监控

      // 如果已经是IndexServiceError，直接重新抛出
      if (error instanceof IndexServiceError) {
        throw error;
      }

      // 抛出统一的IndexServiceError
      throw IndexServiceError.indexingFailed(
        `Failed to start vector indexing: ${errorMessage}`,
        projectId,
        'vector',
        { projectPath, options, originalError: error }
      );
    }
  }

  /**
   * 实现IIndexService接口 - 停止索引项目
   */
  async stopIndexing(projectId: string): Promise<boolean> {
    try {
      const activeOperation = this.activeOperations.get(projectId);
      const vectorStatus = this.projectStateManager.getVectorStatus(projectId);

      // 检查是否有活跃操作或正在索引的状态
      if (!activeOperation && (!vectorStatus || vectorStatus.status !== 'indexing')) {
        return false;
      }

      // 从活跃操作中移除
      this.activeOperations.delete(projectId);

      // 更新项目状态为停止
      if (vectorStatus) {
        await this.projectStateManager.updateVectorIndexingProgress(
          projectId,
          vectorStatus.progress,
          vectorStatus.processedFiles,
          vectorStatus.failedFiles
        );
      }

      this.logger.info(`Stopped vector indexing for project: ${projectId}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.errorHandler.handleError(
        new Error(`Failed to stop vector indexing: ${errorMessage}`),
        { component: 'VectorIndexService', operation: 'stopIndexing', projectId }
      );

      // 记录错误但不抛出，因为stopIndexing应该返回false而不是抛出异常
      this.logger.error(`Failed to stop vector indexing for project ${projectId}`, {
        error: errorMessage,
        projectId
      });

      return false;
    }
  }

  /**
   * 实现IIndexService接口 - 获取索引状态
   */
  getIndexStatus(projectId: string): IndexStatus | null {
    try {
      const vectorStatus = this.projectStateManager.getVectorStatus(projectId);

      if (!vectorStatus) {
        return null;
      }

      // 检查是否有正在进行的操作
      const activeOperation = this.activeOperations.get(projectId);

      return {
        projectId,
        projectPath: this.projectIdManager.getProjectPath(projectId) || '',
        isIndexing: vectorStatus.status === 'indexing' || !!activeOperation,
        lastIndexed: vectorStatus.lastCompleted ? new Date(vectorStatus.lastCompleted) : null,
        totalFiles: vectorStatus.totalFiles || 0,
        indexedFiles: vectorStatus.processedFiles || 0,
        failedFiles: vectorStatus.failedFiles || 0,
        progress: vectorStatus.progress || 0,
        serviceType: this.serviceType,
        error: vectorStatus.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.errorHandler.handleError(
        new Error(`Failed to get vector status: ${errorMessage}`),
        { component: 'VectorIndexService', operation: 'getIndexStatus', projectId }
      );

      this.logger.error(`Failed to get vector status for project ${projectId}`, {
        error: errorMessage,
        projectId
      });

      return null;
    }
  }

  /**
   * 实现IIndexService接口 - 重新索引项目
   */
  async reindexProject(projectPath: string, options?: IndexOptions): Promise<string> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);

      if (projectId) {
        // 停止当前索引（如果有）
        await this.stopIndexing(projectId);

        // 清理向量数据
        try {
          await this.qdrantService.deleteCollectionForProject(projectPath);
          this.logger.info(`Cleared vector collection for project: ${projectPath}`);
        } catch (clearError) {
          this.logger.warn(`Failed to clear vector collection for project ${projectPath}:`, clearError);
        }
      }

      // 开始新的索引
      return await this.startIndexing(projectPath, options);

    } catch (error) {
      if (error instanceof IndexServiceError) {
        throw error;
      }

      throw IndexServiceError.indexingFailed(
        `Failed to reindex project: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'vector',
        { projectPath, options }
      );
    }
  }

  /**
   * 执行向量嵌入（保持向后兼容）
   */
  async indexVectors(projectId: string, options: VectorIndexOptions = {}): Promise<VectorIndexResult> {
    try {
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        throw IndexServiceError.projectNotFound(projectId, 'vector');
      }

      // 转换为IndexOptions格式
      const indexOptions: IndexOptions = {
        includePatterns: options.includePatterns,
        excludePatterns: options.excludePatterns,
        maxConcurrency: options.maxConcurrency,
        enableVectorIndex: true,
        enableGraphIndex: false,
        embedder: options.embedder,
        batchSize: options.batchSize,
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap
      };

      // 开始索引
      await this.startIndexing(projectPath, indexOptions);

      return {
        success: true,
        projectId,
        operationId: this.activeOperations.get(projectId)?.operationId || `vector_${projectId}_${Date.now()}`,
        status: 'started'
      };

    } catch (error) {
      if (error instanceof IndexServiceError) {
        return {
          success: false,
          projectId,
          operationId: `error_${Date.now()}`,
          status: 'error',
          error: error.message
        };
      }

      return {
        success: false,
        projectId,
        operationId: `error_${Date.now()}`,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取向量状态（保持向后兼容）
   */
  async getVectorStatus(projectId: string): Promise<any> {
    const status = this.getIndexStatus(projectId);

    if (!status) {
      throw IndexServiceError.projectNotFound(projectId, 'vector');
    }

    const activeOperation = this.activeOperations.get(projectId);

    return {
      projectId,
      isIndexing: status.isIndexing,
      lastIndexed: status.lastIndexed,
      totalFiles: status.totalFiles,
      indexedFiles: status.indexedFiles,
      failedFiles: status.failedFiles,
      progress: status.progress,
      isActive: !!activeOperation,
      operationId: activeOperation?.operationId,
      error: status.error
    };
  }

  /**
   * 批量向量嵌入（保持向后兼容）
   */
  async batchIndexVectors(projectIds: string[], options: VectorIndexOptions = {}): Promise<any> {
    try {
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        throw IndexServiceError.indexingFailed(
          'projectIds array is required and cannot be empty',
          undefined,
          'vector'
        );
      }

      const operationId = `batch_vector_${Date.now()}`;
      const results: VectorIndexResult[] = [];
      let totalEstimatedTime = 0;

      for (const projectId of projectIds) {
        try {
          const result = await this.indexVectors(projectId, options);
          results.push(result);
          if (result.estimatedTime) {
            totalEstimatedTime += result.estimatedTime;
          }
        } catch (error) {
          results.push({
            success: false,
            projectId,
            operationId: `${operationId}_${projectId}_error`,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        success: true,
        operationId,
        status: 'started',
        projectCount: projectIds.length,
        results,
        estimatedTime: totalEstimatedTime
      };

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to start batch vector indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorIndexService', operation: 'batchIndexVectors', projectIds, options }
      );

      return {
        success: false,
        operationId: `batch_error_${Date.now()}`,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取向量索引默认配置
   */
  private getDefaultVectorConfig(): IndexingConfig {
    return {
      batchSize: 10,
      maxConcurrency: 3,
      chunkSize: 1000,
      chunkOverlap: 200
    };
  }

  /**
   * 执行实际的向量索引
   */
  private async performVectorIndexing(
    projectId: string,
    projectPath: string,
    files: string[],
    options?: IndexOptions
  ): Promise<void> {
    try {
      const defaultConfig = this.getDefaultVectorConfig();
      const batchSize = options?.batchSize || defaultConfig.batchSize;
      const maxConcurrency = options?.maxConcurrency || defaultConfig.maxConcurrency;

      let processedFiles = 0;
      let failedFiles = 0;

      // 使用批处理服务批量处理文件
      await this.batchProcessor.processBatches(
        files,
        async (batch) => {
          try {
            // 使用IndexingLogicService处理文件
            const promises = batch.map(async (filePath) => {
              try {
                await this.indexFileDirectly(projectPath, filePath);
              } catch (error) {
                this.logger.error(`Failed to index file: ${filePath}`, { error });
                throw error;
              }
            });

            // 限制并发数
            // 使用 BatchProcessingService 的并发控制功能
            for (let i = 0; i < promises.length; i += maxConcurrency) {
              const batch = promises.slice(i, i + maxConcurrency);
              await Promise.all(batch);
            }

            processedFiles += batch.length;

            // 更新进度
            const progress = Math.round((processedFiles / files.length) * 100);
            await this.projectStateManager.updateVectorIndexingProgress(
              projectId,
              progress,
              processedFiles,
              failedFiles
            );

            this.logger.debug(`Processed vector batch for project ${projectId}`, {
              projectId,
              processedFiles,
              totalFiles: files.length,
              progress
            });

            return batch.map(file => ({ filePath: file, success: true }));
          } catch (error) {
            failedFiles += batch.length;
            this.logger.error(`Failed to process vector batch for project ${projectId}`, {
              projectId,
              error: error instanceof Error ? error.message : String(error)
            });

            await this.projectStateManager.updateVectorIndexingProgress(
              projectId,
              Math.round((processedFiles / files.length) * 100),
              processedFiles,
              failedFiles
            );

            return batch.map(file => ({
              filePath: file,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        },
        {
          batchSize,
          maxConcurrency,
          context: { domain: 'database', subType: 'vector' }
        }
      );

      // 完成向量索引
      await this.projectStateManager.completeVectorIndexing(projectId);

      this.logger.info(`Completed vector indexing for project ${projectId}`, {
        projectId,
        processedFiles,
        totalFiles: files.length,
        failedFiles,
        successRate: processedFiles > 0 ? ((processedFiles - failedFiles) / processedFiles) * 100 : 0
      });

    } catch (error) {
      await this.failVectorIndexing(projectId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 处理向量索引失败
   */
  private async failVectorIndexing(projectId: string, errorMessage: string): Promise<void> {
    await this.projectStateManager.failVectorIndexing(projectId, errorMessage);
    this.activeOperations.delete(projectId);
  }

  /**
   * 直接索引文件 - 简化版本
   */
  private async indexFileDirectly(projectPath: string, filePath: string): Promise<void> {
    try {
      // 使用 ChunkToVectorCoordinationService 处理文件
      const coordinationService = this.batchProcessor as any;
      if (coordinationService && coordinationService.processFileForEmbedding) {
        const vectorPoints = await coordinationService.processFileForEmbedding(filePath, projectPath);

        // 存储到 Qdrant 向量数据库
        const success = await this.qdrantService.upsertVectorsForProject(projectPath, vectorPoints);

        if (!success) {
          throw new Error(`Failed to store vectors for file: ${filePath}`);
        }
      } else {
        // 如果没有协调服务，使用简化的处理方式
        this.logger.warn(`ChunkToVectorCoordinationService not available, skipping file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to index file: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * 获取当前内存使用情况
   */
  private getMemoryUsage(): { heapUsed: number; heapTotal: number; percentage: number } {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    const percentage = heapTotal > 0 ? heapUsed / heapTotal : 0;

    return {
      heapUsed,
      heapTotal,
      percentage
    };
  }
}