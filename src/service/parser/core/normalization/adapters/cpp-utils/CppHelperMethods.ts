import Parser from 'tree-sitter';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';

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

  /**
   * 提取调用名称
   */
  static extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    const functionNode = callExpr.childForFieldName('function');
    if (functionNode?.text) {
      return functionNode.text;
    }
    
    // 如果没有function字段，尝试从第一个子节点提取
    if (callExpr.children && callExpr.children.length > 0) {
      const firstChild = callExpr.children[0];
      if (firstChild.type === 'identifier') {
        return firstChild.text;
      } else if (firstChild.type === 'field_expression') {
        return this.extractFieldNameFromFieldExpression(firstChild);
      }
    }
    
    return null;
  }

  /**
   * 从字段表达式中提取字段名
   */
  static extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 确定调用类型
   */
  static determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 检查是否为构造函数调用
    if (callExpr.parent?.type === 'new_expression') {
      return 'constructor';
    }

    // 检查是否为方法调用
    if (callExpr.children[0]?.type === 'field_expression') {
      return 'method';
    }

    // 如果有解析的符号信息，使用符号信息
    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      } else if (resolvedSymbol.isStatic) {
        return 'static';
      }
    }

    return 'function';
  }

  /**
   * 分析调用上下文
   */
  static analyzeCallContext(callExpr: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'field_expression';
    const isAsync = callExpr.text.includes('co_await'); // C++20协程支持

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算调用链深度
   */
  static calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'field_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 提取数据流源节点
   */
  static extractDataFlowSource(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'assignment_expression':
        return node.childForFieldName('right');
      case 'parameter_list':
        return node.childForFieldName('parameter');
      case 'return_statement':
        return node.childForFieldName('expression');
      default:
        return null;
    }
  }

  /**
   * 提取数据流目标节点
   */
  static extractDataFlowTarget(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'assignment_expression':
        return node.childForFieldName('left');
      case 'parameter_list':
        return node.childForFieldName('parameter');
      case 'return_statement':
        return node.parent?.childForFieldName('name') ?? null;
      default:
        return null;
    }
  }

  /**
   * 确定数据流类型
   */
  static determineDataFlowType(node: Parser.SyntaxNode): 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' {
    if (node.type === 'assignment_expression') {
      return 'variable_assignment';
    } else if (node.type === 'parameter_list') {
      return 'parameter_passing';
    } else if (node.type === 'return_statement') {
      return 'return_value';
    } else if (node.type === 'field_expression') {
      return 'field_access';
    }
    return 'variable_assignment';
  }

  /**
   * 提取依赖目标
   */
  static extractDependencyTarget(node: Parser.SyntaxNode): string | null {
    switch (node.type) {
      case 'preproc_include':
        return this.extractIncludePath(node);
      case 'using_declaration':
      case 'using_directive':
        return this.extractUsingName(node);
      case 'template_type':
      case 'template_function':
        return this.extractTemplateName(node);
      case 'base_class_clause':
        return this.extractBaseClassName(node);
      case 'call_expression':
        return this.extractCalleeName(node);
      default:
        return this.extractIdentifier(node);
    }
  }

  /**
   * 提取包含路径
   */
  static extractIncludePath(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'string_literal' || child.type === 'system_lib_string') {
        return child.text?.replace(/['"<>/]/g, '') || null;
      }
    }
    return null;
  }

  /**
   * 提取using名称
   */
  static extractUsingName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取模板名称
   */
  static extractTemplateName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取基类名称
   */
  static extractBaseClassName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'type_identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取标识符
   */
  static extractIdentifier(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 创建标准位置信息
   */
  static createLocationInfo(node: Parser.SyntaxNode, filePath?: string): {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  } {
    return {
      filePath: filePath || 'current_file.cpp',
      lineNumber: node.startPosition.row + 1,
      columnNumber: node.startPosition.column + 1,
    };
  }

  /**
   * 生成节点ID
   */
  static generateNodeId(node: Parser.SyntaxNode, prefix?: string): string {
    if (!node) {
      return 'unknown';
    }
    
    if (prefix) {
      return `${prefix}_${NodeIdGenerator.forAstNode(node)}`;
    }
    
    return NodeIdGenerator.forAstNode(node);
  }

  /**
   * 判断是否为依赖节点
   */
  static isDependencyNode(node: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'preproc_include',
      'using_declaration',
      'using_directive',
      'template_type',
      'template_function',
      'namespace_definition',
      'friend_declaration',
      'base_class_clause',
      'type_parameter_constraints_clause',
      'attribute_list',
      'declaration',
      'call_expression',
      'field_expression',
      'member_access_expression',
      'assignment_expression',
      'delegate_declaration',
      'lambda_expression'
    ];

    return dependencyNodeTypes.includes(node.type);
  }

  /**
   * 判断是否为调用节点
   */
  static isCallNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'call_expression';
  }

  /**
   * 判断是否为数据流节点
   */
  static isDataFlowNode(node: Parser.SyntaxNode): boolean {
    const dataFlowNodeTypes = [
      'assignment_expression',
      'parameter_list',
      'return_statement',
      'field_expression'
    ];
    return dataFlowNodeTypes.includes(node.type);
  }
}