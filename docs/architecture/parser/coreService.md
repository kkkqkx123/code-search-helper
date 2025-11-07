## TreeSitterCoreService 中具体提取方法的架构分析

### 当前设计问题

在TreeSitterCoreService中包含具体的提取方法（如`extractFunctions`、`extractClasses`等）**存在架构设计问题**，主要原因如下：

#### 1. 违反单一职责原则

TreeSitterCoreService的定位应该是"统一的TreeSitter服务入口"，负责协调各个查询组件，而不是直接实现具体的业务逻辑。当前设计使其承担了过多职责：

- 解析器生命周期管理
- 查询组件协调
- 具体的业务逻辑实现（函数、类提取等）
- 回退机制处理

#### 2. 功能重复和职责混淆

从代码分析可以看出：

- **TreeSitterQueryFacade** 已经提供了完整的查询接口（`findFunctions`、`findClasses`等）
- **FallbackExtractor** 已经实现了智能回退机制
- **TreeSitterCoreService** 中的提取方法本质上是对这两者的简单包装

这种设计导致了三层重复实现：
```
TreeSitterCoreService.extractFunctions() 
→ TreeSitterQueryFacade.findFunctions() 
→ FallbackExtractor.extractFunctions()
```

#### 3. 架构层次不清晰

根据架构文档，理想的调用链应该是：
```
Client → TreeSitterCoreService → TreeSitterQueryFacade → TreeSitterQueryExecutor
```

但当前实现中，TreeSitterCoreService还承担了本应属于业务层的具体提取逻辑。

### 建议的重构方案

#### 1. 保留通用处理逻辑，移除具体提取方法

**TreeSitterCoreService应该只保留：**

**核心解析功能：**
- `parseCode(code, language): Promise<ParseResult>`
- `parseFile(filePath, code): Promise<ParseResult>`
- `detectLanguage(filePath): Promise<ParserLanguage>`

**通用查询接口：**
- `findNodeByType(ast, type): SyntaxNode[]` (同步)
- `findNodeByTypeAsync(ast, type): Promise<SyntaxNode[]>` (异步)
- `findNodesByTypes(ast, types): SyntaxNode[]` (同步)
- `queryTree(ast, queryPattern): QueryMatch[]`

**基础工具方法：**
- `getNodeText(node, sourceCode): string`
- `getNodeLocation(node): LocationInfo`
- `getNodeName(node): string`

**移除的具体方法：**
- `extractFunctions(ast, language): Promise<SyntaxNode[]>`
- `extractClasses(ast, language): Promise<SyntaxNode[]>`
- `extractImports(ast, language): Promise<SyntaxNode[]>`
- `extractExports(ast, language): Promise<SyntaxNode[]>`
- `extractImportNodes(ast): SyntaxNode[]`
- `extractImportNodesAsync(ast): Promise<SyntaxNode[]>`

#### 2. 创建专门的业务服务层

建议创建一个新的服务层（如`CodeStructureService`），专门负责具体的业务逻辑：

```typescript
export class CodeStructureService {
  constructor(private coreService: TreeSitterCoreService) {}
  
  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    const lang = language || this.detectLanguageFromAST(ast);
    return this.coreService.findNodeByTypeAsync(ast, 'functions');
  }
  
  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    const lang = language || this.detectLanguageFromAST(ast);
    return this.coreService.findNodeByTypeAsync(ast, 'classes');
  }
  
  // 其他具体提取方法...
}
```

#### 3. 简化调用关系

重构后的调用链应该是：
```
Client → CodeStructureService → TreeSitterCoreService → TreeSitterQueryFacade → TreeSitterQueryExecutor
```

### 重构的优势

#### 1. 职责清晰
- **TreeSitterCoreService**: 专注于Tree-sitter解析和通用查询
- **TreeSitterQueryFacade**: 专注于查询接口简化
- **CodeStructureService**: 专注于具体的业务逻辑

#### 2. 可维护性提升
- 减少代码重复
- 降低耦合度
- 便于单元测试

#### 3. 扩展性增强
- 新增查询类型只需在TreeSitterQueryFacade中添加
- 新增业务逻辑只需在CodeStructureService中实现
- 核心解析逻辑保持稳定

### 实施建议

1. **渐进式重构**: 先创建CodeStructureService，逐步迁移业务逻辑
2. **保持向后兼容**: 在过渡期间保留TreeSitterCoreService中的方法，但标记为废弃
3. **更新文档**: 明确各组件的职责和使用场景
4. **测试覆盖**: 确保重构不影响现有功能

### 结论

**TreeSitterCoreService中包含具体的提取方法是不合理的**，应该只保留通用的处理逻辑。具体提取方法应该移到专门的业务服务层，这样可以：

- 遵循单一职责原则
- 提高代码的可维护性和可扩展性
- 建立更清晰的架构层次
- 减少功能重复和代码冗余

这种重构将使整个查询系统的架构更加清晰和合理。