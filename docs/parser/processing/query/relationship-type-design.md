现在我来设计关系查询结果的标准化类型，采用图数据库的节点-关系模型，并将枚举类型单独定义以支持多语言扩展。

## RelationshipQueryResult类型设计

### 核心设计原则

1. **图数据库模型**：采用节点-关系-节点的三元组结构
2. **语言无关枚举**：枚举类型单独定义，支持不同语言的适配
3. **关系方向性**：明确区分源节点和目标节点
4. **丰富元数据**：支持关系查询模式中的各种元数据标记

### 语言无关的关系类型枚举

```typescript
// 关系类别枚举（语言无关）
enum RelationshipCategory {
  CALL = 'call',
  DATA_FLOW = 'data_flow',
  CONTROL_FLOW = 'control_flow',
  DEPENDENCY = 'dependency',
  INHERITANCE = 'inheritance',
  LIFECYCLE = 'lifecycle',
  SEMANTIC = 'semantic',
  REFERENCE = 'reference',
  ANNOTATION = 'annotation'
}

// 调用关系类型
enum CallRelationshipType {
  FUNCTION = 'function',
  METHOD = 'method',
  FUNCTION_POINTER = 'function_pointer',
  RECURSIVE = 'recursive',
  CHAINED = 'chained',
  CONDITIONAL = 'conditional',
  CALLBACK = 'callback',
  MACRO = 'macro'
}

// 数据流关系类型
enum DataFlowRelationshipType {
  ASSIGNMENT = 'assignment',
  COMPOUND_ASSIGNMENT = 'compound_assignment',
  PARAMETER_PASSING = 'parameter_passing',
  RETURN_VALUE = 'return_value',
  POINTER_OPERATION = 'pointer_operation',
  TYPE_CONVERSION = 'type_conversion',
  CONDITIONAL_OPERATION = 'conditional_operation',
  MEMORY_OPERATION = 'memory_operation',
  MACRO_ASSIGNMENT = 'macro_assignment',
  SIZEOF_OPERATION = 'sizeof_operation'
}

// 控制流关系类型
enum ControlFlowRelationshipType {
  IF = 'if',
  IF_ELSE = 'if_else',
  NESTED_IF = 'nested_if',
  ELSE_IF = 'else_if',
  SWITCH = 'switch',
  SWITCH_CASE = 'switch_case',
  SWITCH_DEFAULT = 'switch_default',
  WHILE = 'while',
  DO_WHILE = 'do_while',
  FOR = 'for',
  LOOP_BREAK = 'loop_break',
  LOOP_CONTINUE = 'loop_continue',
  GOTO = 'goto',
  LABEL = 'label',
  RETURN = 'return',
  CONDITIONAL_EXPRESSION = 'conditional_expression',
  LOGICAL_OPERATOR = 'logical_operator',
  COMMA_EXPRESSION = 'comma_expression'
}

// 依赖关系类型
enum DependencyRelationshipType {
  INCLUDE = 'include',
  SYSTEM_INCLUDE = 'system_include',
  MACRO_DEFINITION = 'macro_definition',
  MACRO_FUNCTION = 'macro_function',
  CONDITIONAL_COMPILATION = 'conditional_compilation',
  TYPE_REFERENCE = 'type_reference',
  STRUCT_REFERENCE = 'struct_reference',
  FUNCTION_DECLARATION = 'function_declaration',
  ENUM_REFERENCE = 'enum_reference',
  UNION_REFERENCE = 'union_reference',
  EXTERN_VARIABLE = 'extern_variable',
  STATIC_VARIABLE = 'static_variable'
}

// 继承关系类型
enum InheritanceRelationshipType {
  NESTED_STRUCT = 'nested_struct',
  COMPOSITION = 'composition',
  INTERFACE_IMPLEMENTATION = 'interface_implementation',
  FORWARD_DECLARATION = 'forward_declaration',
  UNION_NESTED = 'union_nested',
  ENUM_INHERITANCE = 'enum_inheritance',
  TYPE_ALIAS_INHERITANCE = 'type_alias_inheritance',
  POLYMORPHIC = 'polymorphic',
  VTABLE = 'vtable',
  CALLBACK_IMPLEMENTATION = 'callback_implementation',
  POINTER_INHERITANCE = 'pointer_inheritance',
  NESTED_ACCESS = 'nested_access'
}

// 生命周期关系类型
enum LifecycleRelationshipType {
  MEMORY_DEALLOCATION = 'memory_deallocation',
  MEMORY_REALLOCATION = 'memory_reallocation',
  RESOURCE_DESTRUCTOR = 'resource_destructor',
  RESOURCE_INIT = 'resource_init',
  RESOURCE_CLEANUP = 'resource_cleanup',
  SCOPE_LOCAL_BEGIN = 'scope_local_begin',
  SCOPE_LOCAL_END = 'scope_local_end',
  SCOPE_GLOBAL = 'scope_global',
  SCOPE_STATIC = 'scope_static',
  SCOPE_PARAMETER = 'scope_parameter'
}

// 语义关系类型
enum SemanticRelationshipType {
  ERROR_RETURN = 'error_return',
  ERROR_CHECKING = 'error_checking',
  RESOURCE_INITIALIZATION = 'resource_initialization',
  CLEANUP_PATTERN = 'cleanup_pattern',
  CALLBACK_ASSIGNMENT = 'callback_assignment',
  CALLBACK_TYPE = 'callback_type'
}

// 引用关系类型
enum ReferenceRelationshipType {
  VARIABLE_REFERENCE = 'variable_reference',
  TYPE_REFERENCE = 'reference_type',
  ENUM_CONSTANT_REFERENCE = 'enum_constant_reference',
  MACRO_REFERENCE = 'macro_reference',
  GLOBAL_VARIABLE_REFERENCE = 'global_variable_reference',
  STATIC_VARIABLE_REFERENCE = 'static_variable_reference'
}

// 注解关系类型
enum AnnotationRelationshipType {
  TYPE_ANNOTATION = 'type_annotation',
  VARIABLE_ANNOTATION = 'variable_annotation',
  FIELD_ANNOTATION = 'field_annotation'
}

// 统一关系类型联合
type RelationshipType = 
  | CallRelationshipType
  | DataFlowRelationshipType
  | ControlFlowRelationshipType
  | DependencyRelationshipType
  | InheritanceRelationshipType
  | LifecycleRelationshipType
  | SemanticRelationshipType
  | ReferenceRelationshipType
  | AnnotationRelationshipType;
```

