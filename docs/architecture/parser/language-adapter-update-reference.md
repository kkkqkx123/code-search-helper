# 语言适配器更新参考文档

## 概述

本文档旨在为其他语言（JavaScript、Python、Java 等）的适配器更新提供统一的参考和最佳实践，确保所有适配器都能遵循我们最新的重构架构。

## 背景

随着代码复杂度的增加和查询文件的不断丰富，我们发现在 `CLanguageAdapter` 中支持了非常细粒度的代码结构。为了保持一致性和减少重复工作，所有其他语言的适配器都应该遵循相同的设计模式。

## 核心设计原则

1. **单一职责**：适配器只负责将 Tree-sitter 查询结果标准化为 `StandardizedQueryResult`。所有关系提取逻辑都应在 `normalization` 模块中完成。
2. **确定性 ID**：所有标准化节点都必须包含 `nodeId`，该 ID 应使用 `generateDeterministicNodeId` 函数生成。
3. **统一类型系统**：适配器应使用 `mapQueryTypeToStandardType` 将查询类型映射到 `StandardizedQueryResult['type']`。
4. **元数据分离**：节点相关的元数据应存储在 `metadata.extra` 字段中，关系相关的元数据应存储在 `metadata.extra` 中，以便 `GraphDataMappingService` 区分实体和关系。

## 关键文件和方法

### 核心文件
- `src/service/parser/core/normalization/types.ts`: 定义了 `StandardizedQueryResult` 接口和 `StandardType` 类型。
- `src/service/parser/core/normalization/BaseLanguageAdapter.ts`: 基础适配器抽象类，定义了通用逻辑。
- `src/service/parser/core/normalization/adapters/CLanguageAdapter.ts`: C 语言适配器实现，作为参考模板。
- `src/service/graph/mapping/GraphDataMappingService.ts`: 图数据映射服务，负责将标准化结果转换为图顶点和边。

### 核心方法
- `generateDeterministicNodeId(node: Parser.SyntaxNode): string`: 生成确定性节点 ID。
- `mapQueryTypeToStandardType(queryType: string): StandardType`: 将查询类型映射到标准类型。
- `extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any`: 提取关系元数据。
- `isRelationshipType(type: StandardizedQueryResult['type']): boolean`: 判断是否为关系类型。
- `mapRelationshipTypeToGraphType(relationshipType: string): GraphRelationshipType`: 将关系类型映射到图关系类型。

## C 语言适配器更新详解

### 1. 支持的查询类型

`CLanguageAdapter` 现在支持以下查询类型，所有其他适配器都应实现所有查询规则支持的查询类型(见src\service\parser\constants\queries目录)：

#### 基础实体类型
- `functions`: 函数定义和声明。
- `structs`: 结构体定义。
- `variables`: 变量声明。
- `preprocessor`: 预处理指令（`#include`, `#define` 等）。

#### 关系类型
- `calls`: 函数调用关系。
- `data-flows`: 变量间的数据流。
- `inheritance`: 继承关系（对于结构体而言）。
- `concurrency-relationships`: 并发关系（线程、互斥锁等）。
- `control-flow-relationships`: 细粒度控制流（`if-else`, `switch-case`, 循环嵌套）。
- `lifecycle-relationships`: 资源生命周期关系（内存分配、文件操作等）。
- `semantic-relationships`: 高级语义关系（设计模式、工厂模式等）。

### 2. 类型映射方法

```typescript
// 在 mapQueryTypeToStandardType 方法中
mapQueryTypeToStandardType(queryType: string): StandardType {
  const mapping: Record<string, StandardType> = {
    'functions': 'function',
    'structs': 'class',
    'variables': 'variable',
    'preprocessor': 'expression',
    
    // 关系类型
    'calls': 'call',
    'data-flows': 'data-flow',
    'inheritance': 'inheritance',
    // ... 其他关系类型
  };
  
  return mapping[queryType] || 'expression';
}
```

### 3. 元数据提取

```typescript
// 在 extractRelationshipMetadata 方法中
switch (standardType) {
  case 'call':
    return {
      type: 'call',
      fromNodeId: /* 从 AST 中提取的调用者节点 ID */,
      toNodeId: /* 从 AST 中提取的被调用者节点 ID */,
      // 其他调用元数据
    };
  case 'data-flow':
    return {
      type: 'data-flow',
      // ... 数据流元数据
    };
  // ... 其他关系类型
}
```

### 4. `normalize` 方法结构

```typescript
async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
  const results: StandardizedQueryResult[] = [];

  // 初始化符号表（可选）
  // const symbolTable = this.initializeSymbolTable();

  for (const result of queryResults) {
    const astNode = result.captures?.[0]?.node;
    const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${queryType}:${Date.now()}`;
    
    // 创建标准化节点
    const standardizedResult: StandardizedQueryResult = {
      nodeId,
      type: this.mapQueryTypeToStandardType(queryType),
      name: this.extractName(result),
      // ... 其他标准字段
      metadata: {
        language,
        // ... 基础元数据
        // 如果是关系类型，则将关系元数据存储在这里
        extra: this.isRelationshipType(queryType) ? this.extractRelationshipMetadata(result, astNode) : {}
      }
    };

    results.push(standardizedResult);
  }

  return results;
}
```

## JavaScript / TypeScript 适配器指南

JS/TS 适配器在结构上与 C 语言类似，但有一些特定差异：

- **函数与类**：使用 `function_definition` 和 `class_declaration`。
- **模块系统**：使用 `import_statement` 和 `export_statement`。
- **异步编程**：注意 `async/await` 关键字。

## Python 适配器指南

Python 适配器应特别注意：

- **类与函数**：使用 `class_definition` 和 `function_definition`。
- **装饰器**：使用 `decorator` 和 `async_function_def`。
- **缩进**：Python 依赖缩进，需要正确处理 `indent` 和 `dedent` 块。

## 文件命名规范

所有新增的查询文件都应遵循以下命名规范：

- `functions-<language>.ts`: 函数相关查询。
- `structs-<language>.ts`: 结构体相关查询。
- `data-flows-<language>.ts`: 数据流相关查询。
- 等等。

这样命名有助于代码的自文档化和可维护性。

## 测试建议

1. **单元测试**：为每个新的查询类型编写单元测试。
2. **集成测试**：使用真实的复杂代码文件进行集成测试。
3. **回归测试**：确保适配器更新不会破坏现有功能。

## 重要说明：SymbolResolver 已弃用

**注意**：`src/service/graph/symbol/SymbolResolver.ts` 中的 `SymbolResolver` 类已被标记为 `@deprecated`。其功能已被整合到 `normalization` 模块中。新的架构不再依赖独立的符号解析服务，而是通过 `StandardizedQueryResult` 中的 `symbolInfo` 字段直接提供符号信息。

## 结论

通过遵循此参考文档，我们可以确保所有语言适配器都保持一致，共同演进，并为我们的图数据库提供最准确和丰富的结构信息。