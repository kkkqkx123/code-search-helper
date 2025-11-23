/**
 * 关系提取器通用工具和基类
 * 为各种关系提取器提供通用功能，减少代码重复
 */

import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * 通用关系元数据接口
 */
export interface RelationshipMetadata {
  type: string;
  fromNodeId: string;
  toNodeId: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  [key: string]: any;
}

/**
 * 符号表接口
 */
export interface SymbolTable {
  filePath: string;
  [key: string]: any;
}

/**
 * 通用关系提取器基类
 */
export abstract class BaseRelationshipExtractor {
  /**
   * 提取关系元数据的通用方法
   * @param result 查询结果
   * @param astNode AST节点
   * @param symbolTable 符号表
   * @param relationshipType 关系类型
   * @param extractSpecificMetadata 从AST节点提取特定元数据的方法
   */
  protected extractRelationshipMetadata(
    result: any,
    astNode: Parser.SyntaxNode,
    symbolTable: any,
    relationshipType: string,
    extractSpecificMetadata: (node: Parser.SyntaxNode) => any
  ): RelationshipMetadata | null {
    if (!astNode) {
      return null;
    }

    const specificMetadata = extractSpecificMetadata(astNode);
    if (!specificMetadata) {
      return null;
    }

    return {
      type: relationshipType,
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: specificMetadata.toNodeId || 'unknown',
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      },
      ...specificMetadata
    };
  }

  /**
   * 提取关系数组的通用方法
   * @param result 查询结果
   * @param isRelationshipNode 检查节点是否为关系节点的方法
   * @param extractMetadata 提取元数据的方法
   */
  protected extractRelationships(
    result: any,
    isRelationshipNode: (node: Parser.SyntaxNode) => boolean,
    extractMetadata: (result: any, astNode: Parser.SyntaxNode, symbolTable: any) => any
  ): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    if (!isRelationshipNode(astNode)) {
      return relationships;
    }

    const metadata = extractMetadata(result, astNode, null);
    if (metadata) {
      relationships.push(metadata);
    }

    return relationships;
  }

  /**
   * 从节点中提取名称
   * @param node AST节点
   * @param fieldNames 要尝试的字段名称列表
   */
  protected extractNameFromNode(node: Parser.SyntaxNode, fieldNames: string[] = ['name', 'identifier', 'type_identifier']): string | null {
    if (!node) {
      return null;
    }

    for (const fieldName of fieldNames) {
      const childNode = node.childForFieldName?.(fieldName);
      if (childNode?.text) {
        return childNode.text;
      }
    }

    // 如果字段中没有找到，尝试直接从节点获取
    if (node.text) {
      return node.text;
    }

    return null;
  }

  /**
   * 生成节点ID
   * @param node AST节点
   * @param prefix ID前缀
   */
  protected generateNodeId(node: Parser.SyntaxNode, prefix: string = ''): string {
    if (!node) {
      return 'unknown';
    }

    if (prefix) {
      return `${prefix}_${NodeIdGenerator.forAstNode(node)}`;
    }

    return NodeIdGenerator.forAstNode(node);
  }

  /**
   * 检查节点是否包含指定类型的子节点
   * @param node AST节点
   * @param childType 要检查的子节点类型
   */
  protected hasChildOfType(node: Parser.SyntaxNode, childType: string): boolean {
    if (!node || !node.children) {
      return false;
    }

    for (const child of node.children) {
      if (child.type === childType) {
        return true;
      }
    }

    return false;
  }

  /**
   * 遍历节点的所有子节点，查找指定类型
   * @param node AST节点
   * @param childType 要查找的子节点类型
   * @param callback 对找到的节点执行的回调函数
   */
  protected findChildNodesOfType(
    node: Parser.SyntaxNode,
    childType: string,
    callback: (childNode: Parser.SyntaxNode) => void
  ): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === childType) {
        callback(child);
      } else {
        // 递归查找
        this.findChildNodesOfType(child, childType, callback);
      }
    }
  }
}

/**
 * 通用关系提取器工具函数
 */
export class RelationshipExtractorUtils {
  /**
   * 从AST节点路径中查找特定类型的父节点
   * @param node 起始节点
   * @param nodeTypes 要查找的节点类型数组
   */
  static findParentOfType(node: Parser.SyntaxNode, nodeTypes: string[]): Parser.SyntaxNode | null {
    let current = node.parent;
    while (current) {
      if (nodeTypes.includes(current.type)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 从节点中提取文本内容
   * @param node AST节点
   * @param fieldNames 要尝试的字段名称列表
   */
  static extractNodeText(node: Parser.SyntaxNode, fieldNames: string[] = ['name', 'identifier', 'type_identifier']): string | null {
    if (!node) {
      return null;
    }

    for (const fieldName of fieldNames) {
      const childNode = node.childForFieldName?.(fieldName);
      if (childNode?.text) {
        return childNode.text;
      }
    }

    return node.text || null;
 }

  /**
   * 检查节点是否为指定类型之一
   * @param node AST节点
   * @param nodeTypes 节点类型数组
   */
 static isNodeType(node: Parser.SyntaxNode, nodeTypes: string[]): boolean {
    return nodeTypes.includes(node.type);
  }

  /**
   * 安全地从节点中获取子节点
   * @param node AST节点
   * @param fieldName 字段名称
   */
  static getChildNode(node: Parser.SyntaxNode, fieldName: string): Parser.SyntaxNode | null {
    try {
      return node.childForFieldName?.(fieldName) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 从节点中提取所有子节点文本
   * @param node AST节点
   * @param filterTypes 可选的节点类型过滤器
   */
  static extractAllChildTexts(node: Parser.SyntaxNode, filterTypes?: string[]): string[] {
    const texts: string[] = [];

    if (!node || !node.children) {
      return texts;
    }

    for (const child of node.children) {
      if (!filterTypes || filterTypes.includes(child.type)) {
        if (child.text) {
          texts.push(child.text);
        }
      }
    }

    return texts;
  }
}