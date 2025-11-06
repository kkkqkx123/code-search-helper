import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 数据流关系提取器
 * 专门处理Rust语言的数据流关系提取
 */
export class DataFlowRelationshipExtractor {
  /**
   * 提取数据流关系元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const flowType = this.determineFlowType(astNode);
    const flowPath = this.extractFlowPath(astNode);
    const dataType = this.extractDataType(astNode);

    return {
      type: 'data-flow',
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      flowType,
      dataType,
      flowPath,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
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
    type: 'assignment' | 'parameter' | 'return' | 'capture' | 'move' | 'borrow' | 'reference';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return' | 'capture' | 'move' | 'borrow' | 'reference';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取赋值关系
    if (mainNode.type === 'assignment_expression') {
      const leftNode = mainNode.childForFieldName('left');
      const rightNode = mainNode.childForFieldName('right');
      if (leftNode?.text && rightNode?.text) {
        relationships.push({
          source: rightNode.text,
          target: leftNode.text,
          type: this.determineAssignmentType(mainNode)
        });
      }
    }

    // 提取let绑定关系
    if (mainNode.type === 'let_declaration') {
      const patternNode = mainNode.childForFieldName('pattern');
      const initNode = mainNode.childForFieldName('init');
      if (patternNode?.text && initNode?.text) {
        relationships.push({
          source: initNode.text,
          target: patternNode.text,
          type: this.determineLetBindingType(mainNode)
        });
      }
    }

    // 提取函数参数传递关系
    if (mainNode.type === 'call_expression' || mainNode.type === 'method_call_expression') {
      const funcNode = mainNode.childForFieldName('function') || 
                      mainNode.childForFieldName('method');
      const argsNode = mainNode.childForFieldName('arguments');

      if (funcNode?.text && argsNode) {
        for (const arg of argsNode.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: funcNode.text,
              type: this.determineParameterType(arg)
            });
          }
        }
      }
    }

    // 提取返回值关系
    if (mainNode.type === 'return_expression') {
      const valueNode = mainNode.childForFieldName('value');
      if (valueNode?.text) {
        relationships.push({
          source: valueNode.text,
          target: 'function_return',
          type: 'return'
        });
      }
    }

    // 提取闭包捕获关系
    if (mainNode.type === 'closure_expression') {
      const captures = this.extractClosureCaptures(mainNode);
      for (const capture of captures) {
        relationships.push({
          source: capture,
          target: 'closure',
          type: 'capture'
        });
      }
    }

    // 提取引用和借用关系
    if (mainNode.type === 'reference_expression' || mainNode.type === 'borrow_expression') {
      const valueNode = mainNode.childForFieldName('value');
      if (valueNode?.text) {
        relationships.push({
          source: valueNode.text,
          target: mainNode.text,
          type: mainNode.type === 'reference_expression' ? 'reference' : 'borrow'
        });
      }
    }

    // 提取解引用关系
    if (mainNode.type === 'dereference_expression') {
      const valueNode = mainNode.childForFieldName('value');
      if (valueNode?.text) {
        relationships.push({
          source: valueNode.text,
          target: `*${valueNode.text}`,
          type: 'reference'
        });
      }
    }

    return relationships;
  }

  /**
   * 确定数据流类型
   */
  private determineFlowType(node: Parser.SyntaxNode): string {
    switch (node.type) {
      case 'assignment_expression':
        return 'variable_assignment';
      case 'let_declaration':
        return 'variable_binding';
      case 'call_expression':
      case 'method_call_expression':
        return 'function_parameter';
      case 'return_expression':
        return 'function_return';
      case 'closure_expression':
        return 'closure_capture';
      case 'reference_expression':
        return 'reference_creation';
      case 'borrow_expression':
        return 'borrow_creation';
      case 'dereference_expression':
        return 'dereference';
      case 'field_expression':
        return 'field_access';
      case 'index_expression':
        return 'index_access';
      default:
        return 'unknown';
    }
  }

  /**
   * 提取数据流路径
   */
  private extractFlowPath(node: Parser.SyntaxNode): string[] {
    const path: string[] = [];
    
    switch (node.type) {
      case 'assignment_expression':
        const left = node.childForFieldName('left');
        const right = node.childForFieldName('right');
        if (right?.text) path.push(right.text);
        if (left?.text) path.push(left.text);
        break;
        
      case 'let_declaration':
        const pattern = node.childForFieldName('pattern');
        const init = node.childForFieldName('init');
        if (init?.text) path.push(init.text);
        if (pattern?.text) path.push(pattern.text);
        break;
        
      case 'call_expression':
        const func = node.childForFieldName('function');
        const args = node.childForFieldName('arguments');
        if (func?.text) path.push(func.text);
        if (args?.text) path.push(args.text);
        break;
        
      case 'return_expression':
        const value = node.childForFieldName('value');
        if (value?.text) path.push(value.text);
        path.push('return');
        break;
        
      default:
        if (node.text) path.push(node.text);
    }
    
    return path;
  }

