import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言生命周期关系提取器
 * 分析内存分配、文件操作、资源管理等生命周期操作
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const operation = this.determineLifecycleOperation(astNode);

    if (!operation) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractLifecycleNodes(astNode, operation);

    return {
      type: 'lifecycle',
      operation,
      fromNodeId,
      toNodeId,
      resourceType: this.extractResourceType(astNode),
      resourceSize: this.extractResourceSize(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取生命周期关系数组
   */
  extractLifecycleRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为生命周期相关的节点类型
    if (!this.isLifecycleNode(astNode)) {
      return relationships;
    }

    const lifecycleMetadata = this.extractLifecycleMetadata(result, astNode, null);
    if (lifecycleMetadata) {
      relationships.push(lifecycleMetadata);
    }

    return relationships;
  }

  /**
   * 确定生命周期操作类型
   */
  private determineLifecycleOperation(astNode: Parser.SyntaxNode): 'allocate' | 'deallocate' | 'open' | 'close' | 'create' | 'destroy' | 'initialize' | 'cleanup' | null {
    const text = astNode.text || '';

    // 内存操作
    if (text.includes('malloc') || text.includes('calloc') || text.includes('realloc') || text.includes('new')) {
      return 'allocate';
    } else if (text.includes('free') || text.includes('delete')) {
      return 'deallocate';
    }

    // 文件操作
    if (text.includes('fopen') || text.includes('open')) {
      return 'open';
    } else if (text.includes('fclose') || text.includes('close')) {
      return 'close';
    }

    // 资源创建和销毁
    if (text.includes('create') || text.includes('init')) {
      return 'create';
    } else if (text.includes('destroy') || text.includes('cleanup')) {
      return 'destroy';
    }

    return null;
  }

  /**
   * 提取生命周期关系的节点
   */
  private extractLifecycleNodes(astNode: Parser.SyntaxNode, operation: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    // 根据操作类型提取相关节点
    if (operation === 'allocate' || operation === 'deallocate') {
      // 对于内存操作，尝试提取指针变量
      const pointerNode = this.extractPointerNode(astNode);
      if (pointerNode) {
        toNodeId = generateDeterministicNodeId(pointerNode);
      }
    } else if (operation === 'open' || operation === 'close') {
      // 对于文件操作，尝试提取文件指针
      const fileNode = this.extractFileNode(astNode);
      if (fileNode) {
        toNodeId = generateDeterministicNodeId(fileNode);
      }
    } else if (operation === 'create' || operation === 'destroy') {
      // 对于资源操作，尝试提取资源对象
      const resourceNode = this.extractResourceNode(astNode);
      if (resourceNode) {
        toNodeId = generateDeterministicNodeId(resourceNode);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取指针节点
   */
  private extractPointerNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 对于赋值表达式，左侧通常是指针变量
    if (astNode.type === 'assignment_expression') {
      const left = astNode.childForFieldName('left');
      if (left) {
        return left;
      }
    }

    // 对于函数调用，查找赋值上下文
    if (astNode.type === 'call_expression') {
      const parent = astNode.parent;
      if (parent?.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) {
          return left;
        }
      }
    }

    return null;
  }

  /**
   * 提取文件节点
   */
  private extractFileNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 对于赋值表达式，左侧通常是文件指针变量
    if (astNode.type === 'assignment_expression') {
      const left = astNode.childForFieldName('left');
      if (left) {
        return left;
      }
    }

    // 对于函数调用，查找赋值上下文
    if (astNode.type === 'call_expression') {
      const parent = astNode.parent;
      if (parent?.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) {
          return left;
        }
      }
    }

    return null;
  }

  /**
   * 提取资源节点
   */
  private extractResourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 对于赋值表达式，左侧通常是资源变量
    if (astNode.type === 'assignment_expression') {
      const left = astNode.childForFieldName('left');
      if (left) {
        return left;
      }
    }

    // 对于函数调用，查找赋值上下文
    if (astNode.type === 'call_expression') {
      const parent = astNode.parent;
      if (parent?.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) {
          return left;
        }
      }
    }

    return null;
  }

  /**
   * 提取资源类型
   */
  private extractResourceType(astNode: Parser.SyntaxNode): 'memory' | 'file' | 'socket' | 'thread' | 'mutex' | 'semaphore' | 'unknown' {
    const text = astNode.text || '';

    if (text.includes('malloc') || text.includes('calloc') || text.includes('realloc') ||
      text.includes('free') || text.includes('new') || text.includes('delete')) {
      return 'memory';
    } else if (text.includes('fopen') || text.includes('fclose') || text.includes('FILE')) {
      return 'file';
    } else if (text.includes('socket') || text.includes('bind') || text.includes('connect')) {
      return 'socket';
    } else if (text.includes('pthread')) {
      if (text.includes('thread')) {
        return 'thread';
      } else if (text.includes('mutex')) {
        return 'mutex';
      } else if (text.includes('sem')) {
        return 'semaphore';
      }
    }

    return 'unknown';
  }

  /**
   * 提取资源大小
   */
  private extractResourceSize(astNode: Parser.SyntaxNode): number | undefined {
    const text = astNode.text || '';

    // 尝试从malloc/calloc调用中提取大小
    if (text.includes('malloc') || text.includes('calloc')) {
      const sizeMatch = text.match(/\((\d+)\s*\*\s*sizeof\s*\([^)]+\)\)/);
      if (sizeMatch) {
        return parseInt(sizeMatch[1]);
      }

      const directSizeMatch = text.match(/malloc\s*\(\s*(\d+)\s*\)/);
      if (directSizeMatch) {
        return parseInt(directSizeMatch[1]);
      }
    }

    return undefined;
  }

  /**
   * 判断是否为生命周期关系节点
   */
  private isLifecycleNode(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查是否包含生命周期相关的关键词
    const lifecycleKeywords = [
      'malloc', 'calloc', 'realloc', 'free', 'new', 'delete',
      'fopen', 'fclose', 'open', 'close',
      'create', 'destroy', 'init', 'cleanup',
      'socket', 'bind', 'connect', 'listen', 'accept'
    ];

    return lifecycleKeywords.some(keyword => text.includes(keyword));
  }
}