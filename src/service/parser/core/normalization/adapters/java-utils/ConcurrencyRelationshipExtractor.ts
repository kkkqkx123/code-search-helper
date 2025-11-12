import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 并发关系提取器
 * 从 JavaLanguageAdapter 迁移并发关系提取逻辑
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const captures = result.captures || [];
    const metadata: any = {
      type: 'concurrency',
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column
      }
    };

    // 提取并发操作类型
    for (const capture of captures) {
      if (capture.name.includes('synchronized') || capture.name.includes('lock')) {
        metadata.concurrencyType = 'synchronizes';
        metadata.lockedResource = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      } else if (capture.name.includes('thread') || capture.name.includes('start')) {
        metadata.concurrencyType = 'manages';
        metadata.managedThread = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      } else if (capture.name.includes('wait') || capture.name.includes('notify')) {
        metadata.concurrencyType = 'communicates';
        metadata.communicationPoint = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      }
    }

    // 如果没有从捕获中获取到信息，尝试从AST节点分析
    if (!metadata.concurrencyType) {
      this.analyzeConcurrencyFromAST(astNode, metadata);
    }

    return metadata;
  }

  /**
   * 从AST节点分析并发关系
   */
  private analyzeConcurrencyFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
    const text = astNode.text || '';
    
    // 检查同步机制
    if (astNode.type === 'synchronized_statement') {
      metadata.concurrencyType = 'synchronizes';
      const lockObject = astNode.childForFieldName('value');
      if (lockObject?.text) {
        metadata.lockedResource = lockObject.text;
        metadata.toNodeId = NodeIdGenerator.forAstNode(lockObject);
      }
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    } else if (text.includes('synchronized') || text.includes('ReentrantLock') || 
               text.includes('Lock') || text.includes('ReadWriteLock')) {
      metadata.concurrencyType = 'synchronizes';
      metadata.lockedResource = this.extractLockResource(astNode);
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查线程管理
    if (text.includes('Thread') || text.includes('ExecutorService') || 
        text.includes('ThreadPoolExecutor') || text.includes('ForkJoinPool')) {
      metadata.concurrencyType = 'manages';
      metadata.managedThread = this.extractThreadResource(astNode);
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查线程间通信
    if (text.includes('.wait()') || text.includes('.notify()') || 
        text.includes('.notifyAll()') || text.includes('CountDownLatch') ||
        text.includes('CyclicBarrier') || text.includes('Semaphore')) {
      metadata.concurrencyType = 'communicates';
      metadata.communicationPoint = this.extractCommunicationPoint(astNode);
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查竞态条件
    if (text.includes('volatile') || text.includes('Atomic') || 
        text.includes('ConcurrentHashMap') || text.includes('CopyOnWriteArrayList')) {
      metadata.concurrencyType = 'races';
      metadata.raceCondition = this.extractRaceCondition(astNode);
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }
  }

  /**
   * 提取锁资源
   */
  private extractLockResource(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'synchronized_statement') {
      const lockObject = astNode.childForFieldName('value');
      return lockObject?.text || null;
    } else if (astNode.type === 'method_invocation') {
      const method = astNode.childForFieldName('name');
      if (method?.text && (method.text.includes('lock') || method.text.includes('unlock'))) {
        const object = astNode.childForFieldName('object');
        return object?.text || method.text;
      }
    }
    return null;
  }

  /**
   * 提取线程资源
   */
  private extractThreadResource(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'object_creation_expression') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode?.text && (typeNode.text.includes('Thread') || 
          typeNode.text.includes('ExecutorService') || 
          typeNode.text.includes('ThreadPoolExecutor'))) {
        return typeNode.text;
      }
    } else if (astNode.type === 'method_invocation') {
      const method = astNode.childForFieldName('name');
      if (method?.text && (method.text.includes('start') || 
          method.text.includes('submit') || method.text.includes('execute'))) {
        const object = astNode.childForFieldName('object');
        return object?.text || method.text;
      }
    }
    return null;
  }

  /**
   * 提取通信点
   */
  private extractCommunicationPoint(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'method_invocation') {
      const method = astNode.childForFieldName('name');
      if (method?.text && (method.text.includes('wait') || 
          method.text.includes('notify') || method.text.includes('notifyAll'))) {
        const object = astNode.childForFieldName('object');
        return object?.text || method.text;
      }
    }
    return null;
  }

  /**
   * 提取竞态条件
   */
  private extractRaceCondition(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'field_declaration') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode?.text && (typeNode.text.includes('Atomic') || 
          typeNode.text.includes('volatile'))) {
        const declarator = astNode.childForFieldName('declarator');
        return declarator?.text || typeNode.text;
      }
    } else if (astNode.type === 'object_creation_expression') {
      const typeNode = astNode.childForFieldName('type');
      if (typeNode?.text && (typeNode.text.includes('ConcurrentHashMap') || 
          typeNode.text.includes('CopyOnWriteArrayList'))) {
        return typeNode.text;
      }
    }
    return null;
  }

  /**
   * 提取并发关系数组
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

    // 提取Java中的并发关系
    const text = mainNode.text || '';
    
    // 检查同步机制
    if (mainNode.type === 'synchronized_statement' || 
        text.includes('synchronized') || text.includes('ReentrantLock') || 
        text.includes('synchronized_statement')) {
      relationships.push({
        source: 'lock',
        target: 'critical-section',
        type: 'synchronizes'
      });
    }

    // 检查线程管理
    if (text.includes('Thread') || text.includes('ExecutorService') || 
        text.includes('ThreadPoolExecutor') || text.includes('ForkJoinPool')) {
      relationships.push({
        source: 'thread-manager',
        target: 'thread',
        type: 'locks'
      });
    }

    // 检查线程间通信
    if (text.includes('.wait()') || text.includes('.notify()') || 
        text.includes('.notifyAll()') || text.includes('CountDownLatch') ||
        text.includes('CyclicBarrier') || text.includes('Semaphore')) {
      relationships.push({
        source: 'thread',
        target: 'communication-point',
        type: 'communicates'
      });
    }

    // 检查竞态条件
    if (text.includes('volatile') || text.includes('Atomic') || 
        text.includes('ConcurrentHashMap') || text.includes('CopyOnWriteArrayList')) {
      relationships.push({
        source: 'shared-resource',
        target: 'access-point',
        type: 'races'
      });
    }

    return relationships;
  }
}