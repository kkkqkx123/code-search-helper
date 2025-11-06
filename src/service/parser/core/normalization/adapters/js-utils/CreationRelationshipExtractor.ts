/**
 * JavaScript/TypeScript 创建关系提取器
 * 提取代码中的实例化和创建关系
 */
export class JsCreationRelationshipExtractor {
 extractCreationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'object_instance' | 'array' | 'function' | 'class_instance' | 'promise';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'object_instance' | 'array' | 'function' | 'class_instance' | 'promise';
    }> = [];

    const captures = result.captures;
    if (!captures || !Array.isArray(captures)) {
      return relationships;
    }

    for (const capture of captures) {
      if (capture.name && capture.node?.text) {
        const node = capture.node;
        
        // 提取对象创建关系
        if (node.type === 'object' || node.type === 'object_pattern') {
          relationships.push({
            source: 'object-creation',
            target: node.text.substring(0, 50) + (node.text.length > 50 ? '...' : ''), // 限制长度
            type: 'object_instance'
          });
        }
        
        // 提取数组创建关系
        if (node.type === 'array' || node.type === 'array_pattern') {
          relationships.push({
            source: 'array-creation',
            target: node.text.substring(0, 50) + (node.text.length > 50 ? '...' : ''),
            type: 'array'
          });
        }
        
        // 提取类实例化关系
        if (node.type === 'new_expression') {
          const constructor = node.childForFieldName('constructor');
          if (constructor?.text) {
            relationships.push({
              source: 'new-instance',
              target: constructor.text,
              type: 'class_instance'
            });
          }
        }
        
        // 提取函数创建关系
        if (node.type === 'function' || node.type === 'arrow_function' || 
            node.type === 'function_declaration' || node.type === 'function_expression') {
          relationships.push({
            source: 'function-creation',
            target: this.extractFunctionName(node) || 'anonymous-function',
            type: 'function'
          });
        }
        
        // 提取Promise创建关系
        if (node.type === 'call_expression') {
          const func = node.childForFieldName('function');
          if (func?.text && func.text.includes('Promise')) {
            relationships.push({
              source: 'promise-creation',
              target: func.text,
              type: 'promise'
            });
          }
        }
      }
    }

    return relationships;
  }

  private extractFunctionName(node: any): string | null {
    // 从函数节点中提取函数名
    if (node.type === 'function_declaration' || node.type === 'function_expression') {
      const name = node.childForFieldName('name');
      return name?.text || null;
    }
    
    // 对于方法定义
    if (node.type === 'method_definition') {
      const name = node.childForFieldName('name');
      return name?.text || null;
    }
    
    return null;
  }

 extractCreationMetadata(result: any, astNode: any, symbolTable: any): any {
    // 提取创建关系元数据
    return {
      type: 'creation',
      creationType: this.getCreationType(astNode),
      creationTarget: this.getCreationTarget(astNode),
      location: {
        startLine: astNode?.startPosition?.row + 1,
        endLine: astNode?.endPosition?.row + 1,
      }
    };
  }

  private getCreationType(node: any): string {
    if (!node) return 'object_instance';
    
    switch (node.type) {
      case 'new_expression':
        return 'class_instance';
      case 'array':
      case 'array_pattern':
        return 'array';
      case 'object':
      case 'object_pattern':
        return 'object_instance';
      case 'function':
      case 'arrow_function':
      case 'function_declaration':
      case 'function_expression':
        return 'function';
      case 'call_expression':
        if (node.text.includes('Promise')) return 'promise';
        return 'function';
      default:
        return 'object_instance';
    }
  }

  private getCreationTarget(node: any): string {
    if (!node) return 'unknown';
    
    switch (node.type) {
      case 'new_expression':
        const constructor = node.childForFieldName('constructor');
        return constructor?.text || 'unknown-constructor';
      case 'call_expression':
        const func = node.childForFieldName('function');
        return func?.text || 'unknown-function';
      default:
        return node.text.substring(0, 50) + (node.text.length > 50 ? '...' : '');
    }
 }
}