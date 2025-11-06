import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言数据流关系提取器
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 简化的数据流提取
    const left = astNode.childForFieldName('left');
    const right = astNode.childForFieldName('right');

    if (!left || !right) {
      return null;
    }

    const flowType = this.determineFlowType(astNode);
    const dataType = this.extractDataType(astNode);
    const flowPath = this.buildFlowPath(left, right);

    return {
      type: 'data-flow',
      fromNodeId: generateDeterministicNodeId(right),
      toNodeId: generateDeterministicNodeId(left),
      flowType,
      dataType,
      flowPath,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取数据流关系数组
   */
  extractDataFlowRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为数据流相关的节点类型
    if (!this.isDataFlowNode(astNode)) {
      return relationships;
    }

    const dataFlowMetadata = this.extractDataFlowMetadata(result, astNode, null);
    if (dataFlowMetadata) {
      relationships.push(dataFlowMetadata);
    }

    return relationships;
  }

  /**
   * 确定数据流类型
   */
  private determineFlowType(astNode: Parser.SyntaxNode): 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' {
    const nodeType = astNode.type;

    if (nodeType === 'assignment_expression') {
      return 'variable_assignment';
    } else if (nodeType === 'parameter_declaration') {
      return 'parameter_passing';
    } else if (nodeType === 'return_statement') {
      return 'return_value';
    } else if (nodeType === 'field_expression') {
      return 'field_access';
    }

    return 'variable_assignment';
  }

  /**
   * 提取数据类型
   */
  private extractDataType(astNode: Parser.SyntaxNode): string | undefined {
    // 尝试从类型声明中提取数据类型
    const typeNode = astNode.childForFieldName('type');
    if (typeNode) {
      return typeNode.text;
    }

    // 对于赋值表达式，尝试从左侧获取类型
    const left = astNode.childForFieldName('left');
    if (left) {
      const leftType = left.childForFieldName('type');
      if (leftType) {
        return leftType.text;
      }
    }

    return undefined;
  }

  /**
   * 构建数据流路径
   */
  private buildFlowPath(fromNode: Parser.SyntaxNode, toNode: Parser.SyntaxNode): string[] {
    const path: string[] = [];

    // 添加源节点
    path.push(fromNode.text || 'unknown');

    // 如果有中间节点，添加到路径中
    // 这里可以根据实际需要扩展更复杂的路径分析

    // 添加目标节点
    path.push(toNode.text || 'unknown');

    return path;
  }

  /**
   * 判断是否为数据流节点
   */
  private isDataFlowNode(astNode: Parser.SyntaxNode): boolean {
    const dataFlowNodeTypes = [
      'assignment_expression',
      'parameter_declaration',
      'return_statement',
      'field_expression',
      'init_declarator'
    ];

    return dataFlowNodeTypes.includes(astNode.type);
  }
}