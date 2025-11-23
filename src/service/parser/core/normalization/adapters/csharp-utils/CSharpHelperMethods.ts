import Parser from 'tree-sitter';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';

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

  /**
   * 提取调用名称
   */
  static extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_access_expression') {
        return this.extractMethodNameFromMemberExpression(funcNode);
      } else if (funcNode.type === 'conditional_access_expression') {
        return this.extractMethodNameFromConditionalAccess(funcNode);
      }
    }
    return null;
  }

  /**
   * 从成员访问表达式中提取方法名
   */
  static extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 从条件访问表达式中提取方法名
   */
  static extractMethodNameFromConditionalAccess(conditionalAccess: Parser.SyntaxNode): string | null {
    if (conditionalAccess.children && conditionalAccess.children.length > 0) {
      const memberBinding = conditionalAccess.children.find(child => child.type === 'member_binding_expression');
      if (memberBinding) {
        const nameNode = memberBinding.childForFieldName('name');
        if (nameNode?.text) {
          return nameNode.text;
        }
      }
    }
    return null;
  }

  /**
   * 确定调用类型
   */
  static determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' | 'extension' | 'async' {
    if (callExpr.parent?.type === 'object_creation_expression') {
      return 'constructor';
    }

    if (callExpr.parent?.type === 'attribute_list') {
      return 'decorator';
    }

    const funcNode = callExpr.children[0];
    if (funcNode?.type === 'member_access_expression') {
      return 'method';
    }

    if (callExpr.text.includes('await')) {
      return 'async';
    }

    if (this.isExtensionMethodCall(callExpr)) {
      return 'extension';
    }

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
    isExtension: boolean;
  } {
    const isChained = callExpr.parent?.type === 'invocation_expression' ||
                     callExpr.parent?.type === 'member_access_expression' ||
                     callExpr.parent?.type === 'conditional_access_expression';
    const isAsync = callExpr.text.includes('await');
    const isExtension = this.isExtensionMethodCall(callExpr);

    return {
      isChained,
      isAsync,
      isExtension,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算链式调用深度
   */
  static calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (
      current.parent.type === 'invocation_expression' ||
      current.parent.type === 'member_access_expression' ||
      current.parent.type === 'conditional_access_expression'
    )) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 判断是否为扩展方法调用
   */
  static isExtensionMethodCall(callExpr: Parser.SyntaxNode): boolean {
    // 简化判断：如果调用的是静态方法但通过实例调用，可能是扩展方法
    const funcNode = callExpr.children[0];
    if (funcNode?.type === 'member_access_expression') {
      // 检查是否是 this 参数的扩展方法
      return funcNode.text.includes('.'); // 简化判断
    }
    return false;
  }

  /**
   * 提取数据流源节点
   */
  static extractDataFlowSource(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'assignment_expression':
        return node.childForFieldName('right');
      case 'parameter':
        return node.childForFieldName('type');
      case 'return_statement':
        return node.childForFieldName('expression');
      case 'member_access_expression':
        return node.childForFieldName('expression');
      case 'property_declaration':
        return node.childForFieldName('accessors');
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
      case 'parameter':
        return node.childForFieldName('name');
      case 'return_statement':
        return node.parent?.childForFieldName('name') ?? null;
      case 'member_access_expression':
        return node.childForFieldName('name');
      case 'property_declaration':
        return node.childForFieldName('name');
      default:
        return null;
    }
  }

  /**
   * 确定数据流类型
   */
  static determineDataFlowType(node: Parser.SyntaxNode): 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'property_access' {
    if (node.type === 'assignment_expression') {
      return 'variable_assignment';
    } else if (node.type === 'parameter') {
      return 'parameter_passing';
    } else if (node.type === 'return_statement') {
      return 'return_value';
    } else if (node.type === 'member_access_expression') {
      return 'field_access';
    } else if (node.type === 'property_declaration') {
      return 'property_access';
    }

    return 'variable_assignment';
  }

  /**
   * 提取依赖目标
   */
  static extractDependencyTarget(node: Parser.SyntaxNode): string | null {
    switch (node.type) {
      case 'using_directive':
        return this.extractUsingName(node);
      case 'attribute_list':
        return this.extractAssemblyName(node);
      case 'base_class_clause':
        return this.extractBaseTypeName(node);
      case 'type_parameter_constraints_clause':
        return this.extractConstraintType(node);
      case 'method_declaration':
        return this.extractMethodName(node);
      case 'invocation_expression':
        return this.extractCalleeName(node);
      case 'member_access_expression':
        const memberInfo = this.extractMemberInfo(node);
        return memberInfo.objectName;
      default:
        return this.extractIdentifier(node);
    }
  }

  /**
   * 提取using名称
   */
  static extractUsingName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取程序集名称
   */
  static extractAssemblyName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'attribute') {
        const nameNode = child.childForFieldName('name');
        if (nameNode && nameNode.text === 'assembly') {
          const argsNode = child.childForFieldName('arguments');
          if (argsNode) {
            for (const argChild of argsNode.children) {
              if (argChild.type === 'attribute_argument') {
                const stringLiteral = argChild.childForFieldName('value');
                if (stringLiteral && stringLiteral.type === 'string_literal') {
                  return stringLiteral.text.replace(/['"]/g, '');
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取基类型名称
   */
  static extractBaseTypeName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取约束类型
   */
  static extractConstraintType(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'type_parameter_constraint') {
        const typeNode = child.childForFieldName('type');
        if (typeNode) {
          return typeNode.text;
        }
      }
    }
    return null;
  }

  /**
   * 提取成员信息
   */
  static extractMemberInfo(node: Parser.SyntaxNode): { objectName: string | null; memberName: string | null } {
    const expressionNode = node.childForFieldName('expression');
    const nameNode = node.childForFieldName('name');
    
    return {
      objectName: expressionNode ? expressionNode.text : null,
      memberName: nameNode ? nameNode.text : null
    };
  }

  /**
   * 提取标识符
   */
  static extractIdentifier(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier') {
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
      filePath: filePath || 'current_file.cs',
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
      'using_directive',
      'attribute_list',
      'base_class_clause',
      'type_parameter_constraints_clause',
      'method_declaration',
      'query_expression',
      'attribute',
      'delegate_declaration',
      'lambda_expression',
      'await_expression',
      'declaration',
      'invocation_expression',
      'member_access_expression',
      'assignment_expression'
    ];

    return dependencyNodeTypes.includes(node.type);
  }

  /**
   * 判断是否为调用节点
   */
  static isCallNode(node: Parser.SyntaxNode): boolean {
    return node.type === 'invocation_expression';
  }

  /**
   * 判断是否为数据流节点
   */
  static isDataFlowNode(node: Parser.SyntaxNode): boolean {
    const dataFlowNodeTypes = [
      'assignment_expression',
      'parameter',
      'return_statement',
      'member_access_expression',
      'property_declaration'
    ];
    return dataFlowNodeTypes.includes(node.type);
  }
}