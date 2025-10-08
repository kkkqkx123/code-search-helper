import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileSystemTraversal, FileInfo } from '../filesystem/FileSystemTraversal';
import { FileWatcherService } from '../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../filesystem/ChangeDetectionService';
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
import { IndexingLogicService } from './IndexingLogicService';
import { NebulaService } from '../../database/nebula/NebulaService';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IndexSyncOptions {
  embedder?: string;
  batchSize?: number;
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IndexSyncStatus {
  projectId: string;
  projectPath: string;
  isIndexing: boolean;
  lastIndexed: Date | null;
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
  progress: number;
}

export interface FileChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  functionName?: string;
  className?: string;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

export interface BatchProcessingResult {
  filePath: string;
  success: boolean;
  processingTime?: number;
  chunkCount?: number;
  error: string | undefined;
}

export interface IndexingMetrics {
  fileSize: number;
  chunkCount: number;
  processingTime: number;
  memoryUsage: MemoryUsage;
  embeddingTime?: number;
}

@injectable()
export class IndexService {
  private eventListeners: Map<string, Array<(...args: any[]) => Promise<void>>> = new Map();

  on(event: 'indexingStarted', listener: (projectId: string) => Promise<void>): void;
  on(event: 'indexingProgress', listener: (projectId: string, progress: number) => Promise<void>): void;
  on(event: 'indexingCompleted', listener: (projectId: string) => Promise<void>): void;
  on(event: 'indexingError', listener: (projectId: string, error: Error) => Promise<void>): void;
  on(event: 'indexingMetrics', listener: (projectId: string, filePath: string, metrics: IndexingMetrics) => Promise<void>): void;
  on(event: 'memoryWarning', listener: (projectId: string, memoryUsage: MemoryUsage, threshold: number) => Promise<void>): void;
  on(event: string, listener: (...args: any[]) => Promise<void>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  private async emit(event: 'indexingStarted', projectId: string): Promise<void>;
  private async emit(event: 'indexingProgress', projectId: string, progress: number): Promise<void>;
  private async emit(event: 'indexingCompleted', projectId: string): Promise<void>;
  private async emit(event: 'indexingError', projectId: string, error: Error): Promise<void>;
  private async emit(event: 'indexingMetrics', projectId: string, filePath: string, metrics: IndexingMetrics): Promise<void>;
  private async emit(event: 'memoryWarning', projectId: string, memoryUsage: MemoryUsage, threshold: number): Promise<void>;
  private async emit(event: string, ...args: any[]): Promise<void> {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(...args);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, { error });
        }
      }
    }
  }
  private indexingProjects: Map<string, IndexSyncStatus> = new Map();
  private completedProjects: Map<string, IndexSyncStatus> = new Map(); // 存储已完成的项目状态
  private indexingQueue: Array<{ projectPath: string; options?: IndexSyncOptions }> = [];
  private isProcessingQueue: boolean = false;
  private projectEmbedders: Map<string, string> = new Map(); // 存储项目对应的embedder

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.FileSystemTraversal) private fileSystemTraversal: FileSystemTraversal,
    @inject(TYPES.FileWatcherService) private fileWatcherService: FileWatcherService,
    @inject(TYPES.ChangeDetectionService) private changeDetectionService: ChangeDetectionService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.NebulaService) private nebulaService: NebulaService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCacheService: EmbeddingCacheService,
    @inject(TYPES.PerformanceOptimizerService) private performanceOptimizer: PerformanceOptimizerService,
    @inject(TYPES.ASTCodeSplitter) private astSplitter: ASTCodeSplitter,
    @inject(TYPES.ChunkToVectorCoordinationService) private coordinationService: ChunkToVectorCoordinationService,
    @inject(TYPES.IndexingLogicService) private indexingLogicService: IndexingLogicService
  ) {
    // 设置文件变化监听器
    this.setupFileChangeListeners();
  }

  /**
   * 设置文件变化监听器
   */
  private setupFileChangeListeners(): void {
    this.fileWatcherService.setCallbacks({
      onFileAdded: async (fileInfo) => {
        await this.handleFileChange(fileInfo.path, this.getProjectPathFromFileInfo(fileInfo), 'added');
      },
      onFileChanged: async (fileInfo) => {
        await this.handleFileChange(fileInfo.path, this.getProjectPathFromFileInfo(fileInfo), 'modified');
      },
      onFileDeleted: async (filePath) => {
        await this.handleFileChange(filePath, this.getProjectPathFromFilePath(filePath), 'deleted');
      }
    });
  }

  /**
   * 从文件信息获取项目路径
   */
  private getProjectPathFromFileInfo(fileInfo: any): string {
    // 简化实现，实际应该根据文件路径确定项目路径
    const pathParts = fileInfo.path.split(path.sep);
    // 假设项目路径是文件路径的父目录的父目录
    return pathParts.slice(0, -2).join(path.sep);
  }

  /**
   * 从文件路径获取项目路径
   */
  private getProjectPathFromFilePath(filePath: string): string {
    // 简化实现，实际应该根据文件路径确定项目路径
    const pathParts = filePath.split(path.sep);
    // 假设项目路径是文件路径的父目录的父目录
    return pathParts.slice(0, -2).join(path.sep);
  }

  /**
   * 处理文件变化
   */
  private async handleFileChange(filePath: string, projectPath: string, changeType: 'added' | 'modified' | 'deleted'): Promise<void> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        this.logger.warn(`Project ID not found for path: ${projectPath}`);
        return;
      }

      if (changeType === 'deleted') {
        // 从索引中删除文件
        await this.removeFileFromIndex(projectPath, filePath);
      } else {
        // 重新索引文件
        await this.indexFile(projectPath, filePath);
      }

      // 更新项目时间戳
      this.projectIdManager.updateProjectTimestamp(projectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to handle file change: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'handleFileChange', filePath, projectPath, changeType }
      );
    }
  }

  /**
   * 开始索引项目
   */
  async startIndexing(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    try {
      // 生成或获取项目ID
      const projectId = await this.projectIdManager.generateProjectId(projectPath);

      // 检查是否正在索引
      const currentStatus = this.indexingProjects.get(projectId);
      if (currentStatus && currentStatus.isIndexing) {
        throw new Error(`项目 ${projectPath} 正在索引中，请等待完成或停止当前索引`);
      }

      // 检查已完成的项目状态
      const completedStatus = this.completedProjects.get(projectId);
      if (completedStatus) {
        // 如果项目已完成索引，说明是重新索引，删除现有集合
        this.logger.info(`项目 ${projectPath} 已存在，将重新索引`);
        await this.qdrantService.deleteCollectionForProject(projectPath);
        // 从已完成项目中移除
        this.completedProjects.delete(projectId);
      }

      // 使用IndexingLogicService获取嵌入器维度
      // 优先使用options中指定的embedder，如果没有指定则使用默认的embedder
      const embedderProvider = options?.embedder || this.embedderFactory.getDefaultProvider();
      const vectorDimensions = await this.indexingLogicService.getEmbedderDimensions(embedderProvider);

      // 创建集合
      const collectionCreated = await this.qdrantService.createCollectionForProject(
        projectPath,
        vectorDimensions,
        'Cosine'
      );

      if (!collectionCreated) {
        throw new Error(`Failed to create collection for project: ${projectPath}`);
      }


      // 初始化索引状态
      const status: IndexSyncStatus = {
        projectId,
        projectPath,
        isIndexing: true,
        lastIndexed: null,
        totalFiles: 0,
        indexedFiles: 0,
        failedFiles: 0,
        progress: 0
      };

      this.indexingProjects.set(projectId, status);

      // 存储项目对应的embedder
      if (options?.embedder) {
        this.projectEmbedders.set(projectId, options.embedder);
        // 同时设置协调服务的项目嵌入器
        this.coordinationService.setProjectEmbedder(projectId, options.embedder);
      }

      // 添加到索引队列
      this.indexingQueue.push({ projectPath, options });

      // 处理队列
      if (!this.isProcessingQueue) {
        this.processIndexingQueue();
      }

      // 触发索引开始事件
      await this.emit('indexingStarted', projectId);

      // 保存项目映射到持久化存储
      await this.projectIdManager.saveMapping();

      this.logger.info(`Started indexing project: ${projectId}`, { projectPath, options });
      return projectId;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to start indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'startIndexing', projectPath, options }
      );
      throw error;
    }
  }

  /**
   * 处理索引队列
   */
  private async processIndexingQueue(): Promise<void> {
    if (this.isProcessingQueue || this.indexingQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.indexingQueue.length > 0) {
        const { projectPath, options } = this.indexingQueue.shift()!;
        await this.indexProject(projectPath, options);
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Error processing indexing queue: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'processIndexingQueue' }
      );
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 索引项目
   */
  private async indexProject(projectPath: string, options?: IndexSyncOptions): Promise<void> {
    const projectId = this.projectIdManager.getProjectId(projectPath);
    if (!projectId) {
      throw new Error(`Project ID not found for path: ${projectPath}`);
    }

    const status = this.indexingProjects.get(projectId);
    if (!status) {
      throw new Error(`Indexing status not found for project: ${projectId}`);
    }

    try {
      this.logger.debug(`[DEBUG] Starting file traversal for project: ${projectId}`, { projectPath });

      // 获取项目中的所有文件
      const traversalResult = await this.performanceOptimizer.executeWithRetry(
        () => this.fileSystemTraversal.traverseDirectory(projectPath, {
          includePatterns: options?.includePatterns,
          excludePatterns: options?.excludePatterns
        }),
        'traverseDirectory'
      );

      const files = traversalResult.files;
      status.totalFiles = files.length;
      this.logger.info(`Found ${files.length} files to index in project: ${projectId}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectId}`, {
        filesFound: files.length
      });

      // 处理每个文件
      const batchSize = options?.batchSize || this.performanceOptimizer.getCurrentBatchSize();
      const maxConcurrency = options?.maxConcurrency || 3;

      // 使用性能优化器批量处理文件
      const batchResults = await this.performanceOptimizer.processBatches(
        files,
        async (batch) => {
          // 内存检查 - 批次开始时检查内存
          const memoryBefore = process.memoryUsage();
          const memoryUsagePercent = memoryBefore.heapUsed / memoryBefore.heapTotal;

          if (memoryUsagePercent > 0.80) {
            this.logger.warn(`High memory usage detected before batch processing for project ${projectId}`, {
              memoryUsage: memoryBefore,
              memoryUsagePercent: memoryUsagePercent * 100,
              batchSize: batch.length
            });

            // 强制垃圾回收
            if (global.gc) {
              global.gc();
            }

            // 如果内存仍然过高，记录警告但不跳过处理
            const memoryAfterGC = process.memoryUsage();
            if (memoryAfterGC.heapUsed / memoryAfterGC.heapTotal > 0.85) {
              this.logger.debug(`Memory still high after GC for project ${projectId}`, {
                memoryAfterGC,
                batchSize: batch.length
              });
            }
          }

          const results: BatchProcessingResult[] = [];
          const promises = batch.map(async (file) => {
            const startTime = Date.now();
            try {
              await this.performanceOptimizer.executeWithRetry(
                () => this.indexFile(projectPath, file.path),
                `indexFile:${file.path}`
              );
              status.indexedFiles++;
              
              // 记录成功结果
              results.push({
                filePath: file.path,
                success: true,
                processingTime: Date.now() - startTime,
                error: undefined
              });
            } catch (error) {
              status.failedFiles++;
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to index file: ${file.path}`, { error });

              // 如果是内存相关错误，记录额外信息
              if (error instanceof Error && error.message.includes('memory')) {
                this.logger.warn(`Memory-related error while indexing file: ${file.path}`, {
                  memoryUsage: process.memoryUsage(),
                  error: error.message
                });
              }
              
              // 记录失败结果
              results.push({
                filePath: file.path,
                success: false,
                error: errorMessage,
                processingTime: Date.now() - startTime
              });
            }
          });

          // 限制并发数
          await this.processWithConcurrency(promises, maxConcurrency);

          // 批次完成后的内存清理
          const memoryAfterBatch = process.memoryUsage();
          if (memoryAfterBatch.heapUsed / memoryAfterBatch.heapTotal > 0.75) {
            // 批次完成后触发垃圾回收
            if (global.gc) {
              global.gc();
            }
          }

          // 更新进度
          status.progress = Math.round((status.indexedFiles + status.failedFiles) / status.totalFiles * 100);
          // 触发索引进度更新事件
          await this.emit('indexingProgress', projectId, status.progress);
          this.logger.debug(`Indexing progress for project ${projectId}: ${status.progress}%`);

          // 返回批处理结果以满足processBatches的返回类型要求
          return results;
        },
        'indexProjectFiles'
      );

      // 完成索引
      status.isIndexing = false;
      status.lastIndexed = new Date();
      this.indexingProjects.delete(projectId); // 从正在进行的索引中移除
      this.completedProjects.set(projectId, status); // 添加到已完成的索引中

      // 保存项目映射到持久化存储
      await this.projectIdManager.saveMapping();

      // 触发索引完成事件
      await this.emit('indexingCompleted', projectId);

      this.logger.info(`Completed indexing project: ${projectId}`, {
        totalFiles: status.totalFiles,
        indexedFiles: status.indexedFiles,
        failedFiles: status.failedFiles,
        progress: status.progress
      });
    } catch (error) {
      try {
        status.isIndexing = false;
        this.indexingProjects.delete(projectId); // 从正在进行的索引中移除
        this.completedProjects.set(projectId, status); // 添加到已完成的索引中（即使失败）

        this.errorHandler.handleError(
          new Error(`Failed to index project: ${error instanceof Error ? error.message : String(error)}`),
          { component: 'IndexSyncService', operation: 'indexProject', projectPath, projectId }
        );
        // 触发索引错误事件
        await this.emit('indexingError', projectId, error instanceof Error ? error : new Error(String(error)));
      } catch (emitError) {
        // 即使触发错误事件失败，也要记录日志
        this.logger.error('Failed to emit indexingError event', { projectId, error: emitError });
      }
      throw error;
    }
  }

  /**
   * 索引单个文件（增强版，带性能监控）
   */
  private async indexFile(projectPath: string, filePath: string): Promise<void> {
    try {
      await this.indexingLogicService.indexFile(projectPath, filePath);
    } catch (error) {
      this.recordError(filePath, error);
      this.errorHandler.handleError(
        new Error(`Failed to index file: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'indexFile', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 记录错误信息
   */
  private recordError(filePath: string, error: any): void {
    this.logger.error(`Indexing error for ${filePath}:`, { error });
  }

  /**
   * 从索引中删除文件
   */
  private async removeFileFromIndex(projectPath: string, filePath: string): Promise<void> {
    try {
      await this.indexingLogicService.removeFileFromIndex(projectPath, filePath);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to remove file from index: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'removeFileFromIndex', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 记录性能指标并触发事件
   */
  private async recordMetrics(projectPath: string, filePath: string, metrics: IndexingMetrics): Promise<void> {
    const projectId = this.projectIdManager.getProjectId(projectPath);
    if (projectId) {
      await this.emit('indexingMetrics', projectId, filePath, metrics);
    }
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

  /**
   * 获取索引状态
   */
  getIndexStatus(projectId: string): IndexSyncStatus | null {
    // 首先检查正在进行索引的项目
    const indexingStatus = this.indexingProjects.get(projectId);
    if (indexingStatus) {
      return indexingStatus;
    }

    // 然后检查已完成索引的项目
    const completedStatus = this.completedProjects.get(projectId);
    if (completedStatus) {
      return completedStatus;
    }

    return null;
  }

  /**
   * 获取所有索引状态
   */
  getAllIndexStatuses(): IndexSyncStatus[] {
    return Array.from(this.indexingProjects.values());
  }

  /**
   * 停止索引项目
   */
  async stopIndexing(projectId: string): Promise<boolean> {
    try {
      const status = this.indexingProjects.get(projectId);
      if (!status) {
        return false;
      }

      // 从队列中移除
      this.indexingQueue = this.indexingQueue.filter(item => {
        const itemProjectId = this.projectIdManager.getProjectId(item.projectPath);
        return itemProjectId !== projectId;
      });

      // 更新状态
      status.isIndexing = false;
      this.indexingProjects.set(projectId, status);

      // 清理IndexingLogicService中的未完成定时器
      try {
        await this.indexingLogicService.cleanup();
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup IndexingLogicService timers: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }

      this.logger.info(`Stopped indexing project: ${projectId}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to stop indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexSyncService', operation: 'stopIndexing', projectId }
      );
      return false;
    }
  }

  /**
   * 重新索引项目
   */
  async reindexProject(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      if (projectId) {
        this.logger.info(`重新索引项目: ${projectPath}`);

        // 检查是否正在索引
        const currentStatus = this.indexingProjects.get(projectId);
        if (currentStatus && currentStatus.isIndexing) {
          throw new Error(`项目 ${projectPath} 正在索引中，请等待完成或停止当前索引`);
        }

        // 无论项目状态如何，总是尝试删除现有集合和清理状态
        try {
          // 尝试删除现有集合（如果存在）
          await this.qdrantService.deleteCollectionForProject(projectPath);
          this.logger.info(`已删除项目集合: ${projectPath}`);
        } catch (deleteError) {
          // 如果集合不存在或删除失败，记录警告但继续执行
          this.logger.warn(`删除项目集合时出现问题（这可能是正常的）: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
        }
 
        // 删除Nebula Graph空间（如果存在）
        try {
          await this.nebulaService.deleteSpaceForProject(projectPath);
          this.logger.info(`已删除项目Nebula空间: ${projectPath}`);
        } catch (deleteSpaceError) {
          // 如果空间不存在或删除失败，记录警告但继续执行
          this.logger.warn(`删除项目Nebula空间时出现问题（这可能是正常的）: ${deleteSpaceError instanceof Error ? deleteSpaceError.message : String(deleteSpaceError)}`);
        }
 
        // 清理所有相关的状态缓存
        if (projectId) {
          this.indexingProjects.delete(projectId);
          this.completedProjects.delete(projectId);
          this.logger.info(`已清理项目状态缓存: ${projectId}`);
        }
      } else {
        this.logger.info(`项目 ${projectPath} 不存在，将创建新索引`);
      }

      // 开始新的索引
      return await this.startIndexing(projectPath, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`重新索引项目失败: ${errorMessage}`),
        { component: 'IndexSyncService', operation: 'reindexProject', projectPath, options }
      );

      // 提供更友好的错误信息
      if (errorMessage.includes('already being indexed')) {
        throw new Error(`项目 ${projectPath} 正在索引中，请等待完成或停止当前索引`);
      } else if (errorMessage.includes('Collection name not found')) {
        throw new Error(`项目 ${projectPath} 的集合不存在，请先创建索引`);
      } else {
        throw new Error(`重新索引项目失败: ${errorMessage}`);
      }
    }
  }
}