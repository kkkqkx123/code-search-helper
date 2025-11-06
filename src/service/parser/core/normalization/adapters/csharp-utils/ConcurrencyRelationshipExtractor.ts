import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 并发关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const concurrencyType = this.determineConcurrencyType(astNode);
    const relatedNodes = this.extractRelatedNodes(astNode);
    const synchronizationObject = this.extractSynchronizationObject(astNode);

    return {
      type: 'concurrency',
      concurrencyType,
      fromNodeId: relatedNodes.from ? generateDeterministicNodeId(relatedNodes.from) : 'unknown',
      toNodeId: relatedNodes.to ? generateDeterministicNodeId(relatedNodes.to) : 'unknown',
      synchronizationObject,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
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

    const nodeType = mainNode.type;
    
    // 检查async/await模式
    if (nodeType.includes('await_expression')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('awaited.expression')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'async_context',
            type: 'communicates'
          });
        }
      }
    }
    // 检查lock语句
    else if (nodeType.includes('lock_statement')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('lock.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'lock',
            type: 'synchronizes'
          });
        }
      }
    }
    // 检查Monitor方法
    else if (nodeType.includes('invocation') && 
             (mainNode.text.includes('Monitor.Enter') || 
              mainNode.text.includes('Monitor.Exit') ||
              mainNode.text.includes('Wait') ||
              mainNode.text.includes('Pulse'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('sync.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'monitor',
            type: 'synchronizes'
          });
        }
      }
    }
    // 检查Task相关操作
    else if (nodeType.includes('invocation') && 
             (mainNode.text.includes('Task.Run') || 
              mainNode.text.includes('Start') ||
              mainNode.text.includes('Wait'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('task.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'task',
            type: 'communicates'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 确定并发类型
   */
  private determineConcurrencyType(node: Parser.SyntaxNode): 'async_await' | 'lock_statement' | 'monitor_sync' | 'task_parallel' | 'thread_sync' | 'volatile_access' | 'interlocked' {
    const text = node.text;
    
    if (node.type === 'await_expression' || text.includes('async')) {
      return 'async_await';
    } else if (node.type === 'lock_statement') {
      return 'lock_statement';
    } else if (text.includes('Monitor')) {
      return 'monitor_sync';
    } else if (text.includes('Task') || text.includes('Parallel')) {
      return 'task_parallel';
    } else if (text.includes('Thread')) {
      return 'thread_sync';
    } else if (text.includes('volatile')) {
      return 'volatile_access';
    } else if (text.includes('Interlocked')) {
      return 'interlocked';
    }
    
    return 'async_await';
  }

  /**
   * 提取相关节点
   */
  private extractRelatedNodes(node: Parser.SyntaxNode): { from?: Parser.SyntaxNode; to?: Parser.SyntaxNode } {
    switch (node.type) {
      case 'await_expression':
        return {
          from: node.childForFieldName('expression') || undefined,
          to: node.parent?.childForFieldName('name') || undefined
        };
      case 'lock_statement':
        return {
          from: node.childForFieldName('expression') || undefined,
          to: node.childForFieldName('body') || undefined
        };
      case 'invocation_expression':
        const functionNode = node.childForFieldName('function');
        if (functionNode?.text.includes('Monitor') || functionNode?.text.includes('Task')) {
          return {
            from: node.childForFieldName('arguments') || undefined,
            to: functionNode || undefined
          };
        }
        break;
    }

    return {};
  }

  /**
   * 提取同步对象
   */
  private extractSynchronizationObject(node: Parser.SyntaxNode): string | null {
    switch (node.type) {
      case 'lock_statement':
        const lockExpr = node.childForFieldName('expression');
        return lockExpr?.text || null;
      case 'invocation_expression':
        const functionNode = node.childForFieldName('function');
        if (functionNode?.text.includes('Monitor')) {
          const args = node.childForFieldName('arguments');
          return args?.children[0]?.text || null;
        }
        break;
    }
    
    return null;
  }

  /**
   * 分析异步方法链
   */
  analyzeAsyncMethodChain(node: Parser.SyntaxNode): Array<{
    method: string;
    awaitable: string;
    continuation: string;
  }> {
    const chain: Array<{
      method: string;
      awaitable: string;
      continuation: string;
    }> = [];

    if (!CSharpHelperMethods.isAsyncMethod(node)) {
      return chain;
    }

    const methodName = CSharpHelperMethods.extractMethodName(node);
    if (!methodName) {
      return chain;
    }

    // 查找方法体中的await表达式
    const block = node.childForFieldName('body');
    if (!block) {
      return chain;
    }

    for (const child of block.children) {
      if (child.type === 'await_expression') {
        const awaitable = child.childForFieldName('expression')?.text || 'unknown';
        const continuation = this.findContinuationAfterAwait(child);
        
        chain.push({
          method: methodName,
          awaitable,
          continuation
        });
      }
    }

    return chain;
  }

  /**
   * 查找await后的继续执行代码
   */
  private findContinuationAfterAwait(awaitNode: Parser.SyntaxNode): string {
    // 简化实现：返回await后的下一个语句
    const parent = awaitNode.parent;
    if (!parent) {
      return 'unknown';
    }

    const awaitIndex = parent.children.indexOf(awaitNode);
    if (awaitIndex < parent.children.length - 1) {
      return parent.children[awaitIndex + 1].text || 'unknown';
    }

    return 'end_of_method';
  }

  /**
   * 分析锁竞争关系
   */
  analyzeLockContention(node: Parser.SyntaxNode): Array<{
    lockObject: string;
    criticalSection: string;
    potentialContention: string[];
  }> {
    const contentions: Array<{
      lockObject: string;
      criticalSection: string;
      potentialContention: string[];
    }> = [];

    if (node.type !== 'lock_statement') {
      return contentions;
    }

    const lockObject = node.childForFieldName('expression')?.text;
    const criticalSection = node.childForFieldName('body')?.text;
    
    if (!lockObject || !criticalSection) {
      return contentions;
    }

    // 分析临界区中可能导致竞争的操作
    const potentialContention = this.analyzeCriticalSectionForContention(node.childForFieldName('body'));

    contentions.push({
      lockObject,
      criticalSection,
      potentialContention
    });

    return contentions;
  }

  /**
   * 分析临界区中的竞争操作
   */
  private analyzeCriticalSectionForContention(body: Parser.SyntaxNode | null): string[] {
    const contentions: string[] = [];
    
    if (!body) {
      return contentions;
    }

    for (const child of body.children) {
      if (child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          // 检查是否为可能引起竞争的操作
          if (this.isContentionProneOperation(functionNode.text)) {
            contentions.push(functionNode.text);
          }
        }
      } else if (child.type === 'assignment_expression') {
        const left = child.childForFieldName('left');
        if (left?.text) {
          contentions.push(`assignment_to_${left.text}`);
        }
      }
    }

    return contentions;
  }

  /**
   * 判断是否为容易引起竞争的操作
   */
  private isContentionProneOperation(operation: string): boolean {
    const contentionProneOps = [
      'Write', 'Read', 'Enqueue', 'Dequeue', 'Push', 'Pop',
      'Add', 'Remove', 'Contains', 'Clear', 'CopyTo'
    ];
    
    return contentionProneOps.some(op => operation.includes(op));
  }

  /**
   * 分析任务并行模式
   */
  analyzeTaskParallelism(node: Parser.SyntaxNode): Array<{
    taskCreation: string;
    taskType: string;
    synchronization: string;
  }> {
    const parallelisms: Array<{
      taskCreation: string;
      taskType: string;
      synchronization: string;
    }> = [];

    // 查找Task创建和并行操作
    for (const child of node.children) {
      if (child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          const taskType = this.determineTaskType(functionNode.text);
          if (taskType) {
            const synchronization = this.findTaskSynchronization(child);
            
            parallelisms.push({
              taskCreation: child.text,
              taskType,
              synchronization
            });
          }
        }
      }
    }

    return parallelisms;
  }

  /**
   * 确定任务类型
   */
  private determineTaskType(functionText: string): string {
    if (functionText.includes('Task.Run')) return 'Task.Run';
    if (functionText.includes('Task.Factory')) return 'Task.Factory';
    if (functionText.includes('Parallel.For')) return 'Parallel.For';
    if (functionText.includes('Parallel.ForEach')) return 'Parallel.ForEach';
    if (functionText.includes('Parallel.Invoke')) return 'Parallel.Invoke';
    if (functionText.includes('Task.WhenAll')) return 'Task.WhenAll';
    if (functionText.includes('Task.WhenAny')) return 'Task.WhenAny';
    
    return 'unknown';
  }

  /**
   * 查找任务同步方式
   */
  private findTaskSynchronization(taskNode: Parser.SyntaxNode): string {
    // 查找任务创建后的同步操作
    const parent = taskNode.parent;
    if (!parent) {
      return 'none';
    }

    // 检查是否有Wait()或await
    for (const child of parent.children) {
      if (child.type === 'invocation_expression' && child.text.includes('Wait')) {
        return 'Wait()';
      }
      if (child.type === 'await_expression') {
        return 'await';
      }
    }

    return 'none';
  }
}