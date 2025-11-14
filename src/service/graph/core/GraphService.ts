import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaSpaceManager } from '../../../database/nebula/space/NebulaSpaceManager';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { IGraphService } from './IGraphService';
import { IGraphRepository } from '../repository/IGraphRepository';

/**
 * 图服务 - 使用Repository层架构
 * 职责：通过Repository层访问数据，不直接依赖数据库层组件
 */
@injectable()
export class GraphService implements IGraphService {
  private currentSpace: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.IGraphRepository) private repository: IGraphRepository,
    @inject(TYPES.NebulaSpaceManager) private spaceManager: NebulaSpaceManager,
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) private performanceMonitor: IPerformanceMonitor
  ) {}

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph service');

      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.logger.info('Graph service is disabled via NEBULA_ENABLED environment variable');
        return true;
      }

      this.performanceMonitor.startPeriodicMonitoring?.();
      this.logger.info('Graph service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'initialize' });
      return false;
    }
  }

  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, parameters);

    const cachedResult = this.cacheService.getFromCache<any>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate?.(true);
      return cachedResult;
    }

    try {
      const result = await this.repository.executeQuery(query, parameters);
      if (result) {
        this.cacheService.setCache(cacheKey, result, 300000);
      }

      this.performanceMonitor.recordQueryExecution?.(Date.now() - startTime);
      this.performanceMonitor.updateCacheHitRate?.(false);
      return result;
    } catch (error) {
      this.performanceMonitor.recordQueryExecution?.(Date.now() - startTime);
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'executeReadQuery' });
      throw error;
    }
  }

  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    try {
      const result = await this.repository.executeQuery(query, parameters);
      this.performanceMonitor.recordQueryExecution?.(Date.now() - startTime);
      this.invalidateRelatedCache(query);
      return result;
    } catch (error) {
      this.performanceMonitor.recordQueryExecution?.(Date.now() - startTime);
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'executeWriteQuery' });
      throw error;
    }
  }

  async executeBatch(queries: Array<{ nGQL: string; parameters?: Record<string, any> }>): Promise<any> {
    const startTime = Date.now();
    try {
      const batchQueries = queries.map(q => ({ query: q.nGQL, params: q.parameters }));
      const results = await this.repository.executeBatchQuery(batchQueries);
      return { success: true, results, executionTime: Date.now() - startTime };
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'executeBatch' });
      return { success: false, results: [], error: (error as Error).message, executionTime: Date.now() - startTime };
    }
  }

  async useSpace(spaceName: string): Promise<void> {
    await this.repository.executeQuery(`USE \`${spaceName}\``, {});
    this.currentSpace = spaceName;
  }

  async createSpace(spaceName: string, options?: any): Promise<boolean> {
    return await this.spaceManager.createSpace(spaceName, options);
  }

  async deleteSpace(spaceName: string): Promise<boolean> {
    return await this.spaceManager.deleteSpace(spaceName);
  }

  async spaceExists(spaceName: string): Promise<boolean> {
    return await this.spaceManager.checkSpaceExists(spaceName);
  }

  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      const nodeData = nodes.map(n => ({ id: n.id, label: n.label, properties: n.properties }));
      await this.repository.createNodes(nodeData);
      return { success: true, insertedCount: nodes.length, failedCount: 0, errors: [] };
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'batchInsertNodes' });
      return { success: false, insertedCount: 0, failedCount: nodes.length, errors: [(error as Error).message] };
    }
  }

  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      const edgeData = edges.map(e => ({ 
        type: e.type, 
        sourceId: e.sourceId, 
        targetId: e.targetId, 
        properties: e.properties 
      }));
      await this.repository.createRelationships(edgeData);
      return { success: true, insertedCount: edges.length, failedCount: 0, errors: [] };
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'batchInsertEdges' });
      return { success: false, insertedCount: 0, failedCount: edges.length, errors: [(error as Error).message] };
    }
  }

  async batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean> {
    try {
      await this.useSpace(projectId);
      await Promise.all(nodeIds.map(id => this.repository.deleteNode(id)));
      return true;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphService', operation: 'batchDeleteNodes' });
      return false;
    }
  }

  async clearSpace(projectId: string): Promise<boolean> {
    return await this.spaceManager.clearSpace(projectId);
  }

  async getSpaceInfo(projectId: string): Promise<any> {
    return await this.spaceManager.getSpaceInfo(projectId);
  }

  async getDatabaseStats(): Promise<any> {
    const stats = await this.repository.getGraphStats();
    return {
      ...stats,
      performance: this.performanceMonitor.getMetrics?.() || {},
      cache: this.cacheService.getCacheStats(),
      currentSpace: this.currentSpace,
      isConnected: this.isDatabaseConnected()
    };
  }

  getCurrentSpace(): string | null {
    return this.currentSpace;
  }

  isDatabaseConnected(): boolean {
    return true;
  }

  async close(): Promise<void> {
    this.performanceMonitor.stopPeriodicMonitoring?.();
  }

  private generateCacheKey(query: string, parameters: Record<string, any>): string {
    return `${this.currentSpace}_${query}_${JSON.stringify(parameters)}`.replace(/\s+/g, '_');
  }

  private invalidateRelatedCache(query: string): void {
    if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
      // 清除缓存逻辑
    }
  }

  async analyzeDependencies(filePath: string, projectId: string, options?: any): Promise<any> {
    const query = `MATCH (file:File {path: "${filePath}"})-[:IMPORTS|CONTAINS*1..3]->(related) RETURN file, related LIMIT 50`;
    return await this.executeReadQuery(query);
  }

  async detectCircularDependencies(projectId: string): Promise<any> {
    const query = `MATCH (v1)-[:IMPORTS*2..]->(v1) RETURN DISTINCT v1.id AS nodeId LIMIT 100`;
    return await this.executeReadQuery(query);
  }

  async analyzeCallGraph(functionName: string, projectId: string, options?: any): Promise<any> {
    const query = `MATCH (func:Function {name: "${functionName}"})-[:CALLS*1..3]->(called:Function) RETURN func, called LIMIT 50`;
    return await this.executeReadQuery(query);
  }

  async analyzeImpact(nodeIds: string[], projectId: string, options?: any): Promise<any> {
    const nodeIdList = nodeIds.map(id => `"${id}"`).join(', ');
    const query = `MATCH (start)-[:CALLS|CONTAINS|IMPORTS*1..3]->(affected) WHERE start.id IN [${nodeIdList}] RETURN DISTINCT affected LIMIT 100`;
    return await this.executeReadQuery(query);
  }

  async getProjectOverview(projectId: string): Promise<any> {
    await this.useSpace(projectId);
    return await this.executeReadQuery(`MATCH (v) RETURN v.type AS nodeType, count(*) AS count`);
  }

  async getStructureMetrics(projectId: string): Promise<any> {
    await this.useSpace(projectId);
    return await this.repository.getGraphStats();
  }

  async getGraphStats(projectId: string): Promise<any> {
    return await this.getStructureMetrics(projectId);
  }

  async executeRawQuery(query: string, parameters?: Record<string, any>): Promise<any> {
    return await this.executeReadQuery(query, parameters);
  }

  async findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number): Promise<any> {
    return await this.repository.findRelatedNodes(nodeId, { edgeTypes: relationshipTypes, maxDepth });
  }

  async findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<any> {
    return await this.repository.findPath(sourceId, targetId, maxDepth);
  }

  async search(query: string, options?: any): Promise<any> {
    const searchQuery = `MATCH (v) WHERE v.name CONTAINS "${query}" RETURN v AS node LIMIT ${options?.limit || 100}`;
    return await this.executeReadQuery(searchQuery);
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    const suggestions: string[] = [];
    if (query.toLowerCase().includes('function')) suggestions.push('函数名', '函数调用', '函数定义');
    if (query.toLowerCase().includes('class')) suggestions.push('类继承', '类方法', '类属性');
    return suggestions.slice(0, 5);
  }

  async isHealthy(): Promise<boolean> {
    return this.isDatabaseConnected();
  }

  async getStatus(): Promise<any> {
    return { connected: this.isDatabaseConnected(), currentSpace: this.getCurrentSpace(), timestamp: new Date().toISOString() };
  }

  async dropSpace(projectId: string): Promise<boolean> {
    return await this.deleteSpace(projectId);
  }
}