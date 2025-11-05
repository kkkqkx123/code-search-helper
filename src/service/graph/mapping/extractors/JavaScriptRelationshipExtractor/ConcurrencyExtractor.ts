import {
  ConcurrencyRelationship,
  Parser,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class ConcurrencyExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ConcurrencyRelationship[]> {
    const relationships: ConcurrencyRelationship[] = [];
    
    // 使用Tree-Sitter查询提取并发关系
    const queryResult = this.queryTree(ast, `
      ; Promise创建（异步并发）
      (call_expression
        function: (identifier) @promise.constructor
        (#match? @promise.constructor "Promise$")
        arguments: (argument_list
          (function_expression) @promise.executor)) @concurrency.relationship.promise.creation
      
      ; Promise链式调用（异步并发）
      (call_expression
        function: (member_expression
          object: (call_expression) @source.promise
          property: (property_identifier) @promise.method
          (#match? @promise.method "^(then|catch|finally)$"))
        arguments: (argument_list
          (function_expression) @handler.function)) @concurrency.relationship.promise.chain
      
      ; Async函数定义
      (async_function_declaration
        name: (identifier) @async.function) @concurrency.relationship.async.function
      
      ; Async函数调用
      (call_expression
        function: (identifier) @async.function
        arguments: (argument_list
          (identifier) @async.parameter)) @concurrency.relationship.async.call
      
      ; Await表达式
      (await_expression
        (call_expression) @awaited.call) @concurrency.relationship.await.expression
      
      ; 并行Promise执行
      (call_expression
        function: (member_expression
          object: (identifier) @promise.object
          property: (property_identifier) @parallel.method
          (#match? @parallel.method "^(all|allSettled|race)$"))
        arguments: (argument_list
          (array
            (identifier) @parallel.promise))) @concurrency.relationship.parallel.execution
      
      ; Worker创建
      (new_expression
        constructor: (identifier) @worker.constructor
        (#match? @worker.constructor "Worker$")
        arguments: (argument_list
          (string) @worker.script)) @concurrency.relationship.worker.creation
      
      ; Worker消息发送
      (call_expression
        function: (member_expression
          object: (identifier) @worker.object
          property: (property_identifier) @worker.method
          (#match? @worker.method "^(postMessage|send)$"))
        arguments: (argument_list
          (identifier) @worker.message)) @concurrency.relationship.worker.communication
      
      ; Worker消息接收
      (assignment_expression
        left: (identifier) @message.handler
        right: (member_expression
          object: (identifier) @worker.object
          property: (property_identifier) @worker.event
          (#match? @worker.event "onmessage$"))) @concurrency.relationship.worker.message.reception
      
      ; 共享数组缓冲区
      (new_expression
        constructor: (identifier) @shared.array.constructor
        (#match? @shared.array.constructor "SharedArrayBuffer$")
        arguments: (argument_list
          (identifier) @buffer.size)) @concurrency.relationship.shared.array
      
      ; Atomics操作
      (call_expression
        function: (member_expression
          object: (identifier) @atomics.object
          property: (property_identifier) @atomics.method
          (#match? @atomics.method "^(add|sub|and|or|xor|load|store|compareExchange)$"))
        arguments: (argument_list
          (identifier) @atomics.target
          (identifier) @atomics.value)) @concurrency.relationship.atomics.operation
      
      ; 锁机制模拟
      (call_expression
        function: (member_expression
          object: (identifier) @lock.object
          property: (property_identifier) @lock.method
          (#match? @lock.method "^(acquire|release|tryAcquire)$"))) @concurrency.relationship.lock.operation
      
      ; 条件变量模拟
      (call_expression
        function: (member_expression
          object: (identifier) @condition.variable
          property: (property_identifier) @condition.method
          (#match? @condition.method "^(wait|signal|signalAll)$"))) @concurrency.relationship.condition.variable
      
      ; 信号量模拟
      (call_expression
        function: (member_expression
          object: (identifier) @semaphore.object
          property: (property_identifier) @semaphore.method
          (#match? @semaphore.method "^(acquire|release|availablePermits)$"))) @concurrency.relationship.semaphore.operation
      
      ; 竞态条件检测 - 简化版本
      (assignment_expression
        left: (identifier) @shared.variable
        right: (identifier) @source.variable) @concurrency.relationship.race.condition
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let concurrencyType: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'awaits' = 'synchronizes';
        let synchronizationMechanism = '';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'promise.constructor' || captureName === 'async.function' ||
              captureName === 'worker.constructor' || captureName === 'shared.array.constructor' ||
              captureName === 'atomics.object' || captureName === 'lock.object' ||
              captureName === 'condition.variable' || captureName === 'semaphore.object' ||
              captureName === 'shared.variable') {
            sourceId = generateDeterministicNodeId(node);
          } else if (captureName === 'promise.executor' || captureName === 'promise.method' ||
                     captureName === 'handler.function' || captureName === 'worker.script' ||
                     captureName === 'worker.method' || captureName === 'worker.message' ||
                     captureName === 'message.handler' || captureName === 'worker.event' ||
                     captureName === 'buffer.size' || captureName === 'atomics.method' ||
                     captureName === 'atomics.target' || captureName === 'atomics.value' ||
                     captureName === 'lock.method' || captureName === 'condition.method' ||
                     captureName === 'semaphore.method' || captureName === 'source.variable') {
            targetId = generateDeterministicNodeId(node);
          }
          
          // 确定并发关系类型和同步机制
          if (captureName.includes('promise') || captureName.includes('async') || captureName.includes('await')) {
            concurrencyType = 'awaits';
            synchronizationMechanism = 'promise';
          } else if (captureName.includes('worker')) {
            concurrencyType = 'communicates';
            synchronizationMechanism = 'worker';
          } else if (captureName.includes('atomics') || captureName.includes('lock') ||
                     captureName.includes('condition') || captureName.includes('semaphore')) {
            concurrencyType = 'locks';
            synchronizationMechanism = 'synchronization';
          } else if (captureName.includes('race')) {
            concurrencyType = 'races';
            synchronizationMechanism = 'race_condition';
          } else if (captureName.includes('parallel')) {
            concurrencyType = 'synchronizes';
            synchronizationMechanism = 'parallel_execution';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            concurrencyType,
            synchronizationMechanism,
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