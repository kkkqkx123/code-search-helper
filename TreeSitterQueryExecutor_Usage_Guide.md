# TreeSitterQueryExecutor 使用指南

## 概述

`TreeSitterQueryExecutor` 已经完全重构以支持新的实体和关系类型系统。本指南将帮助您了解如何使用新的API以及如何从旧版本迁移。

## 新架构特性

### 1. 类型化的查询结果

新的查询系统返回类型化的实体和关系对象，而不是原始的语法节点：

```typescript
// 实体查询结果
interface EntityQueryResult {
  id: string;
  entityType: EntityType;
  name: string;
  priority: number;
  location: LocationInfo;
  content: string;
  filePath: string;
  language: string;
  properties: Record<string, any>;
}

// 关系查询结果
interface RelationshipQueryResult {
  id: string;
  type: RelationshipType;
  category: RelationshipCategory;
  fromNodeId: string;
  toNodeId: string;
  directed: boolean;
  strength?: number;
  weight?: number;
  location: RelationshipLocationInfo;
  language: string;
  properties: Record<string, any>;
}
```

### 2. 语言特定的类型支持

系统支持语言特定的实体和关系类型，例如C语言的特定类型：

```typescript
// C语言实体类型
enum CEntityType {
  PREPROCESSOR = 'preprocessor',
  MACRO = 'macro',
  STRUCT = 'struct',
  UNION = 'union',
  ENUM = 'enum',
  FUNCTION = 'function',
  FUNCTION_PROTOTYPE = 'function_prototype',
  // ... 更多类型
}

// C语言关系类型
enum CRelationshipType {
  FUNCTION = 'function',
  METHOD = 'method',
  ASSIGNMENT = 'assignment',
  INCLUDE = 'include',
  // ... 更多类型
}
```

## 基本用法

### 1. 实体查询

```typescript
import { TreeSitterQueryEngine, EntityType } from './TreeSitterQueryExecutor';
import Parser from 'tree-sitter';

const engine = new TreeSitterQueryEngine();
const ast = parser.parse(sourceCode);

// 查询所有函数
const functions = await engine.executeEntityQuery(
  ast,
  EntityType.FUNCTION,
  'c',
  { filePath: 'example.c' }
);

console.log(`找到 ${functions.length} 个函数`);
functions.forEach(func => {
  console.log(`函数: ${func.name} (${func.entityType})`);
  console.log(`位置: 第${func.location.startLine}行`);
  console.log(`内容: ${func.content}`);
});
```

### 2. 关系查询

```typescript
import { RelationshipType } from './types';

// 查询所有调用关系
const calls = await engine.executeRelationshipQuery(
  ast,
  RelationshipType.CALL,
  'c',
  { filePath: 'example.c' }
);

console.log(`找到 ${calls.length} 个调用关系`);
calls.forEach(call => {
  console.log(`调用: ${call.fromNodeId} -> ${call.toNodeId}`);
  console.log(`类型: ${call.type} (${call.category})`);
});
```

### 3. 混合查询

```typescript
// 同时查询实体和关系
const result = await engine.executeMixedQuery(
  ast,
  ['functions', 'types', 'calls'],
  'c',
  { 
    filePath: 'example.c',
    includeRelationships: true,
    useCache: true
  }
);

console.log(`实体: ${result.entities.length}`);
console.log(`关系: ${result.relationships.length}`);
```

### 4. 批量查询

```typescript
// 批量查询多种实体类型
const entityResults = await engine.executeMultipleEntityQueries(
  ast,
  [EntityType.FUNCTION, EntityType.TYPE_DEFINITION, EntityType.VARIABLE],
  'c',
  { filePath: 'example.c' }
);

// 批量查询多种关系类型
const relationshipResults = await engine.executeMultipleRelationshipQueries(
  ast,
  [RelationshipType.CALL, RelationshipType.ASSIGNMENT, RelationshipType.INCLUDE],
  'c',
  { filePath: 'example.c' }
);
```

## 使用 Facade 简化操作

`TreeSitterQueryFacade` 提供了简化的API：

```typescript
import { TreeSitterQueryFacade, EntityType, RelationshipType } from './TreeSitterQueryFacade';

// 简化的实体查询
const functions = await TreeSitterQueryFacade.executeEntityQuery(
  ast,
  EntityType.FUNCTION,
  'c'
);

// 简化的关系查询
const calls = await TreeSitterQueryFacade.executeRelationshipQuery(
  ast,
  RelationshipType.CALL,
  'c'
);

// 简化的混合查询
const result = await TreeSitterQueryFacade.executeMixedQuery(
  ast,
  ['functions', 'types'],
  'c'
);
```

## 查询选项

所有查询方法都支持选项参数：

```typescript
interface QueryExecutionOptions {
  /** 是否包含关系识别 */
  includeRelationships?: boolean;
  
  /** 是否使用缓存 */
  useCache?: boolean;
  
  /** 自定义文件路径 */
  filePath?: string;
  
  /** 自定义参数 */
  customParams?: Record<string, any>;
}
```

### 示例：使用查询选项

```typescript
const result = await engine.executeEntityQuery(
  ast,
  EntityType.FUNCTION,
  'c',
  {
    filePath: 'example.c',
    useCache: true,
    includeRelationships: true,
    customParams: {
      includePrototypes: true,
      minComplexity: 5
    }
  }
);
```

## 缓存系统

新系统提供了增强的缓存功能：

### 缓存类型

