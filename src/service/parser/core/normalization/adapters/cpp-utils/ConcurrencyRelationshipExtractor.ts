import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++ 并发关系提取器
 * 从 CRelationshipExtractor/ConcurrencyExtractor.ts 迁移
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 从CRelationshipExtractor/ConcurrencyExtractor.ts迁移
    const text = astNode.text || '';
    let concurrencyType = 'unknown';
    let synchronizationMechanism = 'unknown';

    // 检测线程创建
    if (text.includes('std::thread') || text.includes('pthread_create')) {
      concurrencyType = 'synchronizes';
      synchronizationMechanism = 'thread_creation';
    }
    // 检测互斥锁
    else if (text.includes('std::mutex') || text.includes('pthread_mutex') ||
      text.includes('lock_guard') || text.includes('unique_lock')) {
      concurrencyType = 'locks';
      synchronizationMechanism = 'mutex';
    }
    // 检测原子操作
    else if (text.includes('std::atomic') || text.includes('atomic_')) {
      concurrencyType = 'synchronizes';
      synchronizationMechanism = 'atomic_operation';
    }
    // 检测条件变量
    else if (text.includes('std::condition_variable') || text.includes('pthread_cond')) {
      concurrencyType = 'synchronizes';
      synchronizationMechanism = 'condition_variable';
    }
    // 检测future/promise
    else if (text.includes('std::future') || text.includes('std::promise') ||
      text.includes('std::async') || text.includes('std::packaged_task')) {
      concurrencyType = 'communicates';
      synchronizationMechanism = 'future_promise';
    }

    return {
      type: 'concurrency',
      fromNodeId: generateDeterministicNodeId(astNode),
      toNodeId: 'unknown', // 需要更复杂的分析来确定目标
      concurrencyType,
      synchronizationMechanism,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
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

    const text = mainNode.text || '';
    // C++并发关系（如使用std::thread, std::mutex等）
    if (text.includes('std::mutex') || text.includes('lock_guard') || text.includes('unique_lock')) {
      relationships.push({
        source: 'mutex',
        target: 'critical_section',
        type: 'locks'
      });
    }

    if (text.includes('std::thread')) {
      relationships.push({
        source: 'thread_creator',
        target: 'new_thread',
        type: 'synchronizes'
      });
    }

    if (text.includes('std::promise') || text.includes('std::future') || text.includes('std::async')) {
      relationships.push({
        source: 'sync_object',
        target: 'async_operation',
        type: 'communicates'
      });
    }

    return relationships;
  }
}