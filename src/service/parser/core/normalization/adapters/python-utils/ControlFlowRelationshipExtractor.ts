import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 控制流关系提取器
 * 专门处理Python语言的控制流关系提取
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const flowType = this.determineControlFlowType(astNode);
    const flowDetails = this.extractFlowDetails(astNode);

    return {
      type: 'control-flow',
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      flowType,
      flowDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
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

    // 提取条件控制流
    if (mainNode.type === 'if_statement') {
      const condition = mainNode.childForFieldName('condition');
      if (condition?.text) {
        relationships.push({
          source: condition.text,
          target: 'if-block',
          type: 'conditional'
        });
      }

      // 提取elif分支
      for (const child of mainNode.children || []) {
        if (child.type === 'elif_clause') {
          const elifCondition = child.childForFieldName('condition');
          if (elifCondition?.text) {
            relationships.push({
              source: elifCondition.text,
              target: 'elif-block',
              type: 'conditional'
            });
          }
        }
      }

      // 提取else分支
      const elseClause = mainNode.children?.find((child: any) => child.type === 'else_clause');
      if (elseClause) {
        relationships.push({
          source: 'if-condition',
          target: 'else-block',
          type: 'conditional'
        });
      }
    }

    // 提取循环控制流
    if (mainNode.type === 'for_statement') {
      const target = mainNode.childForFieldName('target');
      const iter = mainNode.childForFieldName('iter');
      
      if (target?.text && iter?.text) {
        relationships.push({
          source: iter.text,
          target: target.text,
          type: 'loop'
        });
      }
    }

    // 提取while循环控制流
    if (mainNode.type === 'while_statement') {
      const condition = mainNode.childForFieldName('condition');
      if (condition?.text) {
        relationships.push({
          source: condition.text,
          target: 'while-body',
          type: 'loop'
        });
      }
    }

    // 提取异常控制流
    if (mainNode.type === 'try_statement') {
      relationships.push({
        source: 'try-block',
        target: 'except-block',
        type: 'exception'
      });

      // 提取具体的异常处理
      for (const child of mainNode.children || []) {
        if (child.type === 'except_clause') {
          const exceptionType = child.childForFieldName('type');
          if (exceptionType?.text) {
            relationships.push({
              source: 'try-block',
              target: exceptionType.text,
              type: 'exception'
            });
          }
        }
      }

      // 提取finally块
      const finallyClause = mainNode.children?.find((child: any) => child.type === 'finally_clause');
      if (finallyClause) {
        relationships.push({
          source: 'try-or-except-block',
          target: 'finally-block',
          type: 'exception'
        });
      }
    }

    // 提取上下文管理器控制流
    if (mainNode.type === 'with_statement') {
      const context = mainNode.childForFieldName('context');
      if (context?.text) {
        relationships.push({
          source: context.text,
          target: 'with-block',
          type: 'conditional' // 使用conditional作为上下文管理的通用类型
        });
      }
    }

    // 提取break和continue控制流
    if (mainNode.type === 'break_statement') {
      const loopNode = this.findEnclosingLoop(mainNode);
      if (loopNode) {
        relationships.push({
          source: 'break',
          target: `${loopNode.type}-exit`,
          type: 'loop'
        });
      }
    }

    if (mainNode.type === 'continue_statement') {
      const loopNode = this.findEnclosingLoop(mainNode);
      if (loopNode) {
        relationships.push({
          source: 'continue',
          target: `${loopNode.type}-next`,
          type: 'loop'
        });
      }
    }

    // 提取return控制流
    if (mainNode.type === 'return_statement') {
      const callerNode = PythonHelperMethods.findCallerFunctionContext(mainNode);
      if (callerNode) {
        const funcName = callerNode.childForFieldName('name')?.text || 'unknown';
        relationships.push({
          source: 'return',
          target: `${funcName}-exit`,
          type: 'callback'
        });
      }
    }

    // 提取raise控制流
    if (mainNode.type === 'raise_statement') {
      const exception = mainNode.childForFieldName('exception');
      if (exception?.text) {
        relationships.push({
          source: 'raise',
          target: exception.text,
          type: 'exception'
        });
      }
    }

    return relationships;
  }

  /**
   * 确定控制流类型
   */
  private determineControlFlowType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'if_statement':
        return 'conditional_branch';
      case 'for_statement':
      case 'while_statement':
        return 'loop_iteration';
      case 'try_statement':
        return 'exception_handling';
      case 'with_statement':
        return 'context_management';
      case 'break_statement':
      case 'continue_statement':
        return 'loop_control';
      case 'return_statement':
        return 'function_exit';
      case 'raise_statement':
        return 'exception_raise';
      default:
        return 'unknown_control_flow';
    }
  }

  /**
   * 提取控制流详细信息
   */
  private extractFlowDetails(astNode: Parser.SyntaxNode): any {
    const details: any = {};

    switch (astNode.type) {
      case 'if_statement':
        details.hasElse = astNode.children?.some((child: any) => child.type === 'else_clause');
        details.elifCount = astNode.children?.filter((child: any) => child.type === 'elif_clause').length || 0;
        break;
        
      case 'for_statement':
        const target = astNode.childForFieldName('target');
        const iter = astNode.childForFieldName('iter');
        details.loopVariable = target?.text;
        details.iterable = iter?.text;
        break;
        
      case 'while_statement':
        const condition = astNode.childForFieldName('condition');
        details.loopCondition = condition?.text;
        break;
        
      case 'try_statement':
        details.exceptCount = astNode.children?.filter((child: any) => child.type === 'except_clause').length || 0;
        details.hasFinally = astNode.children?.some((child: any) => child.type === 'finally_clause');
        break;
        
      case 'with_statement':
        const context = astNode.childForFieldName('context');
        details.contextManager = context?.text;
        break;
    }

    return details;
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'if_statement':
        const condition = astNode.childForFieldName('condition');
        return condition ? generateDeterministicNodeId(condition) : 'unknown';
        
      case 'for_statement':
        const iter = astNode.childForFieldName('iter');
        return iter ? generateDeterministicNodeId(iter) : 'unknown';
        
      case 'while_statement':
        const whileCondition = astNode.childForFieldName('condition');
        return whileCondition ? generateDeterministicNodeId(whileCondition) : 'unknown';
        
      case 'try_statement':
        return 'try-block';
        
      case 'with_statement':
        const context = astNode.childForFieldName('context');
        return context ? generateDeterministicNodeId(context) : 'unknown';
        
      default:
        return generateDeterministicNodeId(astNode);
    }
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'if_statement':
        return 'if-block';
        
      case 'for_statement':
        const target = astNode.childForFieldName('target');
        return target ? generateDeterministicNodeId(target) : 'unknown';
        
      case 'while_statement':
        return 'while-body';
        
      case 'try_statement':
        return 'except-block';
        
      case 'with_statement':
        return 'with-block';
        
      default:
        return 'unknown';
    }
  }

  /**
   * 查找 enclosing 循环
   */
  private findEnclosingLoop(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = node.parent;
    while (current) {
      if (current.type === 'for_statement' || current.type === 'while_statement') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 提取嵌套控制流关系
   */
  extractNestedControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'nested' | 'sequential';
    depth: number;
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'nested' | 'sequential';
      depth: number;
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 分析嵌套控制流
    const nestedFlows = this.analyzeNestedControlFlow(mainNode);
    for (const flow of nestedFlows) {
      relationships.push({
        source: flow.outer,
        target: flow.inner,
        type: 'nested',
        depth: flow.depth
      });
    }

    // 分析顺序控制流
    const sequentialFlows = this.analyzeSequentialControlFlow(mainNode);
    for (const flow of sequentialFlows) {
      relationships.push({
        source: flow.previous,
        target: flow.next,
        type: 'sequential',
        depth: 0
      });
    }

    return relationships;
  }

  /**
   * 分析嵌套控制流
   */
  private analyzeNestedControlFlow(node: Parser.SyntaxNode): Array<{
    outer: string;
    inner: string;
    depth: number;
  }> {
    const nestedFlows: Array<{
      outer: string;
      inner: string;
      depth: number;
    }> = [];

    const controlFlowTypes = ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'with_statement'];
    
    if (controlFlowTypes.includes(node.type)) {
      // 查找嵌套的控制流
      for (const child of node.children || []) {
        if (child.type === 'block' || child.type === 'suite') {
          this.findNestedControlFlowsInBlock(child, node.type, 1, nestedFlows);
        }
      }
    }

    return nestedFlows;
  }

  /**
   * 在块中查找嵌套控制流
   */
  private findNestedControlFlowsInBlock(
    blockNode: Parser.SyntaxNode, 
    parentType: string, 
    depth: number, 
    nestedFlows: Array<{
      outer: string;
      inner: string;
      depth: number;
    }>
  ): void {
    const controlFlowTypes = ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'with_statement'];
    
    for (const child of blockNode.children || []) {
      if (controlFlowTypes.includes(child.type)) {
        nestedFlows.push({
          outer: parentType,
          inner: child.type,
          depth
        });
        
        // 递归查找更深层的嵌套
        for (const subChild of child.children || []) {
          if (subChild.type === 'block' || subChild.type === 'suite') {
            this.findNestedControlFlowsInBlock(subChild, child.type, depth + 1, nestedFlows);
          }
        }
      }
    }
  }

  /**
   * 分析顺序控制流
   */
  private analyzeSequentialControlFlow(node: Parser.SyntaxNode): Array<{
    previous: string;
    next: string;
  }> {
    const sequentialFlows: Array<{
      previous: string;
      next: string;
    }> = [];

    const controlFlowTypes = ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'with_statement'];
    
    // 查找同一级别的顺序控制流
    let previousControlFlow: string | null = null;
    
    for (const child of node.children || []) {
      if (controlFlowTypes.includes(child.type)) {
        if (previousControlFlow) {
          sequentialFlows.push({
            previous: previousControlFlow,
            next: child.type
          });
        }
        previousControlFlow = child.type;
      }
    }

    return sequentialFlows;
  }

  /**
   * 提取条件分支复杂度
   */
  extractConditionalComplexity(result: any): {
    branchCount: number;
    nestingDepth: number;
    hasElse: boolean;
    elifCount: number;
  } {
    const complexity = {
      branchCount: 0,
      nestingDepth: 0,
      hasElse: false,
      elifCount: 0
    };

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode || mainNode.type !== 'if_statement') {
      return complexity;
    }

    // 计算分支数量
    complexity.branchCount = 1; // if分支
    complexity.elifCount = mainNode.children?.filter((child: any) => child.type === 'elif_clause').length || 0;
    complexity.branchCount += complexity.elifCount;
    
    complexity.hasElse = mainNode.children?.some((child: any) => child.type === 'else_clause') || false;
    if (complexity.hasElse) {
      complexity.branchCount += 1;
    }

    // 计算嵌套深度
    complexity.nestingDepth = this.calculateNestingDepth(mainNode);

    return complexity;
  }

  /**
   * 计算嵌套深度
   */
  private calculateNestingDepth(node: Parser.SyntaxNode, currentDepth: number = 0): number {
    let maxDepth = currentDepth;
    
    if (node.type === 'if_statement' || node.type === 'for_statement' || 
        node.type === 'while_statement' || node.type === 'try_statement') {
      
      for (const child of node.children || []) {
        if (child.type === 'block' || child.type === 'suite') {
          const childDepth = this.calculateNestingDepthInBlock(child, currentDepth + 1);
          maxDepth = Math.max(maxDepth, childDepth);
        }
      }
    }
    
    return maxDepth;
  }

  /**
   * 在块中计算嵌套深度
   */
  private calculateNestingDepthInBlock(blockNode: Parser.SyntaxNode, currentDepth: number): number {
    let maxDepth = currentDepth;
    
    for (const child of blockNode.children || []) {
      if (child.type === 'if_statement' || child.type === 'for_statement' || 
          child.type === 'while_statement' || child.type === 'try_statement') {
        
        const childDepth = this.calculateNestingDepth(child, currentDepth);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }
    
    return maxDepth;
  }
}