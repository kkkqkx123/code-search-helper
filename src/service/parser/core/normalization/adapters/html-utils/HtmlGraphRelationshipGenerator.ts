import { CodeGraphNode, CodeGraphRelationship } from '../../../../../graph/core/types';
import { HtmlRelationship } from './HtmlRelationshipTypes';
import { Logger } from '../../../../../../utils/logger';

/**
 * HTML图关系生成器
 * 负责将HTML关系转换为图关系，支持图索引
 */
export class HtmlGraphRelationshipGenerator {
  private logger: Logger;
  private relationshipCache: Map<string, CodeGraphRelationship> = new Map();

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * 生成图关系
   * @param relationships HTML关系数组
   * @param nodes 图节点数组
   * @returns 图关系数组
   */
  generateRelationships(
    relationships: HtmlRelationship[],
    nodes: CodeGraphNode[]
  ): CodeGraphRelationship[] {
    const graphRelationships: CodeGraphRelationship[] = [];
    
    // 创建节点ID到节点的映射，提高查找性能
    const nodeMap = new Map<string, CodeGraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
    
    for (const rel of relationships) {
      try {
        const graphRel = this.convertToGraphRelationship(rel, nodeMap);
        if (graphRel) {
          graphRelationships.push(graphRel);
          // 缓存关系以提高查找性能
          this.relationshipCache.set(graphRel.id, graphRel);
        }
      } catch (error) {
        this.logger.warn(`Failed to convert HTML relationship to graph relationship: ${error}`);
      }
    }
    
    this.logger.debug(`Generated ${graphRelationships.length} graph relationships from ${relationships.length} HTML relationships`);
    
    return graphRelationships;
  }

  /**
   * 将HTML关系转换为图关系
   * @param htmlRel HTML关系
   * @param nodeMap 节点映射
   * @returns 图关系或null
   */
  private convertToGraphRelationship(
    htmlRel: HtmlRelationship,
    nodeMap: Map<string, CodeGraphNode>
  ): CodeGraphRelationship | null {
    // 查找源节点和目标节点
    const sourceNode = this.findNodeById(nodeMap, htmlRel.source);
    const targetNode = this.findNodeById(nodeMap, htmlRel.target);
    
    if (!sourceNode) {
      this.logger.warn(`Source node not found for relationship: ${htmlRel.source}`);
      return null;
    }
    
    if (!targetNode) {
      this.logger.warn(`Target node not found for relationship: ${htmlRel.target}`);
      return null;
    }
    
    // 映射关系类型
    const graphRelType = this.mapRelationshipType(htmlRel.type);
    
    return {
      id: this.generateRelationshipId(htmlRel),
      type: graphRelType,
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      properties: {
        // 保留原始关系信息
        originalType: htmlRel.type,
        htmlRelationshipType: htmlRel.type,
        // 传递关系元数据
        metadata: htmlRel.metadata,
        // 添加节点类型信息
        sourceType: sourceNode.type,
        targetType: targetNode.type,
        // 添加关系强度（可选）
        strength: this.calculateRelationshipStrength(htmlRel),
        // 添加关系置信度（可选）
        confidence: this.calculateRelationshipConfidence(htmlRel)
      }
    };
  }

  /**
   * 根据ID查找节点
   * @param nodeMap 节点映射
   * @param nodeId 节点ID
   * @returns 节点或undefined
   */
  private findNodeById(
    nodeMap: Map<string, CodeGraphNode>,
    nodeId: string
  ): CodeGraphNode | undefined {
    // 直接查找
    if (nodeMap.has(nodeId)) {
      return nodeMap.get(nodeId);
    }
    
    // 对于外部资源，尝试匹配外部节点ID格式
    const externalNodeId = `external:${nodeId}`;
    if (nodeMap.has(externalNodeId)) {
      return nodeMap.get(externalNodeId);
    }
    
    // 模糊匹配：查找包含nodeId的节点
    for (const [id, node] of nodeMap.entries()) {
      if (id.includes(nodeId) || nodeId.includes(id)) {
        return node;
      }
    }
    
    return undefined;
  }

  /**
   * 映射HTML关系类型到图关系类型
   * @param htmlRelType HTML关系类型
   * @returns 图关系类型
   */
  private mapRelationshipType(htmlRelType: string): string {
    const typeMapping: Record<string, string> = {
      // 结构关系
      'parent-child': 'CONTAINS',
      'sibling': 'SIBLING',
      'ancestor': 'ANCESTOR',
      
      // 依赖关系
      'resource-dependency': 'DEPENDS_ON',
      'script-dependency': 'IMPORTS',
      'style-dependency': 'IMPORTS',
      
      // 引用关系
      'id-reference': 'REFERENCES',
      'class-reference': 'REFERENCES',
      'name-reference': 'REFERENCES',
      
      // 语义关系
      'form-relationship': 'FORM_RELATES',
      'table-relationship': 'TABLE_RELATES',
      'navigation-relationship': 'NAV_RELATES'
    };
    
    return typeMapping[htmlRelType] || 'RELATED_TO';
  }

  /**
   * 生成关系ID
   * @param htmlRel HTML关系
   * @returns 关系ID
   */
  private generateRelationshipId(htmlRel: HtmlRelationship): string {
    // 使用源、目标和类型生成唯一ID
    const baseId = `${htmlRel.source}-${htmlRel.target}-${htmlRel.type}`;
    
    // 如果有元数据，包含部分元数据以确保唯一性
    if (htmlRel.metadata) {
      const metadataStr = JSON.stringify(htmlRel.metadata).substring(0, 50);
      return `${baseId}-${this.hashString(metadataStr)}`;
    }
    
    return baseId;
  }

