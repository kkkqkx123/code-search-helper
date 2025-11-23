import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';

/**
 * C语言继承关系提取器
 * 在C语言中，继承关系主要通过结构体嵌套和函数指针模拟
 */
export class InheritanceRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const inheritanceType = this.determineInheritanceType(astNode);

    if (!inheritanceType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractInheritanceNodes(astNode);

    return {
      type: 'inheritance',
      fromNodeId,
      toNodeId,
      inheritanceType,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取继承关系数组
   */
  extractInheritanceRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isInheritanceNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractInheritanceMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定继承类型
   */
  private determineInheritanceType(astNode: Parser.SyntaxNode): 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct' | null {
    const nodeType = astNode.type;

    if (nodeType === 'struct_specifier') {
      // 检查是否为结构体嵌套（组合）
      if (this.hasEmbeddedStruct(astNode)) {
        return 'embedded_struct';
      }
      return 'contains';
    } else if (nodeType === 'field_declaration') {
      // 检查是否为函数指针（模拟接口实现）
      if (this.isFunctionPointer(astNode)) {
        return 'implements';
      }
      return 'contains';
    } else if (nodeType === 'enum_specifier') {
      return 'enum_member';
    }

    return null;
  }

  /**
   * 提取继承关系的节点
   */
  private extractInheritanceNodes(astNode: Parser.SyntaxNode): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = 'unknown';
    let toNodeId = 'unknown';

    if (astNode.type === 'struct_specifier') {
      // 结构体名称作为fromNodeId
      const structName = astNode.childForFieldName('name');
      if (structName) {
        fromNodeId = NodeIdGenerator.forAstNode(structName);
      }

      // 查找嵌套的结构体字段
      const fields = astNode.childForFieldName('fields');
      if (fields) {
        for (const child of fields.children) {
          if (child.type === 'field_declaration') {
            const fieldType = child.childForFieldName('type');
            if (fieldType && fieldType.type === 'type_identifier') {
              toNodeId = NodeIdGenerator.forAstNode(fieldType);
              break;
            }
          }
        }
      }
    } else if (astNode.type === 'field_declaration') {
      // 字段声明作为fromNodeId
      fromNodeId = NodeIdGenerator.forAstNode(astNode);

      // 字段类型作为toNodeId
      const fieldType = astNode.childForFieldName('type');
      if (fieldType) {
        toNodeId = NodeIdGenerator.forAstNode(fieldType);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 检查是否有嵌套结构体
   */
  private hasEmbeddedStruct(astNode: Parser.SyntaxNode): boolean {
    const fields = astNode.childForFieldName('fields');
    if (!fields) {
      return false;
    }

    for (const child of fields.children) {
      if (child.type === 'field_declaration') {
        const fieldType = child.childForFieldName('type');
        if (fieldType && fieldType.type === 'type_identifier') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查是否为函数指针
   */
  private isFunctionPointer(astNode: Parser.SyntaxNode): boolean {
    const declarator = astNode.childForFieldName('declarator');
    if (!declarator) {
      return false;
    }

    // 检查声明器中是否包含指针和函数参数
    return declarator.text.includes('*') && declarator.text.includes('(');
  }

  /**
   * 判断是否为继承关系节点
   */
  private isInheritanceNode(astNode: Parser.SyntaxNode): boolean {
    const inheritanceNodeTypes = [
      'struct_specifier',
      'field_declaration',
      'enum_specifier'
    ];

    return inheritanceNodeTypes.includes(astNode.type);
  }
}