import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaQueryBuilder } from '../nebula/NebulaQueryBuilder';

export interface IGraphQueryBuilder {
  buildNodeCountQuery(tag: string): { nGQL: string; parameters: Record<string, any> };
  buildRelationshipCountQuery(edgeType: string): { nGQL: string; parameters: Record<string, any> };
  buildNodeSearchQuery(searchTerm: string, nodeType?: string): { nGQL: string; parameters: Record<string, any> };
  buildRelationshipSearchQuery(relationshipType: string): { nGQL: string; parameters: Record<string, any> };
  buildPathQuery(sourceId: string, targetId: string, maxDepth?: number): { nGQL: string; parameters: Record<string, any> };
  buildDependencyQuery(fileId: string, direction?: 'incoming' | 'outgoing', depth?: number): { nGQL: string; parameters: Record<string, any> };
  buildCodeStructureQuery(fileId: string): { nGQL: string; parameters: Record<string, any> };
  buildImportQuery(fileId: string): { nGQL: string; parameters: Record<string, any> };
  buildCallQuery(functionId: string): { nGQL: string; parameters: Record<string, any> };
  buildComplexTraversal(startId: string, edgeTypes: string[], options?: any): { nGQL: string; parameters: Record<string, any> };
  buildCommunityDetectionQuery(options?: any): { nGQL: string; parameters: Record<string, any> };
  buildPageRankQuery(options?: any): { nGQL: string; parameters: Record<string, any> };
  buildCodeAnalysisQuery(projectId: string, options?: any): { nGQL: string; parameters: Record<string, any> };
  