  /**
   * 提取数据类型
   */
  private extractDataType(node: Parser.SyntaxNode): string {
    // 尝试从节点中推断类型
    const text = node.text || '';
    
    if (text.includes('&')) return 'reference';
    if (text.includes('*')) return 'pointer';
    if (text.includes('Box::')) return 'box';
    if (text.includes('Rc::')) return 'rc';
    if (text.includes('Arc::')) return 'arc';
    if (text.includes('Vec::')) return 'vector';
    if (text.includes('HashMap::')) return 'hash_map';
    if (text.includes('Option::')) return 'option';
    if (text.includes('Result::')) return 'result';
    
    return 'unknown';
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(node: Parser.SyntaxNode): string {
    let sourceNode: Parser.SyntaxNode | null = null;
    
    switch (node.type) {
      case 'assignment_expression':
        sourceNode = node.childForFieldName('right');
        break;
      case 'let_declaration':
        sourceNode = node.childForFieldName('init');
        break;
      case 'call_expression':
        sourceNode = node.childForFieldName('arguments');
        break;
      case 'return_expression':
        sourceNode = node.childForFieldName('value');
        break;
      case 'reference_expression':
      case 'borrow_expression':
      case 'dereference_expression':
        sourceNode = node.childForFieldName('value');
        break;
    }
    
    return sourceNode ? generateDeterministicNodeId(sourceNode) : 'unknown';
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(node: Parser.SyntaxNode): string {
    let targetNode: Parser.SyntaxNode | null = null;
    
    switch (node.type) {
      case 'assignment_expression':
        targetNode = node.childForFieldName('left');
        break;
      case 'let_declaration':
        targetNode = node.childForFieldName('pattern');
        break;
      case 'call_expression':
        targetNode = node.childForFieldName('function');
        break;
      case 'return_expression':
        return 'function_return';
      case 'reference_expression':
      case 'borrow_expression':
      case 'dereference_expression':
        return node.text || 'unknown';
    }
    
    return targetNode ? generateDeterministicNodeId(targetNode) : 'unknown';
  }

  /**
   * 确定赋值类型
   */
  private determineAssignmentType(node: Parser.SyntaxNode): 'assignment' | 'move' | 'borrow' | 'reference' {
    const text = node.text || '';
    
    if (text.includes('&')) return 'borrow';
    if (text.includes('*')) return 'reference';
    if (text.includes('move')) return 'move';
    
    return 'assignment';
  }

  /**
   * 确定let绑定类型
   */
  private determineLetBindingType(node: Parser.SyntaxNode): 'assignment' | 'move' | 'borrow' | 'reference' {
    const text = node.text || '';
    
    if (text.includes('ref')) return 'borrow';
    if (text.includes('&')) return 'borrow';
    if (text.includes('move')) return 'move';
    
    return 'assignment';
  }

  /**
   * 确定参数类型
   */
  private determineParameterType(argNode: Parser.SyntaxNode): 'parameter' | 'move' | 'borrow' | 'reference' {
    const text = argNode.text || '';
    
    if (text.includes('&')) return 'borrow';
    if (text.includes('move')) return 'move';
    
    return 'parameter';
  }

  /**
   * 提取闭包捕获的变量
   */
  private extractClosureCaptures(closureNode: Parser.SyntaxNode): string[] {
    const captures: string[] = [];
    
    // 简单实现：从闭包的参数和体中提取可能的外部变量引用
    const body = closureNode.childForFieldName('body');
    if (body) {
      this.extractVariableReferences(body, captures);
    }
    
    return captures;
  }

  /**
   * 从节点中提取变量引用
   */
  private extractVariableReferences(node: Parser.SyntaxNode, references: string[]): void {
    if (!node) return;
    
    for (const child of node.children || []) {
      if (child.type === 'identifier') {
        references.push(child.text);
      }
      this.extractVariableReferences(child, references);
    }
  }

  /**
   * 分析所有权转移
   */
  private analyzeOwnershipTransfer(node: Parser.SyntaxNode): {
    isMove: boolean;
    isCopy: boolean;
    isClone: boolean;
  } {
    const text = node.text || '';
    
    return {
      isMove: text.includes('move') || this.isMoveExpression(node),
      isCopy: text.includes('.clone()') || this.isCopyType(node),
      isClone: text.includes('clone()')
    };
  }

  /**
   * 判断是否是移动表达式
   */
  private isMoveExpression(node: Parser.SyntaxNode): boolean {
    // 检查是否是移动语义的表达式
    return node.type === 'move_expression' ||
           !!(node.text && node.text.includes('move'));
  }

  /**
   * 判断是否是复制类型
   */
  private isCopyType(node: Parser.SyntaxNode): boolean {
    // 简单实现：检查是否是基本类型或实现了Copy的类型
    const text = node.text || '';
    const copyTypes = ['i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', '&str'];
    
    return copyTypes.some(type => text.includes(type));
  }

  /**
   * 提取生命周期信息
   */
  private extractLifetimeInfo(node: Parser.SyntaxNode): {
    hasLifetimes: boolean;
    lifetimes: string[];
  } {
    const lifetimes: string[] = [];
    const text = node.text || '';
    
    // 使用正则表达式提取生命周期注解
    const lifetimeRegex = /'([a-zA-Z]+)/g;
    let match;
    while ((match = lifetimeRegex.exec(text)) !== null) {
      lifetimes.push(match[0]);
    }
    
    return {
      hasLifetimes: lifetimes.length > 0,
      lifetimes
    };
  }
}