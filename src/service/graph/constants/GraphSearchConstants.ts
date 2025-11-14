/**
 * 图搜索服务相关常量定义
 */

// 搜索类型枚举
export enum SearchType {
  KEYWORD = 'keyword',
  EXACT = 'exact',
  NEIGHBOR = 'neighbor',
  PATH = 'path',
  SCHEMA = 'schema'
}

// 缓存相关常量
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 300, // 默认缓存时间（秒）
  KEY_PREFIXES: {
    GRAPH_SEARCH: 'graph_search',
    NODE_TYPE: 'nodeType',
    RELATIONSHIP_TYPE: 'relationshipType',
    PATH: 'path'
  }
} as const;

// 批处理相关常量
export const BATCH_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 100, // 默认批处理大小
  NODE_ID_PREFIX: 'node_', // 节点ID前缀
  DEFAULT_NODE_TYPE: 'default', // 默认节点类型
  DEFAULT_EDGE_TYPE: 'default' // 默认边类型
} as const;

// 查询模板常量
export const QUERY_TEMPLATES = {
  // 基础查询模板
  LOOKUP_ALL: (query: string, limit: number) => `
    LOOKUP ON * WHERE * CONTAINS "${query}"
    YIELD vertex AS node
    LIMIT ${limit}
  `,
  
  LOOKUP_ON_TYPES: (query: string, nodeTypes: string[], limit: number) => {
    const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
    return `
      LOOKUP ON ${nodeTypeClause} WHERE * CONTAINS "${query}"
      YIELD vertex AS node
      LIMIT ${limit}
    `;
  },
  
  FETCH_BY_ID: (id: string) => `
    FETCH PROP ON * "${id}"
    YIELD vertex AS node
  `,
  
  GO_NEIGHBOR: (sourceId: string, depth: number, limit: number) => `
    GO ${depth} STEPS FROM "${sourceId}" OVER *
    YIELD dst(edge) AS destination
    | FETCH PROP ON * $-.destination YIELD vertex AS node
    LIMIT ${limit}
  `,
  
  GO_NEIGHBOR_WITH_NODE_TYPES: (sourceId: string, depth: number, nodeTypes: string[], limit: number) => {
    const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
    return `
      GO ${depth} STEPS FROM "${sourceId}" OVER *
      YIELD dst(edge) AS destination
      | FETCH PROP ON ${nodeTypeClause} $-.destination YIELD vertex AS node
      LIMIT ${limit}
    `;
  },
  
  GO_NEIGHBOR_WITH_REL_TYPES: (sourceId: string, depth: number, relTypes: string[], limit: number) => {
    const relTypeClause = relTypes.map(type => `\`${type}\``).join(', ');
    return `
      GO ${depth} STEPS FROM "${sourceId}" OVER ${relTypeClause}
      YIELD dst(edge) AS destination
      | FETCH PROP ON * $-.destination YIELD vertex AS node
      LIMIT ${limit}
    `;
  },
  
  FIND_SHORTEST_PATH: (sourceId: string, targetId: string, depth: number, limit: number) => `
    FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${depth} STEPS
    YIELD path AS p
    LIMIT ${limit}
  `,
  
  LOOKUP_ON_NODE_TYPE: (nodeType: string, limit: number) => `
    LOOKUP ON \`${nodeType}\`
    YIELD vertex AS node
    LIMIT ${limit}
  `,
  
  MATCH_RELATIONSHIP_TYPE: (relType: string, limit: number) => `
    MATCH ()-[r:\`${relType}\`]->()
    RETURN r
    LIMIT ${limit}
  `,
  
  FIND_PATH: (sourceId: string, targetId: string, depth: number) => `
    FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${depth} STEPS
    YIELD path AS p
  `,
  
  GO_PATH: (sourceId: string, depth: number, limit: number) => `
    GO ${depth} STEPS FROM "${sourceId}" OVER *
    YIELD path AS p
    LIMIT ${limit}
  `,
  
  LOOKUP_ON_NODE_TYPES_ONLY: (nodeTypes: string[], limit: number) => {
    const nodeTypeClause = nodeTypes.map(type => `\`${type}\``).join(', ');
    return `
      LOOKUP ON ${nodeTypeClause}
      YIELD vertex AS node
      LIMIT ${limit}
    `;
  },
  
  GO_WITH_REL_TYPES: (sourceId: string, relTypes: string[], limit: number) => {
    const relTypeClause = relTypes.map(type => `\`${type}\``).join(', ');
    return `
      GO 1 STEPS FROM "${sourceId}" OVER ${relTypeClause}
      YIELD dst(edge) AS destination
      | FETCH PROP ON * $-.destination YIELD vertex AS node
      LIMIT ${limit}
    `;
  }
} as const;

