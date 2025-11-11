import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { IIndexService } from './IIndexService';
import { IndexService } from './IndexService';
import { GraphIndexService } from './GraphIndexService';
import { IndexSyncOptions } from './IndexService';

export enum IndexType {
  Vector = 'vector',
  Graph = 'graph',
  Hybrid = 'hybrid'
}

@injectable()
export class HybridIndexService implements IIndexService {
  constructor(
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.GraphIndexService) private graphIndexService: GraphIndexService
  ) { }

  private async startGraphIndexingIfEnabled(projectId: string, projectPath: string, options?: IndexSyncOptions): Promise<void> {
    const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
    if (nebulaEnabled) {
      await this.graphIndexService.startIndexing(projectPath, {
        ...options,
        enableGraphIndex: true
      });
    }
  }

  async startIndexing(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    // 启动混合索引（向量+图）
    const projectId = await this.indexService.startIndexing(projectPath, options);
    await this.startGraphIndexingIfEnabled(projectId, projectPath, options);
    return projectId;
  }

  async indexProject(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    // 默认使用混合索引（向量+图）
    return this.startIndexing(projectPath, options);
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
    const graphResult = await this.graphIndexService.stopIndexing(projectId);

    return vectorResult || graphResult;
  }

  async reindexProject(projectPath: string, options?: IndexSyncOptions): Promise<string> {
    // 重新索引整个项目
    const projectId = await this.indexService.reindexProject(projectPath, options);
    await this.startGraphIndexingIfEnabled(projectId, projectPath, options);
    return projectId;
  }

  async indexByType(projectPath: string, indexType: IndexType, options?: IndexSyncOptions): Promise<string> {
    switch (indexType) {
      case IndexType.Vector:
        return this.indexService.startIndexing(projectPath, options);
      case IndexType.Graph:
        const graphProjectId = await this.indexService.startIndexing(projectPath, options);
        await this.startGraphIndexingIfEnabled(graphProjectId, projectPath, options);
        return graphProjectId;
      case IndexType.Hybrid:
      default:
        return this.startIndexing(projectPath, options);
    }
  }
}