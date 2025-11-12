import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 控制流关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const controlFlowType = this.determineControlFlowType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);
    const condition = this.extractCondition(astNode);

    return {
      type: 'control-flow',
      controlFlowType,
      fromNodeId: sourceNode ? NodeIdGenerator.forAstNode(sourceNode) : 'unknown',
      toNodeId: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      condition,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取控制流关系数组
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

    const nodeType = mainNode.type;
    
    // 根据节点类型确定控制流类型
    let controlFlowType: 'conditional' | 'loop' | 'exception' | 'callback' | null = null;
    if (nodeType.includes('if') || nodeType.includes('switch')) {
      controlFlowType = 'conditional';
    } else if (nodeType.includes('for') || nodeType.includes('while') || nodeType.includes('foreach')) {
      controlFlowType = 'loop';
    } else if (nodeType.includes('try') || nodeType.includes('catch') || nodeType.includes('throw')) {
      controlFlowType = 'exception';
    } else if (nodeType.includes('lambda') || nodeType.includes('delegate')) {
      controlFlowType = 'callback';
    }

    if (controlFlowType) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('source.condition') || capture.name.includes('source.loop') || 
            capture.name.includes('source.exception') || capture.name.includes('source.lambda')) {
          const source = capture.node?.text || '';
          const targetCapture = result.captures?.find((c: any) => 
            c.name.includes('target.consequence') || 
            c.name.includes('target.loop') || 
            c.name.includes('target.catch') ||
            c.name.includes('target.lambda')
          );
          const target = targetCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: controlFlowType
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * 确定控制流类型
   */
  private determineControlFlowType(node: Parser.SyntaxNode): 'conditional' | 'loop' | 'exception' | 'callback' | 'switch' | 'try_catch' | 'iteration' {
    switch (node.type) {
      case 'if_statement':
        return 'conditional';
      case 'switch_statement':
      case 'switch_expression':
        return 'switch';
      case 'for_statement':
      case 'while_statement':
      case 'do_statement':
      case 'for_each_statement':
        return 'iteration';
      case 'try_statement':
        return 'try_catch';
      case 'throw_statement':
      case 'catch_clause':
        return 'exception';
      case 'lambda_expression':
      case 'anonymous_method_expression':
        return 'callback';
      default:
        return 'conditional';
    }
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'if_statement':
        return node.childForFieldName('condition');
      case 'switch_statement':
        return node.childForFieldName('value');
      case 'for_statement':
        return node.childForFieldName('condition');
      case 'while_statement':
        return node.childForFieldName('condition');
      case 'do_statement':
        return node.childForFieldName('condition');
      case 'for_each_statement':
        return node.childForFieldName('expression');
      case 'try_statement':
        return node.childForFieldName('body');
      case 'throw_statement':
        return node.childForFieldName('expression');
      case 'catch_clause':
        return node.childForFieldName('body');
      case 'lambda_expression':
        return node.childForFieldName('body');
      default:
        return null;
    }
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'if_statement':
        return node.childForFieldName('consequence');
      case 'switch_statement':
        return node.childForFieldName('body');
      case 'for_statement':
      case 'while_statement':
      case 'do_statement':
      case 'for_each_statement':
        return node.childForFieldName('body');
      case 'try_statement':
        const catchClauses = node.children.filter(child => child.type === 'catch_clause');
        return catchClauses.length > 0 ? catchClauses[0] : null;
      case 'throw_statement':
        return node.parent?.children.find(child => child.type === 'catch_clause') || null;
      case 'catch_clause':
        return node.childForFieldName('body');
      case 'lambda_expression':
        return node.childForFieldName('body');
      default:
        return null;
    }
  }

  /**
   * 提取条件
   */
  private extractCondition(node: Parser.SyntaxNode): string | null {
    switch (node.type) {
      case 'if_statement':
        const condition = node.childForFieldName('condition');
        return condition?.text || null;
      case 'switch_statement':
        const value = node.childForFieldName('value');
        return value?.text || null;
      case 'for_statement':
        const forCondition = node.childForFieldName('condition');
        return forCondition?.text || null;
      case 'while_statement':
        const whileCondition = node.childForFieldName('condition');
        return whileCondition?.text || null;
      case 'do_statement':
        const doCondition = node.childForFieldName('condition');
        return doCondition?.text || null;
      case 'for_each_statement':
        const expression = node.childForFieldName('expression');
        return expression?.text || null;
      case 'catch_clause':
        const type = node.childForFieldName('type');
        return type?.text || null;
      default:
        return null;
    }
  }

  /**
   * 分析条件分支
   */
  analyzeConditionalBranches(node: Parser.SyntaxNode): Array<{
    condition: string;
    branch: string;
    isElse: boolean;
  }> {
    const branches: Array<{
      condition: string;
      branch: string;
      isElse: boolean;
    }> = [];

    if (node.type === 'if_statement') {
      // 处理if分支
      const condition = node.childForFieldName('condition');
      const consequence = node.childForFieldName('consequence');
      
      if (condition?.text && consequence?.text) {
        branches.push({
          condition: condition.text,
          branch: consequence.text,
          isElse: false
        });
      }

      // 处理else分支
      const alternative = node.childForFieldName('alternative');
      if (alternative?.text) {
        branches.push({
          condition: 'else',
          branch: alternative.text,
          isElse: true
        });
      }
    } else if (node.type === 'switch_statement') {
      // 处理switch分支
      const body = node.childForFieldName('body');
      if (body) {
        for (const child of body.children) {
          if (child.type === 'switch_section') {
            const labels = child.children.filter(c => c.type === 'case_switch_label' || c.type === 'default_switch_label');
            const statements = child.children.filter(c => c.type === 'statement');
            
            if (labels.length > 0 && statements.length > 0) {
              const label = labels[0].text;
              const statement = statements.map(s => s.text).join('\n');
              
              branches.push({
                condition: label,
                branch: statement,
                isElse: label.includes('default')
              });
            }
          }
        }
      }
    }

    return branches;
  }

  /**
   * 分析循环结构
   */
  analyzeLoopStructure(node: Parser.SyntaxNode): {
    loopType: string;
    initialization?: string;
    condition?: string;
    update?: string;
    collection?: string;
    body: string;
  } | null {
    let loopType = '';
    let initialization: string | undefined;
    let condition: string | undefined;
    let update: string | undefined;
    let collection: string | undefined;
    let body = '';

    switch (node.type) {
      case 'for_statement':
        loopType = 'for';
        const initializer = node.childForFieldName('initializer');
        const forCondition = node.childForFieldName('condition');
        const forUpdate = node.childForFieldName('update');
        const forBody = node.childForFieldName('body');
        
        initialization = initializer?.text;
        condition = forCondition?.text;
        update = forUpdate?.text;
        body = forBody?.text || '';
        break;
        
      case 'while_statement':
        loopType = 'while';
        const whileCondition = node.childForFieldName('condition');
        const whileBody = node.childForFieldName('body');
        
        condition = whileCondition?.text;
        body = whileBody?.text || '';
        break;
        
      case 'do_statement':
        loopType = 'do-while';
        const doCondition = node.childForFieldName('condition');
        const doBody = node.childForFieldName('body');
        
        condition = doCondition?.text;
        body = doBody?.text || '';
        break;
        
      case 'for_each_statement':
        loopType = 'foreach';
        const forEachExpression = node.childForFieldName('expression');
        const forEachBody = node.childForFieldName('body');
        
        collection = forEachExpression?.text;
        body = forEachBody?.text || '';
        break;
        
      default:
        return null;
    }

    return {
      loopType,
      initialization,
      condition,
      update,
      collection,
      body
    };
  }

  /**
   * 分析异常处理
   */
  analyzeExceptionHandling(node: Parser.SyntaxNode): Array<{
    exceptionType: string;
    handler: string;
    isFinally: boolean;
  }> {
    const handlers: Array<{
      exceptionType: string;
      handler: string;
      isFinally: boolean;
    }> = [];

    if (node.type === 'try_statement') {
      // 处理catch子句
      for (const child of node.children) {
        if (child.type === 'catch_clause') {
          const type = child.childForFieldName('type');
          const body = child.childForFieldName('body');
          
          handlers.push({
            exceptionType: type?.text || 'unknown',
            handler: body?.text || '',
            isFinally: false
          });
        } else if (child.type === 'finally_clause') {
          const body = child.childForFieldName('body');
          
          handlers.push({
            exceptionType: 'finally',
            handler: body?.text || '',
            isFinally: true
          });
        }
      }
    }

    return handlers;
  }

  /**
   * 分析回调函数
   */
  analyzeCallbacks(node: Parser.SyntaxNode): Array<{
    callbackType: string;
    parameters: string[];
    body: string;
    capturedVariables: string[];
  }> {
    const callbacks: Array<{
      callbackType: string;
      parameters: string[];
      body: string;
      capturedVariables: string[];
    }> = [];

    if (node.type === 'lambda_expression' || node.type === 'anonymous_method_expression') {
      const callbackType = node.type === 'lambda_expression' ? 'lambda' : 'anonymous_method';
      const parameters = this.extractCallbackParameters(node);
      const body = node.childForFieldName('body')?.text || '';
      const capturedVariables = this.findCapturedVariables(node);

      callbacks.push({
        callbackType,
        parameters,
        body,
        capturedVariables
      });
    }

    return callbacks;
  }

  /**
   * 提取回调参数
   */
  private extractCallbackParameters(node: Parser.SyntaxNode): string[] {
    const parameters = node.childForFieldName('parameters');
    if (!parameters) {
      return [];
    }

    const paramList: string[] = [];
    for (const child of parameters.children) {
      if (child.type === 'parameter') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text) {
          paramList.push(nameNode.text);
        }
      }
    }
    return paramList;
  }

  /**
   * 查找捕获的变量
   */
  private findCapturedVariables(node: Parser.SyntaxNode): string[] {
    const captured: string[] = [];
    
    // 简化实现：在实际中需要更复杂的分析
    const body = node.childForFieldName('body');
    if (!body) {
      return captured;
    }

    // 查找外部变量引用
    this.findExternalVariableReferences(body, captured);
    
    return captured;
  }

  /**
   * 递归查找外部变量引用
   */
  private findExternalVariableReferences(node: Parser.SyntaxNode, captured: string[]): void {
    for (const child of node.children) {
      if (child.type === 'identifier') {
        // 简化判断：在实际中需要检查变量作用域
        captured.push(child.text);
      }
      this.findExternalVariableReferences(child, captured);
    }
  }

  /**
   * 分析模式匹配控制流
   */
  analyzePatternMatching(node: Parser.SyntaxNode): Array<{
    patternType: string;
    matchedValue: string;
    result: string;
  }> {
    const patterns: Array<{
      patternType: string;
      matchedValue: string;
      result: string;
    }> = [];

    if (node.type === 'switch_expression') {
      const value = node.childForFieldName('value');
      const matchedValue = value?.text || 'unknown';

      for (const child of node.children) {
        if (child.type === 'switch_expression_arm') {
          const pattern = child.childForFieldName('pattern');
          const result = child.childForFieldName('result');
          
          if (pattern?.text && result?.text) {
            patterns.push({
              patternType: pattern.type,
              matchedValue,
              result: result.text
            });
          }
        }
      }
    } else if (node.type === 'is_pattern_expression') {
      const expression = node.childForFieldName('expression');
      const pattern = node.childForFieldName('pattern');
      
      if (expression?.text && pattern?.text) {
        patterns.push({
          patternType: pattern.type,
          matchedValue: expression.text,
          result: 'boolean'
        });
      }
    }

    return patterns;
  }
}