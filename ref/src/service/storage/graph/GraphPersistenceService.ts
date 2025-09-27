import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { CodeChunk } from '../../parser/types';
import { ParsedFile } from '../../parser/splitting/ASTCodeParser';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import {
  BatchProcessingMetrics,
  BatchOperationMetrics,
} from '../../monitoring/BatchProcessingMetrics';
import { NebulaService } from '../../../database/NebulaService';
import { NebulaQueryBuilder, BatchVertex } from '../../../database/nebula/NebulaQueryBuilder';
import { NebulaSpaceManager } from '../../../database/nebula/NebulaSpaceManager';
import { GraphDatabaseErrorHandler } from '../../../core/GraphDatabaseErrorHandler';
import { GraphCacheService } from './GraphCacheService';
import { GraphPerformanceMonitor } from './GraphPerformanceMonitor';
import { GraphBatchOptimizer } from './GraphBatchOptimizer';
import { GraphQueryBuilder as EnhancedQueryBuilder } from './GraphQueryBuilder';
import { GraphPersistenceUtils } from './GraphPersistenceUtils';
import { GraphSearchService } from './GraphSearchService';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface GraphPersistenceOptions {
  projectId?: string;
  overwriteExisting?: boolean;
  createRelationships?: boolean;
  batchSize?: number;
  useCache?: boolean;
  cacheTTL?: number;
  limit?: number;
  type?: string;
}

export interface GraphPersistenceResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  nodesUpdated: number;
  processingTime: number;
  errors: string[];
}

export interface CodeGraphNode {
  id: string;
  type: 'File' | 'Function' | 'Class' | 'Interface' | 'Import' | 'Project';
  name: string;
  properties: Record<string, any>;
}

