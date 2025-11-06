import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 语义关系提取器
 * 专门处理Python语言的语义关系提取，如方法重写、重载、委托、观察者模式等
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const semanticType = this.determineSemanticType(astNode);
    const semanticDetails = this.extractSemanticDetails(astNode);

    return {
      type: 'semantic',
      semanticType,
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      semanticDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取语义关系
   */
  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取类继承关系（方法重写）
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      const superclasses = mainNode.childForFieldName('superclasses');
      
      if (className && superclasses) {
        for (const child of superclasses.children || []) {
          if (child.type === 'identifier' && child.text) {
            relationships.push({
              source: child.text,
              target: className,
              type: 'overrides'
            });
          }
        }
      }

      // 查找类中的方法重写
      this.findMethodOverrides(mainNode, relationships);
    }

    // 提取装饰器模式（观察者）
    if (mainNode.type === 'decorated_definition') {
      const decorators = mainNode.childForFieldName('decorators');
      const definition = mainNode.childForFieldName('definition');
      
      if (decorators && definition) {
        for (const decorator of decorators.children || []) {
          if (decorator.type === 'decorator' && decorator.text) {
            const decoratorText = decorator.text;
            const defName = definition.childForFieldName('name')?.text;
            
            if (defName) {
              // 检查是否是观察者模式装饰器
              if (this.isObserverDecorator(decoratorText)) {
                relationships.push({
                  source: 'event-source',
                  target: defName,
                  type: 'observes'
                });
              }
              
              // 检查是否是配置模式装饰器
              if (this.isConfigurationDecorator(decoratorText)) {
                relationships.push({
                  source: 'config-source',
                  target: defName,
                  type: 'configures'
                });
              }
            }
          }
        }
      }
    }

    // 提取属性装饰器（观察者模式）
    if (mainNode.type === 'class_definition') {
      this.findPropertyDecorators(mainNode, relationships);
    }

    // 提取类方法装饰器（委托模式）
    if (mainNode.type === 'class_definition') {
      this.findDelegationPatterns(mainNode, relationships);
    }

    // 提取静态方法装饰器
    if (mainNode.type === 'class_definition') {
      this.findStaticMethods(mainNode, relationships);
    }

    // 提取抽象基类装饰器
    if (mainNode.type === 'class_definition') {
      this.findAbstractMethods(mainNode, relationships);
    }

    // 提取数据类装饰器（配置模式）
    if (mainNode.type === 'decorated_definition') {
      this.findDataclassPatterns(mainNode, relationships);
    }

    // 提取上下文管理器装饰器
    if (mainNode.type === 'decorated_definition') {
      this.findContextManagerPatterns(mainNode, relationships);
    }

    // 提取元类模式
    if (mainNode.type === 'class_definition') {
      this.findMetaclassPatterns(mainNode, relationships);
    }

    // 提取描述符协议
    if (mainNode.type === 'class_definition') {
      this.findDescriptorPatterns(mainNode, relationships);
    }

    // 提取迭代器协议
    if (mainNode.type === 'class_definition') {
      this.findIteratorPatterns(mainNode, relationships);
    }

    return relationships;
  }

  /**
   * 确定语义类型
   */
  private determineSemanticType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'class_definition':
        return 'inheritance_or_protocol';
      case 'decorated_definition':
        return 'decorator_pattern';
      case 'function_definition':
        return 'method_semantics';
      default:
        return 'unknown_semantic';
    }
  }

  /**
   * 提取语义详细信息
   */
  private extractSemanticDetails(astNode: Parser.SyntaxNode): any {
    const details: any = {};

    switch (astNode.type) {
      case 'class_definition':
        const superclasses = astNode.childForFieldName('superclasses');
        details.superclasses = this.extractSuperclassNames(superclasses);
        details.methodCount = this.countMethods(astNode);
        details.hasSpecialMethods = this.hasSpecialMethods(astNode);
        break;
        
      case 'decorated_definition':
        const decorators = astNode.childForFieldName('decorators');
        details.decorators = this.extractDecoratorNames(decorators);
        details.definitionType = astNode.childForFieldName('definition')?.type;
        break;
    }

    return details;
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'class_definition':
        const superclasses = astNode.childForFieldName('superclasses');
        return superclasses ? generateDeterministicNodeId(superclasses) : 'unknown';
        
      case 'decorated_definition':
        const decorators = astNode.childForFieldName('decorators');
        return decorators ? generateDeterministicNodeId(decorators) : 'unknown';
        
      default:
        return generateDeterministicNodeId(astNode);
    }
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'class_definition':
        const name = astNode.childForFieldName('name');
        return name ? generateDeterministicNodeId(name) : 'unknown';
        
      case 'decorated_definition':
        const definition = astNode.childForFieldName('definition');
        const defName = definition?.childForFieldName('name');
        return defName ? generateDeterministicNodeId(defName) : 'unknown';
        
      default:
        return 'unknown';
    }
  }

  /**
   * 查找方法重写
   */
  private findMethodOverrides(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    const superclasses = classNode.childForFieldName('superclasses');
    
    if (!className || !superclasses) return;

    // 获取父类名称
    const parentClassNames: string[] = [];
    for (const child of superclasses.children || []) {
      if (child.type === 'identifier' && child.text) {
        parentClassNames.push(child.text);
      }
    }

    // 查找类中的方法
    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          const methodName = child.childForFieldName('name')?.text;
          if (methodName && this.isOverrideMethod(methodName)) {
            for (const parentClass of parentClassNames) {
              relationships.push({
                source: `${parentClass}.${methodName}`,
                target: `${className}.${methodName}`,
                type: 'overrides'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 查找属性装饰器
   */
  private findPropertyDecorators(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'decorated_definition') {
          const decorators = child.childForFieldName('decorators');
          const definition = child.childForFieldName('definition');
          const methodName = definition?.childForFieldName('name')?.text;
          
          if (decorators && methodName) {
            for (const decorator of decorators.children || []) {
              if (decorator.type === 'decorator' && decorator.text) {
                if (this.isPropertyDecorator(decorator.text)) {
                  relationships.push({
                    source: `${className}.property`,
                    target: `${className}.${methodName}`,
                    type: 'configures'
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 查找委托模式
   */
  private findDelegationPatterns(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'decorated_definition') {
          const decorators = child.childForFieldName('decorators');
          const definition = child.childForFieldName('definition');
          const methodName = definition?.childForFieldName('name')?.text;
          
          if (decorators && methodName) {
            for (const decorator of decorators.children || []) {
              if (decorator.type === 'decorator' && decorator.text) {
                if (this.isDelegationDecorator(decorator.text)) {
                  relationships.push({
                    source: `${className}.delegate`,
                    target: `${className}.${methodName}`,
                    type: 'delegates'
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 查找静态方法
   */
  private findStaticMethods(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'decorated_definition') {
          const decorators = child.childForFieldName('decorators');
          const definition = child.childForFieldName('definition');
          const methodName = definition?.childForFieldName('name')?.text;
          
          if (decorators && methodName) {
            for (const decorator of decorators.children || []) {
              if (decorator.type === 'decorator' && decorator.text) {
                if (decorator.text.includes('@staticmethod')) {
                  relationships.push({
                    source: `${className}.class`,
                    target: `${className}.${methodName}`,
                    type: 'configures'
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 查找抽象方法
   */
  private findAbstractMethods(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'decorated_definition') {
          const decorators = child.childForFieldName('decorators');
          const definition = child.childForFieldName('definition');
          const methodName = definition?.childForFieldName('name')?.text;
          
          if (decorators && methodName) {
            for (const decorator of decorators.children || []) {
              if (decorator.type === 'decorator' && decorator.text) {
                if (decorator.text.includes('@abstractmethod')) {
                  relationships.push({
                    source: `${className}.interface`,
                    target: `${className}.${methodName}`,
                    type: 'overrides'
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 查找数据类模式
   */
  private findDataclassPatterns(node: Parser.SyntaxNode, relationships: Array<any>): void {
    const decorators = node.childForFieldName('decorators');
    const definition = node.childForFieldName('definition');
    
    if (decorators && definition?.type === 'class_definition') {
      const className = definition.childForFieldName('name')?.text;
      if (className) {
        for (const decorator of decorators.children || []) {
          if (decorator.type === 'decorator' && decorator.text) {
            if (decorator.text.includes('@dataclass')) {
              relationships.push({
                source: 'dataclass.protocol',
                target: className,
                type: 'configures'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 查找上下文管理器模式
   */
  private findContextManagerPatterns(node: Parser.SyntaxNode, relationships: Array<any>): void {
    const decorators = node.childForFieldName('decorators');
    const definition = node.childForFieldName('definition');
    
    if (decorators && definition?.type === 'function_definition') {
      const functionName = definition.childForFieldName('name')?.text;
      if (functionName) {
        for (const decorator of decorators.children || []) {
          if (decorator.type === 'decorator' && decorator.text) {
            if (decorator.text.includes('@contextmanager')) {
              relationships.push({
                source: 'context.protocol',
                target: functionName,
                type: 'configures'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 查找元类模式
   */
  private findMetaclassPatterns(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    // 查找元类参数
    for (const child of classNode.children || []) {
      if (child.type === 'argument_list') {
        for (const arg of child.children || []) {
          if (arg.type === 'keyword_argument') {
            const key = arg.childForFieldName('key');
            const value = arg.childForFieldName('value');
            
            if (key?.text === 'metaclass' && value?.text) {
              relationships.push({
                source: value.text,
                target: className,
                type: 'configures'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 查找描述符协议
   */
  private findDescriptorPatterns(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          const methodName = child.childForFieldName('name')?.text;
          if (methodName && this.isDescriptorMethod(methodName)) {
            relationships.push({
              source: 'descriptor.protocol',
              target: `${className}.${methodName}`,
              type: 'overrides'
            });
          }
        }
      }
    }
  }

  /**
   * 查找迭代器协议
   */
  private findIteratorPatterns(classNode: Parser.SyntaxNode, relationships: Array<any>): void {
    const className = classNode.childForFieldName('name')?.text;
    if (!className) return;

    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          const methodName = child.childForFieldName('name')?.text;
          if (methodName && this.isIteratorMethod(methodName)) {
            relationships.push({
              source: 'iterator.protocol',
              target: `${className}.${methodName}`,
              type: 'overrides'
            });
          }
        }
      }
    }
  }

  // 辅助方法

  private isObserverDecorator(decoratorText: string): boolean {
    return decoratorText.includes('observer') || 
           decoratorText.includes('subscribe') || 
           decoratorText.includes('watch');
  }

  private isConfigurationDecorator(decoratorText: string): boolean {
    return decoratorText.includes('property') || 
           decoratorText.includes('setter') || 
           decoratorText.includes('getter');
  }

  private isPropertyDecorator(decoratorText: string): boolean {
    return decoratorText.includes('property') || 
           decoratorText.includes('setter') || 
           decoratorText.includes('getter');
  }

  private isDelegationDecorator(decoratorText: string): boolean {
    return decoratorText.includes('delegate') || 
           decoratorText.includes('forward');
  }

  private isOverrideMethod(methodName: string): boolean {
    // 简单的启发式：检查是否是常见的重写方法
    const commonOverrideMethods = [
      '__init__', '__str__', '__repr__', '__eq__', '__hash__',
      '__getitem__', '__setitem__', '__delitem__', '__len__',
      '__iter__', '__next__', '__enter__', '__exit__'
    ];
    return commonOverrideMethods.includes(methodName);
  }

  private isDescriptorMethod(methodName: string): boolean {
    return methodName === '__get__' || 
           methodName === '__set__' || 
           methodName === '__delete__';
  }

  private isIteratorMethod(methodName: string): boolean {
    return methodName === '__iter__' || 
           methodName === '__next__' || 
           methodName === '__aiter__' || 
           methodName === '__anext__';
  }

  private extractSuperclassNames(superclasses: Parser.SyntaxNode | null): string[] {
    const names: string[] = [];
    if (superclasses) {
      for (const child of superclasses.children || []) {
        if (child.type === 'identifier' && child.text) {
          names.push(child.text);
        }
      }
    }
    return names;
  }

  private countMethods(classNode: Parser.SyntaxNode): number {
    let count = 0;
    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          count++;
        }
      }
    }
    return count;
  }

  private hasSpecialMethods(classNode: Parser.SyntaxNode): boolean {
    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          const methodName = child.childForFieldName('name')?.text;
          if (methodName && methodName.startsWith('__') && methodName.endsWith('__')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private extractDecoratorNames(decorators: Parser.SyntaxNode | null): string[] {
    const names: string[] = [];
    if (decorators) {
      for (const child of decorators.children || []) {
        if (child.type === 'decorator' && child.text) {
          names.push(child.text);
        }
      }
    }
    return names;
  }
}