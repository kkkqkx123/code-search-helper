import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript调用关系提取器
 * 提取函数调用、方法调用等关系
 */
export class CallRelationshipExtractor {
  /**
   * 提取调用关系的元数据
   */
  extractCallMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取调用者和被调用者信息
    const callerInfo = this.extractCallerInfo(astNode);
    const calleeInfo = this.extractCalleeInfo(astNode);
    
    if (callerInfo) {
      metadata.caller = callerInfo;
    }
    
    if (calleeInfo) {
      metadata.callee = calleeInfo;
    }
    
    // 提取调用类型
    metadata.callType = this.extractCallType(astNode);
    
    // 提取参数信息
    metadata.arguments = this.extractArguments(astNode);
    
    // 标记是否为异步调用
    metadata.isAsync = this.isAsyncCall(astNode);
    
    return metadata;
  }

  /**
   * 提取调用者信息
   */
  private extractCallerInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    // 查找调用表达式的左侧（调用者）
    let callerNode = null;
    
    if (astNode.type === 'call_expression') {
      callerNode = astNode.childForFieldName('function');
    } else if (astNode.type === 'new_expression') {
      callerNode = astNode.childForFieldName('constructor');
    } else if (astNode.type === 'member_expression') {
      callerNode = astNode.childForFieldName('object');
    }
    
    if (callerNode) {
      return {
        text: callerNode.text,
        type: callerNode.type,
        range: {
          start: { row: callerNode.startPosition.row, column: callerNode.startPosition.column },
          end: { row: callerNode.endPosition.row, column: callerNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

  /**
   * 提取被调用者信息
   */
  private extractCalleeInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let calleeNode = null;
    
    if (astNode.type === 'call_expression') {
      // 对于函数调用，被调用者通常是函数名
      const functionNode = astNode.childForFieldName('function');
      if (functionNode?.type === 'member_expression') {
        // 对于 obj.method() 这种形式，方法名是被调用者
        calleeNode = functionNode.childForFieldName('property');
      } else {
        calleeNode = functionNode;
      }
    } else if (astNode.type === 'new_expression') {
      // 对于构造函数调用，构造函数是被调用者
      calleeNode = astNode.childForFieldName('constructor');
    }
    
    if (calleeNode) {
      return {
        text: calleeNode.text,
        type: calleeNode.type,
        range: {
          start: { row: calleeNode.startPosition.row, column: calleeNode.startPosition.column },
          end: { row: calleeNode.endPosition.row, column: calleeNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

  /**
   * 提取调用类型
   */
  private extractCallType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    switch (astNode.type) {
      case 'call_expression':
        return 'function_call';
      case 'new_expression':
        return 'constructor_call';
      case 'member_expression':
        return 'method_call';
      default:
        return 'unknown';
    }
 }

  /**
   * 提取参数信息
   */
  private extractArguments(astNode: Parser.SyntaxNode): any[] {
    if (!astNode) return [];

    const argumentsList: any[] = [];
    
    if (astNode.type === 'call_expression' || astNode.type === 'new_expression') {
      const argumentsNode = astNode.childForFieldName('arguments');
      if (argumentsNode && argumentsNode.children) {
        for (const child of argumentsNode.children) {
          if (child.type !== ',' && child.type !== '(' && child.type !== ')') { // 过滤分隔符
            argumentsList.push({
              text: child.text,
              type: child.type,
              range: {
                start: { row: child.startPosition.row, column: child.startPosition.column },
                end: { row: child.endPosition.row, column: child.endPosition.column }
              }
            });
          }
        }
      }
    }
    
    return argumentsList;
  }

 /**
   * 检查是否为异步调用
   */
  private isAsyncCall(astNode: Parser.SyntaxNode): boolean {
    if (!astNode) return false;

    // 检查是否为 await 表达式
    if (astNode.parent?.type === 'await_expression') {
      return true;
    }
    
    // 检查函数名是否包含异步相关关键词
    const calleeInfo = this.extractCalleeInfo(astNode);
    if (calleeInfo?.text) {
      const calleeText = calleeInfo.text.toLowerCase();
      return calleeText.includes('async') || calleeText.includes('promise') || 
             calleeText.includes('fetch') || calleeText.includes('ajax');
    }
    
    return false;
  }
}