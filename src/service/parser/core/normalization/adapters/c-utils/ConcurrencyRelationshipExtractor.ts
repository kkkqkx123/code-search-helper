import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言并发关系提取器
 * 分析线程、互斥锁、信号量等并发操作
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const operation = this.determineConcurrencyOperation(astNode);

    if (!operation) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractConcurrencyNodes(astNode, operation);

    return {
      type: 'concurrency',
      operation,
      fromNodeId,
      toNodeId,
      resourceType: this.extractResourceType(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取并发关系数组
   */
  extractConcurrencyRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为并发相关的节点类型
    if (!this.isConcurrencyNode(astNode)) {
      return relationships;
    }

    const concurrencyMetadata = this.extractConcurrencyMetadata(result, astNode, null);
    if (concurrencyMetadata) {
      relationships.push(concurrencyMetadata);
    }

    return relationships;
  }

  /**
   * 确定并发操作类型
   */
  private determineConcurrencyOperation(astNode: Parser.SyntaxNode): 'create_thread' | 'join_thread' | 'lock' | 'unlock' | 'wait' | 'signal' | 'create_semaphore' | 'destroy_semaphore' | null {
    const text = astNode.text || '';

    // 线程操作
    if (text.includes('pthread_create')) {
      return 'create_thread';
    } else if (text.includes('pthread_join')) {
      return 'join_thread';
    }

    // 互斥锁操作
    if (text.includes('pthread_mutex_lock')) {
      return 'lock';
    } else if (text.includes('pthread_mutex_unlock')) {
      return 'unlock';
    }

    // 条件变量操作
    if (text.includes('pthread_cond_wait')) {
      return 'wait';
    } else if (text.includes('pthread_cond_signal') || text.includes('pthread_cond_broadcast')) {
      return 'signal';
    }

    // 信号量操作
    if (text.includes('sem_init') || text.includes('sem_open')) {
      return 'create_semaphore';
    } else if (text.includes('sem_destroy') || text.includes('sem_close')) {
      return 'destroy_semaphore';
    }

    return null;
  }

  /**
   * 提取并发关系的节点
   */
  private extractConcurrencyNodes(astNode: Parser.SyntaxNode, operation: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    // 根据操作类型提取相关节点
    if (operation === 'create_thread' || operation === 'join_thread') {
      // 对于线程操作，尝试提取线程ID
      const threadIdNode = this.extractThreadIdNode(astNode);
      if (threadIdNode) {
        toNodeId = generateDeterministicNodeId(threadIdNode);
      }
    } else if (operation === 'lock' || operation === 'unlock') {
      // 对于互斥锁操作，尝试提取互斥锁对象
      const mutexNode = this.extractMutexNode(astNode);
      if (mutexNode) {
        toNodeId = generateDeterministicNodeId(mutexNode);
      }
    } else if (operation === 'wait' || operation === 'signal') {
      // 对于条件变量操作，尝试提取条件变量
      const condNode = this.extractConditionVariableNode(astNode);
      if (condNode) {
        toNodeId = generateDeterministicNodeId(condNode);
      }
    } else if (operation.includes('semaphore')) {
      // 对于信号量操作，尝试提取信号量
      const semNode = this.extractSemaphoreNode(astNode);
      if (semNode) {
        toNodeId = generateDeterministicNodeId(semNode);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取线程ID节点
   */
  private extractThreadIdNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找pthread_create的第一个参数（线程ID）
    if (astNode.type === 'call_expression') {
      const args = astNode.childForFieldName('arguments');
      if (args && args.children.length > 0) {
        return args.children[0];
      }
    }
    return null;
  }

  /**
   * 提取互斥锁节点
   */
  private extractMutexNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找pthread_mutex_lock/unlock的第一个参数（互斥锁对象）
    if (astNode.type === 'call_expression') {
      const args = astNode.childForFieldName('arguments');
      if (args && args.children.length > 0) {
        return args.children[0];
      }
    }
    return null;
  }

  /**
   * 提取条件变量节点
   */
  private extractConditionVariableNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找pthread_cond_wait/signal的第一个参数（条件变量）
    if (astNode.type === 'call_expression') {
      const args = astNode.childForFieldName('arguments');
      if (args && args.children.length > 0) {
        return args.children[0];
      }
    }
    return null;
  }

  /**
   * 提取信号量节点
   */
  private extractSemaphoreNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找sem_init/open/destroy/close的第二个参数（信号量对象）
    if (astNode.type === 'call_expression') {
      const args = astNode.childForFieldName('arguments');
      if (args && args.children.length > 1) {
        return args.children[1];
      }
    }
    return null;
  }

  /**
   * 提取资源类型
   */
  private extractResourceType(astNode: Parser.SyntaxNode): 'thread' | 'mutex' | 'condition_variable' | 'semaphore' | 'unknown' {
    const text = astNode.text || '';

    if (text.includes('pthread')) {
      if (text.includes('thread')) {
        return 'thread';
      } else if (text.includes('mutex')) {
        return 'mutex';
      } else if (text.includes('cond')) {
        return 'condition_variable';
      }
    } else if (text.includes('sem')) {
      return 'semaphore';
    }

    return 'unknown';
  }

  /**
   * 判断是否为并发关系节点
   */
  private isConcurrencyNode(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查是否包含并发相关的关键词
    const concurrencyKeywords = [
      'pthread_create', 'pthread_join', 'pthread_mutex_lock', 'pthread_mutex_unlock',
      'pthread_cond_wait', 'pthread_cond_signal', 'pthread_cond_broadcast',
      'sem_init', 'sem_open', 'sem_destroy', 'sem_close', 'sem_wait', 'sem_post'
    ];

    return concurrencyKeywords.some(keyword => text.includes(keyword));
  }
}