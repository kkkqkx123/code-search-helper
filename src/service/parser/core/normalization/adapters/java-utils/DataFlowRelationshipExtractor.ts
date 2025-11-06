import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 数据流关系提取器
 * 从 JavaLanguageAdapter 迁移数据流关系提取逻辑
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const captures = result.captures || [];
    const metadata: any = {
      type: 'data-flow',
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column
      }
    };

    // 提取源和目标节点信息
    for (const capture of captures) {
      if (capture.name.includes('source') || capture.name.includes('parameter')) {
        metadata.fromNodeId = generateDeterministicNodeId(capture.node);
        metadata.sourceVariable = capture.node.text;
      } else if (capture.name.includes('target') || capture.name.includes('method')) {
        metadata.toNodeId = generateDeterministicNodeId(capture.node);
        metadata.targetVariable = capture.node.text;
      }
    }

    // 如果没有从捕获中获取到信息，尝试从AST节点分析
    if (!metadata.fromNodeId || !metadata.toNodeId) {
      this.analyzeDataFlowFromAST(astNode, metadata);
    }

    return metadata;
  }

  /**
   * 从AST节点分析数据流
   */
  private analyzeDataFlowFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
    if (astNode.type === 'assignment_expression') {
      const left = astNode.childForFieldName('left');
      const right = astNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        metadata.fromNodeId = generateDeterministicNodeId(right);
        metadata.toNodeId = generateDeterministicNodeId(left);
        metadata.sourceVariable = right.text;
        metadata.targetVariable = left.text;
        metadata.flowType = 'variable_assignment';
      }
    } else if (astNode.type === 'method_invocation') {
      const args = astNode.childForFieldName('arguments');
      const method = astNode.childForFieldName('name');
      
      if (args && method?.text) {
        for (const arg of args.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            metadata.fromNodeId = generateDeterministicNodeId(arg);
            metadata.toNodeId = generateDeterministicNodeId(method);
            metadata.sourceVariable = arg.text;
            metadata.targetVariable = method.text;
            metadata.flowType = 'parameter_passing';
            break;
          }
        }
      }
    } else if (astNode.type === 'return_statement') {
      const value = astNode.childForFieldName('value');
      if (value?.text) {
        metadata.fromNodeId = generateDeterministicNodeId(value);
        metadata.toNodeId = 'return';
        metadata.sourceVariable = value.text;
        metadata.targetVariable = 'return';
        metadata.flowType = 'return_value';
      }
    } else if (astNode.type === 'field_access') {
      const object = astNode.childForFieldName('object');
      const field = astNode.childForFieldName('field');
      
      if (object?.text && field?.text) {
        metadata.fromNodeId = generateDeterministicNodeId(object);
        metadata.toNodeId = generateDeterministicNodeId(field);
        metadata.sourceVariable = object.text;
        metadata.targetVariable = field.text;
        metadata.flowType = 'field_access';
      }
    }
  }

  /**
   * 提取数据流关系数组
   */
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return' | 'field_access';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取赋值数据流关系
    if (mainNode.type === 'assignment_expression') {
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

    // 提取参数数据流关系
    if (mainNode.type === 'method_invocation') {
      const args = mainNode.childForFieldName('arguments');
      const method = mainNode.childForFieldName('name');
      
      if (args && method?.text) {
        for (const arg of args.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: method.text,
              type: 'parameter'
            });
          }
        }
      }
    }

    // 提取返回值数据流关系
    if (mainNode.type === 'return_statement') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: value.text,
          target: 'return',
          type: 'return'
        });
      }
    }

    // 提取字段访问数据流关系
    if (mainNode.type === 'field_access') {
      const object = mainNode.childForFieldName('object');
      const field = mainNode.childForFieldName('field');
      
      if (object?.text && field?.text) {
        relationships.push({
          source: object.text,
          target: field.text,
          type: 'assignment' // 将field_access映射为assignment以匹配基类类型
        });
      }
    }

    return relationships;
  }
}