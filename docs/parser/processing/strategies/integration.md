## 与 core/parse 目录的兼容性分析

### 1. 数据流兼容性

#### 1.1 当前数据流
```mermaid
graph TD
    A[ParserFacade] --> B[ParserQueryService]
    B --> C[EntityQueryResult[]]
    B --> D[RelationshipQueryResult[]]
    E[ASTCodeSplitter] --> F[UnifiedContentAnalyzer]
    F --> G[ExtractionResult]
    G --> H[topLevelStructures[]]
    G --> I[nestedStructures[]]
```

#### 1.2 数据格式差异

**ParserQueryService 输出格式**:
```typescript
interface EntityQueryResult {
  type: 'entity'
  node: Parser.SyntaxNode
  metadata: QueryMetadata
  captures: Array<{ name: string; node: Parser.SyntaxNode }>
  name?: string
  properties?: Record<string, any>
}

interface RelationshipQueryResult {
  type: 'relationship'
  node: Parser.SyntaxNode
  metadata: QueryMetadata
  captures: Array<{ name: string; node: Parser.SyntaxNode }>
  from?: string
  to?: string
  direction?: 'from_to' | 'bidirectional' | 'weighted'
  properties?: Record<string, any>
}
```

**ASTCodeSplitter 期望的输入格式**:
```typescript
interface ExtractionResult {
  topLevelStructures: Structure[]
  nestedStructures: Structure[]
  stats: {
    totalStructures: number
  }
}

interface Structure {
  type: string
  content: string
  location: {
    startLine: number
    endLine: number
  }
  name?: string
  level?: number
  metadata?: any
}
```

### 2. 兼容性评估

#### 2.1 直接兼容性 ❌
ASTCodeSplitter **不能直接处理** core/parse 目录提供的查询结果，原因如下：

1. **数据结构不匹配**:
   - ParserQueryService 返回的是 `EntityQueryResult[]` 和 `RelationshipQueryResult[]`
   - ASTCodeSplitter 期望的是 `ExtractionResult` 格式

2. **接口依赖不同**:
   - ASTCodeSplitter 依赖 `UnifiedContentAnalyzer.extractAllStructures()` 方法
   - core/parse 提供的是 `ParserQueryService` 的各种查询方法

3. **数据抽象层级不同**:
   - core/parse 返回的是原始 AST 节点和查询元数据
   - ASTCodeSplitter 需要的是经过处理的结构化数据

#### 2.2 间接兼容性 ⚠️
虽然不能直接处理，但可以通过数据转换实现兼容性。

### 3. 需要的数据转换

#### 3.1 转换器设计

需要创建一个 `QueryResultToStructureConverter` 转换器：

```typescript
class QueryResultToStructureConverter {
  /**
   * 将 EntityQueryResult 转换为 Structure
   */
  convertEntityToStructure(entity: EntityQueryResult): Structure {
    return {
      type: this.mapQueryCategoryToStructureType(entity.metadata.category),
      content: this.extractContentFromNode(entity.node),
      location: this.extractLocationFromNode(entity.node),
      name: entity.name,
      metadata: {
        priority: entity.metadata.priority,
        category: entity.metadata.category,
        captures: entity.captures
      }
    }
  }

  /**
   * 将 RelationshipQueryResult 转换为 Structure
   */
  convertRelationshipToStructure(relationship: RelationshipQueryResult): Structure {
    return {
      type: this.mapQueryCategoryToStructureType(relationship.metadata.category),
      content: this.extractContentFromNode(relationship.node),
      location: this.extractLocationFromNode(relationship.node),
      metadata: {
        priority: relationship.metadata.priority,
        category: relationship.metadata.category,
        direction: relationship.direction,
        from: relationship.from,
        to: relationship.to
      }
    }
  }

  /**
   * 批量转换查询结果
   */
  convertQueryResults(
    entities: EntityQueryResults,
    relationships: RelationshipQueryResults
  ): ExtractionResult {
    const topLevelStructures: Structure[] = []
    const nestedStructures: Structure[] = []

    // 转换实体
    Object.values(entities).forEach(entityArray => {
      entityArray.forEach(entity => {
        const structure = this.convertEntityToStructure(entity)
        if (this.isTopLevel(entity)) {
          topLevelStructures.push(structure)
        } else {
          nestedStructures.push(structure)
        }
      })
    })

    // 转换关系
    Object.values(relationships).forEach(relationshipArray => {
      relationshipArray.forEach(relationship => {
        const structure = this.convertRelationshipToStructure(relationship)
        nestedStructures.push(structure) // 关系通常视为嵌套结构
      })
    })

    return {
      topLevelStructures,
      nestedStructures,
      stats: {
        totalStructures: topLevelStructures.length + nestedStructures.length
      }
    }
  }
}
```

