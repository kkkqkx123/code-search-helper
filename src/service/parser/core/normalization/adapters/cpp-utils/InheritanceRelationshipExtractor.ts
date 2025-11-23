import { CppHelperMethods } from './CppHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C++继承关系提取器
 * 处理类继承、虚函数、纯虚函数、多重继承、模板继承等继承关系
 */
export class CppInheritanceRelationshipExtractor extends BaseRelationshipExtractor {
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
      location: CppHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
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

    // C++特有的继承类型
    if (nodeType === 'class_specifier' || nodeType === 'struct_specifier') {
      const baseClassClause = astNode.childForFieldName('base_class_clause');
      if (baseClassClause) {
        // 检查是否为多重继承
        const baseClasses = this.extractBaseClasses(baseClassClause);
        if (baseClasses.length > 1) {
          return 'multiple_inheritance';
        }
        
        // 检查是否为虚继承
        if (this.hasVirtualInheritance(baseClassClause)) {
          return 'virtual_inheritance';
        }
        
        // 检查是否为模板继承
        if (this.hasTemplateInheritance(baseClassClause)) {
          return 'template_inheritance';
        }
        
        // 检查是否为CRTP模式
        if (this.isCRTPPattern(astNode, baseClassClause)) {
          return 'crtp_pattern';
        }
        
        return 'class_inheritance';
      }
    } else if (nodeType === 'function_definition') {
      // 检查是否为虚函数重写
      if (this.isVirtualOverride(astNode)) {
        return 'virtual_override';
      }
      
      // 检查是否为纯虚函数
      if (this.isPureVirtual(astNode)) {
        return 'pure_virtual';
      }
      
      // 检查是否为虚函数定义
      if (this.isVirtualFunction(astNode)) {
        return 'virtual_function';
      }
    } else if (nodeType === 'friend_declaration') {
      return 'friend_class';
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
      case 'multiple_inheritance':
      case 'virtual_inheritance':
      case 'template_inheritance':
      case 'crtp_pattern':
        fromNodeId = this.extractClassNodeId(astNode);
        toNodeId = this.extractBaseClassNodeId(astNode);
        break;

      case 'virtual_override':
      case 'pure_virtual':
      case 'virtual_function':
        fromNodeId = this.extractMethodNodeId(astNode);
        toNodeId = this.extractBaseMethodNodeId(astNode);
        break;

      case 'friend_class':
        fromNodeId = astNode.parent ? this.extractClassNodeId(astNode.parent) : 'unknown';
        toNodeId = this.extractFriendClassNodeId(astNode);
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
      case 'multiple_inheritance':
        inheritanceInfo.baseClasses = this.extractBaseClasses(astNode.childForFieldName('base_class_clause')!);
        break;

      case 'template_inheritance':
        inheritanceInfo.templateArguments = this.extractTemplateArguments(astNode);
        break;

      case 'crtp_pattern':
        inheritanceInfo.crtpType = this.extractCRTPType(astNode);
        break;

      case 'virtual_override':
        inheritanceInfo.overrideMethod = this.extractMethodName(astNode);
        inheritanceInfo.virtualSpecifier = this.extractVirtualSpecifier(astNode);
        break;

      case 'pure_virtual':
        inheritanceInfo.pureVirtualMethod = this.extractMethodName(astNode);
        break;

      case 'friend_class':
        inheritanceInfo.friendClass = this.extractFriendClassName(astNode);
        break;
    }

