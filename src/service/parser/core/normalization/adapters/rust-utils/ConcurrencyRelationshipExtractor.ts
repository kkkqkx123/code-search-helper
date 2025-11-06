import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import * as Parser from 'tree-sitter';

/**
 * Rust 并发关系提取器
 * 专门处理Rust语言的并发关系提取
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const concurrencyInfo = this.extractConcurrencyInfo(astNode);

    return {
      type: 'concurrency',
      operation: concurrencyInfo.operation,
      fromNodeId: concurrencyInfo.fromNodeId,
      toNodeId: concurrencyInfo.toNodeId,
      concurrencyType: concurrencyInfo.concurrencyType,
      syncPrimitive: concurrencyInfo.syncPrimitive,
      isAsync: concurrencyInfo.isAsync,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
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
    type: 'thread_spawn' | 'channel_comm' | 'mutex_lock' | 'async_await' | 'atomic_op' | 'shared_state';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'thread_spawn' | 'channel_comm' | 'mutex_lock' | 'async_await' | 'atomic_op' | 'shared_state';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取线程创建关系
    if (this.isThreadSpawn(mainNode)) {
      const threadInfo = this.extractThreadSpawnInfo(mainNode);
      if (threadInfo) {
        relationships.push({
          source: threadInfo.handler,
          target: 'thread',
          type: 'thread_spawn'
        });
      }
    }

    // 提取通道通信关系
    if (this.isChannelOperation(mainNode)) {
      const channelInfo = this.extractChannelInfo(mainNode);
      if (channelInfo) {
        relationships.push({
          source: channelInfo.sender || channelInfo.receiver || 'unknown',
          target: channelInfo.channel,
          type: 'channel_comm'
        });
      }
    }

    // 提取锁操作关系
    if (this.isLockOperation(mainNode)) {
      const lockInfo = this.extractLockInfo(mainNode);
      if (lockInfo) {
        relationships.push({
          source: lockInfo.locker,
          target: lockInfo.lockable,
          type: 'mutex_lock'
        });
      }
    }

    // 提取异步操作关系
    if (this.isAsyncOperation(mainNode)) {
      const asyncInfo = this.extractAsyncInfo(mainNode);
      if (asyncInfo) {
        relationships.push({
          source: asyncInfo.awaiter,
          target: asyncInfo.awaited,
          type: 'async_await'
        });
      }
    }

    // 提取原子操作关系
    if (this.isAtomicOperation(mainNode)) {
      const atomicInfo = this.extractAtomicInfo(mainNode);
      if (atomicInfo) {
        relationships.push({
          source: atomicInfo.operator,
          target: atomicInfo.atomic,
          type: 'atomic_op'
        });
      }
    }

    // 提取共享状态关系
    if (this.isSharedStateOperation(mainNode)) {
      const sharedStateInfo = this.extractSharedStateInfo(mainNode);
      if (sharedStateInfo) {
        relationships.push({
          source: sharedStateInfo.sharer,
          target: sharedStateInfo.shared,
          type: 'shared_state'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取并发信息
   */
  private extractConcurrencyInfo(node: Parser.SyntaxNode): {
    operation: string;
    fromNodeId: string;
    toNodeId: string;
    concurrencyType: string;
    syncPrimitive?: string;
    isAsync: boolean;
  } {
    if (this.isThreadSpawn(node)) {
      const threadInfo = this.extractThreadSpawnInfo(node);
      return {
        operation: 'thread_creation',
        fromNodeId: threadInfo ? this.generateDeterministicNodeIdFromString(threadInfo.handler) : 'unknown',
        toNodeId: 'thread_pool',
        concurrencyType: 'thread',
        syncPrimitive: 'std::thread',
        isAsync: false
      };
    }

    if (this.isChannelOperation(node)) {
      const channelInfo = this.extractChannelInfo(node);
      return {
        operation: channelInfo?.operation || 'channel_operation',
        fromNodeId: channelInfo ? this.generateDeterministicNodeIdFromString(channelInfo.sender || channelInfo.receiver || 'unknown') : 'unknown',
        toNodeId: channelInfo ? this.generateDeterministicNodeIdFromString(channelInfo.channel || 'unknown') : 'unknown',
        concurrencyType: 'channel',
        syncPrimitive: 'std::sync::mpsc',
        isAsync: false
      };
    }

    if (this.isLockOperation(node)) {
      const lockInfo = this.extractLockInfo(node);
      return {
        operation: lockInfo?.operation || 'lock_operation',
        fromNodeId: lockInfo ? this.generateDeterministicNodeIdFromString(lockInfo.locker) : 'unknown',
        toNodeId: lockInfo ? this.generateDeterministicNodeIdFromString(lockInfo.lockable) : 'unknown',
        concurrencyType: 'lock',
        syncPrimitive: lockInfo?.lockType,
        isAsync: false
      };
    }

    if (this.isAsyncOperation(node)) {
      const asyncInfo = this.extractAsyncInfo(node);
      return {
        operation: 'async_operation',
        fromNodeId: asyncInfo ? this.generateDeterministicNodeIdFromString(asyncInfo.awaiter) : 'unknown',
        toNodeId: asyncInfo ? this.generateDeterministicNodeIdFromString(asyncInfo.awaited) : 'unknown',
        concurrencyType: 'async',
        isAsync: true
      };
    }

    if (this.isAtomicOperation(node)) {
      const atomicInfo = this.extractAtomicInfo(node);
      return {
        operation: 'atomic_operation',
        fromNodeId: atomicInfo ? this.generateDeterministicNodeIdFromString(atomicInfo.operator) : 'unknown',
        toNodeId: atomicInfo ? this.generateDeterministicNodeIdFromString(atomicInfo.atomic) : 'unknown',
        concurrencyType: 'atomic',
        syncPrimitive: 'std::sync::atomic',
        isAsync: false
      };
    }

    return {
      operation: 'unknown',
      fromNodeId: 'unknown',
      toNodeId: 'unknown',
      concurrencyType: 'unknown',
      isAsync: false
    };
  }

  /**
   * 判断是否是线程创建
   */
  private isThreadSpawn(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression') return false;
    
    const funcNode = node.childForFieldName('function');
    if (!funcNode) return false;
    
    const text = funcNode.text || '';
    return text.includes('thread::spawn') || text.includes('std::thread::spawn');
  }

  /**
   * 提取线程创建信息
   */
  private extractThreadSpawnInfo(node: Parser.SyntaxNode): {handler: string} | null {
    const funcNode = node.childForFieldName('function');
    if (!funcNode) return null;
    
    // 简化实现：返回函数名
    return {
      handler: funcNode.text || 'unknown'
    };
  }

  /**
   * 判断是否是通道操作
   */
  private isChannelOperation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression' && node.type !== 'method_call_expression') return false;
    
    const text = node.text || '';
    return text.includes('send(') || text.includes('recv(') || 
           text.includes('channel(') || text.includes('mpsc::');
  }

  /**
   * 提取通道信息
   */
  private extractChannelInfo(node: Parser.SyntaxNode): {
    operation: string;
    channel: string;
    sender?: string;
    receiver?: string;
  } | null {
    const text = node.text || '';
    
    if (text.includes('send(')) {
      return {
        operation: 'send',
        channel: 'channel',
        sender: this.extractCallerName(node)
      };
    } else if (text.includes('recv(')) {
      return {
        operation: 'receive',
        channel: 'channel',
        receiver: this.extractCallerName(node)
      };
    } else if (text.includes('channel(')) {
      return {
        operation: 'create',
        channel: 'channel'
      };
    }
    
    return null;
  }

  /**
   * 判断是否是锁操作
   */
  private isLockOperation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression' && node.type !== 'method_call_expression') return false;
    
    const text = node.text || '';
    return text.includes('lock(') || text.includes('try_lock(') || 
           text.includes('read(') || text.includes('write(') ||
           text.includes('Mutex') || text.includes('RwLock');
  }

  /**
   * 提取锁信息
   */
  private extractLockInfo(node: Parser.SyntaxNode): {
    operation: string;
    lockType: string;
    locker: string;
    lockable: string;
  } | null {
    const text = node.text || '';
    let lockType = 'unknown';
    
    if (text.includes('Mutex')) {
      lockType = 'Mutex';
    } else if (text.includes('RwLock')) {
      lockType = 'RwLock';
    }
    
    let operation = 'unknown';
    if (text.includes('lock(')) {
      operation = 'lock';
    } else if (text.includes('try_lock(')) {
      operation = 'try_lock';
    } else if (text.includes('read(')) {
      operation = 'read';
    } else if (text.includes('write(')) {
      operation = 'write';
    }
    
    return {
      operation,
      lockType,
      locker: this.extractCallerName(node),
      lockable: this.extractLockTarget(node)
    };
  }

  /**
   * 判断是否是异步操作
   */
  private isAsyncOperation(node: Parser.SyntaxNode): boolean {
    return node.type === 'await_expression' ||
           node.type === 'async_block' ||
           !!(node.text && (node.text.includes('await') || node.text.includes('async')));
  }

  /**
   * 提取异步信息
   */
  private extractAsyncInfo(node: Parser.SyntaxNode): {
    awaiter: string;
    awaited: string;
  } | null {
    if (node.type === 'await_expression') {
      const valueNode = node.childForFieldName('value');
      if (valueNode?.text) {
        return {
          awaiter: 'async_context',
          awaited: valueNode.text
        };
      }
    }
    
    return null;
  }

  /**
   * 判断是否是原子操作
   */
  private isAtomicOperation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression' && node.type !== 'method_call_expression') return false;
    
    const text = node.text || '';
    return text.includes('Atomic') || text.includes('load(') || 
           text.includes('store(') || text.includes('swap(') ||
           text.includes('compare_and_swap(') || text.includes('fetch_');
  }

  /**
   * 提取原子操作信息
   */
  private extractAtomicInfo(node: Parser.SyntaxNode): {
    operator: string;
    atomic: string;
  } | null {
    return {
      operator: this.extractCallerName(node),
      atomic: this.extractAtomicTarget(node)
    };
  }

  /**
   * 判断是否是共享状态操作
   */
  private isSharedStateOperation(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression' && node.type !== 'method_call_expression') return false;
    
    const text = node.text || '';
    return text.includes('Arc::') || text.includes('Rc::') || 
           text.includes('clone(') || text.includes('Arc::new');
  }

  /**
   * 提取共享状态信息
   */
  private extractSharedStateInfo(node: Parser.SyntaxNode): {
    sharer: string;
    shared: string;
  } | null {
    return {
      sharer: this.extractCallerName(node),
      shared: this.extractSharedTarget(node)
    };
  }

  /**
   * 提取调用者名称
   */
  private extractCallerName(node: Parser.SyntaxNode): string {
    if (node.type === 'method_call_expression') {
      const objectNode = node.childForFieldName('object');
      return objectNode?.text || 'unknown';
    }
    
    const callerNode = RustHelperMethods.findCallerFunctionContext(node);
    return callerNode?.text || 'unknown';
  }

  /**
   * 提取锁目标
   */
  private extractLockTarget(node: Parser.SyntaxNode): string {
    if (node.type === 'method_call_expression') {
      const objectNode = node.childForFieldName('object');
      return objectNode?.text || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * 提取原子操作目标
   */
  private extractAtomicTarget(node: Parser.SyntaxNode): string {
    if (node.type === 'method_call_expression') {
      const objectNode = node.childForFieldName('object');
      return objectNode?.text || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * 提取共享状态目标
   */
  private extractSharedTarget(node: Parser.SyntaxNode): string {
    if (node.type === 'method_call_expression') {
      const objectNode = node.childForFieldName('object');
      return objectNode?.text || 'unknown';
    }
    
    const funcNode = node.childForFieldName('function');
    if (funcNode?.text) {
      const match = funcNode.text.match(/(\w+)::/);
      return match ? match[1] : 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * 从字符串生成确定性节点ID
   */
  private generateDeterministicNodeIdFromString(text: string): string {
    return `string:${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 分析并发模式
   */
  private analyzeConcurrencyPattern(node: Parser.SyntaxNode): {
    pattern: string;
    isProducerConsumer: boolean;
    isWorkStealing: boolean;
    isForkJoin: boolean;
    isActorModel: boolean;
  } {
    const text = node.text || '';
    
    return {
      pattern: this.identifyConcurrencyPattern(text),
      isProducerConsumer: text.includes('send') && text.includes('recv'),
      isWorkStealing: text.includes('crossbeam') || text.includes('work_stealing'),
      isForkJoin: text.includes('join') || text.includes('scope'),
      isActorModel: text.includes('mailbox') || text.includes('actor')
    };
  }

  /**
   * 识别并发模式
   */
  private identifyConcurrencyPattern(text: string): string {
    if (text.includes('mpsc')) return 'producer_consumer';
    if (text.includes('Mutex')) return 'mutual_exclusion';
    if (text.includes('RwLock')) return 'read_write_lock';
    if (text.includes('Atomic')) return 'atomic_operations';
    if (text.includes('Arc')) return 'shared_ownership';
    if (text.includes('async') || text.includes('await')) return 'async_await';
    if (text.includes('thread::spawn')) return 'thread_spawn';
    
    return 'unknown';
  }

  /**
   * 提取同步原语
   */
  private extractSyncPrimitive(node: Parser.SyntaxNode): string {
    const text = node.text || '';
    
    if (text.includes('Mutex')) return 'Mutex';
    if (text.includes('RwLock')) return 'RwLock';
    if (text.includes('Atomic')) return 'Atomic';
    if (text.includes('Condvar')) return 'Condvar';
    if (text.includes('Barrier')) return 'Barrier';
    if (text.includes('channel')) return 'Channel';
    if (text.includes('Arc')) return 'Arc';
    
    return 'unknown';
  }
}