import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript并发关系提取器
 * 提取异步操作、Promise链、事件处理等并发关系
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系的元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};

    // 提取并发操作信息
    const operationInfo = this.extractOperationInfo(astNode);
    if (operationInfo) {
      metadata.operation = operationInfo;
    }

    // 提取并发类型
    metadata.concurrencyType = this.extractConcurrencyType(astNode);

    // 提取并发上下文
    metadata.context = this.extractConcurrencyContext(astNode);

    // 提取依赖关系
    metadata.dependencies = this.extractConcurrencyDependencies(astNode);

    // 标记是否为异步操作
    metadata.isAsync = this.isAsyncOperation(astNode);

    return metadata;
  }

  /**
    * 提取并发操作信息
    */
  private extractOperationInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let operationNode = null;

    if (astNode.type === 'await_expression') {
      // await表达式中的操作
      operationNode = astNode.childForFieldName('value');
    } else if (astNode.type === 'call_expression') {
      // 检查是否为Promise相关调用
      const functionName = this.getFunctionName(astNode);
      if (this.isPromiseMethod(functionName)) {
        operationNode = astNode;
      }
    } else if (astNode.type === 'promise') {
      operationNode = astNode;
    }

    if (operationNode) {
      return {
        text: operationNode.text,
        type: operationNode.type,
        range: {
          start: { row: operationNode.startPosition.row, column: operationNode.startPosition.column },
          end: { row: operationNode.endPosition.row, column: operationNode.endPosition.column }
        }
      };
    }

    return null;
  }

  /**
    * 提取并发类型
    */
  private extractConcurrencyType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    if (astNode.type === 'await_expression') {
      return 'await';
    } else if (astNode.type === 'call_expression') {
      const functionName = this.getFunctionName(astNode);
      if (functionName === 'Promise.all') return 'parallel_execution';
      if (functionName === 'Promise.race') return 'race_condition';
      if (functionName === 'then') return 'chained_execution';
      if (this.isPromiseMethod(functionName)) return 'promise_operation';
    } else if (astNode.type === 'async_function') {
      return 'async_function';
    } else if (astNode.type === 'generator_function') {
      return 'generator';
    }

    return 'unknown';
  }

  /**
    * 提取并发上下文
    */
  private extractConcurrencyContext(astNode: Parser.SyntaxNode): any {
    const context: any = {};

    // 检查是否在异步函数中
    const asyncFunction = this.findAsyncFunction(astNode);
    if (asyncFunction) {
      context.inAsyncFunction = true;
      context.asyncFunctionName = this.getFunctionName(asyncFunction);
    }

    // 检查是否在Promise链中
    const inPromiseChain = this.isInPromiseChain(astNode);
    context.inPromiseChain = inPromiseChain;

    return context;
  }

  /**
   * 提取并发依赖关系
   */
  private extractConcurrencyDependencies(astNode: Parser.SyntaxNode): string[] {
    const dependencies: string[] = [];

    if (!astNode) return dependencies;

    // 查找相关的异步操作依赖
    if (astNode.type === 'await_expression') {
      const awaitedValue = astNode.childForFieldName('value');
      if (awaitedValue) {
        JsHelperMethods.findFunctionCalls(awaitedValue, dependencies);
      }
    } else if (astNode.type === 'call_expression') {
      JsHelperMethods.findFunctionCalls(astNode, dependencies);
    }

    return [...new Set(dependencies)]; // 去重
  }

  /**
   * 检查是否为异步操作
   */
  private isAsyncOperation(astNode: Parser.SyntaxNode): boolean {
    if (!astNode) return false;

    if (astNode.type === 'await_expression') {
      return true;
    }

    if (astNode.type === 'async_function' || astNode.type === 'async_arrow_function') {
      return true;
    }

    if (astNode.type === 'call_expression') {
      const functionName = this.getFunctionName(astNode);
      return this.isAsyncFunction(functionName);
    }

    // 检查父节点是否为异步上下文
    return this.isInAsyncContext(astNode);
  }

  /**
   * 获取函数名
   */
  private getFunctionName(node: Parser.SyntaxNode): string {
    if (!node || node.type !== 'call_expression') return '';

    const funcNode = node.childForFieldName('function');
    if (!funcNode) return '';

    if (funcNode.type === 'member_expression') {
      // 处理 obj.method() 形式
      const property = funcNode.childForFieldName('property');
      if (property) {
        const object = funcNode.childForFieldName('object');
        return `${object?.text || ''}.${property.text}`;
      }
    } else {
      return funcNode.text;
    }

    return '';
  }

  /**
    * 检查是否为Promise方法
    */
  private isPromiseMethod(functionName: string): boolean {
    const promiseMethods = [
      'Promise.all', 'Promise.race', 'Promise.resolve', 'Promise.reject',
      'then', 'catch', 'finally', 'allSettled', 'any'
    ];
    return promiseMethods.includes(functionName) ||
      functionName.endsWith('.then') ||
      functionName.endsWith('.catch') ||
      functionName.endsWith('.finally');
  }

  /**
   * 检查是否为异步函数
   */
  private isAsyncFunction(functionName: string): boolean {
    const asyncPatterns = [
      'fetch', 'setTimeout', 'setInterval', 'setImmediate',
      'requestAnimationFrame', 'XMLHttpRequest', 'WebSocket'
    ];
    return asyncPatterns.some(pattern => functionName.includes(pattern));
  }

  /**
   * 查找异步函数
   */
  private findAsyncFunction(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;

    if (node.type === 'async_function' || node.type === 'async_arrow_function') {
      return node;
    }

    if (node.parent) {
      return this.findAsyncFunction(node.parent);
    }

    return null;
  }

  /**
   * 检查是否在Promise链中
   */
  private isInPromiseChain(node: Parser.SyntaxNode): boolean {
    let currentNode = node.parent;
    while (currentNode) {
      if (currentNode.type === 'call_expression') {
        const functionName = this.getFunctionName(currentNode);
        if (this.isPromiseMethod(functionName)) {
          return true;
        }
        currentNode = currentNode.parent;
      } else {
        currentNode = currentNode.parent;
      }
    }
    return false;
  }
  /**
   * 检查是否在异步上下文中
   */
  private isInAsyncContext(node: Parser.SyntaxNode): boolean {
    let currentNode = node.parent;
    while (currentNode) {
      if (currentNode.type === 'async_function' ||
        currentNode.type === 'async_arrow_function' ||
        currentNode.type === 'await_expression') {
        return true;
      }
      currentNode = currentNode.parent;
    }
    return false;
  }
}