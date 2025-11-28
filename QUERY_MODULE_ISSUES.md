# Query模块具体问题和修复方案

## 问题清单

### Issue #1: 关系查询执行方法为空实现

**文件**: `src/service/parser/core/query/QueryResultProcessor.ts`  
**行号**: 539-543  
**严重性**: 🔴 Critical  
**现状**: 方法返回空数组，导致所有关系识别失败

```typescript
// ❌ 当前代码
private executeRelationshipQuery(
  ast: Parser.SyntaxNode,
  pattern: string,
  relationshipType: RelationshipType
): QueryMatch[] {
  // 这里应该执行实际的Tree-sitter查询
  // 简化实现，返回空数组
  return [];
}
```

**根本原因**: 代码中留了占位符注释，未实现实际逻辑

**影响范围**:
- `identifyRelationships()` 完全无法工作
- 关系查询始终返回 `[]`
- 混合查询中关系部分为空

**修复方案**:

```typescript
// ✅ 修复后代码
private async executeRelationshipQuery(
  ast: Parser.SyntaxNode,
  pattern: string,
  relationshipType: RelationshipType
): Promise<QueryMatch[]> {
  try {
    // 方案A: 使用QueryRegistry（推荐）
    const languageObj = ast.language;  // 从AST获取
    if (!languageObj) {
      this.logger.warn(`无法从AST获取语言信息`);
      return [];
    }

    // 使用QueryCache获取或编译查询
    const query = QueryCache.getQuery(languageObj, pattern);
    if (!query) {
      this.logger.warn(`无法编译查询模式: ${pattern}`);
      return [];
    }

    // 执行查询并获取匹配
    const matches = query.matches(ast);
    
    // 转换为QueryMatch格式
    return matches.map(match => ({
      node: match.captures[0]?.node || ast,
      captures: match.captures.reduce((acc, capture) => {
        acc[capture.name] = capture.node;
        return acc;
      }, {} as Record<string, Parser.SyntaxNode>),
      location: {
        startLine: match.captures[0]?.node?.startPosition.row + 1 || 1,
        startColumn: match.captures[0]?.node?.startPosition.column + 1 || 1,
        endLine: match.captures[0]?.node?.endPosition.row + 1 || 1,
        endColumn: match.captures[0]?.node?.endPosition.column + 1 || 1
      }
    }));
  } catch (error) {
    this.logger.error(`执行关系查询失败 (${relationshipType}):`, error);
    return [];
  }
}
```

**验证方法**:
```typescript
// 测试: 应该返回非空数组
const ast = /* ... */;
const matches = await processor.executeRelationshipQuery(
  ast,
  'some_pattern',
  RelationshipType.CALL
);
expect(matches.length).toBeGreaterThan(0);  // 应该通过
```

---

### Issue #2: 关系查询模式获取方法为空实现

**文件**: `src/service/parser/core/query/QueryResultProcessor.ts`  
**行号**: 530-534  
**严重性**: 🔴 Critical  
**现状**: 方法总是返回 `null`，导致无法获取关系查询模式

```typescript
// ❌ 当前代码
private getRelationshipQueryPattern(
  relationshipType: RelationshipType,
  language: string
): string | null {
  // 这里应该从查询配置中获取对应的查询模式
  // 简化实现，返回null
  return null;
}
```

**根本原因**: 占位符实现，未接入queryConfigManager

**影响范围**:
- `identifyRelationships()` 中无法获取查询模式
- 第118-123行的循环无法执行有效的查询

**修复方案**:

```typescript
// ✅ 修复后代码
private getRelationshipQueryPattern(
  relationshipType: RelationshipType,
  language: string
): string | null {
  try {
    // 从queryConfigManager获取所有关系查询类型配置
    const relationshipQueryTypes = queryConfigManager.getRelationshipQueryTypes();
    
    // 遍历找到包含此关系类型的查询配置
    for (const queryType of relationshipQueryTypes) {
      const config = queryConfigManager.getQueryTypeConfig(queryType);
      
      if (config && 
          config.category === 'relationship' &&
          config.relationshipTypes?.includes(relationshipType) &&
          this.isQueryTypeSupportedForLanguage(config, language)) {
        
        // 从QueryRegistry获取查询模式
        // 注意: 这需要是同步的，或者改为异步调用
        // 临时方案: 返回一个标准化的模式标识符
        return `relationship_${relationshipType}_${language}`;
      }
    }
    
    this.logger.warn(
      `未找到关系类型 ${relationshipType} 在 ${language} 的查询模式`
    );
    return null;
  } catch (error) {
    this.logger.error(`获取关系查询模式失败:`, error);
    return null;
  }
}

// 替代方案: 构建内置的关系模式映射
private getRelationshipQueryPatternInternal(
  relationshipType: RelationshipType,
  language: string
): string | null {
  // C语言相关关系的标准查询模式
  const patternMap: Record<string, Record<RelationshipType, string>> = {
    'c': {
      [RelationshipType.CALL]: `
        (call_expression
          function: (identifier) @caller
          arguments: (argument_list) @args) @call
      `,
      [RelationshipType.FUNCTION_REFERENCE]: `
        (function_declarator
          declarator: (identifier) @func
          parameters: (parameter_list) @params) @func_ref
      `,
      // ... 其他关系类型的模式
    },
    'javascript': {
      [RelationshipType.CALL]: `
        (call_expression
          function: (identifier) @caller) @call
      `,
      // ...
    }
  };
  
  return patternMap[language.toLowerCase()]?.[relationshipType] || null;
}
```

**注意**: 这个修复依赖于queryConfigManager的正确实现

**验证方法**:
```typescript
const pattern = processor.getRelationshipQueryPattern(
  RelationshipType.CALL,
  'c'
);
expect(pattern).not.toBeNull();  // 应该返回有效的模式
```

---

### Issue #3: 关系端点识别逻辑过于简化

**文件**: `src/service/parser/core/query/QueryResultProcessor.ts`  
**行号**: 471-491  
**严重性**: 🟡 High  
**现状**: 仅基于位置相近度识别端点，精度极低

```typescript
// ❌ 当前代码
private identifyRelationshipEndpoints(
  match: QueryMatch,
  entities: EntityQueryResult[]
): { fromNodeId?: string; toNodeId?: string } {
  const node = match.node;
  const location = this.extractLocationInfo(node);

  // 查找位置最近的实体作为端点
  const nearbyEntities = entities.filter(entity =>
    this.isLocationNearby(location, entity.location)
  );

  if (nearbyEntities.length >= 2) {
    return {
      fromNodeId: nearbyEntities[0].id,
      toNodeId: nearbyEntities[1].id
    };
  }

  return {};
}

private isLocationNearby(loc1: LocationInfo, loc2: LocationInfo, threshold: number = 10): boolean {
  return Math.abs(loc1.startLine - loc2.startLine) <= threshold;
}
```

**问题分析**:

1. **精度问题**: 10行阈值太粗糙
   - 函数可能跨越50+行
   - 会产生误配关系

2. **逻辑问题**: 仅选择前两个实体
   - 忽视了关系的语义
   - 无法处理多参数函数调用

3. **缺少上下文**: 不考虑AST结构
   - 无法区分直接调用 vs 间接引用
   - 无法识别链式调用

**修复方案**:

