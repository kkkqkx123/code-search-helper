import { CppHelperMethods } from './CppHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C++ 数据流关系提取器
 * 从 CRelationshipExtractor/DataFlowExtractor.ts 迁移
 */
export class DataFlowRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const flowType = CppHelperMethods.determineDataFlowType(astNode);
    const sourceNode = CppHelperMethods.extractDataFlowSource(astNode);
    const targetNode = CppHelperMethods.extractDataFlowTarget(astNode);

    return {
      type: 'data-flow',
      fromNodeId: sourceNode ? CppHelperMethods.generateNodeId(sourceNode) : 'unknown',
      toNodeId: targetNode ? CppHelperMethods.generateNodeId(targetNode) : 'unknown',
      flowType,
      dataType: 'variable',
      flowPath: [sourceNode?.text || 'unknown', targetNode?.text || 'unknown'],
      location: CppHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取数据流关系数组
   */
  extractDataFlowRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CppHelperMethods.isDataFlowNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractDataFlowMetadata(result, astNode, symbolTable)
    );
  }
}