export interface CodeGraphRelationship {
  id: string;
  type: 'CONTAINS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'IMPORTS' | 'BELONGS_TO';
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

@injectable()
export class GraphPersistenceService {
  private nebulaService: NebulaService;
  private nebulaSpaceManager: NebulaSpaceManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  private queryBuilder: NebulaQueryBuilder;
  private graphErrorHandler: GraphDatabaseErrorHandler;
  private cacheService: GraphCacheService;
  private performanceMonitor: GraphPerformanceMonitor;
  private batchOptimizer: GraphBatchOptimizer;
  private enhancedQueryBuilder: EnhancedQueryBuilder;
  private persistenceUtils: GraphPersistenceUtils;
  private searchService: GraphSearchService;
  private isInitialized: boolean = false;
  private currentSpace: string = '';
  private defaultCacheTTL: number = 300000; // 5 minutes default
  private processingTimeout: number = 300000; // 5 minutes default
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // 1 second default
  private connectionPoolMonitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.NebulaSpaceManager) nebulaSpaceManager: NebulaSpaceManager,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics,
    @inject(TYPES.NebulaQueryBuilder) queryBuilder: NebulaQueryBuilder,
    @inject(TYPES.GraphDatabaseErrorHandler) graphErrorHandler: GraphDatabaseErrorHandler,
    @inject(TYPES.GraphPersistenceUtils) persistenceUtils: GraphPersistenceUtils,
    @inject(TYPES.GraphCacheService) cacheService: GraphCacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.GraphQueryBuilder) enhancedQueryBuilder: EnhancedQueryBuilder,
    @inject(TYPES.GraphSearchService) searchService: GraphSearchService
  ) {
    this.nebulaService = nebulaService;
    this.nebulaSpaceManager = nebulaSpaceManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.batchMetrics = batchMetrics;
    this.queryBuilder = queryBuilder;
    this.graphErrorHandler = graphErrorHandler;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.batchOptimizer = batchOptimizer;
    this.enhancedQueryBuilder = enhancedQueryBuilder;
    this.persistenceUtils = persistenceUtils;
    this.searchService = searchService;

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

      // Initialize connection pool monitoring
      await this.initializeConnectionPoolMonitoring();

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

      const result = await this.graphErrorHandler.handleError(
        new Error(`Failed to initialize graph persistence: ${errorMessage}`),
        errorContext
      );

      this.logger.error('Failed to initialize graph persistence', {
        errorType: result.action,
        suggestions: result.suggestions,
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
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);

      this.logger.info(`Initialized project space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'initializeProjectSpace',
        projectId,
        retryCount: 0,
      };

      const result = await this.graphErrorHandler.handleError(
        new Error(
          `Failed to initialize project space: ${error instanceof Error ? error.message : String(error)}`
        ),
        errorContext
      );

      this.logger.error('Failed to initialize project space', {
        errorType: result.action,
        suggestions: result.suggestions,
        projectId,
      });
      return false;
    }
  }

  async storeParsedFiles(
    files: ParsedFile[],
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

    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(operationId, 'graph', batchSize);

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

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: files.length,
        successCount: result.success ? files.length : 0,
        errorCount: result.success ? 0 : files.length,
      });

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

      const errorResult = await this.graphErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      result.errors.push(`Storage failed: ${errorResult.action}`);
      this.logger.error('Failed to store parsed files', {
        errorType: errorResult.action,
        suggestions: errorResult.suggestions,
      });

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: files.length,
      });
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
    }

    return result;
  }

  async storeChunks(
    chunks: CodeChunk[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `storeChunks_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(chunks.length);

    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(operationId, 'graph', batchSize);

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

        results.push(batchResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: chunks.length,
        successCount: result.success ? chunks.length : 0,
        errorCount: result.success ? 0 : chunks.length,
      });

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

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: chunks.length,
      });
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
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
          GO FROM $nodeId OVER ${edgeTypes}
          YIELD dst(edge) AS destination
          | FETCH PROP ON * $-.destination YIELD vertex AS related
          LIMIT 100
        `,
        parameters: { nodeId },
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
          FIND SHORTEST PATH FROM $sourceId TO $targetId OVER * UPTO ${maxDepth} STEPS
          YIELD path as p
        `,
        parameters: { sourceId, targetId },
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
      return cachedStats;
    }

    try {
      // Get enhanced stats using NebulaQueryBuilder
      const stats = await this.getEnhancedGraphStats();

      // Cache the result
      this.cacheService.setGraphStatsCache(stats);
      this.performanceMonitor.updateCacheHitRate(false);

      return stats;
    } catch (error) {
      const errorContext = {
        component: 'GraphPersistenceService',
        operation: 'getGraphStats',
        query: 'SHOW TAGS; SHOW EDGES',
      };

      const result = await this.graphErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to get graph stats', {
        errorType: result.action,
        suggestions: result.suggestions,
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
          nGQL: `DELETE VERTEX $nodeId WITH EDGE`,
          parameters: { nodeId },
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
        await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);

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

      const result = await this.graphErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to clear graph', {
        errorType: result.action,
        suggestions: result.suggestions,
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
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);

      // 获取所有标签类型
      const tagsResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const tags = tagsResult?.data?.map((row: any) => row.Name || row.name) || [];

      // 获取所有边类型
      const edgesResult = await this.nebulaService.executeReadQuery('SHOW EDGES');
      const edges = edgesResult?.data?.map((row: any) => row.Name || row.name) || [];

      // 批量删除所有边
      for (const edgeType of edges) {
        try {
          await this.nebulaService.executeWriteQuery(`DELETE EDGE ${edgeType} * -> *`);
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
            `LOOKUP ON ${tagName} YIELD ${tagName}._id AS id`
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

  private async ensureConstraints(): Promise<void> {
    await this.persistenceUtils.ensureConstraints(this.nebulaService, this.logger);
  }

  private async executeBatch(queries: GraphQuery[]): Promise<GraphPersistenceResult> {
    const startTime = Date.now();

    try {
      // Use enhanced error handling for batch operations
      const result = await this.graphErrorHandler.handleError(new Error('Batch execution'), {
        component: 'GraphPersistenceService',
        operation: 'executeBatch',
        retryCount: queries.length,
        duration: 0,
      });

      // Execute the batch transaction
      const results = await this.nebulaService.executeTransaction(queries);

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

      const result = await this.graphErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        nodesUpdated: 0,
        processingTime: Date.now() - startTime,
        errors: [result.action],
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

    const cacheConfig = this.configService.get('caching');
    if (cacheConfig && typeof cacheConfig === 'object') {
      const config = cacheConfig as any;
      // Configure cache service if needed
    }

    // Start performance monitoring
    this.performanceMonitor.startPeriodicMonitoring(30000);
  }

  private async initializeConnectionPoolMonitoring(): Promise<void> {
    await this.persistenceUtils.initializeConnectionPoolMonitoring(
      this.nebulaService,
      this.performanceMonitor
    );
  }

  private checkMemoryUsage(): boolean {
    return this.persistenceUtils.checkMemoryUsage();
  }

  private calculateOptimalBatchSize(totalItems: number): number {
    return this.persistenceUtils.calculateOptimalBatchSize(totalItems);
  }

  async updateChunks(
    chunks: CodeChunk[],
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

      const existingNodeIds = await this.getExistingNodeIds(chunks.map(c => c.id));
      const nodesToUpdate = chunks.filter(chunk => existingNodeIds.includes(chunk.id));
      const nodesToCreate = chunks.filter(chunk => !existingNodeIds.includes(chunk.id));

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
          .map(chunk => this.persistenceUtils.createChunkQueries(chunk, options))
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
      result.processingTime = Date.now() - startTime;

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
    return Object.values(nodeIdsByFiles).flat();
  }

  // Enhanced batch processing using NebulaQueryBuilder
  private async processFilesWithEnhancedBatching(
    files: ParsedFile[],
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
      const vertices: BatchVertex[] = [];
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
            linesOfCode: file.metadata.linesOfCode,
            functions: file.metadata.functions,
            classes: file.metadata.classes,
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
        for (const chunk of file.chunks) {
          if (chunk.type === 'function') {
            vertices.push({
              tag: 'Function',
              id: chunk.id,
              properties: {
                name: chunk.functionName || 'anonymous',
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                complexity: chunk.metadata.complexity || 1,
                parameters: chunk.metadata.parameters || [],
                returnType: chunk.metadata.returnType || 'unknown',
                language: chunk.metadata.language || 'unknown',
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
                methods: chunk.metadata.methods || 0,
                properties: chunk.metadata.properties || 0,
                inheritance: chunk.metadata.inheritance || [],
                language: chunk.metadata.language || 'unknown',
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
        for (const importName of file.metadata.imports) {
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
          .map(v => v.id)
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

  async search(query: string, options: any = {}): Promise<any[]> {
    const { results } = await this.searchService.search(query, options);
    return results;
  }

  getSearchService(): GraphSearchService {
    return this.searchService;
  }
}
