import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { NebulaService, CommunityDetectionOptions, CommunityResult, PageRankOptions, PageRankResult, ShortestPathOptions, ShortestPathResult } from '../../../database/NebulaService';
import { GraphCacheService } from './GraphCacheService';
import { GraphPerformanceMonitor } from './GraphPerformanceMonitor';
import { GraphQueryBuilder } from './GraphQueryBuilder';

export interface SearchOptions {
  limit?: number;
  type?: 'semantic' | 'relationship' | 'path' | 'fuzzy';
  projectId?: string;
  nodeTypes?: string[];
  relationshipTypes?: string[];
  filePath?: string;
  minScore?: number;
  offset?: number;
  sortBy?: 'relevance' | 'name' | 'type' | 'created';
  targetNode?: string; // 用于路径搜索
  maxDepth?: number; // 用于路径搜索
}

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  score: number;
  queryType: string;
  path?: any; // 路径搜索结果
}

export interface SearchMetrics {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  queryType: string;
}

@injectable()
export class GraphSearchService {
  private nebulaService: NebulaService;
  private logger: LoggerService;
  private cacheService: GraphCacheService;
  private performanceMonitor: GraphPerformanceMonitor;
  private queryBuilder: GraphQueryBuilder;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.GraphCacheService) cacheService: GraphCacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.GraphQueryBuilder) queryBuilder: GraphQueryBuilder
  ) {
    this.nebulaService = nebulaService;
    this.logger = logger;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.queryBuilder = queryBuilder;
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
      this.logger.info('Graph search service initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize graph search service', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    metrics: SearchMetrics;
  }> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const searchParams = this.buildSearchParams(query, options);

      // 检查缓存
      const cacheKey = this.generateCacheKey(searchParams);
      const cachedResults = await this.cacheService.getFromCache<SearchResult[]>(cacheKey);

      if (cachedResults && Array.isArray(cachedResults)) {
        this.performanceMonitor.updateCacheHitRate(true);
        const metrics: SearchMetrics = {
          queryTime: Date.now() - startTime,
          resultCount: cachedResults.length,
          cacheHit: true,
          queryType: searchParams.queryType,
        };

        this.logger.info('Search results retrieved from cache', {
          query,
          ...metrics,
        });

        return { results: cachedResults, metrics };
      }

      // 执行搜索
      const results = await this.executeSearch(searchParams);

      // 缓存结果
      await this.cacheService.setCache(cacheKey, results, 300000); // 5分钟缓存
      this.performanceMonitor.updateCacheHitRate(false);

      const queryTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(queryTime);

      const metrics: SearchMetrics = {
        queryTime,
        resultCount: results.length,
        cacheHit: false,
        queryType: searchParams.queryType,
      };

      this.logger.info('Search executed successfully', {
        query,
        ...metrics,
        projectId: options.projectId,
      });

      return { results, metrics };
    } catch (error) {
      const queryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Search failed', {
        query,
        options,
        queryTime,
        error: errorMessage,
      });

      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  async semanticSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'semantic' });
    return results;
  }

  async relationshipSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'relationship' });
    return results;
  }

  async pathSearch(
    sourceId: string,
    targetId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { results } = await this.search(sourceId, {
      ...options,
      type: 'path',
      targetNode: targetId,
    });
    return results;
  }

  async fuzzySearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'fuzzy' });
    return results;
  }

  private buildSearchParams(query: string, options: SearchOptions) {
    return {
      query,
      queryType: options.type || 'semantic',
      filters: {
        nodeTypes: options.nodeTypes,
        relationshipTypes: options.relationshipTypes,
        projectId: options.projectId,
        filePath: options.filePath,
        minScore: options.minScore || 0.1,
        targetNode: options.targetNode,
        maxDepth: options.maxDepth || 5,
      },
      pagination: {
        limit: options.limit || 10,
        offset: options.offset || 0,
      },
      sortBy: options.sortBy || 'relevance',
    };
  }

  private generateCacheKey(params: any): string {
    return `search_${params.query}_${params.queryType}_${JSON.stringify(params.filters)}_${params.pagination.limit}`;
  }

  private async executeSearch(searchParams: any): Promise<SearchResult[]> {
    switch (searchParams.queryType) {
      case 'semantic':
        return await this.executeSemanticSearch(searchParams);
      case 'relationship':
        return await this.executeRelationshipSearch(searchParams);
      case 'path':
        return await this.executePathSearch(searchParams);
      case 'fuzzy':
        return await this.executeFuzzySearch(searchParams);
      default:
        return await this.executeSemanticSearch(searchParams);
    }
  }

  private async executeSemanticSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'semantic',
      filters: params.filters,
      pagination: params.pagination,
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'semantic'));
    } catch (error) {
      this.logger.error('Semantic search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async executeRelationshipSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'relationship',
      filters: params.filters,
      pagination: params.pagination,
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'relationship'));
    } catch (error) {
      this.logger.error('Relationship search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async executePathSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'path',
      filters: params.filters,
      pagination: params.pagination,
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'path'));
    } catch (error) {
      this.logger.error('Path search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async executeFuzzySearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'fuzzy',
      filters: params.filters,
      pagination: params.pagination,
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'fuzzy'));
    } catch (error) {
      this.logger.error('Fuzzy search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private transformSearchResult(record: any, queryType: string): SearchResult {
    const result: SearchResult = {
      id: '',
      type: 'unknown',
      name: '',
      properties: {},
      score: 0,
      queryType,
    };

    if (record && typeof record === 'object') {
      if (record.vertex) {
        const vertex = record.vertex;
        result.id = vertex.vid || '';
        result.type = vertex.tags?.[0]?.name || 'unknown';
        result.name = vertex.tags?.[0]?.props?.name || '';
        result.properties = vertex.tags?.[0]?.props || {};
        result.score = this.calculateRelevanceScore(vertex, queryType);
      } else if (record.v) {
        result.id = record.v.vid || '';
        result.type = record.v.tags?.[0]?.name || 'unknown';
        result.name = record.v.tags?.[0]?.props?.name || '';
        result.properties = record.v.tags?.[0]?.props || {};
        result.score = this.calculateRelevanceScore(record.v, queryType);
      } else if (record.path) {
        result.path = record.path;
        result.type = 'path';
        result.score = this.calculatePathRelevanceScore(record.path);
      } else {
        Object.assign(result, record);
      }
    }

    return result;
  }

  private calculateRelevanceScore(node: any, queryType: string): number {
    // 基础分数基于查询类型
    let score = 0.5;
    
    // 根据节点属性调整分数
    if (node.tags?.[0]?.props) {
      const props = node.tags[0].props;
      
      // 代码文件节点通常有更高相关性
      if (props.filePath) {
        score += 0.2;
      }
      
      // 函数/方法节点
      if (props.kind === 'function' || props.kind === 'method') {
        score += 0.1;
      }
      
      // 类/接口节点
      if (props.kind === 'class' || props.kind === 'interface') {
        score += 0.15;
      }
      
      // 语义搜索通常有更高相关性
      if (queryType === 'semantic') {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0); // 确保分数在0-1之间
  }

  private calculatePathRelevanceScore(path: any): number {
    // 路径相关性基于路径长度和节点类型
    let score = 0.6;
    
    if (path && path.length) {
      // 较短的路径通常更相关
      const lengthFactor = Math.max(0, 1 - (path.length / 20));
      score += lengthFactor * 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * 将SearchResult转换为QueryResult格式
   */
  public transformToQueryResult(searchResult: SearchResult): any {
    const queryResult: any = {
      id: searchResult.id,
      score: searchResult.score,
      filePath: searchResult.properties.filePath || '',
      content: searchResult.properties.content || searchResult.name || '',
      startLine: searchResult.properties.startLine || 0,
      endLine: searchResult.properties.endLine || 0,
      language: searchResult.properties.language || '',
      chunkType: searchResult.type,
      metadata: {
        ...searchResult.properties,
        graphNodeType: searchResult.type,
        queryType: searchResult.queryType,
      },
    };

    // 添加图上下文信息
    if (searchResult.type !== 'path') {
      queryResult.graphContext = {
        dependencies: searchResult.properties.dependencies || [],
        relationships: searchResult.properties.relationships || [],
      };
    }

    return queryResult;
  }

  async getSearchMetrics(): Promise<any> {
    return this.performanceMonitor.getMetrics();
  }

  async clearSearchCache(): Promise<void> {
    this.cacheService.clearAllCache();
  }

  /**
   * 创建优化索引
   * 调用NebulaService的索引创建功能
   */
  async createOptimizedIndexes(): Promise<void> {
    try {
      await this.nebulaService.createOptimizedIndexes();
      this.logger.info('Optimized indexes created successfully');
    } catch (error) {
      this.logger.error('Failed to create optimized indexes', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to create optimized indexes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 优化数据分区
   * 调用NebulaService的数据分区优化功能
   */
  async optimizeDataPartitioning(): Promise<void> {
    try {
      await this.nebulaService.optimizeDataPartitioning();
      this.logger.info('Data partitioning optimized successfully');
    } catch (error) {
      this.logger.error('Failed to optimize data partitioning', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to optimize data partitioning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行社区发现算法
   */
  async communityDetection(options: CommunityDetectionOptions = {}): Promise<CommunityResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const results = await this.nebulaService.communityDetection(options);
      this.logger.info('Community detection completed', {
        communityCount: results.length,
        totalMembers: results.reduce((sum, community) => sum + community.size, 0),
      });
      
      return results;
    } catch (error) {
      this.logger.error('Community detection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Community detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行PageRank算法
   */
  async pageRank(options: PageRankOptions = {}): Promise<PageRankResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const results = await this.nebulaService.pageRank(options);
      this.logger.info('PageRank calculation completed', {
        resultCount: results.length,
        topScore: results.length > 0 ? results[0].score : 0,
      });
      
      return results;
    } catch (error) {
      this.logger.error('PageRank calculation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`PageRank calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查找最短路径
   */
  async findShortestPath(options: ShortestPathOptions): Promise<ShortestPathResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const result = await this.nebulaService.findShortestPath(options);
      this.logger.info('Shortest path found', {
        sourceId: options.sourceId,
        targetId: options.targetId,
        distance: result.distance,
        pathLength: result.path.length,
      });
      
      return result;
    } catch (error) {
      this.logger.error('Shortest path finding failed', {
        error: error instanceof Error ? error.message : String(error),
        sourceId: options.sourceId,
        targetId: options.targetId,
      });
      throw new Error(`Shortest path finding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行图算法分析
   * 综合多种图算法进行深度分析
   */
  async analyzeGraph(options: {
    communityDetection?: CommunityDetectionOptions;
    pageRank?: PageRankOptions;
    includeShortestPaths?: boolean;
    nodeIds?: string[];
  } = {}): Promise<{
    communities: CommunityResult[];
    pageRankResults: PageRankResult[];
    shortestPaths?: ShortestPathResult[];
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const [communities, pageRankResults] = await Promise.all([
        this.communityDetection(options.communityDetection || {}),
        this.pageRank(options.pageRank || {}),
      ]);

      let shortestPaths: ShortestPathResult[] = [];
      
      if (options.includeShortestPaths && options.nodeIds && options.nodeIds.length >= 2) {
        const pathPromises: Promise<ShortestPathResult>[] = [];
        
        // 在选定的节点之间查找最短路径
        for (let i = 0; i < options.nodeIds.length - 1; i++) {
          for (let j = i + 1; j < options.nodeIds.length; j++) {
            pathPromises.push(
              this.findShortestPath({
                sourceId: options.nodeIds[i],
                targetId: options.nodeIds[j],
                maxDepth: 10,
              })
            );
          }
        }
        
        shortestPaths = await Promise.all(pathPromises);
      }

      this.logger.info('Graph analysis completed', {
        communityCount: communities.length,
        pageRankCount: pageRankResults.length,
        shortestPathCount: shortestPaths.length,
      });

      return {
        communities,
        pageRankResults,
        shortestPaths: options.includeShortestPaths ? shortestPaths : undefined,
      };
    } catch (error) {
      this.logger.error('Graph analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Graph analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
