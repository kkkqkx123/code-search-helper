import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 调用关系提取器
 * 从 JavaLanguageAdapter 迁移调用关系提取逻辑
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = JavaHelperMethods.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: NodeIdGenerator.forAstNode(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取被调用函数名
   */
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.type === 'method_invocation') {
      const methodNode = callExpr.childForFieldName('name');
      if (methodNode?.text) {
        return methodNode.text;
      }
    } else if (callExpr.type === 'object_creation_expression') {
      const typeNode = callExpr.childForFieldName('type');
      if (typeNode?.text) {
        return typeNode.text;
      }
    } else if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'field_access') {
        return this.extractMethodNameFromFieldAccess(funcNode);
      }
    }
    return null;
  }

  /**
   * 从字段访问表达式中提取方法名
   */
  private extractMethodNameFromFieldAccess(fieldAccess: Parser.SyntaxNode): string | null {
    if (fieldAccess.children && fieldAccess.children.length > 0) {
      const lastChild = fieldAccess.children[fieldAccess.children.length - 1];
      if (lastChild.type === 'identifier') {
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
    const isChained = callExpr.parent?.type === 'method_invocation' || callExpr.parent?.type === 'field_access';
    const isAsync = callExpr.text.includes('CompletableFuture') || 
                   callExpr.text.includes('Future') || 
                   callExpr.text.includes('@Async');

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
    while (current.parent && (current.parent.type === 'method_invocation' || current.parent.type === 'field_access')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    if (callExpr.type === 'object_creation_expression') {
      return 'constructor';
    }

    if (callExpr.type === 'method_invocation') {
      const objectNode = callExpr.childForFieldName('object');
      if (!objectNode) {
        // 没有对象引用，可能是静态方法或同一类的方法
        return 'method';
      }
      
      if (objectNode.type === 'identifier') {
        // 可能是静态方法调用
        return 'static';
      }
      
      return 'method';
    }

    return 'function';
  }
}