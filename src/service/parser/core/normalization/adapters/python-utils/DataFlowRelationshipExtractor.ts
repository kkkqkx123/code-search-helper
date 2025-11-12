import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 数据流关系提取器
 * 专门处理Python语言的数据流关系提取
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const flowType = this.determineFlowType(astNode);
    const flowPath = this.extractFlowPath(astNode);

    return {
      type: 'data-flow',
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      flowType,
      dataType: this.determineDataType(astNode),
      flowPath,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取数据流关系
   */
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取赋值数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        relationships.push({
          source: right.text,
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取类型注解赋值数据流关系
    if (mainNode.type === 'annotated_assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        relationships.push({
          source: right.text,
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取增强赋值数据流关系
    if (mainNode.type === 'augmented_assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        relationships.push({
          source: right.text,
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取属性赋值数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.type === 'attribute' && right?.text) {
        const objectNode = left.childForFieldName('object');
        const attributeNode = left.childForFieldName('attribute');
        
        if (objectNode?.text && attributeNode?.text) {
          relationships.push({
            source: right.text,
            target: `${objectNode.text}.${attributeNode.text}`,
            type: 'assignment'
          });
        }
      }
    }

    // 提取下标赋值数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.type === 'subscript' && right?.text) {
        const objectNode = left.childForFieldName('object');
        const indexNode = left.childForFieldName('index');
        
        if (objectNode?.text && indexNode?.text) {
          relationships.push({
            source: right.text,
            target: `${objectNode.text}[${indexNode.text}]`,
            type: 'assignment'
          });
        }
      }
    }

    // 提取函数调用参数传递数据流关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      const args = mainNode.childForFieldName('arguments');
      
      if (func?.text && args) {
        for (const arg of args.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: func.text,
              type: 'parameter'
            });
          }
        }
      }
    }

    // 提取方法调用参数传递数据流关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      const args = mainNode.childForFieldName('arguments');
      
      if (func?.type === 'attribute' && args) {
        const objectNode = func.childForFieldName('object');
        const attributeNode = func.childForFieldName('attribute');
        
        if (objectNode?.text && attributeNode?.text) {
          for (const arg of args.children || []) {
            if (arg.type === 'identifier' && arg.text) {
              relationships.push({
                source: arg.text,
                target: `${objectNode.text}.${attributeNode.text}`,
                type: 'parameter'
              });
            }
          }
        }
      }
    }

    // 提取返回值数据流关系
    if (mainNode.type === 'return_statement') {
      const value = mainNode.childForFieldName('value');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (value?.text && callerNode) {
        const funcName = callerNode.childForFieldName('name')?.text || 'unknown';
        relationships.push({
          source: value.text,
          target: `${funcName}.return`,
          type: 'return'
        });
      }
    }

    // 提取属性返回数据流关系
    if (mainNode.type === 'return_statement') {
      const value = mainNode.childForFieldName('value');
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      
      if (value?.type === 'attribute' && callerNode) {
        const objectNode = value.childForFieldName('object');
        const attributeNode = value.childForFieldName('attribute');
        const funcName = callerNode.childForFieldName('name')?.text || 'unknown';
        
        if (objectNode?.text && attributeNode?.text) {
          relationships.push({
            source: `${objectNode.text}.${attributeNode.text}`,
            target: `${funcName}.return`,
            type: 'return'
          });
        }
      }
    }

    // 提取Lambda赋值数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.type === 'lambda') {
        relationships.push({
          source: 'lambda',
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取列表推导式数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.type === 'list_comprehension') {
        // 从推导式中提取源变量
        const sourceVar = this.extractComprehensionSource(right);
        if (sourceVar) {
          relationships.push({
            source: sourceVar,
            target: left.text,
            type: 'assignment'
          });
        }
      }
    }

    // 提取字典推导式数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.type === 'dictionary_comprehension') {
        // 从推导式中提取源变量
        const sourceVar = this.extractComprehensionSource(right);
        if (sourceVar) {
          relationships.push({
            source: sourceVar,
            target: left.text,
            type: 'assignment'
          });
        }
      }
    }

    // 提取生成器表达式数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.type === 'generator_expression') {
        // 从生成器表达式中提取源变量
        const sourceVar = this.extractComprehensionSource(right);
        if (sourceVar) {
          relationships.push({
            source: sourceVar,
            target: left.text,
            type: 'assignment'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 确定数据流类型
   */
  private determineFlowType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'assignment':
        return 'variable_assignment';
      case 'annotated_assignment':
        return 'typed_assignment';
      case 'augmented_assignment':
        return 'augmented_assignment';
      case 'call':
        return 'parameter_passing';
      case 'return_statement':
        return 'return_value';
      default:
        return 'unknown_flow';
    }
  }

  /**
   * 确定数据类型
   */
  private determineDataType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'assignment':
      case 'annotated_assignment':
      case 'augmented_assignment':
        return 'variable';
      case 'call':
        return 'function_call';
      case 'return_statement':
        return 'return_value';
      default:
        return 'unknown';
    }
  }

  /**
   * 提取数据流路径
   */
  private extractFlowPath(astNode: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    
    switch (astNode.type) {
      case 'assignment':
      case 'annotated_assignment':
      case 'augmented_assignment':
        const left = astNode.childForFieldName('left');
        const right = astNode.childForFieldName('right');
        if (right?.text) path.push(right.text);
        if (left?.text) path.push(left.text);
        break;
        
      case 'call':
        const func = astNode.childForFieldName('function');
        const args = astNode.childForFieldName('arguments');
        if (args) {
          for (const arg of args.children || []) {
            if (arg.type === 'identifier' && arg.text) {
              path.push(arg.text);
            }
          }
        }
        if (func?.text) path.push(func.text);
        break;
        
      case 'return_statement':
        const value = astNode.childForFieldName('value');
        if (value?.text) path.push(value.text);
        path.push('return');
        break;
    }
    
    return path;
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'assignment':
      case 'annotated_assignment':
      case 'augmented_assignment':
        const right = astNode.childForFieldName('right');
        return right ? NodeIdGenerator.forAstNode(right) : 'unknown';
        
      case 'call':
        const args = astNode.childForFieldName('arguments');
        return args ? NodeIdGenerator.forAstNode(args) : 'unknown';
        
      case 'return_statement':
        const value = astNode.childForFieldName('value');
        return value ? NodeIdGenerator.forAstNode(value) : 'unknown';
        
      default:
        return 'unknown';
    }
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'assignment':
      case 'annotated_assignment':
      case 'augmented_assignment':
        const left = astNode.childForFieldName('left');
        return left ? NodeIdGenerator.forAstNode(left) : 'unknown';
        
      case 'call':
        const func = astNode.childForFieldName('function');
        return func ? NodeIdGenerator.forAstNode(func) : 'unknown';
        
      case 'return_statement':
        return 'function_return';
        
      default:
        return 'unknown';
    }
  }

  /**
   * 从推导式中提取源变量
   */
  private extractComprehensionSource(comprehensionNode: Parser.SyntaxNode): string | null {
    // 查找for子句中的变量
    for (const child of comprehensionNode.children || []) {
      if (child.type === 'for_clause') {
        const iter = child.childForFieldName('iter');
        if (iter?.type === 'identifier') {
          return iter.text;
        }
      }
    }
    return null;
  }

  /**
   * 提取多重赋值数据流关系
   */
  extractMultipleAssignmentRelationships(result: any): Array<{
    source: string;
    target: string[];
    type: 'multiple_assignment';
  }> {
    const relationships: Array<{
      source: string;
      target: string[];
      type: 'multiple_assignment';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取多重赋值关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.type === 'pattern_list' && right?.text) {
        const targets: string[] = [];
        for (const child of left.children || []) {
          if (child.type === 'identifier' && child.text) {
            targets.push(child.text);
          }
        }
        
        if (targets.length > 0) {
          relationships.push({
            source: right.text,
            target: targets,
            type: 'multiple_assignment'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 提取解包赋值数据流关系
   */
  extractUnpackingRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'unpacking';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'unpacking';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取解包赋值关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.type === 'pattern_list' && right?.type === 'identifier' && right.text) {
        for (const child of left.children || []) {
          if (child.type === 'identifier' && child.text) {
            relationships.push({
              source: right.text,
              target: child.text,
              type: 'unpacking'
            });
          }
        }
      }
    }

    return relationships;
  }
}