import { CodeChunk } from '../../types';

/**
 * 代码块处理基类
 * 提供统一的代码块合并和处理公共方法
 */
export abstract class BaseChunkProcessor {
  /**
   * 合并两个代码块
   */
  static mergeTwoChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    // 确定合并后的范围
    const startLine = Math.min(chunk1.metadata.startLine, chunk2.metadata.startLine);
    const endLine = Math.max(chunk1.metadata.endLine, chunk2.metadata.endLine);

    // 智能合并内容（处理重叠）
    const mergedContent = this.mergeContents(
      chunk1.content,
      chunk2.content,
      chunk1.metadata.startLine,
      chunk2.metadata.startLine
    );

    // 合并元数据
    const mergedMetadata = {
      ...chunk1.metadata,
      startLine,
      endLine,
      type: this.mergeTypes(chunk1.metadata.type, chunk2.metadata.type),
      nodeIds: this.mergeNodeIds(chunk1.metadata.nodeIds, chunk2.metadata.nodeIds),
      complexity: Math.max(chunk1.metadata.complexity || 0, chunk2.metadata.complexity || 0)
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }

  /**
   * 智能合并内容（处理重叠）
   */
  static mergeContents(content1: string, content2: string, startLine1: number, startLine2: number): string {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // 如果chunk2在chunk1之后，直接拼接
    if (startLine2 > startLine1 + lines1.length) {
      return content1 + '\n' + content2;
    }

    // 如果有重叠，智能处理重叠部分
    const overlapStart = Math.max(0, startLine1 + lines1.length - startLine2);
    const overlapEnd = Math.min(lines2.length, startLine1 + lines1.length - startLine2);

    if (overlapStart < overlapEnd) {
      // 有重叠部分，使用chunk1的内容（优先级更高）
      const nonOverlapLines2 = lines2.slice(overlapEnd);
      return lines1.join('\n') + '\n' + nonOverlapLines2.join('\n');
    } else {
      // 没有重叠，直接拼接
      return content1 + '\n' + content2;
    }
  }

  /**
   * 检查两个块是否可以合并
   */
  static canMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk, threshold: number = 0.7): boolean {
    // 检查是否相邻或重叠
    const isAdjacentOrOverlapping =
      (chunk1.metadata.endLine >= chunk2.metadata.startLine - 1) &&
      (chunk2.metadata.endLine >= chunk1.metadata.startLine - 1);

    if (!isAdjacentOrOverlapping) return false;

    // 检查内容相似度（这里需要调用相似度计算方法，将在子类中实现）
    return true; // 基础实现，子类可以重写
  }

  /**
   * 检查是否为重复块
   */
  static isDuplicateChunk(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    if (chunk1.content === chunk2.content) {
      return true;
    }

    if (chunk1.metadata.nodeIds && chunk2.metadata.nodeIds) {
      const commonNodes = chunk1.metadata.nodeIds.filter((id: any) =>
        chunk2.metadata.nodeIds!.includes(id)
      );

      const maxNodes = Math.max(chunk1.metadata.nodeIds.length, chunk2.metadata.nodeIds.length);
      if (commonNodes.length / maxNodes > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * 合并类型
   */
  private static mergeTypes(type1?: string, type2?: string): 'function' | 'code' | 'method' | 'semantic' | 'class' | 'interface' | 'import' | 'generic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | undefined {
    if (type1 === type2) return type1 as any || 'merged';
    if (!type1) return (type2 as any) || 'merged';
    if (!type2) return (type1 as any) || 'merged';

    // 如果两个类型都存在但不同，则返回'merged'
    return 'merged';
  }

  /**
   * 合并节点ID
   */
  private static mergeNodeIds(nodeIds1?: string[], nodeIds2?: string[]): string[] {
    const merged = new Set<string>();

    if (nodeIds1) {
      nodeIds1.forEach(id => merged.add(id));
    }

    if (nodeIds2) {
      nodeIds2.forEach(id => merged.add(id));
    }

    return Array.from(merged);
  }

  /**
   * 检查是否应该创建重叠块
   */
  static shouldCreateOverlap(
    newChunk: CodeChunk,
    existingChunks: CodeChunk[],
    similarityThreshold: number = 0.8
  ): boolean {
    for (const existingChunk of existingChunks) {
      // 基础实现，子类可以添加相似度检查
      if (newChunk.content === existingChunk.content) {
        return false;
      }
    }
    return true;
  }
}