import { CSharpHelperMethods } from './CSharpHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C#依赖关系提取器
 * 处理using指令、程序集引用、类型引用、接口实现等依赖关系
 */
export class CSharpDependencyRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取依赖关系元数据
   */
  extractDependencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const dependencyType = this.determineDependencyType(astNode);

    if (!dependencyType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractDependencyNodes(astNode, dependencyType);
    const target = CSharpHelperMethods.extractDependencyTarget(astNode);
    const additionalInfo = this.extractAdditionalInfo(astNode, dependencyType);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      ...additionalInfo,
      location: CSharpHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取依赖关系数组
   */
  extractDependencyRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CSharpHelperMethods.isDependencyNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractDependencyMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定依赖类型
   */
  private determineDependencyType(astNode: Parser.SyntaxNode): string {
    const nodeType = astNode.type;

    // C#特有的依赖类型
    if (nodeType === 'using_directive') {
      return this.determineUsingDirectiveType(astNode);
    } else if (nodeType === 'attribute_list') {
      return 'assembly_reference';
    } else if (nodeType === 'base_class_clause') {
      return this.determineBaseClassType(astNode);
    } else if (nodeType === 'type_parameter_constraints_clause') {
      return 'generic_constraint';
    } else if (nodeType === 'method_declaration' && this.isExtensionMethod(astNode)) {
      return 'extension_method';
    } else if (nodeType === 'query_expression') {
      return 'linq_query';
    } else if (nodeType === 'attribute') {
      return 'attribute_usage';
    } else if (nodeType === 'delegate_declaration') {
      return 'delegate_definition';
    } else if (nodeType === 'lambda_expression') {
      return 'lambda_expression';
    } else if (nodeType === 'method_declaration' && this.isAsyncMethod(astNode)) {
      return 'async_method';
    } else if (nodeType === 'await_expression') {
      return 'await_expression';
    }

    // 通用依赖类型
    if (nodeType === 'declaration') {
      return 'type_reference';
    } else if (nodeType === 'invocation_expression') {
      return 'method_call';
    } else if (nodeType === 'member_access_expression') {
      return 'member_access';
    } else if (nodeType === 'assignment_expression') {
      return this.determineAssignmentType(astNode);
    }

    return 'unknown';
  }

  /**
   * 确定using指令类型
   */
  private determineUsingDirectiveType(astNode: Parser.SyntaxNode): string {
    // 检查是否为静态using
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'static') {
        return 'using_static';
      }
    }
    
    // 检查是否为别名using
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === '=') {
        return 'using_alias';
      }
    }
    
    return 'using_namespace';
  }

  /**
   * 确定基类类型
   */
  private determineBaseClassType(astNode: Parser.SyntaxNode): string {
    const parent = astNode.parent;
    if (!parent) return 'unknown';

    if (parent.type === 'class_declaration') {
      return 'class_inheritance';
    } else if (parent.type === 'interface_declaration') {
      return 'interface_inheritance';
    } else if (parent.type === 'struct_declaration') {
      return 'struct_inheritance';
    }

    return 'unknown';
  }

  /**
   * 确定赋值类型
   */
  private determineAssignmentType(astNode: Parser.SyntaxNode): string {
    const left = astNode.childForFieldName('left');
    if (left && left.type === 'member_access_expression') {
      // 检查是否为事件订阅
      const right = astNode.childForFieldName('right');
      if (right && (right.type === 'identifier' || right.type === 'lambda_expression')) {
        return 'event_subscription';
      }
    }
    return 'assignment';
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = CSharpHelperMethods.generateNodeId(astNode);
    let toNodeId = 'unknown';
    const target = CSharpHelperMethods.extractDependencyTarget(astNode);

    if (target) {
      const symbolType = this.getSymbolTypeForDependency(dependencyType);
      toNodeId = CSharpHelperMethods.generateNodeId(astNode, symbolType);
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 根据依赖类型获取符号类型
   */
  private getSymbolTypeForDependency(dependencyType: string): string {
    switch (dependencyType) {
      case 'using_namespace':
      case 'using_static':
      case 'using_alias':
        return 'namespace';
      case 'assembly_reference':
        return 'assembly';
      case 'class_inheritance':
      case 'interface_inheritance':
      case 'struct_inheritance':
      case 'generic_constraint':
        return 'type';
      case 'extension_method':
        return 'type';
      case 'linq_query':
        return 'variable';
      case 'attribute_usage':
        return 'attribute';
      case 'method_call':
        return 'method';
      case 'member_access':
        return 'object';
      case 'event_subscription':
        return 'event';
      default:
        return 'symbol';
    }
  }

  /**
   * 提取附加信息
   */
  private extractAdditionalInfo(astNode: Parser.SyntaxNode, dependencyType: string): any {
    const additionalInfo: any = {};

    switch (dependencyType) {
      case 'using_static':
        additionalInfo.staticMember = this.extractStaticMember(astNode);
        break;

      case 'using_alias':
        additionalInfo.aliasName = this.extractAliasName(astNode);
        additionalInfo.aliasType = this.extractAliasType(astNode);
        break;

      case 'assembly_reference':
        additionalInfo.assemblyAttributes = this.extractAssemblyAttributes(astNode);
        break;

      case 'generic_constraint':
        additionalInfo.constraints = this.extractGenericConstraints(astNode);
        break;

      case 'extension_method':
        additionalInfo.extensionMethodName = this.extractExtensionMethodName(astNode);
        break;

      case 'linq_query':
        additionalInfo.linqOperations = this.extractLinqOperations(astNode);
        break;

      case 'attribute_usage':
        additionalInfo.attributeArguments = this.extractAttributeArguments(astNode);
        break;

      case 'method_call':
        additionalInfo.methodArguments = this.extractMethodArguments(astNode);
        break;

      case 'member_access':
        const memberInfo = this.extractMemberInfo(astNode);
        additionalInfo.memberName = memberInfo.memberName;
        break;

      case 'event_subscription':
        const eventInfo = this.extractEventInfo(astNode);
        additionalInfo.eventHandler = eventInfo.eventHandler;
        break;

      case 'async_method':
        additionalInfo.returnType = this.extractAsyncReturnType(astNode);
        break;

      case 'await_expression':
        additionalInfo.awaitedType = this.extractAwaitedType(astNode);
        break;
    }

    return additionalInfo;
  }

  /**
   * 检查是否为扩展方法
   */
  private isExtensionMethod(astNode: Parser.SyntaxNode): boolean {
    const parameterList = astNode.childForFieldName('parameters');
    if (!parameterList) return false;

    const firstParameter = parameterList.childForFieldName('0');
    if (!firstParameter) return false;

    // 检查第一个参数是否有this修饰符
    for (const child of firstParameter.children) {
      if (child.type === 'identifier' && child.text === 'this') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为异步方法
   */
  private isAsyncMethod(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'async') {
        return true;
      }
    }
    return false;
  }

  /**
   * 提取静态成员
   */
  private extractStaticMember(astNode: Parser.SyntaxNode): string | null {
    // 对于using static，提取静态成员名称
    for (let i = 0; i < astNode.children.length; i++) {
      const child = astNode.children[i];
      if (child.type === 'identifier' && child.text === 'static') {
        // 下一个节点应该是静态类名
        const nextChild = astNode.children[i + 1];
        if (nextChild && nextChild.type === 'identifier') {
          return nextChild.text;
        }
      }
    }
    return null;
  }

  /**
   * 提取别名名称
   */
  private extractAliasName(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取别名类型
   */
  private extractAliasType(astNode: Parser.SyntaxNode): string | null {
    let foundEquals = false;
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === '=') {
        foundEquals = true;
      } else if (foundEquals && child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取程序集属性
   */
  private extractAssemblyAttributes(astNode: Parser.SyntaxNode): any[] {
    const attributes: any[] = [];
    for (const child of astNode.children) {
      if (child.type === 'attribute') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          attributes.push({
            name: nameNode.text,
            arguments: this.extractAttributeArguments(child)
          });
        }
      }
    }
    return attributes;
  }

  /**
   * 提取泛型约束
   */
  private extractGenericConstraints(astNode: Parser.SyntaxNode): string[] {
    const constraints: string[] = [];
    for (const child of astNode.children) {
      if (child.type === 'type_parameter_constraint') {
        constraints.push(child.text);
      }
    }
    return constraints;
  }

  /**
   * 提取扩展方法名
   */
  private extractExtensionMethodName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取LINQ操作
   */
  private extractLinqOperations(astNode: Parser.SyntaxNode): string[] {
    const operations: string[] = [];
    const queryBody = astNode.childForFieldName('query_body');
    if (queryBody) {
      for (const child of queryBody.children) {
        if (child.type.includes('clause')) {
          operations.push(child.type);
        }
      }
    }
    return operations;
  }

  /**
   * 提取特性参数
   */
  private extractAttributeArguments(astNode: Parser.SyntaxNode): any[] {
    const attributeArgs: any[] = [];
    const argsNode = astNode.childForFieldName('arguments');
    if (argsNode) {
      for (const child of argsNode.children) {
        if (child.type === 'attribute_argument') {
          attributeArgs.push({
            value: child.text,
            type: child.type
          });
        }
      }
    }
    return attributeArgs;
  }

  /**
   * 提取方法参数
   */
  private extractMethodArguments(astNode: Parser.SyntaxNode): any[] {
    const methodArgs: any[] = [];
    const argsNode = astNode.childForFieldName('arguments');
    if (argsNode) {
      for (const child of argsNode.children) {
        if (child.type === 'argument') {
          methodArgs.push({
            value: child.text,
            type: child.type
          });
        }
      }
    }
    return methodArgs;
  }

  /**
   * 提取成员信息
   */
  private extractMemberInfo(astNode: Parser.SyntaxNode): { objectName: string | null; memberName: string | null } {
    return CSharpHelperMethods.extractMemberInfo(astNode);
  }

  /**
   * 提取事件信息
   */
  private extractEventInfo(astNode: Parser.SyntaxNode): { eventName: string | null; eventHandler: string | null } {
    const left = astNode.childForFieldName('left');
    const right = astNode.childForFieldName('right');
    
    let eventName: string | null = null;
    let eventHandler: string | null = null;
    
    if (left && left.type === 'member_access_expression') {
      const nameNode = left.childForFieldName('name');
      eventName = nameNode ? nameNode.text : null;
    }
    
    if (right) {
      eventHandler = right.text;
    }
    
    return { eventName, eventHandler };
  }

  /**
   * 提取异步返回类型
   */
  private extractAsyncReturnType(astNode: Parser.SyntaxNode): string | null {
    const typeNode = astNode.childForFieldName('type');
    if (typeNode && typeNode.type === 'generic_type') {
      return typeNode.text;
    }
    return null;
  }

  /**
   * 提取awaited类型
   */
  private extractAwaitedType(astNode: Parser.SyntaxNode): string | null {
    const expressionNode = astNode.childForFieldName('expression');
    return expressionNode ? expressionNode.text : null;
  }
}