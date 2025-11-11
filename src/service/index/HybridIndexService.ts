import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { IIndexService } from './IIndexService';
import { IndexService } from './IndexService';
import { GraphIndexService } from './GraphIndexService';
import { IndexSyncOptions, IndexOptions } from './IIndexService';
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { IGraphIndexPerformanceMonitor } from '../../infrastructure/monitoring/GraphIndexMetrics';

export enum IndexType {
  Vector = 'vector',
  Graph = 'graph',
  Hybrid = 'hybrid'
}

@injectable()
export class HybridIndexService implements IIndexService {
  constructor(
    @inject(TYPES.IndexService) private indexService: IndexService,
    @inject(TYPES.GraphIndexService) private graphIndexService: GraphIndexService,
    @inject(TYPES.InfrastructureConfigService) private configService: InfrastructureConfigService,
    @inject(TYPES.GraphIndexPerformanceMonitor) private performanceMonitor: IGraphIndexPerformanceMonitor
  ) { }

  private async startGraphIndexingIfEnabled(projectId: string, projectPath: string, options?: IndexOptions): Promise<void> {
    const graphEnabled = this.configService.isGraphEnabled();
    if (graphEnabled) {
      await this.graphIndexService.startIndexing(projectPath, {
        ...options,
        enableGraphIndex: true
      });
    }
  }

  async startIndexing(projectPath: string, options?: IndexOptions): Promise<string> {
    const operationId = `hybrid_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // 1. 配置验证（复用 InfrastructureConfigService）
      await this.validateConfiguration(options);
      
      // 2. 智能索引策略
      const strategy = await this.determineIndexingStrategy(projectPath, options);
      
      // 3. 协调执行
      return await this.executeIndexingStrategy(projectPath, strategy, options);
    } catch (error) {
      this.performanceMonitor.recordMetric({
        operation: 'startIndexing',
        projectId: projectPath,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        success: false,
        metadata: {
          errorMessage: (error as Error).message,
          errorType: (error as Error).constructor.name
        }
      });
      throw error;
    }
  }

  /**
   * 验证配置
   */
  private async validateConfiguration(options?: IndexOptions): Promise<void> {
    if (options?.enableGraphIndex !== false) {
      // 复用 InfrastructureConfigService 的配置验证
      this.configService.validateGraphConfiguration();
    }
  }

  /**
   * 确定索引策略
   */
  private async determineIndexingStrategy(projectPath: string, options?: IndexOptions): Promise<string> {
    const isGraphEnabled = this.configService.isGraphEnabled();
    
    // 检查显式选项
    if (options?.enableGraphIndex === false) {
      return 'vector-only';
    }
    
    // 检查环境变量配置
    const defaultStrategy = process.env.DEFAULT_INDEXING_STRATEGY?.toLowerCase() || 'hybrid';
    
    switch (defaultStrategy) {
      case 'vector':
        return 'vector-only';
      case 'hybrid':
      default:
        // 混合策略需要图数据库启用，否则回退到向量索引
        return isGraphEnabled ? 'hybrid' : 'vector-only';
    }
  }

  /**
   * 执行索引策略
   */
  private async executeIndexingStrategy(projectPath: string, strategy: string, options?: IndexOptions): Promise<string> {
    switch (strategy) {
      case 'vector-only':
        return await this.indexService.startIndexing(projectPath, options);
      
      case 'hybrid':
      default:
        // 启动混合索引（向量+图）
        const projectId = await this.indexService.startIndexing(projectPath, options);
        await this.startGraphIndexingIfEnabled(projectId, projectPath, options);
        return projectId;
    }
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
        // Graph 类型现在等同于混合索引，因为图索引需要向量索引作为基础
        return this.startIndexing(projectPath, options);
      case IndexType.Hybrid:
      default:
        return this.startIndexing(projectPath, options);
    }
  }
}