// 空间管理相关常量
export const SPACE_CONSTANTS = {
  DEFAULT_CONFIG: {
    partition_num: 10,
    replica_factor: 1,
    vid_type: 'FIXED_STRING(30)',
    charset: 'utf8',
    collate: 'utf8_bin'
  },
  
  QUERIES: {
    CREATE_SPACE: (projectId: string, config: any) => `
      CREATE SPACE IF NOT EXISTS \`${projectId}\` (
        partition_num = ${config.partition_num},
        replica_factor = ${config.replica_factor},
        vid_type = '${config.vid_type}',
        charset = '${config.charset}',
        collate = '${config.collate}'
      )
    `,
    
    DROP_SPACE: (projectId: string) => `DROP SPACE IF EXISTS \`${projectId}\``,
    
    USE_SPACE: (projectId: string) => `USE \`${projectId}\``,
    
    SHOW_TAGS: 'SHOW TAGS',
    SHOW_EDGES: 'SHOW EDGES',
    SHOW_SPACES: 'SHOW SPACES',
    DESCRIBE_SPACE: (projectId: string) => `DESCRIBE SPACE \`${projectId}\``,
    SHOW_HOSTS: 'SHOW HOSTS',
    LOOKUP_LIMIT_1: 'LOOKUP ON * LIMIT 1',
    COUNT_EDGES: 'MATCH ()-[e]->() RETURN count(e) AS edgeCount',
    
    DELETE_EDGES_BY_TYPE: (edgeType: string) => `MATCH ()-[e:\`${edgeType}\`]->() DELETE e`,
    DELETE_NODES_BY_TYPE: (nodeType: string) => `MATCH (n:\`${nodeType}\`) DELETE n`,
    DELETE_VERTICES_WITH_EDGE: (nodeIds: string) => `DELETE VERTEX ${nodeIds} WITH EDGE`
  }
} as const;

// 数据格式化相关常量
export const FORMATTING_CONSTANTS = {
  DEFAULT_VALUES: {
    ID: 'unknown',
    TYPE: 'unknown',
    NAME: 'unknown'
  },
  
  PROPERTY_MAPPINGS: {
    NODE: {
      id: ['id', '_id', 'vertex.id', 'vertex._vid'],
      type: ['type', 'label', 'tag', 'vertex.tag', 'vertex._tag'],
      name: ['name', 'label', 'vertex.name', 'vertex._tag'],
      properties: ['properties', 'props', 'vertex.props', 'vertex.properties']
    },
    
    EDGE: {
      id: ['id', '_id', 'edge.id', 'edge._edgeId'],
      type: ['type', 'edgeType', 'name', 'edge.type', 'edge.name'],
      sourceId: ['source', 'src', 'from', 'edge.src', 'edge.from'],
      targetId: ['target', 'dst', 'to', 'edge.dst', 'edge.to'],
      properties: ['properties', 'props', 'edge.props', 'edge.properties']
    }
  }
} as const;

// 错误消息常量
export const ERROR_MESSAGES = {
  INITIALIZATION_FAILED: '图搜索服务初始化失败',
  DATABASE_INITIALIZATION_FAILED: '图数据库初始化失败',
  SEARCH_FAILED: '图搜索失败',
  NODE_TYPE_SEARCH_FAILED: '节点类型搜索失败',
  RELATIONSHIP_TYPE_SEARCH_FAILED: '关系类型搜索_FAILED',
  PATH_SEARCH_FAILED: '路径搜索失败',
  SEARCH_SUGGESTIONS_FAILED: '获取搜索建议失败',
  HEALTH_CHECK_FAILED: '图服务健康检查失败',
  GET_STATUS_FAILED: '获取图服务状态失败',
  CLOSE_SERVICE_FAILED: '关闭图搜索服务失败',
  
  SPACE_ERRORS: {
    CREATE_FAILED: '创建图空间失败',
    DROP_FAILED: '删除图空间失败',
    CLEAR_FAILED: '清空图空间失败',
    GET_INFO_FAILED: '获取图空间信息失败',
    SPACE_NOT_EXIST: (projectId: string) => `Space ${projectId} does not exist`
  },
  
  BATCH_ERRORS: {
    INSERT_NODES_FAILED: '批量插入节点失败',
    INSERT_EDGES_FAILED: '批量插入边失败',
    DELETE_NODES_FAILED: '批量删除节点失败'
  }
} as const;

// 日志消息常量
export const LOG_MESSAGES = {
  INITIALIZING: '初始化图搜索服务',
  INITIALIZATION_SUCCESS: '图搜索服务初始化成功',
  CACHED_RESULT_RETRIEVED: '从缓存中检索到图搜索结果',
  EXECUTING_SEARCH: '执行图搜索',
  SEARCH_COMPLETED: '图搜索完成',
  
  SEARCHING_BY_NODE_TYPE: '按节点类型搜索',
  SEARCHING_BY_RELATIONSHIP_TYPE: '按关系类型搜索',
  SEARCHING_BY_PATH: '按路径搜索',
  
  GETTING_SEARCH_SUGGESTIONS: '获取搜索建议',
  
  CLOSING_SERVICE: '关闭图搜索服务',
  CLOSE_SERVICE_SUCCESS: '图搜索服务关闭成功',
  
  SPACE_OPERATIONS: {
    CREATING_SPACE: '创建图空间',
    SPACE_CREATED: '图空间创建成功',
    DROPPING_SPACE: '删除图空间',
    SPACE_DROPPED: '图空间删除成功',
    CLEARING_SPACE: '清空图空间',
    SPACE_CLEARED: '图空间清空成功',
    GETTING_SPACE_INFO: '获取图空间信息',
    
    BATCH_INSERTING_NODES: '批量插入节点',
    BATCH_INSERTING_EDGES: '批量插入边',
    BATCH_DELETING_NODES: '批量删除节点',
    NODES_DELETED: '节点删除成功',
    BATCH_DELETE_PARTIAL_FAILED: '批量删除节点部分失败'
  },
  
  HEALTH_CHECK: {
    NEBULA_DISABLED: 'Nebula Graph已禁用，服务处于降级模式',
    NEBULA_DISABLED_DESPITE_ERROR: '尽管健康检查出错，Nebula Graph已禁用，服务处于降级模式'
  }
} as const;