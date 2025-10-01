import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaService } from '../../../database/NebulaService';
import { NebulaQueryBuilder } from '../../../database/nebula/NebulaQueryBuilder';
import { NebulaSpaceManager } from '../../../database/nebula/NebulaSpaceManager';
import { GraphCacheService } from '../cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../performance/GraphBatchOptimizer';
import { GraphQueryBuilder } from '../query/GraphQueryBuilder';
import { GraphPersistenceUtils } from '../utils/GraphPersistenceUtils';
import {
  GraphPersistenceOptions,
  GraphPersistenceResult,
  CodeGraphNode,
  CodeGraphRelationship,
  GraphQuery,
  GraphAnalysisResult
} from './types';

@injectable()
export class GraphPersistenceService {
  private nebulaService: NebulaService;
  private nebulaSpaceManager: NebulaSpaceManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private queryBuilder: NebulaQueryBuilder;
  private cacheService: GraphCacheService;
  private performanceMonitor: GraphPerformanceMonitor;
  private batchOptimizer: GraphBatchOptimizer;
  private enhancedQueryBuilder: GraphQueryBuilder;
  private persistenceUtils: GraphPersistenceUtils;
  private isInitialized: boolean = false;
  private currentSpace: string = '';
  private defaultCacheTTL: number = 3000; // 5 minutes default
  private processingTimeout: number = 300000; // 5 minutes default
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // 1 second default

