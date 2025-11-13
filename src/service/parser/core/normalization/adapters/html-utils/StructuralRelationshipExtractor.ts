import Parser from 'tree-sitter';
import { HtmlHelperMethods } from './HtmlHelperMethods';
import { StructuralRelationship, IRelationshipExtractor } from './HtmlRelationshipTypes';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * 结构关系提取器
 * 提取HTML元素之间的结构关系：父子关系、兄弟关系、祖先关系
 */
export class StructuralRelationshipExtractor implements IRelationshipExtractor {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

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
    if (HtmlHelperMethods.isElementNode(node) && node.children) {
      const parentId = HtmlHelperMethods.generateElementId(node);
      const parentTag = HtmlHelperMethods.getTagName(node) || 'unknown';

      for (const child of node.children) {
        if (HtmlHelperMethods.isElementNode(child)) {
          const childId = HtmlHelperMethods.generateElementId(child);
          const childTag = HtmlHelperMethods.getTagName(child) || 'unknown';

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
              depth: depth + 1,
              parentAttributes: HtmlHelperMethods.getAllAttributes(node),
              childAttributes: HtmlHelperMethods.getAllAttributes(child)
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
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (currentNode.parent && currentNode.parent.children) {
        const siblings = currentNode.parent.children.filter(child => 
          HtmlHelperMethods.isElementNode(child) && child !== currentNode
        );

        const currentId = HtmlHelperMethods.generateElementId(currentNode);
        const currentTag = HtmlHelperMethods.getTagName(currentNode) || 'unknown';

        for (const sibling of siblings) {
          const siblingId = HtmlHelperMethods.generateElementId(sibling);
          const siblingTag = HtmlHelperMethods.getTagName(sibling) || 'unknown';

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
                },
                siblingDistance: this.calculateSiblingDistance(sibling, currentNode),
                sourceAttributes: HtmlHelperMethods.getAllAttributes(sibling),
                targetAttributes: HtmlHelperMethods.getAllAttributes(currentNode)
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
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const currentId = HtmlHelperMethods.generateElementId(currentNode);
        const currentTag = HtmlHelperMethods.getTagName(currentNode) || 'unknown';

        // 查找所有祖先节点
        let ancestor = currentNode.parent;
        let ancestorLevel = 1;

        while (ancestor && ancestorLevel <= 5) { // 限制祖先关系深度
          if (HtmlHelperMethods.isElementNode(ancestor)) {
            const ancestorId = HtmlHelperMethods.generateElementId(ancestor);
            const ancestorTag = HtmlHelperMethods.getTagName(ancestor) || 'unknown';

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
                  },
                  intermediateElements: this.getIntermediateElements(ancestor, currentNode),
                  ancestorAttributes: HtmlHelperMethods.getAllAttributes(ancestor),
                  descendantAttributes: HtmlHelperMethods.getAllAttributes(currentNode)
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
   * 计算兄弟节点之间的距离
   * @param sibling1 兄弟节点1
   * @param sibling2 兄弟节点2
   * @returns 距离（节点数量）
   */
  private calculateSiblingDistance(sibling1: Parser.SyntaxNode, sibling2: Parser.SyntaxNode): number {
    if (!sibling1.parent || !sibling2.parent || sibling1.parent !== sibling2.parent) {
      return -1;
    }

    const siblings = sibling1.parent.children || [];
    const index1 = siblings.indexOf(sibling1);
    const index2 = siblings.indexOf(sibling2);

    return Math.abs(index2 - index1);
  }

  /**
   * 获取祖先和后代之间的中间元素
   * @param ancestor 祖先节点
   * @param descendant 后代节点
   * @returns 中间元素标签名数组
   */
  private getIntermediateElements(ancestor: Parser.SyntaxNode, descendant: Parser.SyntaxNode): string[] {
    const intermediates: string[] = [];
    let current = descendant.parent;

    while (current && current !== ancestor) {
      const tagName = HtmlHelperMethods.getTagName(current);
      if (tagName) {
        intermediates.unshift(tagName);
      }
      current = current.parent;
    }

    return intermediates;
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
    depthDistribution: Record<string, number>;
    tagDistribution: Record<string, number>;
  } {
    const stats = {
      parentChild: 0,
      sibling: 0,
      ancestor: 0,
      total: relationships.length,
      averageDepth: 0,
      depthDistribution: {} as Record<string, number>,
      tagDistribution: {} as Record<string, number>
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
            this.updateDepthDistribution(stats.depthDistribution, rel.depth);
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
            this.updateDepthDistribution(stats.depthDistribution, rel.depth);
          }
          break;
      }

      // 统计标签分布
      const tagPair = `${rel.sourceTag}->${rel.targetTag}`;
      stats.tagDistribution[tagPair] = (stats.tagDistribution[tagPair] || 0) + 1;
    }

    stats.averageDepth = depthCount > 0 ? totalDepth / depthCount : 0;

    return stats;
  }

  /**
   * 更新深度分布统计
   * @param distribution 深度分布对象
   * @param depth 深度
   */
  private updateDepthDistribution(distribution: Record<string, number>, depth: number): void {
    const depthKey = depth <= 2 ? 'shallow' : depth <= 5 ? 'medium' : 'deep';
    distribution[depthKey] = (distribution[depthKey] || 0) + 1;
  }
}