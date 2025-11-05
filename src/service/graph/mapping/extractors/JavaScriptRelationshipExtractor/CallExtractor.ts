import {
  CallRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class CallExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式和新表达式
    const callExpressions = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].callExpression
    );

    for (const callExpr of callExpressions) {
      // 使用符号解析器查找调用者函数
      const callerSymbol = this.findCallerSymbol(callExpr, filePath);
      const calleeName = this.extractCalleeName(callExpr);

      if (callerSymbol && calleeName) {
        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr);

        relationships.push({
          callerId: this.generateSymbolId(callerSymbol),
          calleeId: this.generateNodeId(calleeName, 'function', filePath),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          callType: this.determineCallType(callExpr, null),
          callContext,
          resolvedSymbol: undefined
        });
      }
    }

    return relationships;
  }

  // 辅助方法：按类型查找节点
  private findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    function traverse(node: Parser.SyntaxNode) {
      if (types.includes(node.type)) {
        nodes.push(node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    }
    
    traverse(ast);
    return nodes;
  }
}