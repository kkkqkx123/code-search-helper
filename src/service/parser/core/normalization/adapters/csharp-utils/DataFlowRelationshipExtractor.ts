import { CSharpHelperMethods } from './CSharpHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C# 数据流关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class DataFlowRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const flowType = CSharpHelperMethods.determineDataFlowType(astNode);
    const sourceNode = CSharpHelperMethods.extractDataFlowSource(astNode);
    const targetNode = CSharpHelperMethods.extractDataFlowTarget(astNode);
    const flowPath = this.extractFlowPath(astNode);
    const dataType = this.extractDataType(astNode);

    return {
      type: 'data-flow',
      fromNodeId: sourceNode ? CSharpHelperMethods.generateNodeId(sourceNode) : 'unknown',
      toNodeId: targetNode ? CSharpHelperMethods.generateNodeId(targetNode) : 'unknown',
      flowType,
      flowPath,
      dataType,
      location: CSharpHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取数据流关系数组
   */
  extractDataFlowRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CSharpHelperMethods.isDataFlowNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractDataFlowMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 提取数据流路径
   */
  private extractFlowPath(node: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    let current: Parser.SyntaxNode | null = node;

    while (current) {
      if (current.type === 'identifier' || current.type === 'member_access_expression') {
        path.unshift(current.text);
      }
      current = current.parent;
    }

    return path;
  }

  /**
   * 提取数据类型
   */
  private extractDataType(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取类型信息
    switch (node.type) {
      case 'assignment_expression':
        const left = node.childForFieldName('left');
        if (left) {
          // 尝试从变量声明中获取类型
          const declaration = left.parent as Parser.SyntaxNode | null;
          if (declaration?.type === 'variable_declaration') {
            const typeNode = declaration.childForFieldName('type') as any;
            return typeNode?.text || null;
          }
        }
        break;
      case 'parameter':
        const typeNode = node.childForFieldName('type') as any;
        return typeNode ? typeNode.text : null;
      case 'property_declaration':
        const propertyType = node.childForFieldName('type') as any;
        return propertyType ? propertyType.text : null;
    }

    return null;
  }

  /**
   * 分析LINQ数据流
   */
  analyzeLinqDataFlow(node: Parser.SyntaxNode): Array<{
    source: string;
    target: string;
    type: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering';
    }> = [];

    if (!CSharpHelperMethods.isLinqExpression(node)) {
      return relationships;
    }

    // 分析LINQ子句
    for (const child of node.children) {
      let linqType: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering' | null = null;

      switch (child.type) {
        case 'from_clause':
          linqType = 'linq_transformation';
          break;
        case 'where_clause':
          linqType = 'linq_filtering';
          break;
        case 'select_clause':
          linqType = 'linq_projection';
          break;
        case 'group_clause':
          linqType = 'linq_grouping';
          break;
        case 'order_by_clause':
          linqType = 'linq_ordering';
          break;
      }

      if (linqType) {
        const source = this.extractLinqSource(child);
        const target = this.extractLinqTarget(child);

        if (source && target) {
          relationships.push({
            source,
            target,
            type: linqType
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 提取LINQ源
   */
  private extractLinqSource(node: Parser.SyntaxNode): string | null {
    // 根据LINQ子句类型提取源
    switch (node.type) {
      case 'from_clause':
        const fromExpression = node.childForFieldName('expression');
        return fromExpression?.text || null;
      case 'where_clause':
      case 'select_clause':
      case 'group_clause':
      case 'order_by_clause':
        // 这些子句的源是前一个子句的结果
        return 'previous_linq_result';
      default:
        return null;
    }
  }

  /**
   * 提取LINQ目标
   */
  private extractLinqTarget(node: Parser.SyntaxNode): string | null {
    // 根据LINQ子句类型提取目标
    switch (node.type) {
      case 'from_clause':
        const identifier = node.childForFieldName('identifier');
        return identifier?.text || null;
      case 'where_clause':
        const condition = node.childForFieldName('condition');
        return condition?.text || null;
      case 'select_clause':
        const expression = node.childForFieldName('expression');
        return expression?.text || null;
      case 'group_clause':
        const groupExpression = node.childForFieldName('group_expression');
        return groupExpression?.text || null;
      case 'order_by_clause':
        const ordering = node.childForFieldName('ordering');
        return ordering?.text || null;
      default:
        return null;
    }
  }
}