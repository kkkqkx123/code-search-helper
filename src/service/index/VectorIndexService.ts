import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { IndexService } from './IndexService';
import { FileTraversalService } from './shared/FileTraversalService';
import { ConcurrencyService } from './shared/ConcurrencyService';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface VectorIndexOptions {
  embedder?: string;
  batchSize?: number;
  maxConcurrency?: number;
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

@injectable()
export class VectorIndexService {
  private activeOperations: Map<string, any> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.FileTraversalService) private fileTraversalService: FileTraversalService,
    @inject(TYPES.ConcurrencyService) private concurrencyService: ConcurrencyService
  ) {}

  /**
   * 执行向量嵌入
   */
  async indexVectors(projectId: string, options: VectorIndexOptions = {}): Promise<VectorIndexResult> {
    try {
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // 检查是否已有正在进行的操作
      if (this.activeOperations.has(projectId)) {
        throw new Error(`Vector indexing already in progress for project: ${projectId}`);
      }

      // 获取项目文件列表
      const files = await this.fileTraversalService.getProjectFiles(projectPath);
      const totalFiles = files.length;

      if (totalFiles === 0) {
        throw new Error(`No files found in project: ${projectId}`);
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

      return {
        success: true,
        projectId,
        operationId,
        status: 'started',
        estimatedTime: Math.ceil(totalFiles / 10) * 1000, // 估算时间
        totalFiles
      };

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to start vector indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorIndexService', operation: 'indexVectors', projectId, options }
      );

      await this.projectStateManager.failVectorIndexing(projectId, error instanceof Error ? error.message : String(error));

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
   * 获取向量状态
   */
  async getVectorStatus(projectId: string): Promise<any> {
    try {
      const vectorStatus = this.projectStateManager.getVectorStatus(projectId);
      
      if (!vectorStatus) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // 检查是否有正在进行的操作
      const activeOperation = this.activeOperations.get(projectId);
      
      return {
        projectId,
        ...vectorStatus,
        isActive: !!activeOperation,
        operationId: activeOperation?.operationId
      };

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get vector status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorIndexService', operation: 'getVectorStatus', projectId }
      );
      throw error;
    }
  }

  /**
   * 批量向量嵌入
   */
  async batchIndexVectors(projectIds: string[], options: VectorIndexOptions = {}): Promise<any> {
    try {
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        throw new Error('projectIds array is required and cannot be empty');
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
   * 执行实际的向量索引
   */
  private async performVectorIndexing(
    projectId: string,
    projectPath: string,
    files: string[],
    options: VectorIndexOptions
  ): Promise<void> {
    try {
      const batchSize = options.batchSize || 10;
      const maxConcurrency = options.maxConcurrency || 3;
      
      let processedFiles = 0;
      let failedFiles = 0;

      // 分批处理文件
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
          try {
            // 使用现有的IndexService处理文件
            // 由于indexFile是私有方法，我们需要使用startIndexing
            // 但为了简化，我们直接处理文件
            for (const filePath of batch) {
              try {
                // 直接使用indexingLogicService处理文件
                await this.indexService['indexingLogicService'].indexFile(projectPath, filePath);
              } catch (error) {
                this.logger.error(`Failed to index file: ${filePath}`, { error });
                throw error;
              }
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
            batch: Math.floor(i / batchSize) + 1,
            processedFiles,
            totalFiles: files.length,
            progress
          });

        } catch (error) {
          failedFiles += batch.length;
          this.logger.error(`Failed to process vector batch for project ${projectId}`, {
            projectId,
            batch: Math.floor(i / batchSize) + 1,
            error: error instanceof Error ? error.message : String(error)
          });

          await this.projectStateManager.updateVectorIndexingProgress(
            projectId,
            Math.round((processedFiles / files.length) * 100),
            processedFiles,
            failedFiles
          );
        }

        // 限制并发数，添加延迟
        if ((i / batchSize) % maxConcurrency === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 完成向量索引
      await this.projectStateManager.completeVectorIndexing(projectId);
      
      this.logger.info(`Completed vector indexing for project ${projectId}`, {
        projectId,
        processedFiles,
        totalFiles: files.length,
        failedFiles,
        successRate: ((processedFiles - failedFiles) / processedFiles) * 100
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
}