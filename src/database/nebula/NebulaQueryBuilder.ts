import { injectable } from 'inversify';

export interface BatchVertex {
  tag: string;
  id: string;
  properties: Record<string, any>;
}

export interface ComplexTraversalOptions {
  maxDepth?: number;
  filterConditions?: string[];
  returnFields?: string[];
  limit?: number;
}

export interface PatternMatchOptions {
  conditions: Record<string, any>;
  returnFields: string[];
}

export interface MixedOperation {
  type: 'vertex' | 'edge';
  data: BatchVertex | {
    type: string;
    srcId: string;
    dstId: string;
    properties: Record<string, any>;
  };
}

@injectable()
export class NebulaQueryBuilder {
  /**
   * 构建INSERT VERTEX语句
   * @param tag 标签名称
   * @param vertexId 顶点ID
   * @param properties 属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  insertVertex(
    tag: string,
    vertexId: string,
    properties: Record<string, any>
  ): { query: string; params: Record<string, any> } {
    // 获取属性键
    const propertyKeys = Object.keys(properties);

    // 如果没有属性，构建简单的INSERT语句
    if (propertyKeys.length === 0) {
      const query = `INSERT VERTEX ${tag}() VALUES ${vertexId}:()`;
      return { query, params: {} };
    }

    // 构建属性名列表
    const propertyNames = propertyKeys.join(', ');

    // 构建参数占位符
    const paramPlaceholders = propertyKeys.map((_, index) => `$param${index}`).join(', ');

    // 构建查询语句
    const query = `INSERT VERTEX ${tag}(${propertyNames}) VALUES ${vertexId}:(${paramPlaceholders})`;

    // 构建参数对象
    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`param${index}`] = properties[key];
    });

    return { query, params };
  }

  /**
   * 构建批量插入顶点语句
   * @param vertices 顶点数组
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  batchInsertVertices(vertices: BatchVertex[]): { query: string; params: Record<string, any> } {
    if (vertices.length === 0) {
      return { query: '', params: {} };
    }

    // Group vertices by tag for more efficient batch insertion
    const verticesByTag = vertices.reduce(
      (acc, vertex) => {
        if (!acc[vertex.tag]) {
          acc[vertex.tag] = [];
        }
        acc[vertex.tag].push(vertex);
        return acc;
      },
      {} as Record<string, BatchVertex[]>
    );

    const queries: string[] = [];
    const params: Record<string, any> = {};

    for (const [tag, tagVertices] of Object.entries(verticesByTag)) {
      if (tagVertices.length === 0) continue;

      // Get all property keys from all vertices of this tag
      const allPropertyKeys = new Set<string>();
      tagVertices.forEach(vertex => {
        Object.keys(vertex.properties).forEach(key => allPropertyKeys.add(key));
      });

      const propertyNames = Array.from(allPropertyKeys).join(', ');

      // Build values clause for each vertex
      const valuesClauses = tagVertices
        .map((vertex, vertexIndex) => {
          const paramPrefix = `${tag}_${vertex.id}`;
          const paramPlaceholders = Array.from(allPropertyKeys)
            .map((key, keyIndex) => {
              const paramName = `${paramPrefix}_param${keyIndex}`;
              params[paramName] = vertex.properties[key] || null;
              return `$${paramName}`;
            })
            .join(', ');

          return `${vertex.id}:(${paramPlaceholders})`;
        })
        .join(', ');

      const query = `INSERT VERTEX ${tag}(${propertyNames}) VALUES ${valuesClauses}`;
      queries.push(query);
    }

    return { query: queries.join('; '), params };
  }

  /**
   * 构建混合批量操作语句（支持顶点和边的混合批量插入）
   * @param operations 操作数组
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  batchMixedOperations(operations: MixedOperation[]): {
    query: string;
    params: Record<string, any>
  } {
    if (operations.length === 0) {
      return { query: '', params: {} };
    }

    // Separate vertices and edges
    const vertices: BatchVertex[] = [];
    const edges: Array<{
      type: string;
      srcId: string;
      dstId: string;
      properties: Record<string, any>;
    }> = [];

    operations.forEach(op => {
      if (op.type === 'vertex' && 'tag' in op.data) {
        vertices.push(op.data as BatchVertex);
      } else if (op.type === 'edge' && 'type' in op.data) {
        edges.push(op.data as { type: string; srcId: string; dstId: string; properties: Record<string, any> });
      }
    });

    // Process vertices and edges separately using existing batch methods
    const vertexResult = this.batchInsertVertices(vertices);
    const edgeResult = this.batchInsertEdges(edges);

    // Combine queries and parameters
    const queries: string[] = [];
    const params: Record<string, any> = {};

    if (vertexResult.query) {
      queries.push(vertexResult.query);
      Object.assign(params, vertexResult.params);
    }

    if (edgeResult.query) {
      queries.push(edgeResult.query);
      Object.assign(params, edgeResult.params);
    }

    return {
      query: queries.join('; '),
      params
    };
  }

  /**
   * 构建INSERT EDGE语句
   * @param edgeType 边类型
   * @param srcId 源顶点ID
   * @param dstId 目标顶点ID
   * @param properties 属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  insertEdge(
    edgeType: string,
    srcId: string,
    dstId: string,
    properties: Record<string, any>
  ): { query: string; params: Record<string, any> } {
    // 获取属性键
    const propertyKeys = Object.keys(properties);

    // 如果没有属性，构建简单的INSERT语句
    if (propertyKeys.length === 0) {
      const query = `INSERT EDGE ${edgeType}() VALUES ${srcId}->${dstId}:()`;
      return { query, params: {} };
    }

    // 构建属性名列表
    const propertyNames = propertyKeys.join(', ');

    // 构建参数占位符
    const paramPlaceholders = propertyKeys.map((_, index) => `$param${index}`).join(', ');

    // 构建查询语句
    const query = `INSERT EDGE ${edgeType}(${propertyNames}) VALUES ${srcId}->${dstId}:(${paramPlaceholders})`;

    // 构建参数对象
    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`param${index}`] = properties[key];
    });

    return { query, params };
  }

  /**
   * 构建批量插入边语句
   * @param edges 边数组
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  batchInsertEdges(
    edges: Array<{
      type: string;
      srcId: string;
      dstId: string;
      properties: Record<string, any>;
    }>
  ): { query: string; params: Record<string, any> } {
    if (edges.length === 0) {
      return { query: '', params: {} };
    }

    // Group edges by type for more efficient batch insertion
    const edgesByType = edges.reduce(
      (acc, edge) => {
        if (!acc[edge.type]) {
          acc[edge.type] = [];
        }
        acc[edge.type].push(edge);
        return acc;
      },
      {} as Record<string, typeof edges>
    );

    const queries: string[] = [];
    const params: Record<string, any> = {};

    for (const [edgeType, typeEdges] of Object.entries(edgesByType)) {
      if (typeEdges.length === 0) continue;

      // Get all property keys from all edges of this type
      const allPropertyKeys = new Set<string>();
      typeEdges.forEach(edge => {
        Object.keys(edge.properties).forEach(key => allPropertyKeys.add(key));
      });

      const propertyNames = Array.from(allPropertyKeys).join(', ');

      // Build values clause for each edge
      const valuesClauses = typeEdges
        .map((edge, edgeIndex) => {
          const paramPrefix = `${edgeType}_${edge.srcId}_${edge.dstId}`;
          const paramPlaceholders = Array.from(allPropertyKeys)
            .map((key, keyIndex) => {
              const paramName = `${paramPrefix}_param${keyIndex}`;
              params[paramName] = edge.properties[key] || null;
              return `$${paramName}`;
            })
            .join(', ');

          return `${edge.srcId}->${edge.dstId}:(${paramPlaceholders})`;
        })
        .join(', ');

      const query = `INSERT EDGE ${edgeType}(${propertyNames}) VALUES ${valuesClauses}`;
      queries.push(query);
    }

    return { query: queries.join('; '), params };
  }

  /**
   * 构建GO语句
   * @param steps 步数
   * @param vertexId 起始顶点ID
   * @param yieldFields 返回字段
   * @param edgeType 边类型（可选）
   * @returns 查询语句
   */
  go(steps: number, vertexId: string, yieldFields: string, edgeType?: string): string {
    let query = `GO ${steps} STEPS FROM ${vertexId}`;

    if (edgeType) {
      query += ` OVER ${edgeType}`;
    }

    query += ` YIELD ${yieldFields}`;

    return query;
  }