  // Additional methods used in tests
  buildInsertNodeQuery(nodeData: { tag: string; id: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> };
  buildInsertRelationshipQuery(relationshipData: { type: string; sourceId: string; targetId: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> };
  buildUpdateNodeQuery(updateData: { tag: string; id: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> };
  buildDeleteNodeQuery(nodeId: string): { nGQL: string; parameters: Record<string, any> };
  buildFindRelatedNodesQuery(nodeId: string, relationshipTypes?: string[], maxDepth?: number): { nGQL: string; parameters: Record<string, any> };
  buildFindPathQuery(sourceId: string, targetId: string, maxDepth?: number): { nGQL: string; parameters: Record<string, any> };
  batchInsertVertices(vertices: Array<{ tag: string; id: string; properties: Record<string, any> }>): { query: string; params: Record<string, any> };
  batchInsertEdges(edges: Array<{ type: string; srcId: string; dstId: string; properties: Record<string, any> }>): { query: string; params: Record<string, any> };
}

@injectable()
export class GraphQueryBuilder implements IGraphQueryBuilder {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private nebulaQueryBuilder: NebulaQueryBuilder;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.INebulaQueryBuilder) nebulaQueryBuilder: NebulaQueryBuilder
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.nebulaQueryBuilder = nebulaQueryBuilder;
  }

  buildNodeCountQuery(tag: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `LOOKUP ON \`${tag}\` YIELD count(*) AS total`;
    return { nGQL: query, parameters: {} };
  }

  buildRelationshipCountQuery(edgeType: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `MATCH () -[r:\`${edgeType}\`]-> () RETURN count(r) AS total`;
    return { nGQL: query, parameters: {} };
  }

  buildNodeSearchQuery(searchTerm: string, nodeType?: string): { nGQL: string; parameters: Record<string, any> } {
    let query = '';

    if (nodeType) {
      // Search within a specific node type
      query = `
        LOOKUP ON \`${nodeType}\` WHERE name CONTAINS "${searchTerm}" OR content CONTAINS "${searchTerm}"
        YIELD vertex AS node
        | FETCH PROP ON \`${nodeType}\` $-.node._id YIELD vertex AS detailed_node
        LIMIT 10
      `;
    } else {
      // Search across all node types
      query = `
        LOOKUP ON * WHERE * CONTAINS "${searchTerm}"
        YIELD vertex AS node
        LIMIT 10
      `;
    }

    return { nGQL: query, parameters: { searchTerm } };
  }

  buildRelationshipSearchQuery(relationshipType: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `
      MATCH ()-[r:\`${relationshipType}\`]->()
      RETURN r
      LIMIT 10
    `;
    return { nGQL: query, parameters: { relationshipType } };
  }

  buildPathQuery(sourceId: string, targetId: string, maxDepth: number = 5): { nGQL: string; parameters: Record<string, any> } {
    const query = `
      FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${maxDepth} STEPS
      YIELD path AS p
    `;
    return { nGQL: query, parameters: { sourceId, targetId, maxDepth } };
  }

  buildDependencyQuery(
    fileId: string,
    direction: 'incoming' | 'outgoing' = 'outgoing',
    depth: number = 3
  ): { nGQL: string; parameters: Record<string, any> } {
    let edgeTypes: string;

    if (direction === 'outgoing') {
      edgeTypes = 'IMPORTS, CALLS';
    } else {
      edgeTypes = 'IMPORTS_REVERSE, CALLS_REVERSE';
    }

    const query = `
      GO ${depth} STEPS FROM "${fileId}" OVER ${edgeTypes}
      YIELD dst(edge) AS dependency
      | FETCH PROP ON * $-.dependency YIELD vertex AS node
      LIMIT 50
    `;

    return { nGQL: query, parameters: { fileId, depth } };
  }

  buildCodeStructureQuery(fileId: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `
      MATCH (f:File {id: "${fileId}"})-[:CONTAINS]->(child)
      RETURN f, child
      LIMIT 100
    `;
    return { nGQL: query, parameters: { fileId } };
  }

  buildImportQuery(fileId: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `
      GO FROM "${fileId}" OVER IMPORTS
      YIELD dst(edge) AS imported_module
      | FETCH PROP ON * $-.imported_module YIELD vertex AS module
      LIMIT 20
    `;
    return { nGQL: query, parameters: { fileId } };
  }

  buildCallQuery(functionId: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `
      GO FROM "${functionId}" OVER CALLS
      YIELD dst(edge) AS called_function
      | FETCH PROP ON * $-.called_function YIELD vertex AS function
      LIMIT 20
    `;
    return { nGQL: query, parameters: { functionId } };
  }

  /**
   * 构建复杂图遍历查询
   */
  buildComplexTraversal(
    startId: string,
    edgeTypes: string[],
    options: any = {}
  ): { nGQL: string; parameters: Record<string, any> } {
    const { maxDepth = 3, filterConditions = [], returnFields = ['vertex'], limit = 10 } = options;

    const edgeTypeClause = edgeTypes.length > 0 ? `OVER ${edgeTypes.join(',')}` : 'OVER *';
    const filterClause =
      filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';
    const returnClause = returnFields.join(', ');

    const query = `
      GO ${maxDepth} STEPS FROM "${startId}" ${edgeTypeClause}
      YIELD dst(edge) AS destination
      ${filterClause}
      | FETCH PROP ON * $-.destination YIELD ${returnClause}
      LIMIT ${limit}
    `;

    return { nGQL: query, parameters: { startId } };
  }

  /**
   * 构建社区发现查询
   */
  buildCommunityDetectionQuery(options: any = {}): { nGQL: string; parameters: Record<string, any> } {
    const { limit = 10, minCommunitySize = 2, maxIterations = 10 } = options;

    const query = `
      GET SUBGRAPH WITH PROP FROM ${minCommunitySize} 
      STEPS FROM "*" 
      YIELD VERTICES AS nodes, EDGES AS relationships
      | FIND SHORTEST PATH FROM nodes.community_id OVER * 
      YIELD path AS community_path
      | GROUP BY community_path.community_id 
      YIELD community_path.community_id AS communityId, 
             COLLECT(community_path.vertex_id) AS members
      ORDER BY SIZE(members) DESC
      LIMIT ${limit}
    `;

    return { nGQL: query, parameters: { limit, minCommunitySize, maxIterations } };
  }

  /**
   * 构建PageRank查询
   */
  buildPageRankQuery(options: any = {}): { nGQL: string; parameters: Record<string, any> } {
    const { limit = 10, iterations = 20, dampingFactor = 0.85 } = options;

    const query = `
      GET SUBGRAPH FROM "*" 
      YIELD VERTICES AS nodes
      | FIND SHORTEST PATH FROM nodes.rank OVER * 
      YIELD path AS rank_path
      | GROUP BY rank_path.vertex_id 
      YIELD rank_path.vertex_id AS nodeId, 
             SUM(1.0 / LENGTH(rank_path)) AS score
      ORDER BY score DESC
      LIMIT ${limit}
    `;

    return { nGQL: query, parameters: { limit, iterations, dampingFactor } };
  }

  /**
   * 构建代码分析查询
   */
  buildCodeAnalysisQuery(projectId: string, options: any = {}): { nGQL: string; parameters: Record<string, any> } {
    const { depth = 3, focus = 'dependencies' } = options;

    let edgeTypes: string[];
    switch (focus) {
      case 'dependencies':
        edgeTypes = ['IMPORTS', 'CALLS'];
        break;
      case 'imports':
        edgeTypes = ['IMPORTS'];
        break;
      case 'classes':
        edgeTypes = ['EXTENDS', 'CONTAINS'];
        break;
      case 'functions':
        edgeTypes = ['CALLS', 'CONTAINS'];
        break;
      default:
        edgeTypes = ['IMPORTS', 'CALLS', 'EXTENDS', 'CONTAINS', 'BELONGS_TO'];
    }

    const query = `
      GO ${depth} STEPS FROM "${projectId}" OVER ${edgeTypes.join(',')} 
      YIELD dst(edge) AS destination, properties(edge) AS edgeProps
      | FETCH PROP ON * $-.destination YIELD vertex AS node, $-.edgeProps AS edgeProps
      LIMIT 1000
    `;

    return { nGQL: query, parameters: { projectId, depth } };
  }
  
  buildInsertNodeQuery(nodeData: { tag: string; id: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> } {
    const { tag, id, properties } = nodeData;
    
    // Build property assignments
    const propertyAssignments = Object.entries(properties)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}:"${value}"`;
        } else {
          return `${key}:${value}`;
        }
      })
      .join(', ');
    
    const query = `INSERT VERTEX \`${tag}\` (${Object.keys(properties).join(', ')}) VALUES "${id}":(${propertyAssignments})`;
    
    return { nGQL: query, parameters: {} };
  }
  
  buildInsertRelationshipQuery(relationshipData: { type: string; sourceId: string; targetId: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> } {
    const { type, sourceId, targetId, properties } = relationshipData;
    
    // Build property assignments
    const propertyAssignments = Object.entries(properties)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}:"${value}"`;
        } else {
          return `${key}:${value}`;
        }
      })
      .join(', ');
    
    const query = `INSERT EDGE \`${type}\` (${Object.keys(properties).join(', ')}) VALUES "${sourceId}" -> "${targetId}":(${propertyAssignments})`;
    
    return { nGQL: query, parameters: {} };
  }
  
  buildUpdateNodeQuery(updateData: { tag: string; id: string; properties: Record<string, any> }): { nGQL: string; parameters: Record<string, any> } {
    const { tag, id, properties } = updateData;
    
    // Build SET clause
    const setClause = Object.entries(properties)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}:"${value}"`;
        } else {
          return `${key}:${value}`;
        }
      })
      .join(', ');
    
    const query = `UPDATE VERTEX ON \`${tag}\` "${id}" SET ${setClause}`;
    
    return { nGQL: query, parameters: {} };
  }
  
