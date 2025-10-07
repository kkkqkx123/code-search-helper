import {
  GraphSearchOptions,
  GraphSearchResult
} from './types';

/**
 * 图搜索服务接口
 * 专注于图数据搜索、搜索建议和搜索统计功能
 */
export interface IGraphSearchService {
  /**
   * 通用搜索
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns 搜索结果
   */
  search(query: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;

  /**
   * 按节点类型搜索
   * @param nodeType 节点类型
   * @param options 搜索选项
   * @returns 搜索结果
   */
  searchByNodeType(nodeType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;

  /**
   * 按关系类型搜索
   * @param relationshipType 关系类型
   * @param options 搜索选项
   * @returns 搜索结果
   */
  searchByRelationshipType(relationshipType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;

  /**
   * 按路径搜索
   * @param sourceId 源节点ID
   * @param targetId 目标节点ID
   * @param options 搜索选项
   * @returns 搜索结果
   */
  searchByPath(sourceId: string, targetId: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;

  /**
   * 获取搜索建议
   * @param query 搜索查询
   * @returns 搜索建议列表
   */
  getSearchSuggestions(query: string): Promise<string[]>;

  /**
   * 获取搜索统计信息
   * @returns 搜索统计信息
   */
  getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }>;
}