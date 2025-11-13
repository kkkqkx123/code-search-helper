import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../database/nebula/query/GraphQueryBuilder';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import {
  GraphSearchOptions,
  GraphSearchResult,
  CodeGraphNode,
  CodeGraphRelationship
} from './types';
import { IGraphSearchService } from './IGraphSearchService';

@injectable()
export class GraphSearchServiceNew implements IGraphSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphDatabase: GraphDatabaseService;
  private queryBuilder: GraphQueryBuilder;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.GraphDatabaseService) graphDatabase: GraphDatabaseService,
    @inject(TYPES.GraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphDatabase = graphDatabase;
    this.queryBuilder = queryBuilder;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('初始化图搜索服务');

      // 确保图数据库已初始化
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error('图数据库初始化失败');
        }
      }

      this.isInitialized = true;
      this.logger.info('图搜索服务初始化成功');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`图搜索服务初始化失败: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchServiceNew', operation: 'initialize' }
      );
      return false;
    }
  }

  async search(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    // 根据查询和选项生成缓存键
    const cacheKey = this.generateCacheKey(query, options);

    // 首先尝试从缓存中获取结果
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      this.logger.debug('从缓存中检索到图搜索结果', { cacheKey });
      return cachedResult;
    }

    try {
      this.logger.info('执行图搜索', { query, options });

      // 根据输入构建搜索查询
      const searchQuery = this.buildSearchQuery(query, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result?.nodes || []),
        relationships: this.formatRelationships(result?.relationships || []),
        total: (result?.nodes?.length || 0) + (result?.relationships?.length || 0),
        executionTime: Date.now() - startTime,
      };

      // 如果启用缓存，则缓存结果
      const cacheTTL = this.configService.get('caching').defaultTTL || 300; // 默认5分钟
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);
      this.performanceMonitor.recordQueryExecution(formattedResult.executionTime);

      this.logger.info('图搜索完成', {
        query,
        resultCount: formattedResult.total,
        executionTime: formattedResult.executionTime,
      });

      return formattedResult;
    } catch (error) {
      const errorContext = {
        component: 'GraphSearchServiceNew',
        operation: 'search',
        query,
        options,
        duration: Date.now() - startTime,
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('图搜索失败', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      // 错误情况下返回空结果
      return {
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async searchByNodeType(nodeType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = `nodeType_${nodeType}_${JSON.stringify(options)}`;

    // 首先尝试从缓存中获取结果
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('按节点类型搜索', { nodeType, options });

      const searchQuery = this.buildNodeTypeQuery(nodeType, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result || []),
        relationships: [],
        total: result?.length || 0,
        executionTime: Date.now() - startTime,
      };

      // 缓存结果
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('节点类型搜索失败', {
        nodeType,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async searchByRelationshipType(relationshipType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = `relationshipType_${relationshipType}_${JSON.stringify(options)}`;

    // 首先尝试从缓存中获取结果
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('按关系类型搜索', { relationshipType, options });

      const searchQuery = this.buildRelationshipTypeQuery(relationshipType, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: [],
        relationships: this.formatRelationships(result || []),
        total: result?.length || 0,
        executionTime: Date.now() - startTime,
      };

      // 缓存结果
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('关系类型搜索失败', {
        relationshipType,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async searchByPath(sourceId: string, targetId: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();
    const cacheKey = `path_${sourceId}_${targetId}_${JSON.stringify(options)}`;

    // 首先尝试从缓存中获取结果
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('按路径搜索', { sourceId, targetId, options });

      const searchQuery = this.buildPathQuery(sourceId, targetId, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result?.path?.nodes || []),
        relationships: this.formatRelationships(result?.path?.relationships || []),
        total: (result?.path?.nodes?.length || 0) + (result?.path?.relationships?.length || 0),
        executionTime: Date.now() - startTime,
      };

      // 缓存结果
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('路径搜索失败', {
        sourceId,
        targetId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        nodes: [],
        relationships: [],
        total: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      this.logger.debug('获取搜索建议', { query });

      // 在实际实现中，这将使用更复杂的建议算法
      // 目前，我们将根据查询返回一些模拟建议
      const suggestions: string[] = [];

      if (query.toLowerCase().includes('function')) {
        suggestions.push('函数名', '函数调用', '函数定义');
      }

      if (query.toLowerCase().includes('class')) {
        suggestions.push('类继承', '类方法', '类属性');
      }

      if (query.toLowerCase().includes('import')) {
        suggestions.push('导入路径', '导入模块', '导入依赖');
      }

      if (query.toLowerCase().includes('file')) {
        suggestions.push('文件路径', '文件内容', '文件依赖');
      }

      return suggestions.slice(0, 5); // 返回前5个建议
    } catch (error) {
      this.logger.error('获取搜索建议失败', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  async getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }> {
    const metrics = this.performanceMonitor.getMetrics();
    return {
      totalSearches: metrics.queryExecutionTimes?.length || 0,
      avgExecutionTime: metrics.averageQueryTime || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
    };
  }

  async close(): Promise<void> {
    try {
      this.logger.info('关闭图搜索服务');
      this.isInitialized = false;
      // 如需要，关闭任何资源
      this.logger.info('图搜索服务关闭成功');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`关闭图搜索服务失败: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchServiceNew', operation: 'close' }
      );
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
  async isHealthy(): Promise<boolean> {
    try {
      // 检查服务是否已初始化
      if (!this.isInitialized) {
        return false;
      }

      // 检查Nebula Graph是否已启用
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        // 如果Nebula被禁用，则认为服务健康但性能降级
        this.logger.info('Nebula Graph已禁用，服务处于降级模式');
        return true;
      }

      // 检查图数据库是否已连接
      if (!this.graphDatabase.isDatabaseConnected()) {
        return false;
      }

      // 尝试执行简单查询以验证连接
      await this.graphDatabase.executeReadQuery('SHOW HOSTS', {});

      return true;
    } catch (error) {
      this.logger.error('图服务健康检查失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      // 检查错误是否与Nebula Graph被禁用/未配置有关
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      if (!nebulaEnabled) {
        // 如果Nebula被禁用，则认为服务健康但性能降级
        this.logger.info('尽管健康检查出错，Nebula Graph已禁用，服务处于降级模式');
        return true;
      }

      return false;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const isHealthy = await this.isHealthy();
      const isInitialized = this.isServiceInitialized();
      const isDbConnected = this.graphDatabase.isDatabaseConnected();

      return {
        healthy: isHealthy,
        initialized: isInitialized,
        databaseConnected: isDbConnected,
        serviceType: 'GraphSearchServiceNew',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('获取图服务状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        healthy: false,
        initialized: false,
        databaseConnected: false,
        serviceType: 'GraphSearchServiceNew',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
  private generateCacheKey(query: string, options: GraphSearchOptions): string {
    return `graph_search_${query}_${JSON.stringify(options)}`;
  }

  async createSpace(projectId: string, config?: any): Promise<boolean> {
    try {
      this.logger.info('创建图空间', { projectId, config });

      // 根据配置构建 CREATE SPACE 查询
      const spaceConfig = {
        partition_num: config?.partition_num || 10,
        replica_factor: config?.replica_factor || 1,
        vid_type: config?.vid_type || 'FIXED_STRING(30)',
        charset: config?.charset || 'utf8',
        collate: config?.collate || 'utf8_bin',
        ...config
      };

      const nGQL = `
        CREATE SPACE IF NOT EXISTS \`${projectId}\` (
          partition_num = ${spaceConfig.partition_num},
          replica_factor = ${spaceConfig.replica_factor},
          vid_type = '${spaceConfig.vid_type}',
          charset = '${spaceConfig.charset}',
          collate = '${spaceConfig.collate}'
        )
      `;

      const result = await this.graphDatabase.executeWriteQuery(nGQL, {});

      this.logger.info('图空间创建成功', { projectId });
      return result !== null;
    } catch (error) {
      this.logger.error('创建图空间失败', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async dropSpace(projectId: string): Promise<boolean> {
    try {
      this.logger.info('删除图空间', { projectId });

      const nGQL = `DROP SPACE IF EXISTS \`${projectId}\``;
      const result = await this.graphDatabase.executeWriteQuery(nGQL, {});

      this.logger.info('图空间删除成功', { projectId });
      return result !== null;
    } catch (error) {
      this.logger.error('删除图空间失败', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async clearSpace(projectId: string): Promise<boolean> {
    try {
      this.logger.info('清空图空间', { projectId });

      // 切换到对应的空间
      await this.graphDatabase.executeWriteQuery(`USE \`${projectId}\``, {});

      // 获取所有标签（节点类型）
      const tagResult = await this.graphDatabase.executeReadQuery('SHOW TAGS', {});
      const tags = tagResult?.rows?.map((row: any[]) => row[0]) || [];

      // 获取所有边类型
      const edgeResult = await this.graphDatabase.executeReadQuery('SHOW EDGES', {});
      const edges = edgeResult?.rows?.map((row: any[]) => row[0]) || [];

      // 删除所有边
      for (const edgeType of edges) {
        const deleteEdgesQuery = `MATCH ()-[e:\`${edgeType}\`]->() DELETE e`;
        await this.graphDatabase.executeWriteQuery(deleteEdgesQuery, {});
      }

      // 删除所有节点
      for (const tag of tags) {
        const deleteNodesQuery = `MATCH (n:\`${tag}\`) DELETE n`;
        await this.graphDatabase.executeWriteQuery(deleteNodesQuery, {});
      }

      this.logger.info('图空间清空成功', { projectId });
      return true;
    } catch (error) {
      this.logger.error('清空图空间失败', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getSpaceInfo(projectId: string): Promise<any> {
    try {
      this.logger.info('获取图空间信息', { projectId });

      // 获取空间信息
      const spaceResult = await this.graphDatabase.executeReadQuery('SHOW SPACES', {});
      const spaceInfo = spaceResult?.rows?.find((row: string[]) => row[0] === projectId);

      if (!spaceInfo) {
        throw new Error(`Space ${projectId} does not exist`);
      }

      // 从SHOW SPACES结果中获取空间详细信息
      const spaceName = spaceInfo[0];
      const partitionNum = spaceInfo[1];
      const replicaFactor = spaceInfo[3];

      // 获取更详细的空间信息
      const spaceDetailsResult = await this.graphDatabase.executeReadQuery(`DESCRIBE SPACE \`${projectId}\``, {});
      const spaceDetails = spaceDetailsResult?.rows?.[0];
      const vidType = spaceDetails ? spaceDetails[3] : 'FIXED_STRING(30)'; // 通常在第4列

      // 获取空间状态（在线/离线等）
      const statusResult = await this.graphDatabase.executeReadQuery('SHOW HOSTS', {});
      const onlineHosts = statusResult?.rows?.filter((row: string[]) => row[4] === 'ONLINE').length || 0; // 假设第5列是状态
      const status = onlineHosts > 0 ? 'ready' : 'unavailable';

      // 获取节点和边的总数
      await this.graphDatabase.executeWriteQuery(`USE \`${projectId}\``, {});
      const nodesResult = await this.graphDatabase.executeReadQuery('LOOKUP ON * LIMIT 1', {});
      const nodeCount = nodesResult?.rows?.length || 0;

      const edgesResult = await this.graphDatabase.executeReadQuery('MATCH ()-[e]->() RETURN count(e) AS edgeCount', {});
      const edgeCount = edgesResult?.rows?.[0]?.[0] || 0;

      return {
        spaceName,
        partitionNum,
        replicaFactor,
        vidType,
        status,
        nodeCount,
        edgeCount,
        createdAt: spaceInfo[5] || 'unknown', // 假设第6列是创建时间
        spaceId: spaceInfo[2] || 'unknown' // 假设第3列是空间ID
      };
    } catch (error) {
      this.logger.error('获取图空间信息失败', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async batchInsertNodes(nodes: any[], projectId: string): Promise<any> {
    try {
      this.logger.info('批量插入节点', { projectId, nodeCount: nodes.length });

      if (!nodes || nodes.length === 0) {
        return {
          success: true,
          insertedCount: 0,
          failedCount: 0,
          errors: []
        };
      }

      // 切换到对应的空间
      await this.graphDatabase.executeWriteQuery(`USE \`${projectId}\``, {});

      let insertedCount = 0;
      const errors: string[] = [];
      const batchSize = 100; // 每批处理100个节点

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const insertPromises = batch.map(node => {
          try {
            // 构建INSERT查询
            const nodeId = node.id || node._id || `node_${Date.now()}_${Math.random()}`;
            const nodeType = node.type || node.label || 'default';
            const properties = node.properties || node.props || {};

            // 构建属性字符串
            const propKeys = Object.keys(properties);
            const propNames = propKeys.join(', ');
            const propValues = propKeys.map(key => {
              const value = properties[key];
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "\\'")}'`;
              } else if (typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
              } else {
                return `'${JSON.stringify(value)}'`;
              }
            }).join(', ');

            const nGQL = `
              INSERT VERTEX \`${nodeType}\` (${propNames})
              VALUES "${nodeId}": (${propValues})
            `;

            return this.graphDatabase.executeWriteQuery(nGQL, {});
          } catch (err) {
            errors.push(`Node ${node.id || i}: ${err instanceof Error ? err.message : String(err)}`);
            return Promise.resolve(null);
          }
        });

        const results = await Promise.allSettled(insertPromises);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            insertedCount++;
          } else {
            errors.push(result.reason);
          }
        });
      }

      const failedCount = nodes.length - insertedCount;

      return {
        success: failedCount === 0,
        insertedCount,
        failedCount,
        errors
      };
    } catch (error) {
      this.logger.error('批量插入节点失败', {
        projectId,
        nodeCount: nodes.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async batchInsertEdges(edges: any[], projectId: string): Promise<any> {
    try {
      this.logger.info('批量插入边', { projectId, edgeCount: edges.length });

      if (!edges || edges.length === 0) {
        return {
          success: true,
          insertedCount: 0,
          failedCount: 0,
          errors: []
        };
      }

      // 切换到对应的空间
      await this.graphDatabase.executeWriteQuery(`USE \`${projectId}\``, {});

      let insertedCount = 0;
      const errors: string[] = [];
      const batchSize = 100; // 每批处理100个边

      for (let i = 0; i < edges.length; i += batchSize) {
        const batch = edges.slice(i, i + batchSize);
        const insertPromises = batch.map(edge => {
          try {
            // 构建INSERT查询
            const sourceId = edge.sourceId || edge.src || edge.from;
            const targetId = edge.targetId || edge.dst || edge.to;
            const edgeType = edge.type || edge.edgeType || 'default';
            const properties = edge.properties || edge.props || {};

            // 构建属性字符串
            const propKeys = Object.keys(properties);
            const propNames = propKeys.join(', ');
            const propValues = propKeys.map(key => {
              const value = properties[key];
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "\\'")}'`;
              } else if (typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
              } else {
                return `'${JSON.stringify(value)}'`;
              }
            }).join(', ');

            const nGQL = `
              INSERT EDGE \`${edgeType}\` (${propNames})
              VALUES "${sourceId}" -> "${targetId}": (${propValues})
            `;

            return this.graphDatabase.executeWriteQuery(nGQL, {});
          } catch (err) {
            errors.push(`Edge from ${edge.sourceId} to ${edge.targetId}: ${err instanceof Error ? err.message : String(err)}`);
            return Promise.resolve(null);
          }
        });

        const results = await Promise.allSettled(insertPromises);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            insertedCount++;
          } else {
            errors.push(result.reason);
          }
        });
      }

      const failedCount = edges.length - insertedCount;

      return {
        success: failedCount === 0,
        insertedCount,
        failedCount,
        errors
      };
    } catch (error) {
      this.logger.error('批量插入边失败', {
        projectId,
        edgeCount: edges.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean> {
    try {
      this.logger.info('批量删除节点', { projectId, nodeCount: nodeIds.length });

      if (!nodeIds || nodeIds.length === 0) {
        return true;
      }

      // 切换到对应的空间
      await this.graphDatabase.executeWriteQuery(`USE \`${projectId}\``, {});

      const batchSize = 100; // 每批处理100个节点
      let success = true;
      const errors: string[] = [];

      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        const nodeIdsStr = batch.map(id => `"${id}"`).join(', ');

        try {
          // 删除节点及其关联的边
          const nGQL = `DELETE VERTEX ${nodeIdsStr} WITH EDGE`;
          await this.graphDatabase.executeWriteQuery(nGQL, {});
        } catch (err) {
          success = false;
          errors.push(`Batch ${i / batchSize}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (errors.length > 0) {
        this.logger.warn('批量删除节点部分失败', { projectId, errors });
      } else {
        this.logger.info('节点删除成功', { projectId, nodeCount: nodeIds.length });
      }

      return success;
    } catch (error) {
      this.logger.error('批量删除节点失败', {
        projectId,
        nodeCount: nodeIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
  private buildSearchQuery(query: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    // 默认搜索查询 - 这是一个更加智能的实现
    const { limit = 10, depth = 2, relationshipTypes, nodeTypes, searchType = 'keyword' } = options;

    let nGQL = '';
    const params: Record<string, any> = {};

    // 根据搜索类型构建不同的查询
    switch (searchType) {
      case 'keyword': // 关键词搜索
        // 使用 LOOKUP 语句进行文本搜索
        if (nodeTypes && nodeTypes.length > 0) {
          // 如果指定了节点类型，只在这些类型中搜索
          const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
          nGQL = `
            LOOKUP ON ${nodeTypeClause} WHERE * CONTAINS "${query}"
            YIELD vertex AS node
            LIMIT ${limit}
          `;
        } else {
          // 否则在所有标签中搜索
          nGQL = `
            LOOKUP ON * WHERE * CONTAINS "${query}"
            YIELD vertex AS node
            LIMIT ${limit}
          `;
        }
        break;

      case 'exact': // 精确搜索 - 查找具有特定ID的节点
        nGQL = `
          FETCH PROP ON * "${query}"
          YIELD vertex AS node
        `;
        break;

      case 'neighbor': // 邻居搜索 - 查找与查询节点相关的节点
        if (nodeTypes && nodeTypes.length > 0) {
          const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
          nGQL = `
            GO ${depth} STEPS FROM "${query}" OVER *
            YIELD dst(edge) AS destination
            | FETCH PROP ON ${nodeTypeClause} $-.destination YIELD vertex AS node
            LIMIT ${limit}
          `;
        } else if (relationshipTypes && relationshipTypes.length > 0) {
          const relationshipTypeClause = relationshipTypes.map(type => `\`${type}\``).join(', ');
          nGQL = `
            GO ${depth} STEPS FROM "${query}" OVER ${relationshipTypeClause}
            YIELD dst(edge) AS destination
            | FETCH PROP ON * $-.destination YIELD vertex AS node
            LIMIT ${limit}
          `;
        } else {
          nGQL = `
            GO ${depth} STEPS FROM "${query}" OVER *
            YIELD dst(edge) AS destination
            | FETCH PROP ON * $-.destination YIELD vertex AS node
            LIMIT ${limit}
          `;
        }
        break;

      case 'path': // 路径搜索 - 搜索两个节点之间的路径
        // 这里假设查询格式为 "sourceId,targetId"
        const ids = query.split(',');
        if (ids.length >= 2) {
          const sourceId = ids[0];
          const targetId = ids[1];
          nGQL = `
            FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${depth} STEPS
            YIELD path AS p
            LIMIT ${limit}
          `;
        } else {
          // 如果没有提供目标ID，则搜索从源节点出发的路径
          nGQL = `
            GO ${depth} STEPS FROM "${query}" OVER *
            YIELD path AS p
            LIMIT ${limit}
          `;
        }
        break;

      case 'schema': // 模式搜索 - 根据节点类型或关系类型搜索
        if (nodeTypes && nodeTypes.length > 0) {
          const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
          nGQL = `
            LOOKUP ON ${nodeTypeClause}
            YIELD vertex AS node
            LIMIT ${limit}
          `;
        } else if (relationshipTypes && relationshipTypes.length > 0) {
          const relTypeClause = relationshipTypes.map(type => `\`${type}\``).join(', ');
          nGQL = `
            GO 1 STEPS FROM "${query}" OVER ${relTypeClause}
            YIELD dst(edge) AS destination
            | FETCH PROP ON * $-.destination YIELD vertex AS node
            LIMIT ${limit}
          `;
        } else {
          nGQL = `
            LOOKUP ON * WHERE * CONTAINS "${query}"
            YIELD vertex AS node
            LIMIT ${limit}
          `;
        }
        break;

      default: // 默认关键词搜索
        nGQL = `
          LOOKUP ON * WHERE * CONTAINS "${query}"
          YIELD vertex AS node
          LIMIT ${limit}
        `;
        break;
    }

    return { nGQL, params };
  }

  private buildNodeTypeQuery(nodeType: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { limit = 10 } = options;

    const nGQL = `
      LOOKUP ON \`${nodeType}\`
      YIELD vertex AS node
      LIMIT ${limit}
    `;

    return { nGQL, params: {} };
  }

  private buildRelationshipTypeQuery(relationshipType: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { limit = 10 } = options;

    const nGQL = `
      MATCH ()-[r:\`${relationshipType}\`]->()
      RETURN r
      LIMIT ${limit}
    `;

    return { nGQL, params: {} };
  }

  private buildPathQuery(sourceId: string, targetId: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { depth = 5 } = options;

    const nGQL = `
      FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${depth} STEPS
      YIELD path AS p
    `;

    return { nGQL, params: {} };
  }

  private formatNodes(nodes: any[]): CodeGraphNode[] {
    // 将节点格式化为一致的结构
    return nodes.map(node => {
      // 处理不同格式的节点数据
      let id, type, name, properties;

      if (node.vertex) {
        // NebulaGraph vertex 格式
        id = node.vertex.id || node.vertex._vid || 'unknown';
        type = node.vertex.tag || node.vertex._tag || 'unknown';
        name = node.vertex.name || node.vertex._tag || id;
        properties = node.vertex.props || node.vertex.properties || {};
      } else if (node[0]) {
        // 查询结果的行格式
        id = node[0]?.id || node[0]?._vid || 'unknown';
        type = node[0]?.tag || node[0]?._tag || 'unknown';
        name = node[0]?.name || node[0]?._tag || id;
        properties = node[0]?.props || node[0]?.properties || {};
      } else {
        // 标准格式
        id = node.id || node._id || node.vertex?.id || node.vertex?._vid || 'unknown';
        type = node.type || node.label || node.tag || node.vertex?.tag || 'unknown';
        name = node.name || node.label || id;
        properties = node.properties || node.props || node.vertex?.props || {};
      }

      return {
        id,
        type,
        name,
        properties
      };
    });
  }

  private formatRelationships(relationships: any[]): CodeGraphRelationship[] {
    // 将关系格式化为一致的结构
    return relationships.map(rel => {
      let id, type, sourceId, targetId, properties;

      if (rel.edge) {
        // NebulaGraph edge 格式
        id = rel.edge.id || rel.edge._edgeId || 'unknown';
        type = rel.edge.type || rel.edge.edgeType || rel.edge.name || 'unknown';
        sourceId = rel.edge.src || rel.edge._src || rel.edge.from || 'unknown';
        targetId = rel.edge.dst || rel.edge._dst || rel.edge.to || 'unknown';
        properties = rel.edge.props || rel.edge.properties || {};
      } else if (rel[0]) {
        // 查询结果的行格式
        id = rel[0]?.id || rel[0]?._edgeId || 'unknown';
        type = rel[0]?.type || rel[0]?.edgeType || rel[0]?.name || 'unknown';
        sourceId = rel[0]?.src || rel[0]?._src || rel[0]?.from || 'unknown';
        targetId = rel[0]?.dst || rel[0]?._dst || rel[0]?.to || 'unknown';
        properties = rel[0]?.props || rel[0]?.properties || {};
      } else {
        // 标准格式
        id = rel.id || rel._id || rel.edge?.id || rel.edge?._edgeId || 'unknown';
        type = rel.type || rel.edgeType || rel.name || rel.edge?.type || 'unknown';
        sourceId = rel.source || rel.src || rel.from || rel.edge?.src || rel.edge?.from || 'unknown';
        targetId = rel.target || rel.dst || rel.to || rel.edge?.dst || rel.edge?.to || 'unknown';
        properties = rel.properties || rel.props || rel.edge?.props || {};
      }

      return {
        id,
        type,
        sourceId,
        targetId,
        properties
      };
    });
  }
}