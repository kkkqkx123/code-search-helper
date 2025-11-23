import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';

/**
 * C语言并发关系提取器
 * 用于提取线程、互斥锁、条件变量等并发相关的语义关系
 */
export class ConcurrencyRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode || astNode.type !== 'call_expression') {
      return null;
    }

    const functionNode = astNode.childForFieldName('function');
    if (!functionNode) {
      return null;
    }

    const functionName = CHelperMethods.extractCalleeName(astNode);
    if (!functionName) {
      return null;
    }
    
    const concurrencyType = this.determineConcurrencyType(functionName);
    const operationType = this.determineOperationType(functionName);
    const resourceInfo = this.extractResourceInfo(astNode);

    return {
      type: 'concurrency',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: resourceInfo.resourceId || 'unknown',
      concurrencyType,
      operationType,
      functionName,
      resourceInfo,
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
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isConcurrencyNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractConcurrencyMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定并发类型
   */
  private determineConcurrencyType(functionName: string): string {
    const threadPatterns = ['pthread_create', 'pthread_join', 'pthread_detach', 'pthread_exit', 'pthread_self'];
    const mutexPatterns = ['pthread_mutex_lock', 'pthread_mutex_trylock', 'pthread_mutex_unlock', 'pthread_mutex_destroy', 'pthread_mutex_init'];
    const conditionPatterns = ['pthread_cond_wait', 'pthread_cond_timedwait', 'pthread_cond_signal', 'pthread_cond_broadcast', 'pthread_cond_destroy', 'pthread_cond_init'];
    const rwlockPatterns = ['pthread_rwlock_rdlock', 'pthread_rwlock_wrlock', 'pthread_rwlock_unlock', 'pthread_rwlock_destroy', 'pthread_rwlock_init'];
    const semaphorePatterns = ['sem_wait', 'sem_trywait', 'sem_post', 'sem_destroy', 'sem_init', 'sem_open'];
    const barrierPatterns = ['atomic_thread_fence', '__atomic_thread_fence', '__sync_synchronize'];

    if (threadPatterns.some(pattern => functionName.includes(pattern))) {
      return 'thread';
    } else if (mutexPatterns.some(pattern => functionName.includes(pattern))) {
      return 'mutex';
    } else if (conditionPatterns.some(pattern => functionName.includes(pattern))) {
      return 'condition';
    } else if (rwlockPatterns.some(pattern => functionName.includes(pattern))) {
      return 'rwlock';
    } else if (semaphorePatterns.some(pattern => functionName.includes(pattern))) {
      return 'semaphore';
    } else if (barrierPatterns.some(pattern => functionName.includes(pattern))) {
      return 'barrier';
    }

    return 'unknown';
  }

  /**
   * 确定操作类型
   */
  private determineOperationType(functionName: string): string {
    const createPatterns = ['pthread_create', 'pthread_mutex_init', 'pthread_cond_init', 'pthread_rwlock_init', 'sem_init', 'sem_open'];
    const destroyPatterns = ['pthread_mutex_destroy', 'pthread_cond_destroy', 'pthread_rwlock_destroy', 'sem_destroy'];
    const lockPatterns = ['pthread_mutex_lock', 'pthread_mutex_trylock', 'pthread_rwlock_rdlock', 'pthread_rwlock_wrlock', 'sem_wait', 'sem_trywait'];
    const unlockPatterns = ['pthread_mutex_unlock', 'pthread_rwlock_unlock', 'sem_post'];
    const waitPatterns = ['pthread_join', 'pthread_cond_wait', 'pthread_cond_timedwait'];
    const signalPatterns = ['pthread_cond_signal', 'pthread_cond_broadcast'];
    const exitPatterns = ['pthread_exit', 'pthread_detach'];

    if (createPatterns.some(pattern => functionName.includes(pattern))) {
      return 'create';
    } else if (destroyPatterns.some(pattern => functionName.includes(pattern))) {
      return 'destroy';
    } else if (lockPatterns.some(pattern => functionName.includes(pattern))) {
      return 'lock';
    } else if (unlockPatterns.some(pattern => functionName.includes(pattern))) {
      return 'unlock';
    } else if (waitPatterns.some(pattern => functionName.includes(pattern))) {
      return 'wait';
    } else if (signalPatterns.some(pattern => functionName.includes(pattern))) {
      return 'signal';
    } else if (exitPatterns.some(pattern => functionName.includes(pattern))) {
      return 'exit';
    }

    return 'unknown';
  }

  /**
   * 提取资源信息
   */
  private extractResourceInfo(astNode: Parser.SyntaxNode): any {
    const argumentsNode = astNode.childForFieldName('arguments');
    if (!argumentsNode) {
      return { resourceId: 'unknown', resourceType: 'unknown' };
    }

    const resourceInfo: any = {
      resourceId: 'unknown',
      resourceType: 'unknown',
      attributes: []
    };

    // 提取第一个参数作为资源ID（通常是句柄）
    const firstArg = argumentsNode.childForFieldName('0');
    if (firstArg) {
      // 处理指针表达式
      if (firstArg.type === 'pointer_expression') {
        const pointerArg = firstArg.childForFieldName('argument');
        if (pointerArg) {
          resourceInfo.resourceId = pointerArg.text;
        }
      } else {
        resourceInfo.resourceId = firstArg.text;
      }
    }

    // 提取其他参数作为属性
    for (let i = 1; i < argumentsNode.childCount; i++) {
      const arg = argumentsNode.childForFieldName(i.toString());
      if (arg) {
        resourceInfo.attributes.push({
          index: i,
          value: arg.text,
          type: arg.type
        });
      }
    }

    return resourceInfo;
  }

  /**
   * 判断是否为并发相关节点
   */
  private isConcurrencyNode(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type !== 'call_expression') {
      return false;
    }

    const functionNode = astNode.childForFieldName('function');
    if (!functionNode) {
      return false;
    }

    const functionName = functionNode.text;
    const concurrencyPatterns = [
      'pthread_', 'sem_', 'atomic_', '__atomic_', '__sync_'
    ];

    return concurrencyPatterns.some(pattern => functionName.includes(pattern));
  }

  /**
   * 提取线程本地变量信息
   */
  extractThreadLocalMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode || astNode.type !== 'declaration') {
      return null;
    }

    // 检查是否有thread_local存储类说明符
    const storageClassNode = astNode.childForFieldName('storage_class_specifier');
    if (!storageClassNode || !['__thread', '_Thread_local'].includes(storageClassNode.text)) {
      return null;
    }

    const variableName = CHelperMethods.extractName(result);
    const typeNode = astNode.childForFieldName('type');

    return {
      type: 'thread-local',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: 'thread_context',
      variableName: variableName || 'unknown',
      variableType: typeNode?.text || 'unknown',
      storageClass: storageClassNode.text,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取线程本地变量关系
   */
  extractThreadLocalRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => node.type === 'declaration',
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractThreadLocalMetadata(result, astNode, symbolTable)
    );
  }
}