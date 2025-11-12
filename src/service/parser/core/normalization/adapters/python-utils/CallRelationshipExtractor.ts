import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 调用关系提取器
 * 专门处理Python语言的函数调用关系提取
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = PythonHelperMethods.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: NodeIdGenerator.forAstNode(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
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
    type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取函数调用关系
    if (mainNode.type === 'call') {
      const funcNode = mainNode.childForFieldName('function');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (funcNode?.text) {
        relationships.push({
          source: callerNode?.childForFieldName('name')?.text || 'unknown',
          target: funcNode.text,
          type: this.determineCallType(mainNode, null)
        });
      }
    }

    // 提取方法调用关系
    if (mainNode.type === 'call') {
      const funcNode = mainNode.childForFieldName('function');
      if (funcNode?.type === 'attribute') {
        const objectNode = funcNode.childForFieldName('object');
        const attributeNode = funcNode.childForFieldName('attribute');
        
        if (objectNode?.text && attributeNode?.text) {
          relationships.push({
            source: objectNode.text,
            target: attributeNode.text,
            type: 'method'
          });
        }
      }
    }

    // 提取装饰器调用关系
    if (mainNode.type === 'decorated_definition') {
      const decorators = mainNode.childForFieldName('decorators');
      if (decorators) {
        for (const decorator of decorators.children) {
          if (decorator.type === 'decorator' && decorator.text) {
            const decoratedNode = mainNode.childForFieldName('definition');
            const nameNode = decoratedNode?.childForFieldName('name');
            
            if (nameNode?.text) {
              relationships.push({
                source: decorator.text,
                target: nameNode.text,
                type: 'decorator'
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * 提取被调用函数名
   */
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'attribute') {
        return this.extractAttributeName(funcNode);
      }
    }
    return null;
  }

  /**
   * 从属性表达式中提取属性名
   */
  private extractAttributeName(attrExpr: Parser.SyntaxNode): string | null {
    const attributeNode = attrExpr.childForFieldName('attribute');
    if (attributeNode?.type === 'identifier') {
      return attributeNode.text;
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
    isMethod: boolean;
    isConstructor: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call' || callExpr.parent?.type === 'attribute';
    const isAsync = callExpr.text.includes('await');
    const funcNode = callExpr.childForFieldName('function');
    const isMethod = funcNode?.type === 'attribute';
    const isConstructor = this.isConstructorCall(callExpr);

    return {
      isChained,
      isAsync,
      isMethod,
      isConstructor,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call' || current.parent.type === 'attribute')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 确定调用类型
   */
  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    const funcNode = callExpr.childForFieldName('function');
    
    // 检查是否是构造函数调用
    if (this.isConstructorCall(callExpr)) {
      return 'constructor';
    }

    // 检查是否是方法调用
    if (funcNode?.type === 'attribute') {
      return 'method';
    }

    // 检查是否是静态方法调用
    if (funcNode?.type === 'attribute') {
      const objectNode = funcNode.childForFieldName('object');
      if (objectNode?.type === 'identifier' && objectNode.text[0] === objectNode.text[0].toUpperCase()) {
        return 'static';
      }
    }

    // 检查是否是回调函数
    if (callExpr.parent?.type === 'argument_list') {
      return 'callback';
    }

    return 'function';
  }

  /**
   * 检查是否是构造函数调用
   */
  private isConstructorCall(callExpr: Parser.SyntaxNode): boolean {
    const funcNode = callExpr.childForFieldName('function');
    if (funcNode?.type === 'identifier') {
      // 简单的启发式：如果函数名首字母大写，可能是构造函数
      return funcNode.text[0] === funcNode.text[0].toUpperCase();
    }
    return false;
  }

  /**
   * 提取异步调用关系
   */
  extractAsyncCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'async_call' | 'await_call';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'async_call' | 'await_call';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找异步函数调用
    if (mainNode.type === 'call') {
      const funcNode = mainNode.childForFieldName('function');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (funcNode?.text && PythonHelperMethods.isAsyncFunction(callerNode!)) {
        relationships.push({
          source: callerNode?.childForFieldName('name')?.text || 'unknown',
          target: funcNode.text,
          type: 'async_call'
        });
      }
    }

    // 查找await表达式
    if (mainNode.type === 'await') {
      const valueNode = mainNode.childForFieldName('value');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (valueNode?.text) {
        relationships.push({
          source: callerNode?.childForFieldName('name')?.text || 'unknown',
          target: valueNode.text,
          type: 'await_call'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取生成器调用关系
   */
  extractGeneratorCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'generator_call' | 'yield_call';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'generator_call' | 'yield_call';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找生成器函数调用
    if (mainNode.type === 'call') {
      const funcNode = mainNode.childForFieldName('function');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (funcNode?.text && PythonHelperMethods.isGeneratorFunction(callerNode!)) {
        relationships.push({
          source: callerNode?.childForFieldName('name')?.text || 'unknown',
          target: funcNode.text,
          type: 'generator_call'
        });
      }
    }

    // 查找yield表达式
    if (mainNode.type === 'yield') {
      const valueNode = mainNode.childForFieldName('value');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (valueNode?.text) {
        relationships.push({
          source: callerNode?.childForFieldName('name')?.text || 'unknown',
          target: valueNode.text,
          type: 'yield_call'
        });
      }
    }

    return relationships;
  }
}