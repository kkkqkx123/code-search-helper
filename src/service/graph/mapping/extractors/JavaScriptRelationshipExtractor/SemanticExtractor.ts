import {
  SemanticRelationship,
  Parser,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class SemanticExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];
    
    // 使用Tree-Sitter查询提取语义关系
    const queryResult = this.queryTree(ast, `
      ; 原型链继承关系（方法重写）
      (assignment_expression
        left: (member_expression
          object: (identifier) @subclass.object
          property: (property_identifier) @overridden.method)
        right: (function_expression)) @semantic.relationship.prototype.override
      
      ; 类继承关系（方法重写）
      (class_declaration
        name: (identifier) @subclass.class
        heritage: (class_heritage
          (identifier) @superclass.class)
        body: (class_body
          (method_definition
            name: (property_identifier) @overridden.method))) @semantic.relationship.class.override
      
      ; 混入模式（委托关系）
      (call_expression
        function: (member_expression
          object: (identifier) @mixin.object
          property: (property_identifier) @mixin.method)
        arguments: (argument_list
          (identifier) @target.object)) @semantic.relationship.mixin.delegation
      
      ; 观察者模式（事件监听）
      (call_expression
        function: (member_expression
          object: (identifier) @observer.target
          property: (property_identifier) @observer.method
          (#match? @observer.method "^(addEventListener|on|watch|subscribe)$"))
        arguments: (argument_list
          (string) @event.name
          (function_expression) @handler.function)) @semantic.relationship.observer.pattern
      
      ; 发布订阅模式
      (call_expression
        function: (member_expression
          object: (identifier) @publisher.object
          property: (property_identifier) @publisher.method
          (#match? @publisher.method "^(emit|publish|notify)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @event.data)) @semantic.relationship.publisher.pattern
      
      ; 配置对象模式
      (call_expression
        function: (identifier) @configurable.function
        arguments: (argument_list
          (object
            (pair
              key: (property_identifier) @config.key
              value: (identifier) @config.value)))) @semantic.relationship.configuration
      
      ; 工厂模式
      (call_expression
        function: (identifier) @factory.function
        arguments: (argument_list
          (identifier) @factory.parameter)) @semantic.relationship.factory.pattern
      
      ; 单例模式
      (assignment_expression
        left: (member_expression
          object: (identifier) @singleton.object
          property: (property_identifier) @singleton.instance)
        right: (call_expression
          function: (identifier) @constructor.function)) @semantic.relationship.singleton.pattern
      
      ; 装饰器模式（高阶函数）
      (call_expression
        function: (identifier) @decorator.function
        arguments: (argument_list
          (function_expression) @decorated.function)) @semantic.relationship.decorator.pattern
      
      ; 策略模式
      (call_expression
        function: (member_expression
          object: (identifier) @context.object
          property: (property_identifier) @strategy.setter
          (#match? @strategy.setter "^(setStrategy|setAlgorithm)$"))
        arguments: (argument_list
          (identifier) @strategy.object)) @semantic.relationship.strategy.pattern
      
      ; 命令模式
      (call_expression
        function: (member_expression
          object: (identifier) @invoker.object
          property: (property_identifier) @invoker.method
          (#match? @invoker.method "^(execute|invoke|run)$"))
        arguments: (argument_list
          (identifier) @command.object)) @semantic.relationship.command.pattern
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let semanticType: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' = 'overrides';
        let pattern = '';
        const metadata: Record<string, any> = {};
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'subclass.object' || captureName === 'subclass.class' ||
              captureName === 'mixin.object' || captureName === 'observer.target' ||
              captureName === 'publisher.object' || captureName === 'configurable.function' ||
              captureName === 'factory.function' || captureName === 'singleton.object' ||
              captureName === 'decorator.function' || captureName === 'context.object' ||
              captureName === 'invoker.object') {
            sourceId = generateDeterministicNodeId(node);
          } else if (captureName === 'overridden.method' || captureName === 'superclass.class' ||
                     captureName === 'mixin.method' || captureName === 'observer.method' ||
                     captureName === 'publisher.method' || captureName === 'config.key' ||
                     captureName === 'factory.parameter' || captureName === 'singleton.instance' ||
                     captureName === 'decorated.function' || captureName === 'strategy.object' ||
                     captureName === 'strategy.setter' || captureName === 'invoker.method' ||
                     captureName === 'command.object') {
            targetId = generateDeterministicNodeId(node);
          }
          
          // 确定语义关系类型和模式
          if (captureName.includes('override')) {
            semanticType = 'overrides';
            pattern = 'Override';
          } else if (captureName.includes('overload')) {
            semanticType = 'overloads';
            pattern = 'Overload';
          } else if (captureName.includes('delegation') || captureName.includes('mixin')) {
            semanticType = 'delegates';
            pattern = 'Mixin';
          } else if (captureName.includes('observer') || captureName.includes('publisher')) {
            semanticType = 'observes';
            pattern = 'Observer';
          } else if (captureName.includes('configuration') || captureName.includes('config')) {
            semanticType = 'configures';
            pattern = 'Configuration';
          } else if (captureName.includes('factory')) {
            pattern = 'Factory';
          } else if (captureName.includes('singleton')) {
            pattern = 'Singleton';
          } else if (captureName.includes('decorator')) {
            pattern = 'Decorator';
          } else if (captureName.includes('strategy')) {
            pattern = 'Strategy';
          } else if (captureName.includes('command')) {
            pattern = 'Command';
          }
          
          // 收集元数据
          if (captureName.includes('event.name')) {
            metadata.eventName = node.text;
          } else if (captureName.includes('event.data')) {
            metadata.eventData = node.text;
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            semanticType,
            pattern,
            metadata,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 辅助方法：执行Tree-Sitter查询
  private queryTree(ast: Parser.SyntaxNode, query: string): any[] {
    // 这里应该实现Tree-Sitter查询逻辑
    // 由于我们移除了TreeSitterService，这里需要一个简化的实现
    // 在实际应用中，你可能需要重新引入Tree-Sitter查询功能
    return [];
  }
}