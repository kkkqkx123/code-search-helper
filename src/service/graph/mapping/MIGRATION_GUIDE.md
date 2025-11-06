# ILanguageRelationshipExtractor 迁移指南

## 概述

本文档描述了从 `ILanguageRelationshipExtractor` 接口到新的标准化模块和关系元数据处理器的迁移过程。

## 弃用说明

`ILanguageRelationshipExtractor` 接口已被弃用，所有关系提取功能现在通过以下组件处理：

1. **标准化模块** (`StandardizedQueryResult`)
2. **关系元数据处理器** (`IRelationshipMetadataProcessor`)
3. **图数据映射服务** (`GraphDataMappingService`)

## 迁移步骤

### 1. 移除旧的接口依赖

**之前：**
```typescript
import { ILanguageRelationshipExtractor } from './interfaces/IRelationshipExtractor';

const extractor = factory.getExtractor('javascript');
const relationships = await extractor.extractCallRelationships(ast, filePath, symbolResolver);
```

**现在：**
```typescript
import { CallRelationshipProcessor } from './interfaces/IRelationshipMetadataProcessor';
import { StandardizedQueryResult } from '../../parser/core/normalization/types';

const processor = new CallRelationshipProcessor();
const callNodes = standardizedNodes.filter(node => node.type === 'call');
const relationships = callNodes.map(node => processor.processMetadata(node.metadata.extra));
```

### 2. 使用新的关系元数据处理器

每个关系类型都有对应的处理器：

- `CallRelationshipProcessor` - 处理调用关系
- `InheritanceRelationshipProcessor` - 处理继承关系
- `DependencyRelationshipProcessor` - 处理依赖关系
- `ReferenceRelationshipProcessor` - 处理引用关系
- `CreationRelationshipProcessor` - 处理创建关系
- `AnnotationRelationshipProcessor` - 处理注解关系
- `DataFlowRelationshipProcessor` - 处理数据流关系
- `ControlFlowRelationshipProcessor` - 处理控制流关系
- `SemanticRelationshipProcessor` - 处理语义关系
- `LifecycleRelationshipProcessor` - 处理生命周期关系
- `ConcurrencyRelationshipProcessor` - 处理并发关系
- `ImplementsRelationshipProcessor` - 处理实现关系

### 3. 集成GraphDataMappingService

**之前：**
```typescript
const extractor = factory.getExtractor(language);
const result = await extractor.extractCallRelationships(ast, filePath, symbolResolver);
```

**现在：**
```typescript
const graphResult = await graphMappingService.mapToGraph(filePath, standardizedNodes);
// graphResult.nodes 包含所有节点
// graphResult.edges 包含所有关系
```

## 新架构优势

1. **统一的数据格式**：所有关系都使用 `StandardizedQueryResult` 格式
2. **模块化处理**：每种关系类型有专门的处理器
3. **更好的缓存**：支持统一缓存机制
4. **容错性**：内置错误处理和重试机制
5. **性能优化**：批量处理和并发控制

## 代码示例

### 处理调用关系

```typescript
import { CallRelationshipProcessor } from './interfaces/IRelationshipMetadataProcessor';

const processor = new CallRelationshipProcessor();
const callNodes = standardizedNodes.filter(node => node.type === 'call');

for (const callNode of callNodes) {
  const relationshipData = callNode.metadata.extra;
  if (relationshipData) {
    const processedData = processor.processMetadata(relationshipData);
    if (processedData) {
      console.log('Call relationship:', {
        sourceNodeId: processedData.sourceNodeId,
        targetNodeId: processedData.targetNodeId,
        callName: processedData.properties.callName
      });
    }
  }
}
```

### 处理继承关系

```typescript
import { InheritanceRelationshipProcessor } from './interfaces/IRelationshipMetadataProcessor';

const processor = new InheritanceRelationshipProcessor();
const inheritanceNodes = standardizedNodes.filter(node => node.type === 'inheritance');

for (const inheritanceNode of inheritanceNodes) {
  const relationshipData = inheritanceNode.metadata.extra;
  if (relationshipData) {
    const processedData = processor.processMetadata(relationshipData);
    if (processedData) {
      console.log('Inheritance relationship:', {
        sourceNodeId: processedData.sourceNodeId,
        targetNodeId: processedData.targetNodeId,
        inheritanceType: processedData.properties.inheritanceType
      });
    }
  }
}
```

### 完整的图映射示例

```typescript
import { GraphDataMappingService } from './GraphDataMappingService';
import { StandardizedQueryResult } from '../../parser/core/normalization/types';

async function processFile(filePath: string, standardizedNodes: StandardizedQueryResult[]) {
  const graphResult = await graphMappingService.mapToGraph(filePath, standardizedNodes);
  
  console.log(`Processed ${filePath}:`);
  console.log(`- Nodes: ${graphResult.nodes.length}`);
  console.log(`- Edges: ${graphResult.edges.length}`);
  
  return graphResult;
}
```

## 向后兼容性

为了确保向后兼容性，以下类和方法仍然保留但已标记为弃用：

- `RelationshipExtractorFactory` - 返回 null 并记录警告
- `BatchRelationshipProcessor` - 使用标准化模块但保持接口兼容
- `SemanticRelationshipExtractor` - 移除了弃用方法，保留新方法

## 测试迁移

运行以下命令测试迁移后的功能：

```bash
# 测试图映射服务
npm test src/service/graph/mapping/GraphDataMappingService.test.ts

# 测试关系处理器
npm test src/service/graph/mapping/interfaces/IRelationshipMetadataProcessor.test.ts

# 集成测试
npm test src/__tests__/integration/service-integration.test.ts
```

## 故障排除

### 常见问题

1. **找不到关系处理器**
   - 确保导入了正确的处理器类
   - 检查关系类型名称是否正确

2. **标准化节点格式错误**
   - 确保 `StandardizedQueryResult` 格式正确
   - 检查 `metadata.extra` 字段是否存在

3. **图映射失败**
   - 检查文件路径是否正确
   - 确保标准化节点数据完整

### 调试技巧

1. 启用详细日志：
   ```typescript
   logger.setLevel('debug');
   ```

2. 检查标准化节点：
   ```typescript
   console.log('Standardized nodes:', JSON.stringify(standardizedNodes, null, 2));
   ```

3. 验证关系处理器输出：
   ```typescript
   const processor = new CallRelationshipProcessor();
   const result = processor.processMetadata(relationshipData);
   console.log('Processed result:', result);
   ```

## 总结

迁移到新架构后，代码将更加模块化、可维护，并且具有更好的性能。新的关系元数据处理器提供了更灵活的方式来处理各种类型的关系，同时保持了向后兼容性。

如有疑问，请参考示例代码 `src/service/graph/mapping/examples/RelationshipProcessorExample.ts`。