import { ASTNode } from '..';
import { CodeChunk } from '..';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from './ContentHashIDGenerator';

export class ASTNodeExtractor {
    constructor(private treeSitterService: TreeSitterService) { }

    /**
     * 从 CodeChunk 中提取对应的 ASTNode 数组
     * @param chunk 代码块
     * @param ast 完整的 AST 树
     * @param nodeType 节点类型（用于 createASTNode）
     * @returns ASTNode 数组
     */
    extractNodesFromChunk(chunk: CodeChunk, ast: any, nodeType: string): ASTNode[] {
        if (!chunk.metadata?.nodeIds || !ast) {
            return [];
        }

        const nodes: ASTNode[] = [];

        for (const nodeId of chunk.metadata.nodeIds) {
            const node = this.findNodeById(ast, nodeId);
            if (node) {
                const content = this.treeSitterService.getNodeText(node, chunk.content);
                const astNode = this.createASTNode(node, content, nodeType);
                nodes.push(astNode);
            }
        }

        return nodes;
    }

    /**
     * 根据 nodeId 在 AST 中查找对应的节点
     * nodeId 格式: `${startIndex}-${endIndex}-${type}`
     */
    private findNodeById(ast: any, nodeId: string): any | null {
        const [startIndexStr, endIndexStr, expectedType] = nodeId.split('-');
        const startIndex = parseInt(startIndexStr, 10);
        const endIndex = parseInt(endIndexStr, 10);

        if (isNaN(startIndex) || isNaN(endIndex)) {
            return null;
        }

        const traverse = (node: any): any | null => {
            if (node.startIndex === startIndex &&
                node.endIndex === endIndex &&
                node.type === expectedType) {
                return node;
            }

            if (node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                    const found = traverse(child);
                    if (found) return found;
                }
            }

            return null;
        };

        return traverse(ast);
    }

    /**
     * 创建 ASTNode 对象
     */
    private createASTNode(node: any, content: string, type: string): ASTNode {
        const nodeId = `${node.startIndex}-${node.endIndex}-${type}`;
        return {
            id: ContentHashIDGenerator.generateNodeId({
                id: nodeId,
                type,
                startByte: node.startIndex,
                endByte: node.endIndex,
                startLine: node.startPosition?.row || 0,
                endLine: node.endPosition?.row || 0,
                text: content
            }),
            type,
            startByte: node.startIndex,
            endByte: node.endIndex,
            startLine: node.startPosition?.row || 0,
            endLine: node.endPosition?.row || 0,
            text: content,
            contentHash: ContentHashIDGenerator.getContentHashPrefix(content)
        };
    }
}