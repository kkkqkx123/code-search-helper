import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Python继承关系提取器
 * 处理类继承、接口实现、混入等
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const inheritanceType = this.determineInheritanceType(astNode);

    if (!inheritanceType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractInheritanceNodes(astNode, inheritanceType);
    const baseClasses = this.extractBaseClasses(astNode);
    const inheritanceInfo = this.extractInheritanceInfo(astNode);

    return {
      type: 'inheritance',
      fromNodeId,
      toNodeId,
      inheritanceType,
      baseClasses,
      inheritanceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取继承关系数组
   */
  extractInheritanceRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为继承相关的节点类型
    if (!this.isInheritanceNode(astNode)) {
      return relationships;
    }

    const inheritanceMetadata = this.extractInheritanceMetadata(result, astNode, null);
    if (inheritanceMetadata) {
      relationships.push(inheritanceMetadata);
    }

    return relationships;
  }

  /**
   * 确定继承类型
   */
  private determineInheritanceType(astNode: Parser.SyntaxNode): 'class_inheritance' | 'interface_implementation' | 'mixin' | 'protocol' | null {
    const nodeType = astNode.type;

    if (nodeType === 'class_definition') {
      const superclasses = this.extractBaseClasses(astNode);
      
      // 检查是否是协议继承
      if (this.isProtocolInheritance(superclasses)) {
        return 'protocol';
      }
      
      // 检查是否是混入
      if (this.isMixinInheritance(superclasses)) {
        return 'mixin';
      }
      
      // 检查是否是接口实现
      if (this.isInterfaceImplementation(superclasses)) {
        return 'interface_implementation';
      }
      
      return 'class_inheritance';
    }

    return null;
  }

  /**
   * 提取继承关系的节点
   */
  private extractInheritanceNodes(astNode: Parser.SyntaxNode, inheritanceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    const className = this.extractClassName(astNode);
    const baseClasses = this.extractBaseClasses(astNode);

    if (baseClasses.length > 0) {
      // 对于多个基类，创建一个组合的toNodeId
      const baseClassNames = baseClasses.map(cls => cls.name).join(',');
      toNodeId = NodeIdGenerator.forSymbol(baseClassNames, 'inheritance', 'current_file.py');
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取类名
   */
  private extractClassName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'class_definition') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode?.type === 'identifier') {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取基类
   */
  private extractBaseClasses(astNode: Parser.SyntaxNode): Array<{ name: string; isProtocol: boolean; isMixin: boolean }> {
    const baseClasses: Array<{ name: string; isProtocol: boolean; isMixin: boolean }> = [];

    if (astNode.type === 'class_definition') {
      const superclasses = astNode.childForFieldName('superclasses');
      if (superclasses) {
        for (const child of superclasses.children) {
          if (child.type === 'argument_list') {
            for (const arg of child.children) {
              if (arg.type === 'identifier' || arg.type === 'dotted_name') {
                baseClasses.push({
                  name: arg.text || '',
                  isProtocol: this.isProtocolClass(arg.text || ''),
                  isMixin: this.isMixinClass(arg.text || '')
                });
              }
            }
          }
        }
      }
    }

    return baseClasses;
  }

  /**
   * 提取继承信息
   */
  private extractInheritanceInfo(astNode: Parser.SyntaxNode): any {
    const inheritanceInfo: any = {};
    const baseClasses = this.extractBaseClasses(astNode);

    inheritanceInfo.baseClassCount = baseClasses.length;
    inheritanceInfo.hasMultipleInheritance = baseClasses.length > 1;
    inheritanceInfo.hasProtocolInheritance = baseClasses.some(cls => cls.isProtocol);
    inheritanceInfo.hasMixinInheritance = baseClasses.some(cls => cls.isMixin);
    inheritanceInfo.inheritanceDepth = this.calculateInheritanceDepth(astNode);
    inheritanceInfo.isAbstractBase = this.isAbstractBaseClass(astNode);

    return inheritanceInfo;
  }

  /**
   * 判断是否为协议继承
   */
  private isProtocolInheritance(baseClasses: Array<{ name: string; isProtocol: boolean; isMixin: boolean }>): boolean {
    return baseClasses.some(cls => cls.isProtocol);
  }

  /**
   * 判断是否为混入继承
   */
  private isMixinInheritance(baseClasses: Array<{ name: string; isProtocol: boolean; isMixin: boolean }>): boolean {
    return baseClasses.some(cls => cls.isMixin);
  }

  /**
   * 判断是否为接口实现
   */
  private isInterfaceImplementation(baseClasses: Array<{ name: string; isProtocol: boolean; isMixin: boolean }>): boolean {
    // 简单启发式：如果基类名包含"Interface"或"ABC"，可能是接口实现
    return baseClasses.some(cls => 
      cls.name.includes('Interface') || 
      cls.name.includes('ABC') ||
      cls.isProtocol
    );
  }

  /**
   * 判断是否为协议类
   */
  private isProtocolClass(className: string): boolean {
    const protocolPatterns = [
      /Protocol$/i,
      /Interface$/i,
      /^I[A-Z]/,  // 以I开头的接口命名约定
      /ABC$/i     // 抽象基类
    ];
    
    return protocolPatterns.some(pattern => pattern.test(className));
  }

  /**
   * 判断是否为混入类
   */
  private isMixinClass(className: string): boolean {
    const mixinPatterns = [
      /Mixin$/i,
      /Mixin[A-Z]/,
      /able$/i,   // 如Comparable, Iterable等
      /ing$/i     // 如Mapping, Sequence等
    ];
    
    return mixinPatterns.some(pattern => pattern.test(className));
  }

  /**
   * 计算继承深度
   */
  private calculateInheritanceDepth(astNode: Parser.SyntaxNode): number {
    // 简化实现：直接继承的深度为1
    // 在实际实现中，可能需要遍历整个继承树
    const baseClasses = this.extractBaseClasses(astNode);
    return baseClasses.length > 0 ? 1 : 0;
  }

  /**
   * 判断是否为抽象基类
   */
  private isAbstractBaseClass(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type !== 'class_definition') {
      return false;
    }

    // 检查是否有abstractmethod装饰器
    const decorators = astNode.childForFieldName('decorators');
    if (decorators) {
      for (const child of decorators.children) {
        if (child.type === 'decorator' && child.text) {
          if (child.text.includes('abstractmethod') || child.text.includes('ABC')) {
            return true;
          }
        }
      }
    }

    // 检查是否继承自ABC
    const baseClasses = this.extractBaseClasses(astNode);
    return baseClasses.some(cls => cls.name.includes('ABC'));
  }

  /**
   * 判断是否为继承关系节点
   */
  private isInheritanceNode(astNode: Parser.SyntaxNode): boolean {
    return astNode.type === 'class_definition';
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 查找类定义
   */
  findClassDefinitions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const classDefinitions: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'class_definition') {
        classDefinitions.push(node);
      }
    });

    return classDefinitions;
  }

  /**
   * 查找继承关系
   */
  findInheritanceRelationships(ast: Parser.SyntaxNode): Array<{
    className: string;
    baseClasses: string[];
    inheritanceType: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const inheritanceRelationships: Array<any> = [];
    const classDefinitions = this.findClassDefinitions(ast);

    for (const classDef of classDefinitions) {
      const className = this.extractClassName(classDef);
      const baseClasses = this.extractBaseClasses(classDef);
      const inheritanceType = this.determineInheritanceType(classDef);

      if (className && baseClasses.length > 0 && inheritanceType) {
        inheritanceRelationships.push({
          className,
          baseClasses: baseClasses.map(cls => cls.name),
          inheritanceType,
          location: {
            lineNumber: classDef.startPosition.row + 1,
            columnNumber: classDef.startPosition.column + 1
          }
        });
      }
    }

    return inheritanceRelationships;
  }

  /**
   * 遍历AST树
   */
  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);

    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback);
      }
    }
  }

  /**
   * 分析继承关系
   */
  analyzeInheritance(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    inheritanceType: string;
    baseClasses: string[];
    inheritanceInfo: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const inheritanceRelationships: Array<any> = [];
    const classDefinitions = this.findClassDefinitions(ast);

    for (const classDef of classDefinitions) {
      const className = this.extractClassName(classDef);
      const baseClasses = this.extractBaseClasses(classDef);
      const inheritanceType = this.determineInheritanceType(classDef);
      const inheritanceInfo = this.extractInheritanceInfo(classDef);

      if (className && baseClasses.length > 0 && inheritanceType) {
        const baseClassNames = baseClasses.map(cls => cls.name).join(',');
        
        inheritanceRelationships.push({
          sourceId: NodeIdGenerator.forAstNode(classDef),
          targetId: NodeIdGenerator.forSymbol(baseClassNames, 'inheritance', filePath),
          inheritanceType,
          baseClasses: baseClasses.map(cls => cls.name),
          inheritanceInfo,
          location: {
            filePath,
            lineNumber: classDef.startPosition.row + 1,
            columnNumber: classDef.startPosition.column + 1
          }
        });
      }
    }

    return inheritanceRelationships;
  }

  /**
   * 查找方法重写
   */
  findMethodOverrides(ast: Parser.SyntaxNode): Array<{
    className: string;
    methodName: string;
    baseClassName: string;
    location: {
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const methodOverrides: Array<any> = [];
    const classDefinitions = this.findClassDefinitions(ast);

    for (const classDef of classDefinitions) {
      const className = this.extractClassName(classDef);
      const baseClasses = this.extractBaseClasses(classDef);
      
      if (!className || baseClasses.length === 0) continue;

      // 查找类中的方法
      const methods = this.findClassMethods(classDef);
      
      for (const method of methods) {
        // 简化实现：假设所有方法都可能重写基类方法
        // 在实际实现中，需要检查基类是否确实有同名方法
        for (const baseClass of baseClasses) {
          methodOverrides.push({
            className,
            methodName: method.name,
            baseClassName: baseClass.name,
            location: {
              lineNumber: method.node.startPosition.row + 1,
              columnNumber: method.node.startPosition.column + 1
            }
          });
        }
      }
    }

    return methodOverrides;
  }

  /**
   * 查找类方法
   */
  private findClassMethods(classDef: Parser.SyntaxNode): Array<{ name: string; node: Parser.SyntaxNode }> {
    const methods: Array<{ name: string; node: Parser.SyntaxNode }> = [];
    
    const body = classDef.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'function_definition') {
          const nameNode = child.childForFieldName('name');
          if (nameNode?.type === 'identifier') {
            methods.push({
              name: nameNode.text || '',
              node: child
            });
          }
        }
      }
    }
    
    return methods;
  }
}