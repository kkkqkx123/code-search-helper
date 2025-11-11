import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileWatcherService } from '../filesystem/FileWatcherService';
import { ChangeDetectionService } from '../filesystem/ChangeDetectionService';
import { ProjectHotReloadService } from '../filesystem/ProjectHotReloadService';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
// Tree-sitter AST分段支持
import { ASTCodeSplitter } from '../parser/processing/strategies/implementations/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../parser/ChunkToVectorCoordinationService';
import { IndexingLogicService } from './IndexingLogicService';
import { NebulaClient } from '../../database/nebula/client/NebulaClient';
import { INebulaClient } from '../../database/graph/interfaces/INebulaClient';
import { FileTraversalService } from './shared/FileTraversalService';
import { ConcurrencyService } from './shared/ConcurrencyService';
import { IgnoreRuleManager } from '../ignore/IgnoreRuleManager';
import * as path from 'path';

export interface IndexSyncOptions {
  embedder?: string;
  batchSize?: number;
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
  enableHotReload?: boolean; // 新增热更新启用选项
}

export interface UpdateIndexOptions {
  batchSize?: number;
  maxConcurrency?: number;
  enableHashComparison?: boolean;
  forceUpdate?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface UpdateIndexResult {
  projectId: string;
  projectPath: string;
  updateId: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  totalFiles: number;
  updatedFiles: number;
  deletedFiles: number;
  unchangedFiles: number;
  errors: Array<{
    filePath: string;
    error: string;
    timestamp: string;
  }>;
  processingTime: number;
  startTime: string;
  estimatedCompletionTime?: string;
}

export interface UpdateProgress {
  projectId: string;
  updateId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percentage: number;
    currentFile: string;
    filesProcessed: number;
    filesTotal: number;
    estimatedTimeRemaining: number;
  };
  statistics: {
    totalFiles: number;
    updatedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errorCount: number;
  };
  startTime: string;
  lastUpdated: string;
  currentOperation?: string;
}

interface UpdateOperation {
  id: string;
  projectId: string;
  projectPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  progress: {
    percentage: number;
    currentFile: string;
    filesProcessed: number;
    filesTotal: number;
    estimatedTimeRemaining: number;
  };
  statistics: {
    totalFiles: number;
    updatedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errorCount: number;
  };
  currentOperation?: string;
  error?: string;
  processingTime?: number;
}