  /**
   * 计算关系强度
   * @param htmlRel HTML关系
   * @returns 关系强度（0-1）
   */
  private calculateRelationshipStrength(htmlRel: HtmlRelationship): number {
    // 基于关系类型设置默认强度
    const typeStrength: Record<string, number> = {
      'parent-child': 0.9,        // 强关系
      'resource-dependency': 0.8, // 强依赖
      'id-reference': 0.7,        // 强引用
      'class-reference': 0.6,     // 中等引用
      'sibling': 0.5,             // 中等关系
      'form-relationship': 0.7,   // 强语义关系
      'table-relationship': 0.7,  // 强语义关系
      'navigation-relationship': 0.6 // 中等语义关系
    };
    
    const baseStrength = typeStrength[htmlRel.type] || 0.5;
    
    // 根据元数据调整强度
    if (htmlRel.metadata) {
      // 如果有明确的属性引用，增加强度
      if (htmlRel.metadata.attribute) {
        return Math.min(1.0, baseStrength + 0.1);
      }
      
      // 如果有位置信息，根据距离调整强度
      if (htmlRel.metadata.distance !== undefined) {
        const distance = htmlRel.metadata.distance;
        // 距离越近，关系越强
        const distanceFactor = Math.max(0.1, 1.0 - (distance / 100));
        return baseStrength * distanceFactor;
      }
    }
    
    return baseStrength;
  }

  /**
   * 计算关系置信度
   * @param htmlRel HTML关系
   * @returns 置信度（0-1）
   */
  private calculateRelationshipConfidence(htmlRel: HtmlRelationship): number {
    // 基于关系类型设置默认置信度
    const typeConfidence: Record<string, number> = {
      'parent-child': 1.0,        // 确定的结构关系
      'resource-dependency': 0.9, // 高置信度依赖
      'id-reference': 0.9,        // 高置信度引用
      'script-dependency': 0.8,   // 高置信度脚本依赖
      'style-dependency': 0.8,    // 高置信度样式依赖
      'class-reference': 0.7,     // 中等置信度类引用
      'name-reference': 0.6,      // 中等置信度名称引用
      'sibling': 0.8,             // 高置信度兄弟关系
      'form-relationship': 0.7,   // 中等置信度表单关系
      'table-relationship': 0.7,  // 中等置信度表格关系
      'navigation-relationship': 0.6 // 中等置信度导航关系
    };
    
    const baseConfidence = typeConfidence[htmlRel.type] || 0.5;
    
    // 根据元数据调整置信度
    if (htmlRel.metadata) {
      // 如果有明确的验证信息，增加置信度
      if (htmlRel.metadata.verified) {
        return Math.min(1.0, baseConfidence + 0.2);
      }
      
      // 如果有多个证据支持，增加置信度
      if (htmlRel.metadata.evidenceCount && htmlRel.metadata.evidenceCount > 1) {
        const evidenceBonus = Math.min(0.2, htmlRel.metadata.evidenceCount * 0.05);
        return Math.min(1.0, baseConfidence + evidenceBonus);
      }
    }
    
    return baseConfidence;
  }

  /**
   * 简单字符串哈希函数
   * @param str 字符串
   * @returns 哈希值
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 根据类型过滤关系
   * @param relationships 关系数组
   * @param types 要保留的关系类型
   * @returns 过滤后的关系数组
   */
  filterRelationshipsByType(
    relationships: CodeGraphRelationship[],
    types: string[]
  ): CodeGraphRelationship[] {
    return relationships.filter(rel => types.includes(rel.type));
  }

  /**
   * 根据强度过滤关系
   * @param relationships 关系数组
   * @param minStrength 最小强度
   * @returns 过滤后的关系数组
   */
  filterRelationshipsByStrength(
    relationships: CodeGraphRelationship[],
    minStrength: number
  ): CodeGraphRelationship[] {
    return relationships.filter(rel => 
      (rel.properties.strength as number) >= minStrength
    );
  }

  /**
   * 根据置信度过滤关系
   * @param relationships 关系数组
   * @param minConfidence 最小置信度
   * @returns 过滤后的关系数组
   */
  filterRelationshipsByConfidence(
    relationships: CodeGraphRelationship[],
    minConfidence: number
  ): CodeGraphRelationship[] {
    return relationships.filter(rel => 
      (rel.properties.confidence as number) >= minConfidence
    );
  }

  /**
   * 获取关系统计信息
   * @param relationships 关系数组
   * @returns 统计信息
   */
  getRelationshipStats(relationships: CodeGraphRelationship[]): {
    total: number;
    byType: Record<string, number>;
    averageStrength: number;
    averageConfidence: number;
  } {
    const stats = {
      total: relationships.length,
      byType: {} as Record<string, number>,
      averageStrength: 0,
      averageConfidence: 0
    };

    let totalStrength = 0;
    let totalConfidence = 0;

    for (const rel of relationships) {
      // 统计类型
      stats.byType[rel.type] = (stats.byType[rel.type] || 0) + 1;
      
      // 累加强度和置信度
      totalStrength += rel.properties.strength as number || 0;
      totalConfidence += rel.properties.confidence as number || 0;
    }

    // 计算平均值
    if (relationships.length > 0) {
      stats.averageStrength = totalStrength / relationships.length;
      stats.averageConfidence = totalConfidence / relationships.length;
    }

    return stats;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.relationshipCache.clear();
    this.logger.debug('Cleared HTML graph relationship cache');
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number } {
    return {
      size: this.relationshipCache.size
    };
  }
}