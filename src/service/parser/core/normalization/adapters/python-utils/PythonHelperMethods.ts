import Parser from 'tree-sitter';

/**
 * Python 辅助方法集合
 * 提供Python特定的通用辅助方法
 */
export class PythonHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'dotted_name') {
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
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
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
      // 查找类型注解
      if (child.type === 'type' || child.type === 'type_annotation') {
        const typeText = child.text;
        if (typeText && typeText[0] === typeText[0].toUpperCase()) {
          dependencies.push(typeText);
        }
      }

      // 查找类引用
      if (child.type === 'identifier') {
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
      if (child.type === 'call') {
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
      if (child.type === 'import_statement' || child.type === 'import_from_statement') {
        const nameNode = child.childForFieldName('name') || child.childForFieldName('module_name');
        if (nameNode?.text) {
          dependencies.push(nameNode.text);
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
      if (child.type === 'assignment' || child.type === 'annotated_assignment') {
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
      if (child.type === 'call') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          const funcText = functionNode.text.toLowerCase();
          if (funcText.includes('thread') || funcText.includes('asyncio') || 
              funcText.includes('queue') || funcText.includes('lock') || 
              funcText.includes('semaphore') || funcText.includes('event')) {
            dependencies.push(funcText);
          }
        }
      }

      // 查找异步函数定义
      if (child.type === 'async_function_definition') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text) {
          dependencies.push(`async:${nameNode.text}`);
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
      'async_function_definition',
      'lambda',
      'method_definition'
    ];
    return functionTypes.includes(node.type);
  }

  /**
   * 判断是否为类节点
   */
  static isClassNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'class_definition';
  }

  /**
   * 判断是否为异步函数
   */
  static isAsyncFunction(node: Parser.SyntaxNode): boolean {
    return node.type === 'async_function_definition' ||
           !!(node.text && node.text.includes('async'));
  }

  /**
   * 判断是否为生成器函数
   */
  static isGeneratorFunction(node: Parser.SyntaxNode): boolean {
    return !!(node.text && node.text.includes('yield'));
  }

  /**
   * 提取装饰器
   */
  static extractDecorators(node: Parser.SyntaxNode): string[] {
    const decorators: string[] = [];
    const decoratorsNode = node.children?.find((child: any) => child.type === 'decorators');
    
    if (decoratorsNode) {
      for (const child of decoratorsNode.children) {
        if (child.type === 'decorator' && child.text) {
          decorators.push(child.text.trim());
        }
      }
    }
    
    return decorators;
  }

  /**
   * 检查是否有装饰器
   */
  static hasDecorators(node: Parser.SyntaxNode): boolean {
    return node.children?.some((child: any) => child.type === 'decorators') || false;
  }

  /**
   * 提取参数列表
   */
  static extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'identifier' || child.type === 'typed_parameter') {
          const identifier = child.childForFieldName('name') || child;
          if (identifier?.text) {
            parameters.push(identifier.text);
          }
        }
      }
    }
    return parameters;
  }

  /**
   * 提取返回类型
   */
  static extractReturnType(node: Parser.SyntaxNode): string | null {
    const returnType = node.childForFieldName('return_type');
    return returnType?.text || null;
  }

  /**
   * 提取父类列表
   */
  static extractSuperclasses(node: Parser.SyntaxNode): string[] {
    const names: string[] = [];
    const superclasses = node.childForFieldName('superclasses');
    
    if (superclasses && superclasses.children) {
      for (const child of superclasses.children) {
        if (child.type === 'identifier' || child.type === 'dotted_name') {
          names.push(child.text);
        }
      }
    }
    
    return names;
  }

  /**
   * 判断是否为类方法
   */
  static isClassMethod(node: Parser.SyntaxNode): boolean {
    // 检查是否是类方法（通过检查父节点是否是类定义）
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_definition') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 判断是否为静态方法
   */
  static isStaticMethod(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('@staticmethod');
  }

  /**
   * 判断是否为类方法（classmethod装饰器）
   */
  static isClassMethodDecorator(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('@classmethod');
  }

  /**
   * 判断是否为属性方法
   */
  static isPropertyMethod(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('@property');
  }

  /**
   * 获取语言特定的函数类型
   */
  static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'function_definition',
      'async_function_definition',
      'lambda',
      'method_definition'
    ];
  }

  /**
   * 获取语言特定的类类型
   */
  static getLanguageSpecificClassTypes(): string[] {
    return [
      'class_definition',
      'decorated_definition' // 可能是装饰的类
    ];
  }

  /**
   * 检查是否有类型提示
   */
  static hasTypeHints(node: Parser.SyntaxNode): boolean {
    // 检查参数类型提示
    const parameters = node.childForFieldName('parameters');
    if (parameters) {
      for (const child of parameters.children) {
        if (child.type === 'typed_parameter' || child.type === 'type_annotation') {
          return true;
        }
      }
    }

    // 检查返回类型提示
    const returnType = node.childForFieldName('return_type');
    if (returnType) {
      return true;
    }

    return false;
  }
}