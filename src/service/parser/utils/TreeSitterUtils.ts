import Parser from 'tree-sitter';
import { ContentHashUtils } from '../../../utils/ContentHashUtils';

/**
 * TreeSitter 基础工具类
 * 提供语言无关的基础 AST 操作功能
 *
 * 注意：此类只包含纯工具方法，不包含任何回退或查询逻辑。
 * 回退逻辑已移至 FallbackExtractor 类。
 */
export class TreeSitterUtils {
  /**
   * 从节点提取文本内容
   * @param node 语法节点
   * @param sourceCode 源代码
   * @returns 节点文本
   */
  static getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * 获取节点位置信息
   * @param node 语法节点
   * @returns 位置信息（行和列，从1开始）
   */
  static getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * 生成代码片段ID
   * @param content 内容
   * @param startLine 起始行号
   * @returns 片段ID
   */
  static generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  /**
   * 简单哈希函数
   * @param str 输入字符串
   * @returns 哈希值
   */
  static simpleHash(str: string): string {
    return ContentHashUtils.generateContentHash(str);
  }

  /**
   * 计算节点哈希值（用于缓存键）
   * @param node 语法节点
   * @returns 哈希值
   */
  static getNodeHash(node: Parser.SyntaxNode): string {
    return `${node.type}:${node.startIndex}:${node.endIndex}`;
  }

  /**
   * 检查节点是否为某种类型
   * @param node 语法节点
   * @param type 节点类型
   * @returns 是否匹配
   */
  static isNodeType(node: Parser.SyntaxNode, type: string): boolean {
    return node.type === type;
  }

  /**
   * 检查节点是否为多种类型之一
   * @param node 语法节点
   * @param types 节点类型数组
   * @returns 是否匹配任一类型
   */
  static isNodeTypes(node: Parser.SyntaxNode, types: string[]): boolean {
    return types.includes(node.type);
  }

  /**
   * 获取节点的直接子节点
   * @param node 语法节点
   * @param fieldName 字段名
   * @returns 子节点或null
   */
  static getChildNode(node: Parser.SyntaxNode, fieldName: string): Parser.SyntaxNode | null {
    return node.childForFieldName?.(fieldName) || null;
  }

  /**
   * 获取节点的所有子节点
   * @param node 语法节点
   * @returns 子节点数组
   */
  static getChildNodes(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return node.children || [];
  }

  /**
   * 检查节点是否有指定字段
   * @param node 语法节点
   * @param fieldName 字段名
   * @returns 是否有该字段
   */
  static hasField(node: Parser.SyntaxNode, fieldName: string): boolean {
    return node.childForFieldName?.(fieldName) !== null;
  }

  /**
   * 获取节点的文本内容（不依赖源代码）
   * 注意：这只能获取节点自身的文本，不包含子节点的完整文本
   * @param node 语法节点
   * @returns 节点文本
   */
  static getNodeTextOnly(node: Parser.SyntaxNode): string {
    return node.text || '';
  }

  /**
   * 计算节点的文本长度
   * @param node 语法节点
   * @returns 文本长度
   */
  static getNodeTextLength(node: Parser.SyntaxNode): number {
    return node.endIndex - node.startIndex;
  }

  /**
   * 检查节点是否为空（没有文本内容）
   * @param node 语法节点
   * @returns 是否为空
   */
  static isNodeEmpty(node: Parser.SyntaxNode): boolean {
    return this.getNodeTextLength(node) === 0;
  }

  /**
   * 获取节点的深度（从根节点开始计算）
   * @param node 语法节点
   * @returns 节点深度
   */
  static getNodeDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current: Parser.SyntaxNode | null = node.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 检查节点是否是另一个节点的后代
   * @param node 待检查节点
   * @param ancestor 祖先节点
   * @returns 是否是后代
   */
  static isDescendant(node: Parser.SyntaxNode, ancestor: Parser.SyntaxNode): boolean {
    let current: Parser.SyntaxNode | null = node.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 获取节点的路径（从根节点到当前节点的类型序列）
   * @param node 语法节点
   * @returns 类型路径数组
   */
  static getNodePath(node: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    let current: Parser.SyntaxNode | null = node;
    while (current) {
      path.unshift(current.type);
      current = current.parent;
    }
    return path;
  }

  /**
   * 格式化节点位置为字符串
   * @param node 语法节点
   * @returns 位置字符串
   */
  static formatNodeLocation(node: Parser.SyntaxNode): string {
    const location = this.getNodeLocation(node);
    return `${location.startLine}:${location.startColumn}-${location.endLine}:${location.endColumn}`;
  }

  /**
   * 比较两个节点的位置
   * @param node1 第一个节点
   * @param node2 第二个节点
   * @returns -1 如果node1在node2之前，1如果在之后，0如果位置相同
   */
  static compareNodePositions(node1: Parser.SyntaxNode, node2: Parser.SyntaxNode): number {
    if (node1.startIndex < node2.startIndex) return -1;
    if (node1.startIndex > node2.startIndex) return 1;
    return 0;
  }

  /**
   * 检查两个节点是否重叠
   * @param node1 第一个节点
   * @param node2 第二个节点
   * @returns 是否重叠
   */
  static nodesOverlap(node1: Parser.SyntaxNode, node2: Parser.SyntaxNode): boolean {
    return node1.startIndex < node2.endIndex && node2.startIndex < node1.endIndex;
  }

  /**
   * 获取包含指定位置的最小节点
   * @param ast AST根节点
   * @param position 字符位置（从0开始）
   * @returns 包含该位置的节点或null
   */
  static findNodeAtPosition(ast: Parser.SyntaxNode, position: number): Parser.SyntaxNode | null {
    if (position < ast.startIndex || position >= ast.endIndex) {
      return null;
    }

    // 检查子节点
    if (ast.children) {
      for (const child of ast.children) {
        const found = this.findNodeAtPosition(child, position);
        if (found) {
          return found;
        }
      }
    }

    // 如果没有更小的节点包含该位置，返回当前节点
    return ast;
  }

  /**
   * 遍历AST并对每个节点执行操作
   * @param ast AST根节点
   * @param callback 回调函数，接收节点和深度参数
   * @param maxDepth 最大遍历深度，默认100
   */
  static traverseAST(
    ast: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode, depth: number) => void,
    maxDepth: number = 100
  ): void {
    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > maxDepth) return;

      callback(node, depth);

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
  }

  /**
   * 收集满足条件的所有节点
   * @param ast AST根节点
   * @param predicate 判断函数
   * @param maxDepth 最大遍历深度，默认100
   * @returns 满足条件的节点数组
   */
  static collectNodes(
    ast: Parser.SyntaxNode,
    predicate: (node: Parser.SyntaxNode) => boolean,
    maxDepth: number = 100
  ): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    this.traverseAST(ast, (node, depth) => {
      if (predicate(node)) {
        nodes.push(node);
      }
    }, maxDepth);

    return nodes;
  }
}