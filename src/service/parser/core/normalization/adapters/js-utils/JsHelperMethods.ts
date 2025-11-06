import Parser from 'tree-sitter';

/**
 * JavaScript/TypeScript 辅助方法集合
 * 从 BaseCRelationshipExtractor 迁移的通用辅助方法
 */
export class JsHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier' || 
          child.type === 'shorthand_property_identifier' || child.type === 'string') {
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
      if (current.type === 'function_declaration' || 
          current.type === 'function_expression' || 
          current.type === 'arrow_function' ||
          current.type === 'method_definition') {
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
   * 查找导入依赖
   */
  static findImportDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入语句
      if (child.type === 'import_statement') {
        const source = child.childForFieldName('source');
        if (source?.text) {
          dependencies.push(source.text);
        }
      }

      this.findImportDependencies(child, dependencies);
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
          if (funcText.includes('promise') || funcText.includes('async') || 
              funcText.includes('await') || funcText.includes('fetch') || 
              funcText.includes('then') || funcText.includes('catch') ||
              funcText.includes('finally')) {
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
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition',
      'generator_function',
      'async_function_declaration',
      'async_function_expression'
    ];
    return functionTypes.includes(node.type);
  }

  /**
   * 获取语言特定的函数类型
   */
 static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition',
      'generator_function',
      'async_function_declaration',
      'async_function_expression',
      'class_method',
      'object_method'
    ];
  }

  /**
   * 查找类继承关系
   */
  static findInheritanceDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'class_declaration' || child.type === 'class_expression') {
        const superClass = child.childForFieldName('superclass');
        if (superClass?.text) {
          dependencies.push(superClass.text);
        }
      }

      this.findInheritanceDependencies(child, dependencies);
    }
  }

  /**
   * 查找接口实现关系
   */
  static findInterfaceDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'class_declaration' || child.type === 'class_expression') {
        const implementsClause = child.childForFieldName('implements');
        if (implementsClause) {
          for (const implement of implementsClause.children) {
            if (implement.type === 'identifier' && implement.text) {
              dependencies.push(implement.text);
            }
          }
        }
      }

      this.findInterfaceDependencies(child, dependencies);
    }
  }

  /**
   * 查找类型别名和接口依赖
   */
  static findTypeAliasDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'type_alias_declaration' || child.type === 'interface_declaration') {
        const type = child.childForFieldName('type');
        if (type) {
          this.extractTypeIdentifiers(type, dependencies);
        }
      }

      this.findTypeAliasDependencies(child, dependencies);
    }
  }

  /**
   * 从类型节点中提取类型标识符
   */
  private static extractTypeIdentifiers(node: any, dependencies: string[]): void {
    if (!node) return;

    if (node.type === 'type_identifier' && node.text) {
      dependencies.push(node.text);
    }

    for (const child of node.children || []) {
      this.extractTypeIdentifiers(child, dependencies);
    }
  }
}