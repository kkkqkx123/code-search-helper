/**
 * JavaScript/TypeScript 引用关系提取器
 * 提取代码中的读取、写入、声明和使用关系
 */
export class JsReferenceRelationshipExtractor {
 extractReferenceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'read' | 'write' | 'declaration' | 'usage';
    }> = [];

    const captures = result.captures;
    if (!captures || !Array.isArray(captures)) {
      return relationships;
    }

    for (const capture of captures) {
      if (capture.name && capture.node?.text) {
        const node = capture.node;
        
        // 提取变量声明关系
        if (node.type === 'variable_declarator' || node.type === 'lexical_declaration') {
          const name = node.childForFieldName('name');
          if (name?.text) {
            relationships.push({
              source: 'variable-declaration',
              target: name.text,
              type: 'declaration'
            });
          }
        }
        
        // 提取赋值（写入）关系
        if (node.type === 'assignment_expression') {
          const left = node.childForFieldName('left');
          const right = node.childForFieldName('right');
          
          if (left?.text) {
            relationships.push({
              source: right?.text || 'unknown-value',
              target: left.text,
              type: 'write'
            });
          }
        }
        
        // 提取标识符使用（读取）关系
        if (node.type === 'identifier') {
          relationships.push({
            source: 'identifier-usage',
            target: node.text,
            type: 'usage'
          });
        }
        
        // 提取成员表达式（可能是读取或写入）
        if (node.type === 'member_expression') {
          const object = node.childForFieldName('object');
          const property = node.childForFieldName('property');
          
          if (object?.text && property?.text) {
            relationships.push({
              source: object.text,
              target: property.text,
              type: 'read' // 假设为读取操作
            });
          }
        }
      }
    }

    return relationships;
  }

  extractReferenceMetadata(result: any, astNode: any, symbolTable: any): any {
    // 提取引用关系元数据
    return {
      type: 'reference',
      referenceType: this.getReferenceType(astNode),
      referenceTarget: this.getReferenceTarget(astNode),
      location: {
        startLine: astNode?.startPosition?.row + 1,
        endLine: astNode?.endPosition?.row + 1,
      }
    };
  }

  private getReferenceType(node: any): string {
    if (!node) return 'usage';
    
    switch (node.type) {
      case 'variable_declarator':
      case 'lexical_declaration':
        return 'declaration';
      case 'assignment_expression':
        return 'write';
      case 'identifier':
        return 'usage';
      case 'member_expression':
        return 'read';
      default:
        return 'usage';
    }
  }

 private getReferenceTarget(node: any): string {
    if (!node) return 'unknown';
    
    switch (node.type) {
      case 'variable_declarator':
      case 'lexical_declaration':
        const name = node.childForFieldName('name');
        return name?.text || 'unknown';
      case 'assignment_expression':
        const left = node.childForFieldName('left');
        return left?.text || 'unknown';
      case 'identifier':
        return node.text;
      case 'member_expression':
        const property = node.childForFieldName('property');
        return property?.text || 'unknown';
      default:
        return 'unknown';
    }
  }
}