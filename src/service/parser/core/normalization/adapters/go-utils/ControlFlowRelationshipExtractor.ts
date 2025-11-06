import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 控制流关系提取器
 * 从 GoLanguageAdapter 迁移的控制流关系提取逻辑
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const controlFlowType = this.determineControlFlowType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'control-flow',
      fromNodeId: sourceNode ? generateDeterministicNodeId(sourceNode) : 'unknown',
      toNodeId: targetNode ? generateDeterministicNodeId(targetNode) : 'unknown',
      controlFlowType,
      condition: this.extractCondition(astNode),
      loopVariable: this.extractLoopVariable(astNode),
      branches: this.extractBranches(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定控制流类型
   */
  private determineControlFlowType(astNode: Parser.SyntaxNode): 'conditional' | 'loop' | 'exception' | 'callback' | 'switch' | 'select' | 'jump' {
    const nodeType = astNode.type;
    
    if (nodeType === 'if_statement') {
      return 'conditional';
    } else if (nodeType === 'for_statement') {
      return 'loop';
    } else if (nodeType === 'switch_statement' || nodeType === 'type_switch_statement') {
      return 'switch';
    } else if (nodeType === 'select_statement') {
      return 'select';
    } else if (nodeType === 'return_statement' || nodeType === 'break_statement' || 
               nodeType === 'continue_statement' || nodeType === 'goto_statement' || 
               nodeType === 'fallthrough_statement') {
      return 'jump';
    } else if (nodeType === 'go_statement') {
      return 'callback';
    }
    
    return 'conditional';
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'if_statement') {
      return astNode.childForFieldName('condition');
    } else if (nodeType === 'for_statement') {
      const init = astNode.childForFieldName('init');
      const condition = astNode.childForFieldName('condition');
      const update = astNode.childForFieldName('update');
      return condition || init || update;
    } else if (nodeType === 'switch_statement' || nodeType === 'type_switch_statement') {
      return astNode.childForFieldName('init') || astNode.childForFieldName('subject');
    } else if (nodeType === 'select_statement') {
      return astNode;
    } else if (nodeType === 'return_statement') {
      return GoHelperMethods.findCallerFunctionContext(astNode);
    } else if (nodeType === 'break_statement' || nodeType === 'continue_statement') {
      return astNode.childForFieldName('label');
    } else if (nodeType === 'goto_statement') {
      return astNode.childForFieldName('label');
    } else if (nodeType === 'fallthrough_statement') {
      return astNode.parent;
    } else if (nodeType === 'go_statement') {
      return GoHelperMethods.findCallerFunctionContext(astNode);
    }
    
    return null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'if_statement') {
      return astNode.childForFieldName('consequence');
    } else if (nodeType === 'for_statement') {
      return astNode.childForFieldName('body');
    } else if (nodeType === 'switch_statement' || nodeType === 'type_switch_statement') {
      return astNode.childForFieldName('body');
    } else if (nodeType === 'select_statement') {
      return astNode.childForFieldName('body');
    } else if (nodeType === 'return_statement') {
      return astNode.childForFieldName('operand_list');
    } else if (nodeType === 'break_statement' || nodeType === 'continue_statement') {
      return this.findLoopTarget(astNode);
    } else if (nodeType === 'goto_statement') {
      return this.findLabelTarget(astNode);
    } else if (nodeType === 'fallthrough_statement') {
      return this.findNextCase(astNode);
    } else if (nodeType === 'go_statement') {
      return astNode.childForFieldName('call');
    }
    
    return null;
  }

  /**
   * 提取条件
   */
  private extractCondition(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'if_statement') {
      const condition = astNode.childForFieldName('condition');
      return condition ? condition.text : null;
    } else if (nodeType === 'for_statement') {
      const condition = astNode.childForFieldName('condition');
      return condition ? condition.text : null;
    } else if (nodeType === 'switch_statement') {
      const subject = astNode.childForFieldName('subject');
      return subject ? subject.text : null;
    }
    
    return null;
  }

  /**
   * 提取循环变量
   */
  private extractLoopVariable(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'for_statement') {
      // 检查是否是range循环
      const rangeClause = astNode.childForFieldName('range');
      if (rangeClause) {
        const left = rangeClause.childForFieldName('left');
        if (left) {
          return left.text;
        }
      }
      
      // 检查初始化语句中的变量
      const init = astNode.childForFieldName('init');
      if (init) {
        const left = init.childForFieldName('left');
        if (left) {
          return left.text;
        }
      }
    }
    
    return null;
  }

  /**
   * 提取分支
   */
  private extractBranches(astNode: Parser.SyntaxNode): string[] {
    const branches: string[] = [];
    const nodeType = astNode.type;
    
    if (nodeType === 'if_statement') {
      const consequence = astNode.childForFieldName('consequence');
      const alternative = astNode.childForFieldName('alternative');
      
      if (consequence) {
        branches.push('then');
      }
      if (alternative) {
        branches.push('else');
      }
    } else if (nodeType === 'switch_statement' || nodeType === 'type_switch_statement') {
      const body = astNode.childForFieldName('body');
      if (body) {
        for (const child of body.children) {
          if (child.type === 'expression_case' || child.type === 'type_case') {
            branches.push('case');
          } else if (child.type === 'default_case') {
            branches.push('default');
          }
        }
      }
    } else if (nodeType === 'select_statement') {
      const body = astNode.childForFieldName('body');
      if (body) {
        for (const child of body.children) {
          if (child.type === 'communication_case' || child.type === 'default_case') {
            branches.push('case');
          }
        }
      }
    }
    
    return branches;
  }

  /**
   * 查找循环目标
   */
  private findLoopTarget(jumpStmt: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = jumpStmt.parent;
    while (current) {
      if (current.type === 'for_statement' || current.type === 'switch_statement' || current.type === 'select_statement') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 查找标签目标
   */
  private findLabelTarget(gotoStmt: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const labelNode = gotoStmt.childForFieldName('label');
    if (!labelNode) {
      return null;
    }
    
    const labelText = labelNode.text;
    
    // 在当前作用域查找匹配的标签
    let current = gotoStmt.parent;
    while (current) {
      if (current.type === 'source_file') {
        // 在文件级别查找所有标签语句
        for (const child of current.children) {
          if (child.type === 'labeled_statement') {
            const label = child.childForFieldName('label');
            if (label && label.text === labelText) {
              return child;
            }
          }
        }
        break;
      }
      current = current.parent;
    }
    
    return null;
  }

  /**
   * 查找下一个case
   */
  private findNextCase(fallthroughStmt: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = fallthroughStmt;
    while (current) {
      const nextSibling = current.nextSibling;
      if (nextSibling) {
        if (nextSibling.type === 'expression_case' || nextSibling.type === 'type_case') {
          return nextSibling;
        }
      }
      current = current.parent;
      if (current && (current.type === 'switch_statement' || current.type === 'type_switch_statement')) {
        break;
      }
    }
    return null;
  }

  /**
   * 提取控制流关系数组
   */
  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback' | 'switch' | 'select' | 'jump';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'conditional' | 'loop' | 'exception' | 'callback' | 'switch' | 'select' | 'jump';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const controlFlowType = this.determineControlFlowType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || sourceNode.text;
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: controlFlowType
        });
      }
    }

    return relationships;
  }

  /**
   * 分析条件语句
   */
  private analyzeConditionalStatement(ifStmt: Parser.SyntaxNode): {
    condition: string;
    hasElse: boolean;
    hasElseIf: boolean;
    complexity: number;
  } | null {
    if (ifStmt.type !== 'if_statement') {
      return null;
    }

    const condition = ifStmt.childForFieldName('condition');
    const alternative = ifStmt.childForFieldName('alternative');
    
    let hasElse = false;
    let hasElseIf = false;
    
    if (alternative) {
      if (alternative.type === 'if_statement') {
        hasElseIf = true;
      } else {
        hasElse = true;
      }
    }
    
    // 计算条件复杂度
    let complexity = 1;
    if (condition) {
      // 简单启发式：基于逻辑操作符数量
      const conditionText = condition.text;
      const logicalOps = (conditionText.match(/&&|\|\|/g) || []).length;
      complexity += logicalOps;
    }
    
    return {
      condition: condition?.text || 'unknown',
      hasElse,
      hasElseIf,
      complexity
    };
  }

  /**
   * 分析循环语句
   */
  private analyzeLoopStatement(forStmt: Parser.SyntaxNode): {
    loopType: 'traditional' | 'range' | 'infinite';
    loopVariable?: string;
    collection?: string;
    hasBreak: boolean;
    hasContinue: boolean;
    complexity: number;
  } | null {
    if (forStmt.type !== 'for_statement') {
      return null;
    }

    const rangeClause = forStmt.childForFieldName('range');
    const condition = forStmt.childForFieldName('condition');
    const init = forStmt.childForFieldName('init');
    const update = forStmt.childForFieldName('update');
    
    let loopType: 'traditional' | 'range' | 'infinite' = 'traditional';
    let loopVariable: string | undefined;
    let collection: string | undefined;
    
    if (rangeClause) {
      loopType = 'range';
      const left = rangeClause.childForFieldName('left');
      const right = rangeClause.childForFieldName('right');
      if (left) {
        loopVariable = left.text;
      }
      if (right) {
        collection = right.text;
      }
    } else if (!condition && !init && !update) {
      loopType = 'infinite';
    }
    
    // 检查循环体中的break和continue
    const body = forStmt.childForFieldName('body');
    let hasBreak = false;
    let hasContinue = false;
    
    if (body) {
      this.searchForBreakContinue(body, (found) => {
        if (found === 'break') hasBreak = true;
        if (found === 'continue') hasContinue = true;
      });
    }
    
    // 计算循环复杂度
    let complexity = 1;
    if (loopType === 'range') complexity += 1;
    if (hasBreak || hasContinue) complexity += 1;
    
    return {
      loopType,
      loopVariable,
      collection,
      hasBreak,
      hasContinue,
      complexity
    };
  }

  /**
   * 递归搜索break和continue语句
   */
  private searchForBreakContinue(node: Parser.SyntaxNode, callback: (type: 'break' | 'continue') => void): void {
    if (node.type === 'break_statement') {
      callback('break');
    } else if (node.type === 'continue_statement') {
      callback('continue');
    }
    
    for (const child of node.children) {
      this.searchForBreakContinue(child, callback);
    }
  }

  /**
   * 分析switch语句
   */
  private analyzeSwitchStatement(switchStmt: Parser.SyntaxNode): {
    switchType: 'expression' | 'type';
    subject?: string;
    caseCount: number;
    hasDefault: boolean;
    complexity: number;
  } | null {
    if (switchStmt.type !== 'switch_statement' && switchStmt.type !== 'type_switch_statement') {
      return null;
    }

    const switchType = switchStmt.type === 'type_switch_statement' ? 'type' : 'expression';
    const subject = switchStmt.childForFieldName('subject');
    const body = switchStmt.childForFieldName('body');
    
    let caseCount = 0;
    let hasDefault = false;
    
    if (body) {
      for (const child of body.children) {
        if (child.type === 'expression_case' || child.type === 'type_case') {
          caseCount++;
        } else if (child.type === 'default_case') {
          hasDefault = true;
        }
      }
    }
    
    // 计算switch复杂度
    const complexity = caseCount + (hasDefault ? 0 : 1);
    
    return {
      switchType,
      subject: subject?.text,
      caseCount,
      hasDefault,
      complexity
    };
  }
}