import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 继承关系提取器
 * 专门处理Rust语言的trait实现关系提取
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const inheritanceInfo = this.extractInheritanceInfo(astNode);

    return {
      type: 'inheritance',
      operation: inheritanceInfo.operation,
      fromNodeId: inheritanceInfo.fromNodeId,
      toNodeId: inheritanceInfo.toNodeId,
      traitName: inheritanceInfo.traitName,
      typeName: inheritanceInfo.typeName,
      isGeneric: inheritanceInfo.isGeneric,
      genericParams: inheritanceInfo.genericParams,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取继承关系
   */
  extractInheritanceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'trait_impl' | 'trait_bound' | 'trait_inheritance' | 'struct_composition';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'trait_impl' | 'trait_bound' | 'trait_inheritance' | 'struct_composition';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取trait实现关系
    if (mainNode.type === 'impl_item') {
      const traitNode = mainNode.childForFieldName('trait');
      const typeNode = mainNode.childForFieldName('type');
      
      if (traitNode?.text && typeNode?.text) {
        relationships.push({
          source: typeNode.text,
          target: traitNode.text,
          type: 'trait_impl'
        });
      } else if (typeNode?.text) {
        // 固有实现（没有trait的impl）
        relationships.push({
          source: typeNode.text,
          target: 'inherent_impl',
          type: 'trait_impl'
        });
      }
    }

    // 提取trait约束关系
    if (mainNode.type === 'where_clause' || mainNode.type === 'trait_bound') {
      const bounds = this.extractTraitBounds(mainNode);
      for (const bound of bounds) {
        relationships.push({
          source: bound.type,
          target: bound.trait,
          type: 'trait_bound'
        });
      }
    }

    // 提取trait继承关系
    if (mainNode.type === 'trait_item') {
      const supertraits = this.extractSupertraits(mainNode);
      for (const supertrait of supertraits) {
        relationships.push({
          source: this.extractTraitName(mainNode),
          target: supertrait,
          type: 'trait_inheritance'
        });
      }
    }

    // 提取结构体组合关系
    if (mainNode.type === 'struct_item' || mainNode.type === 'enum_item') {
      const fields = this.extractFields(mainNode);
      for (const field of fields) {
        if (this.isComplexType(field.type)) {
          relationships.push({
            source: this.extractTypeName(mainNode),
            target: field.type,
            type: 'struct_composition'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 提取继承信息
   */
  private extractInheritanceInfo(node: Parser.SyntaxNode): {
    operation: string;
    fromNodeId: string;
    toNodeId: string;
    traitName?: string;
    typeName?: string;
    isGeneric: boolean;
    genericParams: string[];
  } {
    if (node.type === 'impl_item') {
      const traitNode = node.childForFieldName('trait');
      const typeNode = node.childForFieldName('type');
      
      return {
        operation: traitNode ? 'trait_implementation' : 'inherent_implementation',
        fromNodeId: typeNode ? generateDeterministicNodeId(typeNode) : 'unknown',
        toNodeId: traitNode ? generateDeterministicNodeId(traitNode) : 'inherent_impl',
        traitName: traitNode?.text,
        typeName: typeNode?.text,
        isGeneric: this.hasGenericParameters(node),
        genericParams: this.extractGenericParameters(node)
      };
    }

    if (node.type === 'trait_item') {
      return {
        operation: 'trait_definition',
        fromNodeId: generateDeterministicNodeId(node),
        toNodeId: 'trait_base',
        traitName: this.extractTraitName(node),
        isGeneric: this.hasGenericParameters(node),
        genericParams: this.extractGenericParameters(node)
      };
    }

    if (node.type === 'where_clause' || node.type === 'trait_bound') {
      const bounds = this.extractTraitBounds(node);
      const firstBound = bounds[0];
      
      return {
        operation: 'trait_bound',
        fromNodeId: firstBound ? generateDeterministicNodeIdFromString(firstBound.type) : 'unknown',
        toNodeId: firstBound ? generateDeterministicNodeIdFromString(firstBound.trait) : 'unknown',
        traitName: firstBound?.trait,
        typeName: firstBound?.type,
        isGeneric: false,
        genericParams: []
      };
    }

    return {
      operation: 'unknown',
      fromNodeId: 'unknown',
      toNodeId: 'unknown',
      isGeneric: false,
      genericParams: []
    };
  }

  /**
   * 提取trait约束
   */
  private extractTraitBounds(node: Parser.SyntaxNode): Array<{type: string, trait: string}> {
    const bounds: Array<{type: string, trait: string}> = [];
    
    if (node.type === 'where_clause') {
      for (const child of node.children || []) {
        if (child.type === 'where_predicate') {
          const bound = this.extractWherePredicate(child);
          if (bound) bounds.push(bound);
        }
      }
    } else if (node.type === 'trait_bound') {
      const bound = this.extractTraitBound(node);
      if (bound) bounds.push(bound);
    }

    return bounds;
  }

  /**
   * 提取where谓词
   */
  private extractWherePredicate(predicate: Parser.SyntaxNode): {type: string, trait: string} | null {
    const leftType = predicate.childForFieldName('left');
    const boundType = predicate.childForFieldName('bound');
    
    if (leftType?.text && boundType?.text) {
      return {
        type: leftType.text,
        trait: boundType.text
      };
    }
    
    return null;
  }

  /**
   * 提取trait约束
   */
  private extractTraitBound(bound: Parser.SyntaxNode): {type: string, trait: string} | null {
    // 简单实现：从trait约束中提取类型和trait
    const text = bound.text || '';
    const parts = text.split(':');
    
    if (parts.length === 2) {
      return {
        type: parts[0].trim(),
        trait: parts[1].trim()
      };
    }
    
    return null;
  }

  /**
   * 提取超trait
   */
  private extractSupertraits(traitNode: Parser.SyntaxNode): string[] {
    const supertraits: string[] = [];
    
    // 查找trait定义中的超trait约束
    for (const child of traitNode.children || []) {
      if (child.type === 'type_parameters') {
        for (const param of child.children || []) {
          if (param.type === 'trait_bound' && param.text) {
            supertraits.push(param.text);
          }
        }
      }
    }
    
    return supertraits;
  }

  /**
   * 提取结构体字段
   */
  private extractFields(structNode: Parser.SyntaxNode): Array<{name: string, type: string}> {
    const fields: Array<{name: string, type: string}> = [];
    
    const fieldList = structNode.childForFieldName('body') || 
                     structNode.childForFieldName('fields');
    
    if (fieldList) {
      for (const child of fieldList.children || []) {
        if (child.type === 'field_declaration') {
          const nameNode = child.childForFieldName('name');
          const typeNode = child.childForFieldName('type');
          
          if (nameNode?.text && typeNode?.text) {
            fields.push({
              name: nameNode.text,
              type: typeNode.text
            });
          }
        }
      }
    }
    
    return fields;
  }

  /**
   * 判断是否是复杂类型
   */
  private isComplexType(typeName: string): boolean {
    // 简单实现：检查是否是用户定义的类型（大写字母开头）
    return /^[A-Z]/.test(typeName) && 
           !['String', 'Vec', 'HashMap', 'Option', 'Result', 'Box', 'Rc', 'Arc'].includes(typeName);
  }

  /**
   * 提取trait名称
   */
  private extractTraitName(traitNode: Parser.SyntaxNode): string {
    const nameNode = traitNode.childForFieldName('name');
    return nameNode?.text || 'unknown_trait';
  }

  /**
   * 提取类型名称
   */
  private extractTypeName(typeNode: Parser.SyntaxNode): string {
    const nameNode = typeNode.childForFieldName('name');
    return nameNode?.text || 'unknown_type';
  }

  /**
   * 检查是否有泛型参数
   */
  private hasGenericParameters(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('<') && text.includes('>');
  }

  /**
   * 提取泛型参数
   */
  private extractGenericParameters(node: Parser.SyntaxNode): string[] {
    const params: string[] = [];
    
    for (const child of node.children || []) {
      if (child.type === 'type_parameters' || child.type === 'type_arguments') {
        for (const param of child.children || []) {
          if (param.type === 'type_parameter' && param.text) {
            params.push(param.text);
          }
        }
      }
    }
    
    return params;
  }

  /**
   * 从字符串生成确定性节点ID
   */
  private generateDeterministicNodeIdFromString(text: string): string {
    // 简单实现：基于文本生成ID
    return `string:${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 分析trait方法的实现
   */
  private analyzeTraitMethodImplementation(implNode: Parser.SyntaxNode): {
    requiredMethods: string[];
    providedMethods: string[];
    implementedMethods: string[];
  } {
    const requiredMethods: string[] = [];
    const providedMethods: string[] = [];
    const implementedMethods: string[] = [];
    
    // 这里需要更复杂的逻辑来分析trait方法的实现
    // 简化实现：从impl块中提取方法名
    
    const body = implNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_item') {
          const nameNode = child.childForFieldName('name');
          if (nameNode?.text) {
            implementedMethods.push(nameNode.text);
          }
        }
      }
    }
    
    return {
      requiredMethods,
      providedMethods,
      implementedMethods
    };
  }

  /**
   * 提取trait关联类型
   */
  private extractAssociatedTypes(traitNode: Parser.SyntaxNode): Array<{name: string, bounds?: string}> {
    const associatedTypes: Array<{name: string, bounds?: string}> = [];
    
    const body = traitNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'type_item') {
          const nameNode = child.childForFieldName('name');
          const boundsNode = child.childForFieldName('bounds');
          
          if (nameNode?.text) {
            associatedTypes.push({
              name: nameNode.text,
              bounds: boundsNode?.text
            });
          }
        }
      }
    }
    
    return associatedTypes;
  }

  /**
   * 分析trait的自动实现
   */
  private analyzeAutoTraits(traitNode: Parser.SyntaxNode): {
    isAutoTrait: boolean;
    requiredTraits: string[];
  } {
    const text = traitNode.text || '';
    
    return {
      isAutoTrait: text.includes('auto trait') || text.includes('AutoTrait'),
      requiredTraits: [] // 简化实现
    };
  }
}