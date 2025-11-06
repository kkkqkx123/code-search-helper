import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript语义关系提取器
 * 提取语义相似性、类型关系、注释关联等语义关系
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系的元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取语义元素信息
    const elementInfo = this.extractElementInfo(astNode);
    if (elementInfo) {
      metadata.element = elementInfo;
    }
    
    // 提取语义类型
    metadata.semanticType = this.extractSemanticType(astNode);
    
    // 提取语义上下文
    metadata.context = this.extractSemanticContext(astNode);
    
    // 提取语义标签
    metadata.tags = this.extractSemanticTags(astNode);
    
    // 提取相关元素
    metadata.relatedElements = this.extractRelatedElements(astNode);
    
    return metadata;
  }

 /**
   * 提取语义元素信息
   */
  private extractElementInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    return {
      text: astNode.text,
      type: astNode.type,
      range: {
        start: { row: astNode.startPosition.row, column: astNode.startPosition.column },
        end: { row: astNode.endPosition.row, column: astNode.endPosition.column }
      }
    };
  }

  /**
   * 提取语义类型
   */
  private extractSemanticType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    // 根据节点类型和内容判断语义类型
    switch (astNode.type) {
      case 'function_declaration':
      case 'method_definition':
        return 'function';
      case 'class':
      case 'class_declaration':
        return 'class';
      case 'variable_declarator':
      case 'identifier':
        return 'variable';
      case 'comment':
        return 'comment';
      case 'string':
      case 'template_string':
        return 'string_literal';
      case 'number':
        return 'numeric_literal';
      case 'call_expression':
        return 'function_call';
      case 'return_statement':
        return 'return_statement';
      default:
        // 检查是否为类型注解（TypeScript）
        if (this.isTypeAnnotation(astNode)) {
          return 'type_annotation';
        }
        // 检查是否为JSDoc注释
        if (this.isJSDocComment(astNode)) {
          return 'jsdoc_comment';
        }
        return 'unknown';
    }
 }

  /**
   * 提取语义上下文
   */
 private extractSemanticContext(astNode: Parser.SyntaxNode): any {
    const context: any = {};
    
    // 查找父作用域
    const parentScope = this.findParentScope(astNode);
    if (parentScope) {
      context.parentScope = {
        type: parentScope.type,
        text: parentScope.text.substring(0, 100) // 截取前100个字符作为预览
      };
    }
    
    // 查找命名空间或模块
    const namespace = this.findNamespace(astNode);
    if (namespace) {
      context.namespace = namespace;
    }
    
    // 检查是否在特定框架中
    context.framework = this.detectFramework(astNode);
    
    return context;
  }

 /**
   * 提取语义标签
   */
  private extractSemanticTags(astNode: Parser.SyntaxNode): string[] {
    const tags: string[] = [];
    
    if (!astNode) return tags;

    // 根据节点类型添加标签
    switch (astNode.type) {
      case 'function_declaration':
        tags.push('function', 'declaration');
        if (this.isAsyncFunction(astNode)) tags.push('async');
        if (this.isGeneratorFunction(astNode)) tags.push('generator');
        break;
      case 'class_declaration':
        tags.push('class', 'declaration');
        if (this.isAbstractClass(astNode)) tags.push('abstract');
        break;
      case 'arrow_function':
        tags.push('function', 'arrow');
        if (this.isAsyncFunction(astNode)) tags.push('async');
        break;
      case 'comment':
        tags.push('comment');
        if (this.isJSDocComment(astNode)) tags.push('jsdoc');
        break;
      case 'import_statement':
        tags.push('import', 'module');
        break;
      case 'export_statement':
        tags.push('export', 'module');
        break;
      default:
        // 检查是否为异步操作
        if (this.isAsyncOperation(astNode)) {
          tags.push('async');
        }
    }
    
    // 添加访问修饰符标签
    const modifiers = this.extractAccessModifiers(astNode);
    tags.push(...modifiers);
    
    // 添加类型相关标签
    if (this.isTypeRelated(astNode)) {
      tags.push('type-related');
    }
    
    return [...new Set(tags)]; // 去重
  }

  /**
   * 提取相关元素
   */
 private extractRelatedElements(astNode: Parser.SyntaxNode): any[] {
    const relatedElements: any[] = [];
    
    if (!astNode) return relatedElements;

    // 查找相关的类型定义
    const relatedTypes = this.findRelatedTypes(astNode);
    for (const type of relatedTypes) {
      relatedElements.push({
        type: 'type',
        text: type,
        relationship: 'type-definition'
      });
    }
    
    // 查找相关的函数调用
    const relatedCalls = this.findRelatedFunctionCalls(astNode);
    for (const call of relatedCalls) {
      relatedElements.push({
        type: 'function',
        text: call,
        relationship: 'function-call'
      });
    }
    
    // 查找相关的变量引用
    const relatedVars = this.findRelatedVariables(astNode);
    for (const variable of relatedVars) {
      relatedElements.push({
        type: 'variable',
        text: variable,
        relationship: 'variable-reference'
      });
    }
    
    return relatedElements;
  }

  /**
   * 检查是否为类型注解
   */
  private isTypeAnnotation(node: Parser.SyntaxNode): boolean {
    // 检查节点是否为TypeScript类型注解
    if (node.type.includes('type') || node.type.includes('annotation')) {
      return true;
    }
    
    // 检查父节点是否包含类型相关信息
    if (node.parent) {
      return node.parent.type.includes('type') || 
             node.parent.type.includes('annotation') ||
             node.parent.type === 'typed_parameter' ||
             node.parent.type === 'parameter' && node.parent.text.includes(':');
    }
    
    return false;
  }

 /**
   * 检查是否为JSDoc注释
   */
  private isJSDocComment(node: Parser.SyntaxNode): boolean {
    if (node.type === 'comment' && node.text) {
      return node.text.trim().startsWith('/**');
    }
    return false;
  }

  /**
   * 查找父作用域
   */
  private findParentScope(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    let currentNode = node.parent;
    while (currentNode) {
      if (['function_declaration', 'method_definition', 'class', 'class_declaration', 
           'block', 'statement_block', 'program'].includes(currentNode.type)) {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    
    return null;
 }

  /**
   * 查找命名空间
   */
  private findNamespace(node: Parser.SyntaxNode): string | null {
    // 检查是否在模块或命名空间中
    let currentNode = node;
    while (currentNode) {
      if (currentNode.type === 'export_statement' || currentNode.type === 'import_statement') {
        // 查找模块路径
        const source = this.findModuleSource(currentNode);
        if (source) {
          return source;
        }
      }
      currentNode = currentNode.parent!;
    }
    
    return null;
 }

  /**
   * 查找模块源路径
   */
  private findModuleSource(node: Parser.SyntaxNode): string | null {
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'string') {
          return child.text.replace(/['"]/g, '');
        }
      }
    }
    return null;
  }

  /**
   * 检测框架
   */
  private detectFramework(node: Parser.SyntaxNode): string | null {
    // 向上搜索查找框架特定的模式
    let currentNode = node;
    while (currentNode) {
      if (currentNode.type === 'call_expression') {
        const functionName = this.getFunctionName(currentNode);
        if (this.isReactFunction(functionName)) return 'react';
        if (this.isVueFunction(functionName)) return 'vue';
        // if (this.isAngularFunction(functionName)) return 'angular'; // Method not implemented
        if (this.isJQueryFunction(functionName)) return 'jquery';
      }
      currentNode = currentNode.parent!;
    }
    
    return null;
  }

 /**
   * 检查是否为React相关函数
   */
  private isReactFunction(functionName: string): boolean {
    const reactFunctions = [
      'React.createElement', 'createElement', 'jsx', 'jsxs',
      'useState', 'useEffect', 'useContext', 'useReducer',
      'useCallback', 'useMemo', 'useRef', 'useImperativeHandle',
      'useLayoutEffect', 'useDebugValue', 'useDeferredValue', 'useTransition',
      'createClass', 'createReactClass', 'render'
    ];
    return reactFunctions.some(fn => functionName.includes(fn));
  }

 /**
   * 检查是否为Vue相关函数
   */
  private isVueFunction(functionName: string): boolean {
    const vueFunctions = [
      'Vue.createApp', 'createApp', 'defineComponent', 'ref', 'reactive',
      'computed', 'watch', 'onMounted', 'onUnmounted', 'onUpdated'
    ];
    return vueFunctions.some(fn => functionName.includes(fn));
  }

  /**
   * 检查是否为jQuery相关函数
   */
  private isJQueryFunction(functionName: string): boolean {
    return functionName.startsWith('$') || functionName.includes('jQuery');
  }

  /**
   * 检查是否为异步函数
   */
  private isAsyncFunction(node: Parser.SyntaxNode): boolean {
    if (node.type === 'function_declaration' || node.type === 'method_definition' || 
        node.type === 'arrow_function') {
      // 检查是否包含async关键字
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'async') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 检查是否为生成器函数
   */
  private isGeneratorFunction(node: Parser.SyntaxNode): boolean {
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      // 检查是否包含*符号（生成器函数）
      if (node.children) {
        for (const child of node.children) {
          if (child.type === '*') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 检查是否为抽象类
   */
  private isAbstractClass(node: Parser.SyntaxNode): boolean {
    if (node.type === 'class_declaration' || node.type === 'class') {
      // 检查父节点或前一个兄弟节点是否包含abstract关键字
      if (node.parent && node.parent.children) {
        for (const child of node.parent.children) {
          if (child.type === 'abstract') {
            return true;
          }
        }
      }
      
      if (node.previousSibling?.type === 'abstract') {
        return true;
      }
    }
    return false;
  }

  /**
   * 提取访问修饰符
   */
  private extractAccessModifiers(node: Parser.SyntaxNode): string[] {
    const modifiers: string[] = [];
    
    // 检查节点或其父节点是否包含访问修饰符
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'public' || child.type === 'private' || child.type === 'protected') {
          modifiers.push(child.type);
        }
      }
    }
    
    return modifiers;
  }

 /**
   * 检查是否与类型相关
   */
  private isTypeRelated(node: Parser.SyntaxNode): boolean {
    return node.type.includes('type') || 
           node.type.includes('interface') || 
           node.type.includes('annotation') ||
           node.text?.includes(':') ||  // TypeScript类型注解
           node.text?.includes('=>') || // 函数类型
           node.text?.includes('<') ||  // 泛型
           node.text?.includes('>');
  }

  /**
   * 检查是否为异步操作
   */
  private isAsyncOperation(node: Parser.SyntaxNode): boolean {
    if (node.type === 'await_expression') {
      return true;
    }
    
    if (node.type === 'call_expression') {
      const functionName = this.getFunctionName(node);
      const asyncPatterns = [
        'fetch', 'setTimeout', 'setInterval', 'setImmediate',
        'requestAnimationFrame', 'XMLHttpRequest', 'WebSocket'
      ];
      return asyncPatterns.some(pattern => functionName.includes(pattern));
    }
    
    return false;
  }

 /**
   * 获取函数名（对于调用表达式）
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
   * 查找相关类型
   */
  private findRelatedTypes(node: Parser.SyntaxNode): string[] {
    const types: string[] = [];
    
    // 遍历子节点查找类型相关元素
    this.traverseNode(node, (child) => {
      if (child.type.includes('type') || child.type.includes('annotation')) {
        types.push(child.text);
      }
    });
    
    return [...new Set(types)]; // 去重
  }

  /**
   * 查找相关函数调用
   */
 private findRelatedFunctionCalls(node: Parser.SyntaxNode): string[] {
    const calls: string[] = [];
    
    this.traverseNode(node, (child) => {
      if (child.type === 'call_expression') {
        const funcName = this.getFunctionName(child);
        if (funcName) {
          calls.push(funcName);
        }
      }
    });
    
    return [...new Set(calls)]; // 去重
  }

  /**
   * 查找相关变量
   */
 private findRelatedVariables(node: Parser.SyntaxNode): string[] {
    const variables: string[] = [];
    
    this.traverseNode(node, (child) => {
      if (child.type === 'identifier' && !this.isFunctionName(child)) {
        variables.push(child.text);
      }
    });
    
    return [...new Set(variables)]; // 去重
  }

  /**
   * 检查节点是否为函数名
   */
  private isFunctionName(node: Parser.SyntaxNode): boolean {
    // 检查父节点是否为调用表达式
    if (node.parent?.type === 'call_expression') {
      const funcNode = node.parent.childForFieldName('function');
      return funcNode === node;
    }
    return false;
  }

  /**
   * 遍历节点及其子节点
   */
  private traverseNode(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    if (!node || !node.children) return;
    
    for (const child of node.children) {
      callback(child);
      this.traverseNode(child, callback);
    }
  }
}