### 基础关系查询结果接口

```typescript
interface RelationshipQueryResult {
  /** 唯一标识符，用于图数据库中的边ID */
  id: string;
  
  /** 关系类型 */
  type: RelationshipType;
  
  /** 关系类别 */
  category: RelationshipCategory;
  
  /** 源节点ID */
  fromNodeId: string;
  
  /** 目标节点ID */
  toNodeId: string;
  
  /** 关系方向（true: from->to, false: undirected） */
  directed: boolean;
  
  /** 关系强度（0-1，可选） */
  strength?: number;
  
  /** 关系权重（可选） */
  weight?: number;
  
  /** 位置信息 */
  location: {
    filePath: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  
  /** 语言类型 */
  language: string;
  
  /** 扩展属性 */
  properties: Record<string, any>;
}
```

### 特化关系接口

基于C语言关系查询模式，设计特化接口：

```typescript
// 调用关系
interface CallRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.CALL;
  type: CallRelationshipType;
  
  // 调用关系特有属性
  functionName?: string;
  arguments?: string[];
  isChained?: boolean;
  chainDepth?: number;
  isRecursive?: boolean;
}

// 数据流关系
interface DataFlowRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.DATA_FLOW;
  type: DataFlowRelationshipType;
  
  // 数据流关系特有属性
  sourceVariable?: string;
  targetVariable?: string;
  dataType?: string;
  flowPath?: string[];
  operator?: string;
}

// 控制流关系
interface ControlFlowRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.CONTROL_FLOW;
  type: ControlFlowRelationshipType;
  
  // 控制流关系特有属性
  condition?: string;
  loopVariable?: string;
  controlFlowTargets?: string[];
  labelName?: string;
}

// 依赖关系
interface DependencyRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.DEPENDENCY;
  type: DependencyRelationshipType;
  
  // 依赖关系特有属性
  dependencyPath?: string;
  isStandardLibrary?: boolean;
  macroName?: string;
  conditionSymbol?: string;
}

// 继承关系
interface InheritanceRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.INHERITANCE;
  type: InheritanceRelationshipType;
  
  // 继承关系特有属性
  parentType?: string;
  childType?: string;
  inheritanceDepth?: number;
  fieldName?: string;
}

// 生命周期关系
interface LifecycleRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.LIFECYCLE;
  type: LifecycleRelationshipType;
  
  // 生命周期关系特有属性
  resourceType?: string;
  cleanupMechanism?: string;
  operation?: string;
  scopeType?: string;
}

// 语义关系
interface SemanticRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.SEMANTIC;
  type: SemanticRelationshipType;
  
  // 语义关系特有属性
  errorCode?: string;
  errorValue?: string;
  resourceConstructor?: string;
  resourceType?: string;
  callbackFunction?: string;
}

// 引用关系
interface ReferenceRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.REFERENCE;
  type: ReferenceRelationshipType;
  
  // 引用关系特有属性
  referenceName?: string;
  referenceContext?: string;
  isDefinition?: boolean;
}

// 注解关系
interface AnnotationRelationship extends RelationshipQueryResult {
  category: RelationshipCategory.ANNOTATION;
  type: AnnotationRelationshipType;
  
  // 注解关系特有属性
  annotationName?: string;
  annotationArguments?: string[];
  target?: string;
}
```

