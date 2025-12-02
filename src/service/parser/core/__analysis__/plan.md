您说得对，我之前的方案确实过于复杂了。让我重新提供一个更简单直接的解决方案：直接合并两个模块，从根本上解决耦合和职责重叠问题。

## 简化的架构重构方案

### 核心思路：合并 parse 和 query 目录

既然两个模块存在严重的功能重叠和循环依赖，最直接的解决方案就是将它们合并为一个统一的模块。

### 1. 新的目录结构

```
src/service/parser/core/
├── ParserService.ts          # 统一的解析和查询服务
├── ParserManager.ts          # 解析器管理（原 DynamicParserManager）
├── QueryEngine.ts            # 查询引擎（原 TreeSitterQueryEngine）
├── QueryRegistry.ts          # 查询注册表
├── CacheService.ts           # 统一的缓存服务
├── types.ts                  # 统一的类型定义
└── constants/                # 查询常量
    ├── queries/
    └── types/
```

### 2. 核心组件重构

#### 2.1 统一的 ParserService
```typescript
export class ParserService {
  private parserManager: ParserManager;
  private queryEngine: QueryEngine;
  private cacheService: CacheService;

  constructor() {
    this.parserManager = new ParserManager();
    this.queryEngine = new QueryEngine();
    this.cacheService = new CacheService();
  }

  // 解析功能
  async parseCode(code: string, language: string): Promise<ParseResult> {
    return this.parserManager.parseCode(code, language);
  }

  // 查询功能 - 统一入口
  async findFunctions(ast: SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryEngine.findEntities(ast, EntityType.FUNCTION, language);
  }

  async findTypes(ast: SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.queryEngine.findEntities(ast, EntityType.TYPE_DEFINITION, language);
  }

  // 综合分析
  async analyzeCode(code: string, language: string): Promise<AnalysisResult> {
    const ast = await this.parseCode(code, language);
    const entities = await this.findAllEntities(ast, language);
    const relationships = await this.findAllRelationships(ast, language);
    
    return { ast, entities, relationships };
  }
}
```

#### 2.2 简化的 QueryEngine
```typescript
export class QueryEngine {
  private queryRegistry: QueryRegistry;
  private cacheService: CacheService;

  constructor() {
    this.queryRegistry = new QueryRegistry();
    this.cacheService = new CacheService();
  }

  async findEntities(ast: SyntaxNode, entityType: EntityType, language: string): Promise<EntityQueryResult[]> {
    // 统一的实体查询逻辑
  }

  async findRelationships(ast: SyntaxNode, relationshipType: RelationshipType, language: string): Promise<RelationshipQueryResult[]> {
    // 统一的关系查询逻辑
  }
}
```

#### 2.3 统一的 CacheService
```typescript
export class CacheService {
  private parserCache = new Map<string, Parser>();
  private astCache = new Map<string, Tree>();
  private queryCache = new Map<string, QueryResult[]>();

  // 统一的缓存接口
  getParser(language: string): Parser | null { /* ... */ }
  setParser(language: string, parser: Parser): void { /* ... */ }
  
  getAST(key: string): Tree | null { /* ... */ }
  setAST(key: string, tree: Tree): void { /* ... */ }
  
  getQueryResult(key: string): QueryResult[] | null { /* ... */ }
  setQueryResult(key: string, result: QueryResult[]): void { /* ... */ }
}
```

### 3. 合并的优势

#### 3.1 消除循环依赖
- 不再存在两个模块之间的相互依赖
- 所有组件在同一个模块内，依赖关系清晰

#### 3.2 统一职责
- 解析和查询功能在一个服务中协调
- 避免职责边界模糊的问题

#### 3.3 减少代码重复
- 合并重复的查询逻辑
- 统一缓存策略
- 统一类型定义

#### 3.4 简化架构
- 减少抽象层次
- 更直观的代码组织
- 更容易理解和维护

### 4. 迁移策略

#### 4.1 渐进式合并
1. **第一步**：创建新的统一服务类，保持原有接口
2. **第二步**：逐步迁移功能到新服务
3. **第三步**：更新调用方使用新接口
4. **第四步**：删除旧的重复代码

#### 4.2 向后兼容
```typescript
// 保持原有接口，内部委托给新服务
export class ParserFacade {
  private unifiedService: ParserService;

  constructor() {
    this.unifiedService = new ParserService();
  }

  async findFunctions(ast: SyntaxNode, language: string): Promise<EntityQueryResult[]> {
    return this.unifiedService.findFunctions(ast, language);
  }
}
```

### 5. 实施计划

#### 阶段1：准备工作（1-2天）
- 创建新的统一接口定义
- 设计新的目录结构
- 准备迁移测试

#### 阶段2：核心合并（3-5天）
- 实现 ParserService
- 合并 QueryEngine
- 统一 CacheService

#### 阶段3：迁移和清理（2-3天）
- 迁移现有功能
- 更新调用方
- 删除重复代码

#### 阶段4：测试和优化（1-2天）
- 完善测试覆盖
- 性能优化
- 文档更新

### 6. 风险控制

- 保持现有接口的向后兼容性
- 充分的测试覆盖确保功能正确性
- 分阶段实施，降低风险

这个方案直接解决了核心问题：通过合并两个模块消除循环依赖和职责重叠，同时简化了架构，减少了不必要的抽象层次。