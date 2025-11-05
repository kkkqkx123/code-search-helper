import {
  DataFlowRelationship,
  Parser,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class DataFlowExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];
    
    // 使用Tree-Sitter查询提取数据流关系
    const queryResult = this.queryTree(ast, `
      ; 变量赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (identifier) @target.variable) @data.flow.assignment
      
      ; 对象属性赋值数据流
      (assignment_expression
        left: (member_expression
          object: (identifier) @source.object
          property: (property_identifier) @source.property)
        right: (identifier) @target.variable) @data.flow.property.assignment
      
      ; 数组元素赋值数据流
      (assignment_expression
        left: (subscript_expression
          object: (identifier) @source.array
          index: (identifier) @source.index)
        right: (identifier) @target.variable) @data.flow.array.assignment
      
      ; 函数参数传递数据流
      (call_expression
        function: (identifier) @target.function
        arguments: (argument_list
          (identifier) @source.parameter)) @data.flow.parameter
      
      ; 方法调用参数传递数据流
      (call_expression
        function: (member_expression
          object: (identifier) @target.object
          property: (property_identifier) @target.method)
        arguments: (argument_list
          (identifier) @source.parameter)) @data.flow.method.parameter
      
      ; 返回值数据流
      (return_statement
        (identifier) @source.variable) @data.flow.return
      
      ; 对象属性返回数据流
      (return_statement
        (member_expression
          object: (identifier) @source.object
          property: (property_identifier) @source.property)) @data.flow.property.return
      
      ; 函数表达式赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (function_expression) @target.function) @data.flow.function.assignment
      
      ; 箭头函数赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (arrow_function) @target.function) @data.flow.arrow.assignment
      
      ; 对象解构赋值数据流
      (assignment_expression
        left: (object_pattern
          (pair
            key: (property_identifier) @source.property
            value: (identifier) @target.variable))) @data.flow.destructuring.object
      
      ; 数组解构赋值数据流
      (assignment_expression
        left: (array_pattern
          (identifier) @target.variable)) @data.flow.destructuring.array
      
      ; 链式调用数据流
      (call_expression
        function: (member_expression
          object: (call_expression) @source.call
          property: (property_identifier) @target.method)) @data.flow.chained.call
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' = 'variable_assignment';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'source.variable' || captureName === 'source.parameter') {
            sourceId = generateDeterministicNodeId(node);
          } else if (captureName === 'target.variable' || captureName === 'target.function') {
            targetId = generateDeterministicNodeId(node);
          } else if (captureName === 'source.object' || captureName === 'source.property') {
            if (!sourceId) {
              sourceId = generateDeterministicNodeId(node);
            } else if (!targetId) {
              targetId = generateDeterministicNodeId(node);
            }
          }
          
          // 确定数据流类型
          if (captureName.includes('assignment')) {
            flowType = 'variable_assignment';
          } else if (captureName.includes('parameter')) {
            flowType = 'parameter_passing';
          } else if (captureName.includes('return')) {
            flowType = 'return_value';
          } else if (captureName.includes('property') || captureName.includes('field')) {
            flowType = 'field_access';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            flowType,
            flowPath: [sourceId, targetId],
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 辅助方法：执行Tree-Sitter查询
  private queryTree(ast: Parser.SyntaxNode, query: string): any[] {
    // 这里应该实现Tree-Sitter查询逻辑
    // 由于我们移除了TreeSitterService，这里需要一个简化的实现
    // 在实际应用中，你可能需要重新引入Tree-Sitter查询功能
    return [];
  }
}