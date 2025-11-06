import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript数据流关系提取器
 * 提取变量赋值、数据传递等数据流关系
 */
export class DataFlowRelationshipExtractor {
 /**
   * 提取数据流关系的元数据
   */
  extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取源和目标信息
    const sourceInfo = this.extractSourceInfo(astNode);
    const targetInfo = this.extractTargetInfo(astNode);
    
    if (sourceInfo) {
      metadata.source = sourceInfo;
    }
    
    if (targetInfo) {
      metadata.target = targetInfo;
    }
    
    // 提取数据流类型
    metadata.flowType = this.extractFlowType(astNode);
    
    // 提取数据值信息
    metadata.dataValue = this.extractDataValue(astNode);
    
    // 标记是否为引用传递
    metadata.isReference = this.isReferenceFlow(astNode);
    
    return metadata;
  }

  /**
   * 提取数据流源信息
   */
  private extractSourceInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let sourceNode = null;
    
    if (astNode.type === 'assignment_expression') {
      // 对于赋值表达式，右侧是源
      sourceNode = astNode.childForFieldName('right');
    } else if (astNode.type === 'augmented_assignment_expression') {
      sourceNode = astNode.childForFieldName('right');
    } else if (astNode.type === 'return_statement') {
      // 对于返回语句，返回值是源
      sourceNode = astNode.childForFieldName('value');
    } else if (astNode.type === 'call_expression') {
      // 对于函数调用，可能返回值是源
      sourceNode = astNode;
    }
    
    if (sourceNode) {
      return {
        text: sourceNode.text,
        type: sourceNode.type,
        range: {
          start: { row: sourceNode.startPosition.row, column: sourceNode.startPosition.column },
          end: { row: sourceNode.endPosition.row, column: sourceNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

 /**
   * 提取数据流目标信息
   */
  private extractTargetInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let targetNode = null;
    
    if (astNode.type === 'assignment_expression') {
      // 对于赋值表达式，左侧是目标
      targetNode = astNode.childForFieldName('left');
    } else if (astNode.type === 'augmented_assignment_expression') {
      targetNode = astNode.childForFieldName('left');
    } else if (astNode.type === 'return_statement') {
      // 对于返回语句，函数是目标上下文
      targetNode = astNode.parent;
    } else if (astNode.type === 'call_expression') {
      // 对于函数调用，参数可能是目标
      targetNode = astNode.childForFieldName('arguments');
    }
    
    if (targetNode) {
      return {
        text: targetNode.text,
        type: targetNode.type,
        range: {
          start: { row: targetNode.startPosition.row, column: targetNode.startPosition.column },
          end: { row: targetNode.endPosition.row, column: targetNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

  /**
   * 提取数据流类型
   */
  private extractFlowType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    switch (astNode.type) {
      case 'assignment_expression':
        return 'assignment';
      case 'augmented_assignment_expression':
        return 'augmented_assignment';
      case 'return_statement':
        return 'return';
      case 'call_expression':
        return 'function_parameter';
      case 'variable_declarator':
        return 'initialization';
      default:
        return 'unknown';
    }
  }

  /**
   * 提取数据值信息
   */
  private extractDataValue(astNode: Parser.SyntaxNode): any {
    if (!astNode) return null;

    // 根据节点类型提取数据值
    switch (astNode.type) {
      case 'assignment_expression':
        const right = astNode.childForFieldName('right');
        return right ? right.text : null;
      case 'variable_declarator':
        const value = astNode.childForFieldName('value');
        return value ? value.text : null;
      case 'return_statement':
        const returnValue = astNode.childForFieldName('value');
        return returnValue ? returnValue.text : null;
      default:
        return astNode.text;
    }
  }

  /**
   * 检查是否为引用传递
   */
  private isReferenceFlow(astNode: Parser.SyntaxNode): boolean {
    if (!astNode) return false;

    // 检查是否为对象或数组赋值（引用传递）
    const dataValue = this.extractDataValue(astNode);
    if (dataValue) {
      const value = dataValue.trim();
      return value.startsWith('{') || value.startsWith('[') || 
             value.includes('new ') || value.includes('function') || 
             value.includes('=>') || value.includes('Object');
    }
    
    return false;
  }
}