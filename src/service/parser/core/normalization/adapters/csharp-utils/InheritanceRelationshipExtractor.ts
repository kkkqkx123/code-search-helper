import { CSharpHelperMethods } from './CSharpHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C#继承关系提取器
 * 处理类继承、接口实现、泛型继承、显式接口实现等继承关系
 */
export class CSharpInheritanceRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const inheritanceType = this.determineInheritanceType(astNode);

    if (!inheritanceType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractInheritanceNodes(astNode, inheritanceType);
    const additionalInfo = this.extractInheritanceInfo(astNode, inheritanceType);

    return {
      type: 'inheritance',
      fromNodeId,
      toNodeId,
      inheritanceType,
      ...additionalInfo,
      location: CSharpHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取继承关系数组
   */
  extractInheritanceRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isInheritanceNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractInheritanceMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定继承类型
   */
  private determineInheritanceType(astNode: Parser.SyntaxNode): string {
    const nodeType = astNode.type;

    // C#特有的继承类型
    if (nodeType === 'class_declaration') {
      const baseClassClause = astNode.childForFieldName('base_class_clause');
      if (baseClassClause) {
        const baseTypes = this.extractBaseTypes(baseClassClause);
        
        // 检查是否有多个基类型（多接口实现）
        if (baseTypes.length > 1) {
          return 'multiple_interface_implementation';
        }
        
        // 检查是否为泛型继承
        if (this.hasGenericInheritance(baseClassClause)) {
          return 'generic_inheritance';
        }
        
        // 检查第一个基类型是类还是接口
        const firstBaseType = baseTypes[0];
        if (this.isInterfaceType(firstBaseType, astNode)) {
          return 'interface_implementation';
        } else {
          return 'class_inheritance';
        }
      }
    } else if (nodeType === 'interface_declaration') {
      const baseClassClause = astNode.childForFieldName('base_class_clause');
      if (baseClassClause) {
        return 'interface_inheritance';
      }
    } else if (nodeType === 'struct_declaration') {
      const baseClassClause = astNode.childForFieldName('base_class_clause');
      if (baseClassClause) {
        return 'interface_implementation';
      }
    } else if (nodeType === 'record_declaration') {
      const baseClassClause = astNode.childForFieldName('base_class_clause');
      if (baseClassClause) {
        return 'record_inheritance';
      }
    } else if (nodeType === 'method_declaration') {
      // 检查是否为方法重写
      if (this.isOverrideMethod(astNode)) {
        return 'method_override';
      }
    } else if (nodeType === 'property_declaration') {
      // 检查是否为属性重写
      if (this.isOverrideProperty(astNode)) {
        return 'property_override';
      }
    } else if (nodeType === 'indexer_declaration') {
      // 检查是否为索引器重写
      if (this.isOverrideIndexer(astNode)) {
        return 'indexer_override';
      }
    } else if (nodeType === 'event_declaration') {
      // 检查是否为事件重写
      if (this.isOverrideEvent(astNode)) {
        return 'event_override';
      }
    } else if (nodeType === 'method_declaration' && this.isAbstractMethod(astNode)) {
      return 'abstract_method';
    } else if (nodeType === 'method_declaration' && this.isVirtualMethod(astNode)) {
      return 'virtual_method';
    } else if (nodeType === 'constructor_declaration') {
      // 检查是否有构造函数链式调用
      if (this.hasConstructorChaining(astNode)) {
        return 'constructor_chaining';
      }
    } else if (nodeType === 'delegate_declaration') {
      return 'delegate_inheritance';
    } else if (nodeType === 'type_parameter_constraints_clause') {
      return 'generic_constraint_inheritance';
    }

    return 'unknown';
  }

  /**
   * 提取继承关系的节点
   */
  private extractInheritanceNodes(astNode: Parser.SyntaxNode, inheritanceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = 'unknown';
    let toNodeId = 'unknown';

    switch (inheritanceType) {
      case 'class_inheritance':
      case 'interface_implementation':
      case 'multiple_interface_implementation':
      case 'generic_inheritance':
      case 'interface_inheritance':
      case 'struct_inheritance':
      case 'record_inheritance':
        fromNodeId = this.extractTypeNodeId(astNode);
        toNodeId = this.extractBaseTypeNodeId(astNode);
        break;

      case 'method_override':
      case 'property_override':
      case 'indexer_override':
      case 'event_override':
      case 'abstract_method':
      case 'virtual_method':
        fromNodeId = this.extractMemberNodeId(astNode);
        toNodeId = this.extractBaseMemberNodeId(astNode);
        break;

      case 'constructor_chaining':
        fromNodeId = this.extractConstructorNodeId(astNode);
        toNodeId = this.extractBaseConstructorNodeId(astNode);
        break;

      case 'delegate_inheritance':
        fromNodeId = this.extractDelegateNodeId(astNode);
        toNodeId = this.extractDelegateBaseNodeId(astNode);
        break;

      case 'generic_constraint_inheritance':
        fromNodeId = this.extractGenericConstraintNodeId(astNode);
        toNodeId = this.extractConstraintBaseNodeId(astNode);
        break;
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取继承信息
   */
  private extractInheritanceInfo(astNode: Parser.SyntaxNode, inheritanceType: string): any {
    const inheritanceInfo: any = {};

    switch (inheritanceType) {
      case 'multiple_interface_implementation':
        inheritanceInfo.implementedInterfaces = this.extractBaseTypes(astNode.childForFieldName('base_class_clause')!);
        break;

      case 'generic_inheritance':
        inheritanceInfo.genericArguments = this.extractGenericArguments(astNode);
        inheritanceInfo.typeParameters = this.extractTypeParameters(astNode);
        break;

      case 'method_override':
        inheritanceInfo.overrideMethod = this.extractMemberName(astNode);
        inheritanceInfo.overrideModifier = this.extractOverrideModifier(astNode);
        break;

      case 'property_override':
        inheritanceInfo.overrideProperty = this.extractMemberName(astNode);
        inheritanceInfo.propertyType = this.extractPropertyType(astNode);
        break;

      case 'abstract_method':
        inheritanceInfo.abstractMethod = this.extractMemberName(astNode);
        break;

      case 'virtual_method':
        inheritanceInfo.virtualMethod = this.extractMemberName(astNode);
        break;

      case 'constructor_chaining':
        inheritanceInfo.constructorName = this.extractConstructorName(astNode);
        inheritanceInfo.baseConstructor = this.extractBaseConstructor(astNode);
        break;

      case 'delegate_inheritance':
        inheritanceInfo.delegateName = this.extractDelegateName(astNode);
        inheritanceInfo.delegateParameters = this.extractDelegateParameters(astNode);
        break;

      case 'generic_constraint_inheritance':
        inheritanceInfo.constrainedType = this.extractConstrainedType(astNode);
        inheritanceInfo.constraintTypes = this.extractConstraintTypes(astNode);
        break;
    }

    return inheritanceInfo;
  }

  /**
   * 提取基类型
   */
  private extractBaseTypes(baseClassClause: Parser.SyntaxNode): string[] {
    const baseTypes: string[] = [];
    for (const child of baseClassClause.children) {
      if (child.type === 'identifier' || child.type === 'generic_type') {
        baseTypes.push(child.text);
      }
    }
    return baseTypes;
  }

  /**
   * 检查是否有泛型继承
   */
  private hasGenericInheritance(baseClassClause: Parser.SyntaxNode): boolean {
    for (const child of baseClassClause.children) {
      if (child.type === 'generic_type') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为接口类型
   */
  private isInterfaceType(baseType: string, contextNode: Parser.SyntaxNode): boolean {
    // 简单的启发式判断：如果基类型以I开头且后面是大写字母，可能是接口
    return /^I[A-Z]/.test(baseType);
  }

  /**
   * 检查是否为重写方法
   */
  private isOverrideMethod(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'override') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为重写属性
   */
  private isOverrideProperty(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'override') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为重写索引器
   */
  private isOverrideIndexer(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'override') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为重写事件
   */
  private isOverrideEvent(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'override') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为抽象方法
   */
  private isAbstractMethod(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'abstract') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为虚方法
   */
  private isVirtualMethod(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'virtual') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否有构造函数链式调用
   */
  private hasConstructorChaining(astNode: Parser.SyntaxNode): boolean {
    const initializer = astNode.childForFieldName('initializer');
    return !!initializer;
  }

  /**
   * 提取类型节点ID
   */
  private extractTypeNodeId(astNode: Parser.SyntaxNode): string {
    const nameNode = astNode.childForFieldName('name');
    return CSharpHelperMethods.generateNodeId(nameNode || astNode);
  }

  /**
   * 提取基类型节点ID
   */
  private extractBaseTypeNodeId(astNode: Parser.SyntaxNode): string {
    const baseClassClause = astNode.childForFieldName('base_class_clause');
    if (baseClassClause) {
      for (const child of baseClassClause.children) {
        if (child.type === 'identifier' || child.type === 'generic_type') {
          return CSharpHelperMethods.generateNodeId(child);
        }
      }
    }
    return 'unknown';
  }

  /**
   * 提取成员节点ID
   */
  private extractMemberNodeId(astNode: Parser.SyntaxNode): string {
    const nameNode = astNode.childForFieldName('name');
    return CSharpHelperMethods.generateNodeId(nameNode || astNode);
  }

  /**
   * 提取基成员节点ID
   */
  private extractBaseMemberNodeId(astNode: Parser.SyntaxNode): string {
    const memberName = this.extractMemberName(astNode);
    if (memberName) {
      return CSharpHelperMethods.generateNodeId(astNode, 'base_member');
    }
    return 'unknown';
  }

  /**
   * 提取构造函数节点ID
   */
  private extractConstructorNodeId(astNode: Parser.SyntaxNode): string {
    const nameNode = astNode.childForFieldName('name');
    return CSharpHelperMethods.generateNodeId(nameNode || astNode);
  }

  /**
   * 提取基构造函数节点ID
   */
  private extractBaseConstructorNodeId(astNode: Parser.SyntaxNode): string {
    const initializer = astNode.childForFieldName('initializer');
    return initializer ? CSharpHelperMethods.generateNodeId(initializer) : 'unknown';
  }

  /**
   * 提取委托节点ID
   */
  private extractDelegateNodeId(astNode: Parser.SyntaxNode): string {
    const nameNode = astNode.childForFieldName('name');
    return CSharpHelperMethods.generateNodeId(nameNode || astNode);
  }

  /**
   * 提取委托基节点ID
   */
  private extractDelegateBaseNodeId(astNode: Parser.SyntaxNode): string {
    const returnType = astNode.childForFieldName('return_type');
    return returnType ? CSharpHelperMethods.generateNodeId(returnType) : 'unknown';
  }

  /**
   * 提取泛型约束节点ID
   */
  private extractGenericConstraintNodeId(astNode: Parser.SyntaxNode): string {
    for (const child of astNode.children) {
      if (child.type === 'identifier') {
        return CSharpHelperMethods.generateNodeId(child);
      }
    }
    return 'unknown';
  }

  /**
   * 提取约束基节点ID
   */
  private extractConstraintBaseNodeId(astNode: Parser.SyntaxNode): string {
    for (const child of astNode.children) {
      if (child.type === 'type_parameter_constraint') {
        const typeNode = child.childForFieldName('type');
        if (typeNode) {
          return CSharpHelperMethods.generateNodeId(typeNode);
        }
      }
    }
    return 'unknown';
  }

  /**
   * 提取泛型参数
   */
  private extractGenericArguments(astNode: Parser.SyntaxNode): string[] {
    const genericArgs: string[] = [];
    const baseClassClause = astNode.childForFieldName('base_class_clause');
    if (baseClassClause) {
      for (const child of baseClassClause.children) {
        if (child.type === 'generic_type') {
          const argsNode = child.childForFieldName('type_arguments');
          if (argsNode) {
            for (const argChild of argsNode.children) {
              if (argChild.type === 'identifier') {
                genericArgs.push(argChild.text);
              }
            }
          }
        }
      }
    }
    return genericArgs;
  }

  /**
   * 提取类型参数
   */
  private extractTypeParameters(astNode: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const typeParameters = astNode.childForFieldName('type_parameters');
    if (typeParameters) {
      for (const child of typeParameters.children) {
        if (child.type === 'type_parameter') {
          const nameNode = child.childForFieldName('name');
          if (nameNode) {
            parameters.push(nameNode.text);
          }
        }
      }
    }
    return parameters;
  }

  /**
   * 提取成员名称
   */
  private extractMemberName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取重写修饰符
   */
  private extractOverrideModifier(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'identifier' && child.text === 'override') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取属性类型
   */
  private extractPropertyType(astNode: Parser.SyntaxNode): string | null {
    const typeNode = astNode.childForFieldName('type');
    return typeNode ? typeNode.text : null;
  }

  /**
   * 提取构造函数名称
   */
  private extractConstructorName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取基构造函数
   */
  private extractBaseConstructor(astNode: Parser.SyntaxNode): string | null {
    const initializer = astNode.childForFieldName('initializer');
    return initializer ? initializer.text : null;
  }

  /**
   * 提取委托名称
   */
  private extractDelegateName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取委托参数
   */
  private extractDelegateParameters(astNode: Parser.SyntaxNode): any[] {
    const parameters: any[] = [];
    const parametersNode = astNode.childForFieldName('parameters');
    if (parametersNode) {
      for (const child of parametersNode.children) {
        if (child.type === 'parameter') {
          const nameNode = child.childForFieldName('name');
          const typeNode = child.childForFieldName('type');
          parameters.push({
            name: nameNode ? nameNode.text : 'unknown',
            type: typeNode ? typeNode.text : 'unknown'
          });
        }
      }
    }
    return parameters;
  }

  /**
   * 提取约束类型
   */
  private extractConstrainedType(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * 提取约束类型列表
   */
  private extractConstraintTypes(astNode: Parser.SyntaxNode): string[] {
    const types: string[] = [];
    for (const child of astNode.children) {
      if (child.type === 'type_parameter_constraint') {
        const typeNode = child.childForFieldName('type');
        if (typeNode) {
          types.push(typeNode.text);
        }
      }
    }
    return types;
  }

  /**
   * 判断是否为继承关系节点
   */
  private isInheritanceNode(astNode: Parser.SyntaxNode): boolean {
    const inheritanceNodeTypes = [
      'class_declaration',
      'interface_declaration',
      'struct_declaration',
      'record_declaration',
      'method_declaration',
      'property_declaration',
      'indexer_declaration',
      'event_declaration',
      'constructor_declaration',
      'delegate_declaration',
      'type_parameter_constraints_clause'
    ];

    if (!inheritanceNodeTypes.includes(astNode.type)) {
      return false;
    }

    // 进一步检查是否确实包含继承关系
    switch (astNode.type) {
      case 'class_declaration':
      case 'interface_declaration':
      case 'struct_declaration':
      case 'record_declaration':
        return !!astNode.childForFieldName('base_class_clause');
      
      case 'method_declaration':
        return this.isOverrideMethod(astNode) || this.isAbstractMethod(astNode) || this.isVirtualMethod(astNode);
      
      case 'property_declaration':
        return this.isOverrideProperty(astNode);
      
      case 'indexer_declaration':
        return this.isOverrideIndexer(astNode);
      
      case 'event_declaration':
        return this.isOverrideEvent(astNode);
      
      case 'constructor_declaration':
        return this.hasConstructorChaining(astNode);
      
      default:
        return true; // 其他类型默认认为是继承关系
    }
  }
}