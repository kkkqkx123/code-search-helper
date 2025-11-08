/**
 * AST节点接口定义
 */
export interface ASTNode {
  id: string;
  type: string;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  text: string;
  parent?: ASTNode;
  children?: ASTNode[];
  contentHash?: string;
  similarityGroup?: string;
}