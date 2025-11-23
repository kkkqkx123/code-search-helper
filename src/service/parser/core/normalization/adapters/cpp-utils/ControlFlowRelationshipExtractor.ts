import { CppHelperMethods } from './CppHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C++ 控制流关系提取器
 */
export class ControlFlowRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const text = astNode.text || '';
    let flowType = 'unknown';
    let isExceptional = false;

    // 条件控制流
    if (astNode.type === 'if_statement' || astNode.type === 'conditional_expression') {
      flowType = 'conditional';
      isExceptional = false;
    }
    // 循环控制流
    else if (astNode.type.includes('for_') || astNode.type.includes('while_') || astNode.type === 'do_statement') {
      flowType = 'loop';
      isExceptional = false;
    }
    // 异常控制流
    else if (astNode.type === 'try_statement' || astNode.type === 'catch_clause') {
      flowType = 'exception';
      isExceptional = true;
    }
    // 异步控制流
    else if (text.includes('await') || text.includes('async')) {
      flowType = 'async_await';
      isExceptional = false;
    }
    // 回调控制流
    else if (text.includes('callback') || text.includes('cb')) {
      flowType = 'callback';
      isExceptional = false;
    }

    return {
      type: 'control-flow',
      fromNodeId: CppHelperMethods.generateNodeId(astNode),
      toNodeId: 'unknown', // 需要更复杂的分析来确定目标
      flowType,
      condition: astNode.childForFieldName('condition')?.text,
      isExceptional,
      location: CppHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取控制流关系
   */
  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'conditional' | 'loop' | 'exception' | 'callback';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 条件控制流
    if (mainNode.type === 'if_statement' || mainNode.type === 'conditional_expression') {
      const condition = mainNode.childForFieldName('condition')?.text || 'condition';
      relationships.push({
        source: condition,
        target: 'if_branch',
        type: 'conditional'
      });
    }
    
    // 循环控制流
    if (mainNode.type.includes('for_') || mainNode.type.includes('while_') || mainNode.type === 'do_statement') {
      relationships.push({
        source: 'loop_condition',
        target: 'loop_body',
        type: 'loop'
      });
    }
    
    // 异常控制流
    if (mainNode.type === 'try_statement' || mainNode.type === 'catch_clause') {
      relationships.push({
        source: 'exception_source',
        target: 'catch_handler',
        type: 'exception'
      });
    }

    return relationships;
  }
}