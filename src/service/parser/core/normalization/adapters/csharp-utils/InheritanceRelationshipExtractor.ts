import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 继承关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const inheritanceType = this.determineInheritanceType(astNode);
    const baseTypes = this.extractBaseTypes(astNode);
    const derivedType = this.extractDerivedType(astNode);

    return {
      type: 'inheritance',
      fromNodeId: derivedType ? generateDeterministicNodeId(derivedType) : 'unknown',
      toNodeId: baseTypes.length > 0 ? generateDeterministicNodeId(baseTypes[0]) : 'unknown',
      inheritanceType,
      baseTypes: baseTypes.map(type => type.text),
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定继承类型
   */
  private determineInheritanceType(node: Parser.SyntaxNode): 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct' {
    switch (node.type) {
      case 'class_declaration':
      case 'record_class_declaration':
        return 'extends';
      case 'interface_declaration':
        return 'implements';
      case 'struct_declaration':
      case 'record_struct_declaration':
        return 'implements'; // C# 结构体可以实现接口
      case 'enum_declaration':
        return 'enum_member';
      default:
        return 'extends';
    }
  }

  /**
   * 提取基类型
   */
  private extractBaseTypes(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const baseList = node.childForFieldName('base_list');
    if (!baseList) {
      return [];
    }

    const baseTypes: Parser.SyntaxNode[] = [];
    for (const child of baseList.children) {
      if (child.type === 'type') {
        baseTypes.push(child);
      }
    }
    return baseTypes;
  }

  /**
   * 提取派生类型
   */
  private extractDerivedType(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    return node.childForFieldName('name');
  }

  /**
   * 分析接口实现关系
   */
  analyzeInterfaceImplementation(node: Parser.SyntaxNode): Array<{
    implementingType: string;
    interfaceType: string;
    implementedMembers: string[];
  }> {
    const implementations: Array<{
      implementingType: string;
      interfaceType: string;
      implementedMembers: string[];
    }> = [];

    if (!CSharpHelperMethods.isClassNode(node) && !CSharpHelperMethods.isClassNode(node)) {
      return implementations;
    }

    const baseTypes = this.extractBaseTypes(node);
    const implementingTypeName = CSharpHelperMethods.extractClassName(node);

    if (!implementingTypeName) {
      return implementations;
    }

    for (const baseType of baseTypes) {
      // 检查是否为接口（简化判断，实际需要符号表解析）
      if (this.isLikelyInterface(baseType)) {
        const interfaceTypeName = baseType.text;
        const implementedMembers = this.findImplementedMembers(node, interfaceTypeName);

        implementations.push({
          implementingType: implementingTypeName,
          interfaceType: interfaceTypeName,
          implementedMembers
        });
      }
    }

    return implementations;
  }

  /**
   * 判断是否可能是接口
   */
  private isLikelyInterface(node: Parser.SyntaxNode): boolean {
    // 简化判断：以I开头且不是基本类型
    const text = node.text;
    return text.startsWith('I') && text.length > 1 && text[1] === text[1].toUpperCase();
  }

  /**
   * 查找实现的成员
   */
  private findImplementedMembers(classNode: Parser.SyntaxNode, interfaceName: string): string[] {
    const implementedMembers: string[] = [];

    // 遍历类的所有成员，查找可能实现接口的成员
    for (const child of classNode.children) {
      if (child.type === 'method_declaration' || 
          child.type === 'property_declaration' ||
          child.type === 'event_declaration') {
        
        const memberName = CSharpHelperMethods.extractMethodName(child) || 
                          CSharpHelperMethods.extractPropertyName(child);
        
        if (memberName) {
          implementedMembers.push(memberName);
        }
      }
    }

    return implementedMembers;
  }

  /**
   * 分析类继承层次
   */
  analyzeClassHierarchy(node: Parser.SyntaxNode): Array<{
    derivedType: string;
    baseType: string;
    inheritanceLevel: number;
  }> {
    const hierarchy: Array<{
      derivedType: string;
      baseType: string;
      inheritanceLevel: number;
    }> = [];

    if (!CSharpHelperMethods.isClassNode(node)) {
      return hierarchy;
    }

    const derivedTypeName = CSharpHelperMethods.extractClassName(node);
    if (!derivedTypeName) {
      return hierarchy;
    }

    const baseTypes = this.extractBaseTypes(node);
    
    for (let i = 0; i < baseTypes.length; i++) {
      const baseType = baseTypes[i];
      hierarchy.push({
        derivedType: derivedTypeName,
        baseType: baseType.text,
        inheritanceLevel: i + 1
      });
    }

    return hierarchy;
  }

  /**
   * 分析泛型约束关系
   */
  analyzeGenericConstraints(node: Parser.SyntaxNode): Array<{
    typeParameter: string;
    constraintType: string;
    constraintValue: string;
  }> {
    const constraints: Array<{
      typeParameter: string;
      constraintType: string;
      constraintValue: string;
    }> = [];

    const typeParameters = node.childForFieldName('type_parameters');
    if (!typeParameters) {
      return constraints;
    }

    const constraintsClause = node.childForFieldName('type_parameter_constraints_clause');
    if (!constraintsClause) {
      return constraints;
    }

    // 提取类型参数
    const typeParamNames: string[] = [];
    for (const child of typeParameters.children) {
      if (child.type === 'type_parameter' && child.text) {
        typeParamNames.push(child.text);
      }
    }

    // 提取约束
    for (const child of constraintsClause.children) {
      if (child.type === 'type_parameter_constraint') {
        const constrainedParam = child.childForFieldName('target');
        const constraint = child.childForFieldName('constraint');
        
        if (constrainedParam?.text && constraint?.text) {
          constraints.push({
            typeParameter: constrainedParam.text,
            constraintType: 'type_constraint',
            constraintValue: constraint.text
          });
        }
      }
    }

    return constraints;
  }

  /**
   * 分析记录类型继承
   */
  analyzeRecordInheritance(node: Parser.SyntaxNode): {
    recordType: string;
    baseRecord?: string;
    withExpressions: string[];
  } | null {
    if (node.type !== 'record_class_declaration' && node.type !== 'record_struct_declaration') {
      return null;
    }

    const recordTypeName = CSharpHelperMethods.extractClassName(node);
    if (!recordTypeName) {
      return null;
    }

    const baseTypes = this.extractBaseTypes(node);
    const baseRecord = baseTypes.length > 0 ? baseTypes[0].text : undefined;

    // 查找with表达式
    const withExpressions: string[] = [];
    this.findWithExpressions(node, withExpressions);

    return {
      recordType: recordTypeName,
      baseRecord,
      withExpressions
    };
  }

  /**
   * 递归查找with表达式
   */
  private findWithExpressions(node: Parser.SyntaxNode, expressions: string[]): void {
    for (const child of node.children) {
      if (child.type === 'with_expression') {
        expressions.push(child.text);
      }
      this.findWithExpressions(child, expressions);
    }
  }
}