### 关系查询结果联合类型

```typescript
type CRelationshipQueryResult = 
  | CallRelationship
  | DataFlowRelationship
  | ControlFlowRelationship
  | DependencyRelationship
  | InheritanceRelationship
  | LifecycleRelationship
  | SemanticRelationship
  | ReferenceRelationship
  | AnnotationRelationship;
```

### 关系类型映射工具

```typescript
class RelationshipTypeMapping {
  /**
   * 根据关系类型获取关系类别
   */
  static getCategory(type: RelationshipType): RelationshipCategory {
    if (Object.values(CallRelationshipType).includes(type as any)) {
      return RelationshipCategory.CALL;
    }
    if (Object.values(DataFlowRelationshipType).includes(type as any)) {
      return RelationshipCategory.DATA_FLOW;
    }
    if (Object.values(ControlFlowRelationshipType).includes(type as any)) {
      return RelationshipCategory.CONTROL_FLOW;
    }
    if (Object.values(DependencyRelationshipType).includes(type as any)) {
      return RelationshipCategory.DEPENDENCY;
    }
    if (Object.values(InheritanceRelationshipType).includes(type as any)) {
      return RelationshipCategory.INHERITANCE;
    }
    if (Object.values(LifecycleRelationshipType).includes(type as any)) {
      return RelationshipCategory.LIFECYCLE;
    }
    if (Object.values(SemanticRelationshipType).includes(type as any)) {
      return RelationshipCategory.SEMANTIC;
    }
    if (Object.values(ReferenceRelationshipType).includes(type as any)) {
      return RelationshipCategory.REFERENCE;
    }
    if (Object.values(AnnotationRelationshipType).includes(type as any)) {
      return RelationshipCategory.ANNOTATION;
    }
    
    throw new Error(`Unknown relationship type: ${type}`);
  }
  
  /**
   * 检查关系类型是否属于指定类别
   */
  static isTypeOfCategory(type: RelationshipType, category: RelationshipCategory): boolean {
    return this.getCategory(type) === category;
  }
}
```

### 关系查询结果构建器

```typescript
class RelationshipQueryBuilder {
  protected relationship: Partial<RelationshipQueryResult>;
  
  constructor() {
    this.relationship = {
      directed: true,
      language: 'c',
      properties: {}
    };
  }
  
  setId(id: string): this {
    this.relationship.id = id;
    return this;
  }
  
  setType(type: RelationshipType): this {
    this.relationship.type = type;
    this.relationship.category = RelationshipTypeMapping.getCategory(type);
    return this;
  }
  
  setFromNodeId(fromNodeId: string): this {
    this.relationship.fromNodeId = fromNodeId;
    return this;
  }
  
  setToNodeId(toNodeId: string): this {
    this.relationship.toNodeId = toNodeId;
    return this;
  }
  
  setDirected(directed: boolean): this {
    this.relationship.directed = directed;
    return this;
  }
  
  setStrength(strength: number): this {
    this.relationship.strength = strength;
    return this;
  }
  
  setWeight(weight: number): this {
    this.relationship.weight = weight;
    return this;
  }
  
  setLocation(location: RelationshipQueryResult['location']): this {
    this.relationship.location = location;
    return this;
  }
  
  setLanguage(language: string): this {
    this.relationship.language = language;
    return this;
  }
  
  addProperty(key: string, value: any): this {
    if (!this.relationship.properties) {
      this.relationship.properties = {};
    }
    this.relationship.properties[key] = value;
    return this;
  }
  
  build(): RelationshipQueryResult {
    if (!this.relationship.id || !this.relationship.type || 
        !this.relationship.fromNodeId || !this.relationship.toNodeId) {
      throw new Error('Missing required fields: id, type, fromNodeId, toNodeId');
    }
    return this.relationship as RelationshipQueryResult;
  }
}
```

### 设计优势

1. **图数据库友好**：采用标准的节点-关系-节点模型
2. **语言无关枚举**：枚举类型独立定义，便于多语言扩展
3. **类型安全**：使用TypeScript的联合类型和特化接口
4. **丰富的元数据**：支持关系查询模式中的各种元数据
5. **可扩展性**：通过properties字段支持自定义扩展