import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 继承关系提取器
 * 从 JavaLanguageAdapter 迁移继承关系提取逻辑
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const captures = result.captures || [];
    const metadata: any = {
      type: 'inheritance',
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column
      }
    };

    // 提取继承关系信息
    for (const capture of captures) {
      if (capture.name.includes('extends') || capture.name.includes('superclass')) {
        metadata.inheritanceType = 'extends';
        metadata.superclass = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      } else if (capture.name.includes('implements') || capture.name.includes('interface')) {
        metadata.inheritanceType = 'implements';
        metadata.interface = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      }
    }

    // 如果没有从捕获中获取到信息，尝试从AST节点分析
    if (!metadata.inheritanceType) {
      this.analyzeInheritanceFromAST(astNode, metadata);
    }

    return metadata;
  }

  /**
   * 从AST节点分析继承关系
   */
  private analyzeInheritanceFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
    if (astNode.type === 'class_declaration' || astNode.type === 'interface_declaration' || 
        astNode.type === 'enum_declaration' || astNode.type === 'record_declaration') {
      
      // 检查继承关系
      const superClass = astNode.childForFieldName('superclass');
      if (superClass?.text) {
        metadata.inheritanceType = 'extends';
        metadata.superclass = superClass.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(superClass);
      }

      // 检查接口实现
      const superInterfaces = astNode.childForFieldName('super_interfaces');
      if (superInterfaces?.text) {
        metadata.inheritanceType = 'implements';
        metadata.interfaces = superInterfaces.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        // 对于多个接口，取第一个作为主要目标
        const firstInterface = this.extractFirstInterface(superInterfaces);
        if (firstInterface) {
          metadata.toNodeId = NodeIdGenerator.forAstNode(firstInterface);
        }
      }
    }
  }

  /**
   * 提取第一个接口
   */
  private extractFirstInterface(superInterfaces: Parser.SyntaxNode): Parser.SyntaxNode | null {
    for (const child of superInterfaces.children) {
      if (child.type === 'type_identifier' || child.type === 'scoped_type_identifier') {
        return child;
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
    type: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取类继承关系
    if (mainNode.type === 'class_declaration') {
      const className = mainNode.childForFieldName('name');
      const superClass = mainNode.childForFieldName('superclass');
      
      if (className?.text && superClass?.text) {
        relationships.push({
          source: className.text,
          target: superClass.text,
          type: 'extends'
        });
      }

      // 提取接口实现关系
      const superInterfaces = mainNode.childForFieldName('super_interfaces');
      if (superInterfaces && className?.text) {
        const interfaces = this.extractInterfaceNames(superInterfaces);
        for (const interfaceName of interfaces) {
          relationships.push({
            source: className.text,
            target: interfaceName,
            type: 'implements'
          });
        }
      }
    }

    // 提取接口继承关系
    if (mainNode.type === 'interface_declaration') {
      const interfaceName = mainNode.childForFieldName('name');
      const superInterfaces = mainNode.childForFieldName('super_interfaces');
      
      if (superInterfaces && interfaceName?.text) {
        const interfaces = this.extractInterfaceNames(superInterfaces);
        for (const superInterfaceName of interfaces) {
          relationships.push({
            source: interfaceName.text,
            target: superInterfaceName,
            type: 'extends'
          });
        }
      }
    }

    // 提取枚举关系
    if (mainNode.type === 'enum_declaration') {
      const enumName = mainNode.childForFieldName('name');
      const interfaces = mainNode.childForFieldName('super_interfaces');
      
      if (interfaces && enumName?.text) {
        const interfaceNames = this.extractInterfaceNames(interfaces);
        for (const interfaceName of interfaceNames) {
          relationships.push({
            source: enumName.text,
            target: interfaceName,
            type: 'implements'
          });
        }
      }
    }

    // 提取记录类型关系
    if (mainNode.type === 'record_declaration') {
      const recordName = mainNode.childForFieldName('name');
      const interfaces = mainNode.childForFieldName('super_interfaces');
      
      if (interfaces && recordName?.text) {
        const interfaceNames = this.extractInterfaceNames(interfaces);
        for (const interfaceName of interfaceNames) {
          relationships.push({
            source: recordName.text,
            target: interfaceName,
            type: 'implements'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 提取接口名称列表
   */
  private extractInterfaceNames(superInterfaces: Parser.SyntaxNode): string[] {
    const interfaceNames: string[] = [];
    
    for (const child of superInterfaces.children) {
      if (child.type === 'type_identifier' || child.type === 'scoped_type_identifier') {
        interfaceNames.push(child.text);
      }
    }
    
    return interfaceNames;
  }
}