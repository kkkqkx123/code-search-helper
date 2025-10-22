# 查询模式分析文档

## 概述

本文档详细分析代码解析器中查询模块的两种查询模式处理机制，以及如何配置新增、升级和降级规则。

## 两种查询模式

### 1. 复杂语言模式（目录结构）

**适用语言**: TypeScript, JavaScript, CSS, C#, Kotlin, Rust, Vue, TSX 等

**目录结构示例**:
```
src/service/parser/constants/queries/
├── typescript/
│   ├── classes.ts
│   ├── functions.ts
│   ├── imports.ts
│   ├── exports.ts
│   ├── interfaces.ts
│   ├── methods.ts
│   ├── properties.ts
│   ├── types.ts
│   ├── variables.ts
│   └── index.ts
├── javascript/
│   ├── classes.ts
│   ├── functions.ts
│   ├── imports.ts
│   ├── variables.ts
│   ├── control-flow.ts
│   ├── expressions.ts
│   └── index.ts
└── css/
    ├── selectors.ts
    ├── properties.ts
    ├── rules.ts
    └── index.ts
```

**特点**:
- 每个语言有独立的目录
- 查询按功能类型拆分为多个文件
- 通过 `index.ts` 文件聚合所有查询
- 支持更精细的查询类型分类

### 2. 简单语言模式（单一文件）

**适用语言**: TOML, Lua, Elixir, OCaml, Solidity 等

**文件结构示例**:
```
src/service/parser/constants/queries/
├── toml.ts
├── lua.ts
├── elixir.ts
├── ocaml.ts
└── solidity.ts
```

**特点**:
- 每个语言只有一个查询文件
- 所有查询模式都在一个文件中定义
- 使用智能分类机制自动识别查询类型
- 适用于语法结构较简单的语言

## 查询加载机制

### QueryLoader 核心逻辑

在 [`QueryLoader.ts`](../src/service/parser/core/query/QueryLoader.ts) 中，查询加载采用**优先尝试新结构，失败后回退到旧结构**的策略：

```typescript
// 1. 首先尝试加载新的目录结构
try {
  const queryTypes = ['functions', 'classes', 'imports', 'exports', 'methods', 'interfaces', 'types', 'properties', 'variables'];
  
  for (const queryType of queryTypes) {
    const queryModule = await import(`../../constants/queries/${language}/${queryType}.ts`);
    // ... 加载成功
  }
} catch (error) {
  // 2. 如果新结构失败，回退到旧的单一文件结构
  const queryModule = await import(`../../constants/queries/${language}.ts`);
  const languageQueriesMap = this.categorizeSimpleLanguageQuery(query, language);
}
```

### 智能分类机制

对于简单语言模式，系统使用 `categorizeSimpleLanguageQuery` 方法自动分类查询：

```typescript
private static categorizeSimpleLanguageQuery(query: string, language: string): Map<string, string> {
  const queryPatterns = {
    functions: ['function_definition', 'function_declaration', 'method_definition'],
    classes: ['class_declaration', 'class_definition', 'struct_specifier'],
    variables: ['variable_declaration', 'var_declaration', 'assignment_expression'],
    // ... 更多类型
  };
  
  // 根据关键词自动分类查询模式
}
```

## 查询类型定义

### 标准查询类型

系统定义了以下标准查询类型：

| 查询类型 | 描述 | 适用语言 |
|---------|------|----------|
| `functions` | 函数定义 | 所有语言 |
| `classes` | 类定义 | 面向对象语言 |
| `imports` | 导入语句 | 模块化语言 |
| `exports` | 导出语句 | 模块化语言 |
| `methods` | 方法定义 | 面向对象语言 |
| `interfaces` | 接口定义 | TypeScript, Java |
| `types` | 类型定义 | TypeScript, Rust |
| `properties` | 属性定义 | 面向对象语言 |
| `variables` | 变量声明 | 所有语言 |
| `control-flow` | 控制流语句 | JavaScript, Python |
| `expressions` | 表达式 | JavaScript, Python |

### 语言特定查询类型

某些语言可能有特殊的查询类型：

- **CSS**: `selectors`, `properties`, `rules`
- **Vue**: `components`, `template-directives`
- **TSX**: `jsx`, `types-hooks`
- **Rust**: `types-macros`, `variables-expressions`

## 配置新增规则

### 1. 为现有语言新增查询类型

**步骤**:
1. 在对应语言的目录中创建新的查询文件
2. 在 `index.ts` 中导入并导出新查询
3. 更新 `QueryLoader` 中的 `queryTypes` 数组

**示例 - 为 TypeScript 新增 `decorators` 查询**:

```typescript
// src/service/parser/constants/queries/typescript/decorators.ts
export default `
; Decorator patterns
(decorator) @definition.decorator
(class_declaration
  decorator: (decorator) @name.decorator) @definition.class_decorator
`;

// src/service/parser/constants/queries/typescript/index.ts
import decorators from './decorators';
export default `
${classes}
${functions}
// ... 其他导入
${decorators}
`;
```

### 2. 新增语言支持

