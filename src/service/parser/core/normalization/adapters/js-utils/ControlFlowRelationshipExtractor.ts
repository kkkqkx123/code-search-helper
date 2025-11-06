import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript控制流关系提取器
 * 提取条件语句、循环、异常处理等控制流关系
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系的元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取控制流元素信息
    const elementInfo = this.extractElementInfo(astNode);
    if (elementInfo) {
      metadata.element = elementInfo;
    }
    
    // 提取控制流类型
    metadata.controlFlowType = this.extractControlFlowType(astNode);
    
    // 提取控制流条件
    metadata.condition = this.extractControlFlowCondition(astNode);
    
    // 提取控制流分支
    metadata.branches = this.extractControlFlowBranches(astNode);
    
    // 提取控制流上下文
    metadata.context = this.extractControlFlowContext(astNode);
    
    // 标记是否为复杂控制流
    metadata.isComplex = this.isComplexControlFlow(astNode);
    
    return metadata;
  }

 /**
   * 提取控制流元素信息
   */
  private extractElementInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    return {
      text: astNode.text,
      type: astNode.type,
      range: {
        start: { row: astNode.startPosition.row, column: astNode.startPosition.column },
        end: { row: astNode.endPosition.row, column: astNode.endPosition.column }
      }
    };
  }

  /**
   * 提取控制流类型
   */
  private extractControlFlowType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    switch (astNode.type) {
      case 'if_statement':
        return 'conditional';
      case 'for_statement':
      case 'for_in_statement':
      case 'for_of_statement':
        return 'loop';
      case 'while_statement':
        return 'while_loop';
      case 'do_statement':
        return 'do_while_loop';
      case 'switch_statement':
        return 'switch';
      case 'try_statement':
        return 'exception_handling';
      case 'ternary_expression':
        return 'ternary';
      case 'logical_expression':
        return 'logical';
      default:
        return 'unknown';
    }
  }

 /**
   * 提取控制流条件
   */
  private extractControlFlowCondition(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let conditionNode = null;
    
    switch (astNode.type) {
      case 'if_statement':
        conditionNode = astNode.childForFieldName('condition');
        break;
      case 'for_statement':
        // 对于for循环，条件可能包括初始化、条件和更新部分
        const condition = astNode.childForFieldName('condition');
        if (condition) {
          conditionNode = condition;
        }
        break;
      case 'while_statement':
        conditionNode = astNode.childForFieldName('condition');
        break;
      case 'do_statement':
        conditionNode = astNode.childForFieldName('condition');
        break;
      case 'switch_statement':
        conditionNode = astNode.childForFieldName('value');
        break;
      case 'ternary_expression':
        conditionNode = astNode.childForFieldName('condition');
        break;
      case 'logical_expression':
        conditionNode = astNode; // 整个逻辑表达式作为条件
        break;
    }
    
    if (conditionNode) {
      return {
        text: conditionNode.text,
        type: conditionNode.type,
        range: {
          start: { row: conditionNode.startPosition.row, column: conditionNode.startPosition.column },
          end: { row: conditionNode.endPosition.row, column: conditionNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

  /**
   * 提取控制流分支
   */
  private extractControlFlowBranches(astNode: Parser.SyntaxNode): any[] {
    const branches: any[] = [];
    
    if (!astNode) return branches;

    switch (astNode.type) {
      case 'if_statement':
        // 提取if、else if、else分支
        const consequence = astNode.childForFieldName('consequence');
        if (consequence) {
          branches.push({
            type: 'if',
            text: consequence.text,
            range: {
              start: { row: consequence.startPosition.row, column: consequence.startPosition.column },
              end: { row: consequence.endPosition.row, column: consequence.endPosition.column }
            }
          });
        }
        
        const alternative = astNode.childForFieldName('alternative');
        if (alternative && alternative.type !== 'if_statement') { // 不是else if
          branches.push({
            type: 'else',
            text: alternative.text,
            range: {
              start: { row: alternative.startPosition.row, column: alternative.startPosition.column },
              end: { row: alternative.endPosition.row, column: alternative.endPosition.column }
            }
          });
        } else if (alternative && alternative.type === 'if_statement') { // 是else if
          branches.push({
            type: 'else if',
            text: alternative.text,
            range: {
              start: { row: alternative.startPosition.row, column: alternative.startPosition.column },
              end: { row: alternative.endPosition.row, column: alternative.endPosition.column }
            }
          });
        }
        break;
        
      case 'switch_statement':
        // 提取case和default分支
        const body = astNode.childForFieldName('body');
        if (body && body.children) {
          for (const child of body.children) {
            if (child.type === 'case_statement' || child.type === 'default_statement') {
              const value = child.childForFieldName('value'); // case的值
              branches.push({
                type: child.type.replace('_', ' '),
                value: value ? value.text : 'default',
                text: child.text,
                range: {
                  start: { row: child.startPosition.row, column: child.startPosition.column },
                  end: { row: child.endPosition.row, column: child.endPosition.column }
                }
              });
            }
          }
        }
        break;
        
      case 'for_statement':
      case 'for_in_statement':
      case 'for_of_statement':
      case 'while_statement':
      case 'do_statement':
        // 循环的主体部分
        const bodyNode = this.getLoopBody(astNode);
        if (bodyNode) {
          branches.push({
            type: 'loop_body',
            text: bodyNode.text,
            range: {
              start: { row: bodyNode.startPosition.row, column: bodyNode.startPosition.column },
              end: { row: bodyNode.endPosition.row, column: bodyNode.endPosition.column }
            }
          });
        }
        break;
    }
    
    return branches;
  }

 /**
   * 提取控制流上下文
   */
 private extractControlFlowContext(astNode: Parser.SyntaxNode): any {
    const context: any = {};
    
    // 查找父控制流结构
    const parentControlFlow = this.findParentControlFlow(astNode);
    if (parentControlFlow) {
      context.parentControlFlow = {
        type: parentControlFlow.type,
        text: parentControlFlow.text.substring(0, 100) // 截取前100个字符
      };
    }
    
    // 检查嵌套级别
    context.nestingLevel = this.calculateNestingLevel(astNode);
    
    // 检查是否在函数内
    const parentFunction = this.findParentFunction(astNode);
    if (parentFunction) {
      context.inFunction = true;
      context.functionName = this.getFunctionName(parentFunction);
    }
    
    return context;
  }

  /**
   * 检查是否为复杂控制流
   */
  private isComplexControlFlow(astNode: Parser.SyntaxNode): boolean {
    if (!astNode) return false;

    // 计算复杂度：嵌套级别、分支数量等
    const nestingLevel = this.calculateNestingLevel(astNode);
    const branchCount = this.extractControlFlowBranches(astNode).length;
    
    // 如果嵌套级别大于1或分支数量大于2，则认为是复杂控制流
    return nestingLevel > 1 || branchCount > 2;
  }

  /**
   * 获取循环体
   */
  private getLoopBody(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    // 不同类型的循环有不同的主体字段名
    const bodyFieldNames = ['body', 'consequence', 'alternative'];
    
    for (const fieldName of bodyFieldNames) {
      const body = node.childForFieldName(fieldName);
      if (body) {
        return body;
      }
    }
    
    // 如果直接字段没有找到，检查所有子节点
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'statement_block' || child.type.endsWith('_statement')) {
          return child;
        }
      }
    }
    
    return null;
  }

  /**
   * 查找父控制流结构
   */
  private findParentControlFlow(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    let currentNode = node.parent;
    while (currentNode) {
      if (this.isControlFlowType(currentNode.type)) {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    
    return null;
 }

  /**
   * 检查节点类型是否为控制流类型
   */
  private isControlFlowType(nodeType: string): boolean {
    const controlFlowTypes = [
      'if_statement', 'for_statement', 'for_in_statement', 'for_of_statement',
      'while_statement', 'do_statement', 'switch_statement', 'try_statement',
      'ternary_expression', 'logical_expression'
    ];
    return controlFlowTypes.includes(nodeType);
  }

  /**
   * 计算嵌套级别
   */
  private calculateNestingLevel(node: Parser.SyntaxNode): number {
    let level = 0;
    let currentNode = node.parent;
    
    while (currentNode) {
      if (this.isControlFlowType(currentNode.type)) {
        level++;
      }
      currentNode = currentNode.parent;
    }
    
    return level;
  }

 /**
   * 查找父函数
   */
  private findParentFunction(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    let currentNode = node.parent;
    while (currentNode) {
      if (['function_declaration', 'method_definition', 'arrow_function', 
           'generator_function', 'async_function', 'async_arrow_function'].includes(currentNode.type)) {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    
    return null;
 }

  /**
   * 获取函数名
   */
  private getFunctionName(node: Parser.SyntaxNode): string {
    if (!node) return '';

    // 查找函数名
    if (['function_declaration', 'method_definition', 'generator_function', 
         'async_function'].includes(node.type)) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        return nameNode.text;
      }
      
      // 如果没有name字段，查找第一个标识符
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'identifier') {
            return child.text;
          }
        }
      }
    }
    
    return '';
  }
}