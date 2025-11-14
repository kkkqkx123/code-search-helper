/**
 * 属性格式化工具类
 * 用于处理节点和边的属性格式化逻辑
 */

import { FORMATTING_CONSTANTS } from '../constants/GraphSearchConstants';
import { CodeGraphNode, CodeGraphRelationship } from '../core/types';

export class PropertyFormatter {
  /**
   * 格式化节点数据
   */
  static formatNodes(nodes: any[]): CodeGraphNode[] {
    return nodes.map(node => this.formatNode(node));
  }

  /**
   * 格式化单个节点
   */
  static formatNode(node: any): CodeGraphNode {
    const { DEFAULT_VALUES, PROPERTY_MAPPINGS } = FORMATTING_CONSTANTS;
    
    // 处理不同格式的节点数据
    let id, type, name, properties;

    if (node.vertex) {
      // NebulaGraph vertex 格式
      id = this.extractValue(node.vertex, PROPERTY_MAPPINGS.NODE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(node.vertex, PROPERTY_MAPPINGS.NODE.type) || DEFAULT_VALUES.TYPE;
      name = this.extractValue(node.vertex, PROPERTY_MAPPINGS.NODE.name) || type || id;
      properties = this.extractValue(node.vertex, PROPERTY_MAPPINGS.NODE.properties) || {};
    } else if (node[0]) {
      // 查询结果的行格式
      id = this.extractValue(node[0], PROPERTY_MAPPINGS.NODE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(node[0], PROPERTY_MAPPINGS.NODE.type) || DEFAULT_VALUES.TYPE;
      name = this.extractValue(node[0], PROPERTY_MAPPINGS.NODE.name) || type || id;
      properties = this.extractValue(node[0], PROPERTY_MAPPINGS.NODE.properties) || {};
    } else {
      // 标准格式
      id = this.extractValue(node, PROPERTY_MAPPINGS.NODE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(node, PROPERTY_MAPPINGS.NODE.type) || DEFAULT_VALUES.TYPE;
      name = this.extractValue(node, PROPERTY_MAPPINGS.NODE.name) || type || id;
      properties = this.extractValue(node, PROPERTY_MAPPINGS.NODE.properties) || {};
    }

    return {
      id,
      type,
      name,
      properties
    };
  }

  /**
   * 格式化关系数据
   */
  static formatRelationships(relationships: any[]): CodeGraphRelationship[] {
    return relationships.map(rel => this.formatRelationship(rel));
  }

  /**
   * 格式化单个关系
   */
  static formatRelationship(rel: any): CodeGraphRelationship {
    const { DEFAULT_VALUES, PROPERTY_MAPPINGS } = FORMATTING_CONSTANTS;
    
    let id, type, sourceId, targetId, properties;

    if (rel.edge) {
      // NebulaGraph edge 格式
      id = this.extractValue(rel.edge, PROPERTY_MAPPINGS.EDGE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(rel.edge, PROPERTY_MAPPINGS.EDGE.type) || DEFAULT_VALUES.TYPE;
      sourceId = this.extractValue(rel.edge, PROPERTY_MAPPINGS.EDGE.sourceId) || DEFAULT_VALUES.ID;
      targetId = this.extractValue(rel.edge, PROPERTY_MAPPINGS.EDGE.targetId) || DEFAULT_VALUES.ID;
      properties = this.extractValue(rel.edge, PROPERTY_MAPPINGS.EDGE.properties) || {};
    } else if (rel[0]) {
      // 查询结果的行格式
      id = this.extractValue(rel[0], PROPERTY_MAPPINGS.EDGE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(rel[0], PROPERTY_MAPPINGS.EDGE.type) || DEFAULT_VALUES.TYPE;
      sourceId = this.extractValue(rel[0], PROPERTY_MAPPINGS.EDGE.sourceId) || DEFAULT_VALUES.ID;
      targetId = this.extractValue(rel[0], PROPERTY_MAPPINGS.EDGE.targetId) || DEFAULT_VALUES.ID;
      properties = this.extractValue(rel[0], PROPERTY_MAPPINGS.EDGE.properties) || {};
    } else {
      // 标准格式
      id = this.extractValue(rel, PROPERTY_MAPPINGS.EDGE.id) || DEFAULT_VALUES.ID;
      type = this.extractValue(rel, PROPERTY_MAPPINGS.EDGE.type) || DEFAULT_VALUES.TYPE;
      sourceId = this.extractValue(rel, PROPERTY_MAPPINGS.EDGE.sourceId) || DEFAULT_VALUES.ID;
      targetId = this.extractValue(rel, PROPERTY_MAPPINGS.EDGE.targetId) || DEFAULT_VALUES.ID;
      properties = this.extractValue(rel, PROPERTY_MAPPINGS.EDGE.properties) || {};
    }

    return {
      id,
      type,
      sourceId,
      targetId,
      properties
    };
  }

  /**
   * 从对象中提取值，支持多级路径和多个可能的键名
   */
  private static extractValue(obj: any, possibleKeys: readonly string[]): any {
    if (!obj) return undefined;
    
    for (const key of possibleKeys) {
      const value = this.getNestedValue(obj, key);
      if (value !== undefined) {
        return value;
      }
    }
    
    return undefined;
  }

  /**
   * 获取嵌套对象的值，支持点号分隔的路径
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 格式化属性值为字符串，用于SQL查询
   */
  static formatPropertyValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "\\'")}'`;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    } else {
      return `'${JSON.stringify(value)}'`;
    }
  }

  /**
   * 构建属性字符串，用于INSERT查询
   */
  static buildPropertyString(properties: Record<string, any>): { names: string; values: string } {
    const propKeys = Object.keys(properties);
    const propNames = propKeys.join(', ');
    const propValues = propKeys
      .map(key => this.formatPropertyValue(properties[key]))
      .join(', ');
    
    return {
      names: propNames,
      values: propValues
    };
  }

  /**
   * 生成唯一ID
   */
  static generateUniqueId(prefix: string = 'node'): string {
    return `${prefix}_${Date.now()}_${Math.random()}`;
  }
}