import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { CppHelperMethods } from './CppHelperMethods';
import Parser from 'tree-sitter';

/**
 * C++ 调用关系提取器
 * 从 CRelationshipExtractor/CallExtractor.ts 迁移
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = CppHelperMethods.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: NodeIdGenerator.forAstNode(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取被调用函数名
   */
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'field_expression') {
        return this.extractFieldNameFromFieldExpression(funcNode);
      }
    }
    return null;
  }

  /**
   * 从字段表达式中提取字段名
   */
  private extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 分析调用上下文
   */
  private analyzeCallContext(callExpr: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'field_expression';
    const isAsync = callExpr.text.includes('co_await');

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'field_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    if (callExpr.parent?.type === 'new_expression') {
      return 'constructor';
    }

    if (callExpr.children[0]?.type === 'field_expression') {
      return 'method';
    }

    return 'function';
  }

}