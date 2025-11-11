import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { IGraphDataService } from '../graph/core/IGraphDataService';
import { NebulaProjectManager } from '../../database/nebula/NebulaProjectManager';
import { IndexService } from './IndexService';
import { FileTraversalService } from './shared/FileTraversalService';
import { ConcurrencyService } from './shared/ConcurrencyService';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { IIndexService, IndexServiceType, IndexStatus, IndexOptions } from './IIndexService';
import { IndexServiceError, IndexServiceErrorType } from './errors/IndexServiceErrors';
import { LANGUAGE_MAP } from '../parser/constants/language-constants';
import { IGraphIndexPerformanceMonitor, GraphIndexMetric } from '../../infrastructure/monitoring/GraphIndexMetrics';

export interface GraphIndexOptions {
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
}

export interface GraphIndexResult {
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
 * 图索引服务实现
 * 实现统一的IIndexService接口，专注于图索引操作
 */
@injectable()
export class GraphIndexService implements IIndexService {
  private activeOperations: Map<string, any> = new Map();
  private serviceType = IndexServiceType.GRAPH;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.GraphDataService) private graphDataService: IGraphDataService,
    @inject(TYPES.INebulaProjectManager) private nebulaProjectManager: NebulaProjectManager,
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.FileTraversalService) private fileTraversalService: FileTraversalService,
    @inject(TYPES.ConcurrencyService) private concurrencyService: ConcurrencyService,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.GraphIndexPerformanceMonitor) private performanceMonitor: IGraphIndexPerformanceMonitor
  ) {}

  /**
   * 实现IIndexService接口 - 开始索引项目
   */
  async startIndexing(projectPath: string, options?: IndexOptions): Promise<string> {
    const startTime = Date.now();
    
    try {
      // 检查是否启用了图索引
      if (options?.enableGraphIndex === false) {
        throw IndexServiceError.serviceDisabled('Graph indexing', undefined, 'graph');
      }

      // 生成或获取项目ID
      const projectId = await this.projectIdManager.generateProjectId(projectPath);

      // 检查项目状态管理器中的状态
      const graphStatus = this.projectStateManager.getGraphStatus(projectId);
      if (graphStatus && graphStatus.status === 'indexing') {
        throw IndexServiceError.projectAlreadyIndexing(projectId, 'graph');
      }

      // 检查是否已有正在进行的操作
      if (this.activeOperations.has(projectId)) {
        throw IndexServiceError.projectAlreadyIndexing(projectId, 'graph');
      }

      // 获取项目文件列表
      const files = await this.fileTraversalService.getProjectFiles(projectPath, {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      });
      const totalFiles = files.length;

      if (totalFiles === 0) {
        throw IndexServiceError.indexingFailed(
          `No files found in project: ${projectId}`,
          projectId,
          'graph'
        );
      }

      // 确保项目空间存在
      const spaceCreated = await this.nebulaProjectManager.createSpaceForProject(projectPath);
      if (!spaceCreated) {
        throw IndexServiceError.indexingFailed(
          `Failed to create space for project: ${projectId}`,
          projectId,
          'graph'
        );
      }

      // 开始图索引
      const operationId = `graph_${projectId}_${Date.now()}`;
      this.activeOperations.set(projectId, { operationId, startTime: Date.now() });

      // 更新项目状态
      await this.projectStateManager.startGraphIndexing(projectId, totalFiles);

      this.logger.info(`Started graph indexing for project ${projectId}`, {
        projectId,
        operationId,
        totalFiles,
        options
      });

      // 异步执行索引（不等待完成）
      this.performGraphIndexing(projectId, projectPath, files, options)
        .catch(error => {
          this.logger.error(`Graph indexing failed for project ${projectId}`, { error });
          this.failGraphIndexing(projectId, error.message);
        })
        .finally(() => {
          this.activeOperations.delete(projectId);
        });

      // 记录性能指标
      this.performanceMonitor.recordMetric({
        operation: 'startIndexing',
        projectId,
        duration: Date.now() - startTime,
        success: true,
        timestamp: Date.now(),
        metadata: {
          fileCount: totalFiles,
          memoryUsage: this.getMemoryUsage()
        }
      });

      return projectId;

    } catch (error) {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 使用ErrorHandlerService记录错误
      this.errorHandler.handleError(
        new Error(`Failed to start graph indexing: ${errorMessage}`),
        { component: 'GraphIndexService', operation: 'startIndexing', projectPath, options }
      );

      // 更新项目状态为失败
      if (projectId) {
        await this.projectStateManager.failGraphIndexing(projectId, errorMessage);
      }

      // 记录失败的性能指标
      this.performanceMonitor.recordMetric({
        operation: 'startIndexing',
        projectId: projectId || 'unknown',
        duration: Date.now() - startTime,
        success: false,
        timestamp: Date.now(),
        metadata: {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
          memoryUsage: this.getMemoryUsage()
        }
      });

      // 如果已经是IndexServiceError，直接重新抛出
      if (error instanceof IndexServiceError) {
        throw error;
      }

      // 抛出统一的IndexServiceError
      throw IndexServiceError.indexingFailed(
        `Failed to start graph indexing: ${errorMessage}`,
        projectId,
        'graph',
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
      const graphStatus = this.projectStateManager.getGraphStatus(projectId);
      
      // 检查是否有活跃操作或正在索引的状态
      if (!activeOperation && (!graphStatus || graphStatus.status !== 'indexing')) {
        return false;
      }

      // 从活跃操作中移除
      this.activeOperations.delete(projectId);

      // 更新项目状态为停止
      if (graphStatus) {
        await this.projectStateManager.updateGraphIndexingProgress(
          projectId,
          graphStatus.progress,
          graphStatus.processedFiles,
          graphStatus.failedFiles
        );
      }

      this.logger.info(`Stopped graph indexing for project: ${projectId}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.errorHandler.handleError(
        new Error(`Failed to stop graph indexing: ${errorMessage}`),
        { component: 'GraphIndexService', operation: 'stopIndexing', projectId }
      );
      
      // 记录错误但不抛出，因为stopIndexing应该返回false而不是抛出异常
      this.logger.error(`Failed to stop graph indexing for project ${projectId}`, { 
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
      const graphStatus = this.projectStateManager.getGraphStatus(projectId);

      if (!graphStatus) {
        return null;
      }

      // 检查是否有正在进行的操作
      const activeOperation = this.activeOperations.get(projectId);

      return {
        projectId,
        projectPath: this.projectIdManager.getProjectPath(projectId) || '',
        isIndexing: graphStatus.status === 'indexing' || !!activeOperation,
        lastIndexed: graphStatus.lastCompleted ? new Date(graphStatus.lastCompleted) : null,
        totalFiles: graphStatus.totalFiles || 0,
        indexedFiles: graphStatus.processedFiles || 0,
        failedFiles: graphStatus.failedFiles || 0,
        progress: graphStatus.progress || 0,
        serviceType: this.serviceType,
        error: graphStatus.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.errorHandler.handleError(
        new Error(`Failed to get graph status: ${errorMessage}`),
        { component: 'GraphIndexService', operation: 'getIndexStatus', projectId }
      );
      
      this.logger.error(`Failed to get graph status for project ${projectId}`, { 
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

        // 清理图数据
        try {
          await this.nebulaProjectManager.clearSpaceForProject(projectPath);
          this.logger.info(`Cleared graph space for project: ${projectPath}`);
        } catch (clearError) {
          this.logger.warn(`Failed to clear graph space for project ${projectPath}:`, clearError);
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
        'graph',
        { projectPath, options }
      );
    }
  }

  /**
   * 执行图存储（保持向后兼容）
   */
  async indexGraph(projectId: string, options: GraphIndexOptions = {}): Promise<GraphIndexResult> {
    try {
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        throw IndexServiceError.projectNotFound(projectId, 'graph');
      }

      // 转换为IndexOptions格式
      const indexOptions: IndexOptions = {
        includePatterns: options.includePatterns,
        excludePatterns: options.excludePatterns,
        maxConcurrency: options.maxConcurrency,
        enableGraphIndex: true,
        enableVectorIndex: false
      };

      // 开始索引
      await this.startIndexing(projectPath, indexOptions);

      return {
        success: true,
        projectId,
        operationId: this.activeOperations.get(projectId)?.operationId || `graph_${projectId}_${Date.now()}`,
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
   * 获取图状态（保持向后兼容）
   */
  async getGraphStatus(projectId: string): Promise<any> {
    const status = this.getIndexStatus(projectId);
    
    if (!status) {
      throw IndexServiceError.projectNotFound(projectId, 'graph');
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
   * 批量图存储（保持向后兼容）
   */
  async batchIndexGraph(projectIds: string[], options: GraphIndexOptions = {}): Promise<any> {
    try {
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        throw IndexServiceError.indexingFailed(
          'projectIds array is required and cannot be empty',
          undefined,
          'graph'
        );
      }

      const operationId = `batch_graph_${Date.now()}`;
      const results: GraphIndexResult[] = [];
      let totalEstimatedTime = 0;

      for (const projectId of projectIds) {
        try {
          const result = await this.indexGraph(projectId, options);
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
        new Error(`Failed to start batch graph indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphIndexService', operation: 'batchIndexGraph', projectIds, options }
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
   * 获取图索引默认配置
   */
  private getDefaultGraphConfig(): IndexingConfig {
    return {
      batchSize: 5,
      maxConcurrency: 2
    };
  }

  /**
   * 执行实际的图索引
   */
  private async performGraphIndexing(
    projectId: string,
    projectPath: string,
    files: string[],
    options?: IndexOptions
  ): Promise<void> {
    try {
      const defaultConfig = this.getDefaultGraphConfig();
      const maxConcurrency = options?.maxConcurrency || defaultConfig.maxConcurrency;

      let processedFiles = 0;
      let failedFiles = 0;

      // 使用高级批处理服务
      await this.batchProcessor.processBatches(
        files,
        async (batch) => {
          try {
            // 使用GraphDataService处理文件
            await this.processGraphFiles(projectPath, batch, projectId);

            processedFiles += batch.length;

            // 更新进度
            const progress = Math.round((processedFiles / files.length) * 100);
            await this.projectStateManager.updateGraphIndexingProgress(
              projectId,
              progress,
              processedFiles,
              failedFiles
            );

            this.logger.debug(`Processed graph batch for project ${projectId}`, {
              projectId,
              processedFiles,
              totalFiles: files.length,
              progress
            });

            return batch.map(file => ({ filePath: file, success: true }));
          } catch (error) {
            failedFiles += batch.length;
            this.logger.error(`Failed to process graph batch for project ${projectId}`, {
              projectId,
              error: error instanceof Error ? error.message : String(error)
            });

            await this.projectStateManager.updateGraphIndexingProgress(
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
          batchSize: defaultConfig.batchSize,
          maxConcurrency,
          context: { domain: 'database', subType: 'graph' }
        }
      );

      // 完成图索引
      await this.projectStateManager.completeGraphIndexing(projectId);

      this.logger.info(`Completed graph indexing for project ${projectId}`, {
        projectId,
        processedFiles,
        totalFiles: files.length,
        failedFiles,
        successRate: ((processedFiles - failedFiles) / processedFiles) * 100
      });

    } catch (error) {
      await this.failGraphIndexing(projectId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 处理图文件
   */
  private async processGraphFiles(projectPath: string, files: string[], projectId: string): Promise<void> {
    try {
      // 检查NEBULA_ENABLED环境变量
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.logger.info('Nebula graph database is disabled via NEBULA_ENABLED environment variable, skipping graph indexing', {
          projectPath,
          fileCount: files.length
        });
        return; // 如果Nebula被禁用，直接返回
      }

      // 处理每个文件，构建图结构
      const parsedFiles = [];
      for (const filePath of files) {
        try {
          // 使用IndexService的indexingLogicService解析文件
          // 使用indexFile方法来处理文件，然后获取解析结果
          await this.indexService['indexingLogicService'].indexFile(projectPath, filePath);
          // 这里需要从indexingLogicService获取解析后的文件数据
          // 暂时使用简化的实现
          const parsedFile = {
            id: `${projectId}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            filePath,
            relativePath: filePath.replace(projectPath, ''),
            language: this.getLanguageFromPath(filePath),
            chunks: [],
            metadata: {
              linesOfCode: 0,
              functions: 0,
              classes: 0,
              imports: []
            }
          };
          if (parsedFile) {
            parsedFiles.push(parsedFile);
          }
        } catch (error) {
          this.logger.error(`Failed to parse file for graph indexing: ${filePath}`, { error });
          throw IndexServiceError.fileProcessingFailed(filePath, error as Error, projectId, 'graph');
        }
      }

      // 使用GraphDataService存储解析的文件
      const result = await this.graphDataService.storeParsedFiles(parsedFiles, {
        projectId
      });

      if (!result.success) {
        throw IndexServiceError.indexingFailed(
          `Failed to store files to graph: ${result.errors.join(', ')}`,
          projectId,
          'graph',
          { errors: result.errors }
        );
      }

    } catch (error) {
      if (error instanceof IndexServiceError) {
        throw error;
      }
      
      this.logger.error(`Failed to process graph files`, { projectPath, files, error });
      throw IndexServiceError.indexingFailed(
        `Failed to process graph files: ${error instanceof Error ? error.message : String(error)}`,
        projectId,
        'graph',
        { projectPath, files }
      );
    }
  }

  /**
   * 处理图索引失败
   */
  private async failGraphIndexing(projectId: string, errorMessage: string): Promise<void> {
    await this.projectStateManager.failGraphIndexing(projectId, errorMessage);
    this.activeOperations.delete(projectId);
  }

  /**
   * 从文件路径获取语言类型
   */
  private getLanguageFromPath(filePath: string): string {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    return LANGUAGE_MAP[ext] || 'unknown';
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