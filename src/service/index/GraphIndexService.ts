import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { IGraphDataService } from '../graph/core/IGraphDataService';
import { NebulaProjectManager } from '../../database/nebula/NebulaProjectManager';
import { VectorIndexService } from './VectorIndexService';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { BatchConfigManager } from '../../infrastructure/batching/BatchConfigManager';
import { IIndexService, IndexServiceType, IndexStatus, IndexOptions } from './IIndexService';
import { IndexServiceError } from './errors/IndexServiceErrors';
import { LANGUAGE_MAP } from '../parser/constants/language-constants';
import { IGraphIndexPerformanceMonitor } from '../../infrastructure/monitoring/GraphIndexMetrics';
import { IGraphConstructionService } from '../graph/construction/IGraphConstructionService';
import { GraphFileGroupingStrategy } from '../graph/utils/GraphFileGroupingStrategy';
import { GraphRetryService } from '../graph/utils/GraphRetryService';

export interface GraphIndexOptions {
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
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
    @inject(TYPES.VectorIndexService) private indexService: VectorIndexService,
    @inject(TYPES.FileSystemTraversal) private fileTraversalService: FileSystemTraversal,
    @inject(TYPES.BatchProcessingService) private batchProcessor: BatchProcessingService,
    @inject(TYPES.GraphIndexPerformanceMonitor) private performanceMonitor: IGraphIndexPerformanceMonitor,
    @inject(TYPES.GraphConstructionService) private graphConstructionService: IGraphConstructionService,
    @inject(BatchConfigManager) private batchConfigManager: BatchConfigManager,
    @inject(GraphFileGroupingStrategy) private fileGroupingStrategy: GraphFileGroupingStrategy,
    @inject(GraphRetryService) private retryService: GraphRetryService
  ) { }

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
   * 执行实际的图索引（改进版本）
   */
  private async performGraphIndexing(
    projectId: string,
    projectPath: string,
    files: string[],
    options?: IndexOptions
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting enhanced graph indexing for project ${projectId}`, {
        projectId,
        totalFiles: files.length,
        options
      });

      // 1. 智能文件分组
      const fileGroups = this.fileGroupingStrategy.groupFilesIntelligently(files);
      
      // 2. 获取分组建议
      const recommendation = this.fileGroupingStrategy.getGroupingRecommendation(files);
      this.logger.info('Using intelligent file grouping', {
        projectId,
        recommendation,
        groupCount: fileGroups.length
      });

      let totalProcessedFiles = 0;
      let totalFailedFiles = 0;
      const groupResults: Array<{
        groupType: string;
        processed: number;
        failed: number;
        duration: number;
      }> = [];

      // 3. 并行处理不同类型的文件组
      const groupPromises = fileGroups.map(async (group) => {
        const groupStartTime = Date.now();
        
        try {
          const result = await this.processFileGroup(
            projectPath,
            group,
            projectId,
            options
          );
          
          const groupDuration = Date.now() - groupStartTime;
          
          groupResults.push({
            groupType: group.groupType,
            processed: result.processed,
            failed: result.failed,
            duration: groupDuration
          });
          
          totalProcessedFiles += result.processed;
          totalFailedFiles += result.failed;
          
          this.logger.debug(`Completed processing group ${group.groupType}`, {
            projectId,
            groupType: group.groupType,
            processed: result.processed,
            failed: result.failed,
            duration: groupDuration
          });
          
          return result;
        } catch (error) {
          const groupDuration = Date.now() - groupStartTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          this.logger.error(`Failed to process group ${group.groupType}`, {
            projectId,
            groupType: group.groupType,
            error: errorMessage,
            duration: groupDuration
          });
          
          // 整个组失败
          const failedCount = group.files.length;
          totalFailedFiles += failedCount;
          
          groupResults.push({
            groupType: group.groupType,
            processed: 0,
            failed: failedCount,
            duration: groupDuration
          });
          
          throw error;
        }
      });

      // 4. 等待所有组处理完成
      await Promise.allSettled(groupPromises);

      // 5. 更新最终进度
      await this.projectStateManager.updateGraphIndexingProgress(
        projectId,
        100,
        totalProcessedFiles,
        totalFailedFiles
      );

      // 6. 完成图索引
      await this.projectStateManager.completeGraphIndexing(projectId);

      const totalDuration = Date.now() - startTime;
      const successRate = files.length > 0 ? ((totalProcessedFiles - totalFailedFiles) / totalProcessedFiles) * 100 : 0;

      this.logger.info(`Completed enhanced graph indexing for project ${projectId}`, {
        projectId,
        totalFiles: files.length,
        processedFiles: totalProcessedFiles,
        failedFiles: totalFailedFiles,
        successRate: Math.round(successRate),
        totalDuration,
        groupResults: groupResults.map(g => ({
          groupType: g.groupType,
          processed: g.processed,
          failed: g.failed,
          duration: Math.round(g.duration)
        }))
      });

      // 记录性能指标
      this.performanceMonitor.recordMetric({
        operation: 'storeFiles',
        projectId,
        duration: totalDuration,
        success: totalFailedFiles === 0,
        timestamp: Date.now(),
        metadata: {
          fileCount: files.length,
          memoryUsage: this.getMemoryUsage()
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Enhanced graph indexing failed for project ${projectId}`, {
        projectId,
        error: errorMessage,
        duration: Date.now() - startTime
      });
      
      await this.failGraphIndexing(projectId, errorMessage);
      throw error;
    }
  }

  /**
   * 处理单个文件组
   */
  private async processFileGroup(
    projectPath: string,
    group: { groupType: string; files: string[]; priority: number; estimatedProcessingTime: number; metadata: any },
    projectId: string,
    options?: IndexOptions
  ): Promise<{ processed: number; failed: number }> {
    this.logger.debug(`Processing file group ${group.groupType}`, {
      projectId,
      groupType: group.groupType,
      fileCount: group.files.length,
      priority: group.priority
    });

    let processedFiles = 0;
    let failedFiles = 0;

    // 使用基础设施层的批处理服务，完全委托批处理逻辑
    await this.batchProcessor.executeDatabaseBatch(
      group.files,
      async (batch: string[]) => {
        try {
          await this.processGraphFiles(projectPath, batch, projectId);
          processedFiles += batch.length;
          
          // 更新进度（减少更新频率）
          if (processedFiles % Math.max(1, Math.floor(group.files.length / 10)) === 0) {
            const totalProgress = Math.round((processedFiles / group.files.length) * 100);
            await this.projectStateManager.updateGraphIndexingProgress(
              projectId,
              totalProgress,
              processedFiles,
              failedFiles
            );
          }
          
          this.logger.debug(`Processed batch for group ${group.groupType}`, {
            projectId,
            groupType: group.groupType,
            batchSize: batch.length,
            processedFiles,
            totalFiles: group.files.length
          });
          
          return batch.map((file: string) => ({ filePath: file, success: true }));
        } catch (error) {
          failedFiles += batch.length;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          this.logger.error(`Failed to process batch for group ${group.groupType}`, {
            projectId,
            groupType: group.groupType,
            batchSize: batch.length,
            error: errorMessage
          });
          
          return batch.map((file: string) => ({
            filePath: file,
            success: false,
            error: errorMessage
          }));
        }
      },
      {
        batchSize: options?.batchSize,
        maxConcurrency: options?.maxConcurrency,
        databaseType: 'graph' as any
      }
    );

    return { processed: processedFiles, failed: failedFiles };
  }

  /**
   * 处理图文件（使用新的 GraphConstructionService）
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

      // 使用 GraphConstructionService 构建图结构
      const graphData = await this.graphConstructionService.buildGraphStructure(files, projectPath);

      // 使用GraphDataService存储图数据
      const result = await this.graphDataService.storeParsedFiles([{
        id: projectId,
        filePath: projectPath,
        relativePath: '',
        language: 'project',
        chunks: [],
        metadata: {
          linesOfCode: 0,
          functions: 0,
          classes: 0,
          imports: []
        }
      }], {
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

      this.logger.info(`Successfully processed graph files`, {
        projectPath,
        fileCount: files.length,
        nodesCreated: graphData.nodes.length,
        relationshipsCreated: graphData.relationships.length
      });

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