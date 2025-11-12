根据我对代码的分析，当前项目的ID生成逻辑如下：

## 主要ID生成策略

### 1. 确定性节点ID生成 (`generateDeterministicNodeId`)
位置：`src/utils/deterministic-node-id.ts`

```typescript
export function generateDeterministicNodeId(node: Parser.SyntaxNode): string {
  if (!node) {
    throw new Error('Cannot generate ID for a null or undefined node.');
  }
  
  const { type, startPosition } = node;
  const id = `${type}:${startPosition.row}:${startPosition.column}`;
  
  return id;
}
```

**特点：**
- 格式：`{nodeType}:{row}:{column}`
- 基于AST节点的类型和位置信息
- 确保同一文件中同一节点的ID始终一致
- 使用0索引的行列位置

### 2. 语言适配器中的ID生成逻辑

在各个语言适配器中（如CLanguageAdapter、JavaLanguageAdapter等），ID生成遵循以下模式：

```typescript
// 获取AST节点以生成确定性ID
const astNode = result.captures?.[0]?.node;
const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;
```

**策略：**
1. **优先使用确定性ID**：如果有AST节点，使用 `generateDeterministicNodeId(astNode)`
2. **回退策略**：如果没有AST节点，使用格式 `{type}:{name}:{timestamp}`

### 3. 关系节点的ID生成

对于关系类型（如调用、继承等），ID生成通常包含：
- 源节点ID
- 目标节点ID
- 关系类型

例如在调用关系提取器中：
```typescript
{
  type: 'call',
  fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
  toNodeId: generateDeterministicNodeId(astNode),
  callName: calleeName || 'unknown',
  // ...
}
```

### 4. 错误情况的ID生成

当处理出错时，使用特殊格式：
```typescript
nodeId: `error_${Date.now()}`
```

## ID生成的层次结构

1. **AST节点级别**：基于节点类型和位置的确定性ID
2. **符号级别**：通过SymbolInfo提供额外的符号标识
3. **关系级别**：基于源节点和目标节点的组合ID
4. **文件级别**：通过文件路径和符号表管理

## 关键设计原则

1. **确定性**：相同输入始终产生相同ID
2. **唯一性**：不同节点具有不同ID
3. **可追溯性**：ID包含足够信息用于调试和追踪
4. **容错性**：在缺少信息时有回退策略
5. **性能考虑**：避免复杂的哈希计算，使用简单字符串拼接

这种ID生成策略确保了在整个代码分析过程中，每个代码元素都有一个稳定且可识别的唯一标识符。


---

根据我对代码的深入分析，当前项目中各处使用的ID生成逻辑**并不统一**，存在多种不同的ID生成策略：

## ID生成策略的不一致性

### 1. 主要的ID生成方式

#### A. 确定性AST节点ID（推荐方式）
```typescript
// 位置：src/utils/deterministic-node-id.ts
export function generateDeterministicNodeId(node: Parser.SyntaxNode): string {
  const id = `${type}:${startPosition.row}:${startPosition.column}`;
  return id;
}
```

#### B. 语言适配器中的回退策略
```typescript
// 大多数语言适配器中使用
const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;
```

#### C. BaseLanguageAdapter中的直接实现
```typescript
// BaseLanguageAdapter.ts, HtmlLanguageAdapter.ts, CssLanguageAdapter.ts
const nodeId = astNode ? `${astNode.type}:${astNode.startPosition.row}:${astNode.startPosition.column}` : `fallback_${Date.now()}`;
```

#### D. ConfigLanguageAdapter中的特殊实现
```typescript
// ConfigLanguageAdapter.ts
protected generateNodeId(type: string, name: string, startLine: number, endLine: number, content: string, language: string): string {
  const contentHash = this.simpleHash(content);
  return `${language}:${type}:${name}:${startLine}:${endLine}:${contentHash}`;
}
```

### 2. 关系提取器中的ID生成

#### A. 语言特定关系提取器
```typescript
// rust-utils, java-utils, python-utils, csharp-utils, cpp-utils, c-utils
private generateNodeId(name: string, type: string, filePath: string): string {
  return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
}
```

#### B. 图构建服务
```typescript
// GraphConstructionService.ts
private generateNodeId(chunk: CodeChunk): string {
  const baseId = `${chunk.metadata.filePath}_${chunk.metadata.startLine}_${chunk.metadata.endLine}`;
  return Buffer.from(baseId).toString('hex').substring(0, 16);
}
```

### 3. 数据库层ID生成

```typescript
// NebulaDataService.ts
const nodeId = `${node.label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

## 不一致性问题总结

### 1. 格式不统一
- **AST节点ID**: `type:row:column`
- **回退ID**: `type:name:timestamp`
- **关系ID**: `type_hexencoded(filepath_name)`
- **配置ID**: `language:type:name:startLine:endLine:contentHash`
- **数据库ID**: `label_timestamp_random`

### 2. 确定性不一致
- **确定性**: AST节点ID（基于位置）
- **非确定性**: 大部分回退ID（使用时间戳）
- **部分确定性**: 配置ID（基于内容哈希）

### 3. 实现分散
- 至少6-7种不同的ID生成实现
- 分布在不同模块中，缺乏统一管理
- 相似功能重复实现

## 建议的改进方案

1. **统一ID生成服务**：创建一个中央ID生成服务，提供不同场景的ID生成方法
2. **标准化格式**：制定统一的ID格式规范
3. **提高确定性**：尽可能使用确定性ID，减少对时间戳的依赖
4. **消除重复代码**：将相似的ID生成逻辑合并到共享工具中

这种不一致性可能导致节点ID冲突、追踪困难以及系统维护复杂度增加等问题。


---

