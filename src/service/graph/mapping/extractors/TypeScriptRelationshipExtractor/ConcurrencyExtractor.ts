import {
  ConcurrencyRelationship,
  SymbolResolver,
  BaseJavaScriptRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser
} from '../types';

/**
 * TypeScript并发关系提取器
 * 提取如同步、锁、通信、竞争、等待等并发关系
 */
@injectable()
export class ConcurrencyExtractor extends BaseJavaScriptRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }
  
  /**
   * 提取并发关系
   */
  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    const relationships: ConcurrencyRelationship[] = [];
    
    // 遍历AST查找并发关系
    this.traverseAST(ast, (node) => {
      // 检查同步关系
      if (this.isSynchronization(node)) {
        const relationship = this.extractSynchronizationRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查锁关系
      if (this.isLocking(node)) {
        const relationship = this.extractLockingRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查通信关系
      if (this.isCommunication(node)) {
        const relationship = this.extractCommunicationRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查竞争关系
      if (this.isRaceCondition(node)) {
        const relationship = this.extractRaceConditionRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查等待关系
      if (this.isAwaiting(node)) {
        const relationship = this.extractAwaitingRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    });
    
    return relationships;
  }
  
  /**
   * 遍历AST节点
   */
  private traverseAST(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseAST(child, callback);
    }
  }
  
  /**
   * 检查是否为同步关系
   */
  private isSynchronization(node: Parser.SyntaxNode): boolean {
    // 检查同步方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'sync' || 
             methodName === 'synchronize' || 
             methodName === 'join' || 
             methodName === 'wait' ||
             methodName === 'notify' ||
             methodName === 'notifyAll';
    }
    
    // 检查同步关键字
    if (node.type === 'expression_statement') {
      return node.text.includes('synchronized') || 
             node.text.includes('SyncLock') ||
             node.text.includes('lock');
    }
    
    return false;
  }
  
  /**
   * 提取同步关系
   */
  private extractSynchronizationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship | null {
    const methodName = this.extractCalleeName(node);
    if (!methodName) return null;
    
    // 查找同步者
    const synchronizerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!synchronizerSymbol) return null;
    
    // 查找被同步的对象
    const targetName = this.extractTargetObject(node);
    if (!targetName) return null;
    
    const targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
    if (!targetSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(synchronizerSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      concurrencyType: 'synchronizes',
      synchronizationMechanism: this.determineSynchronizationMechanism(node, methodName),
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSymbol: targetSymbol
    };
  }
  
  /**
   * 检查是否为锁关系
   */
  private isLocking(node: Parser.SyntaxNode): boolean {
    // 检查锁方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'lock' || 
             methodName === 'unlock' || 
             methodName === 'acquire' || 
             methodName === 'release' ||
             methodName === 'tryLock' ||
             methodName === 'enter' ||
             methodName === 'exit';
    }
    
    // 检查锁语句
    if (node.type === 'expression_statement') {
      return node.text.includes('lock(') || 
             node.text.includes('mutex.lock') ||
             node.text.includes('semaphore.acquire');
    }
    
    return false;
  }
  
  /**
   * 提取锁关系
   */
  private extractLockingRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship | null {
    const methodName = this.extractCalleeName(node);
    if (!methodName) return null;
    
    // 查找锁的持有者
    const lockerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!lockerSymbol) return null;
    
    // 查找被锁的对象
    const targetName = this.extractTargetObject(node);
    if (!targetName) return null;
    
    const targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
    if (!targetSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(lockerSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      concurrencyType: 'locks',
      synchronizationMechanism: this.determineLockMechanism(node, methodName),
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSymbol: targetSymbol
    };
  }
  
  /**
   * 检查是否为通信关系
   */
  private isCommunication(node: Parser.SyntaxNode): boolean {
    // 检查通信方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'send' || 
             methodName === 'receive' || 
             methodName === 'post' || 
             methodName === 'emit' ||
             methodName === 'broadcast' ||
             methodName === 'publish' ||
             methodName === 'subscribe';
    }
    
    // 检查通信语句
    if (node.type === 'expression_statement') {
      return node.text.includes('channel.send') || 
             node.text.includes('queue.put') ||
             node.text.includes('message.emit');
    }
    
    return false;
  }
  
  /**
   * 提取通信关系
   */
  private extractCommunicationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship | null {
    const methodName = this.extractCalleeName(node);
    if (!methodName) return null;
    
    // 查找通信者
    const communicatorSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!communicatorSymbol) return null;
    
    // 查找通信目标
    const targetName = this.extractTargetObject(node);
    if (!targetName) return null;
    
    const targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
    if (!targetSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(communicatorSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      concurrencyType: 'communicates',
      synchronizationMechanism: this.determineCommunicationMechanism(node, methodName),
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSymbol: targetSymbol
    };
  }
  
  /**
   * 检查是否为竞争条件
   */
  private isRaceCondition(node: Parser.SyntaxNode): boolean {
    // 竞争条件通常难以静态检测，这里检查一些常见的模式
    if (node.type === 'assignment_expression') {
      // 检查对共享变量的赋值
      return this.isSharedVariableAccess(node);
    }
    
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'compareAndSet' || 
             methodName === 'atomicUpdate' ||
             methodName === 'increment' ||
             methodName === 'decrement';
    }
    
    return false;
  }
  
  /**
   * 提取竞争条件关系
   */
  private extractRaceConditionRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship | null {
    // 查找竞争者
    const racerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!racerSymbol) return null;
    
    // 查找竞争的资源
    const resourceName = this.extractResourceName(node);
    if (!resourceName) return null;
    
    const resourceSymbol = symbolResolver.resolveSymbol(resourceName, filePath, node);
    if (!resourceSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(racerSymbol),
      targetId: this.generateSymbolId(resourceSymbol),
      concurrencyType: 'races',
      synchronizationMechanism: 'none',
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSymbol: resourceSymbol
    };
  }
  
  /**
   * 检查是否为等待关系
   */
  private isAwaiting(node: Parser.SyntaxNode): boolean {
    // 检查await表达式
    if (node.type === 'await_expression') {
      return true;
    }
    
    // 检查Promise相关方法
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'then' || 
             methodName === 'await' || 
             methodName === 'waitFor' ||
             methodName === 'sleep';
    }
    
    return false;
  }
  
  /**
   * 提取等待关系
   */
  private extractAwaitingRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship | null {
    // 查找等待者
    const waiterSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!waiterSymbol) return null;
    
    // 查找等待的目标
    let targetName: string | null = null;
    
    if (node.type === 'await_expression') {
      targetName = this.extractAwaitTarget(node);
    } else {
      targetName = this.extractTargetObject(node);
    }
    
    if (!targetName) return null;
    
    const targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
    if (!targetSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(waiterSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      concurrencyType: 'awaits',
      synchronizationMechanism: this.determineAwaitMechanism(node),
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSymbol: targetSymbol
    };
  }
  
  // 辅助方法
  protected generateSymbolId(symbol: any): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }
  
  protected extractCalleeName(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_expression') {
        return this.extractMethodNameFromMemberExpression(funcNode);
      }
    }
    return null;
  }
  
  protected extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }
  
  protected findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): any {
    let currentNode: Parser.SyntaxNode | null = callExpr.parent;
    while (currentNode) {
      if (currentNode.type === 'function_declaration' ||
          currentNode.type === 'method_definition' ||
          currentNode.type === 'arrow_function' ||
          currentNode.type === 'function') {
        for (const child of currentNode.children) {
          if (child.type === 'identifier' || child.type === 'property_identifier') {
            const funcName = child.text;
            if (funcName) {
              return symbolResolver.resolveSymbol(funcName, filePath, child);
            }
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null;
  }
  
  private extractTargetObject(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'member_expression') {
        return funcNode.children[0]?.text || null;
      }
    }
    return null;
  }
  
  private determineSynchronizationMechanism(node: Parser.SyntaxNode, methodName: string): string {
    if (methodName === 'wait' || methodName === 'notify' || methodName === 'notifyAll') {
      return 'monitor';
    } else if (methodName === 'join') {
      return 'thread_join';
    } else if (node.text.includes('synchronized')) {
      return 'intrinsic_lock';
    } else if (node.text.includes('SyncLock')) {
      return 'dotnet_lock';
    } else if (node.text.includes('lock')) {
      return 'lock_statement';
    }
    return 'unknown';
  }
  
  private determineLockMechanism(node: Parser.SyntaxNode, methodName: string): string {
    if (methodName === 'acquire' || methodName === 'release') {
      return 'semaphore';
    } else if (methodName === 'enter' || methodName === 'exit') {
      return 'monitor';
    } else if (node.text.includes('mutex')) {
      return 'mutex';
    } else if (node.text.includes('lock')) {
      return 'lock';
    }
    return 'unknown';
  }
  
  private determineCommunicationMechanism(node: Parser.SyntaxNode, methodName: string): string {
    if (methodName === 'send' || methodName === 'receive') {
      return 'channel';
    } else if (methodName === 'post') {
      return 'message_queue';
    } else if (methodName === 'emit') {
      return 'event_emitter';
    } else if (methodName === 'publish' || methodName === 'subscribe') {
      return 'pub_sub';
    } else if (node.text.includes('channel')) {
      return 'channel';
    } else if (node.text.includes('queue')) {
      return 'queue';
    }
    return 'unknown';
  }
  
  private isSharedVariableAccess(node: Parser.SyntaxNode): boolean {
    // 简化实现，检查是否访问可能的共享变量
    const variableName = this.extractVariableName(node);
    if (!variableName) return false;
    
    // 检查变量名是否暗示共享状态
    return variableName.includes('shared') || 
           variableName.includes('global') || 
           variableName.includes('static') ||
           variableName.includes('volatile');
  }
  
  private extractVariableName(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const leftNode = node.children[0];
      if (leftNode.type === 'identifier') {
        return leftNode.text;
      } else if (leftNode.type === 'member_expression') {
        return this.extractMemberExpressionName(leftNode);
      }
    }
    return null;
  }
  
  protected extractMemberExpressionName(memberExpr: Parser.SyntaxNode): string | null {
    const parts: string[] = [];
    this.collectMemberExpressionParts(memberExpr, parts);
    return parts.join('.');
  }
  
  protected collectMemberExpressionParts(memberExpr: Parser.SyntaxNode, parts: string[]): void {
    for (const child of memberExpr.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
        parts.unshift(child.text);
      } else if (child.type === 'member_expression') {
        this.collectMemberExpressionParts(child, parts);
      }
    }
  }
  
  private extractResourceName(node: Parser.SyntaxNode): string | null {
    if (node.type === 'assignment_expression') {
      return this.extractVariableName(node);
    } else if (node.type === 'call_expression') {
      return this.extractTargetObject(node);
    }
    return null;
  }
  
  private extractAwaitTarget(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const targetNode = node.children[0];
      if (targetNode.type === 'identifier') {
        return targetNode.text;
      } else if (targetNode.type === 'call_expression') {
        return this.extractCalleeName(targetNode);
      }
    }
    return null;
  }
  
  private determineAwaitMechanism(node: Parser.SyntaxNode): string {
    if (node.type === 'await_expression') {
      return 'async_await';
    } else if (node.text.includes('then')) {
      return 'promise';
    } else if (node.text.includes('waitFor')) {
      return 'condition_wait';
    } else if (node.text.includes('sleep')) {
      return 'timer';
    }
    return 'unknown';
  }
}