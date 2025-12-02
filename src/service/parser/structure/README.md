# CodeStructureService 代码结构服务

## 概述

CodeStructureService 是一个专门负责代码结构提取的业务服务层，它将具体的业务逻辑从 TreeSitterCoreService 中分离出来，遵循单一职责原则。

## 设计理念

### 职责分离
- **TreeSitterCoreService**: 专注于通用处理逻辑和组件协调
- **CodeStructureService**: 专注于具体的业务逻辑实现

### 架构优势
1. **职责清晰**: 每个组件只负责特定的职责
2. **可维护性提升**: 减少代码重复，降低耦合度
3. **扩展性增强**: 新增功能只需在相应服务中实现

## 核心功能

### 代码结构提取
- `extractFunctions()`: 提取函数节点
- `extractClasses()`: 提取类节点
- `extractImports()`: 提取导入节点
- `extractExports()`: 提取导出节点
- `extractMethods()`: 提取方法节点
- `extractInterfaces()`: 提取接口节点
- `extractTypes()`: 提取类型定义节点

### 同步与异步支持
- 同步版本：适用于需要快速响应的简单查询
- 异步版本：适用于复杂查询，可利用优化的查询系统

## 使用示例

```typescript
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { CodeStructureService } from './CodeStructureService';

// 创建服务实例
const coreService = new TreeSitterCoreService();
const structureService = new CodeStructureService(coreService);

// 提取函数
const functions = await structureService.extractFunctions(ast, 'javascript');

// 提取类
const classes = await structureService.extractClasses(ast, 'javascript');

// 提取导入
const imports = await structureService.extractImports(ast, 'javascript');
```

## 调用链路

```
Client → CodeStructureService → TreeSitterCoreService → TreeSitterQueryFacade → TreeSitterQueryExecutor
```

## 回退机制

当查询系统不可用时，CodeStructureService 会通过 TreeSitterCoreService 自动回退到基础实现：

1. **第一层**: TreeSitterQueryExecutor 执行查询
2. **第二层**: TreeSitterCoreService 协调回退
3. **第三层**: TreeSitterUtils 基础保障

## 最佳实践

1. **优先使用异步方法**: 异步方法可以利用优化的查询系统
2. **错误处理**: 依赖内置的回退机制，无需手动处理错误
3. **性能优化**: 利用缓存机制，避免重复查询