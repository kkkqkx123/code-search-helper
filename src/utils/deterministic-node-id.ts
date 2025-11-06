import * as Parser from 'tree-sitter';

/**
 * 为任意AST节点生成唯一且可预测的确定性ID。
 * ID生成策略为 `node.type:node.startPosition.row:node.startPosition.column`。
 * 这确保了对于同一个文件中的同一个节点，无论何时计算，结果都完全一样。
 * 
 * @param node Tree-sitter AST节点
 * @returns 确定性的节点ID字符串
 */
export function generateDeterministicNodeId(node: Parser.SyntaxNode): string {
  if (!node) {
    throw new Error('Cannot generate ID for a null or undefined node.');
  }
  
  const { type, startPosition } = node;
  
  // startPosition is an object with { row, column }
  // row and column are 0-indexed, we use them directly.
  const id = `${type}:${startPosition.row}:${startPosition.column}`;
  
  return id;
}