    return inheritanceInfo;
  }

  /**
   * 提取基类
   */
  private extractBaseClasses(baseClassClause: Parser.SyntaxNode): string[] {
    const baseClasses: string[] = [];
    for (const child of baseClassClause.children) {
      if (child.type === 'type_identifier') {
        baseClasses.push(child.text);
      }
    }
    return baseClasses;
  }

  /**
   * 检查是否有虚继承
   */
  private hasVirtualInheritance(baseClassClause: Parser.SyntaxNode): boolean {
    for (const child of baseClassClause.children) {
      if (child.type === 'virtual_specifier') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否有模板继承
   */
  private hasTemplateInheritance(baseClassClause: Parser.SyntaxNode): boolean {
    for (const child of baseClassClause.children) {
      if (child.type === 'template_type') {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否为CRTP模式
   */
  private isCRTPPattern(classNode: Parser.SyntaxNode, baseClassClause: Parser.SyntaxNode): boolean {
    const className = this.extractClassName(classNode);
    if (!className) return false;

    for (const child of baseClassClause.children) {
      if (child.type === 'template_type') {
        const templateArgs = this.extractTemplateArgumentsFromNode(child);
        return templateArgs.includes(className);
      }
    }
    return false;
  }

  /**
   * 检查是否为虚函数重写
   */
  private isVirtualOverride(astNode: Parser.SyntaxNode): boolean {
    const declarator = astNode.childForFieldName('declarator');
    if (!declarator) return false;

    // 检查是否有virtual修饰符
    const virtualSpecifier = astNode.childForFieldName('virtual_specifier');
    if (!virtualSpecifier) return false;

    // 检查是否在类定义中
    const parent = astNode.parent;
    return !!(parent && (parent.type === 'class_specifier' || parent.type === 'struct_specifier'));
  }

  /**
   * 检查是否为纯虚函数
   */
  private isPureVirtual(astNode: Parser.SyntaxNode): boolean {
    const body = astNode.childForFieldName('body');
    return !!(body && body.type === 'pure_virtual_clause');
  }

  /**
   * 检查是否为虚函数
   */
  private isVirtualFunction(astNode: Parser.SyntaxNode): boolean {
    return !!astNode.childForFieldName('virtual_specifier');
  }

  /**
   * 提取类节点ID
   */
  private extractClassNodeId(astNode: Parser.SyntaxNode): string {
    const nameNode = astNode.childForFieldName('name');
    return CppHelperMethods.generateNodeId(nameNode || astNode);
  }

  /**
   * 提取基类节点ID
   */
  private extractBaseClassNodeId(astNode: Parser.SyntaxNode): string {
    const baseClassClause = astNode.childForFieldName('base_class_clause');
    if (baseClassClause) {
      for (const child of baseClassClause.children) {
        if (child.type === 'type_identifier') {
          return CppHelperMethods.generateNodeId(child);
        }
      }
    }
    return 'unknown';
  }

  /**
   * 提取方法节点ID
   */
  private extractMethodNodeId(astNode: Parser.SyntaxNode): string {
    const declarator = astNode.childForFieldName('declarator');
    if (declarator) {
      const nameNode = declarator.childForFieldName('declarator');
      if (nameNode) {
        return CppHelperMethods.generateNodeId(nameNode);
      }
    }
    return CppHelperMethods.generateNodeId(astNode);
  }

  /**
   * 提取基方法节点ID
   */
  private extractBaseMethodNodeId(astNode: Parser.SyntaxNode): string {
    // 对于虚函数重写，基方法可能在父类中，这里返回一个标识符
    const methodName = this.extractMethodName(astNode);
    if (methodName) {
      return CppHelperMethods.generateNodeId(astNode, 'virtual_method');
    }
    return 'unknown';
  }

  /**
   * 提取友元类节点ID
   */
  private extractFriendClassNodeId(astNode: Parser.SyntaxNode): string {
    for (const child of astNode.children) {
      if (child.type === 'class_specifier') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          return CppHelperMethods.generateNodeId(nameNode);
        }
      }
    }
    return 'unknown';
  }

  /**
   * 提取类名
   */
  private extractClassName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  /**
   * 提取模板参数
   */
  private extractTemplateArguments(astNode: Parser.SyntaxNode): string[] {
    const templateArgs: string[] = [];
    const baseClassClause = astNode.childForFieldName('base_class_clause');
    if (baseClassClause) {
      for (const child of baseClassClause.children) {
        if (child.type === 'template_type') {
          const args = this.extractTemplateArgumentsFromNode(child);
          templateArgs.push(...args);
        }
      }
    }
    return templateArgs;
  }

  /**
   * 从模板类型节点提取参数
   */
  private extractTemplateArgumentsFromNode(templateTypeNode: Parser.SyntaxNode): string[] {
    const templateArgs: string[] = [];
    const argsNode = templateTypeNode.childForFieldName('arguments');
    if (argsNode) {
      for (const child of argsNode.children) {
        if (child.type === 'type_identifier') {
          templateArgs.push(child.text);
        }
      }
    }
    return templateArgs;
  }

  /**
   * 提取CRTP类型
   */
  private extractCRTPType(astNode: Parser.SyntaxNode): string {
    const className = this.extractClassName(astNode);
    const baseClassClause = astNode.childForFieldName('base_class_clause');
    
    if (baseClassClause && className) {
      for (const child of baseClassClause.children) {
        if (child.type === 'template_type') {
          const templateArgs = this.extractTemplateArgumentsFromNode(child);
          if (templateArgs.includes(className)) {
            return child.text;
          }
        }
      }
    }
    return 'unknown';
  }

  /**
   * 提取方法名
   */
  private extractMethodName(astNode: Parser.SyntaxNode): string | null {
    const declarator = astNode.childForFieldName('declarator');
    if (declarator) {
      const nameNode = declarator.childForFieldName('declarator');
      if (nameNode) {
        return nameNode.text;
      }
    }
    return null;
  }

  /**
   * 提取virtual修饰符
   */
  private extractVirtualSpecifier(astNode: Parser.SyntaxNode): string | null {
    const virtualSpecifier = astNode.childForFieldName('virtual_specifier');
    return virtualSpecifier ? virtualSpecifier.text : null;
  }

  /**
   * 提取友元类名
   */
  private extractFriendClassName(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'class_specifier') {
        return this.extractClassName(child);
      }
    }
    return null;
  }

  /**
   * 判断是否为继承关系节点
   */
  private isInheritanceNode(astNode: Parser.SyntaxNode): boolean {
    const inheritanceNodeTypes = [
      'class_specifier',
      'struct_specifier',
      'function_definition',
      'friend_declaration'
    ];

    if (!inheritanceNodeTypes.includes(astNode.type)) {
      return false;
    }

    // 进一步检查是否确实包含继承关系
    switch (astNode.type) {
      case 'class_specifier':
      case 'struct_specifier':
        return !!astNode.childForFieldName('base_class_clause');
      
      case 'function_definition':
        return this.isVirtualFunction(astNode) || this.isPureVirtual(astNode);
      
      case 'friend_declaration':
        return this.hasFriendClass(astNode);
      
      default:
        return false;
    }
  }

  /**
   * 检查是否有友元类
   */
  private hasFriendClass(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'class_specifier') {
        return true;
      }
    }
    return false;
  }
}