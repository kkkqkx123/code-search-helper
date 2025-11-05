import {
  CallRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class CallExtractor extends BaseCRelationshipExtractor {
  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].callExpression
    );

    for (const callExpr of callExpressions) {
      const calleeName = this.extractCalleeName(callExpr);

      if (calleeName) {
        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr);

        relationships.push({
          callerId: generateDeterministicNodeId(callExpr.parent || callExpr),
          calleeId: generateDeterministicNodeId(callExpr),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          callType: this.determineCallType(callExpr, null),
          callContext
        });
      }
    }

    return relationships;
  }
}