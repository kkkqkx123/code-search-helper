
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../project/ProjectStateManager';
import { VectorIndexService } from './VectorIndexService';
import { GraphIndexService } from './GraphIndexService';

export interface CoordinatedIndexOptions {
  vectors?: boolean;
  graph?: boolean;
  vectorOptions?: any;
  graphOptions?: any;
}

export interface CoordinatedResult {
  success: boolean;
  projectId: string;
  operationId: string;
  vectorResult?: any;
  graphResult?: any;
  errors?: string[];
}

@injectable()
export class StorageCoordinatorService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectStateManager) private projectStateManager: ProjectStateManager,
    @inject(TYPES.VectorIndexService) private vectorIndexService: VectorIndexService,
    @inject(TYPES.GraphIndexService) private graphIndexService: GraphIndexService
  ) {}

  /**
   * 协调索引操作
   */
  async coordinateIndexing(projectId: string, options: CoordinatedIndexOptions): Promise<CoordinatedResult> {
    const operationId = `coordinated_${projectId}_${Date.now()}`;
    const errors: string[] = [];
    let vectorResult: any = null;
    let graphResult: any = null;

    try {
      this.logger.info(`Starting coordinated indexing for project ${projectId}`, {
        projectId,
        operationId,
        options
      });

      // 默认情况下，如果没有指定任何选项，则执行两者
      const shouldIndexVectors = options.vectors !== false;
      const shouldIndexGraph = options.graph !== false;

      // 如果都不需要索引，返回错误
      if (!shouldIndexVectors && !shouldIndexGraph) {
        throw new Error('At least one of vectors or graph must be enabled');
      }

      // 并发执行向量索引和图索引
      const promises: Promise<any>[] = [];

      if (shouldIndexVectors) {
        promises.push(
          this.vectorIndexService.indexVectors(projectId, options.vectorOptions)
            .then(result => {
              vectorResult = result;
              this.logger.info(`Vector indexing completed for project ${projectId}`, {
                projectId,
                operationId,
                result
              });
            })
            .catch(error => {
              const errorMsg = `Vector indexing failed: ${error instanceof Error ? error.message : String(error)}`;
              errors.push(errorMsg);
              this.logger.error(`Vector indexing failed for project ${projectId}`, { error });
            })
        );
      }

      if (shouldIndexGraph) {
        promises.push(
          this.graphIndexService.indexGraph(projectId, options.graphOptions)
            .then(result => {
              graphResult = result;
              this.logger.info(`Graph indexing completed for project ${projectId}`, {
                projectId,
                operationId,
                result
              });
            })
            .catch(error => {
              const errorMsg = `Graph indexing failed: ${error instanceof Error ? error.message : String(error)}`;
              errors.push(errorMsg);
              this.logger.error(`Graph indexing failed for project ${projectId}`, { error });
            })
        );
      }

      // 等待所有操作完成
      await Promise.all(promises);

      // 检查是否所有操作都成功
      const hasVectorSuccess = !shouldIndexVectors || (vectorResult && vectorResult.success);
      const hasGraphSuccess = !shouldIndexGraph || (graphResult && graphResult.success);
      const overallSuccess = hasVectorSuccess && hasGraphSuccess;

      this.logger.info(`Coordinated indexing completed for project ${projectId}`, {
        projectId,
        operationId,
        success: overallSuccess,
        vectorSuccess: hasVectorSuccess,
        graphSuccess: hasGraphSuccess,
        errors: errors.length
      });

      return {
        success: overallSuccess,
        projectId,
        operationId,
        vectorResult,
        graphResult,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      const errorMsg = `Coordinated indexing failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(`Coordinated indexing failed for project ${projectId}`, { error });
      
      return {
        success: false,
        projectId,
        operationId,
        vectorResult,
        graphResult,
        errors: [errorMsg]
      };
    }
  }

  /**
   * 获取协调状态
   */
  /**
   * 获取协调状态
   */
  async getCoordinatedStatus(projectId: string): Promise<any> {
    try {
      const vectorStatus = await this.vectorIndexService.getVectorStatus(projectId);
      const graphStatus = await this.graphIndexService.getGraphStatus(projectId);

      return {
        projectId,
        vectorStatus,
        graphStatus,
        overallStatus: this.calculateOverallStatus(vectorStatus, graphStatus)
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get coordinated status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'StorageCoordinatorService', operation: 'getCoordinatedStatus', projectId }
      );
      throw error;
    }
  }

  /**
   * 计算整体状态
   */
  private calculateOverallStatus(vectorStatus: any, graphStatus: any): string {
    if (!vectorStatus && !graphStatus) {
      return 'pending';
    }

    const vectorState = vectorStatus?.status || 'pending';
    const graphState = graphStatus?.status || 'pending';

    // 如果任一正在索引中
    if (vectorState === 'indexing' || graphState === 'indexing') {
      return 'indexing';
    }

    // 如果任一出错
    if (vectorState === 'error' || graphState === 'error') {
      return 'error';
    }

    // 如果都完成
    if (vectorState === 'completed' && graphState === 'completed') {
      return 'completed';
    }

    // 如果都待处理
    if (vectorState === 'pending' && graphState === 'pending') {
      return 'pending';
    }

    // 部分完成
    return 'partial';
  }
}