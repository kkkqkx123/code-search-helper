import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言控制流关系提取器
 * 分析条件语句、循环、跳转语句等控制流关系
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const flowType = this.determineControlFlowType(astNode);

    if (!flowType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractControlFlowNodes(astNode, flowType);

    return {
      type: 'control-flow',
      flowType,
      fromNodeId,
      toNodeId,
      condition: this.extractCondition(astNode),
      label: this.extractLabel(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取控制流关系数组
   */
  extractControlFlowRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为控制流相关的节点类型
    if (!this.isControlFlowNode(astNode)) {
      return relationships;
    }

    const controlFlowMetadata = this.extractControlFlowMetadata(result, astNode, null);
    if (controlFlowMetadata) {
      relationships.push(controlFlowMetadata);
    }

    return relationships;
  }

  /**
   * 确定控制流类型
   */
  private determineControlFlowType(astNode: Parser.SyntaxNode): 'conditional' | 'loop' | 'switch' | 'jump' | 'exception' | null {
    const nodeType = astNode.type;

    switch (nodeType) {
      case 'if_statement':
      case 'else_clause':
        return 'conditional';
      case 'for_statement':
      case 'while_statement':
      case 'do_statement':
        return 'loop';
      case 'switch_statement':
      case 'case_statement':
        return 'switch';
      case 'break_statement':
      case 'continue_statement':
      case 'goto_statement':
      case 'return_statement':
        return 'jump';
      default:
        return null;
    }
  }

  /**
   * 提取控制流关系的节点
   */
  private extractControlFlowNodes(astNode: Parser.SyntaxNode, flowType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    // 根据控制流类型提取相关节点
    switch (flowType) {
      case 'conditional':
        toNodeId = this.extractConditionalTargetNode(astNode);
        break;
      case 'loop':
        toNodeId = this.extractLoopTargetNode(astNode);
        break;
      case 'switch':
        toNodeId = this.extractSwitchTargetNode(astNode);
        break;
      case 'jump':
        toNodeId = this.extractJumpTargetNode(astNode);
        break;
    }

    return { fromNodeId, toNodeId: toNodeId || 'unknown' };
  }

  /**
   * 提取条件目标节点
   */
  private extractConditionalTargetNode(astNode: Parser.SyntaxNode): string {
    // 对于if语句，提取条件表达式
    const condition = astNode.childForFieldName('condition');
    if (condition) {
      return generateDeterministicNodeId(condition);
    }

    // 对于else语句，提取else分支
    const consequence = astNode.childForFieldName('consequence');
    if (consequence) {
      return generateDeterministicNodeId(consequence);
    }

    return 'unknown';
  }

  /**
   * 提取循环目标节点
   */
  private extractLoopTargetNode(astNode: Parser.SyntaxNode): string {
    // 对于循环语句，提取循环体
    const body = astNode.childForFieldName('body');
    if (body) {
      return generateDeterministicNodeId(body);
    }

    // 对于for循环，还可以提取初始化、条件和更新部分
    const init = astNode.childForFieldName('initializer');
    if (init) {
      return generateDeterministicNodeId(init);
    }

    return 'unknown';
  }

  /**
   * 提取switch目标节点
   */
  private extractSwitchTargetNode(astNode: Parser.SyntaxNode): string {
    // 对于switch语句，提取条件表达式
    const condition = astNode.childForFieldName('condition');
    if (condition) {
      return generateDeterministicNodeId(condition);
    }

    // 对于case语句，提取case值
    const value = astNode.childForFieldName('value');
    if (value) {
      return generateDeterministicNodeId(value);
    }

    return 'unknown';
  }

  /**
   * 提取跳转目标节点
   */
  private extractJumpTargetNode(astNode: Parser.SyntaxNode): string {
    const nodeType = astNode.type;

    switch (nodeType) {
      case 'goto_statement':
        // 对于goto语句，提取标签
        const label = astNode.childForFieldName('label');
        if (label) {
          return generateDeterministicNodeId(label);
        }
        break;
      case 'break_statement':
      case 'continue_statement':
        // 对于break/continue，目标是最内层的循环/switch
        return 'loop_control';
      case 'return_statement':
        // 对于return语句，提取返回值
        const value = astNode.childForFieldName('value');
        if (value) {
          return generateDeterministicNodeId(value);
        }
        break;
    }

    return 'unknown';
  }

  /**
   * 提取条件表达式
   */
  private extractCondition(astNode: Parser.SyntaxNode): string | undefined {
    const condition = astNode.childForFieldName('condition');
    return condition?.text;
  }

  /**
   * 提取标签
   */
  private extractLabel(astNode: Parser.SyntaxNode): string | undefined {
    if (astNode.type === 'goto_statement') {
      const label = astNode.childForFieldName('label');
      return label?.text;
    } else if (astNode.type === 'case_statement') {
      const value = astNode.childForFieldName('value');
      return value?.text;
    } else if (astNode.type === 'labeled_statement') {
      const label = astNode.childForFieldName('label');
      return label?.text;
    }
    return undefined;
  }

  /**
   * 判断是否为控制流关系节点
   */
  private isControlFlowNode(astNode: Parser.SyntaxNode): boolean {
    const controlFlowNodeTypes = [
      'if_statement',
      'else_clause',
      'for_statement',
      'while_statement',
      'do_statement',
      'switch_statement',
      'case_statement',
      'break_statement',
      'continue_statement',
      'goto_statement',
      'return_statement',
      'labeled_statement'
    ];

    return controlFlowNodeTypes.includes(astNode.type);
  }
}