1. **实体缓存**: 存储实体查询结果
2. **关系缓存**: 存储关系查询结果
3. **混合缓存**: 存储混合查询结果
4. **AST缓存**: 存储AST对象

### 缓存管理

```typescript
import { QueryCache } from './QueryCache';

// 清除所有缓存
QueryCache.clearCache();

// 获取缓存统计
const stats = QueryCache.getAllStats();
console.log('缓存命中率:', stats.combined.overallHitRate);
console.log('缓存大小:', stats.combined.totalSize);
```

## 性能监控

系统集成了性能监控功能：

```typescript
import { QueryPerformanceMonitor } from './QueryPerformanceMonitor';

// 获取性能指标
const metrics = QueryPerformanceMonitor.getMetrics();
const summary = QueryPerformanceMonitor.getSummary();
const systemMetrics = QueryPerformanceMonitor.getSystemMetrics();

console.log('总查询数:', summary.totalQueries);
console.log('平均执行时间:', summary.averageExecutionTime);
```

## 语言特定功能

### C语言示例

```typescript
import { CEntityType, CRelationshipType } from './types/languages/c';

// 查询C语言特定的实体类型
const structs = await engine.executeEntityQuery(
  ast,
  CEntityType.STRUCT,
  'c'
);

const macros = await engine.executeEntityQuery(
  ast,
  CEntityType.MACRO,
  'c'
);

// 查询C语言特定的关系类型
const includes = await engine.executeRelationshipQuery(
  ast,
  CRelationshipType.INCLUDE,
  'c'
);
```

## 从旧版本迁移

### 1. 替换查询方法

**旧版本:**
```typescript
const result = await engine.executeQuery(ast, 'functions', 'c');
const functions = result.matches.map(match => match.node);
```

**新版本:**
```typescript
const functions = await engine.executeEntityQuery(
  ast,
  EntityType.FUNCTION,
  'c'
);
```

### 2. 处理查询结果

**旧版本:**
```typescript
result.matches.forEach(match => {
  console.log(match.node.text);
  console.log(match.location);
});
```

**新版本:**
```typescript
functions.forEach(entity => {
  console.log(entity.name);
  console.log(entity.content);
  console.log(entity.location);
  console.log(entity.properties);
});
```

### 3. 向后兼容性

旧版本的API仍然可用，但会返回转换后的格式：

```typescript
// 仍然支持，但建议使用新API
const legacyResult = await engine.executeQuery(ast, 'functions', 'c');
```

## 高级用法

### 1. 自定义实体处理

```typescript
import { QueryResultProcessor } from './QueryResultProcessor';

const processor = new QueryResultProcessor();

// 处理原始匹配结果
const entities = processor.processEntityMatches(
  matches,
  EntityType.FUNCTION,
  'c',
  'example.c'
);
```

### 2. 关系识别

```typescript
// 从实体中识别关系
const relationships = processor.identifyRelationships(
  entities,
  ast,
  'c',
  'example.c'
);
```

### 3. 使用构建器创建实体

```typescript
import { EntityQueryBuilderFactory } from './types';

const builder = EntityQueryBuilderFactory.createFunction();
const customEntity = builder
  .setId('custom-function-1')
  .setName('myFunction')
  .setEntityType(EntityType.FUNCTION)
  .setLocation({ startLine: 1, startColumn: 1, endLine: 5, endColumn: 1 })
  .setContent('function myFunction() {}')
  .setFilePath('example.js')
  .setLanguage('javascript')
  .setReturnType('void')
  .build();
```

## 错误处理

新系统提供了更好的错误处理：

```typescript
try {
  const result = await engine.executeEntityQuery(ast, EntityType.FUNCTION, 'c');
  // 处理结果
} catch (error) {
  console.error('查询失败:', error);
  // 系统会返回空数组而不是抛出异常
}

// 检查查询结果的状态
const mixedResult = await engine.executeMixedQuery(ast, ['functions'], 'c');
if (!mixedResult.success) {
  console.error('混合查询失败:', mixedResult.error);
}
```

## 最佳实践

1. **使用类型化查询**: 优先使用新的实体和关系查询方法
2. **启用缓存**: 对于重复查询，启用缓存以提高性能
3. **批量查询**: 对于多种类型，使用批量查询方法
4. **错误处理**: 始终检查查询结果的success状态
5. **性能监控**: 定期检查性能指标以优化查询

## 故障排除

### 常见问题

1. **查询返回空结果**
   - 检查语言参数是否正确
   - 确认查询模式是否存在
   - 验证AST是否有效

2. **性能问题**
   - 启用缓存
   - 使用批量查询
   - 检查性能监控指标

3. **类型错误**
   - 确保导入了正确的类型
   - 检查语言特定的类型是否已注册

### 调试技巧

```typescript
// 启用详细日志
const engine = new TreeSitterQueryEngine();

// 检查支持的查询类型
const entityTypes = queryConfigManager.getEntityQueryTypes();
const relationshipTypes = queryConfigManager.getRelationshipQueryTypes();

console.log('支持的实体类型:', entityTypes);
console.log('支持的关系类型:', relationshipTypes);

// 检查缓存状态
const cacheStats = QueryCache.getAllStats();
console.log('缓存统计:', cacheStats);
```

## 总结

新的 `TreeSitterQueryExecutor` 提供了更强大、更类型化的查询系统。通过使用新的API，您可以：

- 获得类型安全的查询结果
- 利用语言特定的实体和关系类型
- 享受更好的性能和缓存
- 使用更直观的API设计

建议逐步迁移到新API，以充分利用这些改进。