  /**
   * 构建复杂图遍历查询
   * @param startId 起始顶点ID
   * @param edgeTypes 边类型数组
   * @param options 遍历选项
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  buildComplexTraversal(
    startId: string,
    edgeTypes: string[],
    options: ComplexTraversalOptions = {}
  ): { query: string; params: Record<string, any> } {
    const { maxDepth = 3, filterConditions = [], returnFields = ['vertex'], limit = 100 } = options;

    const edgeTypeClause = edgeTypes.length > 0 ? `OVER ${edgeTypes.join(',')}` : 'OVER *';
    const filterClause =
      filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';
    const returnClause = returnFields.join(', ');

    const query = `
      GO ${maxDepth} STEPS FROM $startId ${edgeTypeClause}
      YIELD dst(edge) AS destination
      ${filterClause}
      | FETCH PROP ON * $-.destination YIELD ${returnClause}
      LIMIT ${limit}
    `;

    return { query, params: { startId } };
  }

  /**
   * 构建MATCH语句
   * @param pattern 匹配模式
   * @param returnClause RETURN子句
   * @param whereClause WHERE子句（可选）
   * @returns 查询语句
   */
  match(pattern: string, returnClause: string, whereClause?: string): string {
    let query = `MATCH ${pattern}`;

    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    query += ` RETURN ${returnClause}`;

    return query;
  }

