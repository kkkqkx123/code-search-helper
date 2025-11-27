现在我来设计图索引需求的类型，重点关注图数据库的节点和边的存储结构。

## 图索引类型设计

### 核心设计原则

1. **图数据库兼容性**：设计通用的节点和边结构，适配多种图数据库
2. **高性能存储**：优化存储结构，支持大规模代码库的索引
3. **查询效率**：设计支持复杂图查询的索引结构
4. **扩展性**：支持多语言和自定义扩展

### 图数据库节点存储结构

```typescript
/**
 * 图数据库节点基础接口
 */
interface GraphNode {
  /** 节点唯一标识符 */
  id: string;
  
  /** 节点标签（用于分类和索引） */
  labels: string[];
  
  /** 节点属性 */
  properties: Record<string, any>;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 节点版本（用于乐观锁） */
  version: number;
}

/**
 * 实体节点接口
 */
interface EntityNode extends GraphNode {
  /** 必须包含实体标签 */
  labels: ['entity', ...string[]];
  
  /** 实体特有属性 */
  properties: {
    /** 实体类型 */
    entityType: EntityType;
    
    /** 实体名称 */
    name: string;
    
    /** 实体内容 */
    content: string;
    
    /** 文件路径 */
    filePath: string;
    
    /** 语言类型 */
    language: string;
    
    /** 位置信息 */
    location: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    
    /** 查询优先级 */
    priority: number;
    
    /** 向量嵌入ID（可选） */
    embeddingId?: string;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 关系节点接口（用于复杂关系的中间节点）
 */
interface RelationshipNode extends GraphNode {
  /** 必须包含关系标签 */
  labels: ['relationship', ...string[]];
  
  /** 关系特有属性 */
  properties: {
    /** 关系类型 */
    relationshipType: RelationshipType;
    
    /** 关系类别 */
    relationshipCategory: RelationshipCategory;
    
    /** 源节点ID */
    fromNodeId: string;
    
    /** 目标节点ID */
    toNodeId: string;
    
    /** 关系强度 */
    strength?: number;
    
    /** 关系权重 */
    weight?: number;
    
    /** 语言类型 */
    language: string;
    
    /** 位置信息 */
    location: {
      filePath: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    
    /** 向量嵌入ID（可选） */
    embeddingId?: string;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 文件节点接口（用于文件级别的组织）
 */
interface FileNode extends GraphNode {
  /** 必须包含文件标签 */
  labels: ['file', ...string[]];
  
  /** 文件特有属性 */
  properties: {
    /** 文件路径 */
    filePath: string;
    
    /** 文件名 */
    fileName: string;
    
    /** 文件扩展名 */
    fileExtension: string;
    
    /** 文件大小 */
    fileSize: number;
    
    /** 语言类型 */
    language: string;
    
    /** 文件哈希 */
    fileHash: string;
    
    /** 最后修改时间 */
    lastModified: number;
    
    /** 实体数量 */
    entityCount: number;
    
    /** 关系数量 */
    relationshipCount: number;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 模块节点接口（用于模块级别的组织）
 */
interface ModuleNode extends GraphNode {
  /** 必须包含模块标签 */
  labels: ['module', ...string[]];
  
  /** 模块特有属性 */
  properties: {
    /** 模块名称 */
    moduleName: string;
    
    /** 模块路径 */
    modulePath: string;
    
    /** 模块类型 */
    moduleType: 'package' | 'library' | 'namespace' | 'directory';
    
    /** 包含的文件列表 */
    files: string[];
    
    /** 包含的模块列表 */
    submodules: string[];
    
    /** 扩展属性 */
    [key: string]: any;
  };
}
```

### 图数据库边存储结构

