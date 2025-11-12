import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 数据流关系提取器
 * 从 GoLanguageAdapter 迁移的数据流关系提取逻辑
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const flowType = this.determineFlowType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'data-flow',
      fromNodeId: sourceNode ? NodeIdGenerator.forAstNode(sourceNode) : 'unknown',
      toNodeId: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      flowType,
      dataType: this.extractDataType(astNode),
      flowPath: this.extractFlowPath(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定数据流类型
   */
  private determineFlowType(astNode: Parser.SyntaxNode): 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'channel_operation' {
    const nodeType = astNode.type;
    
    if (nodeType === 'assignment_statement' || nodeType === 'short_var_declaration') {
      return 'variable_assignment';
    } else if (nodeType === 'parameter_declaration') {
      return 'parameter_passing';
    } else if (nodeType === 'return_statement') {
      return 'return_value';
    } else if (nodeType === 'field_declaration') {
      return 'field_access';
    } else if (nodeType === 'send_statement' || nodeType === 'receive_statement') {
      return 'channel_operation';
    }
    
    return 'variable_assignment';
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'assignment_statement' || nodeType === 'short_var_declaration') {
      // 对于赋值语句，右侧是源
      return astNode.childForFieldName('right');
    } else if (nodeType === 'parameter_declaration') {
      // 对于参数，参数名是源
      return astNode.childForFieldName('name');
    } else if (nodeType === 'return_statement') {
      // 对于返回语句，返回值是源
      return astNode.childForFieldName('operand_list');
    } else if (nodeType === 'send_statement') {
      // 对于channel发送，发送的值是源
      return astNode.childForFieldName('value');
    }
    
    return null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'assignment_statement' || nodeType === 'short_var_declaration') {
      // 对于赋值语句，左侧是目标
      return astNode.childForFieldName('left');
    } else if (nodeType === 'parameter_declaration') {
      // 对于参数，函数体是目标
      return astNode.parent;
    } else if (nodeType === 'return_statement') {
      // 对于返回语句，调用者是目标
      return astNode.parent;
    } else if (nodeType === 'send_statement') {
      // 对于channel发送，channel是目标
      return astNode.childForFieldName('channel');
    }
    
    return null;
  }

  /**
   * 提取数据类型
   */
  private extractDataType(astNode: Parser.SyntaxNode): string | null {
    // 尝试从类型注解中提取类型
    const typeNode = astNode.childForFieldName('type');
    if (typeNode) {
      return typeNode.text;
    }
    
    // 对于赋值语句，尝试从左侧变量推断类型
    if (astNode.type === 'assignment_statement' || astNode.type === 'short_var_declaration') {
      const leftNode = astNode.childForFieldName('left');
      if (leftNode) {
        // 在实际实现中，这里可能需要符号表来推断类型
        return 'inferred';
      }
    }
    
    return null;
  }

  /**
   * 提取数据流路径
   */
  private extractFlowPath(astNode: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    let current: Parser.SyntaxNode | null = astNode;
    
    // 向上遍历AST，构建数据流路径
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'method_declaration') {
        const nameNode = current.childForFieldName('name');
        if (nameNode) {
          path.unshift(nameNode.text);
        }
      }
      current = current.parent;
    }
    
    return path;
  }

  /**
   * 提取数据流关系数组
   */
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'channel_operation';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'channel_operation';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const flowType = this.determineFlowType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || sourceNode.text;
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: flowType
        });
      }
    }

    return relationships;
  }

  /**
   * 分析channel操作的数据流
   */
  private analyzeChannelDataFlow(astNode: Parser.SyntaxNode): {
    channel: string;
    direction: 'send' | 'receive';
    dataType?: string;
  } | null {
    if (astNode.type === 'send_statement') {
      const channelNode = astNode.childForFieldName('channel');
      const valueNode = astNode.childForFieldName('value');
      
      return {
        channel: channelNode?.text || 'unknown',
        direction: 'send',
        dataType: valueNode?.type
      };
    } else if (astNode.type === 'unary_expression' && astNode.text.includes('<-')) {
      // Channel接收操作
      const channelNode = astNode.childForFieldName('operand');
      
      return {
        channel: channelNode?.text || 'unknown',
        direction: 'receive'
      };
    }
    
    return null;
  }

  /**
   * 分析range循环的数据流
   */
  private analyzeRangeDataFlow(astNode: Parser.SyntaxNode): {
    source: string;
    targets: string[];
    collectionType: 'array' | 'slice' | 'map' | 'channel' | 'string';
  } | null {
    if (astNode.type === 'range_clause') {
      const leftNode = astNode.childForFieldName('left');
      const rightNode = astNode.childForFieldName('right');
      
      if (leftNode && rightNode) {
        const targets: string[] = [];
        
        // 提取range的目标变量
        if (leftNode.type === 'expression_list') {
          for (const child of leftNode.children) {
            if (child.type === 'identifier') {
              targets.push(child.text);
            }
          }
        } else if (leftNode.type === 'identifier') {
          targets.push(leftNode.text);
        }
        
        // 确定集合类型
        let collectionType: 'array' | 'slice' | 'map' | 'channel' | 'string' = 'array';
        if (rightNode.type === 'slice_type') {
          collectionType = 'slice';
        } else if (rightNode.type === 'map_type') {
          collectionType = 'map';
        } else if (rightNode.type === 'channel_type') {
          collectionType = 'channel';
        } else if (rightNode.type === 'interpreted_string_literal') {
          collectionType = 'string';
        }
        
        return {
          source: rightNode.text,
          targets,
          collectionType
        };
      }
    }
    
    return null;
  }
}