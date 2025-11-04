import {
  LifecycleRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  injectable
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class LifecycleExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];
    
    // 使用Tree-Sitter查询提取生命周期关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; 对象实例化关系
      (new_expression
        constructor: (identifier) @instantiated.class
        arguments: (argument_list
          (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation
      
      ; 类实例化关系
      (new_expression
        constructor: (member_expression
          object: (identifier) @module.object
          property: (identifier) @instantiated.class)
        arguments: (argument_list
          (identifier) @constructor.parameter)) @lifecycle.relationship.class.instantiation
      
      ; 构造函数调用关系
      (call_expression
        function: (member_expression
          object: (this) @constructor.this
          property: (property_identifier) @constructor.method
          (#match? @constructor.method "constructor$"))) @lifecycle.relationship.constructor.call
      
      ; 原型方法初始化
      (assignment_expression
        left: (member_expression
          object: (member_expression
            object: (identifier) @class.object
            property: (property_identifier) @prototype.property)
          property: (property_identifier) @init.method)
        right: (function_expression)) @lifecycle.relationship.prototype.initialization
      
      ; 对象初始化方法
      (call_expression
        function: (member_expression
          object: (identifier) @initialized.object
          property: (property_identifier) @init.method
          (#match? @init.method "^(init|initialize|setup|configure)$"))
        arguments: (argument_list
          (identifier) @init.parameter)) @lifecycle.relationship.object.initialization
      
      ; React组件生命周期
      (method_definition
        name: (property_identifier) @lifecycle.method
        (#match? @lifecycle.method "^(componentDidMount|componentDidUpdate|componentWillUnmount|useEffect|useLayoutEffect)$")) @lifecycle.relationship.react.lifecycle
      
      ; 销毁关系
      (call_expression
        function: (member_expression
          object: (identifier) @destroyed.object
          property: (property_identifier) @destroy.method
          (#match? @destroy.method "^(destroy|dispose|cleanup|teardown|close)$"))) @lifecycle.relationship.destruction
      
      ; 事件监听器添加（生命周期管理）
      (call_expression
        function: (member_expression
          object: (identifier) @event.target
          property: (property_identifier) @add.listener.method
          (#match? @add.listener.method "^(addEventListener|addListener|on)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @handler.function)) @lifecycle.relationship.listener.addition
      
      ; 事件监听器移除（生命周期管理）
      (call_expression
        function: (member_expression
          object: (identifier) @event.target
          property: (property_identifier) @remove.listener.method
          (#match? @remove.listener.method "^(removeEventListener|removeListener|off)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @handler.function)) @lifecycle.relationship.listener.removal
      
      ; 定时器创建（生命周期管理）
      (call_expression
        function: (identifier) @timer.function
        (#match? @timer.function "^(setTimeout|setInterval)$")
        arguments: (argument_list
          (function_expression) @timer.handler
          (identifier) @timer.delay)) @lifecycle.relationship.timer.creation
      
      ; 定时器清除（生命周期管理）
      (call_expression
        function: (identifier) @clear.timer.function
        (#match? @clear.timer.function "^(clearTimeout|clearInterval)$")
        arguments: (argument_list
          (identifier) @timer.id)) @lifecycle.relationship.timer.clearance
      
      ; Promise创建（异步生命周期）
      (call_expression
        function: (identifier) @promise.constructor
        (#match? @promise.constructor "Promise$")
        arguments: (argument_list
          (function_expression) @promise.executor)) @lifecycle.relationship.promise.creation
      
      ; 异步资源管理
      (call_expression
        function: (member_expression
          object: (identifier) @async.resource
          property: (property_identifier) @async.method
          (#match? @async.method "^(acquire|release|open|close|start|stop)$"))) @lifecycle.relationship.async.resource.management
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let lifecycleType: 'instantiates' | 'initializes' | 'destroys' | 'manages' = 'instantiates';
        let lifecyclePhase: 'creation' | 'setup' | 'teardown' | 'maintenance' = 'creation';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'instantiated.class' || captureName === 'module.object' ||
              captureName === 'constructor.this' || captureName === 'class.object' ||
              captureName === 'initialized.object' || captureName === 'lifecycle.method' ||
              captureName === 'destroyed.object' || captureName === 'event.target' ||
              captureName === 'timer.function' || captureName === 'promise.constructor' ||
              captureName === 'async.resource') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_source', filePath);
          } else if (captureName === 'constructor.parameter' || captureName === 'prototype.property' ||
                     captureName === 'init.method' || captureName === 'init.parameter' ||
                     captureName === 'destroy.method' || captureName === 'event.name' ||
                     captureName === 'handler.function' || captureName === 'timer.handler' ||
                     captureName === 'timer.delay' || captureName === 'timer.id' ||
                     captureName === 'promise.executor' || captureName === 'async.method') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_target', filePath);
          }
          
          // 确定生命周期类型和阶段
          if (captureName.includes('instantiation') || captureName.includes('constructor')) {
            lifecycleType = 'instantiates';
            lifecyclePhase = 'creation';
          } else if (captureName.includes('initialization') || captureName.includes('init')) {
            lifecycleType = 'initializes';
            lifecyclePhase = 'setup';
          } else if (captureName.includes('destruction') || captureName.includes('destroy')) {
            lifecycleType = 'destroys';
            lifecyclePhase = 'teardown';
          } else if (captureName.includes('management') || captureName.includes('listener') ||
                     captureName.includes('timer') || captureName.includes('promise')) {
            lifecycleType = 'manages';
            lifecyclePhase = 'maintenance';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            lifecycleType,
            lifecyclePhase,
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
}