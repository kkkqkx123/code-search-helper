import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { IGraphService } from './IGraphService';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import {
  GraphSearchOptions,
  GraphSearchResult,
  CodeGraphNode,
  CodeGraphRelationship
} from './types';

/**
 * 图搜索服务
 * 职责：专注于搜索逻辑，不包含缓存、空间管理等重复功能
 */
@injectable()
export class GraphSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private graphService: IGraphService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.IGraphService) graphService: IGraphService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.graphService = graphService;
    this.performanceMonitor = performanceMonitor;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph search service');

      // 确保图服务已初始化
      if (!this.graphService.isDatabaseConnected()) {
        const initialized = await this.graphService.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph service');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph search service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph search service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchService', operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * 通用搜索
   */
  async search(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      this.logger.info('Executing search', { query, options });

      // 构建搜索查询
      const searchQuery = this.buildSearchQuery(query, options);
      const result = await this.graphService.executeReadQuery(searchQuery.nGQL, searchQuery.parameters);

      const formattedResult = this.formatSearchResult(result);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.logger.info('Search completed', {
        query,
        nodeCount: formattedResult.nodes.length,
        relationshipCount: formattedResult.relationships.length,
        executionTime,
      });

      return {
        ...formattedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphSearchService',
          operation: 'search',
          query,
          options,
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 按节点类型搜索
   */
  async searchByNodeType(nodeType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Searching by node type', { nodeType, options });

      const searchQuery = this.buildNodeTypeQuery(nodeType, options);
      const result = await this.graphService.executeReadQuery(searchQuery.nGQL, searchQuery.parameters);

      const formattedResult = this.formatSearchResult(result, true, false);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      return {
        ...formattedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Node type search failed: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphSearchService',
          operation: 'searchByNodeType',
          nodeType,
          options,
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 按关系类型搜索
   */
  async searchByRelationshipType(relationshipType: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Searching by relationship type', { relationshipType, options });

      const searchQuery = this.buildRelationshipTypeQuery(relationshipType, options);
      const result = await this.graphService.executeReadQuery(searchQuery.nGQL, searchQuery.parameters);

      const formattedResult = this.formatSearchResult(result, false, true);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      return {
        ...formattedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Relationship type search failed: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphSearchService',
          operation: 'searchByRelationshipType',
          relationshipType,
          options,
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
   * 按路径搜索
   */
  async searchByPath(sourceId: string, targetId: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Searching by path', { sourceId, targetId, options });

      const searchQuery = this.buildPathQuery(sourceId, targetId, options);
      const result = await this.graphService.executeReadQuery(searchQuery.nGQL, searchQuery.parameters);

      const formattedResult = this.formatSearchResult(result);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      return {
        ...formattedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Path search failed: ${error instanceof Error ? error.message : String(error)}`),
        {
          component: 'GraphSearchService',
          operation: 'searchByPath',
          sourceId,
          targetId,
          options,
          executionTime,
        }
      );
      throw error;
    }
  }

  /**
    * 获取搜索建议
    */
  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      this.logger.debug('Getting search suggestions', { query });

      // 简单的建议逻辑
      const suggestions: string[] = [];

      if (query.toLowerCase().includes('function')) {
        suggestions.push('function name', 'function call', 'function definition');
      }

      if (query.toLowerCase().includes('class')) {
        suggestions.push('class inheritance', 'class methods', 'class properties');
      }

      if (query.toLowerCase().includes('import')) {
        suggestions.push('import path', 'import module', 'import dependency');
      }

      if (query.toLowerCase().includes('file')) {
        suggestions.push('file path', 'file content', 'file dependency');
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      this.logger.error('Search suggestions failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * 获取搜索统计信息
   */
  async getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }> {
    const metrics = this.performanceMonitor.getMetrics?.() || {};
    return {
      totalSearches: metrics.queryExecutionTimes?.length || 0,
      avgExecutionTime: metrics.averageQueryTime || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
    };
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph search service');
      this.isInitialized = false;
      this.logger.info('Graph search service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph search service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchService', operation: 'close' }
      );
      throw error;
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // 检查图服务是否健康
      return this.graphService.isDatabaseConnected();
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // 私有方法

  /**
   * 构建搜索查询
   */
  private buildSearchQuery(query: string, options: GraphSearchOptions): { nGQL: string; parameters?: Record<string, any> } {
    // 简化的查询构建逻辑
    const limit = options.limit || 100;
    const nGQL = `
      MATCH (v)
      WHERE v.name CONTAINS "${query}"
      RETURN v AS node
      LIMIT ${limit}
    `;

    return { nGQL };
  }

  /**
   * 构建节点类型查询
   */
  private buildNodeTypeQuery(nodeType: string, options: GraphSearchOptions): { nGQL: string; parameters?: Record<string, any> } {
    const limit = options.limit || 100;
    const nGQL = `
      MATCH (v:${nodeType})
      RETURN v AS node
      LIMIT ${limit}
    `;

    return { nGQL };
  }

  /**
   * 构建关系类型查询
   */
  private buildRelationshipTypeQuery(relationshipType: string, options: GraphSearchOptions): { nGQL: string; parameters?: Record<string, any> } {
    const limit = options.limit || 100;
    const nGQL = `
      MATCH ()-[r:${relationshipType}]->()
      RETURN r AS relationship
      LIMIT ${limit}
    `;

    return { nGQL };
  }

  /**
   * 构建路径查询
   */
  private buildPathQuery(sourceId: string, targetId: string, options: GraphSearchOptions): { nGQL: string; parameters?: Record<string, any> } {
    const maxDepth = options.depth || 5;
    const nGQL = `
      FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER *
      YIELD path AS p
      RETURN p
    `;

    return { nGQL };
  }

  /**
   * 格式化搜索结果
   */
  private formatSearchResult(result: any, includeNodes: boolean = true, includeRelationships: boolean = true): {
    nodes: CodeGraphNode[];
    relationships: CodeGraphRelationship[];
    total: number;
  } {
    const nodes: CodeGraphNode[] = [];
    const relationships: CodeGraphRelationship[] = [];

    if (result && result.data) {
      for (const record of result.data) {
        if (includeNodes && record.node) {
          nodes.push(this.formatNode(record.node));
        }
        if (includeRelationships && record.relationship) {
          relationships.push(this.formatRelationship(record.relationship));
        }
      }
    }

    return {
      nodes,
      relationships,
      total: nodes.length + relationships.length
    };
  }

  /**
   * 格式化节点
   */
  private formatNode(nodeData: any): CodeGraphNode {
    return {
      id: nodeData.id || nodeData._id,
      type: nodeData.type || nodeData.tag || 'Unknown',
      name: nodeData.name || nodeData.properties?.name || 'Unknown',
      properties: nodeData.properties || {},
    };
  }

  /**
   * 格式化关系
   */
  private formatRelationship(relationshipData: any): CodeGraphRelationship {
    return {
      id: relationshipData.id || relationshipData._id,
      type: relationshipData.type || relationshipData.edge || 'Unknown',
      sourceId: relationshipData.src || relationshipData.source,
      targetId: relationshipData.dst || relationshipData.target,
      properties: relationshipData.properties || {},
    };
  }
}
// 向后兼容的导出
export const GraphSearchServiceNew = GraphSearchService;
export type GraphSearchServiceNew = GraphSearchService;