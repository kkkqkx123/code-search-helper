import Parser from 'tree-sitter';

/**
 * C++ 辅助方法集合
 * 从 BaseCRelationshipExtractor 迁移的通用辅助方法
 */
export class CppHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'field_identifier') {
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
      if (current.type === 'function_definition') {
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
   * 查找函数调用
   */
  static findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findFunctionCalls(child, dependencies);
    }
  }

  /**
   * 查找模板依赖
   */
  static findTemplateDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找模板实例化
      if (child.type === 'template_function' || child.type === 'template_type') {
        const identifier = child.childForFieldName('identifier') ||
          child.childForFieldName('type_identifier');
        if (identifier?.text) {
          dependencies.push(identifier.text);
        }
      }

      this.findTemplateDependencies(child, dependencies);
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
      if (child.type === 'call_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          const funcText = functionNode.text.toLowerCase();
          if (funcText.includes('thread') || funcText.includes('mutex') || 
              funcText.includes('lock') || funcText.includes('future') || 
              funcText.includes('promise') || funcText.includes('async')) {
            dependencies.push(funcText);
          }
        }
      }

      this.findConcurrencyDependencies(child, dependencies);
    }
  }

  /**
   * 判断是否为函数节点
   */
  static isFunctionNode(node: Parser.SyntaxNode): boolean {
    const functionTypes = [
      'function_definition',
      'function_declarator',
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration'
    ];
    return functionTypes.includes(node.type);
  }

  /**
   * 获取语言特定的函数类型
   */
  static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'function_definition',
      'function_declarator',
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'lambda_expression'
    ];
  }
}