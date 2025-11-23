import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';

/**
 * C语言调用关系提取器
 */
export class CallRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const functionNode = astNode.childForFieldName('function');
    const callerNode = CHelperMethods.findCallerFunctionContext(astNode);
    const calleeName = CHelperMethods.extractCalleeName(astNode);
    const callContext = CHelperMethods.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: functionNode ? NodeIdGenerator.forAstNode(functionNode) : 'unknown',
      callName: calleeName || 'unknown',
      callType: CHelperMethods.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath,
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取调用关系数组
   */
  extractCallRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => node.type === 'call_expression',
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractCallMetadata(result, astNode, symbolTable)
    );
  }
}