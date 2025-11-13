import Parser from 'tree-sitter';
import { BaseRelationshipExtractor } from './BaseRelationshipExtractor';
import { StructuralRelationship, IRelationshipExtractor } from './HtmlRelationshipTypes';

/**
 * 结构关系提取器
 * 提取HTML元素之间的结构关系：父子关系、兄弟关系、祖先关系
 */
export class StructuralRelationshipExtractor extends BaseRelationshipExtractor implements IRelationshipExtractor {
  /**
   * 提取所有结构关系
   * @param ast AST根节点
   * @returns 结构关系数组
   */
  extractRelationships(ast: Parser.SyntaxNode): StructuralRelationship[] {
    const relationships: StructuralRelationship[] = [];
    
    // 提取父子关系
    this.extractParentChildRelationships(ast, relationships);
    
    // 提取兄弟关系
    this.extractSiblingRelationships(ast, relationships);
    
    // 提取祖先关系（深层嵌套关系）
    this.extractAncestorRelationships(ast, relationships);
    
    this.logger.debug(`提取了 ${relationships.length} 个结构关系`);
    return relationships;
  }

  /**
   * 提取父子关系
   * @param node 当前节点
   * @param relationships 关系数组
   * @param depth 当前深度
   */
  private extractParentChildRelationships(
    node: Parser.SyntaxNode,
    relationships: StructuralRelationship[],
    depth: number = 0
  ): void {
    // 限制递归深度
    if (depth > 50) {
      return;
    }

    // 只处理元素节点
    if (this.isElementNode(node) && node.children) {
      const parentId = this.generateElementId(node);
      const parentTag = this.getTagName(node) || 'unknown';

      for (const child of node.children) {
        if (this.isElementNode(child)) {
          const childId = this.generateElementId(child);
          const childTag = this.getTagName(child) || 'unknown';

          // 创建父子关系
          relationships.push({
            type: 'parent-child',
            source: parentId,
            target: childId,
            sourceTag: parentTag,
            targetTag: childTag,
            depth: depth + 1,
            metadata: {
              parentType: node.type,
              childType: child.type,
              parentPosition: {
                row: node.startPosition.row,
                column: node.startPosition.column
              },
              childPosition: {
                row: child.startPosition.row,
                column: child.startPosition.column
              },
              depth: depth + 1
            }
          });

          // 递归处理子元素
          this.extractParentChildRelationships(child, relationships, depth + 1);
        }
      }
    }

    // 处理非元素节点的子节点
    if (node.children) {
      for (const child of node.children) {
        this.extractParentChildRelationships(child, relationships, depth);
      }
    }
  }

  /**
   * 提取兄弟关系
   * @param node 当前节点
   * @param relationships 关系数组
   */
  private extractSiblingRelationships(
    node: Parser.SyntaxNode,
    relationships: StructuralRelationship[]
  ): void {
    // 遍历所有节点，寻找兄弟关系
    this.traverseAST(node, (currentNode) => {
      if (currentNode.parent && currentNode.parent.children) {
        const siblings = currentNode.parent.children.filter(child => 
          this.isElementNode(child) && child !== currentNode
        );

        const currentId = this.generateElementId(currentNode);
        const currentTag = this.getTagName(currentNode) || 'unknown';

        for (const sibling of siblings) {
          const siblingId = this.generateElementId(sibling);
          const siblingTag = this.getTagName(sibling) || 'unknown';

          // 避免重复添加关系（只添加前驱兄弟关系）
          if (this.isPrecedingSibling(sibling, currentNode)) {
            relationships.push({
              type: 'sibling',
              source: siblingId,
              target: currentId,
              sourceTag: siblingTag,
              targetTag: currentTag,
              metadata: {
                siblingType: 'preceding',
                parentType: currentNode.parent.type,
                sourcePosition: {
                  row: sibling.startPosition.row,
                  column: sibling.startPosition.column
                },
                targetPosition: {
                  row: currentNode.startPosition.row,
                  column: currentNode.startPosition.column
                }
              }
            });
          }
        }
      }
    });
  }

