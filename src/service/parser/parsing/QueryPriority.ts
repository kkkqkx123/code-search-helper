/**
 * 查询优先级定义
 * 用于标注和管理Tree-Sitter查询的优先级，指导查询执行策略
 */

export enum QueryPriority {
  CRITICAL = 5,   // 宏、预处理、线程/互斥锁操作
  HIGH = 4,       // 类型、结构体、函数、控制流、函数调用
  MEDIUM = 3,     // 变量生命周期、数据流、依赖关系
  LOW = 2,        // 复合变量、引用关系
  MINIMAL = 1,    // 基本变量声明
  ANNOTATION = 0  // 注释、注解
}

/**
 * 查询元数据 - 描述一个查询的完整信息
 */
export interface QueryMetadata {
  /** 查询的基本类型 */
  type: 'entity' | 'relationship'
  
  /** 具体的查询类别 */
  category: 
    | 'preprocessor'   // 预处理
    | 'macro'          // 宏定义
    | 'type'           // 类型
    | 'struct'         // 结构体
    | 'enum'           // 枚举
    | 'union'          // 联合体
    | 'function'       // 函数
    | 'variable'       // 变量
    | 'array'          // 数组
    | 'pointer'        // 指针
    | 'call'           // 函数调用
    | 'control_flow'   // 控制流
    | 'data_flow'      // 数据流
    | 'dependency'     // 依赖关系
    | 'inheritance'    // 继承关系
    | 'lifecycle'      // 生命周期
    | 'concurrency'    // 并发
    | 'comment'        // 注释
    | 'annotation'     // 注解
  
  /** 优先级 */
  priority: QueryPriority
  
  /** 支持的编程语言 */
  languages: string[]
  
  /** 描述 */
  description?: string
  
  /** 是否已实现 */
  implemented?: boolean
}

/**
 * 查询结果基类
 */
export interface QueryResultBase {
  /** 匹配的AST节点 */
  node: any // Parser.SyntaxNode
  
  /** 查询的元数据 */
  metadata: QueryMetadata
  
  /** 捕获组（来自Tree-Sitter Query的named captures） */
  captures: Array<{
    name: string
    node: any // Parser.SyntaxNode
  }>
}

/**
 * 实体查询结果
 */
export interface EntityQueryResult extends QueryResultBase {
  type: 'entity'
  
  /** 实体名称 */
  name?: string
  
  /** 实体的额外属性 */
  properties?: Record<string, any>
}

/**
 * 关系查询结果
 */
export interface RelationshipQueryResult extends QueryResultBase {
  type: 'relationship'
  
  /** 关系的源 */
  from?: string
  
  /** 关系的目标 */
  to?: string
  
  /** 关系的方向 */
  direction?: 'from_to' | 'bidirectional' | 'weighted'
  
  /** 关系的额外属性 */
  properties?: Record<string, any>
}

/**
 * 合并的查询结果类型
 */
export type QueryResult = EntityQueryResult | RelationshipQueryResult

/**
 * 批量查询选项
 */
export interface QueryOptions {
  /** 最小优先级（默认为ANNOTATION，查询所有） */
  minPriority?: QueryPriority
  
  /** 最大优先级（默认为CRITICAL，查询所有） */
  maxPriority?: QueryPriority
  
  /** 仅查询指定的类别 */
  categories?: string[]
  
  /** 是否使用缓存 */
  useCache?: boolean
  
  /** 是否使用优化查询系统 */
  preferOptimized?: boolean
  
  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 按优先级分组的查询结果
 */
export interface PrioritizedQueryResults {
  [QueryPriority.CRITICAL]: QueryResult[]
  [QueryPriority.HIGH]: QueryResult[]
  [QueryPriority.MEDIUM]: QueryResult[]
  [QueryPriority.LOW]: QueryResult[]
  [QueryPriority.MINIMAL]: QueryResult[]
  [QueryPriority.ANNOTATION]: QueryResult[]
}

/**
 * 实体查询结果集合
 */
export interface EntityQueryResults {
  macros: EntityQueryResult[]
  types: EntityQueryResult[]
  functions: EntityQueryResult[]
  variables: EntityQueryResult[]
  comments: EntityQueryResult[]
  [category: string]: EntityQueryResult[]
}

/**
 * 关系查询结果集合
 */
export interface RelationshipQueryResults {
  calls: RelationshipQueryResult[]
  dependencies: RelationshipQueryResult[]
  inheritance: RelationshipQueryResult[]
  dataFlow: RelationshipQueryResult[]
  controlFlow: RelationshipQueryResult[]
  [category: string]: RelationshipQueryResult[]
}

/**
 * 完整的查询结果
 */
export interface CompleteQueryResults {
  entities: EntityQueryResults
  relationships: RelationshipQueryResults
  prioritized: PrioritizedQueryResults
  totalResults: number
  executionTime: number
}

/**
 * 查询统计信息
 */
export interface QueryStats {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  cacheHits: number
  cacheMisses: number
  averageExecutionTime: number
  totalExecutionTime: number
}
