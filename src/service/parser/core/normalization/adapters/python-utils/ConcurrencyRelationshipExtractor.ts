import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 并发关系提取器
 * 专门处理Python语言的并发关系提取，如线程、进程、协程、锁、同步等
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const concurrencyType = this.determineConcurrencyType(astNode);
    const concurrencyDetails = this.extractConcurrencyDetails(astNode);

    return {
      type: 'concurrency',
      concurrencyType,
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      concurrencyDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取并发关系
   */
  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'synchronizes' | 'locks' | 'communicates' | 'races';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取锁机制关系
    if (mainNode.type === 'with_statement') {
      const context = mainNode.childForFieldName('context');
      if (context?.text && this.isLockContext(context.text)) {
        relationships.push({
          source: 'lock',
          target: 'critical-section',
          type: 'synchronizes'
        });
      }
    }

    // 提取异步操作关系
    if (mainNode.type === 'await') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: 'async-operation',
          target: value.text,
          type: 'communicates'
        });
      }
    }

    // 提取线程创建关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.text && this.isThreadCreation(func.text)) {
        relationships.push({
          source: 'thread-pool',
          target: func.text,
          type: 'communicates'
        });
      }
    }

    // 提取进程创建关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.text && this.isProcessCreation(func.text)) {
        relationships.push({
          source: 'process-pool',
          target: func.text,
          type: 'communicates'
        });
      }
    }

    // 提取队列通信关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isQueueOperation(attribute.text)) {
          relationships.push({
            source: object.text,
            target: attribute.text,
            type: 'communicates'
          });
        }
      }
    }

    // 提取事件同步关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isEventOperation(attribute.text)) {
          relationships.push({
            source: object.text,
            target: attribute.text,
            type: 'synchronizes'
          });
        }
      }
    }

    // 提取条件变量同步关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isConditionOperation(attribute.text)) {
          relationships.push({
            source: object.text,
            target: attribute.text,
            type: 'synchronizes'
          });
        }
      }
    }

    // 提取信号量同步关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isSemaphoreOperation(attribute.text)) {
          relationships.push({
            source: object.text,
            target: attribute.text,
            type: 'synchronizes'
          });
        }
      }
    }

    // 提取异步函数定义关系
    if (mainNode.type === 'async_function_definition') {
      const funcName = mainNode.childForFieldName('name')?.text;
      if (funcName) {
        relationships.push({
          source: 'async-context',
          target: funcName,
          type: 'communicates'
        });
      }
    }

    // 提取异步上下文管理器关系
    if (mainNode.type === 'async_with_statement') {
      const context = mainNode.childForFieldName('context');
      if (context?.text) {
        relationships.push({
          source: 'async-context-manager',
          target: context.text,
          type: 'synchronizes'
        });
      }
    }

    // 提取异步迭代器关系
    if (mainNode.type === 'async_for_statement') {
      const iter = mainNode.childForFieldName('iter');
      if (iter?.text) {
        relationships.push({
          source: 'async-iterator',
          target: iter.text,
          type: 'communicates'
        });
      }
    }

    // 提取共享资源访问关系（潜在的竞态条件）
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.type === 'attribute' && right?.text) {
        const object = left.childForFieldName('object');
        const attribute = left.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isSharedResource(object.text)) {
          relationships.push({
            source: right.text,
            target: `${object.text}.${attribute.text}`,
            type: 'races'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 确定并发类型
   */
  private determineConcurrencyType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'with_statement':
        const context = astNode.childForFieldName('context');
        if (context?.text && this.isLockContext(context.text)) return 'lock_synchronization';
        return 'context_management';
        
      case 'await':
        return 'async_await';
        
      case 'call':
        const func = astNode.childForFieldName('function');
        if (func?.text) {
          if (this.isThreadCreation(func.text)) return 'thread_creation';
          if (this.isProcessCreation(func.text)) return 'process_creation';
          if (func.type === 'attribute') {
            const attribute = func.childForFieldName('attribute');
            if (attribute?.text) {
              if (this.isQueueOperation(attribute.text)) return 'queue_communication';
              if (this.isEventOperation(attribute.text)) return 'event_synchronization';
              if (this.isConditionOperation(attribute.text)) return 'condition_synchronization';
              if (this.isSemaphoreOperation(attribute.text)) return 'semaphore_synchronization';
            }
          }
        }
        return 'method_call';
        
      case 'async_function_definition':
        return 'async_function';
        
      case 'async_with_statement':
        return 'async_context_management';
        
      case 'async_for_statement':
        return 'async_iteration';
        
      case 'assignment':
        return 'shared_resource_access';
        
      default:
        return 'unknown_concurrency';
    }
  }

  /**
   * 提取并发详细信息
   */
  private extractConcurrencyDetails(astNode: Parser.SyntaxNode): any {
    const details: any = {};

    switch (astNode.type) {
      case 'with_statement':
        const context = astNode.childForFieldName('context');
        details.contextManager = context?.text;
        details.lockType = this.identifyLockType(context?.text || '');
        break;
        
      case 'await':
        const value = astNode.childForFieldName('value');
        details.awaitedValue = value?.text;
        break;
        
      case 'call':
        const func = astNode.childForFieldName('function');
        details.functionName = func?.text;
        details.argumentCount = astNode.childForFieldName('arguments')?.childCount || 0;
        
        if (func?.type === 'attribute') {
          const object = func.childForFieldName('object');
          const attribute = func.childForFieldName('attribute');
          details.objectName = object?.text;
          details.methodName = attribute?.text;
        }
        break;
        
      case 'async_function_definition':
        const funcName = astNode.childForFieldName('name');
        details.functionName = funcName?.text;
        details.parameterCount = this.countParameters(astNode);
        details.isGenerator = PythonHelperMethods.isGeneratorFunction(astNode);
        break;
        
      case 'async_with_statement':
        const asyncContext = astNode.childForFieldName('context');
        details.contextManager = asyncContext?.text;
        break;
        
      case 'async_for_statement':
        const asyncIter = astNode.childForFieldName('iter');
        details.iterator = asyncIter?.text;
        break;
        
      case 'assignment':
        const left = astNode.childForFieldName('left');
        const right = astNode.childForFieldName('right');
        details.target = left?.text;
        details.source = right?.text;
        if (left?.type === 'attribute') {
          const object = left.childForFieldName('object');
          details.sharedResource = object?.text;
        }
        break;
    }

    return details;
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'with_statement':
      case 'async_with_statement':
        const context = astNode.childForFieldName('context');
        return context ? NodeIdGenerator.forAstNode(context) : 'unknown';
        
      case 'await':
        return 'await-point';
        
      case 'call':
        const func = astNode.childForFieldName('function');
        if (func?.type === 'attribute') {
          const object = func.childForFieldName('object');
          return object ? NodeIdGenerator.forAstNode(object) : 'unknown';
        }
        return 'caller';
        
      case 'async_function_definition':
        const funcName = astNode.childForFieldName('name');
        return funcName ? NodeIdGenerator.forAstNode(funcName) : 'unknown';
        
      case 'async_for_statement':
        const iter = astNode.childForFieldName('iter');
        return iter ? NodeIdGenerator.forAstNode(iter) : 'unknown';
        
      case 'assignment':
        const right = astNode.childForFieldName('right');
        return right ? NodeIdGenerator.forAstNode(right) : 'unknown';
        
      default:
        return NodeIdGenerator.forAstNode(astNode);
    }
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'with_statement':
      case 'async_with_statement':
        return 'critical-section';
        
      case 'await':
        const value = astNode.childForFieldName('value');
        return value ? NodeIdGenerator.forAstNode(value) : 'unknown';
        
      case 'call':
        const func = astNode.childForFieldName('function');
        return func ? NodeIdGenerator.forAstNode(func) : 'unknown';
        
      case 'async_function_definition':
        return NodeIdGenerator.forAstNode(astNode);
        
      case 'async_for_statement':
        return 'async-loop-body';
        
      case 'assignment':
        const left = astNode.childForFieldName('left');
        return left ? NodeIdGenerator.forAstNode(left) : 'unknown';
        
      default:
        return 'unknown';
    }
  }

  // 辅助方法

  private isLockContext(contextText: string): boolean {
    const lockPatterns = [
      'lock', 'Lock', 'RLock', 'threading.Lock', 'threading.RLock',
      'asyncio.Lock', 'asyncio.Semaphore', 'asyncio.BoundedSemaphore'
    ];
    return lockPatterns.some(pattern => contextText.includes(pattern));
  }

  private identifyLockType(contextText: string): string {
    if (contextText.includes('threading.Lock') || contextText.includes('Lock')) return 'mutex_lock';
    if (contextText.includes('threading.RLock') || contextText.includes('RLock')) return 'reentrant_lock';
    if (contextText.includes('asyncio.Lock')) return 'async_lock';
    if (contextText.includes('asyncio.Semaphore')) return 'async_semaphore';
    if (contextText.includes('asyncio.BoundedSemaphore')) return 'async_bounded_semaphore';
    return 'unknown_lock';
  }

  private isThreadCreation(funcText: string): boolean {
    const threadPatterns = [
      'Thread', 'threading.Thread', 'thread.start_new_thread'
    ];
    return threadPatterns.some(pattern => funcText.includes(pattern));
  }

  private isProcessCreation(funcText: string): boolean {
    const processPatterns = [
      'Process', 'multiprocessing.Process', 'Pool', 'multiprocessing.Pool'
    ];
    return processPatterns.some(pattern => funcText.includes(pattern));
  }

  private isQueueOperation(methodName: string): boolean {
    const queueOperations = ['put', 'get', 'queue', 'join', 'task_done'];
    return queueOperations.some(op => methodName.toLowerCase().includes(op));
  }

  private isEventOperation(methodName: string): boolean {
    const eventOperations = ['set', 'clear', 'wait', 'is_set'];
    return eventOperations.some(op => methodName.toLowerCase().includes(op));
  }

  private isConditionOperation(methodName: string): boolean {
    const conditionOperations = ['acquire', 'release', 'wait', 'notify', 'notify_all'];
    return conditionOperations.some(op => methodName.toLowerCase().includes(op));
  }

  private isSemaphoreOperation(methodName: string): boolean {
    const semaphoreOperations = ['acquire', 'release'];
    return semaphoreOperations.some(op => methodName.toLowerCase().includes(op));
  }

  private isSharedResource(objectName: string): boolean {
    const sharedResourcePatterns = [
      'global', 'shared', 'queue', 'lock', 'event', 'condition', 'semaphore'
    ];
    return sharedResourcePatterns.some(pattern => objectName.toLowerCase().includes(pattern));
  }

  private countParameters(funcNode: Parser.SyntaxNode): number {
    const parameters = funcNode.childForFieldName('parameters');
    return parameters?.childCount || 0;
  }

  /**
   * 提取线程池关系
   */
  extractThreadPoolRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'submit' | 'map' | 'shutdown';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'submit' | 'map' | 'shutdown';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找线程池操作
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text) {
          if (this.isThreadPoolOperation(attribute.text)) {
            relationships.push({
              source: object.text,
              target: attribute.text,
              type: this.mapThreadPoolOperation(attribute.text)
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * 提取协程关系
   */
  extractCoroutineRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'create' | 'await' | 'gather' | 'schedule';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'create' | 'await' | 'gather' | 'schedule';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找协程创建
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.text && this.isCoroutineCreation(func.text)) {
        relationships.push({
          source: 'asyncio',
          target: func.text,
          type: 'create'
        });
      }
    }

    // 查找协程等待
    if (mainNode.type === 'await') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: 'coroutine',
          target: value.text,
          type: 'await'
        });
      }
    }

    // 查找协程聚集
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.text && this.isCoroutineGather(func.text)) {
        relationships.push({
          source: 'asyncio',
          target: func.text,
          type: 'gather'
        });
      }
    }

    return relationships;
  }

  private isThreadPoolOperation(methodName: string): boolean {
    const poolOperations = ['submit', 'map', 'shutdown', 'apply', 'apply_async'];
    return poolOperations.some(op => methodName.toLowerCase().includes(op));
  }

  private mapThreadPoolOperation(methodName: string): 'submit' | 'map' | 'shutdown' {
    if (methodName.toLowerCase().includes('submit')) return 'submit';
    if (methodName.toLowerCase().includes('map')) return 'map';
    if (methodName.toLowerCase().includes('shutdown')) return 'shutdown';
    return 'submit'; // 默认
  }

  private isCoroutineCreation(funcText: string): boolean {
    const coroutinePatterns = ['create_task', 'ensure_future', 'asyncio.create_task', 'asyncio.ensure_future'];
    return coroutinePatterns.some(pattern => funcText.includes(pattern));
  }

  private isCoroutineGather(funcText: string): boolean {
    const gatherPatterns = ['gather', 'asyncio.gather', 'wait', 'asyncio.wait'];
    return gatherPatterns.some(pattern => funcText.includes(pattern));
  }
}