```typescript
// ✅ 改进版本1: 基于AST结构的识别
private identifyRelationshipEndpointsFromAST(
  match: QueryMatch,
  entities: EntityQueryResult[],
  relationshipType: RelationshipType
): { fromNodeId?: string; toNodeId?: string } {
  const node = match.node;
  
  switch (relationshipType) {
    case RelationshipType.CALL:
    case RelationshipType.METHOD_CALL:
      return this.identifyCallEndpoints(match, entities);
      
    case RelationshipType.ASSIGNMENT:
    case RelationshipType.PARAMETER_PASSING:
      return this.identifyDataFlowEndpoints(match, entities);
      
    case RelationshipType.INHERITANCE:
    case RelationshipType.COMPOSITION:
      return this.identifyInheritanceEndpoints(match, entities);
      
    default:
      return this.identifyGenericEndpoints(match, entities);
  }
}

// 调用关系: (caller) -> (callee)
private identifyCallEndpoints(
  match: QueryMatch,
  entities: EntityQueryResult[]
): { fromNodeId?: string; toNodeId?: string } {
  const node = match.node;
  
  // 从captures中提取caller和callee标识符
  const callerNode = match.captures['caller'];
  const calleeNode = match.captures['function'] || match.captures['callee'];
  
  if (!callerNode || !calleeNode) {
    return {};
  }
  
  // 查找匹配的实体
  const fromEntity = this.findEntityByNameOrNode(callerNode, entities);
  const toEntity = this.findEntityByNameOrNode(calleeNode, entities);
  
  if (!fromEntity || !toEntity) {
    // 回退: 使用启发式方法
    return this.identifyEndpointsByHeuristic(match, entities);
  }
  
  return {
    fromNodeId: fromEntity.id,
    toNodeId: toEntity.id
  };
}

// 数据流: (source) -> (target)
private identifyDataFlowEndpoints(
  match: QueryMatch,
  entities: EntityQueryResult[]
): { fromNodeId?: string; toNodeId?: string } {
  const sourceNode = match.captures['source'] || match.captures['left'];
  const targetNode = match.captures['target'] || match.captures['right'];
  
  if (!sourceNode || !targetNode) {
    return {};
  }
  
  const sourceEntity = this.findEntityByNameOrNode(sourceNode, entities);
  const targetEntity = this.findEntityByNameOrNode(targetNode, entities);
  
  return {
    fromNodeId: sourceEntity?.id,
    toNodeId: targetEntity?.id
  };
}

// 继承关系: (parent) <- (child)
private identifyInheritanceEndpoints(
  match: QueryMatch,
  entities: EntityQueryResult[]
): { fromNodeId?: string; toNodeId?: string } {
  const parentNode = match.captures['parent'] || match.captures['base'];
  const childNode = match.captures['child'] || match.captures['derived'];
  
  // 继承关系是反向的: parent -> child
  const parentEntity = parentNode ? this.findEntityByNameOrNode(parentNode, entities) : null;
  const childEntity = childNode ? this.findEntityByNameOrNode(childNode, entities) : null;
  
  return {
    fromNodeId: parentEntity?.id,
    toNodeId: childEntity?.id
  };
}

// 通用启发式方法
private identifyEndpointsByHeuristic(
  match: QueryMatch,
  entities: EntityQueryResult[]
): { fromNodeId?: string; toNodeId?: string } {
  const location = this.extractLocationInfo(match.node);
  
  // 查找所有在此位置的实体
  const relatedEntities = entities.filter(entity => {
    // 实体应该包含这个位置
    return entity.location.startLine <= location.startLine &&
           entity.location.endLine >= location.endLine;
  });
  
  if (relatedEntities.length >= 2) {
    // 排序: 最内层的首先
    relatedEntities.sort((a, b) => 
      (b.location.endLine - b.location.startLine) - 
      (a.location.endLine - a.location.startLine)
    );
    
    return {
      fromNodeId: relatedEntities[0].id,
      toNodeId: relatedEntities[1].id
    };
  }
  
  return {};
}

// 辅助方法: 根据节点查找实体
private findEntityByNameOrNode(
  node: Parser.SyntaxNode,
  entities: EntityQueryResult[]
): EntityQueryResult | null {
  const nodeName = node.text;
  
  // 精确匹配实体名称
  const exactMatch = entities.find(e => e.name === nodeName);
  if (exactMatch) return exactMatch;
  
  // 模糊匹配 (处理修饰符等)
  const fuzzyMatch = entities.find(e => 
    nodeName.includes(e.name) || e.name.includes(nodeName)
  );
  if (fuzzyMatch) return fuzzyMatch;
  
  return null;
}
```

