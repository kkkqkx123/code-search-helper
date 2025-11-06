import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 调用关系提取器
 * 专门处理Rust语言的函数调用关系提取
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = RustHelperMethods.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);
    const callType = this.determineCallType(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: generateDeterministicNodeId(astNode),
      callName: calleeName || 'unknown',
      callType,
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取调用关系
   */
  extractCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'function' | 'method' | 'macro' | 'async' | 'closure' | 'trait';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'function' | 'method' | 'macro' | 'async' | 'closure' | 'trait';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取函数调用关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      if (funcNode?.text) {
        const callerNode = RustHelperMethods.findCallerFunctionContext(mainNode);
        relationships.push({
          source: callerNode?.text || 'unknown',
          target: funcNode.text,
          type: this.determineCallType(mainNode)
        });
      }
    }

    // 提取方法调用关系
    if (mainNode.type === 'method_call_expression') {
      const methodNode = mainNode.childForFieldName('method');
      const objectNode = mainNode.childForFieldName('object');
      if (methodNode?.text && objectNode?.text) {
        const callerNode = RustHelperMethods.findCallerFunctionContext(mainNode);
        relationships.push({
          source: callerNode?.text || 'unknown',
          target: `${objectNode.text}.${methodNode.text}`,
          type: 'method'
        });
      }
    }

    // 提取宏调用关系
    if (mainNode.type === 'macro_invocation') {
      const macroNode = mainNode.childForFieldName('macro');
      if (macroNode?.text) {
        const callerNode = RustHelperMethods.findCallerFunctionContext(mainNode);
        relationships.push({
          source: callerNode?.text || 'unknown',
          target: `${macroNode.text}!`,
          type: 'macro'
        });
      }
    }

    // 提取异步调用关系
    if (mainNode.type === 'await_expression') {
      const awaitedExpr = mainNode.childForFieldName('value');
      if (awaitedExpr?.text) {
        const callerNode = RustHelperMethods.findCallerFunctionContext(mainNode);
        relationships.push({
          source: callerNode?.text || 'unknown',
          target: `await ${awaitedExpr.text}`,
          type: 'async'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取被调用函数名
   */
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.type === 'call_expression') {
      const funcNode = callExpr.childForFieldName('function');
      if (funcNode) {
        return this.extractFunctionName(funcNode);
      }
    } else if (callExpr.type === 'method_call_expression') {
      const methodNode = callExpr.childForFieldName('method');
      const objectNode = callExpr.childForFieldName('object');
      if (methodNode && objectNode) {
        return `${objectNode.text}.${methodNode.text}`;
      }
    } else if (callExpr.type === 'macro_invocation') {
      const macroNode = callExpr.childForFieldName('macro');
      if (macroNode?.text) {
        return `${macroNode.text}!`;
      }
    } else if (callExpr.type === 'await_expression') {
      const valueNode = callExpr.childForFieldName('value');
      if (valueNode?.text) {
        return `await ${valueNode.text}`;
      }
    }

    return null;
  }

  /**
   * 从函数节点中提取函数名
   */
  private extractFunctionName(funcNode: Parser.SyntaxNode): string | null {
    if (funcNode.type === 'identifier') {
      return funcNode.text;
    } else if (funcNode.type === 'scoped_identifier') {
      return funcNode.text;
    } else if (funcNode.type === 'field_expression') {
      return this.extractFieldNameFromFieldExpression(funcNode);
    }
    return null;
  }

  /**
   * 从字段表达式中提取字段名
   */
  private extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    const fieldNode = fieldExpr.childForFieldName('field');
    const valueNode = fieldExpr.childForFieldName('value');
    
    if (fieldNode?.text && valueNode?.text) {
      return `${valueNode.text}.${fieldNode.text}`;
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
    isUnsafe: boolean;
    isInLoop: boolean;
    isInMatch: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || 
                     callExpr.parent?.type === 'method_call_expression' ||
                     callExpr.parent?.type === 'field_expression';
    
    const isAsync = RustHelperMethods.isAsyncNode(callExpr) ||
                   (callExpr.text && callExpr.text.includes('await'));
    
    const isUnsafe = RustHelperMethods.isUnsafeNode(callExpr) ||
                    (callExpr.text && callExpr.text.includes('unsafe'));

    // 检查是否在循环中
    let isInLoop = false;
    let current = callExpr.parent;
    while (current && !isInLoop) {
      if (current.type === 'loop_expression' || 
          current.type === 'while_expression' || 
          current.type === 'for_expression') {
        isInLoop = true;
      }
      current = current.parent;
    }

    // 检查是否在match表达式中
    let isInMatch = false;
    current = callExpr.parent;
    while (current && !isInMatch) {
      if (current.type === 'match_expression' || current.type === 'match_arm') {
        isInMatch = true;
      }
      current = current.parent;
    }

    return {
      isChained,
      isAsync,
      isUnsafe,
      isInLoop,
      isInMatch,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && 
           (current.parent.type === 'call_expression' || 
            current.parent.type === 'method_call_expression' ||
            current.parent.type === 'field_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode): 'function' | 'method' | 'macro' | 'async' | 'closure' | 'trait' {
    if (callExpr.type === 'method_call_expression') {
      return 'method';
    }

    if (callExpr.type === 'macro_invocation') {
      return 'macro';
    }

    if (callExpr.type === 'await_expression' || 
        RustHelperMethods.isAsyncNode(callExpr)) {
      return 'async';
    }

    const funcNode = callExpr.childForFieldName('function');
    if (funcNode) {
      // 检查是否是闭包调用
      if (funcNode.type === 'identifier' && 
          this.isLikelyClosure(funcNode.text)) {
        return 'closure';
      }

      // 检查是否是trait方法调用
      if (funcNode.type === 'scoped_identifier' && 
          this.isLikelyTraitMethod(funcNode.text)) {
        return 'trait';
      }
    }

    return 'function';
  }

  /**
   * 判断是否可能是闭包调用
   */
  private isLikelyClosure(name: string): boolean {
    // 简单启发式：短名称、小写字母开头的可能是闭包变量
    return name.length <= 6 && /^[a-z]/.test(name);
  }

  /**
   * 判断是否可能是trait方法调用
   */
  private isLikelyTraitMethod(name: string): boolean {
    // 简单启发式：包含路径的可能是trait方法
    return name.includes('::') && name.includes('.');
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(callExpr: Parser.SyntaxNode): string[] {
    const args: string[] = [];
    const argsNode = callExpr.childForFieldName('arguments');
    
    if (argsNode) {
      for (const child of argsNode.children || []) {
        if (child.text) {
          args.push(child.text);
        }
      }
    }
    
    return args;
  }

  /**
   * 分析调用复杂度
   */
  private analyzeCallComplexity(callExpr: Parser.SyntaxNode): {
    argumentCount: number;
    hasGenerics: boolean;
    hasLifetimes: boolean;
    isAsync: boolean;
    isUnsafe: boolean;
  } {
    const args = this.extractCallArguments(callExpr);
    const text = callExpr.text || '';
    
    return {
      argumentCount: args.length,
      hasGenerics: text.includes('<') && text.includes('>'),
      hasLifetimes: /\'[a-zA-Z]/.test(text),
      isAsync: RustHelperMethods.isAsyncNode(callExpr),
      isUnsafe: RustHelperMethods.isUnsafeNode(callExpr)
    };
  }
}