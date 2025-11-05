import {
  ConcurrencyRelationship,
  SymbolResolver,
  Parser,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class ConcurrencyExtractor extends BaseCRelationshipExtractor {
  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    const relationships: ConcurrencyRelationship[] = [];

    try {
      // 使用C语言的并发关系查询
      const concurrencyQuery = require('../../parser/constants/queries/c/concurrency-relationships').default;
      const queryResults = this.treeSitterService.queryTree(ast, concurrencyQuery);

      for (const result of queryResults) {
        const captures = result.captures;

        // 处理线程创建关系
        const threadCreateFuncs = captures.filter((capture: any) =>
          capture.name.includes('thread') && capture.name.includes('create')
        );
        const threadHandles = captures.filter((capture: any) =>
          capture.name.includes('handle') && capture.name.includes('thread')
        );

        for (const threadCreateFunc of threadCreateFuncs) {
          for (const threadHandle of threadHandles) {
            const funcName = threadCreateFunc.node.text;
            const handleName = threadHandle.node.text;

            if (funcName && handleName) {
              const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, threadCreateFunc.node);

              relationships.push({
                sourceId: generateDeterministicNodeId(threadCreateFunc.node),
                targetId: generateDeterministicNodeId(handleName, 'thread', filePath),
                concurrencyType: 'synchronizes',
                synchronizationMechanism: 'thread_creation',
                location: {
                  filePath,
                  lineNumber: threadCreateFunc.node.startPosition.row + 1,
                  columnNumber: threadCreateFunc.node.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }

        // 处理互斥锁关系
        const mutexFuncs = captures.filter((capture: any) =>
          capture.name.includes('mutex')
        );
        const mutexHandles = captures.filter((capture: any) =>
          capture.name.includes('handle') && (capture.name.includes('mutex') || capture.name.includes('lock'))
        );

        for (const mutexFunc of mutexFuncs) {
          for (const mutexHandle of mutexHandles) {
            const funcName = mutexFunc.node.text;
            const handleName = mutexHandle.node.text;

            if (funcName && handleName) {
              const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, mutexFunc.node);

              relationships.push({
                sourceId: generateDeterministicNodeId(mutexFunc.node),
                targetId: generateDeterministicNodeId(handleName, 'mutex', filePath),
                concurrencyType: 'synchronizes',
                synchronizationMechanism: 'mutex',
                location: {
                  filePath,
                  lineNumber: mutexFunc.node.startPosition.row + 1,
                  columnNumber: mutexFunc.node.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }

        // 处理原子操作关系
        const atomicFuncs = captures.filter((capture: any) =>
          capture.name.includes('atomic')
        );
        const atomicVars = captures.filter((capture: any) =>
          capture.name.includes('variable') || capture.name.includes('value')
        );

        for (const atomicFunc of atomicFuncs) {
          for (const atomicVar of atomicVars) {
            const funcName = atomicFunc.node.text;
            const varName = atomicVar.node.text;

            if (funcName && varName) {
              const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, atomicFunc.node);

              relationships.push({
                sourceId: generateDeterministicNodeId(atomicFunc.node),
                targetId: generateDeterministicNodeId(varName, 'variable', filePath),
                concurrencyType: 'synchronizes',
                synchronizationMechanism: 'atomic_operation',
                location: {
                  filePath,
                  lineNumber: atomicFunc.node.startPosition.row + 1,
                  columnNumber: atomicFunc.node.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('C语言并发关系提取失败:', error);
    }

    return relationships;
  }
}