# 关系提取器通用工具模块

## 概述

此模块提供了一组通用的基类和工具函数，用于减少各种关系提取器中的代码重复。这些工具封装了关系提取的常见模式，包括：

- 通用的元数据提取逻辑
- 关系数组提取的通用方法
- 节点ID生成
- 位置信息处理
- 错误处理和空值检查

## 核心组件

### BaseRelationshipExtractor

通用关系提取器基类，提供了以下核心方法：

- `extractRelationshipMetadata()` - 通用的元数据提取方法
- `extractRelationships()` - 通用的关系数组提取方法
- `extractNameFromNode()` - 从节点提取名称
- `generateNodeId()` - 生成节点ID
- `hasChildOfType()` - 检查节点是否包含指定类型的子节点
- `findChildNodesOfType()` - 遍历节点查找指定类型

### RelationshipExtractorUtils

提供静态工具方法：

- `findParentOfType()` - 查找指定类型的父节点
- `extractNodeText()` - 提取节点文本
- `isNodeType()` - 检查节点类型
- `getChildNode()` - 安全获取子节点
- `extractAllChildTexts()` - 提取所有子节点文本

## 使用方法

### 继承 BaseRelationshipExtractor

```typescript
import { BaseRelationshipExtractor, RelationshipMetadata } from './utils';

export class MyRelationshipExtractor extends BaseRelationshipExtractor {
  extractMyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    // 实现特定的元数据提取逻辑
    const specificData = this.extractSpecificData(astNode);
    
    if (!specificData) {
      return null;
    }
    
    return this.extractRelationshipMetadata(
      result,
      astNode,
      symbolTable,
      'my-relationship-type',
      (node: Parser.SyntaxNode) => {
        // 提取特定元数据
        return {
          toNodeId: this.generateNodeId(node, 'target'),
          mySpecificField: specificData
        };
      }
    );
  }

  extractMyRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isMyRelationshipNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) => 
        this.extractMyMetadata(result, astNode, symbolTable)
    );
  }
  
  private extractSpecificData(node: Parser.SyntaxNode): any {
    // 实现特定数据提取逻辑
    return {};
  }
  
  private isMyRelationshipNode(node: Parser.SyntaxNode): boolean {
    // 实现节点类型检查逻辑
    return node.type === 'my_node_type';
  }
}
```

### 使用 RelationshipExtractorUtils

```typescript
import { RelationshipExtractorUtils } from './utils';

// 查找父节点
const parentFunction = RelationshipExtractorUtils.findParentOfType(astNode, ['function_definition']);

// 提取节点文本
const nodeName = RelationshipExtractorUtils.extractNodeText(astNode, ['name', 'identifier']);

// 检查节点类型
const isCallExpression = RelationshipExtractorUtils.isNodeType(astNode, ['call_expression']);
```

## 优势

1. **减少代码重复** - 通用逻辑在基类中实现，避免在每个关系提取器中重复编写
2. **提高一致性** - 所有关系提取器遵循相同的结构和错误处理模式
3. **易于维护** - 通用逻辑的修改只需在基类中进行
4. **简化扩展** - 新的关系提取器只需实现特定逻辑，无需处理通用流程