export interface IndexSyncStatus {
  projectId: string;
  projectPath: string;
  isIndexing: boolean;
  on?(event: 'updateStarted', listener: (projectId: string, updateId: string) => Promise<void>): void;
  on?(event: 'updateProgress', listener: (projectId: string, progress: UpdateProgress) => Promise<void>): void;
  on?(event: 'updateCompleted', listener: (projectId: string, result: UpdateIndexResult) => Promise<void>): void;
  on?(event: 'updateError', listener: (projectId: string, error: Error) => Promise<void>): void;
  on?(event: 'updateCancelled', listener: (projectId: string, updateId: string) => Promise<void>): void;
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
  private async emit(event: 'updateStarted', projectId: string, updateId: string): Promise<void>;
  private async emit(event: 'updateProgress', projectId: string, progress: UpdateProgress): Promise<void>;
  private async emit(event: 'updateCompleted', projectId: string, result: UpdateIndexResult): Promise<void>;
  private async emit(event: 'updateError', projectId: string, error: Error): Promise<void>;
  private async emit(event: 'updateCancelled', projectId: string, updateId: string): Promise<void>;
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
  private updateOperations: Map<string, UpdateOperation> = new Map();
  private completedProjects: Map<string, IndexSyncStatus> = new Map(); // 存储已完成的项目状态
  private indexingQueue: Array<{ projectPath: string; options?: IndexSyncOptions }> = [];
  private isProcessingQueue: boolean = false;
  private projectEmbedders: Map<string, string> = new Map(); // 存储项目对应的embedder
  private ignoreRuleManager: IgnoreRuleManager | null = null;
  private projectHotReloadService: ProjectHotReloadService | null = null;
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.FileWatcherService) private fileWatcherService: FileWatcherService,
    @inject(TYPES.ChangeDetectionService) private changeDetectionService: ChangeDetectionService,
    @inject(TYPES.ProjectHotReloadService) projectHotReloadService: ProjectHotReloadService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.INebulaClient) private nebulaService: INebulaClient,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.EmbeddingCacheService) private embeddingCacheService: EmbeddingCacheService,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.ASTCodeSplitter) private astSplitter: ASTCodeSplitter,
    @inject(TYPES.ChunkToVectorCoordinationService) private coordinationService: ChunkToVectorCoordinationService,
    @inject(TYPES.IndexingLogicService) private indexingLogicService: IndexingLogicService,
    @inject(TYPES.FileTraversalService) private fileTraversalService: FileTraversalService,
    @inject(TYPES.ConcurrencyService) private concurrencyService: ConcurrencyService,
    @inject(TYPES.IgnoreRuleManager) ignoreRuleManager: IgnoreRuleManager
  ) {
    this.ignoreRuleManager = ignoreRuleManager;
    this.projectHotReloadService = projectHotReloadService;

    // 设置文件变化监听器
    this.setupFileChangeListeners();

    // 订阅忽略规则变化事件
    this.setupIgnoreRuleListeners();
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
   * 设置忽略规则监听器
   */
  private setupIgnoreRuleListeners(): void {
    if (this.ignoreRuleManager) {
      this.ignoreRuleManager.on('rulesChanged', async (projectPath: string, newPatterns: string[], changedFile: string) => {
        this.logger.info(`Detected ignore rules change in ${changedFile} for project: ${projectPath}`);

        try {
          // 获取当前索引状态
          const projectId = this.projectIdManager.getProjectId(projectPath);
          if (!projectId) {
            return;
          }

          const status = this.indexingProjects.get(projectId);
          if (!status) {
            this.logger.debug(`Project ${projectPath} is not currently indexing, skipping rule update`);
            return;
          }

          // 重新遍历项目文件以检测应该被忽略的文件
          const files = await this.fileTraversalService.getProjectFiles(projectPath, {
            excludePatterns: newPatterns // 使用更新后的忽略规则重新遍历
          });

          // 确定哪些文件不再被索引（因为被新的忽略规则过滤掉了）
          const currentlyIndexedFiles = await this.indexingLogicService.getIndexedFiles(projectPath);
          const filesToBeRemoved = currentlyIndexedFiles.filter((file: string) => !files.includes(file));

          // 从索引中移除这些文件
          for (const fileToRemove of filesToBeRemoved) {
            await this.removeFileFromIndex(projectPath, fileToRemove);
            this.logger.info(`Removed file from index due to updated ignore rules: ${fileToRemove}`);
          }

          this.logger.info(`Ignore rules updated for project: ${projectPath}, removed ${filesToBeRemoved.length} files from index`);
        } catch (error) {
          this.errorHandler.handleError(
            new Error(`Failed to update ignore rules for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`),
            { component: 'IndexSyncService', operation: 'handleIgnoreRulesChange', projectPath, changedFile }
          );
        }
      });
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
      // 使用IgnoreRuleManager获取项目当前的忽略规则
      const ignoreRules = this.ignoreRuleManager ? await this.ignoreRuleManager.getIgnorePatterns(projectPath) : [];
      // 合并用户提供的排除模式
      const combinedExcludePatterns = [...ignoreRules, ...(options?.excludePatterns || [])];

      const files = await this.fileTraversalService.getProjectFiles(projectPath, {
        includePatterns: options?.includePatterns,
        excludePatterns: combinedExcludePatterns
      });

      status.totalFiles = files.length;
      this.logger.info(`Found ${files.length} files to index in project: ${projectId}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectId}`, {
        filesFound: files.length
      });

      // 处理每个文件
      const batchSize = options?.batchSize || 50; // 使用默认批大小
      const maxConcurrency = options?.maxConcurrency || 3;

      // 使用新的批处理服务批量处理文件
      const batchResults = await this.batchProcessor.processBatches(
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
          const promises = batch.map(async (file: string) => {
            const startTime = Date.now();
            try {
              await this.batchProcessor.executeWithRetry(
                () => this.indexFile(projectPath, file),
                `indexFile:${file}`
              );
              status.indexedFiles++;

              // 记录成功结果
              results.push({
                filePath: file,
                success: true,
                processingTime: Date.now() - startTime,
                error: undefined
              });
            } catch (error) {
              status.failedFiles++;
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to index file: ${file}`, { error });

              // 如果是内存相关错误，记录额外信息
              if (error instanceof Error && error.message.includes('memory')) {
                this.logger.warn(`Memory-related error while indexing file: ${file}`, {
                  memoryUsage: process.memoryUsage(),
                  error: error.message
                });
              }

              // 记录失败结果
              results.push({
                filePath: file,
                success: false,
                error: errorMessage,
                processingTime: Date.now() - startTime
              });
            }
          });

          // 限制并发数
          await this.concurrencyService.processWithConcurrency(promises, maxConcurrency);
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
        {
          batchSize,
          maxConcurrency
        }
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

      // 索引完成后启动项目文件监视（如果启用了热更新）
      if (options?.enableHotReload !== false) {
        if (this.projectHotReloadService) {
          await this.projectHotReloadService.enableForProject(projectPath, {
            debounceInterval: 500,
            enabled: true,
            watchPatterns: ['**/*.{js,ts,jsx,tsx,json,md,py,go,java}'], // 根据项目类型调整
            ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**', '**/venv/**'],
            maxFileSize: 512000, // 500KB
            errorHandling: {
              maxRetries: 3,
              alertThreshold: 5,
              autoRecovery: true
            }
          });
          this.logger.info(`Hot reload enabled for project: ${projectPath}`);
        } else {
          // 如果没有ProjectHotReloadService，使用旧方法
          await this.startProjectWatching(projectPath);
          this.logger.warn(`ProjectHotReloadService not available, using legacy file watching for: ${projectPath}`);
        }
      }

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
      // 原有的向量索引逻辑
      await this.indexingLogicService.indexFile(projectPath, filePath);

      // 新增的图索引逻辑
      if (process.env.NEBULA_ENABLED?.toLowerCase() !== 'false') {
        await this.indexingLogicService.indexFileToGraph(projectPath, filePath);
      }
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

        // 检查NEBULA_ENABLED环境变量，如果启用则删除Nebula Graph空间
        const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
        if (nebulaEnabled) {
          try {
            // Note: deleteSpaceForProject should be called on NebulaProjectManager, not NebulaClient
            // This might need to be refactored to use the correct service
            throw new Error('deleteSpaceForProject should be called on NebulaProjectManager, not NebulaClient');
            this.logger.info(`已删除项目Nebula空间: ${projectPath}`);
          } catch (deleteSpaceError) {
            // 如果空间不存在或删除失败，记录警告但继续执行
            this.logger.warn(`删除项目Nebula空间时出现问题（这可能是正常的）: ${deleteSpaceError instanceof Error ? deleteSpaceError.message : String(deleteSpaceError)}`);
          }
        } else {
          this.logger.info('Nebula graph database is disabled via NEBULA_ENABLED environment variable, skipping space deletion');
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

  /**
   * 启动项目文件监视
   */
  public async startProjectWatching(projectPath: string): Promise<void> {
    try {
      this.logger.info(`Starting file watching for project: ${projectPath}`);

      // 初始化变更检测服务，监控项目路径
      await this.changeDetectionService.initialize([projectPath], {
        watchPaths: [projectPath],
        debounceInterval: 500,
        enableHashComparison: true,
        trackFileHistory: true,
      });

      this.logger.info(`File watching started for project: ${projectPath}`);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to start project watching: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'startProjectWatching', projectPath }
      );
      throw error;
    }
  }

  /**
   * 销毁IndexService实例，清理所有资源
   */
  async destroy(): Promise<void> {
    // 停止所有正在进行的索引任务
    for (const [projectId, status] of this.indexingProjects.entries()) {
      if (status.isIndexing) {
        await this.stopIndexing(projectId);
      }
    }

    // 清理文件监听器
    try {
      this.fileWatcherService.stopWatching();
    } catch (error) {
      this.logger.warn(`Failed to stop file watcher: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 清理变更检测服务
    try {
      if (this.changeDetectionService.isServiceRunning()) {
        await this.changeDetectionService.stop();
      }
    } catch (error) {
      this.logger.warn(`Failed to stop change detection service: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 如果有ProjectHotReloadService，也清理它
    if (this.projectHotReloadService) {
      try {
        // 可以添加禁用所有项目热重载的逻辑
        this.logger.info('IndexService destroyed');
      } catch (error) {
        this.logger.warn(`Failed to clean up ProjectHotReloadService: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.info('IndexService destroyed');
  }

  /**
   * 获取所有已索引的项目路径
   */
  public getAllIndexedProjectPaths(): string[] {
    const projectPaths: string[] = [];
    for (const [projectId, status] of this.completedProjects.entries()) {
      if (status.projectPath) {
        projectPaths.push(status.projectPath);
      }
    }
    return projectPaths;
  }

  /**
   * 检查项目是否已被索引
   */
  public isProjectIndexed(projectPath: string): boolean {
    // 检查项目是否在已完成的项目中
    for (const [, status] of this.completedProjects.entries()) {
      if (status.projectPath === projectPath) {
        return true;
      }
    }

    // 检查项目是否在进行索引的项目中
    for (const [, status] of this.indexingProjects.entries()) {
      if (status.projectPath === projectPath) {
        return true;
      }
    }

    return false;
  }


  /**
   * 手动更新项目索引（增量更新）
   */
  async updateIndex(projectPath: string, options?: UpdateIndexOptions): Promise<UpdateIndexResult> {
    const startTime = Date.now();
    const projectId = this.projectIdManager.getProjectId(projectPath);

    if (!projectId) {
      throw new Error(`Project not found: ${projectPath}`);
    }

    // 检查是否已有进行中的更新操作
    const existingOperation = this.updateOperations.get(projectId);
    if (existingOperation && existingOperation.status === 'running') {
      throw new Error(`Update operation already in progress for project: ${projectId}`);
    }

    const updateId = this.generateUpdateId();
    const updateOperation: UpdateOperation = {
      id: updateId,
      projectId,
      projectPath,
      status: 'running',
      startTime: new Date(),
      progress: {
        percentage: 0,
        currentFile: '',
        filesProcessed: 0,
        filesTotal: 0,
        estimatedTimeRemaining: 0
      },
      statistics: {
        totalFiles: 0,
        updatedFiles: 0,
        deletedFiles: 0,
        unchangedFiles: 0,
        errorCount: 0
      }
    };

    this.updateOperations.set(projectId, updateOperation);

    try {
      // 触发更新开始事件
      await this.emit('updateStarted', projectId, updateId);

      // 执行增量更新
      const result = await this.performIncrementalUpdate(projectPath, options, updateOperation);

      // 更新操作状态
      updateOperation.status = 'completed';
      updateOperation.endTime = new Date();
      updateOperation.processingTime = Date.now() - startTime;

      // 触发更新完成事件
      await this.emit('updateCompleted', projectId, result);

      return result;
    } catch (error) {
      // 更新操作失败
      updateOperation.status = 'failed';
      updateOperation.endTime = new Date();
      updateOperation.error = error instanceof Error ? error.message : String(error);

      // 触发更新错误事件
      await this.emit('updateError', projectId, error instanceof Error ? error : new Error(String(error)));

      throw error;
    } finally {
      // 清理操作状态（保留一段时间用于查询）
      setTimeout(() => {
        this.updateOperations.delete(projectId);
      }, 5 * 60 * 1000); // 5分钟后清理
    }
  }

  /**
   * 执行增量更新
   */
  private async performIncrementalUpdate(
    projectPath: string,
    options: UpdateIndexOptions = {},
    operation: UpdateOperation
  ): Promise<UpdateIndexResult> {
    const startTime = Date.now();
    const projectId = this.projectIdManager.getProjectId(projectPath)!;

    try {
      // 1. 检测文件变化
      operation.currentOperation = 'Detecting file changes';
      await this.updateProgress(projectId, operation);

      const changes = await this.changeDetectionService.detectChangesForUpdate(projectPath, {
        enableHashComparison: options.enableHashComparison ?? true
      });

      operation.statistics.totalFiles = changes.added.length + changes.modified.length + changes.deleted.length + changes.unchanged.length;
      operation.progress.filesTotal = operation.statistics.totalFiles;

      // 2. 处理变化的文件
      operation.currentOperation = 'Processing file changes';
      await this.updateProgress(projectId, operation);

      const updateResults = await this.processFileChanges(projectPath, changes, options, operation);

      // 3. 返回结果
      return {
        projectId,
        projectPath,
        updateId: operation.id,
        status: 'completed',
        totalFiles: operation.statistics.totalFiles,
        updatedFiles: updateResults.updatedFiles,
        deletedFiles: updateResults.deletedFiles,
        unchangedFiles: updateResults.unchangedFiles,
        errors: updateResults.errors,
        processingTime: Date.now() - startTime,
        startTime: operation.startTime.toISOString(),
        estimatedCompletionTime: new Date(Date.now() + operation.progress.estimatedTimeRemaining * 1000).toISOString()
      };
    } catch (error) {
      throw new Error(`Incremental update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 处理文件变化
   */
  private async processFileChanges(
    projectPath: string,
    changes: {
      added: string[];
      modified: string[];
      deleted: string[];
      unchanged: string[];
    },
    options: UpdateIndexOptions,
    operation: UpdateOperation
  ): Promise<{ updatedFiles: number; deletedFiles: number; unchangedFiles: number; errors: Array<{ filePath: string; error: string; timestamp: string }> }> {
    const results = {
      updatedFiles: 0,
      deletedFiles: 0,
      unchangedFiles: changes.unchanged.length,
      errors: [] as Array<{ filePath: string; error: string; timestamp: string }>
    };

    const filesToUpdate = [...changes.added, ...changes.modified];
    const batchSize = options.batchSize || 100;
    const maxConcurrency = options.maxConcurrency || 3;

    // 处理新增和修改的文件
    if (filesToUpdate.length > 0) {
      const batchResults = await this.batchProcessor.processBatches(
        filesToUpdate,
        async (batch) => {
          const promises = batch.map(async (file) => {
            operation.progress.currentFile = file;
            operation.progress.filesProcessed++;
            operation.progress.percentage = Math.round((operation.progress.filesProcessed / operation.progress.filesTotal) * 100);

            // 更新预计剩余时间
            const elapsedTime = Date.now() - operation.startTime.getTime();
            const filesPerSecond = operation.progress.filesProcessed / (elapsedTime / 1000);
            operation.progress.estimatedTimeRemaining = filesPerSecond > 0
              ? Math.round((operation.progress.filesTotal - operation.progress.filesProcessed) / filesPerSecond)
              : 0;

            await this.updateProgress(operation.projectId, operation);

            try {
              await this.batchProcessor.executeWithRetry(
                () => this.indexFile(projectPath, file),
                `updateFile:${file}`
              );
              results.updatedFiles++;
            } catch (error) {
              results.errors.push({
                filePath: file,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
              });
              operation.statistics.errorCount++;
            }
          });

          await this.concurrencyService.processWithConcurrency(promises, maxConcurrency);
          return batch.map(file => ({ filePath: file, success: true }));
        },
        { context: { domain: 'database', subType: 'incrementalUpdate' } }
      );
    }

    // 处理删除的文件
    for (const file of changes.deleted) {
      try {
        await this.removeFileFromIndex(projectPath, file);
        results.deletedFiles++;
        operation.statistics.deletedFiles++;
      } catch (error) {
        results.errors.push({
          filePath: file,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
        operation.statistics.errorCount++;
      }
    }

    return results;
  }

  /**
   * 获取更新进度
   */
  getUpdateProgress(projectId: string): UpdateProgress | null {
    const operation = this.updateOperations.get(projectId);
    if (!operation) {
      return null;
    }

    return {
      projectId: operation.projectId,
      updateId: operation.id,
      status: operation.status,
      progress: { ...operation.progress },
      statistics: { ...operation.statistics },
      startTime: operation.startTime.toISOString(),
      lastUpdated: new Date().toISOString(),
      currentOperation: operation.currentOperation
    };
  }

  /**
   * 取消更新操作
   */
  async cancelUpdate(projectId: string): Promise<boolean> {
    const operation = this.updateOperations.get(projectId);
    if (!operation || operation.status !== 'running') {
      return false;
    }

    operation.status = 'cancelled';
    operation.endTime = new Date();

    // 触发取消事件
    await this.emit('updateCancelled', projectId, operation.id);

    return true;
  }

  /**
   * 生成更新ID
   */
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新进度
   */
  private async updateProgress(projectId: string, operation: UpdateOperation): Promise<void> {
    await this.emit('updateProgress', projectId, {
      projectId: operation.projectId,
      updateId: operation.id,
      status: operation.status,
      progress: { ...operation.progress },
      statistics: { ...operation.statistics },
      startTime: operation.startTime.toISOString(),
      lastUpdated: new Date().toISOString(),
      currentOperation: operation.currentOperation
    });
  }
  /**
   * 重启后恢复所有已索引项目的监听
   */
  public async restoreProjectWatchingAfterRestart(): Promise<void> {
    try {
      this.logger.info('Restoring project watching after restart...');

      // 获取所有已索引的项目路径
      const indexedProjectPaths = this.getAllIndexedProjectPaths();

      if (indexedProjectPaths.length === 0) {
        this.logger.info('No indexed projects found, nothing to restore');
        return;
      }

      this.logger.info(`Found ${indexedProjectPaths.length} indexed projects to restore watching for`);

      // 为每个已索引的项目启动监听
      for (const projectPath of indexedProjectPaths) {
        try {
          // 检查项目路径是否存在
          const projectExists = await this.checkProjectExists(projectPath);
          if (!projectExists) {
            this.logger.warn(`Project path does not exist, skipping: ${projectPath}`);
            continue;
          }

          // 优先使用ProjectHotReloadService，如果可用的话
          if (this.projectHotReloadService) {
            try {
              // 检查该项目是否之前已启用热重载
              const projectConfig = {
                debounceInterval: 500,
                enabled: true,
                watchPatterns: ['**/*.{js,ts,jsx,tsx,json,md,py,go,java}'], // 根据项目类型调整
                ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**', '**/venv/**'],
                maxFileSize: 512000, // 500KB
                errorHandling: {
                  maxRetries: 3,
                  alertThreshold: 5,
                  autoRecovery: true
                }
              };

              await this.projectHotReloadService.enableForProject(projectPath, projectConfig);
              this.logger.info(`Hot reload enabled for project through ProjectHotReloadService: ${projectPath}`);
            } catch (hotReloadError) {
              this.logger.warn(`Failed to enable hot reload through ProjectHotReloadService for ${projectPath}, falling back to legacy method:`, hotReloadError);
              // 回退到旧方法
              await this.startProjectWatching(projectPath);
            }
          } else {
            // 使用旧方法
            await this.startProjectWatching(projectPath);
            this.logger.info(`Project watching restored for: ${projectPath}`);
          }
        } catch (error) {
          this.logger.error(`Failed to restore project watching for ${projectPath}:`, error);
          // 继续处理其他项目
        }
      }

      this.logger.info('Project watching restoration completed');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to restore project watching after restart: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'restoreProjectWatchingAfterRestart' }
      );
      throw error;
    }
  }

  /**
   * 检查项目路径是否存在
   */
  private async checkProjectExists(projectPath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(projectPath);
      return true;
    } catch {
      return false;
    }
  }
}