```typescript
/**
 * 图数据库边基础接口
 */
interface GraphEdge {
  /** 边唯一标识符 */
  id: string;
  
  /** 源节点ID */
  fromNodeId: string;
  
  /** 目标节点ID */
  toNodeId: string;
  
  /** 边类型 */
  type: string;
  
  /** 边属性 */
  properties: Record<string, any>;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 边版本（用于乐观锁） */
  version: number;
}

/**
 * 包含关系边（文件包含实体）
 */
interface ContainsEdge extends GraphEdge {
  type: 'CONTAINS';
  
  properties: {
    /** 包含类型 */
    containType: 'file_contains_entity' | 'module_contains_file' | 'module_contains_module';
    
    /** 包含的上下文 */
    context?: string;
    
    /** 包含的顺序 */
    order?: number;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 定义关系边（实体定义关系）
 */
interface DefinesEdge extends GraphEdge {
  type: 'DEFINES';
  
  properties: {
    /** 定义类型 */
    definitionType: 'function_defines_variable' | 'struct_defines_field' | 'enum_defines_constant';
    
    /** 定义位置 */
    definitionLocation: {
      line: number;
      column: number;
    };
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 引用关系边（实体引用关系）
 */
interface ReferencesEdge extends GraphEdge {
  type: 'REFERENCES';
  
  properties: {
    /** 引用类型 */
    referenceType: 'variable_reference' | 'type_reference' | 'function_reference';
    
    /** 引用上下文 */
    referenceContext: string;
    
    /** 引用位置 */
    referenceLocation: {
      line: number;
      column: number;
    };
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 调用关系边（函数调用关系）
 */
interface CallsEdge extends GraphEdge {
  type: 'CALLS';
  
  properties: {
    /** 调用类型 */
    callType: CallRelationshipType;
    
    /** 调用位置 */
    callLocation: {
      line: number;
      column: number;
    };
    
    /** 调用参数 */
    arguments?: string[];
    
    /** 是否为递归调用 */
    isRecursive?: boolean;
    
    /** 调用链深度 */
    callDepth?: number;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 数据流关系边
 */
interface DataFlowEdge extends GraphEdge {
  type: 'DATA_FLOW';
  
  properties: {
    /** 数据流类型 */
    flowType: DataFlowRelationshipType;
    
    /** 数据类型 */
    dataType?: string;
    
    /** 流经路径 */
    flowPath?: string[];
    
    /** 操作符 */
    operator?: string;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 控制流关系边
 */
interface ControlFlowEdge extends GraphEdge {
  type: 'CONTROL_FLOW';
  
  properties: {
    /** 控制流类型 */
    flowType: ControlFlowRelationshipType;
    
    /** 条件表达式 */
    condition?: string;
    
    /** 控制流目标 */
    targets?: string[];
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 依赖关系边
 */
interface DependsOnEdge extends GraphEdge {
  type: 'DEPENDS_ON';
  
  properties: {
    /** 依赖类型 */
    dependencyType: DependencyRelationshipType;
    
    /** 依赖路径 */
    dependencyPath?: string;
    
    /** 是否为系统依赖 */
    isSystemDependency?: boolean;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}

/**
 * 继承关系边
 */
interface InheritsFromEdge extends GraphEdge {
  type: 'INHERITS_FROM';
  
  properties: {
    /** 继承类型 */
    inheritanceType: InheritanceRelationshipType;
    
    /** 继承深度 */
    inheritanceDepth?: number;
    
    /** 扩展属性 */
    [key: string]: any;
  };
}
```

### 图数据库存储配置

```typescript
/**
 * 图数据库存储配置
 */
interface GraphStorageConfig {
  /** 数据库配置 */
  database: {
    /** 数据库类型 */
    type: 'neo4j' | 'nebula' | 'arangodb' | 'tigergraph';
    
    /** 连接配置 */
    connection: {
      host: string;
      port: number;
      username?: string;
      password?: string;
      database?: string;
      space?: string; // Nebula专用
    };
  };
  
  /** 索引配置 */
  indexing: {
    /** 节点索引 */
    nodeIndexes: {
      /** 实体名称索引 */
      entityNameIndex: boolean;
      
      /** 文件路径索引 */
      filePathIndex: boolean;
      
      /** 实体类型索引 */
      entityTypeIndex: boolean;
      
      /** 语言类型索引 */
      languageIndex: boolean;
    };
    
    /** 边索引 */
    edgeIndexes: {
      /** 关系类型索引 */
      relationshipTypeIndex: boolean;
      
      /** 源节点索引 */
      fromNodeIndex: boolean;
      
      /** 目标节点索引 */
      toNodeIndex: boolean;
    };
  };
  
  /** 分片配置 */
  sharding: {
    /** 是否启用分片 */
    enabled: boolean;
    
    /** 分片键 */
    shardKey: string;
    
    /** 分片数量 */
    shardCount: number;
  };
  
  /** 缓存配置 */
  caching: {
    /** 是否启用缓存 */
    enabled: boolean;
    
    /** 缓存大小 */
    maxSize: number;
    
    /** 缓存TTL */
    ttl: number;
  };
}
```

