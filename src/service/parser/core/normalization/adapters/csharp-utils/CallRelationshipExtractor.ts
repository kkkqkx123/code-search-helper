import { CSharpHelperMethods } from './CSharpHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C# 调用关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class CallRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const calleeName = CSharpHelperMethods.extractCalleeName(astNode);
    const callerNode = CSharpHelperMethods.findCallerMethodContext(astNode);
    const callContext = CSharpHelperMethods.analyzeCallContext(astNode);
    const functionNode = astNode.childForFieldName('function');

    return {
      type: 'call',
      fromNodeId: callerNode ? CSharpHelperMethods.generateNodeId(callerNode) : 'unknown',
      toNodeId: functionNode ? CSharpHelperMethods.generateNodeId(functionNode) : 'unknown',
      callName: calleeName || 'unknown',
      callType: CSharpHelperMethods.determineCallType(astNode, null),
      callContext,
      location: CSharpHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取调用关系数组
   */
  extractCallRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CSharpHelperMethods.isCallNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractCallMetadata(result, astNode, symbolTable)
    );
  }
}