  constructor(
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.INebulaSpaceManager) nebulaSpaceManager: NebulaSpaceManager,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.INebulaQueryBuilder) queryBuilder: NebulaQueryBuilder,
    @inject(TYPES.GraphCacheService) cacheService: GraphCacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.GraphQueryBuilder) enhancedQueryBuilder: GraphQueryBuilder,
    @inject(TYPES.GraphPersistenceUtils) persistenceUtils: GraphPersistenceUtils
  ) {
    this.nebulaService = nebulaService;
    this.nebulaSpaceManager = nebulaSpaceManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.queryBuilder = queryBuilder;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.batchOptimizer = batchOptimizer;
    this.enhancedQueryBuilder = enhancedQueryBuilder;
    this.persistenceUtils = persistenceUtils;

    this.initializeServices();
  }

  private generateSpaceName(projectId: string): string {
    return this.persistenceUtils.generateSpaceName(projectId);
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.nebulaService.isConnected()) {
        const connected = await this.nebulaService.initialize();
        if (!connected) {
          throw new Error('Failed to connect to NebulaGraph');
        }
      }

      this.isInitialized = true;

      this.logger.info('Graph persistence service initialized');
      return true;
    } catch (error) {
      // 更详细地处理错误对象，确保能正确提取错误信息
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // 如果error是一个对象，尝试提取有用的信息
        try {
          errorMessage = JSON.stringify(error);
        } catch (stringifyError) {
          // 如果JSON.stringify失败，使用toString方法
          errorMessage = Object.prototype.toString.call(error);
        }
      } else {
        errorMessage = String(error);
      }

      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'initialize',
        retryCount: 0,
      };

      this.errorHandler.handleError(
        new Error(`Failed to initialize graph persistence: ${errorMessage}`),
        errorContext
      );

      this.logger.error('Failed to initialize graph persistence', {
        error: errorMessage,
      });

      // Re-throw the error to ensure it's properly handled by the calling code
      throw new Error(`Failed to initialize graph persistence: ${errorMessage}`);
    }
  }

  async initializeProjectSpace(projectId: string): Promise<boolean> {
    try {
      const spaceName = this.generateSpaceName(projectId);
      this.currentSpace = spaceName;
      // 检查空间是否存在，如果不存在则创建
      const spaceExists = await this.nebulaSpaceManager.checkSpaceExists(projectId);
      if (!spaceExists) {
        // 获取配置
        const config = this.configService.get('nebula') || ({} as any);
        await this.nebulaSpaceManager.createSpace(projectId, {
          partitionNum: (config as any).partitionNum || 10,
          replicaFactor: (config as any).replicaFactor || 1,
          vidType: (config as any).vidType || 'FIXED_STRING(32)',
        });
      }

      // 切换到项目空间
      await this.nebulaService.useSpace(spaceName);

      this.logger.info(`Initialized project space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'initializeProjectSpace',
        projectId,
        retryCount: 0,
      };

      this.errorHandler.handleError(
        new Error(
          `Failed to initialize project space: ${error instanceof Error ? error.message : String(error)}`
        ),
        errorContext
      );

      this.logger.error('Failed to initialize project space', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
      });
      return false;
    }
  }

  async storeParsedFiles(
    files: any[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `storeParsedFiles_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(files.length);
    const useCache = options.useCache !== false;
    const cacheTTL = options.cacheTTL || this.defaultCacheTTL;

    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      // Use enhanced batch processing with NebulaQueryBuilder
      const batchResult = await this.processFilesWithEnhancedBatching(
        files,
        options,
        batchSize,
        useCache,
        cacheTTL
      );

      result.success = batchResult.success;
      result.nodesCreated = batchResult.nodesCreated;
      result.relationshipsCreated = batchResult.relationshipsCreated;
      result.nodesUpdated = batchResult.nodesUpdated;
      result.processingTime = Date.now() - startTime;

      // Update performance metrics
      this.performanceMonitor.updateCacheHitRate(true);
      this.performanceMonitor.updateBatchSize(batchSize);

      if (result.success) {
        this.logger.info('Files stored in graph successfully', {
          fileCount: files.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
          batchSize,
          cacheEnabled: useCache,
          cacheHitRate: this.performanceMonitor.getMetrics().cacheHitRate,
        });
      }
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'storeParsedFiles',
        fileCount: files.length,
        duration: Date.now() - startTime,
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      result.errors.push(`Storage failed: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error('Failed to store parsed files', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  async storeChunks(
    chunks: any[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `storeChunks_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(chunks.length);

    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      const queries: GraphQuery[] = [];

      for (const chunk of chunks) {
        const chunkQueries = this.persistenceUtils.createChunkQueries(chunk, options);
        queries.push(...chunkQueries);
      }

      const results: GraphPersistenceResult[] = [];

      // Process queries in optimized batches with retry logic
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);

        // Check memory usage before processing each batch
        if (!this.checkMemoryUsage()) {
          throw new Error('Insufficient memory available for batch processing');
        }

        const batchResult = await this.processWithTimeout(
          () => this.persistenceUtils.retryOperation(() => this.executeBatch(batch)),
          this.batchOptimizer.getConfig().processingTimeout
        );

        results.push(batchResult as GraphPersistenceResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.info('Chunks stored in graph successfully', {
          chunkCount: chunks.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
          batchSize,
        });
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to store chunks: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphPersistenceService', operation: 'storeChunks' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store chunks', { errorId: report.id });
    }

    return result;
  }

  private async processWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth: number = 2
  ): Promise<CodeGraphNode[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const edgeTypes =
        relationshipTypes && relationshipTypes.length > 0 ? relationshipTypes.join(',') : '*'; // Use * to match all edge types

      const query: GraphQuery = {
        nGQL: `
          GO FROM "${nodeId}" OVER ${edgeTypes}
          YIELD dst(edge) AS destination
          | FETCH PROP ON * $-.destination YIELD vertex AS related
          LIMIT 100
        `,
        parameters: {},
      };

      const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);
      if (result && Array.isArray(result)) {
        return result.map((record: any) =>
          this.recordToGraphNode(record.related || record.vertex || record)
        );
      }
      return [];
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to find related nodes: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphPersistenceService', operation: 'findRelatedNodes' }
      );
      this.logger.error('Failed to find related nodes', { errorId: report.id, nodeId });
      return [];
    }
  }

  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<CodeGraphRelationship[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: GraphQuery = {
        nGQL: `
          FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${maxDepth} STEPS
          YIELD path as p
        `,
        parameters: {},
      };

      const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);
      // 这里需要根据NebulaGraph的返回结果格式进行调整
      // NebulaGraph的最短路径查询返回格式与Neo4j不同，需要重新实现
      // For now, we'll return an empty array as the implementation would be complex
      // A full implementation would need to parse the path result and convert it to CodeGraphRelationship[]
      return [];
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to find path: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'findPath' }
      );
      this.logger.error('Failed to find path', { errorId: report.id, sourceId, targetId });
      return [];
    }
  }

  async getGraphStats(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache first
    const cachedStats = this.cacheService.getGraphStatsCache();
    if (cachedStats) {
      this.performanceMonitor.updateCacheHitRate(true);
      // Convert GraphAnalysisResult to the expected return type
      return {
        nodeCount: cachedStats.metrics.totalNodes,
        relationshipCount: cachedStats.metrics.totalEdges,
        nodeTypes: {},
        relationshipTypes: {},
      };
    }

    try {
      // Get enhanced stats using NebulaQueryBuilder
      const stats = await this.getEnhancedGraphStats();

      // Convert stats to GraphAnalysisResult for caching
      const graphAnalysisResult: GraphAnalysisResult = {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: stats.nodeCount,
          totalEdges: stats.relationshipCount,
          averageDegree: 0,
          maxDepth: 0,
          componentCount: 0,
        },
        summary: {
          projectFiles: 0,
          functions: 0,
          classes: 0,
          imports: 0,
          externalDependencies: 0,
        },
      };

      // Cache the result
      this.cacheService.setGraphStatsCache(graphAnalysisResult);
      this.performanceMonitor.updateCacheHitRate(false);

      return stats;
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'getGraphStats',
        query: 'SHOW TAGS; SHOW EDGES',
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to get graph stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        nodeCount: 0,
        relationshipCount: 0,
        nodeTypes: {},
        relationshipTypes: {},
      };
    }
  }

  private async getEnhancedGraphStats(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  }> {
    try {
      // Use NebulaQueryBuilder to build count queries
      const tagResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const edgeResult = await this.nebulaService.executeReadQuery('SHOW EDGES');

      const nodeTypes: Record<string, number> = {};
      const relationshipTypes: Record<string, number> = {};

      // Count nodes for each tag
      if (tagResult && Array.isArray(tagResult)) {
        for (const tag of tagResult) {
          const tagName = tag.Name || tag.name || 'Unknown';
          const countQuery = this.enhancedQueryBuilder.buildNodeCountQuery(tagName);
          const countResult = await this.nebulaService.executeReadQuery(
            countQuery.nGQL,
            countQuery.parameters
          );

          if (countResult && Array.isArray(countResult) && countResult.length > 0) {
            nodeTypes[tagName] = countResult[0].total || 0;
          }
        }
      }

      // Count relationships for each edge type
      if (edgeResult && Array.isArray(edgeResult)) {
        for (const edge of edgeResult) {
          const edgeName = edge.Name || edge.name || 'Unknown';
          const countQuery = this.enhancedQueryBuilder.buildRelationshipCountQuery(edgeName);
          const countResult = await this.nebulaService.executeReadQuery(
            countQuery.nGQL,
            countQuery.parameters
          );

          if (countResult && Array.isArray(countResult) && countResult.length > 0) {
            relationshipTypes[edgeName] = countResult[0].total || 0;
          }
        }
      }

      const totalNodes = Object.values(nodeTypes).reduce((sum, count) => sum + count, 0);
      const totalRelationships = Object.values(relationshipTypes).reduce(
        (sum, count) => sum + count,
        0
      );

      return {
        nodeCount: totalNodes,
        relationshipCount: totalRelationships,
        nodeTypes,
        relationshipTypes,
      };
    } catch (error) {
      // Fallback to basic implementation
      return {
        nodeCount: 0,
        relationshipCount: 0,
        nodeTypes: {},
        relationshipTypes: {},
      };
    }
  }

  async deleteNodes(nodeIds: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Create a batch of delete queries
      const batchSize = 100;
      const results: boolean[] = [];

      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        const queries: GraphQuery[] = batch.map(nodeId => ({
          nGQL: `DELETE VERTEX "${nodeId}" WITH EDGE`,
          parameters: {},
        }));

        // Execute batch deletion
        const result = await this.executeBatch(queries);
        results.push(result.success);
      }

      const success = results.every(r => r);
      this.logger.info('Nodes deleted successfully', {
        nodeCount: nodeIds.length,
        success,
      });

      return success;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to delete nodes: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphPersistenceService', operation: 'deleteNodes' }
      );
      this.logger.error('Failed to delete nodes', {
        errorId: report.id,
        nodeCount: nodeIds.length,
      });
      return false;
    }
  }

  async clearGraph(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 获取当前项目ID
      const projectId = this.extractProjectIdFromCurrentSpace();
      if (!projectId) {
        throw new Error('Cannot determine project ID from current space');
      }

      this.logger.info(`Starting to clear graph for project: ${projectId}`);

      // 记录开始时间
      const startTime = Date.now();

      // 方法1: 尝试删除并重新创建整个空间（最彻底的方式）
      const spaceName = this.generateSpaceName(projectId);

      // 检查空间是否存在
      const spaceExists = await this.nebulaSpaceManager.checkSpaceExists(projectId);
      if (!spaceExists) {
        this.logger.warn(`Space ${spaceName} does not exist, nothing to clear`);
        return true;
      }

      try {
        // 获取当前空间配置
        const spaceInfo = await this.nebulaSpaceManager.getSpaceInfo(projectId);
        if (!spaceInfo) {
          throw new Error(`Cannot get configuration for space ${spaceName}`);
        }

        // 删除整个空间
        const deleteSuccess = await this.nebulaSpaceManager.deleteSpace(projectId);
        if (!deleteSuccess) {
          throw new Error(`Failed to delete space ${spaceName}`);
        }

        // 等待删除操作完成
        await this.waitForSpaceDeletion(spaceName);

        // 重新创建空间
        const createSuccess = await this.nebulaSpaceManager.createSpace(projectId, {
          partitionNum: spaceInfo.partition_num,
          replicaFactor: spaceInfo.replica_factor,
          vidType: spaceInfo.vid_type,
        });

        if (!createSuccess) {
          throw new Error(`Failed to recreate space ${spaceName}`);
        }

        // 切换到新创建的空间
        await this.nebulaService.useSpace(spaceName);

        // 清空缓存
        this.cacheService.clearAllCache();

        const processingTime = Date.now() - startTime;
        this.logger.info('Graph cleared successfully using space recreation', {
          projectId,
          spaceName,
          processingTime,
          method: 'drop_and_recreate_space',
        });

        return true;
      } catch (spaceMethodError) {
        this.logger.warn('Space recreation method failed, falling back to data deletion method', {
          error:
            spaceMethodError instanceof Error ? spaceMethodError.message : String(spaceMethodError),
        });

        // 方法2: 如果空间删除失败，使用批量删除所有数据的方式
        return await this.clearGraphByDeletingData(projectId, spaceName, startTime);
      }
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'clearGraph',
        currentSpace: this.currentSpace,
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to clear graph', {
        error: error instanceof Error ? error.message : String(error),
        currentSpace: this.currentSpace,
      });
      return false;
    }
  }

  private async clearGraphByDeletingData(
    projectId: string,
    spaceName: string,
    startTime: number
  ): Promise<boolean> {
    try {
      this.logger.info('Using data deletion method to clear graph');

      // 切换到目标空间
      await this.nebulaService.useSpace(spaceName);

      // 获取所有标签类型
      const tagsResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const tags = tagsResult?.data?.map((row: any) => row.Name || row.name) || [];

      // 获取所有边类型
      const edgesResult = await this.nebulaService.executeReadQuery('SHOW EDGES');
      const edges = edgesResult?.data?.map((row: any) => row.Name || row.name) || [];

      // 批量删除所有边
      for (const edgeType of edges) {
        try {
          await this.nebulaService.executeWriteQuery(`DELETE EDGE \`${edgeType}\` * -> *`);
          this.logger.debug(`Deleted all edges of type: ${edgeType}`);
        } catch (error) {
          // 某些边类型可能没有数据，忽略错误
          this.logger.debug(`Failed to delete edges of type ${edgeType}: ${error}`);
        }
      }

      // 批量删除所有顶点
      for (const tagName of tags) {
        try {
          // 获取该标签的所有顶点ID
          const vertexResult = await this.nebulaService.executeReadQuery(
            `LOOKUP ON \`${tagName}\` YIELD \`${tagName}\`._id AS id`
          );

          if (vertexResult?.data && vertexResult.data.length > 0) {
            const vertexIds = vertexResult.data.map((row: any) => row.id);

            // 分批删除顶点（避免单次操作过大）
            const batchSize = 100;
            for (let i = 0; i < vertexIds.length; i += batchSize) {
              const batch = vertexIds.slice(i, i + batchSize);
              const idList = batch.map((id: string) => `"${id}"`).join(', ');
              await this.nebulaService.executeWriteQuery(`DELETE VERTEX ${idList}`);
            }

            this.logger.debug(`Deleted ${vertexIds.length} vertices of type: ${tagName}`);
          }
        } catch (error) {
          this.logger.debug(`Failed to delete vertices of type ${tagName}: ${error}`);
        }
      }

      // 清空缓存
      this.cacheService.clearAllCache();

      const processingTime = Date.now() - startTime;
      this.logger.info('Graph cleared successfully using data deletion', {
        projectId,
        spaceName,
        processingTime,
        tagsDeleted: tags.length,
        edgesDeleted: edges.length,
        method: 'delete_all_data',
      });

      return true;
    } catch (error) {
      throw new Error(
        `Data deletion method failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private extractProjectIdFromCurrentSpace(): string | null {
    return this.persistenceUtils.extractProjectIdFromCurrentSpace(this.currentSpace);
  }

  private async waitForSpaceDeletion(
    spaceName: string,
    maxRetries: number = 30,
    retryDelay: number = 1000
  ): Promise<void> {
    await this.persistenceUtils.waitForSpaceDeletion(
      this.nebulaService,
      spaceName,
      maxRetries,
      retryDelay
    );
  }

  private async executeBatch(queries: GraphQuery[]): Promise<GraphPersistenceResult> {
    const startTime = Date.now();

    try {
      // Execute the batch transaction
      const results = await this.nebulaService.executeTransaction(queries.map(q => ({
        nGQL: q.nGQL,
        parameters: q.parameters
      })));

      let nodesCreated = 0;
      let relationshipsCreated = 0;
      let nodesUpdated = 0;

      // Enhanced operation counting
      for (const query of queries) {
        if (query.nGQL.includes('INSERT VERTEX')) {
          nodesCreated++;
        } else if (query.nGQL.includes('INSERT EDGE')) {
          relationshipsCreated++;
        } else if (query.nGQL.includes('UPDATE VERTEX')) {
          nodesUpdated++;
        }
      }

      const processingTime = Date.now() - startTime;

      // Update performance metrics
      this.performanceMonitor.recordQueryExecution(processingTime);

      return {
        success: true,
        nodesCreated,
        relationshipsCreated,
        nodesUpdated,
        processingTime,
        errors: [],
      };
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'executeBatch',
        retryCount: 0,
        duration: Date.now() - startTime,
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        nodesUpdated: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private recordToGraphNode(record: any): CodeGraphNode {
    return this.persistenceUtils.recordToGraphNode(record);
  }

  private recordToGraphRelationship(
    record: any,
    sourceId: string,
    targetId: string
  ): CodeGraphRelationship {
    return this.persistenceUtils.recordToGraphRelationship(record, sourceId, targetId);
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  private async initializeServices(): Promise<void> {
    try {
      const batchConfig = this.configService.get('batchProcessing');
      if (batchConfig) {
        this.batchOptimizer.updateConfig({
          maxConcurrentOperations: batchConfig.maxConcurrentOperations || 5,
          defaultBatchSize: batchConfig.defaultBatchSize || 50,
          maxBatchSize: batchConfig.maxBatchSize || 500,
          memoryThreshold: batchConfig.memoryThreshold || 80,
          processingTimeout: batchConfig.processingTimeout || 300000,
          retryAttempts: batchConfig.retryAttempts || 3,
          retryDelay: batchConfig.retryDelay || 1000,
          adaptiveBatchingEnabled: batchConfig.adaptiveBatching?.enabled !== false,
        });
      }
    } catch (error) {
      // 如果配置未初始化，使用默认配置
      this.logger.debug('Using default batch processing configuration');
    }

    try {
      const cacheConfig = this.configService.get('caching');
      if (cacheConfig && typeof cacheConfig === 'object') {
        const config = cacheConfig as any;
        // Configure cache service if needed
      }
    } catch (error) {
      // 如果配置未初始化，使用默认配置
      this.logger.debug('Using default caching configuration');
    }

    // Start performance monitoring
    this.performanceMonitor.startPeriodicMonitoring(30000);
  }

  private checkMemoryUsage(): boolean {
    return this.persistenceUtils.checkMemoryUsage();
  }

  private calculateOptimalBatchSize(totalItems: number): number {
    return this.persistenceUtils.calculateOptimalBatchSize(totalItems);
  }

  async updateChunks(
    chunks: any[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      // For incremental updates, we need to:
      // 1. Check which nodes already exist
      // 2. Only update the nodes that have changed
      // 3. Delete nodes that no longer exist (if specified in options)

      const existingNodeIds = await this.getExistingNodeIds(chunks.map((c: any) => c.id));
      const nodesToUpdate = chunks.filter((chunk: any) => existingNodeIds.includes(chunk.id));
      const nodesToCreate = chunks.filter((chunk: any) => !existingNodeIds.includes(chunk.id));

      let updatedCount = 0;
      let createdCount = 0;

      // Update existing nodes
      if (nodesToUpdate.length > 0) {
        const updateQueries = this.persistenceUtils.createUpdateNodeQueries(nodesToUpdate, options);
        const updateResult = await this.executeBatch(updateQueries);

        if (updateResult.success) {
          updatedCount = updateResult.nodesUpdated;
        } else {
          throw new Error('Failed to update existing nodes');
        }
      }

      // Create new nodes
      if (nodesToCreate.length > 0) {
        const createQueries = nodesToCreate
          .map((chunk: any) => this.persistenceUtils.createChunkQueries(chunk, options))
          .flat();
        const createResult = await this.executeBatch(createQueries);

        if (createResult.success) {
          createdCount = createResult.nodesCreated;
        } else {
          throw new Error('Failed to create new nodes');
        }
      }

      result.success = true;
      result.nodesCreated = createdCount;
      result.nodesUpdated = updatedCount;
      result.relationshipsCreated = 0; // Relationships handled separately

      this.logger.info('Nodes updated incrementally', {
        totalNodes: chunks.length,
        createdNodes: createdCount,
        updatedNodes: updatedCount,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to update nodes incrementally: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphPersistenceService', operation: 'updateChunks' }
      );
      result.errors.push(`Incremental update failed: ${report.id}`);
      this.logger.error('Failed to update nodes incrementally', { errorId: report.id });
      return result;
    }
  }

  async deleteNodesByFiles(filePaths: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get all node IDs for the specified files
      const nodeIds = await this.getNodeIdsByFiles(filePaths);

      if (nodeIds.length === 0) {
        this.logger.debug('No nodes found for files', { filePaths });
        return true;
      }

      // Delete the nodes
      const success = await this.deleteNodes(nodeIds);

      if (success) {
        this.logger.info('Nodes deleted by files', {
          fileCount: filePaths.length,
          nodeCount: nodeIds.length,
        });
      }

      return success;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to delete nodes by files: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphPersistenceService', operation: 'deleteNodesByFiles' }
      );
      this.logger.error('Failed to delete nodes by files', {
        errorId: report.id,
        fileCount: filePaths.length,
      });
      return false;
    }
  }

  private async getExistingNodeIds(nodeIds: string[]): Promise<string[]> {
    return this.persistenceUtils.getExistingNodeIdsByIds(nodeIds, 'Node');
  }

  private async getNodeIdsByFiles(filePaths: string[]): Promise<string[]> {
    const nodeIdsByFiles = await this.persistenceUtils.getNodeIdsByFiles(filePaths);
    return Object.values(nodeIdsByFiles).flat() as string[];
  }

  // Enhanced batch processing using NebulaQueryBuilder
  private async processFilesWithEnhancedBatching(
    files: any[],
    options: GraphPersistenceOptions,
    batchSize: number,
    useCache: boolean,
    cacheTTL: number
  ): Promise<GraphPersistenceResult> {
    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      // Prepare vertices for batch insertion
      const vertices: any[] = [];
      const edges: Array<{
        type: string;
        srcId: string;
        dstId: string;
        properties: Record<string, any>;
      }> = [];

      // Process files into vertices and edges
      for (const file of files) {
        // Add file vertex
        vertices.push({
          tag: 'File',
          id: file.id,
          properties: {
            path: file.filePath,
            relativePath: file.relativePath,
            name: file.filePath.split('/').pop() || 'unknown',
            language: file.language,
            size: file.size,
            hash: file.hash,
            linesOfCode: file.metadata?.linesOfCode,
            functions: file.metadata?.functions,
            classes: file.metadata?.classes,
            lastModified: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });

        // Add project relationship if specified
        if (options.projectId) {
          edges.push({
            type: 'BELONGS_TO',
            srcId: file.id,
            dstId: options.projectId,
            properties: {},
          });
        }

        // Process chunks
        for (const chunk of file.chunks || []) {
          if (chunk.type === 'function') {
            vertices.push({
              tag: 'Function',
              id: chunk.id,
              properties: {
                name: chunk.functionName || 'anonymous',
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                complexity: chunk.metadata?.complexity || 1,
                parameters: chunk.metadata?.parameters || [],
                returnType: chunk.metadata?.returnType || 'unknown',
                language: chunk.metadata?.language || 'unknown',
                updatedAt: new Date().toISOString(),
              },
            });

            // Add contains relationship
            edges.push({
              type: 'CONTAINS',
              srcId: file.id,
              dstId: chunk.id,
              properties: {},
            });
          }

          if (chunk.type === 'class') {
            vertices.push({
              tag: 'Class',
              id: chunk.id,
              properties: {
                name: chunk.className || 'anonymous',
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                methods: chunk.metadata?.methods || 0,
                properties: chunk.metadata?.properties || 0,
                inheritance: chunk.metadata?.inheritance || [],
                language: chunk.metadata?.language || 'unknown',
                updatedAt: new Date().toISOString(),
              },
            });

            // Add contains relationship
            edges.push({
              type: 'CONTAINS',
              srcId: file.id,
              dstId: chunk.id,
              properties: {},
            });
          }
        }

        // Process imports
        for (const importName of file.metadata?.imports || []) {
          const importId = `import_${file.id}_${importName}`;
          vertices.push({
            tag: 'Import',
            id: importId,
            properties: {
              module: importName,
              updatedAt: new Date().toISOString(),
            },
          });

          edges.push({
            type: 'IMPORTS',
            srcId: file.id,
            dstId: importId,
            properties: {},
          });
        }
      }

      // Add project vertex if specified
      if (options.projectId) {
        vertices.push({
          tag: 'Project',
          id: options.projectId,
          properties: {
            name: options.projectId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }

      // Process in batches
      const vertexBatches = this.persistenceUtils.chunkArray(vertices, batchSize);
      const edgeBatches = this.persistenceUtils.chunkArray(edges, batchSize);

      let totalNodesCreated = 0;
      let totalRelationshipsCreated = 0;

      // Process vertex batches
      for (const vertexBatch of vertexBatches) {
        const cacheKey = `vertices_${vertexBatch
          .map((v: any) => v.id)
          .sort()
          .join('_')}`;

        if (useCache) {
          const cached = this.cacheService.getFromCache<number>(cacheKey);
          if (cached && typeof cached === 'number') {
            totalNodesCreated += cached;
            continue;
          }
        }

        const batchResult = await this.queryBuilder.batchInsertVertices(vertexBatch);
        const executionResult = await this.executeBatch([
          { nGQL: batchResult.query, parameters: batchResult.params },
        ]);

        if (executionResult.success) {
          totalNodesCreated += vertexBatch.length;
          if (useCache) {
            this.cacheService.setCache(cacheKey, vertexBatch.length, cacheTTL);
          }
        } else {
          result.errors.push(...executionResult.errors);
        }
      }

      // Process edge batches
      for (const edgeBatch of edgeBatches) {
        const batchResult = await this.queryBuilder.batchInsertEdges(edgeBatch);
        const executionResult = await this.executeBatch([
          { nGQL: batchResult.query, parameters: batchResult.params },
        ]);

        if (executionResult.success) {
          totalRelationshipsCreated += edgeBatch.length;
        } else {
          result.errors.push(...executionResult.errors);
        }
      }

      result.success = result.errors.length === 0;
      result.nodesCreated = totalNodesCreated;
      result.relationshipsCreated = totalRelationshipsCreated;
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  async close(): Promise<void> {
    // Close the nebula service
    if (this.nebulaService) {
      await this.nebulaService.close();
    }
  }

  // Performance monitoring methods
  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }
}