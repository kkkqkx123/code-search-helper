import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++ 数据流关系提取器
 * 从 CRelationshipExtractor/DataFlowExtractor.ts 迁移
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 从CRelationshipExtractor/DataFlowExtractor.ts迁移
    const left = astNode.childForFieldName('left');
    const right = astNode.childForFieldName('right');

    return {
      type: 'data-flow',
      fromNodeId: right ? generateDeterministicNodeId(right) : 'unknown',
      toNodeId: left ? generateDeterministicNodeId(left) : 'unknown',
      flowType: 'variable_assignment',
      dataType: 'variable',
      flowPath: [right?.text || 'unknown', left?.text || 'unknown'],
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取数据流关系
   */
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取赋值关系
    if (mainNode.type === 'assignment_expression') {
      const leftNode = mainNode.childForFieldName('left');
      const rightNode = mainNode.childForFieldName('right');
      if (leftNode?.text && rightNode?.text) {
        relationships.push({
          source: rightNode.text,
          target: leftNode.text,
          type: 'assignment'
        });
      }
    }

    // 提取参数传递关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      const argsNode = mainNode.childForFieldName('arguments');

      if (funcNode?.text && argsNode) {
        for (const arg of argsNode.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: funcNode.text,
              type: 'parameter'
            });
          }
        }
      }
    }

    // 提取返回值关系
    if (mainNode.type === 'return_statement') {
      const valueNode = mainNode.children?.find((child: any) => child.type === 'identifier');
      if (valueNode?.text) {
        relationships.push({
          source: valueNode.text,
          target: 'function_return',
          type: 'return'
        });
      }
    }

    // 提取智能指针关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      if (funcNode?.text && (funcNode.text.includes('make_unique') || funcNode.text.includes('make_shared'))) {
        const argsNode = mainNode.childForFieldName('arguments');
        if (argsNode) {
          for (const arg of argsNode.children || []) {
            if (arg.type === 'identifier' && arg.text) {
              relationships.push({
                source: arg.text,
                target: funcNode.text,
                type: 'assignment'
              });
            }
          }
        }
      }
    }

    return relationships;
  }
}