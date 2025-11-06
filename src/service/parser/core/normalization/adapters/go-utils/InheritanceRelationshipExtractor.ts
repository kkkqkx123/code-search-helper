import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 继承关系提取器
 * 在Go中，继承关系主要通过接口实现和结构体嵌入来实现
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const inheritanceType = this.determineInheritanceType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'inheritance',
      fromNodeId: sourceNode ? generateDeterministicNodeId(sourceNode) : 'unknown',
      toNodeId: targetNode ? generateDeterministicNodeId(targetNode) : 'unknown',
      inheritanceType,
      interfaceMethods: this.extractInterfaceMethods(astNode),
      embeddedFields: this.extractEmbeddedFields(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定继承类型
   */
  private determineInheritanceType(astNode: Parser.SyntaxNode): 'implements' | 'embeds' | 'extends' | 'contains' | 'embedded_struct' {
    const nodeType = astNode.type;
    
    if (nodeType === 'interface_type') {
      return 'implements';
    } else if (nodeType === 'struct_type') {
      // 检查是否有嵌入字段
      const fields = astNode.childForFieldName('body');
      if (fields) {
        for (const child of fields.children) {
          if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
            return 'embeds';
          }
        }
      }
      return 'contains';
    } else if (nodeType === 'type_declaration') {
      const typeSpec = astNode.childForFieldName('type');
      if (typeSpec) {
        if (typeSpec.type === 'interface_type') {
          return 'implements';
        } else if (typeSpec.type === 'struct_type') {
          return 'embeds';
        }
      }
    }
    
    return 'contains';
  }

  /**
   * 提取源节点（实现者/包含者）
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 对于类型声明，源节点是类型声明本身
    if (astNode.type === 'type_declaration') {
      return astNode;
    }
    
    // 对于接口或结构体，源节点是父类型声明
    let current = astNode.parent;
    while (current) {
      if (current.type === 'type_declaration') {
        return current;
      }
      current = current.parent;
    }
    
    return null;
  }

  /**
   * 提取目标节点（被实现/被嵌入的类型）
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'interface_type') {
      // 对于接口，查找实现该接口的结构体
      return this.findImplementingStruct(astNode);
    } else if (nodeType === 'struct_type') {
      // 对于结构体，查找嵌入的字段
      return this.findEmbeddedField(astNode);
    }
    
    return null;
  }

  /**
   * 提取接口方法
   */
  private extractInterfaceMethods(astNode: Parser.SyntaxNode): string[] {
    const methods: string[] = [];
    
    if (astNode.type === 'interface_type') {
      const body = astNode.childForFieldName('body');
      if (body) {
        for (const child of body.children) {
          if (child.type === 'method_spec') {
            const nameNode = child.childForFieldName('name');
            if (nameNode) {
              methods.push(nameNode.text);
            }
          }
        }
      }
    }
    
    return methods;
  }

  /**
   * 提取嵌入字段
   */
  private extractEmbeddedFields(astNode: Parser.SyntaxNode): string[] {
    const embeddedFields: string[] = [];
    
    if (astNode.type === 'struct_type') {
      const body = astNode.childForFieldName('body');
      if (body) {
        for (const child of body.children) {
          if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
            const typeNode = child.childForFieldName('type');
            if (typeNode) {
              embeddedFields.push(typeNode.text);
            }
          }
        }
      }
    }
    
    return embeddedFields;
  }

  /**
   * 判断是否为嵌入字段
   */
  private isEmbeddedField(fieldNode: Parser.SyntaxNode): boolean {
    // 在Go中，嵌入字段没有字段名，只有类型
    const nameNode = fieldNode.childForFieldName('name');
    return !nameNode;
  }

  /**
   * 查找实现接口的结构体
   */
  private findImplementingStruct(interfaceNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 在实际实现中，这里需要更复杂的分析来查找实现该接口的结构体
    // 目前返回null，表示需要进一步分析
    return null;
  }

  /**
   * 查找嵌入字段
   */
  private findEmbeddedField(structNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const body = structNode.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
          return child.childForFieldName('type');
        }
      }
    }
    return null;
  }

  /**
   * 提取继承关系数组
   */
  extractInheritanceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'implements' | 'embeds' | 'extends' | 'contains' | 'embedded_struct';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'implements' | 'embeds' | 'extends' | 'contains' | 'embedded_struct';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const inheritanceType = this.determineInheritanceType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || 'unknown';
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: inheritanceType
        });
      }
    }

    return relationships;
  }

  /**
   * 分析接口实现关系
   */
  private analyzeInterfaceImplementation(typeNode: Parser.SyntaxNode): {
    implementingType: string;
    implementedInterface: string;
    methods: string[];
  } | null {
    if (typeNode.type !== 'type_declaration') {
      return null;
    }

    const typeSpec = typeNode.childForFieldName('type');
    if (!typeSpec) {
      return null;
    }

    const nameNode = typeNode.childForFieldName('name');
    if (!nameNode) {
      return null;
    }

    // 检查是否是实现接口的结构体
    if (typeSpec.type === 'struct_type') {
      // 在实际实现中，这里需要分析该结构体是否实现了某个接口
      // 目前返回null，表示需要进一步分析
      return null;
    }

    return null;
  }

  /**
   * 分析结构体嵌入关系
   */
  private analyzeStructEmbedding(structNode: Parser.SyntaxNode): {
    structName: string;
    embeddedTypes: string[];
  } | null {
    if (structNode.type !== 'struct_type') {
      return null;
    }

    const embeddedTypes = this.extractEmbeddedFields(structNode);
    if (embeddedTypes.length === 0) {
      return null;
    }

    // 查找结构体名称
    let structName = 'unknown';
    let current = structNode.parent;
    while (current) {
      if (current.type === 'type_declaration') {
        const nameNode = current.childForFieldName('name');
        if (nameNode) {
          structName = nameNode.text;
        }
        break;
      }
      current = current.parent;
    }

    return {
      structName,
      embeddedTypes
    };
  }
}