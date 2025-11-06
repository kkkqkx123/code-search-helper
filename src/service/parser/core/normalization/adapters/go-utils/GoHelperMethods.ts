import Parser from 'tree-sitter';

/**
 * Go 辅助方法集合
 * 从 GoLanguageAdapter 迁移的通用辅助方法
 */
export class GoHelperMethods {
  /**
   * 从节点中提取名称
   */
  static extractNameFromNode(node: Parser.SyntaxNode): string | null {
    // 尝试从节点中提取名称
    for (const child of node.children) {
      if (child.type === 'identifier' || 
          child.type === 'type_identifier' || 
          child.type === 'field_identifier' ||
          child.type === 'package_identifier') {
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
      if (current.type === 'function_declaration' || current.type === 'method_declaration') {
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
      if (child.type === 'type_identifier' || 
          child.type === 'identifier' ||
          child.type === 'qualified_type') {
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
        const funcNode = child.childForFieldName('function');
        if (funcNode?.text) {
          dependencies.push(funcNode.text);
        }
      } else if (child.type === 'identifier' && child.text) {
        // Also add identifiers that might be function calls
        dependencies.push(child.text);
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  /**
   * 查找Go特有的依赖（如包导入）
   */
  static findPackageDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入声明
      if (child.type === 'import_declaration' || child.type === 'import_spec') {
        const pathNode = child.childForFieldName('path');
        if (pathNode?.text) {
          // 提取包路径，去掉引号
          const packagePath = pathNode.text.replace(/["']/g, '');
          dependencies.push(packagePath);
        }
      }

      this.findPackageDependencies(child, dependencies);
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
      if (child.type === 'assignment_statement' || child.type === 'short_var_declaration') {
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
          if (funcText.includes('go') || funcText.includes('chan') || 
              funcText.includes('mutex') || funcText.includes('waitgroup') || 
              funcText.includes('select') || funcText.includes('sync')) {
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
      'method_declaration',
      'func_literal'
    ];
    return functionTypes.includes(node.type);
  }

  /**
   * 判断是否为方法节点
   */
  static isMethodNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'method_declaration';
  }

  /**
   * 判断是否为接口类型
   */
  static isInterfaceNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'interface_type';
  }

  /**
   * 判断是否为结构体类型
   */
  static isStructNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'struct_type';
  }

  /**
   * 获取语言特定的函数类型
   */
  static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'function_declaration',
      'method_declaration',
      'func_literal'
    ];
  }

  /**
   * 获取语言特定的类型节点
   */
  static getLanguageSpecificTypeNodes(): string[] {
    return [
      'type_declaration',
      'struct_type',
      'interface_type',
      'type_alias',
      'array_type',
      'slice_type',
      'map_type',
      'pointer_type',
      'channel_type',
      'function_type'
    ];
  }

  /**
   * 判断是否为内置函数
   */
  static isBuiltinFunction(funcName: string): boolean {
    const builtinFunctions = [
      'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len', 
      'make', 'new', 'panic', 'print', 'println', 'real', 'recover'
    ];
    return builtinFunctions.includes(funcName);
  }

  /**
   * 判断是否为导出标识符（首字母大写）
   */
  static isExportedIdentifier(identifier: string): boolean {
    return identifier.length > 0 && identifier[0] === identifier[0].toUpperCase();
  }

  /**
   * 提取函数参数
   */
  static extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter_declaration') {
          const identifier = child.childForFieldName('name');
          if (identifier) {
            parameters.push(identifier.text);
          }
        }
      }
    }
    return parameters;
  }

  /**
   * 提取方法接收者
   */
  static extractReceiver(node: Parser.SyntaxNode): string | null {
    const receiver = node.childForFieldName('receiver');
    return receiver ? receiver.text : null;
  }

  /**
   * 提取导入路径
   */
  static extractImportPath(node: Parser.SyntaxNode): string | undefined {
    if (node.type === 'import_spec') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/"/g, '') : undefined;
    }
    return undefined;
  }
}