**步骤**:
1. 确定使用哪种模式（复杂或简单）
2. 创建查询文件或目录
3. 在 `QueryRegistryImpl.getSupportedLanguages()` 中添加语言
4. 在 `QueryLoader.getQueryFileName()` 中添加文件名映射（如果需要）

**示例 - 新增 Go 语言支持**:

```typescript
// 在 QueryRegistryImpl 中添加
static getSupportedLanguages(): string[] {
  return [
    // ... 现有语言
    'go'  // 新增 Go 语言
  ];
}

// 创建查询文件
// src/service/parser/constants/queries/go.ts (简单模式)
export default `
; Go function definitions
(function_declaration
  name: (identifier) @name.definition.function) @definition.function

; Go method definitions
(method_declaration
  name: (field_identifier) @name.definition.method) @definition.method
`;
```

## 升级/降级规则配置

### 升级：从简单模式到复杂模式

**适用场景**:
- 语言支持的功能增加
- 需要更精细的查询分类
- 性能优化需求

**步骤**:
1. 创建语言目录
2. 将单一文件拆分为多个分类文件
3. 创建 `index.ts` 聚合文件
4. 删除旧的单一文件
5. 系统会自动检测到新结构

**示例 - 将 Lua 升级为复杂模式**:

```bash
# 1. 创建目录
mkdir src/service/parser/constants/queries/lua

# 2. 拆分查询文件
# lua/functions.ts, lua/variables.ts, lua/tables.ts 等

# 3. 创建 index.ts
# 4. 删除 lua.ts
```

### 降级：从复杂模式到简单模式

**适用场景**:
- 语言支持的功能减少
- 简化维护
- 性能考虑

**步骤**:
1. 将所有查询合并到一个文件中
2. 删除目录结构
3. 创建单一查询文件
4. 系统会自动回退到简单模式

**示例 - 将 CSS 降级为简单模式**:

```typescript
// src/service/parser/constants/queries/css.ts
export default `
; CSS selectors
(rule_set
  selectors: (selector) @definition.selector) @definition.rule

; CSS properties
(declaration
  property: (property_name) @name.definition.property) @definition.property

; CSS rules
(at_rule) @definition.at_rule
`;
```

## 查询类型分类机制

### 关键词映射表

`QueryLoader` 使用以下关键词映射来自动分类简单语言的查询：

```typescript
const queryPatterns = {
  functions: [
    'function_definition', 'function_declaration', 'function_declarator',
    'method_definition', 'method_declaration', 'func_literal'
  ],
  classes: [
    'class_declaration', 'class_definition', 'struct_specifier',
    'struct_item', 'union_specifier', 'enum_specifier'
  ],
  variables: [
    'variable_declaration', 'var_declaration', 'let_declaration',
    'assignment_expression', 'local_variable_declaration'
  ],
  // ... 更多类型
};
```

### 自定义分类规则

要为特定语言添加自定义分类规则，可以扩展 `categorizeSimpleLanguageQuery` 方法：

```typescript
private static getLanguageSpecificPatterns(language: string) {
  const languagePatterns = {
    lua: {
      tables: ['table_constructor', 'table'],
      metatables: ['metatable']
    },
    toml: {
      tables: ['table', 'table_array_element'],
      arrays: ['array']
    }
    // ... 其他语言特定规则
  };
  
  return languagePatterns[language] || {};
}
```

## 最佳实践

### 1. 查询模式设计原则

- **一致性**: 保持相同查询类型在不同语言中的模式一致
- **完整性**: 覆盖语言的主要语法结构
- **性能**: 避免过于复杂的查询模式
- **可维护性**: 清晰的注释和结构

### 2. 新增语言建议

- **复杂语言**（如 TypeScript、Java、C++）使用目录结构
- **简单语言**（如 TOML、INI、Markdown）使用单一文件
- **中等复杂度语言**根据实际需求选择

### 3. 测试策略

- 为新增查询类型编写单元测试
- 验证查询语法正确性
- 测试查询性能
- 确保向后兼容性

## 故障排除

### 常见问题

1. **查询加载失败**
   - 检查文件路径和命名
   - 验证查询语法
   - 查看日志输出

2. **查询分类错误**
   - 检查关键词映射
   - 验证查询模式结构
   - 调整分类规则

3. **性能问题**
   - 优化复杂查询
   - 使用缓存机制
   - 减少不必要的查询类型

### 调试方法

```typescript
// 查看查询统计信息
const stats = QueryRegistryImpl.getStats();
console.log('Query Registry Stats:', stats);

// 查看加载器统计信息
const loaderStats = QueryLoader.getStats();
console.log('Query Loader Stats:', loaderStats);

// 验证查询语法
const validation = QueryLoader.validateQuerySyntax(queryString);
console.log('Query Validation:', validation);
```

## 总结

查询模块采用灵活的两种模式设计，能够适应不同复杂度的语言需求。通过智能分类机制和回退策略，系统能够自动处理各种查询配置场景。新增、升级和降级规则都有明确的配置路径，确保了系统的可扩展性和维护性。