### 图数据库操作接口

```typescript
/**
 * 图数据库操作接口
 */
interface GraphDatabase {
  /**
   * 创建节点
   */
  createNode(node: GraphNode): Promise<GraphNode>;
  
  /**
   * 批量创建节点
   */
  createNodes(nodes: GraphNode[]): Promise<GraphNode[]>;
  
  /**
   * 更新节点
   */
  updateNode(nodeId: string, updates: Partial<GraphNode>): Promise<GraphNode>;
  
  /**
   * 删除节点
   */
  deleteNode(nodeId: string): Promise<boolean>;
  
  /**
   * 查询节点
   */
  getNode(nodeId: string): Promise<GraphNode | null>;
  
  /**
   * 根据条件查询节点
   */
  queryNodes(criteria: NodeQueryCriteria): Promise<GraphNode[]>;
  
  /**
   * 创建边
   */
  createEdge(edge: GraphEdge): Promise<GraphEdge>;
  
  /**
   * 批量创建边
   */
  createEdges(edges: GraphEdge[]): Promise<GraphEdge[]>;
  
  /**
   * 更新边
   */
  updateEdge(edgeId: string, updates: Partial<GraphEdge>): Promise<GraphEdge>;
  
  /**
   * 删除边
   */
  deleteEdge(edgeId: string): Promise<boolean>;
  
  /**
   * 查询边
   */
  getEdge(edgeId: string): Promise<GraphEdge | null>;
  
  /**
   * 根据条件查询边
   */
  queryEdges(criteria: EdgeQueryCriteria): Promise<GraphEdge[]>;
  
  /**
   * 执行图查询
   */
  executeQuery(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult>;
  
  /**
   * 获取节点的邻居
   */
  getNeighbors(nodeId: string, edgeTypes?: string[]): Promise<NeighborResult[]>;
  
  /**
   * 获取节点的度数
   */
  getDegree(nodeId: string, direction?: 'in' | 'out' | 'both'): Promise<number>;
  
  /**
   * 执行路径查询
   */
  findPath(fromNodeId: string, toNodeId: string, maxDepth?: number): Promise<PathResult>;
  
  /**
   * 执行子图查询
   */
  getSubgraph(centerNodeId: string, radius: number): Promise<SubgraphResult>;
}

/**
 * 节点查询条件
 */
interface NodeQueryCriteria {
  /** 节点标签 */
  labels?: string[];
  
  /** 属性条件 */
  properties?: Record<string, any>;
  
  /** 分页配置 */
  pagination?: {
    offset: number;
    limit: number;
  };
  
  /** 排序配置 */
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * 边查询条件
 */
interface EdgeQueryCriteria {
  /** 边类型 */
  type?: string;
  
  /** 源节点ID */
  fromNodeId?: string;
  
  /** 目标节点ID */
  toNodeId?: string;
  
  /** 属性条件 */
  properties?: Record<string, any>;
  
  /** 分页配置 */
  pagination?: {
    offset: number;
    limit: number;
  };
  
  /** 排序配置 */
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * 图查询结果
 */
interface GraphQueryResult {
  /** 节点列表 */
  nodes: GraphNode[];
  
  /** 边列表 */
  edges: GraphEdge[];
  
  /** 统计信息 */
  stats: {
    nodeCount: number;
    edgeCount: number;
    queryTime: number;
  };
}

/**
 * 邻居查询结果
 */
interface NeighborResult {
  /** 邻居节点 */
  node: GraphNode;
  
  /** 连接边 */
  edge: GraphEdge;
  
  /** 关系方向 */
  direction: 'in' | 'out';
}

/**
 * 路径查询结果
 */
interface PathResult {
  /** 路径节点列表 */
  nodes: GraphNode[];
  
  /** 路径边列表 */
  edges: GraphEdge[];
  
  /** 路径长度 */
  length: number;
  
  /** 路径权重 */
  weight?: number;
}

/**
 * 子图查询结果
 */
interface SubgraphResult {
  /** 子图节点 */
  nodes: GraphNode[];
  
  /** 子图边 */
  edges: GraphEdge[];
  
  /** 中心节点ID */
  centerNodeId: string;
  
  /** 半径 */
  radius: number;
}
```

