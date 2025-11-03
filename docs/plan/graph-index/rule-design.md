# Tree-sitter 查询规则设计

## 概述

本文档描述了用于提取代码结构的 Tree-sitter 查询规则设计。完整的实现指南请参考 [实现指南](./implementation-guide.md)。

## 现有查询模式分析

### 查询映射结构

项目使用 `QueryTypeMappings.ts` 定义语言查询映射，结构如下：

```typescript
export const LANGUAGE_QUERY_MAPPINGS: LanguageMappings = {
  'typescript': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'exports': ['exports'],
    'interfaces': ['interfaces'],
    'types': ['types'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'expressions': ['expressions'],
    'properties': ['variables']
  },
  // ... 其他语言
};
```

### 查询文件组织

查询文件位于 `src/service/parser/constants/queries/` 目录下，按语言组织：

- TypeScript: `src/service/parser/constants/queries/typescript/`
- JavaScript: `src/service/parser/constants/queries/javascript/`
- Go: `src/service/parser/constants/queries/go/`
- 等等...

## 图索引查询规则扩展

### 1. 类和接口提取

基于现有的 `typescript/classes.ts`，扩展以支持图索引所需的关系提取：

```scm
; 捕获类定义
(class_declaration
  name: (type_identifier) @class.name
  body: (class_body) @class.body) @class.definition

; 捕获类的继承
(class_declaration
  name: (type_identifier) @class.name
  heritage: (class_heritage 
    (extends_clause 
      (type_identifier) @class.inherits))) @class.with_inheritance

; 捕获类的接口实现
(class_declaration
  name: (type_identifier) @class.name
  heritage: (class_heritage 
    (implements_clause 
      (type_identifier) @class.implements))) @class.with_implementation

; 捕获接口定义
(interface_declaration
  name: (type_identifier) @interface.name
  body: (interface_body) @interface.body) @interface.definition
```

### 2. 函数和方法提取

```scm
; 捕获函数声明
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.parameters
  return_type: (type_annotation)? @function.return_type) @function.definition

; 捕获方法定义
(method_definition
  name: (property_identifier) @method.name
  parameters: (formal_parameters) @method.parameters
  return_type: (type_annotation)? @method.return_type) @method.definition
```

### 3. 函数调用提取

```scm
; 捕获直接函数调用, e.g., myFunction()
(call_expression
  function: (identifier) @call.name) @call.expression

; 捕获成员方法调用, e.g., myObject.myMethod()
(call_expression
  function: (member_expression
    property: (property_identifier) @call.name)) @call.member_expression

; 捕获静态方法调用, e.g., MyClass.myStaticMethod()
(call_expression
  function: (member_expression
    object: (type_identifier) @call.class_name
    property: (property_identifier) @call.name)) @call.static_method
```

### 4. 导入和导出语句提取

```scm
; 捕获导入语句
(import_statement
  (import_clause 
    (identifier) @import.default_name)
  source: (string) @import.source) @import.default

; 捕获导出语句
(export_statement
  (identifier) @export.name) @export.named
```

## 查询规则集成策略

### 1. 更新查询映射

在 `QueryTypeMappings.ts` 中添加图索引特定的查询类型：

```typescript
export const LANGUAGE_QUERY_MAPPINGS: LanguageMappings = {
  'typescript': {
    // 现有映射...
    'functions': ['functions'],
    'classes': ['classes'],
    
    // 新增图索引映射
    'graph-classes': ['classes', 'interfaces'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['exports']
  },
  // ... 其他语言
};
```

### 2. 扩展 TreeSitterQueryEngine

添加执行图索引特定查询的方法：

```typescript
/**
 * 执行图索引查询
 */
async executeGraphQueries(ast: Parser.SyntaxNode, language: string): Promise<Map<string, QueryResult>> {
  // 获取图索引查询类型
  const graphQueryTypes = this.getGraphQueryTypes(language);
  
  // 执行查询
  const results = new Map<string, QueryResult>();
  for (const queryType of graphQueryTypes) {
    const result = await this.executeQuery(ast, queryType, language);
    results.set(queryType, result);
  }
  
  return results;
}
```

## 静态分析属性计算

### 圈复杂度计算

圈复杂度不能直接通过单个 `tree-sitter` 查询得出，需要在提取函数节点后，对函数体内的控制流语句进行计数。

```javascript
// 在 GraphMapperService 中实现的圈复杂度计算逻辑
function calculateCyclomaticComplexity(functionNode) {
  let complexity = 1; // 基础复杂度
  
  // 查找控制流语句
  const controlFlowPatterns = [
    'if_statement',
    'switch_statement',
    'for_statement',
    'while_statement',
    'do_statement',
    'catch_clause',
    'conditional_expression', // 三元运算符
    'logical_and_expression', // && 运算符
    'logical_or_expression'   // || 运算符
  ];
  
  for (const pattern of controlFlowPatterns) {
    const nodes = findNodesByType(functionNode, pattern);
    complexity += nodes.length;
  }
  
  return complexity;
}
```

### 方法和属性数量计算

```javascript
// 在 GraphMapperService 中实现的方法和属性数量计算逻辑
function calculateClassMetrics(classNode) {
  const methodNodes = findNodesByType(classNode, 'method_definition');
  const propertyNodes = findNodesByType(classNode, 'property_definition');
  
  return {
    methodCount: methodNodes.length,
    propertyCount: propertyNodes.length
  };
}
```

## 扩展指南

### 添加新语言支持

1. **分析现有查询文件**: 查看语言目录下的现有查询文件
2. **扩展查询映射**: 在 `QueryTypeMappings.ts` 中添加该语言的图索引查询映射
3. **创建图索引查询**: 基于现有查询文件，添加图索引特定的捕获规则

### 添加新的查询类型

1. **定义查询模式**: 在相应的查询文件中添加新的查询模式
2. **更新映射逻辑**: 在 `QueryTypeMappings.ts` 中更新映射关系
3. **测试验证**: 编写测试用例验证查询结果

## 相关文档

- [实现指南](./implementation-guide.md) - 综合性实现指南，包含完整代码示例
- [计划概述](./plan.md) - 高层次实现计划
- [架构设计](./index-design.md) - 详细架构设计
- [代码设计](./code-design.md) - 具体代码实现设计