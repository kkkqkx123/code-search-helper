import { NebulaQueryBuilder } from '../../../database/nebula/NebulaQueryBuilder';
import { TYPES } from '../../../types';
import { CodeGraphNode, CodeGraphRelationship } from './GraphPersistenceService';
import { injectable, inject } from 'inversify';

export interface SearchQuery {
  query: string;
  queryType: 'semantic' | 'relationship' | 'path' | 'fuzzy';
  filters?: {
    nodeTypes?: string[];
    relationshipTypes?: string[];
    projectId?: string;
    filePath?: string;
    minScore?: number;
  };
  pagination?: {
    limit: number;
    offset: number;
  };
  sortBy?: 'relevance' | 'created' | 'updated' | 'name';
}

export interface SearchResult {
  nodes: CodeGraphNode[];
  relationships: CodeGraphRelationship[];
  paths?: CodeGraphRelationship[][];
  metadata: {
    totalCount: number;
    queryTime: number;
    hasMore: boolean;
  };
}

@injectable()
export class GraphQueryBuilder {
  private nebulaQueryBuilder: NebulaQueryBuilder;

  constructor(@inject(TYPES.NebulaQueryBuilder) nebulaQueryBuilder: NebulaQueryBuilder) {
    this.nebulaQueryBuilder = nebulaQueryBuilder;
  }

  buildSearchQuery(searchQuery: SearchQuery): { nGQL: string; parameters: Record<string, any> } {
    const {
      query,
      queryType,
      filters = {},
      pagination = { limit: 10, offset: 0 },
      sortBy = 'relevance',
    } = searchQuery;

    switch (queryType) {
      case 'semantic':
        return this.buildSemanticSearchQuery(query, filters, pagination, sortBy);
      case 'relationship':
        return this.buildRelationshipSearchQuery(query, filters, pagination, sortBy);
      case 'path':
        return this.buildPathSearchQuery(query, filters, pagination, sortBy);
      case 'fuzzy':
        return this.buildFuzzySearchQuery(query, filters, pagination, sortBy);
      default:
        throw new Error(`Unsupported query type: ${queryType}`);
    }
  }

  private buildSemanticSearchQuery(
    query: string,
    filters: any,
    pagination: { limit: number; offset: number },
    sortBy: string
  ): { nGQL: string; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {
      query: `%${query}%`,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    let whereClauses: string[] = [];

    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      whereClauses.push(`v.type IN $nodeTypes`);
      parameters.nodeTypes = filters.nodeTypes;
    }

    if (filters.projectId) {
      whereClauses.push(`v.projectId == $projectId`);
      parameters.projectId = filters.projectId;
    }

    if (filters.filePath) {
      whereClauses.push(`v.filePath CONTAINS $filePath`);
      parameters.filePath = filters.filePath;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const nGQL = `
      MATCH (v) 
      ${whereClause}
      AND (v.name CONTAINS $query OR v.content CONTAINS $query OR v.description CONTAINS $query)
      RETURN v
      ORDER BY 
        CASE 
          WHEN v.name CONTAINS $query THEN 3
          WHEN v.description CONTAINS $query THEN 2
          ELSE 1
        END DESC
      LIMIT $limit OFFSET $offset
    `;

    return { nGQL, parameters };
  }

  private buildRelationshipSearchQuery(
    query: string,
    filters: any,
    pagination: { limit: number; offset: number },
    sortBy: string
  ): { nGQL: string; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {
      query: query,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    let whereClauses: string[] = [];

    if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
      whereClauses.push(`e.type IN $relationshipTypes`);
      parameters.relationshipTypes = filters.relationshipTypes;
    }

    if (filters.projectId) {
      whereClauses.push(`v1.projectId == $projectId AND v2.projectId == $projectId`);
      parameters.projectId = filters.projectId;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const nGQL = `
      MATCH (v1)-[e]->(v2)
      ${whereClause}
      AND (v1.name CONTAINS $query OR v2.name CONTAINS $query)
      RETURN v1, e, v2
      LIMIT $limit OFFSET $offset
    `;

    return { nGQL, parameters };
  }

  private buildPathSearchQuery(
    query: string,
    filters: any,
    pagination: { limit: number; offset: number },
    sortBy: string
  ): { nGQL: string; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {
      query: query,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    let whereClauses: string[] = [];

    if (filters.projectId) {
      whereClauses.push(`v1.projectId == $projectId`);
      parameters.projectId = filters.projectId;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const nGQL = `
      MATCH p = (v1)-[*1..3]->(v2)
      ${whereClause}
      AND (v1.name CONTAINS $query OR v2.name CONTAINS $query)
      RETURN p
      LIMIT $limit OFFSET $offset
    `;

    return { nGQL, parameters };
  }

  private buildFuzzySearchQuery(
    query: string,
    filters: any,
    pagination: { limit: number; offset: number },
    sortBy: string
  ): { nGQL: string; parameters: Record<string, any> } {
    const parameters: Record<string, any> = {
      query: query,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    let whereClauses: string[] = [];

    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      whereClauses.push(`v.type IN $nodeTypes`);
      parameters.nodeTypes = filters.nodeTypes;
    }

    if (filters.projectId) {
      whereClauses.push(`v.projectId == $projectId`);
      parameters.projectId = filters.projectId;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const nGQL = `
      MATCH (v)
      ${whereClause}
      AND v.name =~ $query
      RETURN v
      ORDER BY v.name ASC
      LIMIT $limit OFFSET $offset
    `;

    return { nGQL, parameters };
  }

  buildNodeExistenceQuery(nodeId: string): { nGQL: string; parameters: Record<string, any> } {
    return {
      nGQL: `FETCH PROP ON * $nodeId YIELD vertex AS node`,
      parameters: { nodeId },
    };
  }

  buildRelatedNodesQuery(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth: number = 2
  ): { nGQL: string; parameters: Record<string, any> } {
    const parameters: Record<string, any> = { nodeId };

    let edgeFilter = '';
    if (relationshipTypes && relationshipTypes.length > 0) {
      edgeFilter = `:${relationshipTypes.join('|')}`;
    }

    const nGQL = `
      GO FROM $nodeId OVER * ${maxDepth} STEPS
      YIELD dst(edge) AS destination
      | FETCH PROP ON * $-.destination YIELD vertex AS related
    `;

    return { nGQL, parameters };
  }

  buildPathQuery(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): { nGQL: string; parameters: Record<string, any> } {
    return {
      nGQL: `FIND SHORTEST PATH FROM $sourceId TO $targetId OVER * UPTO ${maxDepth} STEPS YIELD path as p`,
      parameters: { sourceId, targetId },
    };
  }

  buildGraphStatsQuery(): { nGQL: string; parameters: Record<string, any> } {
    return {
      nGQL: 'SHOW STATS',
      parameters: {},
    };
  }

  buildNodeCountQuery(nodeType: string): { nGQL: string; parameters: Record<string, any> } {
    return {
      nGQL: `MATCH (v:${nodeType}) RETURN count(v) AS total`,
      parameters: {},
    };
  }

  buildRelationshipCountQuery(relationshipType: string): {
    nGQL: string;
    parameters: Record<string, any>;
  } {
    return {
      nGQL: `MATCH ()-[e:${relationshipType}]->() RETURN count(e) AS total`,
      parameters: {},
    };
  }
}