**验证方法**:
```typescript
// 应该能够识别函数调用关系
const match: QueryMatch = {
  node: callExprNode,
  captures: {
    'caller': callerNode,
    'function': functionNode
  },
  location: { /* ... */ }
};

const result = processor.identifyCallEndpoints(match, entities);
expect(result.fromNodeId).toBeDefined();
expect(result.toNodeId).toBeDefined();
```

---

### Issue #4: executeQueryPattern 中硬编码语言参数

**文件**: `src/service/parser/core/query/TreeSitterQueryExecutor.ts`  
**行号**: 525  
**严重性**: 🟡 Medium  
**现状**: 硬编码 'c' 作为语言

```typescript
// ❌ 当前代码
private async executeQueryPattern(
  ast: Parser.SyntaxNode,
  pattern: string
): Promise<QueryMatch[]> {
  try {
    // 获取语言对象
    const languageObj = await this.getLanguageObject('c'); // 硬编码！
    if (!languageObj) {
      return [];
    }
    // ...
  }
}
```

**问题**:
- 只能执行C语言查询
- 对于JavaScript、Python等无法工作
- 违反设计的多语言支持目标

**修复方案**:

```typescript
// ✅ 修复版本
private async executeQueryPattern(
  ast: Parser.SyntaxNode,
  pattern: string,
  language: string = 'c'  // 添加默认参数
): Promise<QueryMatch[]> {
  try {
    // 从AST中尽可能获取语言信息
    const lang = language || (ast as any).language?.name || 'c';
    
    const languageObj = await this.getLanguageObject(lang);
    if (!languageObj) {
      this.logger.warn(`无法获取语言对象: ${lang}`);
      return [];
    }

    const query = QueryCache.getQuery(languageObj, pattern);
    const matches = query.matches(ast);

    return matches.map(match => ({
      node: match.captures[0]?.node || ast,
      captures: match.captures.reduce((acc, capture) => {
        acc[capture.name] = capture.node;
        return acc;
      }, {} as Record<string, Parser.SyntaxNode>),
      location: this.getNodeLocation(match.captures[0]?.node)
    }));
  } catch (error) {
    this.logger.error('查询执行失败:', error);
    return [];
  }
}

// 更新调用处: 传递language参数
private async executeQueryForType(
  ast: Parser.SyntaxNode,
  queryType: string,
  language: string,
  filePath: string
): Promise<EntityQueryResult[]> {
  // ...
  const matches = await this.executeQueryPattern(ast, pattern, language);
  // ...
}
```

---

### Issue #5: 语言工厂初始化未验证

**文件**: `src/service/parser/core/query/TreeSitterQueryExecutor.ts`  
**行号**: 68-69, 81-93  
**严重性**: 🟡 Medium  
**现状**: 初始化后无法验证工厂是否正确注册

```typescript
// ❌ 当前代码
constructor() {
  initializeLanguageFactories();  // 调用但无验证
  
  this.resultProcessor = new QueryResultProcessor();
  this.entityRegistry = EntityTypeRegistry.getInstance();
  this.relationshipRegistry = RelationshipTypeRegistry.getInstance();
  
  this.initialize();  // 异步初始化
}

private async initialize(): Promise<void> {
  try {
    const success = await QueryRegistryImpl.initialize();
    if (success) {
      this.initialized = true;
      // 但是没有检查工厂是否注册成功
    }
  }
}
```

**问题**:
- 无法确认工厂注册成功
- 如果工厂为空，会悄默地降级到通用实现
- 没有错误报告机制

**修复方案**:

