现在我来设计全新的EntityQueryResult类型，专门针对实体查询优化。

## EntityQueryResult类型设计

### 核心设计原则

1. **专门针对实体查询**：完全独立于关系查询，专注于实体表示
2. **支持C语言实体特性**：针对C语言的预处理器、类型定义、函数等实体优化
3. **优先级支持**：体现实体查询模式的优先级系统
4. **可扩展性**：为后续多语言支持预留扩展空间

### 基础EntityQueryResult接口

```typescript
interface EntityQueryResult {
  /** 唯一标识符，用于图数据库中的顶点ID */
  id: string;
  
  /** 实体类型（基于C语言实体分类） */
  entityType: EntityType;
  
  /** 实体名称 */
  name: string;
  
  /** 查询优先级（来自实体查询模式） */
  priority: number;
  
  /** 位置信息 */
  location: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  
  /** 实体内容（原始代码片段） */
  content: string;
  
  /** 文件路径 */
  filePath: string;
  
  /** 语言类型 */
  language: string;
  
  /** 扩展属性 */
  properties: Record<string, any>;
}
```

### 实体类型枚举

```typescript
enum EntityType {
  // 预处理器实体（优先级5）
  PREPROCESSOR = 'preprocessor',
  MACRO = 'macro',
  PREPROC_CONDITION = 'preproc_condition',
  INCLUDE = 'include',
  
  // 类型定义实体（优先级4）
  STRUCT = 'struct',
  UNION = 'union',
  ENUM = 'enum',
  TYPE_ALIAS = 'type_alias',
  
  // 函数实体（优先级3）
  FUNCTION = 'function',
  FUNCTION_PROTOTYPE = 'function_prototype',
  FUNCTION_POINTER = 'function_pointer',
  
  // 变量实体（优先级2）
  VARIABLE = 'variable',
  ARRAY = 'array',
  POINTER = 'pointer',
  
  // 注释和注解（优先级0）
  COMMENT = 'comment',
  ANNOTATION = 'annotation'
}
```

### 特化实体接口

基于C语言实体查询模式的特点，设计特化接口：

```typescript
// 预处理器实体
interface PreprocessorEntity extends EntityQueryResult {
  entityType: EntityType.PREPROCESSOR | EntityType.MACRO | EntityType.PREPROC_CONDITION | EntityType.INCLUDE;
  
  // 预处理器特有属性
  preprocType?: 'def' | 'function_def' | 'ifdef' | 'if' | 'elif' | 'include';
  macroValue?: string;
  includePath?: string;
  condition?: string;
}

// 类型定义实体
interface TypeEntity extends EntityQueryResult {
  entityType: EntityType.STRUCT | EntityType.UNION | EntityType.ENUM | EntityType.TYPE_ALIAS;
  
  // 类型定义特有属性
  fields?: FieldInfo[];
  enumConstants?: EnumConstant[];
  baseType?: string;
}

interface FieldInfo {
  name: string;
  type: string;
  location: {
    startLine: number;
    endLine: number;
  };
}

interface EnumConstant {
  name: string;
  value?: string;
  location: {
    startLine: number;
    endLine: number;
  };
}

// 函数实体
interface FunctionEntity extends EntityQueryResult {
  entityType: EntityType.FUNCTION | EntityType.FUNCTION_PROTOTYPE | EntityType.FUNCTION_POINTER;
  
  // 函数特有属性
  returnType?: string;
  parameters?: ParameterInfo[];
  isPrototype?: boolean;
  isPointer?: boolean;
}

interface ParameterInfo {
  name: string;
  type: string;
  location: {
    startLine: number;
    endLine: number;
  };
}

// 变量实体
interface VariableEntity extends EntityQueryResult {
  entityType: EntityType.VARIABLE | EntityType.ARRAY | EntityType.POINTER;
  
  // 变量特有属性
  variableType?: string;
  arraySize?: string;
  isPointer?: boolean;
  isStatic?: boolean;
  isExtern?: boolean;
}

// 注解实体
interface AnnotationEntity extends EntityQueryResult {
  entityType: EntityType.ANNOTATION | EntityType.COMMENT;
  
  // 注解特有属性
  annotationType?: 'struct_tag' | 'comment' | 'directive';
  annotationValue?: string;
  target?: string;
}
```

### 实体查询结果联合类型

```typescript
type CEntityQueryResult = 
  | PreprocessorEntity
  | TypeEntity
  | FunctionEntity
  | VariableEntity
  | AnnotationEntity;
```

### 实体查询结果构建器

```typescript
class EntityQueryBuilder {
  protected entity: Partial<EntityQueryResult>;
  
  constructor() {
    this.entity = {
      priority: 0,
      language: 'c',
      properties: {}
    };
  }
  
  setId(id: string): this {
    this.entity.id = id;
    return this;
  }
  
  setEntityType(entityType: EntityType): this {
    this.entity.entityType = entityType;
    return this;
  }
  
  setName(name: string): this {
    this.entity.name = name;
    return this;
  }
  
  setPriority(priority: number): this {
    this.entity.priority = priority;
    return this;
  }
  
  setLocation(location: EntityQueryResult['location']): this {
    this.entity.location = location;
    return this;
  }
  
  setContent(content: string): this {
    this.entity.content = content;
    return this;
  }
  
  setFilePath(filePath: string): this {
    this.entity.filePath = filePath;
    return this;
  }
  
  setLanguage(language: string): this {
    this.entity.language = language;
    return this;
  }
  
  addProperty(key: string, value: any): this {
    if (!this.entity.properties) {
      this.entity.properties = {};
    }
    this.entity.properties[key] = value;
    return this;
  }
  
  build(): EntityQueryResult {
    if (!this.entity.id || !this.entity.entityType || !this.entity.name) {
      throw new Error('Missing required fields: id, entityType, name');
    }
    return this.entity as EntityQueryResult;
  }
}
```

### 设计优势

1. **专门化**：完全针对实体查询设计，避免了通用类型的复杂性
2. **类型安全**：使用TypeScript的联合类型和特化接口确保类型安全
3. **优先级支持**：内置优先级字段，与C语言实体查询模式对应
4. **可扩展**：通过properties字段支持自定义扩展
5. **构建器模式**：提供便捷的构建方式，支持链式调用