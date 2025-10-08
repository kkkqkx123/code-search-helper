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
      this.logger.info('Initializing graph search service');

      // Ensure the graph database is initialized
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph database');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph search service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph search service: ${error instanceof Error ? error.message : String(error)}`),
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

    // Generate cache key based on query and options
    const cacheKey = this.generateCacheKey(query, options);

    // Try to get result from cache first
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      this.logger.debug('Graph search result retrieved from cache', { cacheKey });
      return cachedResult;
    }

    try {
      this.logger.info('Executing graph search', { query, options });

      // Build search query based on input
      const searchQuery = this.buildSearchQuery(query, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result?.nodes || []),
        relationships: this.formatRelationships(result?.relationships || []),
        total: (result?.nodes?.length || 0) + (result?.relationships?.length || 0),
        executionTime: Date.now() - startTime,
      };

      // Cache the result if caching is enabled
      const cacheTTL = this.configService.get('caching').defaultTTL || 300; // 5 minutes default
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);
      this.performanceMonitor.recordQueryExecution(formattedResult.executionTime);

      this.logger.info('Graph search completed', {
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

      this.logger.error('Graph search failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty result in case of error
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

    // Try to get result from cache first
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('Searching by node type', { nodeType, options });

      const searchQuery = this.buildNodeTypeQuery(nodeType, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result || []),
        relationships: [],
        total: result?.length || 0,
        executionTime: Date.now() - startTime,
      };

      // Cache the result
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('Node type search failed', {
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

    // Try to get result from cache first
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('Searching by relationship type', { relationshipType, options });

      const searchQuery = this.buildRelationshipTypeQuery(relationshipType, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: [],
        relationships: this.formatRelationships(result || []),
        total: result?.length || 0,
        executionTime: Date.now() - startTime,
      };

      // Cache the result
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('Relationship type search failed', {
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

    // Try to get result from cache first
    const cachedResult = this.cacheService.getFromCache<GraphSearchResult>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      return cachedResult;
    }

    try {
      this.logger.info('Searching by path', { sourceId, targetId, options });

      const searchQuery = this.buildPathQuery(sourceId, targetId, options);
      const result = await this.graphDatabase.executeReadQuery(searchQuery.nGQL, searchQuery.params);

      const formattedResult: GraphSearchResult = {
        nodes: this.formatNodes(result?.path?.nodes || []),
        relationships: this.formatRelationships(result?.path?.relationships || []),
        total: (result?.path?.nodes?.length || 0) + (result?.path?.relationships?.length || 0),
        executionTime: Date.now() - startTime,
      };

      // Cache the result
      const cacheTTL = this.configService.get('caching').defaultTTL || 300;
      this.cacheService.setCache(cacheKey, formattedResult, cacheTTL);

      this.performanceMonitor.updateCacheHitRate(false);

      return formattedResult;
    } catch (error) {
      this.logger.error('Path search failed', {
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
      this.logger.debug('Getting search suggestions', { query });

      // In a real implementation, this would use more sophisticated suggestion algorithms
      // For now, we'll return some mock suggestions based on the query
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

      return suggestions.slice(0, 5); // Return top 5 suggestions
    } catch (error) {
      this.logger.error('Failed to get search suggestions', {
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
      this.logger.info('Closing graph search service');
      this.isInitialized = false;
      // Close any resources if needed
      this.logger.info('Graph search service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph search service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphSearchServiceNew', operation: 'close' }
      );
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  private generateCacheKey(query: string, options: GraphSearchOptions): string {
    return `graph_search_${query}_${JSON.stringify(options)}`;
  }

  private buildSearchQuery(query: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    // Default search query - this would be more sophisticated in a real implementation
    // For now, we'll create a basic query that searches for nodes matching the query string
    const { limit = 10, depth = 2, relationshipTypes, nodeTypes } = options;

    // Build a query based on the search term
    // This is a simplified implementation - a real implementation would use more sophisticated search
    let nGQL = `
      LOOKUP ON * WHERE * CONTAINS "${query}"
      YIELD vertex AS node
      LIMIT ${limit}
    `;

    // If specific node types are requested
    if (nodeTypes && nodeTypes.length > 0) {
      const nodeTypeClause = nodeTypes.join(', ');
      nGQL = `
        GO ${depth} STEPS FROM "${query}" OVER * 
        YIELD dst(edge) AS destination
        | FETCH PROP ON ${nodeTypeClause} $-.destination YIELD vertex AS node
        LIMIT ${limit}
      `;
    }
    // If specific relationship types are requested
    else if (relationshipTypes && relationshipTypes.length > 0) {
      const relationshipTypeClause = relationshipTypes.join(', ');
      nGQL = `
        GO ${depth} STEPS FROM "${query}" OVER ${relationshipTypeClause}
        YIELD dst(edge) AS destination
        | FETCH PROP ON * $-.destination YIELD vertex AS node
        LIMIT ${limit}
      `;
    }

    return { nGQL, params: {} };
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
    // Format the nodes to a consistent structure
    return nodes.map(node => ({
      id: node.id || node._id || node.vertex?.id || 'unknown',
      type: node.type || node.label || node.tag || 'unknown',
      name: node.name || node.label || 'unknown',
      properties: node.properties || node.props || node.vertex?.props || {},
    }));
  }

  private formatRelationships(relationships: any[]): CodeGraphRelationship[] {
    // Format the relationships to a consistent structure
    return relationships.map(rel => ({
      id: rel.id || rel._id || 'unknown',
      type: rel.type || rel.edge?.type || 'unknown',
      sourceId: rel.source || rel.src || rel.edge?.src || 'unknown',
      targetId: rel.target || rel.dst || rel.edge?.dst || 'unknown',
      properties: rel.properties || rel.props || rel.edge?.props || {},
    }));
  }
}