#### 3.2 类型映射

需要建立查询类别到结构类型的映射：

```typescript
private mapQueryCategoryToStructureType(category: string): string {
  const mapping: Record<string, string> = {
    // 实体类型映射
    'function': 'function',
    'struct': 'class',
    'class': 'class',
    'enum': 'enum',
    'union': 'union',
    'type': 'type',
    'variable': 'variable',
    'macro': 'macro',
    'array': 'array',
    'pointer': 'pointer',
    
    // 关系类型映射
    'call': 'call',
    'control_flow': 'control-flow',
    'data_flow': 'data-flow',
    'dependency': 'dependency',
    'inheritance': 'inheritance',
    
    // 其他类型
    'comment': 'comment',
    'annotation': 'annotation'
  }
  
  return mapping[category] || 'generic'
}
```

#### 3.3 内容提取

需要从 AST 节点提取内容：

```typescript
private extractContentFromNode(node: Parser.SyntaxNode): string {
  // 使用 Tree-sitter 节点的 text 属性
  return node.text || ''
}

private extractLocationFromNode(node: Parser.SyntaxNode): { startLine: number; endLine: number } {
  return {
    startLine: node.startPosition.row + 1, // 转换为1基索引
    endLine: node.endPosition.row + 1
  }
}
```

### 4. 集成方案

#### 4.1 方案一：适配器模式

创建一个 `UnifiedContentAnalyzerAdapter`：

```typescript
class UnifiedContentAnalyzerAdapter {
  constructor(
    private parserFacade: ParserFacade,
    private converter: QueryResultToStructureConverter
  ) {}

  async extractAllStructures(
    content: string,
    language: string,
    options: any
  ): Promise<ExtractionResult> {
    // 1. 使用 ParserFacade 解析代码
    const ast = await this.parserFacade.parseCode(content, language)
    
    // 2. 查询所有实体和关系
    const [entities, relationships] = await Promise.all([
      this.parserFacade.findAllEntities(ast, language, options),
      this.parserFacade.findAllRelationships(ast, language, options)
    ])
    
    // 3. 转换为期望的格式
    return this.converter.convertQueryResults(entities, relationships)
  }
}
```

#### 4.2 方案二：修改 ASTCodeSplitter

直接修改 ASTCodeSplitter 以支持多种数据源：

```typescript
class ASTCodeSplitter {
  constructor(
    // ... 现有依赖
    @inject(TYPES.ParserFacade) private parserFacade?: ParserFacade,
    @inject(TYPES.QueryResultConverter) private queryResultConverter?: QueryResultToStructureConverter
  ) {}

  async split(content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    // 检查是否有可用的 ParserFacade
    if (this.parserFacade && this.queryResultConverter) {
      return this.splitWithParserFacade(content, filePath, language)
    } else {
      return this.splitWithUnifiedAnalyzer(content, filePath, language)
    }
  }

  private async splitWithParserFacade(content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    // 使用 ParserFacade 进行解析和查询
    const ast = await this.parserFacade.parseCode(content, language)
    const [entities, relationships] = await Promise.all([
      this.parserFacade.findAllEntities(ast, language),
      this.parserFacade.findAllRelationships(ast, language)
    ])
    
    // 转换查询结果
    const extractionResult = this.queryResultConverter.convertQueryResults(entities, relationships)
    
    // 继续现有的处理流程
    return this.processExtractionResult(extractionResult, content, filePath, language)
  }
}
```

### 5. 推荐方案

#### 5.1 短期方案：适配器模式
- **优点**: 最小化对现有代码的修改
- **缺点**: 增加了一层抽象，可能影响性能
- **适用场景**: 快速集成，保持现有架构稳定

#### 5.2 长期方案：统一接口
- **优点**: 更好的性能和可维护性
- **缺点**: 需要更多开发工作
- **适用场景**: 系统重构，优化整体架构

### 6. 实施建议

1. **创建转换器**: 实现 `QueryResultToStructureConverter`
2. **开发适配器**: 创建 `UnifiedContentAnalyzerAdapter`
3. **渐进式集成**: 先在测试环境验证兼容性
4. **性能测试**: 确保转换不会显著影响性能
5. **文档更新**: 更新相关文档说明新的集成方式

### 7. 总结

ASTCodeSplitter 与 core/parse 目录的查询结果**不直接兼容**，但通过适当的数据转换可以实现集成。主要挑战在于数据格式的差异和接口依赖的不同。建议采用适配器模式作为短期解决方案，同时考虑长期统一接口的设计。