  buildDeleteNodeQuery(nodeId: string): { nGQL: string; parameters: Record<string, any> } {
    const query = `DELETE VERTEX "${nodeId}" WITH EDGE`;
    
    return { nGQL: query, parameters: {} };
  }
  
  buildFindRelatedNodesQuery(nodeId: string, relationshipTypes?: string[], maxDepth: number = 2): { nGQL: string; parameters: Record<string, any> } {
    let edgeTypesClause = '*';
    if (relationshipTypes && relationshipTypes.length > 0) {
      edgeTypesClause = relationshipTypes.join(',');
    }
    
    const query = `GO FROM "${nodeId}" OVER ${edgeTypesClause} UPTO ${maxDepth} STEPS YIELD dst(edge) AS destination | FETCH PROP ON * $-.destination YIELD vertex AS related`;
    
    return { nGQL: query, parameters: {} };
  }
  
  buildFindPathQuery(sourceId: string, targetId: string, maxDepth: number = 3): { nGQL: string; parameters: Record<string, any> } {
    const query = `FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${maxDepth} STEPS YIELD path as p`;
    
    return { nGQL: query, parameters: {} };
  }
  
  batchInsertVertices(vertices: Array<{ tag: string; id: string; properties: Record<string, any> }>): { query: string; params: Record<string, any> } {
    // Group vertices by tag
    const verticesByTag: Record<string, Array<{ id: string; properties: Record<string, any> }>> = {};
    
    for (const vertex of vertices) {
      if (!verticesByTag[vertex.tag]) {
        verticesByTag[vertex.tag] = [];
      }
      verticesByTag[vertex.tag].push({
        id: vertex.id,
        properties: vertex.properties
      });
    }
    
    // Build property assignments for each vertex
    const tagEntries = Object.entries(verticesByTag);
    const tagList = tagEntries.map(([tag]) => `\`${tag}\``).join(',');
    
    const valuesClauses = tagEntries.map(([tag, vertexList]) => {
      const vertexValues = vertexList.map(vertex => {
        const propertyAssignments = Object.entries(vertex.properties)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key}:"${value}"`;
            } else {
              return `${key}:${value}`;
            }
          })
          .join(',');
        
        return `"${vertex.id}":(\`${tag}\`{${propertyAssignments}})`;
      }).join(',');
      
      return vertexValues;
    }).join(',');
    
    const query = `INSERT VERTEX ${tagList} VALUES ${valuesClauses}`;
    
    return { query, params: {} };
  }
  
