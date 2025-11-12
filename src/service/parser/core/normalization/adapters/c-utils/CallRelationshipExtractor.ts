import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';

/**
 * C语言调用关系提取器
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
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
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取调用关系数组
   */
  extractCallRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode || astNode.type !== 'call_expression') {
      return relationships;
    }

    const callMetadata = this.extractCallMetadata(result, astNode, null);
    if (callMetadata) {
      relationships.push(callMetadata);
    }

    return relationships;
  }
}