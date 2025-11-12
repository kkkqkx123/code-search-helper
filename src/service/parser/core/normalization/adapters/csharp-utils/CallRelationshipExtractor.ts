import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 调用关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = CSharpHelperMethods.findCallerMethodContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: NodeIdGenerator.forAstNode(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取被调用方法名
   */
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_access_expression') {
        return this.extractMethodNameFromMemberExpression(funcNode);
      } else if (funcNode.type === 'conditional_access_expression') {
        return this.extractMethodNameFromConditionalAccess(funcNode);
      }
    }
    return null;
  }

  /**
   * 从成员访问表达式中提取方法名
   */
  private extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 从条件访问表达式中提取方法名
   */
  private extractMethodNameFromConditionalAccess(conditionalAccess: Parser.SyntaxNode): string | null {
    if (conditionalAccess.children && conditionalAccess.children.length > 0) {
      const memberBinding = conditionalAccess.children.find(child => child.type === 'member_binding_expression');
      if (memberBinding) {
        const nameNode = memberBinding.childForFieldName('name');
        if (nameNode?.text) {
          return nameNode.text;
        }
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
    isExtension: boolean;
  } {
    const isChained = callExpr.parent?.type === 'invocation_expression' || 
                     callExpr.parent?.type === 'member_access_expression' ||
                     callExpr.parent?.type === 'conditional_access_expression';
    const isAsync = callExpr.text.includes('await');
    const isExtension = this.isExtensionMethodCall(callExpr);

    return {
      isChained,
      isAsync,
      isExtension,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (
      current.parent.type === 'invocation_expression' || 
      current.parent.type === 'member_access_expression' ||
      current.parent.type === 'conditional_access_expression'
    )) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 判断是否为扩展方法调用
   */
  private isExtensionMethodCall(callExpr: Parser.SyntaxNode): boolean {
    // 简化判断：如果调用的是静态方法但通过实例调用，可能是扩展方法
    const funcNode = callExpr.children[0];
    if (funcNode?.type === 'member_access_expression') {
      // 检查是否是 this 参数的扩展方法
      return funcNode.text.includes('.'); // 简化判断
    }
    return false;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' | 'extension' | 'async' {
    if (callExpr.parent?.type === 'object_creation_expression') {
      return 'constructor';
    }

    if (callExpr.parent?.type === 'attribute_list') {
      return 'decorator';
    }

    const funcNode = callExpr.children[0];
    if (funcNode?.type === 'member_access_expression') {
      return 'method';
    }

    if (callExpr.text.includes('await')) {
      return 'async';
    }

    if (this.isExtensionMethodCall(callExpr)) {
      return 'extension';
    }

    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      } else if (resolvedSymbol.isStatic) {
        return 'static';
      }
    }

    return 'function';
  }
}