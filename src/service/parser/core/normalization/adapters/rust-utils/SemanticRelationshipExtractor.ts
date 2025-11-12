import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 语义关系提取器
 * 专门处理Rust语言的语义关系提取
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const semanticInfo = this.extractSemanticInfo(astNode);

    return {
      type: 'semantic',
      operation: semanticInfo.operation,
      fromNodeId: semanticInfo.fromNodeId,
      toNodeId: semanticInfo.toNodeId,
      semanticType: semanticInfo.semanticType,
      pattern: semanticInfo.pattern,
      confidence: semanticInfo.confidence,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
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
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'specializes';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'specializes';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取trait方法实现关系
    if (this.isTraitMethodImplementation(mainNode)) {
      const implInfo = this.extractTraitImplementationInfo(mainNode);
      if (implInfo) {
        relationships.push({
          source: implInfo.implType,
          target: implInfo.traitName,
          type: 'implements'
        });
      }
    }

    // 提取方法重写关系
    if (this.isMethodOverride(mainNode)) {
      const overrideInfo = this.extractOverrideInfo(mainNode);
      if (overrideInfo) {
        relationships.push({
          source: overrideInfo.method,
          target: overrideInfo.baseMethod,
          type: 'overrides'
        });
      }
    }

    // 提取方法重载关系
    if (this.isMethodOverload(mainNode)) {
      const overloadInfo = this.extractOverloadInfo(mainNode);
      if (overloadInfo) {
        relationships.push({
          source: overloadInfo.method,
          target: overloadInfo.baseMethod,
          type: 'overloads'
        });
      }
    }

    // 提取委托关系
    if (this.isDelegation(mainNode)) {
      const delegationInfo = this.extractDelegationInfo(mainNode);
      if (delegationInfo) {
        relationships.push({
          source: delegationInfo.delegator,
          target: delegationInfo.delegatee,
          type: 'delegates'
        });
      }
    }

    // 提取观察者模式关系
    if (this.isObserverPattern(mainNode)) {
      const observerInfo = this.extractObserverInfo(mainNode);
      if (observerInfo) {
        relationships.push({
          source: observerInfo.observer,
          target: observerInfo.observable,
          type: 'observes'
        });
      }
    }

    // 提取配置关系
    if (this.isConfiguration(mainNode)) {
      const configInfo = this.extractConfigurationInfo(mainNode);
      if (configInfo) {
        relationships.push({
          source: configInfo.configurable,
          target: configInfo.configuration,
          type: 'configures'
        });
      }
    }

    // 提取特化关系
    if (this.isSpecialization(mainNode)) {
      const specializationInfo = this.extractSpecializationInfo(mainNode);
      if (specializationInfo) {
        relationships.push({
          source: specializationInfo.specialized,
          target: specializationInfo.generic,
          type: 'specializes'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取语义信息
   */
  private extractSemanticInfo(node: Parser.SyntaxNode): {
    operation: string;
    fromNodeId: string;
    toNodeId: string;
    semanticType: string;
    pattern: string;
    confidence: number;
  } {
    if (this.isTraitMethodImplementation(node)) {
      const implInfo = this.extractTraitImplementationInfo(node);
      return {
        operation: 'trait_implementation',
        fromNodeId: implInfo ? this.generateDeterministicNodeIdFromString(implInfo.implType) : 'unknown',
        toNodeId: implInfo ? this.generateDeterministicNodeIdFromString(implInfo.traitName) : 'unknown',
        semanticType: 'implementation',
        pattern: 'trait_impl',
        confidence: 0.9
      };
    }

    if (this.isMethodOverride(node)) {
      const overrideInfo = this.extractOverrideInfo(node);
      return {
        operation: 'method_override',
        fromNodeId: overrideInfo ? this.generateDeterministicNodeIdFromString(overrideInfo.method) : 'unknown',
        toNodeId: overrideInfo ? this.generateDeterministicNodeIdFromString(overrideInfo.baseMethod) : 'unknown',
        semanticType: 'override',
        pattern: 'method_override',
        confidence: 0.8
      };
    }

    if (this.isDelegation(node)) {
      const delegationInfo = this.extractDelegationInfo(node);
      return {
        operation: 'delegation',
        fromNodeId: delegationInfo ? this.generateDeterministicNodeIdFromString(delegationInfo.delegator) : 'unknown',
        toNodeId: delegationInfo ? this.generateDeterministicNodeIdFromString(delegationInfo.delegatee) : 'unknown',
        semanticType: 'delegation',
        pattern: 'delegation',
        confidence: 0.7
      };
    }

    return {
      operation: 'unknown',
      fromNodeId: 'unknown',
      toNodeId: 'unknown',
      semanticType: 'unknown',
      pattern: 'unknown',
      confidence: 0.0
    };
  }

  /**
   * 判断是否是trait方法实现
   */
  private isTraitMethodImplementation(node: Parser.SyntaxNode): boolean {
    // 检查是否在impl块中且实现了trait
    let current = node.parent;
    while (current) {
      if (current.type === 'impl_item') {
        const traitNode = current.childForFieldName('trait');
        return traitNode !== null;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 提取trait实现信息
   */
  private extractTraitImplementationInfo(node: Parser.SyntaxNode): {
    implType: string;
    traitName: string;
    methodName: string;
  } | null {
    let current = node.parent;
    while (current && current.type !== 'impl_item') {
      current = current.parent;
    }

    if (!current) return null;

    const traitNode = current.childForFieldName('trait');
    const typeNode = current.childForFieldName('type');
    const methodName = node.childForFieldName('name')?.text;

    if (traitNode?.text && typeNode?.text && methodName) {
      return {
        implType: typeNode.text,
        traitName: traitNode.text,
        methodName
      };
    }

    return null;
  }

  /**
   * 判断是否是方法重写
   */
  private isMethodOverride(node: Parser.SyntaxNode): boolean {
    // 在Rust中，方法重写通常通过trait实现来实现
    // 这里简化实现：检查是否有override属性
    const text = node.text || '';
    return text.includes('#[override]') || this.isTraitMethodImplementation(node);
  }

  /**
   * 提取重写信息
   */
  private extractOverrideInfo(node: Parser.SyntaxNode): {
    method: string;
    baseMethod: string;
  } | null {
    const methodName = node.childForFieldName('name')?.text;
    if (!methodName) return null;

    // 简化实现：假设重写的方法名相同
    return {
      method: methodName,
      baseMethod: methodName
    };
  }

  /**
   * 判断是否是方法重载
   */
  private isMethodOverload(node: Parser.SyntaxNode): boolean {
    // Rust不支持传统的方法重载，但可以通过trait实现类似效果
    // 这里简化实现：检查是否有多个同名方法
    return false;
  }

  /**
   * 提取重载信息
   */
  private extractOverloadInfo(node: Parser.SyntaxNode): {
    method: string;
    baseMethod: string;
  } | null {
    // Rust不支持传统重载，返回null
    return null;
  }

  /**
   * 判断是否是委托
   */
  private isDelegation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'function_item') return false;

    // 检查函数体是否只是调用另一个方法
    const body = node.childForFieldName('body');
    if (!body) return false;

    // 简化实现：检查函数体中是否有方法调用
    const text = body.text || '';
    return /self\.\w+\(/.test(text) || /\w+\.\w+\(/.test(text);
  }

  /**
   * 提取委托信息
   */
  private extractDelegationInfo(node: Parser.SyntaxNode): {
    delegator: string;
    delegatee: string;
  } | null {
    const methodName = node.childForFieldName('name')?.text;
    if (!methodName) return null;

    const body = node.childForFieldName('body');
    if (!body) return null;

    // 简化实现：从函数体中提取被调用的方法
    const text = body.text || '';
    const match = text.match(/(\w+)\.(\w+)\(/);

    if (match) {
      return {
        delegator: methodName,
        delegatee: `${match[1]}.${match[2]}`
      };
    }

    return null;
  }

  /**
   * 判断是否是观察者模式
   */
  private isObserverPattern(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('subscribe') || text.includes('notify') ||
      text.includes('observer') || text.includes('listener');
  }

  /**
   * 提取观察者信息
   */
  private extractObserverInfo(node: Parser.SyntaxNode): {
    observer: string;
    observable: string;
  } | null {
    const text = node.text || '';

    // 简化实现：从文本中提取观察者和被观察者
    if (text.includes('subscribe')) {
      const match = text.match(/(\w+)\.subscribe\((\w+)\)/);
      if (match) {
        return {
          observer: match[2],
          observable: match[1]
        };
      }
    }

    if (text.includes('notify')) {
      const match = text.match(/(\w+)\.notify\((\w+)\)/);
      if (match) {
        return {
          observer: match[2],
          observable: match[1]
        };
      }
    }

    return null;
  }

  /**
   * 判断是否是配置关系
   */
  private isConfiguration(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('config') || text.includes('configure') ||
      text.includes('setup') || text.includes('init');
  }

  /**
   * 提取配置信息
   */
  private extractConfigurationInfo(node: Parser.SyntaxNode): {
    configurable: string;
    configuration: string;
  } | null {
    const text = node.text || '';

    // 简化实现：从文本中提取配置关系
    const match = text.match(/(\w+)\.configure?\((\w+)\)/);
    if (match) {
      return {
        configurable: match[1],
        configuration: match[2]
      };
    }

    return null;
  }

  /**
   * 判断是否是特化
   */
  private isSpecialization(node: Parser.SyntaxNode): boolean {
    // 检查是否是泛型的特化实现
    const text = node.text || '';
    return text.includes('impl') && text.includes('<') && text.includes('for');
  }

  /**
   * 提取特化信息
   */
  private extractSpecializationInfo(node: Parser.SyntaxNode): {
    specialized: string;
    generic: string;
  } | null {
    // 简化实现：从impl块中提取特化信息
    let current = node.parent;
    while (current && current.type !== 'impl_item') {
      current = current.parent;
    }

    if (!current) return null;

    const typeNode = current.childForFieldName('type');
    const traitNode = current.childForFieldName('trait');

    if (typeNode?.text && traitNode?.text) {
      return {
        specialized: typeNode.text,
        generic: traitNode.text
      };
    }

    return null;
  }

  /**
   * 从字符串生成确定性节点ID
   */
  private generateDeterministicNodeIdFromString(text: string): string {
    return `string:${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 分析设计模式
   */
  private analyzeDesignPattern(node: Parser.SyntaxNode): {
    pattern: string;
    confidence: number;
    roles: string[];
  } {
    const text = node.text || '';

    // 检查各种设计模式
    if (this.isBuilderPattern(node)) {
      return {
        pattern: 'builder',
        confidence: 0.8,
        roles: ['builder', 'product']
      };
    }

    if (this.isFactoryPattern(node)) {
      return {
        pattern: 'factory',
        confidence: 0.8,
        roles: ['factory', 'product']
      };
    }

    if (this.isSingletonPattern(node)) {
      return {
        pattern: 'singleton',
        confidence: 0.9,
        roles: ['singleton']
      };
    }

    if (this.isStrategyPattern(node)) {
      return {
        pattern: 'strategy',
        confidence: 0.7,
        roles: ['context', 'strategy']
      };
    }

    return {
      pattern: 'unknown',
      confidence: 0.0,
      roles: []
    };
  }

  /**
   * 判断是否是建造者模式
   */
  private isBuilderPattern(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('build') && text.includes('Builder');
  }

  /**
   * 判断是否是工厂模式
   */
  private isFactoryPattern(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('Factory') || text.includes('create');
  }

  /**
   * 判断是否是单例模式
   */
  private isSingletonPattern(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('static') && text.includes('instance') &&
      text.includes('once_cell') || text.includes('lazy_static');
  }

  /**
   * 判断是否是策略模式
   */
  private isStrategyPattern(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('Strategy') || text.includes('strategy');
  }

  /**
   * 提取语义角色
   */
  private extractSemanticRoles(node: Parser.SyntaxNode): Array<{
    role: string;
    element: string;
    confidence: number;
  }> {
    const roles: Array<{
      role: string;
      element: string;
      confidence: number;
    }> = [];

    // 基于节点类型和内容推断语义角色
    switch (node.type) {
      case 'function_item':
        roles.push({
          role: 'function',
          element: node.childForFieldName('name')?.text || 'unknown',
          confidence: 0.9
        });
        break;

      case 'struct_item':
        roles.push({
          role: 'data_structure',
          element: node.childForFieldName('name')?.text || 'unknown',
          confidence: 0.9
        });
        break;

      case 'trait_item':
        roles.push({
          role: 'interface',
          element: node.childForFieldName('name')?.text || 'unknown',
          confidence: 0.9
        });
        break;

      case 'impl_item':
        const traitNode = node.childForFieldName('trait');
        const typeNode = node.childForFieldName('type');

        if (traitNode) {
          roles.push({
            role: 'implementation',
            element: `${typeNode?.text || 'unknown'} implements ${traitNode.text}`,
            confidence: 0.8
          });
        } else {
          roles.push({
            role: 'inherent_implementation',
            element: typeNode?.text || 'unknown',
            confidence: 0.8
          });
        }
        break;
    }

    return roles;
  }

  /**
   * 计算语义相似度
   */
  private calculateSemanticSimilarity(node1: Parser.SyntaxNode, node2: Parser.SyntaxNode): number {
    // 简化实现：基于节点类型和文本计算相似度
    if (node1.type !== node2.type) return 0.0;

    const text1 = node1.text || '';
    const text2 = node2.text || '';

    // 简单的文本相似度计算
    const commonWords = this.getCommonWords(text1, text2);
    const totalWords = Math.max(this.getWordCount(text1), this.getWordCount(text2));

    return totalWords > 0 ? commonWords.length / totalWords : 0.0;
  }

  /**
   * 获取公共词汇
   */
  private getCommonWords(text1: string, text2: string): string[] {
    const words1 = this.getWords(text1);
    const words2 = this.getWords(text2);

    return words1.filter(word => words2.includes(word));
  }

  /**
   * 获取词汇
   */
  private getWords(text: string): string[] {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }

  /**
   * 获取词汇数量
   */
  private getWordCount(text: string): number {
    return this.getWords(text).length;
  }
}