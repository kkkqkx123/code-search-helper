import {
  CallRelationship,
  SymbolResolver,
  BaseRustRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  LANGUAGE_NODE_MAPPINGS
} from '../types';

@injectable()
export class CallExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].callExpression
    );

    for (const callExpr of callExpressions) {
      // 使用符号解析器查找调用者函数
      const callerSymbol = this.findCallerSymbol(callExpr, symbolResolver, filePath);
      const calleeName = this.extractCalleeName(callExpr);

      if (callerSymbol && calleeName) {
        // 使用符号解析器解析被调用函数
        const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);

        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr);

        relationships.push({
          callerId: this.generateSymbolId(callerSymbol),
          calleeId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(calleeName, 'function', filePath),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          callType: this.determineCallType(callExpr, resolvedSymbol),
          callContext,
          resolvedSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找闭包表达式 (lambdaExpression in Rust)
    const closureExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].lambdaExpression
    );

    for (const closureExpr of closureExpressions) {
      // 查找闭包内的函数调用
      const innerCalls = this.treeSitterService.findNodesByTypes(closureExpr,
        LANGUAGE_NODE_MAPPINGS['rust'].callExpression
      );

      for (const callExpr of innerCalls) {
        const callerSymbol = this.findCallerSymbol(closureExpr, symbolResolver, filePath);
        const calleeName = this.extractCalleeName(callExpr);

        if (callerSymbol && calleeName) {
          const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);
          const callContext = this.analyzeCallContext(callExpr);

          relationships.push({
            callerId: this.generateSymbolId(callerSymbol),
            calleeId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(calleeName, 'function', filePath),
            callName: calleeName,
            location: {
              filePath,
              lineNumber: callExpr.startPosition.row + 1,
              columnNumber: callExpr.startPosition.column + 1
            },
            callType: this.determineCallType(callExpr, resolvedSymbol),
            callContext,
            resolvedSymbol: resolvedSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }
}
