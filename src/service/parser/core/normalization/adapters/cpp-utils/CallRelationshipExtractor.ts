import { CppHelperMethods } from './CppHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C++ 调用关系提取器
 * 从 CRelationshipExtractor/CallExtractor.ts 迁移
 */
export class CallRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const calleeName = CppHelperMethods.extractCalleeName(astNode);
    const callerNode = CppHelperMethods.findCallerFunctionContext(astNode);
    const callContext = CppHelperMethods.analyzeCallContext(astNode);
    const functionNode = astNode.childForFieldName('function');

    return {
      type: 'call',
      fromNodeId: callerNode ? CppHelperMethods.generateNodeId(callerNode) : 'unknown',
      toNodeId: functionNode ? CppHelperMethods.generateNodeId(functionNode) : 'unknown',
      callName: calleeName || 'unknown',
      callType: CppHelperMethods.determineCallType(astNode, null),
      callContext,
      location: CppHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取调用关系数组
   */
  extractCallRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CppHelperMethods.isCallNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractCallMetadata(result, astNode, symbolTable)
    );
  }
}