```typescript
// ✅ 改进版本
constructor() {
  // 同步初始化语言工厂
  const factoriesInitialized = this.initializeLanguageFactoriesSync();
  if (!factoriesInitialized) {
    this.logger.warn('某些语言工厂初始化失败，将使用通用实现');
  }
  
  this.resultProcessor = new QueryResultProcessor();
  this.entityRegistry = EntityTypeRegistry.getInstance();
  this.relationshipRegistry = RelationshipTypeRegistry.getInstance();
  
  // 异步初始化查询注册表
  this.initialize();
}

private initializeLanguageFactoriesSync(): boolean {
  try {
    initializeLanguageFactories();
    
    // 验证关键工厂是否注册
    const criticalLanguages = ['c', 'cpp', 'typescript', 'python'];
    const registry = EntityTypeRegistry.getInstance();
    
    const registeredLanguages = registry.getRegisteredLanguages();
    const missingLanguages = criticalLanguages.filter(
      lang => !registeredLanguages.includes(lang)
    );
    
    if (missingLanguages.length > 0) {
      this.logger.warn(
        `警告: 以下语言的工厂未注册: ${missingLanguages.join(', ')}`
      );
      return false;
    }
    
    this.logger.info(`成功初始化 ${registeredLanguages.length} 个语言工厂`);
    return true;
  } catch (error) {
    this.logger.error('初始化语言工厂失败:', error);
    return false;
  }
}

private async initialize(): Promise<void> {
  try {
    const success = await QueryRegistryImpl.initialize();
    
    if (success) {
      this.initialized = true;
      this.logger.info('TreeSitterQueryEngine 初始化完成');
    } else {
      this.logger.warn('QueryRegistryImpl 初始化失败');
      // 但继续运行，使用备用方案
      this.initialized = true;  // 标记为初始化完成，但可能功能受限
    }
  } catch (error) {
    this.logger.error('异步初始化失败:', error);
    // 仍然标记为初始化完成以避免无限重试
    this.initialized = true;
  }
}
```

**验证方法**:
```typescript
const engine = new TreeSitterQueryEngine();
const registeredLanguages = EntityTypeRegistry.getInstance().getRegisteredLanguages();
expect(registeredLanguages.length).toBeGreaterThan(0);
expect(registeredLanguages).toContain('c');
```

---

## 修复优先级和时间估算

| Issue | 优先级 | 工作量 | 依赖 | 难度 |
|-------|--------|--------|------|------|
| #1: executeRelationshipQuery | P0 🔴 | 2h | QueryRegistry | 中 |
| #2: getRelationshipQueryPattern | P0 🔴 | 1.5h | queryConfigManager | 低 |
| #3: identifyRelationshipEndpoints | P0 🔴 | 3h | AST知识 | 高 |
| #4: 硬编码语言参数 | P1 🟡 | 1h | #1 | 低 |
| #5: 工厂初始化验证 | P1 🟡 | 1.5h | 无 | 低 |

**总计**: ~9小时

---

## 测试计划

### 单元测试
```typescript
describe('QueryResultProcessor', () => {
  describe('executeRelationshipQuery', () => {
    it('should return non-empty matches for valid pattern', async () => {
      // Test that actual query execution works
    });
    
    it('should handle null pattern gracefully', async () => {
      // Test error handling
    });
  });
  
  describe('identifyRelationshipEndpoints', () => {
    it('should correctly identify call endpoints', () => {
      // Test call relationship identification
    });
    
    it('should handle cross-file relationships', () => {
      // Test distance relationships
    });
  });
});
```

### 集成测试
```typescript
describe('TreeSitterQueryEngine - Relationships', () => {
  it('should execute complete relationship query pipeline', async () => {
    const result = await engine.executeRelationshipQuery(
      ast,
      RelationshipType.CALL,
      'c'
    );
    
    expect(result.length).toBeGreaterThan(0);
    result.forEach(rel => {
      expect(rel.fromNodeId).toBeDefined();
      expect(rel.toNodeId).toBeDefined();
    });
  });
});
```

