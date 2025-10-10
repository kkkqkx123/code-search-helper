import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { INebulaService, NebulaService } from '../../database/nebula/NebulaService';
import { IndexService } from './IndexService';
import * as fs from 'fs/promises';
import * as path from 'path';

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

@injectable()
export class GraphIndexService {
  private activeOperations: Map<string, any> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.INebulaService) private nebulaService: INebulaService,
    @inject(TYPES.IndexService) private indexService: IndexService
  ) { }

  /**
   * 执行图存储
   */
  async indexGraph(projectId: string, options: GraphIndexOptions = {}): Promise<GraphIndexResult> {
    try {
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // 检查是否已有正在进行的操作
      if (this.activeOperations.has(projectId)) {
        throw new Error(`Graph indexing already in progress for project: ${projectId}`);
      }

      // 获取项目文件列表
      const files = await this.getProjectFiles(projectPath);
      const totalFiles = files.length;

      if (totalFiles === 0) {
        throw new Error(`No files found in project: ${projectId}`);
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

      return {
        success: true,
        projectId,
        operationId,
        status: 'started',
        estimatedTime: Math.ceil(totalFiles / 5) * 1000, // 估算时间
        totalFiles
      };

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to start graph indexing: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphIndexService', operation: 'indexGraph', projectId, options }
      );

      await this.projectStateManager.failGraphIndexing(projectId, error instanceof Error ? error.message : String(error));

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
   * 获取图状态
   */
  async getGraphStatus(projectId: string): Promise<any> {
    try {
      const graphStatus = this.projectStateManager.getGraphStatus(projectId);

      if (!graphStatus) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // 检查是否有正在进行的操作
      const activeOperation = this.activeOperations.get(projectId);

      return {
        projectId,
        ...graphStatus,
        isActive: !!activeOperation,
        operationId: activeOperation?.operationId
      };

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get graph status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphIndexService', operation: 'getGraphStatus', projectId }
      );
      throw error;
    }
  }

  /**
   * 批量图存储
   */
  async batchIndexGraph(projectIds: string[], options: GraphIndexOptions = {}): Promise<any> {
    try {
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        throw new Error('projectIds array is required and cannot be empty');
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
   * 获取项目文件列表
   */
  private async getProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(projectPath, entry.name);

        if (entry.isFile() && this.isCodeFile(entry.name)) {
          files.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // 递归获取子目录文件
          const subFiles = await this.getProjectFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read project directory: ${projectPath}`, { error });
    }

    return files;
  }

  /**
   * 检查是否为代码文件
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.scala',
      '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml'
    ];

    const ext = path.extname(filename).toLowerCase();
    return codeExtensions.includes(ext);
  }

  /**
   * 执行实际的图索引
   */
  private async performGraphIndexing(
    projectId: string,
    projectPath: string,
    files: string[],
    options: GraphIndexOptions
  ): Promise<void> {
    try {
      const maxConcurrency = options.maxConcurrency || 2; // 图索引并发数较低

      let processedFiles = 0;
      let failedFiles = 0;

      // 分批处理文件
      const batchSize = 5; // 图索引批次较小

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        try {
          // 使用NebulaService处理文件
          await this.processGraphFiles(projectPath, batch);

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
            batch: Math.floor(i / batchSize) + 1,
            processedFiles,
            totalFiles: files.length,
            progress
          });

        } catch (error) {
          failedFiles += batch.length;
          this.logger.error(`Failed to process graph batch for project ${projectId}`, {
            projectId,
            batch: Math.floor(i / batchSize) + 1,
            error: error instanceof Error ? error.message : String(error)
          });

          await this.projectStateManager.updateGraphIndexingProgress(
            projectId,
            Math.round((processedFiles / files.length) * 100),
            processedFiles,
            failedFiles
          );
        }

        // 限制并发数，添加延迟
        if ((i / batchSize) % maxConcurrency === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 图索引延迟较长
        }
      }

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
  private async processGraphFiles(projectPath: string, files: string[]): Promise<void> {
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

      // 确保项目空间存在
      await this.nebulaService.createSpaceForProject(projectPath);

      // 处理每个文件，构建图结构
      for (const filePath of files) {
        try {
          // 这里应该调用图解析服务来解析文件并构建图结构
          // 暂时使用简化的实现，直接使用IndexService的indexingLogicService
          await this.indexService['indexingLogicService'].indexFile(projectPath, filePath);
        } catch (error) {
          this.logger.error(`Failed to index file to graph: ${filePath}`, { error });
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process graph files`, { projectPath, files, error });
      throw error;
    }
  }

  /**
   * 处理图索引失败
   */
  private async failGraphIndexing(projectId: string, errorMessage: string): Promise<void> {
    await this.projectStateManager.failGraphIndexing(projectId, errorMessage);
    this.activeOperations.delete(projectId);
  }
}