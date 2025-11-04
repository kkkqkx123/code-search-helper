import {
  SymbolResolver,
  Symbol,
  SymbolType,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  ConcurrencyRelationship
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class ConcurrencyExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    const relationships: ConcurrencyRelationship[] = [];

    // 提取异步/等待同步机制
    const asyncFunctionDefs = this.treeSitterService.findNodesByTypes(ast,
      ['async_function_definition'] // Python async function is defined as async_function_definition
    );
    for (const asyncFunc of asyncFunctionDefs) {
      const asyncConcurrency = this.extractAsyncConcurrency(
        asyncFunc, filePath, symbolResolver
      );
      relationships.push(...asyncConcurrency);
    }

    // 提取锁机制
    const withStatements = this.treeSitterService.findNodesByTypes(ast,
      ['with_statement']
    );
    for (const withStmt of withStatements) {
      const lockRelations = this.extractLockConcurrency(
        withStmt, filePath, symbolResolver
      );
      relationships.push(...lockRelations);
    }

    return relationships;
  }

  // 并发关系提取辅助方法
  protected extractAsyncConcurrency(
    asyncFunc: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship[] {
    const relationships: ConcurrencyRelationship[] = [];

    // 提取异步函数的并发特性
    const funcName = this.extractFunctionName(asyncFunc);
    if (funcName) {
      const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, asyncFunc);

      relationships.push({
        sourceId: this.generateNodeId(`${funcName}_async`, 'function', filePath),
        targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(funcName, 'function', filePath),
        concurrencyType: 'awaits',
        synchronizationMechanism: 'async/await',
        location: {
          filePath,
          lineNumber: asyncFunc.startPosition.row + 1,
          columnNumber: asyncFunc.startPosition.column + 1
        },
        resolvedSymbol: resolvedSymbol || undefined
      });
    }

    return relationships;
  }

  protected extractLockConcurrency(
    withStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship[] {
    const relationships: ConcurrencyRelationship[] = [];

    // 检查with语句是否包含锁机制
    const withItem = withStmt.child(1); // with item is usually the second child
    if (withItem && withItem.type === 'with_item') {
      const contextExpr = withItem.firstChild;
      if (contextExpr) {
        // Check if the context expression is a lock
        if (contextExpr.text.includes('lock') || contextExpr.text.includes('Lock') || 
            contextExpr.text.includes('mutex') || contextExpr.text.includes('semaphore')) {
          
          const lockName = contextExpr.text;
          const resolvedSymbol = symbolResolver.resolveSymbol(lockName, filePath, withItem);

          // Find the surrounding function
          const containingFunction = this.findContainingFunction(withStmt);
          if (containingFunction) {
            const funcName = this.extractFunctionName(containingFunction);
            if (funcName) {
              const resolvedTargetSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

              relationships.push({
                sourceId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(lockName, 'lock', filePath),
                targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(funcName, 'function', filePath),
                concurrencyType: 'synchronizes',
                synchronizationMechanism: 'context_manager',
                location: {
                  filePath,
                  lineNumber: withStmt.startPosition.row + 1,
                  columnNumber: withStmt.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }
      }
    }

    return relationships;
  }
}