import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaClient } from '../../../database/nebula/client/NebulaClient';
import { NebulaSpaceManager } from '../../../database/nebula/space/NebulaSpaceManager';
import { NebulaConnectionManager } from '../../../database/nebula/NebulaConnectionManager';
import { NebulaDataBatchProcessor } from '../../../database/nebula/batch/NebulaDataBatchProcessor';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { IGraphService } from './IGraphService';

/**
 * 统一的图服务入口
 * 职责：协调各个图服务，直接使用 database/nebula 层组件
 * 移除了 GraphDatabaseService 的中间抽象层
 */
@injectable()
export class GraphService implements IGraphService {
  private nebulaClient: NebulaClient;
  private spaceManager: NebulaSpaceManager;
  private connectionManager: NebulaConnectionManager;
  private batchProcessor: NebulaDataBatchProcessor;
  private cacheService: ICacheService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private performanceMonitor: IPerformanceMonitor;
  private currentSpace: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaClient) nebulaClient: NebulaClient,
    @inject(TYPES.NebulaSpaceManager) spaceManager: NebulaSpaceManager,
    @inject(TYPES.NebulaConnectionManager) connectionManager: NebulaConnectionManager,
    @inject(TYPES.NebulaDataBatchProcessor) batchProcessor: NebulaDataBatchProcessor,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaClient = nebulaClient;
    this.spaceManager = spaceManager;
    this.connectionManager = connectionManager;
    this.batchProcessor = batchProcessor;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * 初始化图服务
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph service');

      // 检查NEBULA_ENABLED环境变量
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        this.logger.info('Graph service is disabled via NEBULA_ENABLED environment variable');
        return true;
      }

      // 初始化性能监控
      this.performanceMonitor.startPeriodicMonitoring?.();

      // 验证连接状态
      const connectionStatus = this.connectionManager.getConnectionStatus();
      if (!connectionStatus.connected) {
        this.logger.warn('Nebula connection manager reports not connected, service will continue in degraded mode');
      }

      // 初始化缓存服务
      try {
        const cacheStats = this.cacheService.getCacheStats();
        this.logger.debug('Cache service initialized', { stats: cacheStats });
      } catch (error) {
        this.logger.warn('Cache service initialization failed, caching will be disabled');
      }

      this.logger.info('Graph service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * 执行读查询（带缓存）
   */
  async executeReadQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, parameters);

    // 检查缓存
    const cachedResult = this.cacheService.getFromCache<any>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate?.(true);
      this.logger.debug('Cache hit for read query', { query: query.substring(0, 100) });
      return cachedResult;
    }

    try {
      const result = await this.nebulaClient.execute(query, parameters);

      // 缓存结果
      if (result) {
        this.cacheService.setCache(cacheKey, result, 300000); // 5分钟
      }

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);
      this.performanceMonitor.updateCacheHitRate?.(false);

      this.logger.debug('Read query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute read query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeReadQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 执行写查询
   */
  async executeWriteQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.nebulaClient.execute(query, parameters);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      // 使相关缓存失效
      this.invalidateRelatedCache(query);

      this.logger.debug('Write query executed successfully', {
        query: query.substring(0, 100),
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Failed to execute write query: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeWriteQuery',
          query: query.substring(0, 100),
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 批量执行查询
   */
  async executeBatch(queries: Array<{ nGQL: string; parameters?: Record<string, any> }>): Promise<any> {
    const startTime = Date.now();

    try {
      const batchQueries = queries.map(q => ({ query: q.nGQL, params: q.parameters }));
      const results = await this.nebulaClient.executeBatch(batchQueries);

      return {
        success: true,
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to execute batch queries: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphService',
          operation: 'executeBatch',
          queryCount: queries.length,
        }
      );

      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 切换空间
   */
  async useSpace(spaceName: string): Promise<void> {
    try {
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``, {});
      this.currentSpace = spaceName;
      this.logger.debug('Switched to space', { spaceName });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to switch to space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'useSpace' }
      );
      throw error;
    }
  }

  /**
   * 创建空间
   */
  async createSpace(spaceName: string, options?: any): Promise<boolean> {
    try {
      const created = await this.spaceManager.createSpace(spaceName, options);
      if (created) {
        this.logger.info('Space created successfully', { spaceName });
      }
      return created;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to create space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'createSpace' }
      );
      return false;
    }
  }

  /**
   * 删除空间
   */
  async deleteSpace(spaceName: string): Promise<boolean> {
    try {
      const deleted = await this.spaceManager.deleteSpace(spaceName);
      if (deleted) {
        this.logger.info('Space deleted successfully', { spaceName });
      }
      return deleted;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to delete space ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'deleteSpace' }
      );
      return false;
    }
  }

  /**
   * 检查空间是否存在
   */
  async spaceExists(spaceName: string): Promise<boolean> {
    try {
      return await this.spaceManager.checkSpaceExists(spaceName);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check if space exists ${spaceName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'spaceExists' }
      );
      return false;
    }
  }

  /**
   * 批量插入节点
   */
  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      await this.batchProcessor.batchInsertNodes(nodes);
      
      return {
        success: true,
        insertedCount: nodes.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'batchInsertNodes' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: nodes.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * 批量插入边
   */
  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    try {
      await this.useSpace(projectId);
      await this.batchProcessor.insertRelationships(edges);
      
      return {
        success: true,
        insertedCount: edges.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch insert edges: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'batchInsertEdges' }
      );
      
      return {
        success: false,
        insertedCount: 0,
        failedCount: edges.length,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * 批量删除节点
   */
  async batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean> {
    try {
      await this.useSpace(projectId);
      
      // 构建删除查询
      const nodeIdsStr = nodeIds.map(id => `"${id}"`).join(', ');
      const deleteQuery = `DELETE VERTEX ${nodeIdsStr} WITH EDGE`;
      
      await this.connectionManager.executeQuery(deleteQuery, {});
      
      this.logger.info('Nodes deleted successfully', { projectId, nodeCount: nodeIds.length });
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to batch delete nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'batchDeleteNodes' }
      );
      return false;
    }
  }

  /**
   * 清空空间
   */
  async clearSpace(projectId: string): Promise<boolean> {
    try {
      this.logger.info('Clearing space', { projectId });
      const cleared = await this.spaceManager.clearSpace(projectId);
      if (cleared) {
        this.logger.info('Space cleared successfully', { projectId });
      }
      return cleared;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to clear space ${projectId}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'clearSpace' }
      );
      return false;
    }
  }

  /**
   * 获取空间信息
   */
  async getSpaceInfo(projectId: string): Promise<any> {
    try {
      this.logger.info('Getting space info', { projectId });
      const spaceInfo = await this.spaceManager.getSpaceInfo(projectId);
      return spaceInfo;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get space info for ${projectId}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'getSpaceInfo' }
      );
      return null;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const nebulaStats = await this.nebulaClient.getStats();
      const performanceStats = this.performanceMonitor.getMetrics?.() || {};
      const cacheStats = this.cacheService.getCacheStats();

      return {
        ...nebulaStats,
        performance: performanceStats,
        cache: cacheStats,
        currentSpace: this.currentSpace,
        isConnected: this.isDatabaseConnected(),
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'getDatabaseStats' }
      );
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取当前空间
   */
  getCurrentSpace(): string | null {
    return this.currentSpace;
  }

  /**
   * 检查数据库连接状态
   */
  isDatabaseConnected(): boolean {
    const connectionStatus = this.connectionManager.getConnectionStatus();
    return connectionStatus.connected;
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph service');

      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring?.();

      // 关闭Nebula客户端
      await this.nebulaClient.close();

      this.logger.info('Graph service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'close' }
      );
      throw error;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, parameters: Record<string, any>): string {
    const paramString = JSON.stringify(parameters || {});
    return `${this.currentSpace}_${query}_${paramString}`.replace(/\s+/g, '_');
  }

  /**
   * 使相关缓存失效
   */
  private invalidateRelatedCache(query: string): void {
    // 简单的缓存失效基于查询类型
    if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
      // 清除当前空间的所有缓存
      if (this.currentSpace) {
        this.logger.warn('Cache clearing by pattern not implemented', { currentSpace: this.currentSpace });
      }
    }
  }

  // 分析方法实现
  async analyzeDependencies(filePath: string, projectId: string, options?: any): Promise<any> {
    // 简化实现，实际应该委托给GraphAnalysisService
    const query = `
      MATCH (file:File {path: "${filePath}"})-[:IMPORTS|CONTAINS*1..3]->(related)
      RETURN file, related, type(relationship(file, related)) AS relationType
      LIMIT 50
    `;
    return await this.executeReadQuery(query);
  }

  async detectCircularDependencies(projectId: string): Promise<any> {
    const query = `
      MATCH (v1)-[:IMPORTS*2..]->(v1)
      RETURN DISTINCT v1.id AS nodeId, v1.name AS nodeName
      LIMIT 100
    `;
    return await this.executeReadQuery(query);
  }

  async analyzeCallGraph(functionName: string, projectId: string, options?: any): Promise<any> {
    const query = `
      MATCH (func:Function {name: "${functionName}"})-[:CALLS*1..3]->(called:Function)
      RETURN func, called, length(path((func)-[:CALLS*]->(called))) AS depth
      LIMIT 50
    `;
    return await this.executeReadQuery(query);
  }

  async analyzeImpact(nodeIds: string[], projectId: string, options?: any): Promise<any> {
    const nodeIdList = nodeIds.map(id => `"${id}"`).join(', ');
    const maxDepth = options?.depth || 3;
    const query = `
      MATCH (start)-[:CALLS|CONTAINS|IMPORTS*1..${maxDepth}]->(affected)
      WHERE start.id IN [${nodeIdList}]
      RETURN DISTINCT affected.id, affected.name, affected.type
      LIMIT 100
    `;
    return await this.executeReadQuery(query);
  }

  async getProjectOverview(projectId: string): Promise<any> {
    await this.useSpace(projectId);
    const statsQuery = `
      MATCH (v)
      RETURN v.type AS nodeType, count(*) AS count
    `;
    return await this.executeReadQuery(statsQuery);
  }

  async getStructureMetrics(projectId: string): Promise<any> {
    await this.useSpace(projectId);
    const query = `
      MATCH (f:File)
      OPTIONAL MATCH (f)-[:CONTAINS]->(func:Function)
      OPTIONAL MATCH (f)-[:CONTAINS]->(cls:Class)
      OPTIONAL MATCH (f)-[:IMPORTS]->(imp:Import)
      RETURN 
        count(DISTINCT f) AS fileCount,
        count(DISTINCT func) AS functionCount,
        count(DISTINCT cls) AS classCount,
        count(DISTINCT imp) AS importCount
    `;
    return await this.executeReadQuery(query);
  }

  async getGraphStats(projectId: string): Promise<any> {
    return await this.getStructureMetrics(projectId);
  }

  // 查询方法实现
  async executeRawQuery(query: string, parameters?: Record<string, any>): Promise<any> {
    return await this.executeReadQuery(query, parameters);
  }

  async findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number): Promise<any> {
    const edgeTypes = relationshipTypes?.join(',') || '*';
    const depth = maxDepth || 2;
    const query = `
      GO ${depth} STEPS FROM "${nodeId}" OVER ${edgeTypes}
      YIELD dst(edge) AS relatedNodeId
      | FETCH PROP ON * $-.relatedNodeId YIELD vertex AS relatedNode
      LIMIT 100
    `;
    return await this.executeReadQuery(query);
  }

  async findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<any> {
    const depth = maxDepth || 5;
    const query = `
      FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER *
      YIELD path AS p
      RETURN p
    `;
    return await this.executeReadQuery(query);
  }

  async search(query: string, options?: any): Promise<any> {
    const limit = options?.limit || 100;
    const searchQuery = `
      MATCH (v)
      WHERE v.name CONTAINS "${query}" OR v.properties.name CONTAINS "${query}"
      RETURN v AS node
      LIMIT ${limit}
    `;
    return await this.executeReadQuery(searchQuery);
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    // 简单的建议实现
    const suggestions: string[] = [];
    if (query.toLowerCase().includes('function')) {
      suggestions.push('函数名', '函数调用', '函数定义');
    }
    if (query.toLowerCase().includes('class')) {
      suggestions.push('类继承', '类方法', '类属性');
    }
    return suggestions.slice(0, 5);
  }

  // 健康检查实现
  async isHealthy(): Promise<boolean> {
    return this.isDatabaseConnected();
  }

  async getStatus(): Promise<any> {
    return {
      connected: this.isDatabaseConnected(),
      currentSpace: this.getCurrentSpace(),
      timestamp: new Date().toISOString()
    };
  }

  // 空间管理扩展
  async dropSpace(projectId: string): Promise<boolean> {
    return await this.deleteSpace(projectId);
  }
}