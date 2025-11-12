import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++ 语义关系提取器
 * 从 CRelationshipExtractor/SemanticExtractor.ts 迁移
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 从CRelationshipExtractor/SemanticExtractor.ts迁移
    const text = astNode.text || '';
    let semanticType = 'unknown';
    let pattern = 'unknown';

    // 检测函数调用委托
    if (astNode.type === 'call_expression') {
      semanticType = 'delegates';
      pattern = 'function_call';
    }
    // 检测结构体字段配置
    else if (astNode.type === 'field_declaration') {
      semanticType = 'configures';
      pattern = 'struct_field';
    }
    // 检测类型别名
    else if (astNode.type === 'type_alias_declaration' || text.includes('typedef')) {
      semanticType = 'overrides';
      pattern = 'type_alias';
    }
    // 检测模板特化
    else if (astNode.type === 'template_declaration' && text.includes('specialization')) {
      semanticType = 'overloads';
      pattern = 'template_specialization';
    }
    // 检测虚函数重写
    else if (text.includes('override')) {
      semanticType = 'overrides';
      pattern = 'virtual_override';
    }
    // 检测函数重载
    else if (astNode.type === 'function_definition' && text.includes('operator')) {
      semanticType = 'overloads';
      pattern = 'operator_overload';
    }

    return {
      type: 'semantic',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: 'unknown', // 需要更复杂的分析来确定目标
      semanticType,
      pattern,
      metadata: {
        relationshipType: pattern
      },
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取语义关系
   */
  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 虚函数重写关系
    const text = mainNode.text || '';
    if (text.includes('override')) {
      relationships.push({
        source: 'derived_method',
        target: 'base_method',
        type: 'overrides'
      });
    }

    // 函数重载关系
    if (mainNode.type === 'function_definition' && text.includes('operator')) {
      relationships.push({
        source: 'operator',
        target: 'operands',
        type: 'overloads'
      });
    }

    // 模板特化关系
    if (mainNode.type === 'template_declaration') {
      relationships.push({
        source: 'template_specialization',
        target: 'primary_template',
        type: 'overloads'
      });
    }

    return relationships;
  }
}