  /**
   * 提取祖先关系（深层嵌套关系）
   * @param node 当前节点
   * @param relationships 关系数组
   */
  private extractAncestorRelationships(
    node: Parser.SyntaxNode,
    relationships: StructuralRelationship[]
  ): void {
    // 遍历所有元素节点
    this.traverseAST(node, (currentNode) => {
      if (this.isElementNode(currentNode)) {
        const currentId = this.generateElementId(currentNode);
        const currentTag = this.getTagName(currentNode) || 'unknown';

        // 查找所有祖先节点
        let ancestor = currentNode.parent;
        let ancestorLevel = 1;

        while (ancestor && ancestorLevel <= 5) { // 限制祖先关系深度
          if (this.isElementNode(ancestor)) {
            const ancestorId = this.generateElementId(ancestor);
            const ancestorTag = this.getTagName(ancestor) || 'unknown';

            // 只添加深度大于2的祖先关系（避免与父子关系重复）
            if (ancestorLevel > 2) {
              relationships.push({
                type: 'ancestor',
                source: ancestorId,
                target: currentId,
                sourceTag: ancestorTag,
                targetTag: currentTag,
                depth: ancestorLevel,
                metadata: {
                  ancestorLevel,
                  ancestorType: ancestor.type,
                  descendantType: currentNode.type,
                  sourcePosition: {
                    row: ancestor.startPosition.row,
                    column: ancestor.startPosition.column
                  },
                  targetPosition: {
                    row: currentNode.startPosition.row,
                    column: currentNode.startPosition.column
                  }
                }
              });
            }
          }

          ancestor = ancestor.parent;
          ancestorLevel++;
        }
      }
    });
  }

  /**
   * 判断节点是否为元素节点
   * @param node AST节点
   * @returns 是否为元素节点
   */
  private isElementNode(node: Parser.SyntaxNode): boolean {
    const elementTypes = [
      'element',
      'script_element',
      'style_element',
      'start_tag',
      'end_tag',
      'self_closing_tag'
    ];
    
    return elementTypes.includes(node.type);
  }

  /**
   * 判断一个节点是否是另一个节点的前驱兄弟
   * @param sibling 兄弟节点
   * @param node 当前节点
   * @returns 是否为前驱兄弟
   */
  private isPrecedingSibling(sibling: Parser.SyntaxNode, node: Parser.SyntaxNode): boolean {
    if (!sibling.parent || !node.parent || sibling.parent !== node.parent) {
      return false;
    }

    const siblings = sibling.parent.children || [];
    const siblingIndex = siblings.indexOf(sibling);
    const nodeIndex = siblings.indexOf(node);

    return siblingIndex < nodeIndex;
  }

  /**
   * 获取结构关系统计信息
   * @param relationships 关系数组
   * @returns 统计信息
   */
  public getRelationshipStats(relationships: StructuralRelationship[]): {
    parentChild: number;
    sibling: number;
    ancestor: number;
    total: number;
    averageDepth: number;
  } {
    const stats = {
      parentChild: 0,
      sibling: 0,
      ancestor: 0,
      total: relationships.length,
      averageDepth: 0
    };

    let totalDepth = 0;
    let depthCount = 0;

    for (const rel of relationships) {
      switch (rel.type) {
        case 'parent-child':
          stats.parentChild++;
          if (rel.depth !== undefined) {
            totalDepth += rel.depth;
            depthCount++;
          }
          break;
        case 'sibling':
          stats.sibling++;
          break;
        case 'ancestor':
          stats.ancestor++;
          if (rel.depth !== undefined) {
            totalDepth += rel.depth;
            depthCount++;
          }
          break;
      }
    }

    stats.averageDepth = depthCount > 0 ? totalDepth / depthCount : 0;

    return stats;
  }
}