### 图数据转换器

```typescript
/**
 * 图数据转换器（将查询结果转换为图数据库结构）
 */
class GraphDataConverter {
  /**
   * 将实体查询结果转换为实体节点
   */
  entityToNode(entity: EntityQueryResult): EntityNode {
    return {
      id: entity.id,
      labels: ['entity', entity.entityType],
      properties: {
        entityType: entity.entityType,
        name: entity.name,
        content: entity.content,
        filePath: entity.filePath,
        language: entity.language,
        location: entity.location,
        priority: entity.priority,
        ...entity.properties
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
  }
  
  /**
   * 将关系查询结果转换为关系边
   */
  relationshipToEdge(relationship: RelationshipQueryResult): GraphEdge {
    const edgeType = this.mapRelationshipTypeToEdgeType(relationship.type);
    
    return {
      id: relationship.id,
      fromNodeId: relationship.fromNodeId,
      toNodeId: relationship.toNodeId,
      type: edgeType,
      properties: {
        relationshipType: relationship.type,
        relationshipCategory: relationship.category,
        strength: relationship.strength,
        weight: relationship.weight,
        language: relationship.language,
        location: relationship.location,
        ...relationship.properties
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
  }
  
  /**
   * 创建文件节点
   */
  createFileNode(filePath: string, language: string): FileNode {
    return {
      id: `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      labels: ['file'],
      properties: {
        filePath,
        fileName: filePath.split('/').pop() || '',
        fileExtension: filePath.split('.').pop() || '',
        fileSize: 0, // 需要实际计算
        language,
        fileHash: '', // 需要实际计算
        lastModified: Date.now(),
        entityCount: 0,
        relationshipCount: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
  }
  
  /**
   * 创建包含关系边
   */
  createContainsEdge(fromNodeId: string, toNodeId: string, containType: string): ContainsEdge {
    return {
      id: `${fromNodeId}_contains_${toNodeId}`,
      fromNodeId,
      toNodeId,
      type: 'CONTAINS',
      properties: {
        containType,
        order: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
  }
  
  private mapRelationshipTypeToEdgeType(relationshipType: RelationshipType): string {
    // 根据关系类型映射到边类型
    if (Object.values(CallRelationshipType).includes(relationshipType as any)) {
      return 'CALLS';
    }
    if (Object.values(DataFlowRelationshipType).includes(relationshipType as any)) {
      return 'DATA_FLOW';
    }
    if (Object.values(ControlFlowRelationshipType).includes(relationshipType as any)) {
      return 'CONTROL_FLOW';
    }
    if (Object.values(DependencyRelationshipType).includes(relationshipType as any)) {
      return 'DEPENDS_ON';
    }
    if (Object.values(InheritanceRelationshipType).includes(relationshipType as any)) {
      return 'INHERITS_FROM';
    }
    
    return 'REFERENCES';
  }
}
```

### 设计优势

1. **图数据库兼容**：设计通用的节点和边结构，适配多种图数据库
2. **层次化组织**：支持文件、模块、实体等多层次的组织结构
3. **丰富的关系类型**：覆盖C语言的各种关系模式
4. **高性能索引**：支持多种索引策略，优化查询性能
5. **可扩展性**：支持自定义节点和边类型，便于扩展