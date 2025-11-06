import * as Parser from 'tree-sitter';

/**
 * Rust 辅助方法集合
 * 提供Rust语言特定的通用辅助方法
 */
export class RustHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || 
          child.type === 'type_identifier' || 
          child.type === 'field_identifier' ||
          child.type === 'scoped_identifier' ||
          child.type === 'scoped_type_identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 查找调用者函数上下文
   */
  static findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_item' || 
          current.type === 'function_signature_item' ||
          current.type === 'closure_expression' ||
          current.type === 'async_block') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 查找类型引用
   */
  static findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找类型标识符（通常以大写字母开头）
      if (child.type === 'type_identifier' || 
          child.type === 'scoped_type_identifier') {
        const text = child.text;
        if (text) {
          dependencies.push(text);
        }
      }

      // 查找泛型参数
      if (child.type === 'type_arguments') {
        for (const arg of child.children || []) {
          if (arg.type === 'type_identifier' && arg.text) {
            dependencies.push(arg.text);
          }
        }
      }

      this.findTypeReferences(child, dependencies);
    }
  }

  /**
   * 查找函数调用
   */
  static findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression' || child.type === 'method_call_expression') {
        const functionNode = child.childForFieldName('function') ||
                            child.childForFieldName('method');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      // 查找宏调用
      if (child.type === 'macro_invocation') {
        const macroNode = child.childForFieldName('macro');
        if (macroNode?.text) {
          dependencies.push(macroNode.text);
        }
      }

      this.findFunctionCalls(child, dependencies);
    }
  }

  /**
   * 查找模块/路径引用
   */
  static findPathReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找路径引用
      if (child.type === 'scoped_identifier' || 
          child.type === 'use_path' || 
          child.type === 'path_segment' ||
          child.type === 'scoped_type_identifier') {
        const text = child.text;
        if (text) {
          dependencies.push(text);
        }
      }

      this.findPathReferences(child, dependencies);
    }
  }

  /**
   * 查找泛型依赖
   */
  static findGenericDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找泛型参数
      if (child.type === 'type_parameters' || child.type === 'type_arguments') {
        for (const param of child.children || []) {
          if (param.type === 'type_parameter' || param.type === 'type_identifier') {
            if (param.text) {
              dependencies.push(param.text);
            }
          }
        }
      }

      // 查找trait约束
      if (child.type === 'trait_bound' || child.type === 'where_clause') {
        if (child.text) {
          dependencies.push(child.text);
        }
      }

      this.findGenericDependencies(child, dependencies);
    }
  }

  /**
   * 查找数据流依赖
   */
  static findDataFlowDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找赋值表达式中的依赖
      if (child.type === 'assignment_expression') {
        const rightSide = child.childForFieldName('right');
        if (rightSide?.type === 'identifier' && rightSide.text) {
          dependencies.push(rightSide.text);
        }
      }

      // 查找let绑定中的依赖
      if (child.type === 'let_declaration') {
        const init = child.childForFieldName('init');
        if (init?.type === 'identifier' && init.text) {
          dependencies.push(init.text);
        }
      }

      this.findDataFlowDependencies(child, dependencies);
    }
  }

  /**
   * 查找并发相关依赖
   */
  static findConcurrencyDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找并发相关函数调用
      if (child.type === 'call_expression' || child.type === 'method_call_expression') {
        const functionNode = child.childForFieldName('function') ||
                            child.childForFieldName('method');
        if (functionNode?.text) {
          const funcText = functionNode.text.toLowerCase();
          if (funcText.includes('thread') || funcText.includes('mutex') || 
              funcText.includes('lock') || funcText.includes('arc') || 
              funcText.includes('channel') || funcText.includes('async') ||
              funcText.includes('await') || funcText.includes('spawn')) {
            dependencies.push(funcText);
          }
        }
      }

      // 查找并发相关的宏调用
      if (child.type === 'macro_invocation') {
        const macroNode = child.childForFieldName('macro');
        if (macroNode?.text) {
          const macroText = macroNode.text.toLowerCase();
          if (macroText.includes('select') || macroText.includes('join') ||
              macroText.includes('try_join') || macroText.includes('spawn')) {
            dependencies.push(macroText);
          }
        }
      }

      this.findConcurrencyDependencies(child, dependencies);
    }
  }

  /**
   * 查找生命周期依赖
   */
  static findLifetimeDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找生命周期参数
      if (child.type === 'lifetime' || child.type === 'lifetime_parameter') {
        if (child.text) {
          dependencies.push(child.text);
        }
      }

      this.findLifetimeDependencies(child, dependencies);
    }
  }

  /**
   * 判断是否为函数节点
   */
  static isFunctionNode(node: Parser.SyntaxNode): boolean {
    const functionTypes = [
      'function_item',
      'function_signature_item',
      'closure_expression',
      'async_block',
      'method_call_expression'
    ];
    return functionTypes.includes(node.type);
  }

  /**
  * 判断是否为异步节点
  */
  static isAsyncNode(node: Parser.SyntaxNode): boolean {
  return node.type === 'async_function' ||
  node.type === 'async_block' ||
  node.type === 'await_expression' ||
  !!(node.text && node.text.includes('async'));
  }

  /**
  * 判断是否为不安全节点
  */
  static isUnsafeNode(node: Parser.SyntaxNode): boolean {
  return node.type === 'unsafe_block' ||
  !!(node.text && node.text.includes('unsafe'));
  }

  /**
   * 获取语言特定的函数类型
   */
  static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'function_item',
      'function_signature_item',
      'closure_expression',
      'async_block',
      'method_call_expression'
    ];
  }

  /**
   * 提取泛型参数
   */
  static extractGenericParameters(node: Parser.SyntaxNode): string[] {
    const generics: string[] = [];
    
    if (!node || !node.children) {
      return generics;
    }

    for (const child of node.children) {
      if (child.type === 'type_parameters' || child.type === 'type_arguments') {
        generics.push(child.text);
      }
      generics.push(...this.extractGenericParameters(child));
    }

    return generics;
  }

  /**
   * 提取trait约束
   */
  static extractTraitBounds(node: Parser.SyntaxNode): string[] {
    const bounds: string[] = [];
    
    if (!node || !node.children) {
      return bounds;
    }

    for (const child of node.children) {
      if (child.type === 'trait_bound' || child.type === 'type_bound' || child.type === 'where_clause') {
        bounds.push(child.text);
      }
      bounds.push(...this.extractTraitBounds(child));
    }

    return bounds;
  }

  /**
   * 提取生命周期
   */
  static extractLifetimes(node: Parser.SyntaxNode): string[] {
    const lifetimes: string[] = [];
    
    if (!node || !node.children) {
      return lifetimes;
    }

    for (const child of node.children) {
      if (child.type === 'lifetime' || child.type === 'lifetime_parameter') {
        lifetimes.push(child.text);
      }
      lifetimes.push(...this.extractLifetimes(child));
    }

    return lifetimes;
  }

  /**
   * 提取可见性修饰符
   */
  static extractVisibility(node: Parser.SyntaxNode): string | null {
    if (!node || !node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'visibility_modifier') {
        return child.text;
      }
    }

    return null;
  }

  /**
   * 提取返回类型
   */
  static extractReturnType(node: Parser.SyntaxNode): string | null {
    if (!node || !node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'return_type' || child.type === 'type') {
        return child.text;
      }
    }

    return null;
  }
}