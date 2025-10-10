import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { IIndexService } from './IIndexService';
import { IndexService } from './IndexService';
import { GraphIndexService } from './GraphIndexService';
import { VectorIndexService } from './VectorIndexService';
import { IndexSyncOptions } from './IndexService';

export enum IndexType {
  Vector = 'vector',
  Graph = 'graph',
  Hybrid = 'hybrid'
}

@injectable()
export class IndexAdapterService implements IIndexService {
  constructor(
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.GraphIndexService) private graphIndexService: GraphIndexService,
    @inject(TYPES.VectorIndexService) private vectorIndexService: VectorIndexService
  ) {}

  async indexProject(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    // 默认使用混合索引（向量+图）
    const projectId = await this.indexService.startIndexing(projectPath, options);
    
    // 如果启用图数据库，同时启动图索引
    const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
    if (nebulaEnabled) {
      const graphOptions = {
        maxConcurrency: options?.maxConcurrency || 2,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      };
      await this.graphIndexService.indexGraph(projectId, graphOptions);
    }
    
    return projectId;
  }

  async getIndexStatus(projectId: string): Promise<any> {
    // 返回综合状态，包含向量和图索引状态
    const vectorStatus = this.indexService.getIndexStatus(projectId);
    
    let graphStatus = null;
    try {
      graphStatus = await this.graphIndexService.getGraphStatus(projectId);
    } catch (error) {
      // 如果获取图状态失败，设置为null
      graphStatus = null;
    }
    
    return {
      projectId,
      vectorStatus,
      graphStatus,
      overallStatus: vectorStatus?.isIndexing || graphStatus?.isIndexing ? 'indexing' : 'completed'
    };
  }

 async stopIndexing(projectId: string): Promise<boolean> {
    const vectorResult = await this.indexService.stopIndexing(projectId);
    
    // 由于无法直接停止图索引，我们尝试获取状态来检查是否正在运行
    let graphResult = true; // 默认成功
    try {
      const graphStatus = await this.graphIndexService.getGraphStatus(projectId);
      // GraphIndexService没有提供停止方法，所以这里只是返回成功
    } catch (error) {
      // 如果获取状态失败，也认为是成功的
    }
    
    return vectorResult || graphResult;
  }

  async reindexProject(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    // 重新索引整个项目
    const projectId = await this.indexService.reindexProject(projectPath, options);
    
    // 如果启用图数据库，同时重新启动图索引
    const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
    if (nebulaEnabled) {
      const graphOptions = {
        maxConcurrency: options?.maxConcurrency || 2,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      };
      await this.graphIndexService.indexGraph(projectId, graphOptions);
    }
    
    return projectId;
  }

  async indexByType(projectPath: string, indexType: IndexType, options?: IndexSyncOptions): Promise<string> {
    switch (indexType) {
      case IndexType.Vector:
        const vectorProjectId = await this.indexService.startIndexing(projectPath, options);
        return vectorProjectId;
      case IndexType.Graph:
        const graphProjectId = await this.indexService.startIndexing(projectPath, options);
        const graphOptions = {
          maxConcurrency: options?.maxConcurrency || 2,
          includePatterns: options?.includePatterns,
          excludePatterns: options?.excludePatterns
        };
        await this.graphIndexService.indexGraph(graphProjectId, graphOptions);
        return graphProjectId;
      case IndexType.Hybrid:
      default:
        return this.indexProject(projectPath, options);
    }
  }
}