  batchInsertEdges(edges: Array<{ type: string; srcId: string; dstId: string; properties: Record<string, any> }>): { query: string; params: Record<string, any> } {
    // Group edges by type
    const edgesByType: Record<string, Array<{ srcId: string; dstId: string; properties: Record<string, any> }>> = {};
    
    for (const edge of edges) {
      if (!edgesByType[edge.type]) {
        edgesByType[edge.type] = [];
      }
      edgesByType[edge.type].push({
        srcId: edge.srcId,
        dstId: edge.dstId,
        properties: edge.properties
      });
    }
    
    // Build values clauses for each edge type
    const typeEntries = Object.entries(edgesByType);
    const typeList = typeEntries.map(([type]) => `\`${type}\``).join(',');
    
    const valuesClauses = typeEntries.map(([type, edgeList]) => {
      const edgeValues = edgeList.map(edge => {
        const propertyAssignments = Object.entries(edge.properties)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key}:"${value}"`;
            } else {
              return `${key}:${value}`;
            }
          })
          .join(',');
        
        return `"${edge.srcId}"->"${edge.dstId}":(\`${type}\`{${propertyAssignments}})`;
      }).join(',');
      
      return edgeValues;
    }).join(',');
    
    const query = `INSERT EDGE ${typeList} VALUES ${valuesClauses}`;
    
    return { query, params: {} };
  }
}