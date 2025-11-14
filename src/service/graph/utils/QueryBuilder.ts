/**
 * 查询构建器工具类
 * 用于构建各种图数据库查询
 */

import { SearchType, QUERY_TEMPLATES } from '../constants/GraphSearchConstants';
import { GraphSearchOptions } from '../core/types';

export class QueryBuilder {
  /**
   * 构建搜索查询
   */
  static buildSearchQuery(query: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { limit = 10, depth = 2, relationshipTypes, nodeTypes, searchType = SearchType.KEYWORD } = options;
    const params: Record<string, any> = {};

    switch (searchType) {
      case SearchType.KEYWORD:
        return this.buildKeywordQuery(query, nodeTypes, limit);
        
      case SearchType.EXACT:
        return {
          nGQL: QUERY_TEMPLATES.FETCH_BY_ID(query),
          params
        };
        
      case SearchType.NEIGHBOR:
        return this.buildNeighborQuery(query, depth, limit, nodeTypes, relationshipTypes);
        
      case SearchType.PATH:
        return this.buildPathQueryFromString(query, depth, limit);
        
      case SearchType.SCHEMA:
        return this.buildSchemaQuery(query, limit, nodeTypes, relationshipTypes);
        
      default:
        return {
          nGQL: QUERY_TEMPLATES.LOOKUP_ALL(query, limit),
          params
        };
    }
  }

  /**
   * 构建关键词查询
   */
  private static buildKeywordQuery(query: string, nodeTypes?: string[], limit?: number): { nGQL: string; params: Record<string, any> } {
    if (nodeTypes && nodeTypes.length > 0) {
      return {
        nGQL: QUERY_TEMPLATES.LOOKUP_ON_TYPES(query, nodeTypes, limit || 10),
        params: {}
      };
    } else {
      return {
        nGQL: QUERY_TEMPLATES.LOOKUP_ALL(query, limit || 10),
        params: {}
      };
    }
  }

  /**
   * 构建邻居查询
   */
  private static buildNeighborQuery(
    query: string, 
    depth: number, 
    limit: number, 
    nodeTypes?: string[], 
    relationshipTypes?: string[]
  ): { nGQL: string; params: Record<string, any> } {
    if (nodeTypes && nodeTypes.length > 0) {
      return {
        nGQL: QUERY_TEMPLATES.GO_NEIGHBOR_WITH_NODE_TYPES(query, depth, nodeTypes, limit),
        params: {}
      };
    } else if (relationshipTypes && relationshipTypes.length > 0) {
      return {
        nGQL: QUERY_TEMPLATES.GO_NEIGHBOR_WITH_REL_TYPES(query, depth, relationshipTypes, limit),
        params: {}
      };
    } else {
      return {
        nGQL: QUERY_TEMPLATES.GO_NEIGHBOR(query, depth, limit),
        params: {}
      };
    }
  }

  /**
   * 构建路径查询（从查询字符串）
   */
  private static buildPathQueryFromString(query: string, depth: number, limit: number): { nGQL: string; params: Record<string, any> } {
    const ids = query.split(',');
    if (ids.length >= 2) {
      const sourceId = ids[0];
      const targetId = ids[1];
      return {
        nGQL: QUERY_TEMPLATES.FIND_SHORTEST_PATH(sourceId, targetId, depth, limit),
        params: {}
      };
    } else {
      return {
        nGQL: QUERY_TEMPLATES.GO_PATH(query, depth, limit),
        params: {}
      };
    }
  }

  /**
   * 构建模式查询
   */
  private static buildSchemaQuery(
    query: string, 
    limit: number, 
    nodeTypes?: string[], 
    relationshipTypes?: string[]
  ): { nGQL: string; params: Record<string, any> } {
    if (nodeTypes && nodeTypes.length > 0) {
      return {
        nGQL: QUERY_TEMPLATES.LOOKUP_ON_NODE_TYPES_ONLY(nodeTypes, limit),
        params: {}
      };
    } else if (relationshipTypes && relationshipTypes.length > 0) {
      return {
        nGQL: QUERY_TEMPLATES.GO_WITH_REL_TYPES(query, relationshipTypes, limit),
        params: {}
      };
    } else {
      return {
        nGQL: QUERY_TEMPLATES.LOOKUP_ALL(query, limit),
        params: {}
      };
    }
  }

  /**
   * 构建节点类型查询
   */
  static buildNodeTypeQuery(nodeType: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { limit = 10 } = options;
    return {
      nGQL: QUERY_TEMPLATES.LOOKUP_ON_NODE_TYPE(nodeType, limit),
      params: {}
    };
  }

  /**
   * 构建关系类型查询
   */
  static buildRelationshipTypeQuery(relationshipType: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { limit = 10 } = options;
    return {
      nGQL: QUERY_TEMPLATES.MATCH_RELATIONSHIP_TYPE(relationshipType, limit),
      params: {}
    };
  }

  /**
   * 构建路径查询
   */
  static buildPathQuery(sourceId: string, targetId: string, options: GraphSearchOptions): { nGQL: string; params: Record<string, any> } {
    const { depth = 5 } = options;
    return {
      nGQL: QUERY_TEMPLATES.FIND_PATH(sourceId, targetId, depth),
      params: {}
    };
  }

  /**
   * 构建节点插入查询
   */
  static buildNodeInsertQuery(node: any): string {
    const nodeId = node.id || node._id || PropertyFormatter.generateUniqueId('node');
    const nodeType = node.type || node.label || 'default';
    const { names, values } = PropertyFormatter.buildPropertyString(node.properties || node.props || {});

    return `
      INSERT VERTEX \`${nodeType}\` (${names})
      VALUES "${nodeId}": (${values})
    `;
  }

  /**
   * 构建边插入查询
   */
  static buildEdgeInsertQuery(edge: any): string {
    const sourceId = edge.sourceId || edge.src || edge.from;
    const targetId = edge.targetId || edge.dst || edge.to;
    const edgeType = edge.type || edge.edgeType || 'default';
    const { names, values } = PropertyFormatter.buildPropertyString(edge.properties || edge.props || {});

    return `
      INSERT EDGE \`${edgeType}\` (${names})
      VALUES "${sourceId}" -> "${targetId}": (${values})
    `;
  }

  /**
   * 构建批量删除节点查询
   */
  static buildBatchDeleteNodesQuery(nodeIds: string[]): string {
    const nodeIdsStr = nodeIds.map(id => `"${id}"`).join(', ');
    return `DELETE VERTEX ${nodeIdsStr} WITH EDGE`;
  }
}

// 避免循环导入，在这里导入PropertyFormatter
import { PropertyFormatter } from './PropertyFormatter';