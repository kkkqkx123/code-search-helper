import Parser from 'tree-sitter';

/**
 * Java 辅助方法集合
 * 从 JavaLanguageAdapter 迁移的通用辅助方法
 */
export class JavaHelperMethods {
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
      if (current.type === 'method_declaration' || current.type === 'constructor_declaration') {
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
      if (child.type === 'type_identifier' || child.type === 'scoped_type_identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          dependencies.push(text);
        }
      }

      this.findTypeReferences(child, dependencies);
    }
  }

  /**
   * 查找方法调用引用
   */
  static findMethodCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找方法调用
      if (child.type === 'method_invocation') {
        const methodNode = child.childForFieldName('name');
        if (methodNode?.text) {
          dependencies.push(methodNode.text);
        }
      }
      
      this.findMethodCalls(child, dependencies);
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
      // 查找泛型类型参数
      if (child.type === 'type_arguments' || child.type === 'type_parameters') {
        for (const typeChild of child.children) {
          if (typeChild.type === 'type_identifier' && typeChild.text) {
            dependencies.push(typeChild.text);
          }
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
      if (child.type === 'method_invocation') {
        const methodNode = child.childForFieldName('name');
        if (methodNode?.text) {
          const methodText = methodNode.text.toLowerCase();
          if (methodText.includes('thread') || methodText.includes('mutex') || 
              methodText.includes('lock') || methodText.includes('future') || 
              methodText.includes('promise') || methodText.includes('async') ||
              methodText.includes('wait') || methodText.includes('notify') ||
              methodText.includes('synchronized') || methodText.includes('executor')) {
            dependencies.push(methodText);
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
      'method_declaration',
      'constructor_declaration',
      'lambda_expression'
    ];
    return functionTypes.includes(node.type);
  }

  /**
   * 获取语言特定的函数类型
   */
  static getLanguageSpecificFunctionTypes(): string[] {
    return [
      'method_declaration',
      'constructor_declaration',
      'lambda_expression'
    ];
  }

  /**
   * 提取注解信息
   */
  static extractAnnotations(node: any): string[] {
    const annotations: string[] = [];
    
    if (!node || !node.children) {
      return annotations;
    }

    for (const child of node.children) {
      if (child.type === 'annotation' || child.type === 'marker_annotation') {
        annotations.push(child.text);
      }
      annotations.push(...this.extractAnnotations(child));
    }

    return annotations;
  }

  /**
   * 查找依赖项
   */
  static findDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入语句
      if (child.type === 'import_declaration') {
        const importPath = child.childForFieldName('name');
        if (importPath?.text) {
          // 从导入路径中提取类名
          const parts = importPath.text.split('.');
          if (parts.length > 0) {
            dependencies.push(parts[parts.length - 1]);
          }
        }
      }

      this.findDependencies(child, dependencies);
    }
  }
}