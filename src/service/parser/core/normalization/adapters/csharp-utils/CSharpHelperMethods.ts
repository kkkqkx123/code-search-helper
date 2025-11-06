import Parser from 'tree-sitter';

/**
 * C# 辅助方法集合
 * 从 CSharpLanguageAdapter 迁移的通用辅助方法
 */
export class CSharpHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 查找调用者方法上下文
   */
  static findCallerMethodContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'method_declaration') {
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
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          dependencies.push(text);
        }
      }

      this.findTypeReferences(child, dependencies);
    }
  }

  /**
   * 查找方法调用
   */
  static findMethodCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找方法调用
      if (child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findMethodCalls(child, dependencies);
    }
  }

  /**
   * 查找LINQ依赖
   */
  static findLinqDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找LINQ表达式
      if (child.type === 'query_expression' ||
        child.type === 'from_clause' ||
        child.type === 'where_clause' ||
        child.type === 'select_clause' ||
        child.type === 'group_clause' ||
        child.type === 'order_by_clause' ||
        child.type === 'join_clause') {
        // 提取LINQ方法名
        const text = child.text;
        if (text) {
          dependencies.push('LINQ');
        }
      }

      this.findLinqDependencies(child, dependencies);
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
      // 查找并发相关函数
      if (child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          const funcText = functionNode.text.toLowerCase();
          if (funcText.includes('task') || funcText.includes('thread') || 
              funcText.includes('async') || funcText.includes('await') || 
              funcText.includes('lock') || funcText.includes('monitor')) {
            dependencies.push(funcText);
          }
        }
      }

      this.findConcurrencyDependencies(child, dependencies);
    }
  }

  /**
   * 判断是否为方法节点
   */
  static isMethodNode(node: Parser.SyntaxNode): boolean {
    const methodTypes = [
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'operator_declaration',
      'conversion_operator_declaration'
    ];
    return methodTypes.includes(node.type);
  }

  /**
   * 获取语言特定的方法类型
   */
  static getLanguageSpecificMethodTypes(): string[] {
    return [
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'operator_declaration',
      'conversion_operator_declaration',
      'lambda_expression',
      'anonymous_method_expression'
    ];
  }

  /**
   * 判断是否为类节点
   */
  static isClassNode(node: Parser.SyntaxNode): boolean {
    const classTypes = [
      'class_declaration',
      'struct_declaration',
      'interface_declaration',
      'record_class_declaration',
      'record_struct_declaration'
    ];
    return classTypes.includes(node.type);
  }

  /**
   * 判断是否为属性节点
   */
  static isPropertyNode(node: Parser.SyntaxNode): boolean {
    const propertyTypes = [
      'property_declaration',
      'indexer_declaration',
      'event_declaration'
    ];
    return propertyTypes.includes(node.type);
  }

  /**
   * 提取方法名
   */
  static extractMethodName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    if (nameNode?.text) {
      return nameNode.text;
    }
    return null;
  }

  /**
   * 提取类名
   */
  static extractClassName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    if (nameNode?.text) {
      return nameNode.text;
    }
    return null;
  }

  /**
   * 提取属性名
   */
  static extractPropertyName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    if (nameNode?.text) {
      return nameNode.text;
    }
    return null;
  }

  /**
   * 判断是否为异步方法
   */
  static isAsyncMethod(node: Parser.SyntaxNode): boolean {
    const modifiers = node.childForFieldName('modifiers');
    if (modifiers) {
      return modifiers.text.includes('async');
    }
    return false;
  }

  /**
   * 判断是否为泛型方法或类
   */
  static isGeneric(node: Parser.SyntaxNode): boolean {
    const typeParameters = node.childForFieldName('type_parameters');
    return typeParameters !== null;
  }

  /**
   * 提取泛型参数
   */
  static extractGenericParameters(node: Parser.SyntaxNode): string[] {
    const typeParameters = node.childForFieldName('type_parameters');
    if (!typeParameters) {
      return [];
    }

    const parameters: string[] = [];
    for (const child of typeParameters.children) {
      if (child.type === 'type_parameter' && child.text) {
        parameters.push(child.text);
      }
    }
    return parameters;
  }

  /**
   * 提取基类和接口
   */
  static extractBaseTypes(node: Parser.SyntaxNode): string[] {
    const baseList = node.childForFieldName('base_list');
    if (!baseList) {
      return [];
    }

    const baseTypes: string[] = [];
    for (const child of baseList.children) {
      if (child.type === 'type' && child.text) {
        baseTypes.push(child.text);
      }
    }
    return baseTypes;
  }

  /**
   * 提取方法参数
   */
  static extractMethodParameters(node: Parser.SyntaxNode): string[] {
    const parameters = node.childForFieldName('parameters');
    if (!parameters) {
      return [];
    }

    const paramList: string[] = [];
    for (const child of parameters.children) {
      if (child.type === 'parameter') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text) {
          paramList.push(nameNode.text);
        }
      }
    }
    return paramList;
  }

  /**
   * 判断是否为LINQ表达式
   */
  static isLinqExpression(node: Parser.SyntaxNode): boolean {
    return node.type === 'query_expression';
  }

  /**
   * 判断是否为模式匹配表达式
   */
  static isPatternMatching(node: Parser.SyntaxNode): boolean {
    return node.type === 'switch_expression' || node.type === 'is_pattern_expression';
  }
}