  /**
   * 构建图模式匹配查询
   * @param pattern 匹配模式
   * @param conditions 条件对象
   * @param returnFields 返回字段数组
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  buildPatternMatch(
    pattern: string,
    conditions: Record<string, any>,
    returnFields: string[]
  ): { query: string; params: Record<string, any> } {
    const whereClause = Object.entries(conditions)
      .map(([key, value]) => `${key} = $${key}`)
      .join(' AND ');

    const query = `
      MATCH ${pattern}
      WHERE ${whereClause}
      RETURN ${returnFields.join(', ')}
    `;

    return { query, params: conditions };
  }

  /**
   * 构建最短路径查询
   * @param sourceId 源顶点ID
   * @param targetId 目标顶点ID
   * @param edgeTypes 边类型数组（可选）
   * @param maxDepth 最大深度
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  buildShortestPath(
    sourceId: string,
    targetId: string,
    edgeTypes: string[] = [],
    maxDepth = 10
  ): { query: string; params: Record<string, any> } {
    const edgeTypeClause = edgeTypes.length > 0 ? `OVER ${edgeTypes.join(',')}` : 'OVER *';

    const query = `
      FIND SHORTEST PATH FROM $sourceId TO $targetId ${edgeTypeClause} UPTO ${maxDepth} STEPS
    `;

    return { query, params: { sourceId, targetId } };
  }

  /**
   * 构建节点属性更新查询
   * @param vertexId 顶点ID
   * @param tag 标签名称
   * @param properties 更新的属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  updateVertex(
    vertexId: string,
    tag: string,
    properties: Record<string, any>
  ): { query: string; params: Record<string, any> } {
    const propertyKeys = Object.keys(properties);

    if (propertyKeys.length === 0) {
      return { query: '', params: {} };
    }

    const setClauses = propertyKeys
      .map((key, index) => {
        const paramName = `set_param${index}`;
        return `${key} = $${paramName}`;
      })
      .join(', ');

    const query = `
      UPDATE VERTEX ON ${tag} ${vertexId}
      SET ${setClauses}
    `;

    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`set_param${index}`] = properties[key];
    });

    return { query, params };
  }

  /**
   * 构建边属性更新查询
   * @param srcId 源顶点ID
   * @param dstId 目标顶点ID
   * @param edgeType 边类型
   * @param properties 更新的属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  updateEdge(
    srcId: string,
    dstId: string,
    edgeType: string,
    properties: Record<string, any>
  ): { query: string; params: Record<string, any> } {
    const propertyKeys = Object.keys(properties);

    if (propertyKeys.length === 0) {
      return { query: '', params: {} };
    }

    const setClauses = propertyKeys
      .map((key, index) => {
        const paramName = `set_param${index}`;
        return `${key} = $${paramName}`;
      })
      .join(', ');

    const query = `
      UPDATE EDGE ON ${edgeType} ${srcId} -> ${dstId}
      SET ${setClauses}
    `;

    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`set_param${index}`] = properties[key];
    });

    return { query, params };
  }

  /**
   * 构建删除顶点查询
   * @param vertexIds 顶点ID数组
   * @param tag 标签名称（可选）
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  deleteVertices(
    vertexIds: string[],
    tag?: string
  ): { query: string; params: Record<string, any> } {
    if (vertexIds.length === 0) {
      return { query: '', params: {} };
    }

    const idParams = vertexIds.map((id, index) => `$id${index}`).join(', ');
    const params: Record<string, any> = {};
    vertexIds.forEach((id, index) => {
      params[`id${index}`] = id;
    });

    let query = `DELETE VERTEX ${idParams}`;
    if (tag) {
      query += ` TAG ${tag}`;
    }

    return { query, params };
  }

  /**
   * 构建删除边查询
   * @param edges 边数组
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  deleteEdges(edges: Array<{ srcId: string; dstId: string; edgeType: string }>): {
    query: string;
    params: Record<string, any>;
  } {
    if (edges.length === 0) {
      return { query: '', params: {} };
    }

    const deleteClauses = edges
      .map((edge, index) => {
        const srcParam = `src${index}`;
        const dstParam = `dst${index}`;
        params[srcParam] = edge.srcId;
        params[dstParam] = edge.dstId;
        return `$${srcParam} -> $${dstParam}`;
      })
      .join(', ');

    const params: Record<string, any> = {};

    const query = `DELETE EDGE ${deleteClauses}`;
    return { query, params };
  }

  /**
   * 处理参数化查询
   * @param query 查询语句
   * @param params 参数对象
   * @returns 处理后的查询语句和参数
   */
  parameterize(
    query: string,
    params: Record<string, any>
  ): { query: string; params: Record<string, any> } {
    // 在nGQL中，参数使用$符号前缀
    // 这个方法可以用于确保参数正确传递
    return { query, params };
  }

  /**
   * 构建统计查询
   * @param tag 标签名称（可选，如果为空则统计所有节点）
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  buildCountQuery(tag?: string): { query: string; params: Record<string, any> } {
    let query;
    if (tag) {
      query = `MATCH (n:${tag}) RETURN count(n) as total`;
    } else {
      query = `MATCH (n) RETURN count(n) as total`;
    }
    return { query, params: {} };
  }

  /**
   * 构建分页查询
   * @param pattern 匹配模式
   * @param returnClause 返回子句
   * @param whereClause 条件子句（可选）
   * @param orderBy 排序字段
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  buildPagedQuery(
    pattern: string,
    returnClause: string,
    whereClause?: string,
    orderBy?: string,
    limit = 50,
    offset = 0
  ): { query: string; params: Record<string, any> } {
    let query = `MATCH ${pattern}`;

    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    query += ` RETURN ${returnClause}`;

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    query += ` LIMIT ${limit} OFFSET ${offset}`;

    return { query, params: {} };
  }
}
