import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 调用关系提取器
 * 从 GoLanguageAdapter 迁移的调用关系提取逻辑
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = GoHelperMethods.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: NodeIdGenerator.forAstNode(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
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
      } else if (funcNode.type === 'selector_expression') {
        return this.extractMethodNameFromSelectorExpression(funcNode);
      } else if (funcNode.type === 'call_expression') {
        return this.extractCalleeName(funcNode);
      }
    }
    return null;
  }

  /**
   * 从选择器表达式中提取方法名
   */
  private extractMethodNameFromSelectorExpression(selectorExpr: Parser.SyntaxNode): string | null {
    if (selectorExpr.children && selectorExpr.children.length > 0) {
      const lastChild = selectorExpr.children[selectorExpr.children.length - 1];
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
    isGoroutine: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'selector_expression';
    const isAsync = callExpr.text.includes('await'); // Go中没有await，但保留结构
    const isGoroutine = callExpr.parent?.type === 'go_statement';

    return {
      isChained,
      isAsync,
      isGoroutine,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'selector_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'builtin' | 'goroutine' {
    // 检查是否是goroutine调用
    if (callExpr.parent?.type === 'go_statement') {
      return 'goroutine';
    }

    // 检查是否是方法调用
    if (callExpr.children[0]?.type === 'selector_expression') {
      return 'method';
    }

    // 检查是否是内置函数调用
    const funcNode = callExpr.children[0];
    if (funcNode?.type === 'identifier' && GoHelperMethods.isBuiltinFunction(funcNode.text)) {
      return 'builtin';
    }

    // 检查是否是构造函数调用（Go中的make/new）
    if (funcNode?.type === 'identifier' && (funcNode.text === 'make' || funcNode.text === 'new')) {
      return 'constructor';
    }

    return 'function';
  }

  /**
   * 提取调用关系数组
   */
  extractCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'builtin' | 'goroutine';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'builtin' | 'goroutine';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode || mainNode.type !== 'call_expression') {
      return relationships;
    }

    const callerNode = GoHelperMethods.findCallerFunctionContext(mainNode);
    const calleeName = this.extractCalleeName(mainNode);
    const callType = this.determineCallType(mainNode, null);

    if (callerNode && calleeName) {
      relationships.push({
        source: GoHelperMethods.extractNameFromNode(callerNode) || 'unknown',
        target: calleeName,
        type: callType
      });
    }

    return relationships;
  }
}