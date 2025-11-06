import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 语义关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const semanticType = this.determineSemanticType(astNode);
    const relatedNodes = this.extractRelatedNodes(astNode);
    const patternDetails = this.extractPatternDetails(astNode);

    return {
      type: 'semantic',
      semanticType,
      fromNodeId: relatedNodes.from ? generateDeterministicNodeId(relatedNodes.from) : 'unknown',
      toNodeId: relatedNodes.to ? generateDeterministicNodeId(relatedNodes.to) : 'unknown',
      patternDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取语义关系数组
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

    const nodeType = mainNode.type;
    
    // 检查是否有override修饰符
    if (nodeType.includes('method_declaration') && mainNode.text.includes('override')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('overridden.method')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => 
            c.name.includes('override.modifier') || c.name.includes('method_declaration'));
          const source = sourceCapture?.node?.childForFieldName?.('name')?.text || 'unknown';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'overrides'
            });
          }
        }
      }
    } 
    // 检查委托关系
    else if (nodeType.includes('assignment') && mainNode.text.includes('=')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('target.delegate')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => c.name.includes('source.function'));
          const source = sourceCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'delegates'
            });
          }
        }
      }
    }
    // 检查事件观察关系
    else if (nodeType.includes('assignment') && 
             (mainNode.text.includes('+='))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('subscriber.event')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => c.name.includes('event.handler'));
          const source = sourceCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'observes'
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * 确定语义类型
   */
  private determineSemanticType(node: Parser.SyntaxNode): 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'decorates' | 'aggregates' {
    const text = node.text;
    
    if (text.includes('override')) {
      return 'overrides';
    } else if (this.isMethodOverload(node)) {
      return 'overloads';
    } else if (this.isDelegateAssignment(node)) {
      return 'delegates';
    } else if (this.isEventSubscription(node)) {
      return 'observes';
    } else if (this.isConfiguration(node)) {
      return 'configures';
    } else if (this.isInterfaceImplementation(node)) {
      return 'implements';
    } else if (this.isDecoratorPattern(node)) {
      return 'decorates';
    } else if (this.isAggregation(node)) {
      return 'aggregates';
    }
    
    return 'overrides';
  }

  /**
   * 提取相关节点
   */
  private extractRelatedNodes(node: Parser.SyntaxNode): { from?: Parser.SyntaxNode; to?: Parser.SyntaxNode } {
    switch (node.type) {
      case 'method_declaration':
        if (node.text.includes('override')) {
          return {
            from: node.childForFieldName('name'),
            to: this.findBaseMethod(node)
          };
        }
        break;
      case 'assignment_expression':
        if (node.text.includes('+=')) {
          return {
            from: node.childForFieldName('right'),
            to: node.childForFieldName('left')
          };
        }
        break;
    }
    
    return {};
  }

  /**
   * 提取模式详情
   */
  private extractPatternDetails(node: Parser.SyntaxNode): Record<string, any> {
    const details: Record<string, any> = {};
    
    const semanticType = this.determineSemanticType(node);
    switch (semanticType) {
      case 'overrides':
        details.baseMethod = this.findBaseMethodName(node);
        details.isVirtual = this.isVirtualMethod(node);
        break;
      case 'overloads':
        details.parameterCount = this.getParameterCount(node);
        details.parameterTypes = this.getParameterTypes(node);
        break;
      case 'delegates':
        details.delegateType = this.getDelegateType(node);
        details.targetMethod = this.getTargetMethod(node);
        break;
      case 'observes':
        details.eventName = this.getEventName(node);
        details.handlerMethod = this.getHandlerMethod(node);
        break;
      case 'configures':
        details.configuredObject = this.getConfiguredObject(node);
        details.configurationType = this.getConfigurationType(node);
        break;
    }
    
    return details;
  }

  /**
   * 判断是否为方法重载
   */
  private isMethodOverload(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'method_declaration') {
      return false;
    }

    // 简化判断：检查是否有相同名称但不同参数的方法
    const methodName = CSharpHelperMethods.extractMethodName(node);
    if (!methodName) {
      return false;
    }

    // 在实际实现中，需要检查符号表以确定是否存在重载
    return false;
  }

  /**
   * 判断是否为委托赋值
   */
  private isDelegateAssignment(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'assignment_expression') {
      return false;
    }

    const left = node.childForFieldName('left');
    if (!left) {
      return false;
    }

    // 检查左侧是否为委托类型
    return left.type === 'identifier' || left.type === 'member_access_expression';
  }

  /**
   * 判断是否为事件订阅
   */
  private isEventSubscription(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'assignment_expression') {
      return false;
    }

    return node.text.includes('+=');
  }

  /**
   * 判断是否为配置
   */
  private isConfiguration(node: Parser.SyntaxNode): boolean {
    const text = node.text;
    const configPatterns = ['Configure', 'Set', 'Add', 'Use', 'Register'];
    
    return configPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * 判断是否为接口实现
   */
  private isInterfaceImplementation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'method_declaration') {
      return false;
    }

    // 检查方法是否在实现接口
    const parent = node.parent;
    if (!parent) {
      return false;
    }

    const baseList = parent.childForFieldName('base_list');
    if (!baseList) {
      return false;
    }

    return baseList.text.includes('interface');
  }

  /**
   * 判断是否为装饰器模式
   */
  private isDecoratorPattern(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'class_declaration') {
      return false;
    }

    // 检查是否包装了另一个对象
    const constructor = node.children.find(child => child.type === 'constructor_declaration');
    if (!constructor) {
      return false;
    }

    const parameters = constructor.childForFieldName('parameters');
    if (!parameters) {
      return false;
    }

    // 检查构造函数参数是否包含相同接口类型的参数
    for (const child of parameters.children) {
      if (child.type === 'parameter') {
        const typeNode = child.childForFieldName('type');
        if (typeNode?.text) {
          // 简化判断：检查是否有相同接口类型的参数
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 判断是否为聚合关系
   */
  private isAggregation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'field_declaration') {
      return false;
    }

    // 检查字段是否为集合类型
    const typeNode = node.childForFieldName('type');
    if (!typeNode) {
      return false;
    }

    const collectionTypes = ['List', 'Collection', 'IEnumerable', 'IList', 'ICollection'];
    const text = typeNode.text;
    
    return collectionTypes.some(collectionType => 
      text.includes(collectionType) || text.includes('<') && text.includes('>')
    );
  }

  /**
   * 查找基方法
   */
  private findBaseMethod(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 简化实现：在实际中需要符号表解析
    return null;
  }

  /**
   * 查找基方法名
   */
  private findBaseMethodName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode?.text || null;
  }

  /**
   * 判断是否为虚方法
   */
  private isVirtualMethod(node: Parser.SyntaxNode): boolean {
    const modifiers = node.childForFieldName('modifiers');
    if (!modifiers) {
      return false;
    }

    return modifiers.text.includes('virtual') || modifiers.text.includes('override');
  }

  /**
   * 获取参数数量
   */
  private getParameterCount(node: Parser.SyntaxNode): number {
    const parameters = node.childForFieldName('parameters');
    if (!parameters) {
      return 0;
    }

    return parameters.children.filter(child => child.type === 'parameter').length;
  }

  /**
   * 获取参数类型
   */
  private getParameterTypes(node: Parser.SyntaxNode): string[] {
    const parameters = node.childForFieldName('parameters');
    if (!parameters) {
      return [];
    }

    const types: string[] = [];
    for (const child of parameters.children) {
      if (child.type === 'parameter') {
        const typeNode = child.childForFieldName('type');
        if (typeNode?.text) {
          types.push(typeNode.text);
        }
      }
    }

    return types;
  }

  /**
   * 获取委托类型
   */
  private getDelegateType(node: Parser.SyntaxNode): string | null {
    const left = node.childForFieldName('left');
    if (!left) {
      return null;
    }

    // 简化实现：在实际中需要符号表解析
    return left.text;
  }

  /**
   * 获取目标方法
   */
  private getTargetMethod(node: Parser.SyntaxNode): string | null {
    const right = node.childForFieldName('right');
    if (!right) {
      return null;
    }

    return right.text;
  }

  /**
   * 获取事件名
   */
  private getEventName(node: Parser.SyntaxNode): string | null {
    const left = node.childForFieldName('left');
    if (!left) {
      return null;
    }

    return left.text;
  }

  /**
   * 获取处理方法
   */
  private getHandlerMethod(node: Parser.SyntaxNode): string | null {
    const right = node.childForFieldName('right');
    if (!right) {
      return null;
    }

    return right.text;
  }

  /**
   * 获取配置对象
   */
  private getConfiguredObject(node: Parser.SyntaxNode): string | null {
    // 简化实现
    return null;
  }

  /**
   * 获取配置类型
   */
  private getConfigurationType(node: Parser.SyntaxNode): string | null {
    // 简化实现
    return null;
  }

  /**
   * 分析设计模式
   */
  analyzeDesignPatterns(node: Parser.SyntaxNode): Array<{
    patternName: string;
    participants: string[];
    relationships: string[];
  }> {
    const patterns: Array<{
      patternName: string;
      participants: string[];
      relationships: string[];
    }> = [];

    // 检查各种设计模式
    if (this.isSingletonPattern(node)) {
      patterns.push({
        patternName: 'Singleton',
        participants: this.extractSingletonParticipants(node),
        relationships: ['instance', 'private_constructor']
      });
    }

    if (this.isFactoryPattern(node)) {
      patterns.push({
        patternName: 'Factory',
        participants: this.extractFactoryParticipants(node),
        relationships: ['creates', 'factory_method']
      });
    }

    if (this.isObserverPattern(node)) {
      patterns.push({
        patternName: 'Observer',
        participants: this.extractObserverParticipants(node),
        relationships: ['subscribes', 'notifies']
      });
    }

    if (this.isDecoratorPattern(node)) {
      patterns.push({
        patternName: 'Decorator',
        participants: this.extractDecoratorParticipants(node),
        relationships: ['wraps', 'delegates']
      });
    }

    return patterns;
  }

  /**
   * 判断是否为单例模式
   */
  private isSingletonPattern(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'class_declaration') {
      return false;
    }

    // 检查是否有私有构造函数和静态实例
    let hasPrivateConstructor = false;
    let hasStaticInstance = false;

    for (const child of node.children) {
      if (child.type === 'constructor_declaration') {
        const modifiers = child.childForFieldName('modifiers');
        if (modifiers?.text.includes('private')) {
          hasPrivateConstructor = true;
        }
      } else if (child.type === 'field_declaration') {
        const modifiers = child.childForFieldName('modifiers');
        if (modifiers?.text.includes('static')) {
          hasStaticInstance = true;
        }
      }
    }

    return hasPrivateConstructor && hasStaticInstance;
  }

  /**
   * 判断是否为工厂模式
   */
  private isFactoryPattern(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'class_declaration') {
      return false;
    }

    // 检查是否有创建方法
    for (const child of node.children) {
      if (child.type === 'method_declaration') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text && (
          nameNode.text.includes('Create') || 
          nameNode.text.includes('Make') || 
          nameNode.text.includes('Build')
        )) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 判断是否为观察者模式
   */
  private isObserverPattern(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'class_declaration') {
      return false;
    }

    // 检查是否有事件和通知方法
    let hasEvent = false;
    let hasNotifyMethod = false;

    for (const child of node.children) {
      if (child.type === 'event_declaration') {
        hasEvent = true;
      } else if (child.type === 'method_declaration') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text && (
          nameNode.text.includes('Notify') || 
          nameNode.text.includes('Update') || 
          nameNode.text.includes('OnChanged')
        )) {
          hasNotifyMethod = true;
        }
      }
    }

    return hasEvent && hasNotifyMethod;
  }

  /**
   * 提取单例参与者
   */
  private extractSingletonParticipants(node: Parser.SyntaxNode): string[] {
    const className = CSharpHelperMethods.extractClassName(node);
    return className ? [className] : [];
  }

  /**
   * 提取工厂参与者
   */
  private extractFactoryParticipants(node: Parser.SyntaxNode): string[] {
    const className = CSharpHelperMethods.extractClassName(node);
    return className ? [className] : [];
  }

  /**
   * 提取观察者参与者
   */
  private extractObserverParticipants(node: Parser.SyntaxNode): string[] {
    const className = CSharpHelperMethods.extractClassName(node);
    return className ? [className] : [];
  }

  /**
   * 提取装饰器参与者
   */
  private extractDecoratorParticipants(node: Parser.SyntaxNode): string[] {
    const className = CSharpHelperMethods.extractClassName(node);
    return className ? [className] : [];
  }
}