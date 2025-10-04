import { GraphQuery, GraphResult, GraphStats, PathResult, SpaceOperation, SpaceOperationResult, PathSearchOptions } from '../types/graph.js';

/**
 * 图API客户端服务
 * 封装与后端图数据库API的通信
 */
export class GraphApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3010') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * 执行图查询
   */
  async executeQuery(query: GraphQuery): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    return await response.json();
  }
  
  /**
   * 获取图统计信息
   */
  async getGraphStats(projectId: string): Promise<GraphStats> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/stats/${projectId}`);
    const result = await response.json();
    return result.data;
  }
  
  /**
   * 执行路径搜索
   */
  async findPath(sourceId: string, targetId: string, options?: PathSearchOptions): Promise<PathResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/path/shortest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sourceId, 
        targetId, 
        options 
      })
    });
    return await response.json();
  }
  
  /**
   * 管理项目空间
   */
  async manageSpace(projectId: string, operation: SpaceOperation): Promise<SpaceOperationResult> {
    const endpoint = operation === 'info' 
      ? `/api/v1/graph/space/${projectId}/info`
      : `/api/v1/graph/space/${projectId}/${operation}`;
    
    const method = operation === 'info' ? 'GET' : 'POST';
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  }
  
  /**
   * 执行自定义图查询
   */
  async customQuery(query: string, projectId: string): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query,
        projectId
      })
    });
    return await response.json();
  }
  
  /**
   * 查询相关节点
   */
  async findRelatedNodes(nodeId: string, options?: { 
    relationshipTypes?: string[];
    maxDepth?: number;
    direction?: 'in' | 'out' | 'both';
  }): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nodeId,
        options
      })
    });
    return await response.json();
  }
  
  /**
   * 执行所有路径搜索
   */
  async findAllPaths(sourceId: string, targetId: string, options?: PathSearchOptions): Promise<PathResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/path/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sourceId, 
        targetId, 
        options 
      })
    });
    return await response.json();
  }
  
  /**
   * 执行图遍历查询
   */
  async traverseGraph(startNodeId: string, options?: { 
    maxDepth?: number;
    relationshipTypes?: string[];
    direction?: 'in' | 'out' | 'both';
  }): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/traversal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        startNodeId,
        options
      })
    });
    return await response.json();
  }
  
  /**
   * 执行图分析 - 依赖分析
   */
  async analyzeDependencies(filePath: string, projectId: string, options?: {
    includeTransitive?: boolean;
    includeCircular?: boolean;
  }): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/analysis/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        filePath,
        projectId,
        ...options
      })
    });
    return await response.json();
  }
  
  /**
   * 执行图分析 - 调用图分析
   */
  async analyzeCallGraph(functionName: string, projectId: string, options?: {
    depth?: number;
    direction?: 'in' | 'out' | 'both';
  }): Promise<GraphResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/analysis/callgraph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        functionName,
        projectId,
        ...options
      })
    });
    return await response.json();
  }
  
  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/graph/stats/health`);
    return await response.json();
  }
}