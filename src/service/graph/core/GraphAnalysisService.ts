import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { IGraphService } from './IGraphService';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import {
  GraphAnalysisOptions,
  GraphAnalysisResult,
  CodeGraphRelationship
} from './types';

/**
 * 图分析服务
 * 职责：专注于分析逻辑，不包含缓存、查询执行等重复功能
 */
@injectable()
export class GraphAnalysisService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphService: IGraphService;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.IGraphService) graphService: IGraphService,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphService = graphService;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph analysis service');

      // 确保图服务已初始化
      if (!this.graphService.isDatabaseConnected()) {
        const initialized = await this.graphService.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph service');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph analysis service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph analysis service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * 分析代码库
   */
  async analyzeCodebase(
    projectPath: string,
    options: GraphAnalysisOptions = {}
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const cacheKey = `analysis_${projectPath}_${JSON.stringify(options)}`;

    // 检查缓存
    const cachedResult = this.cacheService.getFromCache<{
      result: GraphAnalysisResult;
      formattedResult: any;
    }>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate?.(true);
      this.logger.info('Returning cached codebase analysis result', { projectPath });
      return cachedResult;
    }

    try {
      this.logger.info('Starting codebase analysis', {
        projectPath,
        options,
      });

      // 构建分析查询
      const analysisQuery = this.buildCodeAnalysisQuery(projectPath, options);
      const result = await this.graphService.executeReadQuery(analysisQuery.nGQL, analysisQuery.parameters);

      const processedResult = this.processAnalysisResult(result, options);
      const formattedResult = this.formatForLLM(processedResult);

      // 缓存结果
      this.cacheService.setCache(cacheKey, { result: processedResult, formattedResult }, 300000); // 5分钟
      this.performanceMonitor.updateCacheHitRate?.(false);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.logger.info('Codebase analysis completed', {
        projectPath,
        nodeCount: processedResult.nodes.length,
        edgeCount: processedResult.edges.length,
        executionTime,
      });

      return {
        result: processedResult,
        formattedResult,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution?.(executionTime);

      this.errorHandler.handleError(
        new Error(`Codebase analysis failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'analyzeCodebase' }
      );
      throw error;
    }
  }

  /**
   * 查找依赖关系
   */
  async findDependencies(
    filePath: string,
    options: { direction?: 'incoming' | 'outgoing'; depth?: number } = {}
  ): Promise<{
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Finding dependencies', { filePath, options });

      const direction = options.direction || 'outgoing';
      const depth = options.depth || 3;

      // 构建依赖查询
      const dependencyQuery = this.buildDependencyQuery(filePath, direction, depth);
      const result = await this.graphService.executeReadQuery(dependencyQuery.nGQL, dependencyQuery.parameters);

      return this.processDependencyResult(result, direction, depth);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Dependency analysis failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'findDependencies' }
      );
      throw error;
    }
  }

  /**
   * 查找影响范围
   */
  async findImpact(
    filePath: string,
    options: { maxDepth?: number; includeTests?: boolean } = {}
  ): Promise<{
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactScore: number;
    affectedComponents: string[];
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Finding impact', { filePath, options });

      const maxDepth = options.maxDepth || 3;

      // 构建影响分析查询
      const impactQuery = this.buildImpactQuery(filePath, maxDepth);
      const result = await this.graphService.executeReadQuery(impactQuery.nGQL, impactQuery.parameters);

      if (result && result.data) {
        const affectedFiles = result.data
          .filter((record: any) => record.affectedNode?.tag === 'File')
          .map((record: any) => record.affectedNode.properties.path);

        const affectedComponents = result.data
          .filter((record: any) =>
            record.affectedNode?.tag === 'Function' ||
            record.affectedNode?.tag === 'Class'
          )
          .map((record: any) => record.affectedNode.properties.name);

        // 计算影响分数
        const impactScore = Math.min(
          (affectedFiles.length * 2 + affectedComponents.length) / 10,
          10
        );

        // 确定风险等级
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (impactScore > 7) riskLevel = 'critical';
        else if (impactScore > 5) riskLevel = 'high';
        else if (impactScore > 3) riskLevel = 'medium';

        return {
          affectedFiles,
          riskLevel,
          impactScore,
          affectedComponents,
        };
      }

      return {
        affectedFiles: [],
        riskLevel: 'low',
        impactScore: 0,
        affectedComponents: [],
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'findImpact' }
      );
      throw error;
    }
  }

  /**
   * 获取图统计信息
   */
  async getGraphStats(projectPath: string): Promise<{
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    complexityScore: number;
    maintainabilityIndex: number;
    cyclicDependencies: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Getting graph statistics', { projectPath });

      // 构建统计查询
      const statsQueries = [
        this.buildNodeCountQuery('File'),
        this.buildNodeCountQuery('Function'),
        this.buildNodeCountQuery('Class'),
        this.buildNodeCountQuery('Import')
      ];

      // 并行执行查询
      const [
        fileResult,
        functionResult,
        classResult,
        importResult,
      ] = await Promise.all(
        statsQueries.map(query => this.graphService.executeReadQuery(query.nGQL, query.parameters))
      );

      const totalFiles = this.extractCount(fileResult);
      const totalFunctions = this.extractCount(functionResult);
      const totalClasses = this.extractCount(classResult);
      const totalImports = this.extractCount(importResult);

      // 计算复杂度分数（简化）
      const complexityScore = Math.min(
        (totalFunctions * 2 + totalClasses * 3 + totalImports) / 10,
        100
      );

      // 计算可维护性指数（简化）
      const maintainabilityIndex = Math.max(
        100 - complexityScore - (totalImports * 0.5),
        0
      );

      // 检测循环依赖（简化）
      const cyclicDependencies = await this.detectCyclicDependencies();

      return {
        totalFiles,
        totalFunctions,
        totalClasses,
        totalImports,
        complexityScore,
        maintainabilityIndex,
        cyclicDependencies,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Graph stats calculation failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'getGraphStats' }
      );
      throw error;
    }
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph analysis service');
      this.isInitialized = false;
      this.logger.info('Graph analysis service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close graph analysis service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'close' }
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

  // 私有方法

  /**
   * 构建代码分析查询
   */
  private buildCodeAnalysisQuery(projectPath: string, options: GraphAnalysisOptions): { nGQL: string; parameters?: Record<string, any> } {
    const depth = options.depth || 3;
    const nGQL = `
      MATCH (v)
      WHERE v.projectPath = "${projectPath}"
      RETURN v AS node
      LIMIT ${options.maxResults || 1000}
    `;
    
    return { nGQL };
  }

  /**
   * 构建依赖查询
   */
  private buildDependencyQuery(filePath: string, direction: string, depth: number): { nGQL: string; parameters?: Record<string, any> } {
    const directionKeyword = direction === 'incoming' ? 'REVERSE' : '';
    const nGQL = `
      GO ${depth} STEPS FROM "${filePath}" OVER IMPORTS ${directionKeyword}
      YIELD dst(edge) AS dependentNode
      | FETCH PROP ON * $-.dependentNode YIELD vertex AS dependentNode
      LIMIT 100
    `;
    
    return { nGQL };
  }

  /**
   * 构建影响查询
   */
  private buildImpactQuery(filePath: string, maxDepth: number): { nGQL: string; parameters?: Record<string, any> } {
    const nGQL = `
      GO ${maxDepth} STEPS FROM "${filePath}" OVER IMPORTS, CALLS, CONTAINS REVERSE
      YIELD dst(edge) AS affectedNodeId
      | FETCH PROP ON * $-.affectedNodeId YIELD vertex AS affectedNode
      LIMIT 100
    `;
    
    return { nGQL };
  }

  /**
   * 构建节点计数查询
   */
  private buildNodeCountQuery(nodeType: string): { nGQL: string; parameters?: Record<string, any> } {
    const nGQL = `
      MATCH (v:${nodeType})
      RETURN count(*) AS total
    `;
    
    return { nGQL };
  }

  /**
   * 处理分析结果
   */
  private processAnalysisResult(
    result: any,
    options: GraphAnalysisOptions
  ): GraphAnalysisResult {
    const nodes: any[] = [];
    const edges: any[] = [];

    if (result && result.data) {
      for (const row of result.data) {
        if (row.node) {
          nodes.push(this.convertToGraphNode(row.node));
        }
        if (row.edgeProps) {
          edges.push(this.convertToGraphEdge(row.edgeProps));
        }
      }
    }

    // 计算指标
    const metrics = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      averageDegree: edges.length / Math.max(nodes.length, 1),
      maxDepth: options.depth || 3,
      componentCount: this.calculateComponentCount(nodes, edges),
    };

    // 计算摘要
    const summary = this.calculateSummary(nodes);

    return { nodes, edges, metrics, summary };
  }

  /**
   * 处理依赖结果
   */
  private processDependencyResult(
    result: any,
    direction: string,
    depth: number
  ): {
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  } {
    const allEdges: CodeGraphRelationship[] = [];

    if (result && result.data) {
      for (const row of result.data) {
        if (row.edgeProps) {
          allEdges.push(this.convertToCodeGraphRelationship(row.edgeProps));
        }
      }
    }

    // 分离直接和传递依赖
    const direct = allEdges.slice(0, 5);
    const transitive = allEdges.slice(0, 15);

    return {
      direct,
      transitive,
      summary: {
        directCount: direct.length,
        transitiveCount: transitive.length,
        criticalPath: this.extractCriticalPath(allEdges),
      },
    };
  }

  /**
   * 转换为图节点
   */
  private convertToGraphNode(nodeData: any): any {
    return {
      id: nodeData.id || nodeData.name || '',
      label: nodeData.name || nodeData.label || '',
      properties: nodeData.properties || {},
      type: this.determineNodeType(nodeData),
    };
  }

  /**
   * 转换为图边
   */
  private convertToGraphEdge(edgeData: any): any {
    return {
      id: edgeData.id || `${edgeData.src}_${edgeData.dst}`,
      source: edgeData.src || '',
      target: edgeData.dst || '',
      type: edgeData.type || 'RELATED',
      properties: edgeData.properties || {},
    };
  }

  /**
   * 转换为代码图关系
   */
  private convertToCodeGraphRelationship(edgeData: any): CodeGraphRelationship {
    return {
      id: edgeData.id || `${edgeData.src}_${edgeData.dst}`,
      type: edgeData.type || 'RELATED',
      sourceId: edgeData.src || '',
      targetId: edgeData.dst || '',
      properties: edgeData.properties || {},
    };
  }

  /**
   * 确定节点类型
   */
  private determineNodeType(nodeData: any): string {
    if (nodeData.label && nodeData.label.includes('.')) return 'file';
    if (nodeData.type === 'function') return 'function';
    if (nodeData.type === 'class') return 'class';
    if (nodeData.type === 'variable') return 'variable';
    if (nodeData.type === 'import') return 'import';
    return 'project';
  }

  /**
   * 计算组件数量
   */
  private calculateComponentCount(nodes: any[], edges: any[]): number {
    const visited = new Set<string>();
    let components = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.dfs(node.id, nodes, edges, visited);
        components++;
      }
    }

    return components;
  }

  /**
   * 深度优先搜索
   */
  private dfs(nodeId: string, nodes: any[], edges: any[], visited: Set<string>): void {
    visited.add(nodeId);

    for (const edge of edges) {
      if (edge.source === nodeId && !visited.has(edge.target)) {
        this.dfs(edge.target, nodes, edges, visited);
      }
      if (edge.target === nodeId && !visited.has(edge.source)) {
        this.dfs(edge.source, nodes, edges, visited);
      }
    }
  }

  /**
   * 计算摘要
   */
  private calculateSummary(nodes: any[]): {
    projectFiles: number;
    functions: number;
    classes: number;
    imports: number;
    externalDependencies: number;
  } {
    const summary = {
      projectFiles: 0,
      functions: 0,
      classes: 0,
      imports: 0,
      externalDependencies: 0,
    };

    for (const node of nodes) {
      switch (node.type) {
        case 'file':
          summary.projectFiles++;
          break;
        case 'function':
          summary.functions++;
          break;
        case 'class':
          summary.classes++;
          break;
        case 'import':
          summary.imports++;
          if (node.properties.external) {
            summary.externalDependencies++;
          }
          break;
      }
    }

    return summary;
  }

  /**
   * 提取关键路径
   */
  private extractCriticalPath(relationships: CodeGraphRelationship[]): string[] {
    const path: string[] = [];
    const edgeCount = new Map<string, number>();

    for (const relationship of relationships) {
      edgeCount.set(relationship.sourceId, (edgeCount.get(relationship.sourceId) || 0) + 1);
      edgeCount.set(relationship.targetId, (edgeCount.get(relationship.targetId) || 0) + 1);
    }

    const sortedNodes = Array.from(edgeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nodeId]) => nodeId);

    return sortedNodes;
  }

  /**
   * 格式化为LLM可读格式
   */
  private formatForLLM(result: GraphAnalysisResult): any {
    return {
      nodes: result.nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        properties: node.properties
      })),
      edges: result.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        properties: edge.properties
      })),
      metrics: result.metrics,
      summary: result.summary,
      insights: this.generateInsights(result)
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(result: GraphAnalysisResult): string[] {
    const insights: string[] = [];

    if (result.metrics.averageDegree > 5) {
      insights.push("The codebase has a high connectivity, which may indicate tight coupling between components.");
    }

    if (result.summary.externalDependencies > result.summary.projectFiles * 0.5) {
      insights.push("The project has a high ratio of external dependencies to project files, which may increase maintenance complexity.");
    }

    if (result.metrics.componentCount < 5) {
      insights.push("The project has few connected components, which may indicate a monolithic architecture.");
    }

    return insights;
  }

  /**
   * 提取计数
   */
  private extractCount(result: any): number {
    if (result && result.data && result.data.length > 0) {
      return result.data[0].total || 0;
    }
    return 0;
  }

  /**
   * 检测循环依赖
   */
  private async detectCyclicDependencies(): Promise<number> {
    try {
      const query = `
        MATCH (f1:File)-[:IMPORTS]->(f2:File)-[:IMPORTS*]->(f1)
        RETURN count(*) AS cycles
      `;

      const result = await this.graphService.executeReadQuery(query);
      return this.extractCount(result);
    } catch (error) {
      this.logger.warn('Failed to detect cyclic dependencies', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}